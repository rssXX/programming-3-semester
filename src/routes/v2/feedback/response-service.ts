// ЛР5: формирование ответов и обработка ошибок вынесены из контроллера.
import { consola } from 'consola'
import { DateTimeUtil } from '../../../util/DateTimeUtil'
import { Codes, ErrorCodes, ErrorMessages } from './enums'
import { UnsupportedCodeException, ValidationFailedException } from './exception'
import type { FeedbackModelRequest, FeedbackModelResponse } from './model'
import { ModifySystemTimeResponseService, RequestValidationService } from './service'

type FeedbackResponse = typeof FeedbackModelResponse.static

export class FeedbackResponseService {
    private readonly validationService: RequestValidationService
    private readonly modifyResponseService: ModifySystemTimeResponseService

    constructor(private readonly logger = consola) {
        this.validationService = new RequestValidationService(logger)
        this.modifyResponseService = new ModifySystemTimeResponseService(logger)
    }

    createSuccess(request: typeof FeedbackModelRequest.static): FeedbackResponse {
        const response: FeedbackResponse = {
            uid: request.uid,
            operationUid: request.operationUid,
            systemTime: DateTimeUtil.getCustomFormat(new Date()),
            code: Codes.SUCCESS,
            errorCode: ErrorCodes.EMPTY,
            errorMessage: ErrorMessages.EMPTY,
        }
        this.logger.info('Response created:', JSON.stringify(response))
        return this.modifyResponseService.modify(response)
    }

    createError(error: unknown, body: unknown, validationErrors?: readonly string[]): { status: 400 | 500; body: FeedbackResponse } {
        this.logger.info('Request that caused an error:', JSON.stringify(body))
        this.logger.error('Request processing error:', error instanceof Error ? error.message : error)

        if (validationErrors !== undefined) {
            try {
                this.validationService.isValid(validationErrors)
            } catch (exception) {
                error = exception
            }
        }

        const request = body as Record<string, unknown> | null | undefined
        const unsupported = error instanceof UnsupportedCodeException
        const invalid = error instanceof ValidationFailedException
        const status = unsupported || invalid ? 400 : 500
        const response: FeedbackResponse = {
            uid: typeof request?.uid === 'string' ? request.uid : '',
            operationUid: typeof request?.operationUid === 'string' ? request.operationUid : '',
            systemTime: DateTimeUtil.getCustomFormat(new Date()),
            code: Codes.FAILED,
            errorCode: unsupported ? ErrorCodes.UNSUPPORTED_EXCEPTION : invalid ? ErrorCodes.VALIDATION_EXCEPTION : ErrorCodes.UNKNOWN_EXCEPTION,
            errorMessage: unsupported ? ErrorMessages.UNSUPPORTED : invalid ? ErrorMessages.VALIDATION : ErrorMessages.UNKNOWN,
        }
        this.logger.info(`Response sent (${status}):`, JSON.stringify(response))
        return { status, body: response }
    }
}
