# Лабораторная работа № 3

Министерство науки и высшего образования Российской Федерации

Федеральное государственное автономное образовательное учреждение высшего образования

«Уральский федеральный университет имени первого Президента России Б. Н. Ельцина»

Институт радиоэлектроники и информационных технологий — РТФ

Центр ускоренного обучения

По дисциплине «Технологии программирования»

«Доработка REST-сервиса: изменение ответа и логирование»

Работу выполнил: студент группы РИЗ-250213у

Романов Сергей Сергеевич

Екатеринбург, 2026

## Цель работы

Доработать REST-сервис ЛР2: вынести форматирование времени в утилиту, добавить изменение ответа через интерфейс, использовать перечисления и настроить логирование обработки запросов и ошибок.

## Описание задачи

Необходимо создать DateTimeUtil, интерфейс ModifyResponseService с двумя реализациями, перечисления результата и ошибок. Дополнительно требуется метод toString() у запроса, INFO-логи этапов обработки и ERROR-логи исключений и ошибок валидации. Поле systemName должно принимать значения перечисления Systems: ERP, CRM или WMS.

Работа выполнена на TypeScript, Bun, Elysia и consola. Все лабораторные хранятся в одной ветке main. ЛР3 продолжает POST /api/v2/feedback, созданный в ЛР2. Этап работы отмечен коммитом e5615fe (lr-3). В актуальной ветке общий обработчик позднее отрефакторен в ЛР4–5; функциональность ЛР3 сохранена.

## Ход выполнения

### 1. Структура реализации

| Файл | Содержимое, относящееся к ЛР3 |
| --- | --- |
| src/util/DateTimeUtil.ts | Форматирование времени ответа |
| src/routes/v2/feedback/model.ts | Модели и FeedbackRequest.toString() |
| src/routes/v2/feedback/enums.ts | Systems, Codes, ErrorCodes, ErrorMessages |
| src/routes/v2/feedback/service.ts | Валидация и две реализации ModifyResponseService |
| src/routes/v2/feedback/index.ts | Приём запроса и обработка ошибок |
| src/routes/v2/feedback/response-service.ts | Формирование ответов, вынесенное сюда позже в ЛР5 |

Вместо SLF4J и @Slf4j используется библиотека consola. Сообщения выводятся в консоль через info() и error(). Отдельный Java-проект не создавался.

### 2. Утилита DateTimeUtil

Время ответа формируется в одном месте. Метод получает Date и возвращает строку ISO 8601:

```typescript
export class DateTimeUtil {
    static getCustomFormat(date: Date): string {
        return date.toISOString()
    }
}
```

Вызов в обработчике или сервисе ответа:

```typescript
systemTime: DateTimeUtil.getCustomFormat(new Date())
```

Например, дата 2026-10-28T12:00:00.000Z возвращается в том же ISO-формате. Буква Z обозначает UTC. Это серверное время ответа, а не копия входящего systemTime. Метод getDaysInYear, который сейчас находится в том же файле, добавлен позже в ЛР5 и к заданию ЛР3 не относится.

### 3. Интерфейс изменения ответа

Тип FeedbackResponse получается из схемы FeedbackModelResponse. Обе реализации имеют одинаковый метод modify():

```typescript
type FeedbackResponse = typeof FeedbackModelResponse.static

export interface ModifyResponseService {
    modify(response: FeedbackResponse): FeedbackResponse
}
```

Первая реализация заменяет operationUid случайным UUID:

```typescript
export class ModifyOperationUidResponseService implements ModifyResponseService {
    modify(response: FeedbackResponse): FeedbackResponse {
        consola.info('Before operationUid modification:', JSON.stringify(response))
        response.operationUid = crypto.randomUUID()
        consola.info('After operationUid modification:', JSON.stringify(response))
        return response
    }
}
```

Вторая реализация обновляет systemTime. В актуальном коде логгер передаётся в конструктор, по умолчанию используется consola:

```typescript
export class ModifySystemTimeResponseService implements ModifyResponseService {
    constructor(private readonly logger = consola) {}

    modify(response: FeedbackResponse): FeedbackResponse {
        this.logger.info('Before systemTime modification:', JSON.stringify(response))
        response.systemTime = DateTimeUtil.getCustomFormat(new Date())
        this.logger.info('After systemTime modification:', JSON.stringify(response))
        return response
    }
}
```

Обе реализации изменяют переданный объект и возвращают его. В основном HTTP-сценарии выбран ModifySystemTimeResponseService. ModifyOperationUidResponseService реализован, но автоматически вместе с ним не вызывается. Поэтому operationUid в обычном ответе остаётся равным значению запроса.

На этапе ЛР3 выбор был явно записан в контроллере:

```typescript
const modifyResponseService: ModifyResponseService =
    new ModifySystemTimeResponseService()
```

В текущем коде тот же выбор находится в FeedbackResponseService. Для демонстрации второй реализации можно отдельно вызвать ModifyOperationUidResponseService.modify(). При подготовке отчёта проверены оба модификатора и сохранение operationUid в обычном HTTP-сценарии.

### 4. Перечисления результата и ошибок

