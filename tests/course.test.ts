// Курсовая: роли, владение, связи, расчёты, аудит и настоящие HTTP-формы.
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createConsola } from 'consola'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createApp } from '../src/app'

const logger = createConsola({ reporters: [] })
const password = 'Course-password-2026!'
let directory: string, courseDatabasePath: string, courseLogPath: string, base: string
let app: ReturnType<typeof createApp>
const start = () => {
    app = createApp({ databasePath: join(directory, 'labs.sqlite'), lab8DatabasePath: join(directory, 'lab8.sqlite'), courseDatabasePath, courseLogPath, logger }).listen({ hostname: '127.0.0.1', port: 0 })
    base = `http://127.0.0.1:${app.server!.port}`
}
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'course-test-'))
    courseDatabasePath = join(directory, 'course.sqlite')
    courseLogPath = join(directory, 'logs', 'course.log')
    start()
})
afterEach(async () => {
    await app.stop()
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('course-test-')) throw new Error('Недопустимый временный каталог')
    rmSync(target, { recursive: true, force: true })
})

class Browser {
    cookie = ''
    csrf = ''
    async request(method: string, path: string, data: Record<string, string> = {}, csrf = true) {
        const response = await fetch(base + path, { method, redirect: 'manual', headers: this.cookie ? { cookie: this.cookie } : {}, body: method === 'POST' ? new URLSearchParams({ ...(csrf ? { _csrf: this.csrf } : {}), ...data }) : undefined })
        for (const header of response.headers.getSetCookie()) {
            const match = header.match(/^course_session=([^;]*)/)
            if (match) this.cookie = match[1] ? `course_session=${match[1]}` : ''
        }
        const text = await response.text()
        const token = text.match(/name="_csrf" value="([a-f0-9]{64})"/)
        if (token) this.csrf = token[1]
        return { status: response.status, headers: response.headers, text }
    }
    get(path: string) { return this.request('GET', path) }
    post(path: string, data: Record<string, string> = {}, csrf = true) { return this.request('POST', path, data, csrf) }
}
const db = <T>(run: (connection: Database) => T): T => {
    const connection = new Database(courseDatabasePath, { strict: true })
    connection.exec('PRAGMA foreign_keys = ON')
    try { return run(connection) } finally { connection.close() }
}
const count = (table: 'animals' | 'expenses' | 'users' | 'user_actions') => db(connection => connection.query<{ count: number }, []>(`SELECT count(*) AS count FROM ${table}`).get()!.count)
const userId = (name: string) => db(connection => connection.query<{ id: number }, [string]>('SELECT id FROM users WHERE email = ?').get(`${name}@example.test`)!.id)
const promote = (name: string, role: string) => db(connection => connection.query('INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?').run(userId(name), role))
const account = async (name: string, role = 'READ_ONLY') => {
    const browser = new Browser()
    await browser.get('/course/register')
    expect((await browser.post('/course/register', { firstName: name, lastName: 'Test', email: `${name}@example.test`, password })).status).toBe(303)
    if (role !== 'READ_ONLY') promote(name, role)
    await browser.get('/course/login')
    expect((await browser.post('/course/login', { username: `${name}@example.test`, password })).status).toBe(303)
    await browser.get('/course/expenses')
    return browser
}
const animal = async (browser: Browser, name = 'Иван Иванов', age = '5') => {
    expect((await browser.post('/course/animals/save', { name, species: 'Кошка', age })).status).toBe(303)
    return db(connection => connection.query<{ id: number }, []>('SELECT max(id) AS id FROM animals').get()!.id)
}
const expenseData = { category: 'FOOD', amount: '144', expenseDate: '2026-10-03', description: 'Корм' }
const expense = async (browser: Browser, animalId: number, description = 'Корм', amount = '144', expenseDate = '2026-10-03', category = 'FOOD') => {
    expect((await browser.post('/course/expenses/save', { description, animalId: String(animalId), amount, expenseDate, category })).status).toBe(303)
    return db(connection => connection.query<{ id: number }, []>('SELECT max(id) AS id FROM expenses').get()!.id)
}

test('Курсовая: регистрация даёт READ_ONLY, пароль хешируется, username соответствует логину', async () => {
    const browser = await account('reader')
    const roles = db(connection => connection.query('SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = 1').all())
    expect(roles).toEqual([{ name: 'READ_ONLY' }])
    const row = db(connection => connection.query<{ username: string, password_hash: string }, []>('SELECT username, password_hash FROM users').get()!)
    expect(row.username).toBe('reader@example.test')
    expect(row.password_hash).toStartWith('$argon2id$')
    expect(await Bun.password.verify(password, row.password_hash)).toBe(true)
    expect((await browser.get('/course/expenses')).status).toBe(200)
})

