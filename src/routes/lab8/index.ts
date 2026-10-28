// ЛР8: адаптация Spring Security к Bun/Elysia, в общей ветке проекта.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import { readFileSync } from 'node:fs'
import type { ApplicationDatabase } from '../../database'
import { FormInput, FormValidationError, html, readId } from '../lab7/common'
import { studentForm, studentList } from '../lab7/views/students'
import { ResourceNotFoundError } from '../v5/common'
import { SqliteStudentDAO } from '../v5/students/dao'
import { StudentServiceImpl } from '../v5/students/service'
import { SecurityStore, UserDAO } from './dao'
import { DuplicateEmailError, UserService } from './service'
import { SessionService, SESSION_COOKIE, SESSION_SECONDS, validCsrf } from './session'
import { errorPage, homePage, loginPage, registerPage, studentPageOptions, usersPage } from './views'

const styles = readFileSync(new URL('../lab7/views/styles.css', import.meta.url), 'utf8')
    + '\nnav { align-items: center; } nav form { margin: 0; } .session-user { color: #60718b; font-size: 13px; }'

export const createLab8 = (connection: ApplicationDatabase, logger = consola) => {
    const store = new SecurityStore(connection)
    const userDao = new UserDAO(store)
    const users = new UserService(userDao)
    const sessions = new SessionService(store, userDao)
    const students = new StudentServiceImpl(new SqliteStudentDAO(connection))
    const detail = { tags: ['ЛР8: регистрация и доступ'] }

    return new Elysia({ prefix: '/lab8' })
        .onRequest(({ set }) => {
            set.headers['cache-control'] = 'no-store'
            set.headers['x-content-type-options'] = 'nosniff'
            set.headers['x-frame-options'] = 'DENY'
            set.headers['content-security-policy'] = "default-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
        })
        .onError(({ code, error }) => {
            const status = error instanceof ResourceNotFoundError ? 404
                : error instanceof FormValidationError || code === 'VALIDATION' || code === 'PARSE' ? 400 : 500
            logger.error('LR8 request failed:', error instanceof Error ? error.message : error)
            const message = status === 500 ? 'Не удалось выполнить операцию. Попробуйте позже.'
                : error instanceof Error && (error instanceof ResourceNotFoundError || error instanceof FormValidationError) ? error.message : 'Некорректные данные запроса'
            return html(errorPage(status, message), status)
        })
        .derive(({ cookie, request }) => {
            let session = sessions.find(cookie[SESSION_COOKIE].value)
            if (!session) {
                const created = sessions.create()
                session = created.session
                cookie[SESSION_COOKIE].set({ value: created.token, httpOnly: true, sameSite: 'lax', path: '/lab8', maxAge: SESSION_SECONDS, secure: new URL(request.url).protocol === 'https:' })
            }
            return { session }
        })
        .onBeforeHandle(({ request, body, session }) => {
            // Защита всех изменяющих форм, включая вход, регистрацию и выход.
            if (request.method === 'POST' && !validCsrf(new FormInput(body).values._csrf, session)) {
                return html(errorPage(403, 'Срок действия формы истёк или отсутствует защитный токен. Откройте форму заново.', session), 403)
            }
        })
        .get('', ({ session }) => html(homePage(session)), { detail })
        .get('/index', ({ session }) => html(homePage(session)), { detail })
        .get('/styles.css', () => new Response(styles, { headers: { 'content-type': 'text/css; charset=utf-8' } }), { detail: { hide: true } })
        .get('/register', ({ session, query }) => html(registerPage(session, {}, {}, query.success === '1')), { detail })
        .post('/register/save', async ({ body, session, redirect }) => {
            const form = new FormInput(body)
            const data = {
                firstName: form.text('firstName', 'Имя', 50),
                lastName: form.text('lastName', 'Фамилия', 50),
                email: form.text('email', 'Email', 254).toLowerCase(),
                password: form.values.password ?? '',
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) form.errors.email = 'Введите корректный email'
            if (data.password.length < 8 || data.password.length > 128 || !/\S/.test(data.password)) form.errors.password = 'Пароль должен содержать от 8 до 128 символов'
            if (form.invalid) return html(registerPage(session, form.values, form.errors), 400)
            try { await users.register(data) }
            catch (error) {
                if (!(error instanceof DuplicateEmailError)) throw error
                return html(registerPage(session, form.values, { email: error.message }), 400)
            }
            return redirect('/lab8/register?success=1', 303)
        }, { parse: 'urlencoded', detail })
        .get('/login', ({ session, query, redirect }) => session.user ? redirect('/lab8/list') : html(loginPage(session, '', '', query.logout === '1')), { detail })
        .post('/login', async ({ body, session, cookie, request, redirect }) => {
            const form = new FormInput(body)
            const email = form.values.username ?? ''
            const password = form.values.password ?? ''
            const user = !form.invalid && email.length <= 254 && password.length >= 8 && password.length <= 128
                ? await users.authenticate(email, password) : null
            if (!user) return html(loginPage(session, email, 'Неверный email или пароль'), 401)
            const created = sessions.create(user.id, session)
            cookie[SESSION_COOKIE].set({ value: created.token, httpOnly: true, sameSite: 'lax', path: '/lab8', maxAge: SESSION_SECONDS, secure: new URL(request.url).protocol === 'https:' })
            return redirect('/lab8/list', 303)
        }, { parse: 'urlencoded', detail })
        .guard({}, secured => secured
            .onBeforeHandle(({ session, redirect }) => {
                if (!session.user) return redirect('/lab8/login', 303)
            })
            .post('/logout', ({ session, cookie, redirect }) => {
                sessions.destroy(session.tokenHash)
                cookie[SESSION_COOKIE].set({ value: '', path: '/lab8', httpOnly: true, sameSite: 'lax', maxAge: 0 })
                return redirect('/lab8/login?logout=1', 303)
            }, { parse: 'urlencoded', detail })
            .get('/users', ({ session }) => session.user!.roles.includes('ROLE_ADMIN')
                ? html(usersPage(users.findAll(), session)) : html(errorPage(403, 'Для просмотра пользователей требуется роль администратора.', session), 403), { detail })
            .get('/list', ({ session, query }) => html(studentList(students.findAll(), query.status, studentPageOptions(session))), { detail })
            .get('/addStudentForm', ({ session }) => html(studentForm({}, {}, studentPageOptions(session))), { detail })
            .get('/showUpdateForm', ({ session, query }) => {
                const student = students.findById(readId(query.studentId))
                return html(studentForm({ ...student, id: String(student.id), age: String(student.age) }, {}, studentPageOptions(session)))
            }, { detail })
            .post('/saveStudent', ({ session, body, redirect }) => {
                const form = new FormInput(body)
                const student = {
                    name: form.text('name', 'Имя', 15), surname: form.text('surname', 'Фамилия', 25),
                    faculty: form.text('faculty', 'Факультет', 20), age: form.integer('age', 'Возраст', 0, 150),
                }
                const id = form.optionalId()
                if (form.invalid) return html(studentForm(form.values, form.errors, studentPageOptions(session)), 400)
                if (id === undefined) students.create(student)
                else students.update({ ...student, id })
                return redirect('/lab8/list?status=saved', 303)
            }, { parse: 'urlencoded', detail })
            .post('/deleteStudent', ({ body, redirect }) => {
                students.delete(readId(new FormInput(body).values.studentId))
                return redirect('/lab8/list?status=deleted', 303)
            }, { parse: 'urlencoded', detail })
        )
}