В enums.ts созданы Codes, ErrorCodes и ErrorMessages:

```typescript
export enum Codes {
    SUCCESS = 'success',
    FAILED = 'failed',
}

export enum ErrorCodes {
    EMPTY = '',
    VALIDATION_EXCEPTION = 'ValidationException',
    UNKNOWN_EXCEPTION = 'UnknownException',
    UNSUPPORTED_EXCEPTION = 'UnsupportedCodeException',
}

export enum ErrorMessages {
    EMPTY = '',
    VALIDATION = 'Ошибка валидации',
    UNSUPPORTED = 'Не поддерживаемая ошибка',
    UNKNOWN = 'Произошла непредвиденная ошибка',
}
```

Схема ответа использует t.Enum вместо произвольных строк. При успешной обработке формируется Codes.SUCCESS и пустые значения ошибки. При исключении — Codes.FAILED и соответствующие ErrorCodes и ErrorMessages. Это уменьшает вероятность опечаток при формировании ответа.

### 5. Перечисление Systems в запросе

```typescript
export enum Systems {
    ERP = 'ERP',
    CRM = 'CRM',
    WMS = 'WMS',
}
```

Поле запроса описано так:

```typescript
systemName: t.Optional(t.Enum(Systems))
```

Поле остаётся необязательным. Если оно передано, допускаются только ERP, CRM и WMS с указанным регистром. Значения OTHER, пустая строка и логическое false отклоняются с HTTP 400 и ValidationException.

### 6. Метод toString() и логирование

Для вывода запроса создан небольшой класс FeedbackRequest:

```typescript
export class FeedbackRequest {
    constructor(private readonly data: typeof FeedbackModelRequest.static) {}

    toString(): string {
        return JSON.stringify(this.data)
    }
}
```

В начале обработки корректного по схеме запроса выводится:

```typescript
logger.info(`request: ${new FeedbackRequest(body).toString()}`)
```

На уровне INFO также записываются начало и завершение валидации, созданный ответ, состояние до и после изменения времени и отправка ответа. По этим сообщениям можно проследить последовательность обработки.

Сокращённый перечень сообщений успешного сценария, без оформления консольного вывода consola:

```text
request: {...}
Request validation started
Request validation passed
Response created: {...}
Before systemTime modification: {...}
After systemTime modification: {...}
Response sent (200): {...}
```

Время до и после модификации иногда совпадает до миллисекунды: формирование ответа и повторная установка времени могут выполниться очень быстро. Это не означает, что метод не вызывался; вызов виден по паре логов.

При uid = 123 перед выбрасыванием исключения записывается ERROR. При ошибке схемы её сообщения передаются в RequestValidationService. Например, неправильное communicationId отражается в логе вместе с путём /communicationId. HTTP-ответ остаётся общим: «Ошибка валидации», подробности доступны в консоли.

```typescript
if (body.uid === '123') {
    logger.error('UnsupportedCodeException: uid 123 is not supported')
    throw new UnsupportedCodeException('uid 123 не поддерживается')
}
```

В обработчике ошибок записываются исходный запрос, сообщение ошибки и итоговый ответ. В Elysia нет Spring BindingResult: соответствующие сведения получаются из error.all при code = VALIDATION. На этапе ЛР3 эта логика находилась в контроллере; в актуальной ветке она вынесена в FeedbackResponseService.

### 7. Запуск и тестирование

```powershell
bun.cmd install
bun.cmd run start
```

В Postman отправить POST http://localhost:8082/api/v2/feedback с Content-Type: application/json. Сервис 2 и БД для этой работы не нужны.

Пример запроса:

```json
{
  "uid": "message-3",
  "operationUid": "operation-3",
  "systemName": "CRM",
  "systemTime": "2026-10-28T12:00:00.000Z",
  "source": "Postman",
  "communicationId": 100
}
```

Ожидается HTTP 200, code = success, пустые errorCode и errorMessage, uid = message-3 и operationUid = operation-3. Поле systemTime содержит время сервера. В консоли должны появиться сообщения от получения запроса до отправки ответа.

| Сценарий | Ожидаемый HTTP-результат и логи |
| --- | --- |
| Корректный запрос с CRM | 200; INFO запроса, валидации и изменения времени |
| ERP и WMS | 200; оба значения перечисления допустимы |
| systemName не передан | 200, поле необязательно |
| systemName = OTHER, пустая строка или false | 400, ValidationException; ERROR с деталями проверки |
| uid = 123 | 400, UnsupportedCodeException; ERROR перед исключением |
| communicationId = 0 | 400, ValidationException; ERROR с /communicationId |
| Несколько неправильных полей | 400; в консоли детали обнаруженных нарушений |
| Прямой вызов модификатора operationUid | Создаётся UUID; есть сообщения до и после |

Коллекция postman/feedback.postman_collection.json проверяет базовый успех и ошибки. Для Systems скопировать корректный запрос и последовательно заменить systemName. Для проверки логирования держать открытым терминал сервера.