test('Курсовая: анониму доступны главная, about и формы; списки, роли и мониторинг закрыты', async () => {
    const browser = new Browser()
    for (const path of ['/course', '/course/', '/course/about', '/course/login', '/course/register', '/course/styles.css']) {
        const response = await browser.get(path)
        expect(response.status).toBe(200)
        if (!path.endsWith('.css')) {
            expect(response.headers.get('content-type')).toContain('text/html')
            expect(response.text).toStartWith('<!doctype html>')
        }
    }
    for (const path of ['/course/animals', '/course/expenses', '/course/logs', '/course/roles', '/course/calculator', '/course/actuator', '/course/actuator/health']) {
        const response = await browser.get(path)
        expect(response.status).toBe(303)
        expect(response.headers.get('location')).toBe('/course/login')
    }
})

test('Курсовая: READ_ONLY не изменяет данные прямыми запросами и не открывает формы записи', async () => {
    const writer = await account('writer', 'USER')
    const id = await animal(writer)
    const courseId = await expense(writer, id)
    const reader = await account('reader')
    for (const path of ['/course/animals/new', `/course/animals/${id}/edit`, '/course/expenses/new', `/course/expenses/${courseId}/edit`, '/course/roles', '/course/actuator/info']) expect((await reader.get(path)).status).toBe(403)
    for (const [path, body] of [
        ['/course/animals/save', { id: String(id), name: 'Изменено', species: 'ИТ', age: '1' }],
        ['/course/expenses/save', { ...expenseData, description: 'Чужое', animalId: String(id), amount: '10', expenseDate: '2026-10-01' }],
        [`/course/animals/${id}/delete`, {}], [`/course/expenses/${courseId}/delete`, {}], ['/course/roles', { userId: String(userId('reader')), role: 'ADMIN' }],
    ] as const) expect((await reader.post(path, body)).status).toBe(403)
    expect((await reader.get('/course/animals')).text).not.toContain('href="/course/animals/new"')
    expect(count('animals')).toBe(1)
    expect(count('expenses')).toBe(1)
})

test('Курсовая: USER видит только свои записи, READ_ONLY — общий список для чтения', async () => {
    const alice = await account('alice', 'USER')
    await expense(alice, await animal(alice, 'Алиса'), 'Расход Алисы')
    const bob = await account('bob', 'USER')
    await expense(bob, await animal(bob, 'Боб'), 'Расход Боба')
    expect((await alice.get('/course/expenses')).text).toContain('Расход Алисы')
    expect((await alice.get('/course/expenses')).text).not.toContain('Расход Боба')
    expect((await bob.get('/course/animals')).text).not.toContain('Алиса')
    const reader = await account('reader')
    const all = (await reader.get('/course/expenses')).text
    expect(all).toContain('Расход Алисы')
    expect(all).toContain('Расход Боба')
})

test('Курсовая: подмена id или животного не позволяет USER менять чужие записи', async () => {
    const alice = await account('alice', 'USER')
    const animalId = await animal(alice)
    const courseId = await expense(alice, animalId)
    const bob = await account('bob', 'USER')
    for (const path of [`/course/animals/${animalId}/edit`, `/course/expenses/${courseId}/edit`]) expect((await bob.get(path)).status).toBe(404)
    expect((await bob.post('/course/animals/save', { id: String(animalId), name: 'Захват', species: 'ИТ', age: '10' })).status).toBe(404)
    expect((await bob.post('/course/expenses/save', { ...expenseData, id: String(courseId), animalId: String(animalId), description: 'Захват', amount: '10', expenseDate: '2026-10-01' })).status).toBe(404)
    expect((await bob.post('/course/expenses/save', { ...expenseData, animalId: String(animalId), description: 'Захват', amount: '10', expenseDate: '2026-10-01' })).status).toBe(404)
    expect((await bob.post(`/course/expenses/${courseId}/delete`)).status).toBe(404)
    expect((await bob.post('/course/calculator', { animalId: String(animalId), month: '2026-10' })).status).toBe(404)
    expect(count('expenses')).toBe(1)
})

