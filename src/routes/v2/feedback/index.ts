import { Elysia } from 'elysia'

import { FeedbackModelRequest, FeedbackModelResponse } from './model'
import { RequestValidationService } from './service'
import { UnsupportedCodeException, ValidationFailedException } from './exception'

const validationService = new RequestValidationService()

export const feedback = new Elysia({ prefix: '/feedback' })
	.post(
		'',
		({ body }) => {
			validationService.isValid([])
            if (body.uid === '123') {
                throw new UnsupportedCodeException('uid 123 не поддерживается')
            }
			return {
				uid: body.uid,
				operationUid: body.operationUid,
				systemTime: new Date().toISOString(),
				code: 'success',
				errorCode: '',
				errorMessage: '',
			}
		}, {
            body: FeedbackModelRequest,
			response: {
                200: FeedbackModelResponse,
                400: FeedbackModelResponse,
                500: FeedbackModelResponse,
            },
            error({ code, error, body, set }) {
                const request = body as Record<string, unknown> | null | undefined
                const response = {
                    uid: typeof request?.uid === 'string' ? request.uid : '',
                    operationUid: typeof request?.operationUid === 'string' ? request.operationUid : '',
                    systemTime: new Date().toISOString(),
                    code: 'failed' as const,
                }

                try {
                    if (code === 'VALIDATION') {
                        validationService.isValid([error.message])
                    }
                    throw error
                } catch (exception) {
                    if (exception instanceof UnsupportedCodeException) {
                        set.status = 400
                        return {
                            ...response,
                            errorCode: 'UnsupportedCodeException' as const,
                            errorMessage: 'Не поддерживаемая ошибка' as const,
                        }
                    }

                    if (exception instanceof ValidationFailedException) {
                        set.status = 400
                        return {
                            ...response,
                            errorCode: 'ValidationException' as const,
                            errorMessage: 'Ошибка валидации' as const,
                        }
                    }

                    set.status = 500
                    return {
                        ...response,
                        errorCode: 'UnknownException' as const,
                        errorMessage: 'Произошла непредвиденная ошибка' as const,
                    }
                }
            },
		}
	)
