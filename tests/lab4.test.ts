import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createConsola } from 'consola'
import { Elysia } from 'elysia'
import { createApp } from '../src/app'
import { createService2App } from '../src/service2-app'
import { RECEIVED_AT_HEADER } from '../src/routes/v3/feedback/service'

const firstLogs: string[] = []
const secondLogs: string[] = []
const firstLogger = createConsola({ reporters: [{ log: entry => { firstLogs.push(entry.args.join(' ')) } }] })
const secondLogger = createConsola({ reporters: [{ log: entry => { secondLogs.push(entry.args.join(' ')) } }] })
const requestBody = {
    uid: 'message-4',
    operationUid: 'operation-4',
    systemName: 'CRM',
    systemTime: '2026-10-28T12:00:00.000Z',
    source: 'Postman',
    communicationId: 100,
    templateId: 8,
    productCode: 1500,
    smsCode: 10,
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
})

describe('ЛР4: взаимодействие двух HTTP-сервисов', () => {
    let first: ReturnType<typeof createApp>
    let second: ReturnType<typeof createService2App>
    let firstUrl: string
    let secondUrl: string

    beforeAll(() => {
        second = createService2App(secondLogger).listen({ port: 0, hostname: '127.0.0.1' })
        secondUrl = `http://127.0.0.1:${second.server!.port}/api/v3/feedback`
        first = createApp({ service2Url: secondUrl, logger: firstLogger }).listen({ port: 0, hostname: '127.0.0.1' })
        firstUrl = `http://127.0.0.1:${first.server!.port}`
    })

    beforeEach(() => {
        firstLogs.length = 0
        secondLogs.length = 0
    })

    afterAll(async () => {
        await first?.stop()
        await second?.stop()
    })

    const receivedRequests = () => secondLogs
        .filter(line => line.startsWith('request: '))
        .map(line => JSON.parse(line.slice('request: '.length)))

    test('пересылает запрос ровно один раз, меняет systemName/source и сохраняет остальные поля', async () => {
        const response = await post(`${firstUrl}/api/v3/feedback`, requestBody)

        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
            uid: requestBody.uid,
            operationUid: requestBody.operationUid,
            code: 'success',
            errorCode: '',
            errorMessage: '',
        })
        expect(receivedRequests()).toEqual([{ ...requestBody, systemName: 'ERP', source: 'Service 1' }])
        expect(firstLogs).toContain(`request: ${JSON.stringify(requestBody)}`)
        expect(secondLogs.some(line => /^Transfer time \(uid=message-4, operationUid=operation-4\): \d+ ms$/.test(line))).toBe(true)
    })

    test('заполняет необязательные systemName и source перед пересылкой', async () => {
        const { systemName, source, ...body } = requestBody
        const response = await post(`${firstUrl}/api/v3/feedback`, body)

        expect(response.status).toBe(200)
        expect(receivedRequests()).toEqual([{ ...body, systemName: 'ERP', source: 'Service 1' }])
    })

    test.each([
        ['пустой uid', { ...requestBody, uid: '' }, 'ValidationException'],
        ['неверный communicationId', { ...requestBody, communicationId: 0 }, 'ValidationException'],
        ['неверный Systems', { ...requestBody, systemName: 'UNKNOWN' }, 'ValidationException'],
        ['неподдерживаемый uid', { ...requestBody, uid: '123' }, 'UnsupportedCodeException'],
    ])('%s: возвращает 400 и не пересылает запрос', async (_name, body, errorCode) => {
        const response = await post(`${firstUrl}/api/v3/feedback`, body)

        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code: 'failed', errorCode })
        expect(receivedRequests()).toHaveLength(0)
    })

    test('Сервис 2 сохраняет валидацию ЛР3', async () => {
        const response = await post(secondUrl, { ...requestBody, communicationId: 100001 })
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code: 'failed', errorCode: 'ValidationException' })
    })

    test('Сервис 2 измеряет время от переданной метки, а не от systemTime в JSON', async () => {
        const response = await post(secondUrl, requestBody, { [RECEIVED_AT_HEADER]: String(Date.now() - 1000) })
        expect(response.status).toBe(200)

        const log = secondLogs.find(line => line.startsWith('Transfer time ('))!
        const elapsed = Number(log.match(/: (\d+) ms$/)?.[1])
        expect(elapsed).toBeGreaterThanOrEqual(1000)
        expect(elapsed).toBeLessThan(5000)
    })

    test.each([undefined, 'invalid', String(Date.now() + 600000)])('прямой запрос с меткой %s не ломает Сервис 2', async timestamp => {
        const response = await post(secondUrl, requestBody, timestamp ? { [RECEIVED_AT_HEADER]: timestamp } : {})
        expect(response.status).toBe(200)
        expect(secondLogs).toContain('Transfer time unavailable: no valid Service 1 timestamp')
    })

    test('параллельные запросы сохраняют собственные uid и метки времени', async () => {
        const bodies = Array.from({ length: 5 }, (_, index) => ({ ...requestBody, uid: `parallel-${index}` }))
        const responses = await Promise.all(bodies.map(body => post(`${firstUrl}/api/v3/feedback`, body)))

        expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200, 200])
        expect(receivedRequests().map(body => body.uid).sort()).toEqual(bodies.map(body => body.uid).sort())
        for (const body of bodies) {
            expect(secondLogs.some(line => line.startsWith(`Transfer time (uid=${body.uid},`))).toBe(true)
        }
    })

    test('маршруты ЛР1–3 работают без пересылки в Сервис 2', async () => {
        const hello = await fetch(`${firstUrl}/api/v1/hello?name=Sergey`)
        expect(await hello.text()).toBe('Hello Sergey!')

        const response = await post(`${firstUrl}/api/v2/feedback`, requestBody)
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ uid: requestBody.uid, code: 'success' })
        expect(receivedRequests()).toHaveLength(0)
    })
})