test('Курсовая: ADMIN меняет чужие записи, владелец при изменении сохраняется', async () => {
    const writer = await account('writer', 'USER')
    const animalId = await animal(writer)
    const courseId = await expense(writer, animalId)
    const admin = await account('admin', 'ADMIN')
    expect((await admin.post('/course/expenses/save', { ...expenseData, animalId: String(animalId), description: 'Добавлено администратором' })).status).toBe(303)
    expect((await writer.get('/course/expenses')).text).not.toContain('Добавлено администратором')
    expect((await admin.get(`/course/expenses/${courseId}/edit`)).status).toBe(200)
    expect((await admin.post('/course/expenses/save', { ...expenseData, id: String(courseId), animalId: String(animalId), description: 'Исправлено', amount: '72', expenseDate: '2026-10-04', ownerId: String(userId('admin')) })).status).toBe(303)
    expect(db(connection => connection.query<{ owner_id: number }, [number]>('SELECT owner_id FROM expenses WHERE id = ?').get(courseId)!).owner_id).toBe(userId('writer'))
    expect((await writer.get('/course/expenses')).text).toContain('Исправлено')
    expect((await admin.post(`/course/expenses/${courseId}/delete`)).status).toBe(303)
    const additionalId = db(connection => connection.query<{ id: number }, []>('SELECT id FROM expenses').get()!.id)
    expect(db(connection => connection.query<{ owner_id: number }, [number]>('SELECT owner_id FROM expenses WHERE id = ?').get(additionalId)!).owner_id).toBe(userId('admin'))
    expect((await admin.post(`/course/expenses/${additionalId}/delete`)).status).toBe(303)
    expect((await admin.post(`/course/animals/${animalId}/delete`)).status).toBe(303)
})

test('Курсовая: роль добавляется только ADMIN и действует без повторного входа', async () => {
    const reader = await account('reader')
    const admin = await account('admin', 'ADMIN')
    expect((await admin.get('/course/roles')).text).toContain('reader@example.test')
    expect((await admin.post('/course/roles', { userId: String(userId('reader')), role: 'USER' })).status).toBe(303)
    expect((await reader.get('/course/animals/new')).status).toBe(200)
    expect((await reader.post('/course/roles', { userId: String(userId('reader')), role: 'ADMIN' })).status).toBe(403)
    expect((await admin.post('/course/roles', { userId: String(userId('reader')), role: 'ADMIN' })).status).toBe(303)
    expect((await reader.get('/course/roles')).status).toBe(200)
    expect((await admin.post('/course/roles', { userId: '9999', role: 'ADMIN' })).status).toBe(404)
    expect((await admin.post('/course/roles', { userId: String(userId('reader')), role: 'BOGUS' })).status).toBe(400)
})

test('Курсовая: полный CRUD двух связанных таблиц; удаление используемого животного даёт 409', async () => {
    const writer = await account('writer', 'USER')
    const id = await animal(writer)
    const courseId = await expense(writer, id)
    expect((await writer.post(`/course/animals/${id}/delete`)).status).toBe(409)
    expect((await writer.post('/course/animals/save', { id: String(id), name: 'Анна Петрова', species: 'Математика', age: '4' })).status).toBe(303)
    const content = (await writer.get('/course/expenses')).text
    expect(content).toContain('Анна Петрова')
    expect((await writer.post(`/course/expenses/${courseId}/delete`)).status).toBe(303)
    expect((await writer.post(`/course/animals/${id}/delete`)).status).toBe(303)
    expect(count('animals')).toBe(0)
    expect(count('expenses')).toBe(0)
})

test('Курсовая: поля проверяются, форма сохраняет значения, SQL и HTML безопасно обрабатываются', async () => {
    const writer = await account('writer', 'USER')
    const invalid = await writer.post('/course/animals/save', { name: 'Имя', species: 'ИТ', age: '101' })
    expect(invalid.status).toBe(400)
    expect(invalid.text).toContain('value="Имя"')
    expect(invalid.text).toContain('aria-invalid="true"')
    const id = await animal(writer, "<script>x</script>');--")
    expect((await writer.get('/course/animals')).text).toContain('&lt;script&gt;x&lt;/script&gt;')
    for (const override of [{ amount: '0' }, { amount: '1.555' }, { expenseDate: '2026-02-31' }, { ...expenseData, category: 'INVALID' }, { animalId: '' }]) expect((await writer.post('/course/expenses/save', { ...expenseData, description: 'Курс', animalId: String(id), amount: '100', expenseDate: '2026-10-01', ...override })).status).toBe(400)
    expect((await writer.post('/course/expenses/save', { ...expenseData, description: 'Курс', animalId: '999', amount: '100', expenseDate: '2026-10-01' })).status).toBe(404)
    expect(count('expenses')).toBe(0)
    expect(count('users')).toBe(1)
})

