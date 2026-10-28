# Лабораторная работа № 4

«Доработка простого REST-сервиса. Взаимодействие двух сервисов»

Работу выполнил: студент группы РИЗ-250213у

Романов Сергей Сергеевич

2026

## Цель работы

Доработать REST-сервис, реализовав передачу модифицированного запроса между двумя приложениями, логирование запросов и измерение времени передачи. Реализовать задание на TypeScript с использованием Bun, Elysia и consola.

## Описание задачи

На основе сервиса лабораторных работ № 2–3 создать второй сервис на другом порту. В первом сервисе реализовать интерфейс ModifyRequestService и изменение systemName перед отправкой запроса второму сервису. Дополнительно реализовать изменение source и вывод времени от получения запроса первым сервисом до его получения вторым. Сохранить модели, валидацию, обработку ошибок и логирование из предыдущих работ.

Все лабораторные выполнены в одном репозитории и одной ветке. Для ЛР1 используется /api/v1, для ЛР2–3 — /api/v2, для ЛР4 — /api/v3. Код новой работы отмечен комментариями «ЛР4».

## Ход выполнения

### 1. Организация двух сервисов

Сервис 1 запускается из src/index.ts и слушает порт 8082. Сервис 2 запускается отдельным процессом из src/service2.ts и слушает порт 8084. Каждый процесс имеет свой экземпляр Elysia. Общие модели, валидация, обработчик feedback и сервисы модификации ответа используются повторно; копирование исходного проекта не требуется.

Схема взаимодействия:

```text
Postman -> Сервис 1 :8082/api/v3/feedback -> Сервис 2 :8084/api/v3/feedback
              |                                  |
        ответ клиенту                  запрос и время передачи в логах
```

Общий обработчик src/routes/v2/feedback/index.ts вынесен в фабрику createFeedback. Необязательный processRequest задаёт действие конкретного сервиса после успешной валидации. Маршрут /api/v2/feedback создаётся без этого действия и сохраняет поведение ЛР2–3.

Регистрация маршрутов Сервиса 1 в src/app.ts:

```typescript
new Elysia()
    .use(openapi())
    .group('/api/v1', group => group.use(ROUTES_V1))
    .group('/api/v2', group => group.use(ROUTES_V2))
    .group('/api/v3', group => group.use(createService1Feedback({
        targetUrl: service2Url, logger, timeoutMs,
    })))
```

Сервис 2 использует createService2App из src/service2-app.ts. Его точка входа:

```typescript
import { createService2App } from './service2-app'

const app = createService2App().listen(8084)
console.log(`Service 2 running at http://${app.server?.hostname}:${app.server?.port}`)
```

### 2. Реализация ModifyRequestService

В src/routes/v3/feedback/service.ts создан интерфейс ModifyRequestService и две его реализации. Первая устанавливает systemName = ERP, вторая — source = Service 1. Вместо строки Service 1 в systemName из Java-примера используется значение ERP, разрешённое перечислением Systems из ЛР3. Таким образом, валидация предыдущей работы сохраняется.

Тип FeedbackRequest получен из схемы FeedbackModelRequest, а Systems импортирован из перечислений ЛР3:

```typescript
type FeedbackRequest = typeof FeedbackModelRequest.static

export interface ModifyRequestService {
    modify(request: FeedbackRequest): FeedbackRequest
}

export class ModifySystemNameRequestService implements ModifyRequestService {
    modify(request: FeedbackRequest): FeedbackRequest {
        return { ...request, systemName: Systems.ERP }
    }
}

export class ModifySourceRequestService implements ModifyRequestService {
    modify(request: FeedbackRequest): FeedbackRequest {
        return { ...request, source: 'Service 1' }
    }
}
```

Модификаторы возвращают копии объекта. uid, operationUid, systemTime и остальные поля сохраняются. Исходный запрос доступен для логирования без изменений. В createService1Feedback обе реализации передаются в конструктор ForwardRequestService:

```typescript
const forwardingService = new ForwardRequestService(targetUrl, [
    new ModifySystemNameRequestService(),
    new ModifySourceRequestService(),
], logger, timeoutMs)