describe('ЛР4: ошибки передачи', () => {
    const localRequest = () => new Request('http://localhost/api/v3/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
    })

    test('недоступный Сервис 2 приводит к структурированной ошибке 500', async () => {
        const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
        const targetUrl = `http://127.0.0.1:${server.port}/api/v3/feedback`
        await server.stop(true)

        const app = createApp({ service2Url: targetUrl, logger: firstLogger })
        const response = await app.handle(localRequest())
        expect(response.status).toBe(500)
        expect(await response.json()).toMatchObject({ uid: requestBody.uid, code: 'failed', errorCode: 'UnknownException' })
    })

    test('HTTP-ошибка Сервиса 2 не превращается в успешный ответ Сервиса 1', async () => {
        const receiver = new Elysia().post('/feedback', ({ status }) => status(503, 'Unavailable'))
            .listen({ port: 0, hostname: '127.0.0.1' })
        try {
            const app = createApp({ service2Url: `http://127.0.0.1:${receiver.server!.port}/feedback`, logger: firstLogger })
            const response = await app.handle(localRequest())
            expect(response.status).toBe(500)
            expect(await response.json()).toMatchObject({ code: 'failed', errorCode: 'UnknownException' })
        } finally {
            await receiver.stop()
        }
    })

    test('ожидание Сервиса 2 ограничено таймаутом', async () => {
        const receiver = Bun.serve({
            port: 0,
            hostname: '127.0.0.1',
            fetch: () => new Promise<Response>(resolve => setTimeout(() => resolve(new Response('{}')), 200)),
        })
        try {
            const app = createApp({ service2Url: `http://127.0.0.1:${receiver.port}/feedback`, logger: firstLogger, timeoutMs: 20 })
            const response = await app.handle(localRequest())
            expect(response.status).toBe(500)
            expect(await response.json()).toMatchObject({ code: 'failed', errorCode: 'UnknownException' })
        } finally {
            await receiver.stop(true)
        }
    })
})
