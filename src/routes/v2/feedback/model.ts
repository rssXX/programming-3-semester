import { t } from 'elysia'
import { Codes, ErrorCodes, ErrorMessages, Systems } from './enums'

export const FeedbackModelRequest = t.Object({
    uid: t.String({ maxLength: 32, pattern: '\\S' }),
    operationUid: t.String({ maxLength: 32 }),
    systemName: t.Optional(t.Enum(Systems)),
    systemTime: t.String(),
    source: t.Optional(t.String()),
    communicationId: t.Integer({ minimum: 1, maximum: 100000 }),
    templateId: t.Optional(t.Integer()),
    productCode: t.Optional(t.Integer()),
    smsCode: t.Optional(t.Integer()),
})

export class FeedbackRequest {
    constructor(private readonly data: typeof FeedbackModelRequest.static) {}

    toString(): string {
        return JSON.stringify(this.data)
    }
}

export const FeedbackModelResponse = t.Object({
    uid: t.String(),
    operationUid: t.String(),
    systemTime: t.String(),
    code: t.Enum(Codes),
    errorCode: t.Enum(ErrorCodes),
    errorMessage: t.Enum(ErrorMessages),
})