return createFeedback({
    logger,
    processRequest: (body, receivedAt) => forwardingService.forward(body, receivedAt),
})
```

### 3. Передача запроса через HTTP

ForwardRequestService последовательно применяет модификаторы и выполняет один POST-запрос через fetch. Адрес получателя по умолчанию — http://localhost:8084/api/v3/feedback; он может быть изменён переменной окружения SERVICE2_URL. Таймаут по умолчанию составляет 5000 мс.

Основной метод класса:

```typescript
async forward(request: FeedbackRequest, receivedAt: number): Promise<void> {
    const modified = this.modifiers.reduce(
        (value, service) => service.modify(value), request,
    )
    this.logger.info('Modified request sent to Service 2:', JSON.stringify(modified))

    const response = await fetch(this.targetUrl, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            [RECEIVED_AT_HEADER]: String(receivedAt),
        },
        body: JSON.stringify(modified),
        signal: AbortSignal.timeout(this.timeoutMs),
    })

    await response.text()
    if (!response.ok) {
        throw new Error(`Service 2 returned HTTP ${response.status}`)
    }
}
```

Сервис 1 ожидает ответ Сервиса 2 и затем формирует собственный успешный ответ. При ошибке соединения, HTTP-ошибке получателя или таймауте общий обработчик возвращает HTTP 500, code = failed и errorCode = UnknownException. Невалидный запрос возвращает HTTP 400 с ValidationException, а uid = 123 — HTTP 400 с UnsupportedCodeException; такие запросы второму сервису не отправляются. Сервис 2 запросы дальше не пересылает.

### 4. Измерение времени и логирование

В обоих сервисах время получения запроса записывается обработчиком onRequest до чтения JSON и валидации. Для каждого объекта Request хранится отдельная метка в WeakMap. [Порядок событий Elysia](https://elysiajs.com/essential/life-cycle).

```typescript
const receivedAt = new WeakMap<Request, number>()

