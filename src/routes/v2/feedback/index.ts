import { Elysia } from 'elysia'
import { consola } from 'consola'

import { FeedbackModelRequest, FeedbackModelResponse, FeedbackRequest } from './model'
import { RequestValidationService } from './service'
import { UnsupportedCodeException } from './exception'
import { FeedbackResponseService } from './response-service'

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
    const responseService = new FeedbackResponseService(logger)

    return new Elysia({ prefix: '/feedback' })
        .onRequest(({ request }) => {
            // Время фиксируется до разбора JSON и валидации, отдельно для каждого запроса.
            receivedAt.set(request, Date.now())
        })
        .post('', async ({ body, request }) => {
            logger.info(`request: ${new FeedbackRequest(body).toString()}`)
            validationService.isValid([])
            if (body.uid === '123') {
                logger.error('UnsupportedCodeException: uid 123 is not supported')
                throw new UnsupportedCodeException('uid 123 не поддерживается')
            }
            await options.processRequest?.(body, receivedAt.get(request)!, request)
            const result = responseService.createSuccess(body)
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
                const result = responseService.createError(error, body,
                    code === 'VALIDATION' ? error.all.map(issue => `${issue.path}: ${issue.message}`) : undefined)
                set.status = result.status
                return result.body
            },
        })
}

export const feedback = createFeedback()
