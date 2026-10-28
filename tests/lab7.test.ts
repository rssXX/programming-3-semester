// ЛР7: настоящие HTTP-формы, общая SQLite и мониторинг. Скриншоты не создаются.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createConsola } from 'consola'
import { basename, dirname, join, resolve } from 'node:path'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createApp } from '../src/app'
import { ApplicationDatabase } from '../src/database'
import { SqliteStudyGroupDAO } from '../src/routes/lab7/groups/dao'

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
    directory = mkdtempSync(join(tmpdir(), 'lab7-'))
    databasePath = join(directory, 'students.sqlite')
    start()
})

afterEach(async () => {
    await app.stop()
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('lab7-')) {
        throw new Error('Отказ от удаления каталога вне временной области теста')
    }
    rmSync(target, { recursive: true, force: true })
})

const get = (path: string) => fetch(`${baseUrl}${path}`, { redirect: 'manual' })
const post = (path: string, values: Record<string, string>) => fetch(`${baseUrl}${path}`, {
    method: 'POST', body: new URLSearchParams(values), redirect: 'manual',
})

const resources = [
    {
        label: 'студенты', list: '/list', add: '/addStudentForm', save: '/saveStudent', edit: '/showUpdateForm', remove: '/deleteStudent', idField: 'studentId',
        create: { name: 'Иван', surname: 'Иванов', faculty: 'ИТ', age: '25' },
        update: { name: 'Анна', surname: 'Петрова', faculty: 'РТФ', age: '21' },
        invalid: [{ name: '   ' }, { name: 'И'.repeat(16) }, { surname: 'И'.repeat(26) }, { faculty: 'И'.repeat(21) }, { age: '' }, { age: '-1' }, { age: '20.5' }, { age: '151' }, { age: 'NaN' }],
    },
    {
        label: 'учебные группы', list: '/groups', add: '/addGroupForm', save: '/saveGroup', edit: '/showGroupUpdateForm', remove: '/deleteGroup', idField: 'groupId',
        create: { name: 'РИЗ-250213у', faculty: 'ИРИТ-РТФ', course: '2' },
        update: { name: 'РИЗ-250214у', faculty: 'ИТ', course: '3' },
        invalid: [{ name: '   ' }, { name: 'И'.repeat(31) }, { faculty: 'И'.repeat(21) }, { course: '' }, { course: '0' }, { course: '7' }, { course: '1.5' }, { course: 'NaN' }],
    },
] as const

for (const resource of resources) describe(`ЛР7: ${resource.label}`, () => {
    test('две HTML-формы и полный CRUD через application/x-www-form-urlencoded', async () => {
        const empty = await get(resource.list)
        expect(empty.headers.get('content-type')).toContain('text/html')
        expect(await empty.text()).toContain('пока нет')
        const addPage = await (await get(resource.add)).text()
        expect(addPage).toContain(`action="${resource.save}" method="post"`)
        expect(addPage).toContain('name="id" value=""')

        const saved = await post(resource.save, resource.create)
        expect(saved.status).toBe(303)
        expect(saved.headers.get('location')).toBe(`${resource.list}?status=saved`)
        const list = await (await get(saved.headers.get('location')!)).text()
        expect(list).toContain(resource.create.name)
        expect(list).toContain('Изменения сохранены')
        const match = list.match(new RegExp(`${resource.idField}=(\\d+)`))
        expect(match).not.toBeNull()
        const id = match![1]

        const edit = await get(`${resource.edit}?${resource.idField}=${id}`)
        expect(edit.status).toBe(200)
        const editHtml = await edit.text()
        expect(editHtml).toContain(`name="id" value="${id}"`)
        expect(editHtml).toContain(`value="${resource.create.name}"`)
        expect((await post(resource.save, { ...resource.update, id })).status).toBe(303)
        const updated = await (await get(resource.list)).text()
        expect(updated).toContain(resource.update.name)
        expect(updated).not.toContain(resource.create.name)

        // GET не должен удалять записи, в том числе при открытии ссылки поисковиком.
        expect((await get(`${resource.remove}?${resource.idField}=${id}`)).status).toBe(404)
        expect((await get(`${resource.edit}?${resource.idField}=${id}`)).status).toBe(200)
        const deleted = await post(resource.remove, { [resource.idField]: id })
        expect(deleted.status).toBe(303)
        expect(deleted.headers.get('location')).toBe(`${resource.list}?status=deleted`)
        expect((await get(`${resource.edit}?${resource.idField}=${id}`)).status).toBe(404)
        expect(await (await get(resource.list)).text()).toContain('пока нет')
    })

    test('невалидная форма сохраняет поля и не изменяет БД', async () => {
        for (const invalid of resource.invalid) {
            const response = await post(resource.save, { ...resource.create, ...invalid })
            expect(response.status).toBe(400)
            const content = await response.text()
            expect(content).toContain('Проверьте введённые данные')
            expect(content).toContain('aria-invalid="true"')
            expect(content).toContain(`value="${'faculty' in invalid ? invalid.faculty : resource.create.faculty}"`)
        }
        expect((await post(resource.save, { ...resource.create, id: '0' })).status).toBe(400)
        expect(await (await get(resource.list)).text()).toContain('пока нет')
    })

    test('ошибочные id дают 400, отсутствующая запись даёт 404 без создания', async () => {
        for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
            expect((await get(`${resource.edit}?${resource.idField}=${id}`)).status).toBe(400)
            expect((await post(resource.remove, { [resource.idField]: id })).status).toBe(400)
        }
        expect((await get(resource.edit)).status).toBe(400)
        expect((await get(`${resource.edit}?${resource.idField}=999`)).status).toBe(404)
        expect((await post(resource.save, { ...resource.create, id: '999' })).status).toBe(404)
        expect((await post(resource.remove, { [resource.idField]: '999' })).status).toBe(404)
        expect(await (await get(resource.list)).text()).toContain('пока нет')
    })

    test('экранирует HTML в таблице, форме редактирования и ошибочной форме', async () => {
        const name = '<script>x</script>'
        const field = resource.idField === 'studentId' ? 'surname' : 'name'
        expect((await post(resource.save, { ...resource.create, [field]: name })).status).toBe(303)
        for (const path of [resource.list, `${resource.edit}?${resource.idField}=1`]) {
            const content = await (await get(path)).text()
            expect(content).toContain('&lt;script&gt;x&lt;/script&gt;')
            expect(content).not.toContain(name)
        }
        const response = await post(resource.save, { ...resource.create, [field]: name, faculty: '' })
        expect(response.status).toBe(400)
        expect(await response.text()).not.toContain(name)
    })

    test('данные остаются после перезапуска приложения', async () => {
        await post(resource.save, resource.create)
        await app.stop()
        start()
        expect(await (await get(resource.list)).text()).toContain(resource.create.name)
    })
})