// В цепочке регистрации обработчика:
.onRequest(({ request }) => {
    receivedAt.set(request, Date.now())
})
```

Сервис 1 передаёт метку в HTTP-заголовке x-service1-received-at. В Сервисе 2 разность вычисляется по двум меткам приёма, а не по произвольному полю systemTime клиента:

```typescript
processRequest: (body, receivedAt, request) => {
    const sentAt = Number(request.headers.get(RECEIVED_AT_HEADER))
    if (Number.isSafeInteger(sentAt) && sentAt > 0 && sentAt <= receivedAt) {
        logger.info(`Transfer time (uid=${body.uid}, operationUid=${body.operationUid}): ${receivedAt - sentAt} ms`)
    } else {
        logger.info('Transfer time unavailable: no valid Service 1 timestamp')
    }
}
```

Время измеряется от входа запроса в Сервис 1 до входа в Сервис 2. Интервал от нажатия Send до получения запроса первым сервисом серверу неизвестен. Оба процесса запускаются на одном компьютере и используют общие системные часы. При размещении на разных компьютерах нужна синхронизация часов. Прямой запрос к Сервису 2 без корректной метки обрабатывается, но время для него не вычисляется.

Логгеры снабжены тегами Service 1 / LR4 и Service 2 / LR4. В логах первого сервиса видны исходный и отправляемый запросы; в логах второго — полученный запрос и разница времени. В сообщении времени указаны uid и operationUid, что позволяет различать параллельные запросы.

### 5. Запуск и проверка

Установлены зависимости командой bun install. В отдельных терминалах Сервис 2 запускается командой bun run dev:service2, Сервис 1 — bun run dev. В Windows PowerShell можно использовать bun.cmd вместо bun. OpenAPI доступен по адресам http://localhost:8082/openapi и http://localhost:8084/openapi.

Подготовлена коллекция postman/lab4.postman_collection.json. Пример тела POST-запроса к http://localhost:8082/api/v3/feedback:

```json
{
  "uid": "message-4",
  "operationUid": "operation-4",
  "systemName": "CRM",
  "systemTime": "2026-10-28T12:00:00.000Z",
  "source": "Postman",
  "communicationId": 100,
  "templateId": 8,
  "productCode": 1500,
  "smsCode": 10
}
```

В Сервисе 1 исходные значения systemName и source равны CRM и Postman. После передачи Сервис 2 получает ERP и Service 1; остальные поля не изменяются. Клиент получает HTTP 200 с uid = message-4, operationUid = operation-4, code = success, пустыми errorCode и errorMessage и текущим systemTime.

При контрольном запуске обеих точек входа 28.10.2026 в логах второго сервиса получены строки:

```text
[Service 2 / LR4] i request: {"uid":"message-4","operationUid":"operation-4","systemName":"ERP","systemTime":"2026-10-28T12:00:00.000Z","source":"Service 1","communicationId":100,"templateId":8,"productCode":1500,"smsCode":10}
[Service 2 / LR4] i Transfer time (uid=message-4, operationUid=operation-4): 16 ms
```

Время зависит от конкретного запуска. Контрольный запрос с учебной меткой на секунду раньше отправки дал 1000 мс. При прямом запросе без заголовка выведено Transfer time unavailable: no valid Service 1 timestamp.

Автоматическая проверка bun test: 16 тестов выполнены успешно, 47 проверок. Покрыты передача изменённого запроса ровно один раз, заполнение необязательных полей, валидация обоих сервисов, запрещённый uid, измерение времени, отсутствие и некорректность метки, параллельные запросы, прежние маршруты, недоступность, HTTP-ошибка и таймаут получателя.

Проверка bun run typecheck завершилась без ошибок. Для совместимости с установленным TypeScript 7 заменён устаревший moduleResolution = node на bundler и явно добавлен TypeScript в зависимости разработки.

Дополнительно запущены обе настоящие точки входа на портах 8082 и 8084 и выполнены 14 запросов из новой и исходной Postman-коллекций с выполнением их скриптов проверок: успешно пройдены 64 проверки. Проверены также оба OpenAPI JSON-маршрута. Запросы выполнены программным HTTP-клиентом; скриншоты интерфейса Postman не использовались.

## Ответы на вопросы

Приведены ответы на все шесть вопросов, включая чётные и нечётные.

### 1. Зачем нужен параметр server.port?

Он задаёт порт встроенного веб-сервера Spring Boot. Разные порты позволяют запустить два сервиса на одном компьютере без конфликта адресов. В данной реализации аналогичная настройка передаётся в Elysia.listen: для Сервиса 1 — 8082, для Сервиса 2 — 8084.

### 2. Зачем нужна аннотация @SpringBootApplication?

Она объединяет @SpringBootConfiguration, @EnableAutoConfiguration и @ComponentScan: объявляет конфигурацию, включает автоматическую настройку приложения и поиск компонентов в пакете приложения и его подпакетах. В реализации на Elysia зависимости и маршруты подключаются явно через импорты, фабрики и use/group. [Документация Spring Boot](https://docs.spring.io/spring-boot/reference/using/using-the-springbootapplication-annotation.html).

### 3. Зачем нужна аннотация @Builder?

Lombok генерирует API для создания объекта через builder: значения задаются цепочкой именованных методов, затем вызывается build(). Это сокращает ручной код создания сложных объектов. В TypeScript для моделей запросов и ответов используются типизированные литералы объектов. [Документация Lombok Builder](https://projectlombok.org/features/Builder).

### 4. Зачем нужна аннотация @NoArgsConstructor?

Lombok генерирует конструктор без аргументов. Он нужен, когда объект должен создаваться без передачи полей, в том числе по требованиям некоторых библиотек. В Java наличие final-полей без начальных значений может препятствовать такому конструктору. [Документация конструкторов Lombok](https://projectlombok.org/features/constructor).

### 5. Зачем нужна аннотация @AllArgsConstructor?

Lombok генерирует конструктор с параметром для каждого нестатического поля класса. Он позволяет передать значения полей при создании объекта. В TypeScript аналогичный конструктор задаётся явно; при работе с JSON часто достаточно литерала объекта. [Документация конструкторов Lombok](https://projectlombok.org/features/constructor).

### 6. Зачем нужна аннотация @Data?

Lombok объединяет генерацию геттеров, сеттеров для изменяемых полей, toString(), equals(), hashCode() и конструктора для обязательных полей. Это уменьшает объём шаблонного кода Java-модели. В TypeScript поля объектов доступны напрямую, а для вывода запроса используется JSON.stringify; полного автоматического аналога @Data здесь не требуется. [Документация Lombok Data](https://projectlombok.org/features/Data).

## Репозиторий

Исходный код: https://github.com/rssXX/programming-3-semester

Файлы ЛР4: src/app.ts, src/service2-app.ts, src/service2.ts, src/routes/v3/feedback/index.ts, src/routes/v3/feedback/service.ts, tests/lab4.test.ts, postman/lab4.postman_collection.json. Общий обработчик расположен в src/routes/v2/feedback/index.ts.

## Вывод

Реализовано взаимодействие двух независимых HTTP-сервисов на Bun, TypeScript и Elysia. Созданы интерфейс модификации запроса и две реализации, добавлена передача изменённого JSON, сохранены валидация и обработка ошибок. Второй сервис логирует полученный запрос и время его передачи. Работоспособность подтверждена интеграционными тестами, проверкой типов и выполнением запросов из коллекций; предыдущие лабораторные остаются доступны в том же репозитории.
