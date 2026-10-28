import { Elysia } from 'elysia'
import { consola } from 'consola'
import { Codes, ErrorCodes, ErrorMessages } from './enums'
import { DateTimeUtil } from '../../../util/DateTimeUtil'

import { FeedbackModelRequest, FeedbackModelResponse, FeedbackRequest } from './model'
import { ModifySystemTimeResponseService, RequestValidationService } from './service'
import type { ModifyResponseService } from './service'
import { UnsupportedCodeException, ValidationFailedException } from './exception'

const validationService = new RequestValidationService()
const modifyResponseService: ModifyResponseService = new ModifySystemTimeResponseService()

export const feedback = new Elysia({ prefix: '/feedback' })
    .decorate('logger', consola)
	.post(
		'',
		({ body, logger }) => {
            logger.info(`request: ${new FeedbackRequest(body).toString()}`)
			validationService.isValid([])
            if (body.uid === '123') {
                logger.error('UnsupportedCodeException: uid 123 is not supported')
                throw new UnsupportedCodeException('uid 123 не поддерживается')
            }
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
            error({ code, error, body, set, logger }) {
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
