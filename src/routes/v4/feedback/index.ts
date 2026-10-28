// ЛР5: контроллер отвечает за HTTP-контракт, бизнес-логика находится в сервисах.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import { FeedbackModelResponse } from '../../v2/feedback/model'
import { ForwardRequestService, ModifySourceRequestService, ModifySystemNameRequestService } from '../../v3/feedback/service'
import { BonusModelRequest, BonusModelResponse } from './model'
import { BonusFeedbackService } from './service'

interface BonusFeedbackOptions {
    targetUrl: string
    logger?: typeof consola
    timeoutMs?: number
}

export const createBonusFeedback = ({ targetUrl, logger = consola.withTag('Service 1 / LR5'), timeoutMs }: BonusFeedbackOptions) => {
    const forwarding = new ForwardRequestService(targetUrl, [
        new ModifySystemNameRequestService(),
        new ModifySourceRequestService(),
    ], logger, timeoutMs)
    const service = new BonusFeedbackService(forwarding, logger)
    const receivedAt = new WeakMap<Request, number>()

    return new Elysia({ prefix: '/feedback' })
        .onRequest(({ request }) => { receivedAt.set(request, Date.now()) })
        .post('', ({ body, request }) => service.handle(body, receivedAt.get(request)!), {
            body: BonusModelRequest,
            response: { 200: BonusModelResponse, 400: FeedbackModelResponse, 500: FeedbackModelResponse },
            error({ code, error, body, set }) {
                const result = service.responses.createError(error, body,
                    code === 'VALIDATION' ? error.all.map(issue => `${issue.path}: ${issue.message}`) : undefined)
                set.status = result.status
                return result.body
            },
        })
}
