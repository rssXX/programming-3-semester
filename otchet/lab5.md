# Лабораторная работа № 5

«Расчёт годовой и квартальной премии. Unit-тестирование»

Работу выполнил: студент группы РИЗ-250213у

Романов Сергей Сергеевич

2026

## Цель работы

Доработать REST-сервис, добавив расчёт годовой и квартальной премии, создать unit-тесты и выполнить рефакторинг контроллера. Задание из методических материалов по Java и Spring Boot реализовать на используемом в проекте стеке: TypeScript, Bun, Elysia и consola.

## Описание задачи

Расширить входящее сообщение полями должности, зарплаты, множителя премии и количества отработанных дней. Создать перечисление Positions и сервис AnnualBonusService. Добавить в ответ годовую премию. Учесть високосные годы, добавить должности PO, TPM и CTO и признак isManager. Реализовать квартальную премию только для руководителей и unit-тесты расчётов. Добавить комментарии к полям моделей Request и Response и сократить код контроллера.

Работа выполнена в том же репозитории и ветке, что и ЛР1–4. Для ЛР5 добавлен маршрут POST /api/v4/feedback в Сервисе 1. Предыдущие версии API сохранены: /api/v1 — ЛР1, /api/v2 — ЛР2–3, /api/v3 — ЛР4. Код новых частей отмечен комментариями «ЛР5».

## Ход выполнения

### 1. Расширение моделей Request и Response

В src/routes/v4/feedback/model.ts создана схема BonusModelRequest, которая повторно использует поля FeedbackModelRequest из ЛР2–3. Добавлены обязательные поля position, salary, bonus и workDays. Типы TypeScript получены из схем Elysia, поэтому HTTP-валидация и типы используют единое описание.

Дополнительно введён необязательный year: он позволяет воспроизводить расчёт для заданного года. При его отсутствии используется текущий год сервера. Поле systemTime из входящего сообщения на расчётный год не влияет.

```typescript
export const BonusModelRequest = t.Object({
    ...FeedbackModelRequest.properties,
    /** Должность сотрудника. */
    position: t.Enum(Positions, { description: 'Должность сотрудника' }),
    /** Зарплата сотрудника. */
    salary: t.Number({ minimum: 0, description: 'Зарплата сотрудника' }),
    /** Множитель премии, например 2 означает два оклада. */
    bonus: t.Number({ minimum: 0, description: 'Множитель премии' }),
    /** Количество отработанных дней за год. */
    workDays: t.Integer({ minimum: 1, maximum: 366 }),
    /** Расчётный год; по умолчанию текущий год сервера. */
    year: t.Optional(t.Integer({ minimum: 1, maximum: 9999 })),
})
```

Схема успешного ответа расширена полями annualBonus и quarterlyBonus. Для неуправленческой должности quarterlyBonus равен null, что означает отсутствие права на квартальную премию. При ошибке используется исходная схема ответа с code, errorCode и errorMessage, без сумм премий.

Каждое поле исходных моделей в src/routes/v2/feedback/model.ts снабжено комментарием и description для OpenAPI: uid — идентификатор сообщения, operationUid — операции, systemName — система отправителя, systemTime — время сообщения, source — ресурс, communicationId — коммуникация, templateId — шаблон, productCode — продукт, smsCode — SMS-код. Поля ответа описывают идентификаторы запроса, время формирования ответа, результат обработки и ошибку. Описания наследуются расширенными схемами ЛР5.

### 2. Перечисление должностей

В src/routes/v4/feedback/enums.ts реализован строковый enum Positions. В TypeScript строковый enum не хранит дополнительные поля как Java enum, поэтому коэффициенты и признак isManager вынесены в типизированный объект POSITION_DETAILS.

| Должность | Описание | positionCoefficient | isManager |
| --- | --- | --- | --- |
| DEV | Разработчик | 2.2 | false |
| HR | Специалист по персоналу | 1.2 | false |
| TL | Руководитель команды | 2.6 | true |
| PO | Владелец продукта | 2.8 | true |
| TPM | Технический продакт-менеджер | 3.0 | true |
| CTO | Технический директор | 3.5 | true |