test('Курсовая: стоимость за месяц считается по копейкам и категориям, другой месяц исключён', async () => {
    const writer = await account('writer', 'USER')
    const id = await animal(writer)
    await expense(writer, id, 'Корм 1', '144,10', '2026-10-03', 'FOOD')
    await expense(writer, id, 'Ветеринар', '72.20', '2026-10-04', 'VET')
    await expense(writer, id, 'Другой месяц', '500', '2026-11-01')
    const reader = await account('reader')
    const result = await reader.post('/course/calculator', { animalId: String(id), month: '2026-10' })
    expect(result.status).toBe(200)
    expect(result.text).toContain('216,30')
    expect(result.text).toContain('144,10')
    expect(result.text).toContain('72,20')
    expect(result.text).toContain('6,98')
    const empty = await reader.post('/course/calculator', { animalId: String(id), month: '2026-09' })
    expect(empty.text).toContain('0,00')
    expect((await reader.post('/course/calculator', { animalId: String(id), month: '2026-13' })).status).toBe(400)
})

test('Курсовая: журнал записывается в БД и JSONL-файл, пароли и токены не логируются', async () => {
    const writer = await account('writer', 'USER')
    const id = await animal(writer)
    await expense(writer, id)
    const lines = readFileSync(courseLogPath, 'utf8')
    const actions = lines.trim().split('\n').map(line => JSON.parse(line).action)
    for (const action of ['user.register', 'login.success', 'page.view', 'animal.create', 'expense.create']) expect(actions).toContain(action)
    expect(count('user_actions')).toBe(actions.length)
    expect(lines).not.toContain(password)
    expect(lines).not.toContain(writer.csrf)
    expect(lines).not.toContain(writer.cookie.split('=')[1])
    expect((await writer.get('/course/logs')).text).toContain('animal.create')
})

test('Курсовая: копейки суммируются точно, февраль високосного года содержит 29 дней', async () => {
    const writer = await account('writer', 'USER')
    const id = await animal(writer)
    await expense(writer, id, 'Малая сумма 1', '0,10', '2024-02-01')
    await expense(writer, id, 'Малая сумма 2', '0.20', '2024-02-29')
    expect(db(connection => connection.query<{ sum: number }, []>('SELECT sum(amount_cents) AS sum FROM expenses').get()!).sum).toBe(30)
    const result = await writer.post('/course/calculator', { animalId: String(id), month: '2024-02' })
    expect(result.text).toContain('0,30')
    expect(result.text).toContain('29 дней')
    for (const amount of ['-1', '0', '0.001', '1e3', '10000000.01']) expect((await writer.post('/course/expenses/save', { ...expenseData, animalId: String(id), amount })).status).toBe(400)
    expect((await writer.post('/course/expenses/save', { ...expenseData, animalId: String(id), expenseDate: '2026-02-29' })).status).toBe(400)
})

test('Курсовая: роль из формы регистрации игнорируется, READ_ONLY назначается на сервере', async () => {
    const browser = new Browser()
    await browser.get('/course/register')
    expect((await browser.post('/course/register', { firstName: 'Попытка', lastName: 'Роли', email: 'role@example.test', password, role: 'ADMIN', roles: 'ADMIN' })).status).toBe(303)
    const roles = db(connection => connection.query("SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id").all())
    expect(roles).toEqual([{ name: 'READ_ONLY' }])
})

test('Курсовая: пользователь видит только свои логи, ADMIN — общие', async () => {
    const alice = await account('alice', 'USER')
    await animal(alice)
    const bob = await account('bob')
    const own = await bob.get('/course/logs')
    expect(own.text).toContain('bob@example.test')
    expect(own.text).not.toContain('alice@example.test')
    const admin = await account('admin', 'ADMIN')
    const all = await admin.get('/course/logs')
    expect(all.text).toContain('alice@example.test')
    expect(all.text).toContain('bob@example.test')
    expect((await bob.get('/course/logs?before=0')).status).toBe(400)
})

test('Курсовая: все изменяющие формы и калькулятор требуют CSRF, GET не удаляет', async () => {
    const writer = await account('writer', 'ADMIN')
    const id = await animal(writer)
    const courseId = await expense(writer, id)
    for (const path of ['/course/register', '/course/login', '/course/logout', '/course/animals/save', '/course/expenses/save', `/course/animals/${id}/delete`, `/course/expenses/${courseId}/delete`, '/course/roles', '/course/calculator']) expect((await writer.post(path, {}, false)).status).toBe(403)
    expect((await writer.get(`/course/expenses/${courseId}/delete`)).status).toBe(404)
    expect((await writer.get('/course/logout')).status).toBe(404)
    expect(count('expenses')).toBe(1)
})

