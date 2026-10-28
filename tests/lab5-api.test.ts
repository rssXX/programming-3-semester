// ЛР5: интеграция расчётов с HTTP-контрактом и пересылкой из ЛР4.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createConsola } from 'consola'
import { createApp } from '../src/app'
import { createService2App } from '../src/service2-app'

const logs: string[] = []
const logger = createConsola({ reporters: [] })
const receiverLogger = createConsola({ reporters: [{ log: entry => { logs.push(entry.args.join(' ')) } }] })
const requestBody = {
    uid: 'message-5',
    operationUid: 'operation-5',
    systemName: 'CRM',
    systemTime: '2026-10-28T12:00:00.000Z',
    source: 'Postman',
    communicationId: 100,
    templateId: 8,
    productCode: 1500,
    smsCode: 10,
    position: 'HR',
    salary: 100000,
    bonus: 2,
    workDays: 243,
    year: 2023,
}

describe('ЛР5: POST /api/v4/feedback', () => {
    let app: ReturnType<typeof createApp>
    let receiver: ReturnType<typeof createService2App>
    let url: string

    beforeAll(() => {
        receiver = createService2App(receiverLogger).listen({ port: 0, hostname: '127.0.0.1' })
        app = createApp({ service2Url: `http://127.0.0.1:${receiver.server!.port}/api/v3/feedback`, logger })
            .listen({ port: 0, hostname: '127.0.0.1' })
        url = `http://127.0.0.1:${app.server!.port}/api/v4/feedback`
    })

    beforeEach(() => { logs.length = 0 })

    afterAll(async () => {
        await app?.stop()
        await receiver?.stop()
    })

    const post = (body: unknown) => fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })

    test('возвращает годовую премию, сохраняет пересылку и замер времени ЛР4', async () => {
        const response = await post(requestBody)
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toMatchObject({ uid: 'message-5', operationUid: 'operation-5', code: 'success', errorCode: '', errorMessage: '', quarterlyBonus: null })
        expect(body.annualBonus).toBeCloseTo(360493.8271604938, 8)
        const received = logs.filter(line => line.startsWith('request: '))
        expect(received).toHaveLength(1)
        expect(JSON.parse(received[0].slice('request: '.length))).toMatchObject({ uid: 'message-5', systemName: 'ERP', source: 'Service 1' })
        expect(logs.some(line => line.startsWith('Transfer time (uid=message-5,'))).toBe(true)
    })

    test.each([
        ['TL', 195267.48971193415],
        ['PO', 210288.06584362139],
        ['TPM', 225308.64197530865],
        ['CTO', 262860.08230452676],
    ] as const)('возвращает квартальную премию для %s', async (position, expected) => {
        const response = await post({ ...requestBody, position })
        expect(response.status).toBe(200)
        expect((await response.json()).quarterlyBonus).toBeCloseTo(expected, 8)
    })

    test('учитывает расчётный високосный год из JSON', async () => {
        const response = await post({ ...requestBody, year: 2024 })
        expect(response.status).toBe(200)
        expect((await response.json()).annualBonus).toBeCloseTo(361481.48148148146, 8)
    })

    test('использует текущий год при отсутствии year', async () => {
        const { year, ...body } = requestBody
        const currentYear = new Date().getFullYear()
        const days = (Date.UTC(currentYear + 1, 0, 1) - Date.UTC(currentYear, 0, 1)) / 86400000
        const response = await post(body)
        expect(response.status).toBe(200)
        expect((await response.json()).annualBonus).toBeCloseTo(100000 * 2 * days * 1.2 / 243, 8)
    })

    test.each(['position', 'salary', 'bonus', 'workDays'])('требует поле %s', async field => {
        const body: Record<string, unknown> = { ...requestBody }
        delete body[field]
        const response = await post(body)
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code: 'failed', errorCode: 'ValidationException' })
        expect(logs.some(line => line.startsWith('request: '))).toBe(false)
    })

    test.each([
        ['неизвестная должность', { position: 'CEO' }],
        ['отрицательный оклад', { salary: -1 }],
        ['нечисловой оклад', { salary: 'oops' }],
        ['отрицательный множитель', { bonus: -1 }],
        ['нулевое число дней', { workDays: 0 }],
        ['дробное число дней', { workDays: 1.5 }],
        ['366 дней в невисокосном году', { workDays: 366, year: 2023 }],
        ['некорректный год', { year: 0 }],
        ['ошибка унаследованного поля', { communicationId: 0 }],
    ])('%s: HTTP 400 без пересылки', async (_name, patch) => {
        const response = await post({ ...requestBody, ...patch })
        const body = await response.json()
        expect(response.status).toBe(400)
        expect(body).toMatchObject({ uid: 'message-5', code: 'failed', errorCode: 'ValidationException' })
        expect(body).not.toHaveProperty('annualBonus')
        expect(logs.some(line => line.startsWith('request: '))).toBe(false)
    })

    test('сохраняет UnsupportedCodeException для uid = 123', async () => {
        const response = await post({ ...requestBody, uid: '123' })
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ uid: '123', errorCode: 'UnsupportedCodeException' })
        expect(logs.some(line => line.startsWith('request: '))).toBe(false)
    })

    test('ошибка получателя не выдаёт успешный расчёт', async () => {
        const failingReceiver = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('Unavailable', { status: 503 }) })
        try {
            const failingApp = createApp({ service2Url: `http://127.0.0.1:${failingReceiver.port}/feedback`, logger })
            const response = await failingApp.handle(new Request('http://localhost/api/v4/feedback', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
            }))
            expect(response.status).toBe(500)
            expect(await response.json()).toMatchObject({ code: 'failed', errorCode: 'UnknownException' })
        } finally {
            await failingReceiver.stop(true)
        }
    })
})
