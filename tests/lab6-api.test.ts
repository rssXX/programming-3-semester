// ЛР6: HTTP-запросы и настоящая файловая SQLite, без подмены DAO.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createConsola } from 'consola'
import { createApp } from '../src/app'
import { ApplicationDatabase } from '../src/database'

const logger = createConsola({ reporters: [] })
let directory: string
let databasePath: string
let app: ReturnType<typeof createApp>
let baseUrl: string

const start = () => {
    app = createApp({ databasePath, logger }).listen({ port: 0, hostname: '127.0.0.1' })
    baseUrl = `http://127.0.0.1:${app.server!.port}`
}

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'lab6-'))
    databasePath = join(directory, 'nested', 'students.sqlite')
    start()
})

afterEach(async () => {
    await app.stop()
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('lab6-')) {
        throw new Error('Отказ от удаления каталога вне временной области теста')
    }
    rmSync(target, { recursive: true, force: true })
})

const request = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
}

const resources = [
    {
        name: 'студенты', path: '/api/v5/students',
        create: { name: 'Иван', surname: 'Иванов', faculty: 'ИТ', age: 25 },
        update: { name: 'Анна', surname: 'Петрова', faculty: 'РТФ', age: 21 },
        invalid: [
            { name: '   ', surname: 'Иванов', faculty: 'ИТ', age: 25 },
            { name: 'Иван', surname: 'Иванов', faculty: 'ИТ', age: -1 },
            { name: 'Иван', surname: 'Иванов', faculty: 'ИТ', age: 20.5 },
            { name: 'Иван', surname: 'Иванов', faculty: 'ИТ', age: 'не число' },
            { name: 'И'.repeat(16), surname: 'Иванов', faculty: 'ИТ', age: 25 },
            { name: 'Иван', surname: 'И'.repeat(26), faculty: 'ИТ', age: 25 },
            { name: 'Иван', surname: 'Иванов', faculty: 'И'.repeat(21), age: 25 },
        ],
    },
    {
        name: 'дисциплины', path: '/api/v5/disciplines',
        create: { name: 'Базы данных', hours: 108 },
        update: { name: 'Программирование', hours: 144 },
        invalid: [
            { name: '\t\n', hours: 108 },
            { name: 'Базы данных', hours: 0 },
            { name: 'Базы данных', hours: 1.5 },
            { name: 'Базы данных', hours: 'не число' },
            { name: 'Базы данных', hours: 10001 },
            { name: 'Б'.repeat(101), hours: 108 },
        ],
    },
]