Коэффициенты DEV, HR и TL взяты из рисунка 1 задания. Коэффициенты дополнительных должностей в методичке не заданы: для этой работы приняты PO = 2.8, TPM = 3.0 и CTO = 3.5. Это решение отмечено комментарием в исходном коде.

### 3. Годовая премия и високосный год

В src/routes/v4/feedback/bonus.ts создан интерфейс AnnualBonusService и класс AnnualBonusServiceImpl. Метод calculate принимает position, salary, bonus, workDays и необязательный year. Формула сохранена точно по рисунку 2 методических материалов:

```text
annualBonus = salary × bonus × daysInYear × positionCoefficient / workDays
```

salary — зарплата, bonus — множитель премии, workDays — количество отработанных дней за расчётный год. Результат возвращается числом без округления, как в Java-примере. Перед вычислением проверяются известная должность, конечные неотрицательные salary и bonus, целое число workDays от 1 до количества дней в выбранном году. Переполнение числового результата также отклоняется.

Количество дней определяется методом DateTimeUtil.getDaysInYear из src/util/DateTimeUtil.ts:

```typescript
static getDaysInYear(year = new Date().getFullYear()): number {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
        throw new RangeError('Год должен быть целым числом от 1 до 9999')
    }
    return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0) ? 366 : 365
}
```

Правило учитывает вековые годы: 1900 и 2100 — невисокосные, 2000 и 2400 — високосные. Поэтому ограничение workDays также зависит от конкретного года: 366 дней допустимы для 2024 года, но недопустимы для 2023 года.

Для HR, salary = 100000, bonus = 2, workDays = 243 и year = 2023 получен результат 360493.8271604938 — как в unit-тесте методички. При year = 2024 результат равен 361481.48148148146.

### 4. Квартальная премия

Созданы интерфейс QuarterlyBonusService и реализация QuarterlyBonusServiceImpl. Сервис получает AnnualBonusService через конструктор и использует его для расчёта.

В задании формула квартальной премии не определена. В данной работе принято равномерное распределение годовой премии на четыре квартала:

```text
quarterlyBonus = annualBonus / 4
```

Перед расчётом метод проверяет POSITION_DETAILS[position].isManager. Для DEV и HR прямой вызов метода выбрасывает UnsupportedCodeException. Для TL, PO, TPM и CTO расчёт разрешён. При обработке feedback прикладной сервис не вызывает квартальный расчёт для неуправленческой должности, а возвращает quarterlyBonus = null и успешно рассчитанную годовую премию.

```typescript
calculate(position: Positions, salary: number, bonus: number,
          workDays: number, year?: number): number {
    const details = POSITION_DETAILS[position]
    if (!details) throw new ValidationFailedException('Неизвестная должность')
    if (!details.isManager) {
        throw new UnsupportedCodeException('Квартальная премия доступна только руководителям')
    }
    return this.annualBonusService.calculate(position, salary, bonus, workDays, year) / 4
}
```

Для TL с окладом 100000, множителем 2 и 243 днями в 2023 году годовая премия составляет 781069.9588477366, квартальная — 195267.48971193415.

### 5. Рефакторинг контроллера и сохранение ЛР4

Новый контроллер src/routes/v4/feedback/index.ts регистрирует HTTP-маршрут, схемы и обработчик ошибки, после чего делегирует обработку методу BonusFeedbackService.handle. Бизнес-расчётов в контроллере нет.

```typescript
.post('', ({ body, request }) => service.handle(body, receivedAt.get(request)!), {
    body: BonusModelRequest,
    response: {
        200: BonusModelResponse,
        400: FeedbackModelResponse,
        500: FeedbackModelResponse,
    },
    error({ code, error, body, set }) {
        const result = service.responses.createError(error, body,
            code === 'VALIDATION'
                ? error.all.map(issue => `${issue.path}: ${issue.message}`)
                : undefined)
        set.status = result.status
        return result.body
    },
})
```

BonusFeedbackService выполняет расчёты и организует пересылку. Корректный запрос передаётся во второй сервис через ForwardRequestService из ЛР4; systemName меняется на ERP, source — на Service 1. Второй сервис принимает известные ему поля feedback и сохраняет логирование времени передачи. Входное время фиксируется в onRequest до чтения JSON.

