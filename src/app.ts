import { Elysia } from 'elysia'
import { openapi } from '@elysia/openapi'
import { consola } from 'consola'
import { ApplicationDatabase } from './database'
import { createLab7Pages } from './routes/lab7'
import { createMonitoring } from './routes/lab7/monitoring'
import { ROUTES_V1, ROUTES_V2, createService1Feedback, createBonusFeedback, createDatabaseRoutes } from './routes'

interface AppOptions {
    service2Url?: string
    logger?: typeof consola
    timeoutMs?: number
    databasePath?: string
}

// ЛР4: Сервис 1. /api/v1 и /api/v2 сохраняют поведение предыдущих лабораторных.
export const createApp = ({
    service2Url = process.env.SERVICE2_URL ?? 'http://localhost:8084/api/v3/feedback',
    logger,
    timeoutMs,
    databasePath,
}: AppOptions = {}) => {
    const connection = new ApplicationDatabase(databasePath)
    return new Elysia()
        .onStop(() => { connection.close() })
        .use(openapi())
        .group('/api/v1', group => group.use(ROUTES_V1))
        .group('/api/v2', group => group.use(ROUTES_V2))
        .group('/api/v3', group => group.use(createService1Feedback({ targetUrl: service2Url, logger, timeoutMs })))
        // ЛР5: расширенный контракт запроса и расчёт премий; прежние версии API сохранены.
        .group('/api/v4', group => group.use(createBonusFeedback({ targetUrl: service2Url, logger, timeoutMs })))
        // ЛР6: CRUD с файловой базой SQLite. Старые версии API не требуют её открытия.
        .group('/api/v5', group => group.use(createDatabaseRoutes(connection, logger)))
        // ЛР7: HTML-формы студентов и групп, а также аналог Actuator.
        .use(createLab7Pages(connection, logger))
        .use(createMonitoring(connection, logger))
}