При подготовке отчётов ЛР2–3 проверены 34 HTTP-запроса к общему обработчику. Дополнительно проверены DateTimeUtil, обе реализации ModifyResponseService и наличие сообщений INFO и ERROR. Код приложения при подготовке отчётов не изменялся.

### 8. Места для самостоятельного добавления скриншотов

[Место для скриншота 1: корректный POST с systemName = CRM и ответ 200.]

[Место для скриншота 2: INFO-логи успешной обработки, включая состояние ответа до и после изменения времени.]

[Место для скриншота 3: запросы со значениями ERP и WMS.]

[Место для скриншота 4: неверный systemName, ответ 400 и ERROR-логи.]

[Место для скриншота 5: uid = 123, UnsupportedCodeException и ERROR-лог.]

[Место для скриншота 6: несколько ошибок валидации и подробности в консоли.]

[Место для скриншота 7: набор запросов ЛР3 в Postman.]

## Ответы на контрольные вопросы

По условию выбирается чётность вопросов согласно номеру в списке группы. Приведены ответы на все шесть вопросов.

### 1. Что такое ERP? Примеры

ERP — Enterprise Resource Planning, система планирования ресурсов предприятия. Она связывает основные процессы: финансы, закупки, производство, персонал и снабжение, чтобы подразделения работали с согласованными данными. Примеры: SAP S/4HANA Cloud и Oracle Fusion Cloud ERP [1, 2].

### 2. Что такое CRM? Примеры

CRM — Customer Relationship Management, система управления отношениями с клиентами. В ней хранят контакты, обращения и историю взаимодействий, ведут потенциальные сделки и работу продаж. Примеры: Salesforce CRM и Microsoft Dynamics 365 Sales [3, 4].

### 3. Что такое WMS? Примеры

WMS — Warehouse Management System, система управления складом. Она помогает учитывать размещение товаров, приёмку, перемещения, комплектацию заказов и отгрузку. Примеры: Oracle Warehouse Management и SAP Extended Warehouse Management (SAP EWM) [5, 6].

### 4. Какие библиотеки логирования бывают в Spring?

В экосистеме Java используются фасады SLF4J и Commons Logging, реализации Logback и Log4j2, а также java.util.logging. Spring Boot предоставляет настройки для нескольких систем; при обычном использовании стартовых зависимостей по умолчанию применяется Logback. Фасад предоставляет общий API, реализация записывает сообщения. В TypeScript-проекте вместо них используется consola [7, 8].

### 5. Какие уровни логирования используются с @Slf4j?

TRACE — самые подробные события; DEBUG — диагностические сведения; INFO — основные этапы нормальной работы; WARN — предупреждения о возможной проблеме; ERROR — ошибки выполнения. При выборе порога INFO сообщения TRACE и DEBUG обычно не выводятся. @Slf4j — аннотация Lombok, создающая поле логгера SLF4J; уровни задаются API и настройками системы логирования. В работе используются INFO и ERROR [7, 11, 12].

### 6. Что означает @Qualifier?

В Spring аннотация уточняет, какой компонент внедрить, если подходят несколько кандидатов одного типа. Например, при двух реализациях ModifyResponseService можно выбрать требуемую по квалификатору. В нашем проекте выбор сделан явно: создаётся ModifySystemTimeResponseService и передаётся туда, где требуется изменение ответа [9].

## Источники

Дата обращения: 28.10.2026.

1. SAP. Что такое ERP: https://www.sap.com/resources/what-is-erp
2. Oracle Fusion Cloud ERP: https://www.oracle.com/erp/
3. Salesforce. Что такое CRM: https://www.salesforce.com/crm/what-is-crm/
4. Microsoft Dynamics 365 Sales: https://www.microsoft.com/en-us/dynamics-365/products/sales
5. Oracle. Что такое WMS: https://www.oracle.com/scm/logistics/warehouse-management/what-is-warehouse-management/
6. SAP Extended Warehouse Management: https://www.sap.com/products/scm/extended-warehouse-management.html
7. Spring Boot. Logging: https://docs.spring.io/spring-boot/reference/features/logging.html
8. SLF4J. Manual: https://slf4j.org/manual.html
9. Spring Framework. Qualifiers: https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
10. Методичка labs/2023_2024__Spring_Boot__Laboratornaya_rabota_3.docx и исходный код проекта.
11. Project Lombok. @Log и @Slf4j: https://projectlombok.org/features/log
12. SLF4J. Интерфейс Logger: https://www.slf4j.org/api/org/slf4j/Logger.html

## Ссылка на репозиторий

https://github.com/rssXX/programming-3-semester

Работа находится в общей ветке main. Этап ЛР3 отмечен коммитом e5615fe; текущие общие модели и обработчик расположены в src/routes/v2/feedback.

## Вывод

REST-сервис доработан: форматирование времени вынесено в DateTimeUtil, реализованы два модификатора ответа и выбран модификатор systemTime для основного сценария. Результат и ошибки описаны перечислениями, для systemName введён Systems. INFO-логи показывают этапы обработки и изменения ответа, ERROR-логи — исключения и подробности валидации. Проверены корректные запросы, недопустимые значения и работа обеих реализаций модификатора.
