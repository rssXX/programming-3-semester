import { t } from 'elysia'

export const FeedbackModelRequest = t.Object({
    uid: t.String({ maxLength: 32, pattern: '\\S' }),
    operationUid: t.String({ maxLength: 32 }),
    systemName: t.Optional(t.String()),
    systemTime: t.String(),
    source: t.Optional(t.String()),
    communicationId: t.Integer({ minimum: 1, maximum: 100000 }),
    templateId: t.Optional(t.Integer()),
    productCode: t.Optional(t.Integer()),
    smsCode: t.Optional(t.Integer()),
})

export const FeedbackModelResponse = t.Object({
    uid: t.String(),
    operationUid: t.String(),
    systemTime: t.String(),
    code: t.Union([t.Literal('success'), t.Literal('failed')]),
    errorCode: t.Union([
        t.Literal(''),
        t.Literal('UnsupportedCodeException'),
        t.Literal('ValidationException'),
        t.Literal('UnknownException'),
    ]),
    errorMessage: t.Union([
        t.Literal(''),
        t.Literal('Не поддерживаемая ошибка'),
        t.Literal('Ошибка валидации'),
        t.Literal('Произошла непредвиденная ошибка'),
    ]),
})
