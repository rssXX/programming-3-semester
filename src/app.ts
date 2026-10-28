import { Elysia } from 'elysia'
import { openapi } from '@elysia/openapi'
import { consola } from 'consola'
import { ApplicationDatabase } from './database'
import { createLab7Pages } from './routes/lab7'
import { createMonitoring } from './routes/lab7/monitoring'
import { createLab8 } from './routes/lab8'
import { createCourse } from './course'
import { createCourseDatabase } from './course/database'
import { ROUTES_V1, ROUTES_V2, createService1Feedback, createBonusFeedback, createDatabaseRoutes } from './routes'

interface AppOptions {
    service2Url?: string
    logger?: typeof consola
    timeoutMs?: number
    databasePath?: string
    lab8DatabasePath?: string
    courseDatabasePath?: string
    courseLogPath?: string
}

// ЛР4: Сервис 1. /api/v1 и /api/v2 сохраняют поведение предыдущих лабораторных.
export const createApp = ({
    service2Url = process.env.SERVICE2_URL ?? 'http://localhost:8084/api/v3/feedback',
    logger,
    timeoutMs,
    databasePath,
    lab8DatabasePath = process.env.LAB8_DATABASE_PATH ?? 'testdb/lab8.sqlite',
    courseDatabasePath,
    courseLogPath,
}: AppOptions = {}) => {
    const connection = new ApplicationDatabase(databasePath)
    // ЛР8: отдельные данные защищённого этапа, прежние API работают со своей БД.
    const securityConnection = new ApplicationDatabase(lab8DatabasePath)
    const courseConnection = createCourseDatabase(courseDatabasePath)
    const filenames = [connection, securityConnection, courseConnection].map(db => db.filename).filter(filename => filename !== ':memory:')
        .map(filename => process.platform === 'win32' ? filename.toLowerCase() : filename)
    if (new Set(filenames).size !== filenames.length) {
        throw new Error('DATABASE_PATH, LAB8_DATABASE_PATH и COURSE_DATABASE_PATH должны указывать на разные файлы')
    }
    return new Elysia()
        .onStop(() => { connection.close(); securityConnection.close(); courseConnection.close() })
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
        // ЛР8: регистрация, вход, роли, CSRF и защищённые формы студентов.
        .use(createLab8(securityConnection, logger))
        // Курсовая: вариант 5, роли READ_ONLY / USER / ADMIN и журнал действий.
        .use(createCourse(courseConnection, courseLogPath, logger))
}
