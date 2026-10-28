// Курсовая: вариант 5, домашние животные и стоимость содержания.
import { Elysia, status as httpStatus } from 'elysia'
import { html } from '@elysia/html'
import { consola } from 'consola'
import { readFileSync } from 'node:fs'
import type { ApplicationDatabase } from '../database'
import { FormInput, FormValidationError, readId } from '../routes/lab7/common'
import { UserDAO } from '../routes/lab8/dao'
import { DuplicateEmailError, UserService } from '../routes/lab8/service'
import { SESSION_SECONDS, SessionService, validCsrf } from '../routes/lab8/session'
import { CourseError, CourseService, requireAdmin, requireWrite } from './service'
import { categories, parseMoney, validDate, validMonth } from './model'
import * as views from './views'

const COOKIE = 'course_session'
const styles = readFileSync(new URL('../routes/lab7/views/styles.css', import.meta.url), 'utf8') + `
.header { flex-wrap: wrap; } nav { align-items: center; gap: 15px; } nav form { margin: 0; }
select { padding: 10px; max-width: 100%; border: 1px solid #b9c5d5; border-radius: 6px; font: inherit; background: white; color: #243247; }
.field select { width: 100%; } select[aria-invalid="true"] { border-color: #ad2b32; }
.stats { display: flex; gap: 48px; margin: 28px 0; } .stats strong { display: block; font-size: 32px; color: #245bc0; }
.stats span { color: #60718b; font-size: 14px; } .result { margin-top: 24px; } dt { font-weight: 650; } dd { margin: 0 0 14px; }
.pagination { margin-top: 22px; } .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`

