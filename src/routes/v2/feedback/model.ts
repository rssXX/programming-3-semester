import { t } from 'elysia'
import { Codes, ErrorCodes, ErrorMessages, Systems } from './enums'

export const FeedbackModelRequest = t.Object({
    /** Уникальный идентификатор сообщения, непустой, до 32 символов. ЛР2, комментарии — ЛР5. */
    uid: t.String({ maxLength: 32, pattern: '\\S', description: 'Уникальный идентификатор сообщения' }),
    /** Уникальный идентификатор операции, до 32 символов. */
    operationUid: t.String({ maxLength: 32, description: 'Уникальный идентификатор операции' }),
    /** Имя системы отправителя: ERP, CRM или WMS. Необязательное поле. */
    systemName: t.Optional(t.Enum(Systems, { description: 'Имя системы отправителя' })),
    /** Время создания входящего сообщения. */
    systemTime: t.String({ description: 'Время создания сообщения' }),
    /** Наименование ресурса, из которого поступило сообщение. */
    source: t.Optional(t.String({ description: 'Наименование ресурса' })),
    /** Уникальный идентификатор коммуникации, от 1 до 100000 включительно. */
    communicationId: t.Integer({ minimum: 1, maximum: 100000, description: 'Уникальный идентификатор коммуникации' }),
    /** Уникальный идентификатор шаблона. */
    templateId: t.Optional(t.Integer({ description: 'Уникальный идентификатор шаблона' })),
    /** Код продукта. */
    productCode: t.Optional(t.Integer({ description: 'Код продукта' })),
    /** Код SMS. */
    smsCode: t.Optional(t.Integer({ description: 'Код SMS' })),
})

export class FeedbackRequest {
    constructor(private readonly data: typeof FeedbackModelRequest.static) {}

    toString(): string {
        return JSON.stringify(this.data)
    }
}

export const FeedbackModelResponse = t.Object({
    /** Идентификатор сообщения из запроса. */
    uid: t.String({ description: 'Уникальный идентификатор сообщения' }),
    /** Идентификатор операции из запроса. */
    operationUid: t.String({ description: 'Уникальный идентификатор операции' }),
    /** Время формирования ответа сервером в формате ISO 8601. */
    systemTime: t.String({ description: 'Время формирования ответа' }),
    /** Результат обработки: success или failed. */
    code: t.Enum(Codes, { description: 'Результат обработки запроса' }),
    /** Код ошибки; пустая строка при успешной обработке. */
    errorCode: t.Enum(ErrorCodes, { description: 'Код ошибки' }),
    /** Сообщение об ошибке; пустая строка при успешной обработке. */
    errorMessage: t.Enum(ErrorMessages, { description: 'Сообщение об ошибке' }),
})
