// ЛР8: реальные HTTP-запросы, cookie, формы и временная SQLite; без скриншотов.
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createConsola } from 'consola'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createApp } from '../src/app'

const logger = createConsola({ reporters: [] })
const account = { firstName: 'Иван', lastName: 'Иванов', email: 'student@example.test', password: 'Study-password-8!' }
const student = { name: 'Анна', surname: 'Петрова', faculty: 'РТФ', age: '21' }
let directory: string
let databasePath: string
let lab8DatabasePath: string
let app: ReturnType<typeof createApp>
let baseUrl: string

const start = () => {
    app = createApp({ databasePath, lab8DatabasePath, logger }).listen({ port: 0, hostname: '127.0.0.1' })
    baseUrl = `http://127.0.0.1:${app.server!.port}`
}

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'lab8-'))
    databasePath = join(directory, 'previous-labs.sqlite')
    lab8DatabasePath = join(directory, 'lab8.sqlite')
    start()
})

afterEach(async () => {
    await app.stop()
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('lab8-')) {
        throw new Error('Отказ от удаления каталога вне временной области теста')
    }
    rmSync(target, { recursive: true, force: true })
})

class Browser {
    cookie = ''
    csrf = ''

    async request(method: string, path: string, data?: Record<string, string>, withCsrf = true) {
        const response = await fetch(`${baseUrl}${path}`, {
            method, redirect: 'manual', headers: this.cookie ? { cookie: this.cookie } : {},
            body: method === 'POST' ? new URLSearchParams({ ...(withCsrf ? { _csrf: this.csrf } : {}), ...data }) : undefined,
        })
        for (const header of response.headers.getSetCookie()) {
            const cookie = header.match(/^lab8_session=([^;]*)/)
            if (cookie) this.cookie = cookie[1] ? `lab8_session=${cookie[1]}` : ''
        }
        const text = await response.text()
        const token = text.match(/name="_csrf" value="([a-f0-9]{64})"/)
        if (token) this.csrf = token[1]
        return { status: response.status, headers: response.headers, text }
    }

    get(path: string) { return this.request('GET', path) }
    post(path: string, data: Record<string, string> = {}, withCsrf = true) { return this.request('POST', path, data, withCsrf) }
}

const register = async (browser: Browser, data = account) => {
    await browser.get('/lab8/register')
    return browser.post('/lab8/register/save', data)
}

const login = async (browser: Browser) => {
    await browser.get('/lab8/login')
    const result = await browser.post('/lab8/login', { username: account.email, password: account.password })
    expect(result.status).toBe(303)
    expect(result.headers.get('location')).toBe('/lab8/list')
    await browser.get('/lab8/list')
    return result
}

const authenticated = async () => {
    const browser = new Browser()
    expect((await register(browser)).status).toBe(303)
    await login(browser)
    return browser
}

const database = <T>(run: (db: Database) => T): T => {
    const db = new Database(lab8DatabasePath, { strict: true })
    try { return run(db) } finally { db.close() }
}

test('ЛР8: публичные главная, регистрация и вход доступны, прежняя БД не открывается', async () => {
    const browser = new Browser()
    for (const path of ['/lab8', '/lab8/', '/lab8/index', '/lab8/login', '/lab8/register', '/lab8/styles.css']) {
        expect((await browser.get(path)).status).toBe(200)
    }
    expect(existsSync(databasePath)).toBe(false)
    expect(existsSync(lab8DatabasePath)).toBe(true)
    const response = await browser.get('/lab8/register')
    expect(response.text).toContain('name="_csrf"')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('content-security-policy')).toContain("form-action 'self'")
})

test('ЛР8: аноним не получает защищённые страницы и не меняет студентов', async () => {
    const browser = new Browser()
    for (const path of ['/lab8/list', '/lab8/users', '/lab8/addStudentForm', '/lab8/showUpdateForm?studentId=1']) {
        const result = await browser.get(path)
        expect(result.status).toBe(303)
        expect(result.headers.get('location')).toBe('/lab8/login')
    }
    // Даже корректный токен анонимной формы не даёт право изменять данные.
    await browser.get('/lab8/login')
    expect((await browser.post('/lab8/saveStudent', student)).status).toBe(303)
    expect((await browser.post('/lab8/deleteStudent', { studentId: '1' })).status).toBe(303)
    expect(database(db => db.query('SELECT * FROM students').all())).toEqual([])
})