test('ЛР7: формы студентов и API ЛР6 читают и изменяют одну таблицу', async () => {
    await post('/saveStudent', resources[0].create)
    const list = await (await get('/api/v5/students')).json()
    expect(list.data).toEqual([{ ...resources[0].create, id: 1, age: 25 }])
    const response = await fetch(`${baseUrl}/api/v5/students`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...resources[0].update, id: 1, age: 21 }),
    })
    expect(response.status).toBe(200)
    expect(await (await get('/list')).text()).toContain('Петрова')
})

test('ЛР7: добавляет таблицу групп в существующую БД ЛР6 без потери данных', async () => {
    await app.stop()
    const legacy = new Database(databasePath, { create: true })
    legacy.exec("CREATE TABLE students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, surname TEXT, faculty TEXT, age INTEGER); INSERT INTO students (name, surname, faculty, age) VALUES ('Иван', 'Иванов', 'ИТ', 25);")
    legacy.close()
    start()
    expect((await (await get('/api/v5/students')).json()).data).toHaveLength(1)
    expect((await post('/saveGroup', resources[1].create)).status).toBe(303)
    expect(await (await get('/groups')).text()).toContain('РИЗ-250213у')
    expect((await (await get('/api/v5/students')).json()).data[0].surname).toBe('Иванов')
})

test('ЛР7: ограничения групп работают в БД, seed повторяем и SQL передаётся параметрами', () => {
    const connection = new ApplicationDatabase(':memory:')
    try {
        const dao = new SqliteStudyGroupDAO(connection)
        connection.seed()
        connection.seed()
        expect(dao.findAll()).toHaveLength(1)
        expect(() => dao.create({ name: 'x', faculty: 'ИТ', course: 7 })).toThrow()
        expect(() => dao.create({ name: ' ', faculty: 'ИТ', course: 2 })).toThrow()
        const name = "X'); DROP TABLE students;--"
        expect(dao.create({ name, faculty: 'ИТ', course: 2 }).name).toBe(name)
        expect(connection.database.query('SELECT * FROM students').all()).toHaveLength(2)
    } finally { connection.close() }
})

test('ЛР7: аналог Actuator возвращает состояние БД, информацию и реальные метрики', async () => {
    expect((await (await get('/actuator')).json())._links.health.href).toBe('/actuator/health')
    expect(await (await get('/actuator/health')).json()).toMatchObject({ status: 'UP', components: { database: { status: 'UP' } } })
    expect(await (await get('/actuator/info')).json()).toMatchObject({ application: { laboratory: 7 }, runtime: { bun: Bun.version } })
    expect((await (await get('/actuator/metrics')).json()).names).toEqual(['process.uptime', 'process.memory.usage'])
    for (const name of ['process.uptime', 'process.memory.usage']) {
        const metric = await (await get(`/actuator/metrics/${name}`)).json()
        expect(metric.name).toBe(name)
        expect(metric.measurements[0].value).toBeGreaterThan(0)
    }
    for (const name of ['unknown', 'toString', '__proto__']) {
        expect((await get(`/actuator/metrics/${name}`)).status).toBe(404)
    }
})

test('ЛР7: недоступная БД даёт HTML 500 и health 503 без раскрытия пути', async () => {
    await app.stop()
    databasePath = join(directory, 'not-a-database')
    mkdirSync(databasePath)
    start()
    for (const path of ['/list', '/groups']) {
        const response = await get(path)
        expect(response.status).toBe(500)
        expect(response.headers.get('content-type')).toContain('text/html')
        expect(await response.text()).not.toContain(directory)
    }
    const health = await get('/actuator/health')
    expect(health.status).toBe(503)
    expect(await health.json()).toEqual({ status: 'DOWN', components: { database: { status: 'DOWN' } } })
    expect((await get('/actuator/info')).status).toBe(200)
    expect((await get('/api/v1/hello')).status).toBe(200)
})

test('ЛР7: корень ведёт к списку, стили локальны, маршруты присутствуют в OpenAPI', async () => {
    expect((await get('/')).headers.get('location')).toBe('/list')
    const css = await get('/lab7/styles.css')
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toContain('text/css')
    const paths = (await (await get('/openapi/json')).json()).paths
    for (const path of ['/list', '/groups', '/saveStudent', '/saveGroup', '/actuator/health', '/api/v5/students']) {
        expect(paths[path]).toBeDefined()
    }
})