export const createCourse = (connection: ApplicationDatabase, logPath?: string, logger = consola) => {
    const userDao = new UserDAO(connection, 'READ_ONLY')
    const users = new UserService(userDao)
    const sessions = new SessionService(connection, userDao)
    const data = new CourseService(connection, logPath)
    const detail = { tags: ['Курсовая: животные и расходы'] }
    const startedAt = new Date().toISOString()
    let requests = 0

    return new Elysia({ prefix: '/course' })
        .use(html())
        .onRequest(({ set }) => {
            requests++
            set.headers['cache-control'] = 'no-store'
            set.headers['x-frame-options'] = 'DENY'
            set.headers['x-content-type-options'] = 'nosniff'
            set.headers['content-security-policy'] = "default-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
        })
        .onError(({ code, error }) => {
            let status = 500
            let message = 'Не удалось выполнить операцию. Попробуйте позже.'
            if (error instanceof CourseError) {
                status = error.status
                message = error.message
            } else if (error instanceof FormValidationError || code === 'PARSE' || code === 'VALIDATION') {
                status = 400
                message = 'Некорректные данные запроса'
            }
            logger.error('Course request failed:', error instanceof Error ? error.message : error)
            return httpStatus(status, views.errorPage(status, message))
        })
        .get('/styles.css', () => new Response(styles, { headers: { 'content-type': 'text/css; charset=utf-8' } }), { detail: { hide: true } })
        .derive(({ cookie, request }) => {
            let session = sessions.find(cookie[COOKIE].value)
            if (!session) {
                const created = sessions.create()
                session = created.session
                cookie[COOKIE].set({
                    value: created.token, path: '/course', httpOnly: true,
                    sameSite: 'lax', maxAge: SESSION_SECONDS,
                    secure: new URL(request.url).protocol === 'https:',
                })
            }
            return { session }
        })
        .onBeforeHandle(({ request, body, session, redirect }) => {
            // Сначала проверяем вход и роль, затем защитный токен формы.
            const path = new URL(request.url).pathname.replace(/\/$/, '')
            const publicPages = ['/course', '/course/about', '/course/register', '/course/login']
            if (!session.user && !publicPages.includes(path)) return redirect('/course/login', 303)
            if (path === '/course/roles' || path.startsWith('/course/actuator')) requireAdmin(session.user!)
            if (request.method === 'POST' && !validCsrf(new FormInput(body).values._csrf, session)) {
                data.log(session.user, 'security.csrf_denied', new URL(request.url).pathname)
                return httpStatus(403, views.errorPage(403, 'Откройте форму заново: отсутствует или истёк защитный токен.', session))
            }
            if (request.method === 'GET' && session.user) data.log(session.user, 'page.view', new URL(request.url).pathname)
        })
        .get('', ({ session }) => {
            const counts = session.user ? {
                animals: data.animals(session.user).length,
                expenses: data.expenses(session.user).length,
            } : undefined
            return views.home(session, counts)
        }, { detail })
        .get('/about', ({ session }) => views.about(session), { detail })
        .get('/register', ({ session, query }) => views.register(session, {}, {}, query.success === '1'), { detail })
        .post('/register', async ({ body, session, redirect }) => {
            const form = new FormInput(body)
            const registration = {
                firstName: form.text('firstName', 'Имя', 50),
                lastName: form.text('lastName', 'Фамилия', 50),
                email: form.text('email', 'Email', 254).toLowerCase(),
                password: form.values.password ?? '',
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email)) form.errors.email = 'Введите корректный email'
            if (registration.password.length < 8 || registration.password.length > 128 || !/\S/.test(registration.password)) form.errors.password = 'Пароль должен содержать от 8 до 128 символов'
            if (form.invalid) return httpStatus(400, views.register(session, form.values, form.errors))
            try {
                const user = await users.register(registration)
                data.log(user, 'user.register', 'Регистрация с ролью READ_ONLY')
            } catch (error) {
                if (!(error instanceof DuplicateEmailError)) throw error
                return httpStatus(400, views.register(session, form.values, { email: error.message }))
            }
            return redirect('/course/register?success=1', 303)
        }, { parse: 'urlencoded', detail })
        .get('/login', ({ session, query, redirect }) => {
            if (session.user) return redirect('/course/expenses')
            return views.login(session, '', '', query.logout === '1')
        }, { detail })
        .post('/login', async ({ body, cookie, session, request, redirect }) => {
            const form = new FormInput(body)
            const email = form.values.username ?? ''
            const password = form.values.password ?? ''
            const user = !form.invalid && email.length <= 254 && password.length >= 8 && password.length <= 128 ? await users.authenticate(email, password) : null
            if (!user) {
                data.log(null, 'login.failed', 'Неверный логин или пароль', email.trim().toLowerCase().slice(0, 254))
                return httpStatus(401, views.login(session, email, 'Неверный логин или пароль'))
            }
            const created = sessions.create(user.id, session)
            cookie[COOKIE].set({
                value: created.token, path: '/course', httpOnly: true,
                sameSite: 'lax', maxAge: SESSION_SECONDS,
                secure: new URL(request.url).protocol === 'https:',
            })
            data.log(user, 'login.success', 'Вход в приложение')
            return redirect('/course/expenses', 303)
        }, { parse: 'urlencoded', detail })
        .post('/logout', ({ session, cookie, redirect }) => {
            data.log(session.user, 'logout', 'Выход из приложения')
            sessions.destroy(session.tokenHash)
            cookie[COOKIE].set({ value: '', path: '/course', httpOnly: true, sameSite: 'lax', maxAge: 0 })
            return redirect('/course/login?logout=1', 303)
        }, { parse: 'urlencoded', detail })
        .get('/animals', ({ session, query }) => views.animalList(data.animals(session.user!), session, query.status), { detail })
        .get('/animals/new', ({ session }) => {
            requireWrite(session.user!)
            return views.animalForm(session)
        }, { detail })
        .get('/animals/:id/edit', ({ session, params }) => {
            requireWrite(session.user!)
            const animal = data.animal(session.user!, readId(params.id))
            return views.animalForm(session, { id: String(animal.id), name: animal.name, species: animal.species, age: String(animal.age) })
        }, { detail })
        .post('/animals/save', ({ session, body, redirect }) => {
            requireWrite(session.user!)
            const form = new FormInput(body)
            const animal = {
                name: form.text('name', 'Кличка', 100),
                species: form.text('species', 'Вид животного', 50),
                age: form.integer('age', 'Возраст', 0, 100),
            }
            const id = form.optionalId()
            if (form.invalid) return httpStatus(400, views.animalForm(session, form.values, form.errors))
            data.saveAnimal(session.user!, animal, id)
            return redirect('/course/animals?status=saved', 303)
        }, { parse: 'urlencoded', detail })
        .post('/animals/:id/delete', ({ session, params, redirect }) => {
            data.deleteAnimal(session.user!, readId(params.id))
            return redirect('/course/animals?status=deleted', 303)
        }, { parse: 'urlencoded', detail })
        .get('/expenses', ({ session, query }) => views.expenseList(data.expenses(session.user!), session, query.status), { detail })
        .get('/expenses/new', ({ session }) => {
            requireWrite(session.user!)
            return views.expenseForm(session, data.animalsForExpense(session.user!))
        }, { detail })
        .get('/expenses/:id/edit', ({ session, params }) => {
            requireWrite(session.user!)
            const expense = data.expense(session.user!, readId(params.id))
            return views.expenseForm(session, data.animalsForExpense(session.user!, expense.id), { id: String(expense.id), animalId: String(expense.animalId), category: expense.category, amount: (expense.amountCents / 100).toFixed(2), expenseDate: expense.expenseDate, description: expense.description })
        }, { detail })
        .post('/expenses/save', ({ session, body, redirect }) => {
            requireWrite(session.user!)
            const form = new FormInput(body)
            const expense = {
                animalId: form.integer('animalId', 'Животное', 1, Number.MAX_SAFE_INTEGER),
                category: form.values.category ?? '',
                amountCents: parseMoney(form.values.amount ?? '') ?? 0,
                expenseDate: form.values.expenseDate ?? '',
                description: (form.values.description ?? '').trim(),
            }
            if (!Object.prototype.hasOwnProperty.call(categories, expense.category)) form.errors.category = 'Выберите категорию расхода'
            if (!expense.amountCents) form.errors.amount = 'Сумма: от 0,01 до 10 000 000 ₽, не более двух знаков после запятой'
            if (!validDate(expense.expenseDate)) form.errors.expenseDate = 'Введите существующую дату от 1900 года'
            if (expense.description.length > 200) form.errors.description = 'Примечание: не более 200 символов'
            const id = form.optionalId()
            if (form.invalid) return httpStatus(400, views.expenseForm(session, data.animalsForExpense(session.user!, id), form.values, form.errors))
            data.saveExpense(session.user!, expense, id)
            return redirect('/course/expenses?status=saved', 303)
        }, { parse: 'urlencoded', detail })
        .post('/expenses/:id/delete', ({ session, params, redirect }) => {
            data.deleteExpense(session.user!, readId(params.id))
            return redirect('/course/expenses?status=deleted', 303)
        }, { parse: 'urlencoded', detail })
        .get('/calculator', ({ session }) => views.calculator(session, data.animals(session.user!)), { detail })
        .post('/calculator', ({ session, body }) => {
            const form = new FormInput(body)
            const animalId = form.integer('animalId', 'Животное', 1, Number.MAX_SAFE_INTEGER)
            const month = form.values.month ?? ''
            if (!validMonth(month)) form.errors.month = 'Выберите корректный месяц от 1900 года'
            if (form.invalid) return httpStatus(400, views.calculator(session, data.animals(session.user!), form.values, form.errors))
            return views.calculator(session, data.animals(session.user!), form.values, {}, data.costs(session.user!, animalId, month))
        }, { parse: 'urlencoded', detail })
        .get('/logs', ({ session, query }) => views.logs(data.logs(session.user!, query.before === undefined ? undefined : readId(query.before)), session), { detail })
        .get('/roles', ({ session, query }) => views.roles(users.findAll(), session, query.saved === '1'), { detail })
        .post('/roles', ({ session, body, redirect }) => {
            const form = new FormInput(body)
            data.grant(session.user!, readId(form.values.userId), form.values.role ?? '')
            return redirect('/course/roles?saved=1', 303)
        }, { parse: 'urlencoded', detail })
        .get('/actuator', () => ({ links: ['/course/actuator/health', '/course/actuator/info', '/course/actuator/metrics'] }), { detail })
        .get('/actuator/health', () => {
            connection.database.query('SELECT 1').get()
            return { status: 'UP', database: 'SQLite' }
        }, { detail })
        .get('/actuator/info', () => ({ application: 'Мои питомцы', coursework: true, variant: 5, runtime: Bun.version, startedAt }), { detail })
        .get('/actuator/metrics', () => ({ uptimeSeconds: process.uptime(), memoryBytes: process.memoryUsage().rss, requests }), { detail })
}
