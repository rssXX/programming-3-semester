// ЛР7: небольшой аналог Spring Boot Actuator на текущем стеке.
// Это собственные диагностические маршруты, а не реализация библиотеки Spring.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import type { ApplicationDatabase } from '../../database'

export const createMonitoring = (connection: ApplicationDatabase, logger = consola) => {
    const startedAt = new Date().toISOString()
    const metrics = {
        'process.uptime': () => ({ description: 'Время работы процесса Bun', baseUnit: 'seconds', value: process.uptime() }),
        'process.memory.usage': () => ({ description: 'Память процесса (RSS)', baseUnit: 'bytes', value: process.memoryUsage().rss }),
    }
    const detail = { tags: ['ЛР7: мониторинг (аналог Actuator)'] }
    return new Elysia({ prefix: '/actuator' })
        .get('', () => ({ _links: {
            self: { href: '/actuator' }, health: { href: '/actuator/health' },
            info: { href: '/actuator/info' }, metrics: { href: '/actuator/metrics' },
        } }), { detail })
        .get('/health', ({ set }) => {
            try {
                connection.database.query('SELECT 1').get()
                return { status: 'UP', components: { database: { status: 'UP', details: { engine: 'SQLite' } } } }
            } catch (error) {
                logger.error('LR7 health check failed:', error instanceof Error ? error.message : error)
                set.status = 503
                return { status: 'DOWN', components: { database: { status: 'DOWN' } } }
            }
        }, { detail })
        .get('/info', () => ({
            application: { name: 'programming-3-semester', laboratory: 7, stack: ['TypeScript', 'Bun', 'Elysia', 'SQLite'] },
            runtime: { bun: Bun.version }, startedAt,
        }), { detail })
        .get('/metrics', () => ({ names: Object.keys(metrics) }), { detail })
        .get('/metrics/:name', ({ params, set }) => {
            if (!Object.prototype.hasOwnProperty.call(metrics, params.name)) {
                set.status = 404
                return { message: 'Метрика не найдена' }
            }
            const { description, baseUnit, value } = metrics[params.name as keyof typeof metrics]()
            return { name: params.name, description, baseUnit, measurements: [{ statistic: 'VALUE', value }] }
        }, { detail })
}
