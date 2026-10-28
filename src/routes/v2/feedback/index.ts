import { Elysia } from 'elysia'
import { consola } from 'consola'
import { Codes, ErrorCodes, ErrorMessages } from './enums'
import { DateTimeUtil } from '../../../util/DateTimeUtil'

import { FeedbackModelRequest, FeedbackModelResponse, FeedbackRequest } from './model'
import { ModifySystemTimeResponseService, RequestValidationService } from './service'
import type { ModifyResponseService } from './service'
import { UnsupportedCodeException, ValidationFailedException } from './exception'

// ЛР4: общий обработчик ЛР2–3 используется обоими сервисами без копирования кода.
export interface FeedbackOptions {
    logger?: typeof consola
    processRequest?: (
        body: typeof FeedbackModelRequest.static,
        receivedAt: number,
        request: Request,
    ) => void | Promise<void>
}

export const createFeedback = (options: FeedbackOptions = {}) => {
    const receivedAt = new WeakMap<Request, number>()
    const logger = options.logger ?? consola
    const validationService = new RequestValidationService(logger)
    const modifyResponseService: ModifyResponseService = new ModifySystemTimeResponseService(logger)

    return new Elysia({ prefix: '/feedback' })
    .onRequest(({ request }) => {
        // Время фиксируется до разбора JSON и валидации, отдельно для каждого запроса.
        receivedAt.set(request, Date.now())
    })
	.post(
		'',
		async ({ body, request }) => {
            logger.info(`request: ${new FeedbackRequest(body).toString()}`)
			validationService.isValid([])
            if (body.uid === '123') {
                logger.error('UnsupportedCodeException: uid 123 is not supported')
                throw new UnsupportedCodeException('uid 123 не поддерживается')
            }
            await options.processRequest?.(body, receivedAt.get(request)!, request)
			const response = {
				uid: body.uid,
				operationUid: body.operationUid,
				systemTime: DateTimeUtil.getCustomFormat(new Date()),
				code: Codes.SUCCESS,
				errorCode: ErrorCodes.EMPTY,
				errorMessage: ErrorMessages.EMPTY,
			}
            logger.info('Response created:', JSON.stringify(response))
            const result = modifyResponseService.modify(response)
            logger.info('Response sent (200):', JSON.stringify(result))
            return result
		}, {
            body: FeedbackModelRequest,
			response: {
                200: FeedbackModelResponse,
                400: FeedbackModelResponse,
                500: FeedbackModelResponse,
            },
            error({ code, error, body, set }) {
                logger.info('Request that caused an error:', JSON.stringify(body))
                logger.error('Request processing error:', error instanceof Error ? error.message : error)
                const request = body as Record<string, unknown> | null | undefined
                const response = {
                    uid: typeof request?.uid === 'string' ? request.uid : '',
                    operationUid: typeof request?.operationUid === 'string' ? request.operationUid : '',
                    systemTime: DateTimeUtil.getCustomFormat(new Date()),
                    code: Codes.FAILED,
                }

                try {
                    if (code === 'VALIDATION') {
                        validationService.isValid(error.all.map(issue => `${issue.path}: ${issue.message}`))
                    }
                    throw error
                } catch (exception) {
                    if (exception instanceof UnsupportedCodeException) {
                        set.status = 400
                        const result = {
                            ...response,
                            errorCode: ErrorCodes.UNSUPPORTED_EXCEPTION,
                            errorMessage: ErrorMessages.UNSUPPORTED,
                        }
                        logger.info('Response sent (400):', JSON.stringify(result))
                        return result
                    }

                    if (exception instanceof ValidationFailedException) {
                        set.status = 400
                        const result = {
                            ...response,
                            errorCode: ErrorCodes.VALIDATION_EXCEPTION,
                            errorMessage: ErrorMessages.VALIDATION,
                        }
                        logger.info('Response sent (400):', JSON.stringify(result))
                        return result
                    }

                    set.status = 500
                    const result = {
                        ...response,
                        errorCode: ErrorCodes.UNKNOWN_EXCEPTION,
                        errorMessage: ErrorMessages.UNKNOWN,
                    }
                    logger.info('Response sent (500):', JSON.stringify(result))
                    return result
                }
            },
		}
	)
}

export const feedback = createFeedback()