test('ЛР8: регистрация сохраняет Argon2id-хеш, роль и связь user_roles', async () => {
    const browser = new Browser()
    const result = await register(browser, { ...account, email: '  STUDENT@EXAMPLE.TEST  ' })
    expect(result.status).toBe(303)
    expect(result.headers.get('location')).toBe('/lab8/register?success=1')
    expect((await browser.get('/lab8/register?success=1')).text).toContain('Регистрация прошла успешно')
    const row = database(db => db.query<{ email: string, password_hash: string }, []>('SELECT email, password_hash FROM users').get()!)
    expect(row.email).toBe(account.email)
    expect(row.password_hash).toStartWith('$argon2id$')
    expect(row.password_hash).not.toBe(account.password)
    expect(await Bun.password.verify(account.password, row.password_hash)).toBe(true)
    expect(database(db => db.query('SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id').all())).toEqual([{ name: 'ROLE_ADMIN' }])
    expect((await browser.get('/lab8/list')).status).toBe(303)
})

test('ЛР8: валидация регистрации сохраняет текстовые поля, пароль в HTML не возвращается', async () => {
    const browser = new Browser()
    await browser.get('/lab8/register')
    for (const invalid of [
        { firstName: '  ' }, { firstName: 'И'.repeat(51) }, { lastName: '' },
        { email: 'no-email' }, { email: '' }, { password: 'short' }, { password: ' '.repeat(8) }, { password: 'x'.repeat(129) },
    ]) {
        const result = await browser.post('/lab8/register/save', { ...account, ...invalid })
        expect(result.status).toBe(400)
        expect(result.text).toContain('aria-invalid="true"')
        expect(result.text).not.toContain(`value="${account.password}"`)
        expect(result.text).not.toContain('value="short"')
    }
    expect(database(db => db.query('SELECT * FROM users').all())).toEqual([])
})

test('ЛР8: повторный email в другом регистре отклоняется, включая конкурентную регистрацию', async () => {
    const browsers = [new Browser(), new Browser()]
    await Promise.all(browsers.map(browser => browser.get('/lab8/register')))
    const results = await Promise.all(browsers.map((browser, index) => browser.post('/lab8/register/save', { ...account, email: index ? account.email.toUpperCase() : account.email })))
    expect(results.map(result => result.status).sort()).toEqual([303, 400])
    expect(results.find(result => result.status === 400)!.text).toContain('уже зарегистрирована')
    expect(database(db => db.query('SELECT * FROM users').all())).toHaveLength(1)
    expect(database(db => db.query('SELECT * FROM user_roles').all())).toHaveLength(1)
})

test('ЛР8: неверные email и пароль дают одинаковую ошибку без доступа к данным', async () => {
    const browser = new Browser()
    await register(browser)
    await browser.get('/lab8/login')
    for (const [username, password] of [[account.email, 'Wrong-password!'], ['unknown@example.test', account.password], ["' OR 1=1 --", account.password]]) {
        const result = await browser.post('/lab8/login', { username, password })
        expect(result.status).toBe(401)
        expect(result.text).toContain('Неверный email или пароль')
        expect(result.text).not.toContain(account.password)
    }
    expect((await browser.get('/lab8/users')).status).toBe(303)
})

test('ЛР8: вход обновляет cookie и CSRF, прежняя анонимная сессия недействительна', async () => {
    const browser = new Browser()
    await register(browser)
    await browser.get('/lab8/login')
    const previous = browser.cookie
    const csrf = browser.csrf
    const response = await login(browser)
    expect(browser.cookie).not.toBe(previous)
    expect(browser.csrf).not.toBe(csrf)
    const setCookie = response.headers.get('set-cookie')!.toLowerCase()
    expect(setCookie).toContain('httponly')
    expect(setCookie).toContain('samesite=lax')
    expect(setCookie).toContain('path=/lab8')
    expect(setCookie).toContain('max-age=28800')
    const stale = new Browser()
    stale.cookie = previous
    expect((await stale.get('/lab8/list')).status).toBe(303)
    const stored = database(db => db.query<{ token_hash: string }, []>('SELECT token_hash FROM sessions WHERE user_id IS NOT NULL').get()!)
    expect(stored.token_hash).not.toBe(browser.cookie.split('=')[1])
})