test('Курсовая: вход меняет сессию, выход отзывает её, чужая cookie не принимается', async () => {
    const writer = await account('writer', 'USER')
    const staleCookie = writer.cookie
    expect((await writer.post('/course/logout')).status).toBe(303)
    const stale = new Browser()
    stale.cookie = staleCookie
    expect((await stale.get('/course/animals')).status).toBe(303)
    stale.cookie = 'course_session=' + 'f'.repeat(64)
    expect((await stale.get('/course/expenses')).status).toBe(303)
    await writer.get('/course/login')
    const before = writer.cookie
    expect((await writer.post('/course/login', { username: 'writer@example.test', password })).status).toBe(303)
    expect(writer.cookie).not.toBe(before)
})

test('Курсовая: данные, роли, сессии и журнал сохраняются после перезапуска', async () => {
    const writer = await account('writer', 'USER')
    await expense(writer, await animal(writer))
    const oldActions = count('user_actions')
    await app.stop()
    start()
    expect((await writer.get('/course/expenses')).text).toContain('Корм')
    expect((await writer.get('/course/animals/new')).status).toBe(200)
    expect(count('user_actions')).toBeGreaterThan(oldActions)
    expect(readFileSync(courseLogPath, 'utf8')).toContain('expense.create')
})

test('Курсовая: локальная команда назначает первого ADMIN и повторяется без дублирования', async () => {
    const reader = await account('reader')
    const run = async (email: string) => {
        const process = Bun.spawn([globalThis.process.execPath, 'run', 'scripts/course-admin.ts', email], { env: { ...globalThis.process.env, COURSE_DATABASE_PATH: courseDatabasePath, COURSE_LOG_PATH: courseLogPath }, stdout: 'pipe', stderr: 'pipe' })
        await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()])
        return process.exited
    }
    expect(await run('reader@example.test')).toBe(0)
    expect(await run('reader@example.test')).toBe(0)
    expect((await reader.get('/course/roles')).status).toBe(200)
    expect(await run('missing@example.test')).not.toBe(0)
    expect(db(connection => connection.query("SELECT * FROM user_actions WHERE action = 'role.bootstrap'").all())).toHaveLength(1)
})

test('Курсовая: мониторинг содержит реальные метрики и доступен только ADMIN', async () => {
    const admin = await account('admin', 'ADMIN')
    for (const path of ['/course/actuator', '/course/actuator/health', '/course/actuator/info', '/course/actuator/metrics']) expect((await admin.get(path)).status).toBe(200)
    const health = JSON.parse((await admin.get('/course/actuator/health')).text)
    expect(health.status).toBe('UP')
    const metrics = JSON.parse((await admin.get('/course/actuator/metrics')).text)
    expect(JSON.parse((await admin.get('/course/actuator/info')).text).variant).toBe(5)
    expect(metrics.requests).toBeGreaterThan(0)
    expect(metrics.memoryBytes).toBeGreaterThan(0)
    const reader = await account('reader')
    expect((await reader.get('/course/actuator/metrics')).status).toBe(403)
})

test('Курсовая: старые API не читают её БД, публичные маршруты не создают БД курсовой', async () => {
    await fetch(base + '/api/v1/hello')
    await fetch(base + '/openapi/json')
    expect(existsSync(courseDatabasePath)).toBe(false)
    const writer = await account('writer', 'USER')
    await animal(writer)
    expect((await (await fetch(base + '/api/v5/students')).json()).data).toEqual([])
    const tableNames = db(connection => connection.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name))
    expect(tableNames).toContain('animals')
    expect(tableNames).not.toContain('students')
})

test('Курсовая: ошибка файлового аудита откатывает изменение и запись журнала в транзакции', async () => {
    const writer = await account('writer', 'USER')
    const oldActions = count('user_actions')
    unlinkSync(courseLogPath)
    mkdirSync(courseLogPath)
    const response = await writer.post('/course/animals/save', { name: 'Ошибка', species: 'ИТ', age: '100' })
    expect(response.status).toBe(500)
    expect(response.text).not.toContain(directory)
    expect(count('animals')).toBe(0)
    expect(count('user_actions')).toBe(oldActions)
})

test('Курсовая: отсутствующая БД даёт безопасную ошибку, прежние лабораторные продолжают работать', async () => {
    await app.stop()
    courseDatabasePath = join(directory, 'not-a-database')
    mkdirSync(courseDatabasePath)
    start()
    const response = await new Browser().get('/course/register')
    expect(response.status).toBe(500)
    expect(response.text).not.toContain(directory)
    expect((await fetch(base + '/api/v1/hello')).status).toBe(200)
})
