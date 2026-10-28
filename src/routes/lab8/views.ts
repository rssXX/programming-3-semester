// ЛР8: публичные страницы, формы входа/регистрации и список пользователей.
import type { FormErrors, FormValues } from '../lab7/common'
import { csrfField, escapeHtml, formNotice } from '../lab7/views/layout'
import type { Session, User } from './entity'

export const layout8 = (title: string, content: string, session?: Session) => {
    const user = session?.user
    const navigation = user
        ? `<a href="/lab8/list">Студенты</a>${user.roles.includes('ROLE_ADMIN') ? '<a href="/lab8/users">Пользователи</a>' : ''}
<span class="session-user">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
<form action="/lab8/logout" method="post">${csrfField(session!.csrfToken)}<button class="secondary" type="submit">Выйти</button></form>`
        : '<a href="/lab8/login">Вход</a><a href="/lab8/register">Регистрация</a>'
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ЛР8</title><link rel="stylesheet" href="/lab8/styles.css"></head><body>
<header><div class="container header"><a class="brand" href="/lab8">Учебный журнал <span>ЛР8</span></a><nav aria-label="Основная навигация">${navigation}</nav></div></header>
<main class="container">${content}</main><footer class="container">Технологии программирования · Лабораторная работа № 8</footer></body></html>`
}

export const homePage = (session: Session) => layout8('Главная', `<section class="card"><p class="eyebrow">Учебный журнал</p><h1>Учёт студентов</h1>
<p>${session.user ? 'Вы вошли в систему. Перейдите к списку студентов.' : 'Зарегистрируйтесь и войдите, чтобы работать со списком студентов.'}</p>
<div class="actions">${session.user ? '<a class="button" href="/lab8/list">Открыть список студентов</a>' : '<a class="button" href="/lab8/login">Войти</a><a class="button secondary" href="/lab8/register">Зарегистрироваться</a>'}</div></section>`, session)

const field = (name: string, label: string, type: 'text' | 'email' | 'password', values: FormValues, errors: FormErrors, maxLength: number, autocomplete: string) => `<div class="field">
<label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" required maxlength="${maxLength}" autocomplete="${autocomplete}"
${type === 'password' ? 'minlength="8"' : `value="${escapeHtml(values[name])}"`}
${errors[name] ? `aria-invalid="true" aria-describedby="${name}-error"` : ''}>
${errors[name] ? `<p id="${name}-error" class="field-error">${escapeHtml(errors[name])}</p>` : ''}</div>`

export const registerPage = (session: Session, values: FormValues = {}, errors: FormErrors = {}, success = false) => layout8('Регистрация', `
<section class="card form-card"><h1>Регистрация</h1>
${success ? '<p class="notice" role="status">Регистрация прошла успешно. Теперь вы можете войти.</p>' : ''}
${formNotice(errors)}<form action="/lab8/register/save" method="post">${csrfField(session.csrfToken)}
${field('firstName', 'Имя', 'text', values, errors, 50, 'given-name')}
${field('lastName', 'Фамилия', 'text', values, errors, 50, 'family-name')}
${field('email', 'Email', 'email', values, errors, 254, 'email')}
${field('password', 'Пароль (8–128 символов)', 'password', {}, errors, 128, 'new-password')}
<div class="actions"><button type="submit">Зарегистрироваться</button><a href="/lab8/login">Уже есть аккаунт? Войти</a></div></form></section>`, session)

export const loginPage = (session: Session, username = '', message = '', loggedOut = false) => layout8('Вход', `
<section class="card form-card"><h1>Вход в систему</h1>
${message ? `<p class="notice error" role="alert">${escapeHtml(message)}</p>` : ''}
${loggedOut ? '<p class="notice" role="status">Вы вышли из системы.</p>' : ''}
<form action="/lab8/login" method="post">${csrfField(session.csrfToken)}
${field('username', 'Email', 'email', { username }, {}, 254, 'username')}
${field('password', 'Пароль', 'password', {}, {}, 128, 'current-password')}
<div class="actions"><button type="submit">Войти</button><a href="/lab8/register">Создать аккаунт</a></div></form></section>`, session)

export const usersPage = (users: User[], session: Session) => layout8('Пользователи', `
<div class="page-heading"><div><p class="eyebrow">Администрирование</p><h1>Пользователи</h1><p>Зарегистрированные пользователи системы.</p></div></div>
<section class="card table-wrap"><table><caption>Всего пользователей: ${users.length}</caption><thead><tr><th scope="col">Имя</th><th scope="col">Фамилия</th><th scope="col">Email</th><th scope="col">Роли</th></tr></thead>
<tbody>${users.map(user => `<tr><td>${escapeHtml(user.firstName)}</td><td>${escapeHtml(user.lastName)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.roles.join(', '))}</td></tr>`).join('')}</tbody></table></section>`, session)

export const errorPage = (status: number, message: string, session?: Session) => layout8(`Ошибка ${status}`, `<section class="card"><h1>Ошибка ${status}</h1><p role="alert">${escapeHtml(message)}</p><a href="/lab8">На главную</a></section>`, session)

export const studentPageOptions = (session: Session) => ({
    basePath: '/lab8', csrfToken: session.csrfToken,
    render: (title: string, content: string) => layout8(title, content, session),
})
