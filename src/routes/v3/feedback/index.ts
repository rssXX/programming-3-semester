// ЛР4: один контракт и обработчик ошибок, две разные роли сервисов.
import { consola } from 'consola'
import { createFeedback } from '../../v2/feedback'
import {
    ForwardRequestService,
    ModifySourceRequestService,
    ModifySystemNameRequestService,
    RECEIVED_AT_HEADER,
} from './service'

interface Service1Options {
    targetUrl: string
    logger?: typeof consola
    timeoutMs?: number
}

export const createService1Feedback = ({ targetUrl, logger = consola.withTag('Service 1 / LR4'), timeoutMs }: Service1Options) => {
    const forwardingService = new ForwardRequestService(targetUrl, [
        new ModifySystemNameRequestService(),
        new ModifySourceRequestService(),
    ], logger, timeoutMs)

    return createFeedback({
        logger,
        processRequest: (body, receivedAt) => forwardingService.forward(body, receivedAt),
    })
}

export const createService2Feedback = (logger = consola.withTag('Service 2 / LR4')) => createFeedback({
    logger,
    processRequest: (body, receivedAt, request) => {
        const sentAt = Number(request.headers.get(RECEIVED_AT_HEADER))
        if (Number.isSafeInteger(sentAt) && sentAt > 0 && sentAt <= receivedAt) {
            logger.info(`Transfer time (uid=${body.uid}, operationUid=${body.operationUid}): ${receivedAt - sentAt} ms`)
        } else {
            logger.info('Transfer time unavailable: no valid Service 1 timestamp')
        }
    },
})