test('ЛР8: после входа доступны список пользователей и полный CRUD студентов', async () => {
    const browser = await authenticated()
    const users = await browser.get('/lab8/users')
    expect(users.status).toBe(200)
    expect(users.text).toContain(account.email)
    expect(users.text).toContain('ROLE_ADMIN')
    expect(users.text).not.toContain(account.password)
    expect(users.text).not.toContain('$argon2id$')
    expect((await browser.get('/lab8/addStudentForm')).text).toContain('action="/lab8/saveStudent"')
    const created = await browser.post('/lab8/saveStudent', student)
    expect(created.status).toBe(303)
    expect(created.headers.get('location')).toBe('/lab8/list?status=saved')
    expect((await browser.get('/lab8/list')).text).toContain('Петрова')
    const edit = await browser.get('/lab8/showUpdateForm?studentId=1')
    expect(edit.text).toContain('name="id" value="1"')
    expect((await browser.post('/lab8/saveStudent', { ...student, id: '1', age: '22' })).status).toBe(303)
    expect(database(db => db.query<{ age: number }, []>('SELECT age FROM students WHERE id = 1').get()!).age).toBe(22)
    expect((await browser.post('/lab8/deleteStudent', { studentId: '1' })).status).toBe(303)
    expect((await browser.get('/lab8/showUpdateForm?studentId=1')).status).toBe(404)
    expect(database(db => db.query('SELECT * FROM students').all())).toEqual([])
})

test('ЛР8: у вошедшего пользователя проверяется роль при каждом обращении к /users', async () => {
    const browser = await authenticated()
    database(db => {
        db.exec("INSERT INTO roles (name) VALUES ('ROLE_USER'); DELETE FROM user_roles; INSERT INTO user_roles (user_id, role_id) SELECT 1, id FROM roles WHERE name = 'ROLE_USER';")
    })
    expect((await browser.get('/lab8/users')).status).toBe(403)
    const students = await browser.get('/lab8/list')
    expect(students.status).toBe(200)
    expect(students.text).not.toContain('href="/lab8/users"')
    database(db => db.exec("INSERT INTO user_roles (user_id, role_id) SELECT 1, id FROM roles WHERE name = 'ROLE_ADMIN';"))
    expect((await browser.get('/lab8/users')).status).toBe(200)
    expect(database(db => db.query('SELECT * FROM user_roles WHERE user_id = 1').all())).toHaveLength(2)
})

test('ЛР8: все POST требуют CSRF, чужой токен отклоняется', async () => {
    const browser = await authenticated()
    for (const path of ['/lab8/register/save', '/lab8/login', '/lab8/logout', '/lab8/saveStudent', '/lab8/deleteStudent']) {
        expect((await browser.post(path, student, false)).status).toBe(403)
        expect((await browser.post(path, { ...student, _csrf: '0'.repeat(64) })).status).toBe(403)
    }
    const stranger = new Browser()
    await stranger.get('/lab8/login')
    expect((await browser.post('/lab8/saveStudent', { ...student, _csrf: stranger.csrf })).status).toBe(403)
    expect(database(db => db.query('SELECT * FROM students').all())).toEqual([])
    expect((await browser.get('/lab8/users')).status).toBe(200)
})

test('ЛР8: выход удаляет сессию в БД, очищает cookie и исключает повторное использование', async () => {
    const browser = await authenticated()
    const previous = browser.cookie
    const result = await browser.post('/lab8/logout')
    expect(result.status).toBe(303)
    expect(result.headers.get('location')).toBe('/lab8/login?logout=1')
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(browser.cookie).toBe('')
    const stale = new Browser()
    stale.cookie = previous
    expect((await stale.get('/lab8/list')).status).toBe(303)
    expect((await browser.get('/lab8/login?logout=1')).text).toContain('Вы вышли из системы')
    expect(database(db => db.query('SELECT * FROM sessions WHERE user_id IS NOT NULL').all())).toEqual([])
})