for (const resource of resources) describe(`ЛР6: ${resource.name}`, () => {
    const { path } = resource

    test('полный CRUD: пустой список, создание, чтение, изменение, удаление', async () => {
        expect(await request('GET', path)).toMatchObject({ status: 200, body: { success: true, data: [] } })
        const created = await request('POST', path, resource.create)
        expect(created.status).toBe(201)
        expect(created.body).toMatchObject({ success: true, data: resource.create })
        const id = created.body.data.id
        expect(Number.isSafeInteger(id) && id > 0).toBe(true)
        expect(created.body.message.length).toBeGreaterThan(0)

        expect(await request('GET', `${path}/${id}`)).toMatchObject({ status: 200, body: { success: true, data: { ...resource.create, id } } })
        expect((await request('GET', path)).body.data).toEqual([{ ...resource.create, id }])
        expect(await request('PUT', path, { ...resource.update, id })).toMatchObject({ status: 200, body: { success: true, data: { ...resource.update, id } } })
        expect((await request('GET', `${path}/${id}`)).body.data).toEqual({ ...resource.update, id })
        expect(await request('DELETE', `${path}/${id}`)).toMatchObject({ status: 200, body: { success: true, data: { id } } })
        expect(await request('GET', `${path}/${id}`)).toMatchObject({ status: 404, body: { success: false, data: null } })
        expect((await request('GET', path)).body.data).toEqual([])
    })

    test('GET, PUT и DELETE отсутствующего id возвращают 404 без создания записи', async () => {
        for (const method of ['GET', 'PUT', 'DELETE']) {
            const result = await request(method, method === 'PUT' ? path : `${path}/987654`, method === 'PUT' ? { ...resource.update, id: 987654 } : undefined)
            expect(result).toMatchObject({ status: 404, body: { success: false, data: null } })
            expect(result.body.message).toContain('987654')
        }
        expect((await request('GET', path)).body.data).toEqual([])
    })

    test('ошибки валидации дают 400 и не записываются в БД', async () => {
        for (const body of [{}, null, ...resource.invalid]) {
            expect(await request('POST', path, body)).toMatchObject({ status: 400, body: { success: false, data: null } })
        }
        expect(await request('PUT', path, resource.update)).toMatchObject({ status: 400, body: { success: false, data: null } })
        expect((await request('GET', path)).body.data).toEqual([])
    })

    test('невалидные id отклоняются до DAO', async () => {
        for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
            for (const method of ['GET', 'DELETE']) {
                expect(await request(method, `${path}/${id}`)).toMatchObject({ status: 400, body: { success: false, data: null } })
            }
            expect(await request('PUT', path, { ...resource.update, id: Number(id) })).toMatchObject({ status: 400, body: { success: false, data: null } })
        }
    })

    test('повреждённый JSON даёт общий контракт ошибки 400', async () => {
        const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' })
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ success: false, data: null })
    })

    test('обрезает пробелы и безопасно сохраняет SQL-подобные строки', async () => {
        const name = "X'); DROP--"
        const result = await request('POST', path, { ...resource.create, name: `  ${name}  ` })
        expect(result).toMatchObject({ status: 201, body: { success: true, data: { name } } })
        expect((await request('GET', path)).body.data).toHaveLength(1)
    })

    test('данные сохраняются после остановки и повторного запуска приложения', async () => {
        const created = (await request('POST', path, resource.create)).body.data
        await app.stop()
        start()
        expect(await request('GET', `${path}/${created.id}`)).toMatchObject({ status: 200, body: { success: true, data: created } })
    })
})

test('ЛР6: студенты и дисциплины хранятся в разных таблицах одной БД', async () => {
    const student = (await request('POST', resources[0].path, resources[0].create)).body.data
    const discipline = (await request('POST', resources[1].path, resources[1].create)).body.data
    expect(student.id).toBe(1)
    expect(discipline.id).toBe(1)
    await request('DELETE', `${resources[0].path}/${student.id}`)
    expect((await request('GET', resources[1].path)).body.data).toEqual([discipline])
})

test('ЛР6: seed идемпотентен и не стирает существующие записи', async () => {
    const custom = (await request('POST', resources[0].path, { ...resources[0].create, name: 'Сергей' })).body.data
    const connection = new ApplicationDatabase(databasePath)
    try {
        connection.seed()
        connection.seed()
        expect(connection.database.query('SELECT * FROM students').all()).toHaveLength(3)
        expect(connection.database.query('SELECT * FROM disciplines').all()).toHaveLength(2)
    } finally {
        connection.close()
    }
    expect((await request('GET', `${resources[0].path}/${custom.id}`)).body.data).toEqual(custom)
})

test('ЛР6: старые API и OpenAPI не открывают файл БД', async () => {
    const hello = await fetch(`${baseUrl}/api/v1/hello?name=Sergey`)
    expect(await hello.text()).toBe('Hello Sergey!')
    const spec = await (await fetch(`${baseUrl}/openapi/json`)).json()
    expect(spec.paths['/api/v5/students'].post).toBeDefined()
    expect(spec.paths['/api/v5/disciplines'].put).toBeDefined()
    expect(spec.paths['/api/v4/feedback'].post).toBeDefined()
    expect(existsSync(databasePath)).toBe(false)
})

test('ЛР6: недоступная БД даёт 500 без утечки пути; ЛР1 продолжает работать', async () => {
    await app.stop()
    databasePath = directory // Открыть каталог как файл SQLite невозможно.
    start()
    for (const resource of resources) {
        expect(await request('GET', resource.path)).toEqual({ status: 500, body: { success: false, message: 'Ошибка работы с базой данных', data: null } })
    }
    expect(await (await fetch(`${baseUrl}/api/v1/hello?name=Sergey`)).text()).toBe('Hello Sergey!')
})