В src/routes/v2/feedback/response-service.ts создан общий FeedbackResponseService. Он формирует успешный ответ и преобразует исключения и ошибки валидации в прежний контракт. Этот сервис используется также в контроллере ЛР2–4, из которого удалён большой блок формирования ответов и обработки исключений.

Ошибочные расчётные данные возвращают HTTP 400 до сетевой пересылки. Правило uid = 123 и UnsupportedCodeException сохранено. При ошибке связи со вторым сервисом, его HTTP-ошибке или таймауте возвращается HTTP 500 с UnknownException; успешные суммы премий клиенту не выдаются.

### 6. Unit-тестирование

Вместо JUnit 5 используется встроенный тестовый модуль bun:test. Тесты находятся в tests/lab5-bonus.test.ts и не требуют HTTP-сервера. Используются describe, test, test.each, expect, toBe, toBeCloseTo и toThrow. Дробные результаты сравниваются с допуском, чтобы учитывать представление чисел с плавающей точкой. [Документация Bun](https://bun.sh/docs/test/writing-tests).

Unit-тест примера годовой премии:

```typescript
test('пример из методички: HR, оклад 100000, множитель 2, 243 дня', () => {
    // given / when / then
    const service = new AnnualBonusServiceImpl()
    const result = service.calculate(Positions.HR, 100000, 2, 243, 2023)
    expect(result).toBeCloseTo(360493.8271604938, 8)
})
```

Примеры квартального расчёта и проверки ограничения:

```typescript
test('квартальная премия руководителю TL', () => {
    const service = new QuarterlyBonusServiceImpl()
    const result = service.calculate(Positions.TL, 100000, 2, 243, 2023)
    expect(result).toBeCloseTo(195267.48971193415, 8)
})

test('для HR квартальный расчёт запрещён', () => {
    const service = new QuarterlyBonusServiceImpl()
    expect(() => service.calculate(Positions.HR, 100000, 2, 243, 2023))
        .toThrow(UnsupportedCodeException)
})
```

Реализованы 40 unit-тестов: календарные правила, пример из задания, коэффициенты всех должностей, нулевые оклад и множитель, високосный год, недопустимые и дробные дни, отрицательные и нечисловые значения, переполнение, неизвестная должность и право на квартальный расчёт.

Команда запуска только unit-тестов:

```sh
bun test tests/lab5-bonus.test.ts
```

### 7. Проверка API и запуск

Запуск Сервиса 2 в первом терминале: bun run dev:service2. Запуск Сервиса 1 во втором: bun run dev. В Windows PowerShell при запрете bun.ps1 используется bun.cmd вместо bun. Порты остаются 8084 и 8082 соответственно.

Пример POST http://localhost:8082/api/v4/feedback с Content-Type: application/json:

```json
{
  "uid": "message-5",
  "operationUid": "operation-5",
  "systemName": "CRM",
  "systemTime": "2026-10-28T12:00:00.000Z",
  "source": "Postman",
  "communicationId": 100,
  "position": "HR",
  "salary": 100000,
  "bonus": 2,
  "workDays": 243,
  "year": 2023
}
```

Клиент получает HTTP 200 с исходными uid и operationUid, текущим systemTime сервера, code = success, пустыми errorCode и errorMessage, annualBonus = 360493.8271604938 и quarterlyBonus = null.

Созданы 22 HTTP-теста в tests/lab5-api.test.ts. Они проверяют заполнение премий, все управленческие должности, високосный и текущий год, обязательность новых полей, валидацию и обработку ошибок. Тесты поднимают два настоящих HTTP-сервиса на свободных портах и проверяют сохранение пересылки ЛР4.

Результат проверки 28.10.2026: всего 78 тестов по ЛР4–5 выполнены успешно, 158 проверок expect. Проверка типов bun run typecheck завершилась без ошибок.

Подготовлена коллекция postman/lab5.postman_collection.json: 14 запросов и 100 проверок ответа. После запуска обеих точек входа на портах 8082 и 8084 программным HTTP-клиентом выполнены запросы новой и двух предыдущих коллекций с их скриптами проверок. Успешно выполнены 28 запросов и 164 проверки. Проверены OpenAPI JSON обоих сервисов. Скриншоты Postman не использовались.

## Ответы на вопросы

Приведены ответы на все шесть вопросов, включая чётные и нечётные.

### 1. Что такое unit-тестирование?

Это проверка отдельной небольшой единицы программы, например метода или класса, изолированно от внешних систем. В данной работе unit-тесты вызывают сервисы расчёта премий напрямую, не запускают HTTP-сервисы и сравнивают результат с известным ожидаемым значением либо проверяют исключение.

### 2. Что такое smoke-тестирование?

Это быстрая проверка основных функций приложения после сборки или изменения. Она позволяет убедиться, что приложение запускается и основные сценарии доступны, прежде чем выполнять более подробные проверки. В этой работе примером служит запуск двух сервисов, проверка OpenAPI и корректного запроса feedback.

### 3. Что такое интеграционное тестирование?

Это проверка совместной работы нескольких компонентов: например HTTP-маршрута, валидации, сервиса расчёта и сетевого клиента. В tests/lab5-api.test.ts запрос проходит через настоящий HTTP-сервер, расчёты, пересылку во второе приложение и формирование JSON-ответа.

### 4. Какие библиотеки используются в Spring Boot для unit-тестирования?

В Spring Boot 2.x обычно подключают spring-boot-starter-test. Он предоставляет JUnit Jupiter для тестов, AssertJ и Hamcrest для проверок, Mockito для создания подмен зависимостей и средства Spring Test для тестирования Spring-компонентов. В данном TypeScript-проекте используется bun:test. [Документация Spring Boot 2.7](https://docs.spring.io/spring-boot/docs/2.7.18/reference/html/features.html#features.testing).

### 5. Что такое Assert? Какие бывают Assert?

Assertion — проверяемое утверждение об ожидаемом результате. Нарушение утверждения делает тест неуспешным. В JUnit 5 используются assertEquals и assertNotEquals для сравнения, assertTrue и assertFalse для условий, assertNull и assertNotNull для null, assertSame для идентичности объектов, assertArrayEquals для массивов, assertThrows для исключений и assertAll для группы проверок. В bun:test аналогичные проверки записываются через expect(...).toBe(...), toEqual(...), toBeCloseTo(...) и toThrow(...). [Утверждения JUnit 5](https://docs.junit.org/5.10.2/user-guide/#writing-tests-assertions).

### 6. Какие аннотации наиболее распространены при использовании JUnit 5?

@Test отмечает тест; @BeforeEach и @AfterEach выполняют подготовку и очистку для каждого теста; @BeforeAll и @AfterAll — для набора тестов. @ParameterizedTest задаёт тест с несколькими наборами данных, @ValueSource и @CsvSource передают эти данные. Также используются @DisplayName, @Nested, @Disabled и @Tag. В bun:test вместо аннотаций применяются функции test, beforeEach, afterEach, beforeAll, afterAll, describe и test.each. [Аннотации JUnit 5](https://docs.junit.org/5.10.2/user-guide/#writing-tests-annotations).

## Репозиторий

Исходный код: https://github.com/rssXX/programming-3-semester

Файлы ЛР5: src/routes/v4/feedback/enums.ts, model.ts, bonus.ts, service.ts и index.ts; tests/lab5-bonus.test.ts; tests/lab5-api.test.ts; postman/lab5.postman_collection.json. Общий сервис ответов — src/routes/v2/feedback/response-service.ts, календарная функция — src/util/DateTimeUtil.ts.

## Вывод

Расширены модели запроса и ответа, реализованы годовая премия по формуле задания и квартальная премия для руководителей. Добавлены новые должности и корректный учёт високосного года. Расчёты покрыты unit-тестами, HTTP-сценарии — интеграционными тестами. Контроллер сокращён за счёт выделения прикладного сервиса и общего формирования ответов. Сохранены взаимодействие двух сервисов и маршруты предыдущих лабораторных работ.
