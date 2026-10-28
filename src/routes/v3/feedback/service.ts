// ЛР4: модификация запроса и его передача из Сервиса 1 в Сервис 2.
import { consola } from 'consola'
import { Systems } from '../../v2/feedback/enums'
import type { FeedbackModelRequest } from '../../v2/feedback/model'

type FeedbackRequest = typeof FeedbackModelRequest.static

export const RECEIVED_AT_HEADER = 'x-service1-received-at'

export interface ModifyRequestService {
    modify(request: FeedbackRequest): FeedbackRequest
}

export class ModifySystemNameRequestService implements ModifyRequestService {
    modify(request: FeedbackRequest): FeedbackRequest {
        // Сохраняем допустимые значения Systems из ЛР3.
        return { ...request, systemName: Systems.ERP }
    }
}

export class ModifySourceRequestService implements ModifyRequestService {
    modify(request: FeedbackRequest): FeedbackRequest {
        return { ...request, source: 'Service 1' }
    }
}

export class ForwardRequestService {
    constructor(
        private readonly targetUrl: string,
        private readonly modifiers: readonly ModifyRequestService[],
        private readonly logger: typeof consola,
        private readonly timeoutMs = 5000,
    ) {}

    async forward(request: FeedbackRequest, receivedAt: number): Promise<void> {
        const modified = this.modifiers.reduce((value, service) => service.modify(value), request)
        this.logger.info('Modified request sent to Service 2:', JSON.stringify(modified))

        const response = await fetch(this.targetUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                [RECEIVED_AT_HEADER]: String(receivedAt),
            },
            body: JSON.stringify(modified),
            signal: AbortSignal.timeout(this.timeoutMs),
        })

        // Дожидаемся ответа, чтобы не сообщать об успехе при ошибке Сервиса 2.
        await response.text()
        if (!response.ok) {
            throw new Error(`Service 2 returned HTTP ${response.status}`)
        }
    }
}