test('ЛР8: просроченная или поддельная cookie не даёт доступ', async () => {
    const browser = await authenticated()
    database(db => db.query('UPDATE sessions SET expires_at = 0 WHERE user_id IS NOT NULL').run())
    expect((await browser.get('/lab8/users')).status).toBe(303)
    for (const value of ['f'.repeat(64), 'forged', '%7B%22userId%22%3A1%7D']) {
        browser.cookie = `lab8_session=${value}`
        expect((await browser.get('/lab8/list')).status).toBe(303)
    }
})

test('ЛР8: пользователи, роли, студенты и сессии сохраняются после перезапуска', async () => {
    const browser = await authenticated()
    await browser.post('/lab8/saveStudent', student)
    await app.stop()
    start()
    expect((await browser.get('/lab8/list')).text).toContain(student.surname)
    expect((await browser.get('/lab8/users')).text).toContain(account.email)
    const another = new Browser()
    await login(another)
    expect((await another.get('/lab8/users')).status).toBe(200)
})

test('ЛР8: данные защищённой версии изолированы от учебных API ЛР6–7', async () => {
    const browser = await authenticated()
    await browser.post('/lab8/saveStudent', student)
    const previous = await fetch(`${baseUrl}/api/v5/students`)
    expect((await previous.json()).data).toEqual([])
    const legacy = new Browser()
    expect((await legacy.post('/saveStudent', { ...student, surname: 'Сидорова' }, false)).status).toBe(303)
    const secureList = await browser.get('/lab8/list')
    expect(secureList.text).toContain('Петрова')
    expect(secureList.text).not.toContain('Сидорова')
})

test('ЛР8: HTML в именах экранируется, а пароль не появляется в ошибочной форме', async () => {
    const browser = new Browser()
    expect((await register(browser, { ...account, firstName: '<script>x</script>' })).status).toBe(303)
    await login(browser)
    const users = await browser.get('/lab8/users')
    expect(users.text).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(users.text).not.toContain('<script>x</script>')
    const invalid = await browser.post('/lab8/saveStudent', { ...student, age: '-1' })
    expect(invalid.status).toBe(400)
    expect(invalid.text).toContain('name="_csrf"')
    expect(database(db => db.query('SELECT * FROM students').all())).toEqual([])
})

test('ЛР8: GET не выполняет выход или удаление', async () => {
    const browser = await authenticated()
    await browser.post('/lab8/saveStudent', student)
    expect((await browser.get('/lab8/logout')).status).toBe(404)
    expect((await browser.get('/lab8/deleteStudent?studentId=1')).status).toBe(404)
    expect((await browser.get('/lab8/users')).status).toBe(200)
    expect(database(db => db.query('SELECT * FROM students').all())).toHaveLength(1)
})

test('ЛР8: ошибка БД даёт HTML 500 без пути; предыдущие работы доступны', async () => {
    await app.stop()
    lab8DatabasePath = join(directory, 'not-a-database')
    mkdirSync(lab8DatabasePath)
    start()
    const response = await new Browser().get('/lab8/register')
    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.text).not.toContain(directory)
    expect((await fetch(`${baseUrl}/api/v1/hello`)).status).toBe(200)
    expect((await fetch(`${baseUrl}/list`)).status).toBe(200)
})

test('ЛР8: OpenAPI содержит новые маршруты и не открывает БД; общий файл запрещён', async () => {
    const paths = (await (await fetch(`${baseUrl}/openapi/json`)).json()).paths
    for (const path of ['/lab8/login', '/lab8/register/save', '/lab8/users', '/lab8/saveStudent', '/api/v5/students', '/groups']) expect(paths[path]).toBeDefined()
    expect(existsSync(lab8DatabasePath)).toBe(false)
    expect(() => createApp({ databasePath, lab8DatabasePath: databasePath, logger })).toThrow('разные файлы')
})
