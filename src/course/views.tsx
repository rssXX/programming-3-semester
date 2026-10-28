// Курсовая, вариант 5. JSX рендерится на сервере через @elysia/html.
import { Html, type PropsWithChildren } from '@elysia/html'
import type { FormErrors, FormValues } from '../routes/lab7/common'
import type { Session, User } from '../routes/lab8/entity'
import { categories, money, type Animal, type Expense } from './model'
import { canWrite, isAdmin, type CourseService, type UserAction } from './service'

function Csrf({ session }: { session: Session }) {
    return <input type="hidden" name="_csrf" value={session.csrfToken} />
}

function Layout({ title, session, children }: PropsWithChildren<{ title: string, session?: Session }>) {
    const user = session?.user
    return <html lang="ru">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title safe>{title} · Мои питомцы</title>
            <link rel="stylesheet" href="/course/styles.css" />
        </head>
        <body>
            <header>
                <div class="container header">
                    <a class="brand" href="/course">Мои питомцы <span>КП</span></a>
                    <nav aria-label="Навигация">
                        {user ? <>
                            <a href="/course/animals">Животные</a>
                            <a href="/course/expenses">Расходы</a>
                            <a href="/course/calculator">Расчёт</a>
                            <a href="/course/logs">Журнал</a>
                            {isAdmin(user) && <>
                                <a href="/course/roles">Доступ</a>
                                <a href="/course/actuator">Мониторинг</a>
                            </>}
                            <a href="/course/about">О приложении</a>
                            <form action="/course/logout" method="post">
                                <Csrf session={session!} />
                                <button class="secondary" type="submit">Выйти</button>
                            </form>
                        </> : <>
                            <a href="/course/login">Вход</a>
                            <a href="/course/register">Регистрация</a>
                            <a href="/course/about">О приложении</a>
                        </>}
                    </nav>
                </div>
            </header>
            <main class="container">{children}</main>
            <footer class="container">Курсовой проект · Романов Сергей Сергеевич · РИЗ-250213у</footer>
        </body>
    </html>
}

interface FieldProps {
    name: string
    label: string
    values: FormValues
    errors?: FormErrors
    type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'month'
    maxLength?: number
    min?: number | string
    max?: number
    required?: boolean
    autocomplete?: 'current-password' | 'new-password'
}

function Field({ name, label, values, errors = {}, type = 'text', maxLength, min, max, required = true, autocomplete }: FieldProps) {
    return <div class="field">
        <label for={name} safe>{label}</label>
        <input id={name} name={name} type={type} required={required}
            value={type === 'password' ? undefined : values[name] ?? ''}
            maxlength={maxLength} minlength={type === 'password' ? 8 : undefined}
            min={min} max={max} step={type === 'number' ? '1' : undefined}
            autocomplete={autocomplete}
            aria-invalid={errors[name] ? 'true' : undefined}
            aria-describedby={errors[name] ? `${name}-error` : undefined} />
        {errors[name] && <p id={`${name}-error`} class="field-error" safe>{errors[name]}</p>}
    </div>
}

function FormNotice({ errors }: { errors: FormErrors }) {
    if (Object.keys(errors).length === 0) return null
    return <p class="notice error" role="alert">
        Проверьте введённые данные. <span safe>{errors.id ?? ''}</span>
    </p>
}

function ListNotice({ status }: { status?: string }) {
    if (status === 'saved') return <p class="notice" role="status">Изменения сохранены.</p>
    if (status === 'deleted') return <p class="notice" role="status">Запись удалена.</p>
    return null
}

export function errorPage(status: number, message: string, session?: Session) {
    return <Layout title={`Ошибка ${status}`} session={session}>
        <section class="card">
            <h1>Ошибка {status}</h1>
            <p role="alert" safe>{message}</p>
            <a href="/course">На главную</a>
        </section>
    </Layout>
}

export function home(session: Session, counts?: { animals: number, expenses: number }) {
    return <Layout title="Главная" session={session}>
        <section class="card">
            <p class="eyebrow">Курсовой проект</p>
            <h1>Мои питомцы</h1>
            <p>Животные, расходы и стоимость содержания по месяцам.</p>
            {session.user ? <>
                <p>Здравствуйте, <span safe>{session.user.firstName}</span>.</p>
                <p>Ваш доступ: {isAdmin(session.user) ? 'администратор' : canWrite(session.user) ? 'свои записи' : 'только чтение'}.</p>
                <div class="stats">
                    <div><strong>{counts?.animals ?? 0}</strong><span>Животных</span></div>
                    <div><strong>{counts?.expenses ?? 0}</strong><span>Расходов</span></div>
                </div>
                <div class="actions">
                    <a class="button" href="/course/animals">Открыть животных</a>
                    <a class="button secondary" href="/course/calculator">Рассчитать стоимость</a>
                </div>
            </> : <>
                <p>Войдите, чтобы просматривать животных и расходы. После регистрации предоставляется доступ для чтения.</p>
                <div class="actions">
                    <a class="button" href="/course/login">Войти</a>
                    <a class="button secondary" href="/course/register">Зарегистрироваться</a>
                </div>
            </>}
        </section>
    </Layout>
}

export function about(session: Session) {
    return <Layout title="О приложении" session={session}>
        <section class="card">
            <h1>О приложении</h1>
            <p>«Мои питомцы» помогает вести список животных, учитывать расходы на корм, ветеринара и уход и рассчитывать стоимость содержания по месяцам.</p>
            <p>Автор: Романов Сергей Сергеевич, группа РИЗ-250213у, УрФУ.</p>
            <p>Курсовой проект по дисциплине «Технологии программирования», вариант 5. 2026 год.</p>
            <a class="button secondary" href="/course">На главную</a>
        </section>
    </Layout>
}

export function register(session: Session, values: FormValues = {}, errors: FormErrors = {}, success = false) {
    return <Layout title="Регистрация" session={session}>
        <section class="card form-card">
            <h1>Регистрация</h1>
            <p>Новый аккаунт получает доступ только для чтения.</p>
            {success && <p class="notice" role="status">Регистрация прошла успешно. Теперь войдите.</p>}
            <FormNotice errors={errors} />
            <form action="/course/register" method="post">
                <Csrf session={session} />
                <Field name="firstName" label="Имя" values={values} errors={errors} maxLength={50} />
                <Field name="lastName" label="Фамилия" values={values} errors={errors} maxLength={50} />
                <Field name="email" label="Email — логин" type="email" values={values} errors={errors} maxLength={254} />
                <Field name="password" label="Пароль (8–128 символов)" type="password" values={{}} errors={errors} maxLength={128} autocomplete="new-password" />
                <div class="actions">
                    <button type="submit">Зарегистрироваться</button>
                    <a href="/course/login">Уже есть аккаунт? Войти</a>
                </div>
            </form>
        </section>
    </Layout>
}

export function login(session: Session, username = '', message = '', logout = false) {
    return <Layout title="Вход" session={session}>
        <section class="card form-card">
            <h1>Вход</h1>
            {message && <p class="notice error" role="alert" safe>{message}</p>}
            {logout && <p class="notice" role="status">Вы вышли из системы.</p>}
            <form action="/course/login" method="post">
                <Csrf session={session} />
                <Field name="username" label="Email — логин" type="email" values={{ username }} maxLength={254} />
                <Field name="password" label="Пароль" type="password" values={{}} maxLength={128} autocomplete="current-password" />
                <div class="actions"><button type="submit">Войти</button><a href="/course/register">Создать аккаунт</a></div>
            </form>
        </section>
    </Layout>
}

function Actions({ base, id, session }: { base: string, id: number, session: Session }) {
    if (!canWrite(session.user!)) return <>Только чтение</>
    return <div class="actions">
        <a class="button secondary" href={`${base}/${id}/edit`}>Изменить</a>
        <form action={`${base}/${id}/delete`} method="post">
            <Csrf session={session} />
            <button class="danger" type="submit" aria-label={`Удалить запись ${id}`}>Удалить</button>
        </form>
    </div>
}

export function animalList(rows: Animal[], session: Session, status?: string) {
    return <Layout title="Животные" session={session}>
        <div class="page-heading">
            <h1>Животные</h1>
            {canWrite(session.user!) && <a class="button" href="/course/animals/new">Добавить животное</a>}
        </div>
        <ListNotice status={status} />
        <section class="card table-wrap"><table>
            <caption>Доступно животных: {rows.length}</caption>
            <thead><tr><th>Кличка</th><th>Вид</th><th>Возраст, лет</th><th>Действия</th></tr></thead>
            <tbody>
                {rows.map(row => <tr>
                    <td safe>{row.name}</td><td safe>{row.species}</td><td>{row.age}</td>
                    <td><Actions base="/course/animals" id={row.id} session={session} /></td>
                </tr>)}
                {!rows.length && <tr><td colspan={4} class="empty">Животных пока нет.</td></tr>}
            </tbody>
        </table></section>
    </Layout>
}

export function expenseList(rows: Expense[], session: Session, status?: string) {
    return <Layout title="Расходы" session={session}>
        <div class="page-heading">
            <h1>Расходы</h1>
            {canWrite(session.user!) && <a class="button" href="/course/expenses/new">Добавить расход</a>}
        </div>
        <ListNotice status={status} />
        <section class="card table-wrap"><table>
            <caption>Доступно расходов: {rows.length}</caption>
            <thead><tr><th>Животное</th><th>Категория</th><th>Сумма</th><th>Дата</th><th>Примечание</th><th>Действия</th></tr></thead>
            <tbody>
                {rows.map(row => <tr>
                    <td safe>{row.animalName}</td><td safe>{categories[row.category]}</td>
                    <td safe>{money(row.amountCents)}</td><td safe>{row.expenseDate}</td><td safe>{row.description}</td>
                    <td><Actions base="/course/expenses" id={row.id} session={session} /></td>
                </tr>)}
                {!rows.length && <tr><td colspan={6} class="empty">Расходов пока нет.</td></tr>}
            </tbody>
        </table></section>
    </Layout>
}

export function animalForm(session: Session, values: FormValues = {}, errors: FormErrors = {}) {
    const title = values.id ? 'Изменение животного' : 'Новое животное'
    return <Layout title={title} session={session}>
        <a class="back" href="/course/animals">← К животным</a>
        <section class="card form-card">
            <h1 safe>{title}</h1><FormNotice errors={errors} />
            <form action="/course/animals/save" method="post">
                <Csrf session={session} /><input type="hidden" name="id" value={values.id ?? ''} />
                <Field name="name" label="Кличка" values={values} errors={errors} maxLength={100} />
                <Field name="species" label="Вид животного" values={values} errors={errors} maxLength={50} />
                <Field name="age" label="Возраст, полных лет" type="number" values={values} errors={errors} min={0} max={100} />
                <div class="actions"><button type="submit">Сохранить</button><a href="/course/animals">Отмена</a></div>
            </form>
        </section>
    </Layout>
}

function AnimalSelect({ animals, values, errors }: { animals: Animal[], values: FormValues, errors: FormErrors }) {
    return <div class="field">
        <label for="animalId">Животное</label>
        <select id="animalId" name="animalId" required aria-invalid={errors.animalId ? 'true' : undefined}>
            <option value="">Выберите животное</option>
            {animals.map(animal => <option value={String(animal.id)} selected={String(animal.id) === values.animalId} safe>{animal.name}</option>)}
        </select>
        {errors.animalId && <p class="field-error" safe>{errors.animalId}</p>}
    </div>
}

export function expenseForm(session: Session, animals: Animal[], values: FormValues = {}, errors: FormErrors = {}) {
    const title = values.id ? 'Изменение расхода' : 'Новый расход'
    return <Layout title={title} session={session}>
        <a class="back" href="/course/expenses">← К расходам</a>
        <section class="card form-card">
            <h1 safe>{title}</h1><FormNotice errors={errors} />
            {!animals.length && <p class="notice">Сначала <a href="/course/animals/new">добавьте животное</a>.</p>}
            <form action="/course/expenses/save" method="post">
                <Csrf session={session} /><input type="hidden" name="id" value={values.id ?? ''} />
                <AnimalSelect animals={animals} values={values} errors={errors} />
                <div class="field">
                    <label for="category">Категория</label>
                    <select id="category" name="category" required>
                        {Object.entries(categories).map(([key, label]) => <option value={key} selected={values.category === key} safe>{label}</option>)}
                    </select>
                    {errors.category && <p class="field-error" safe>{errors.category}</p>}
                </div>
                <Field name="amount" label="Сумма, ₽ (например 1250,50)" values={values} errors={errors} maxLength={11} />
                <Field name="expenseDate" label="Дата расхода" type="date" values={values} errors={errors} min="1900-01-01" />
                <Field name="description" label="Примечание (необязательно)" values={values} errors={errors} maxLength={200} required={false} />
                <div class="actions"><button type="submit">Сохранить</button><a href="/course/expenses">Отмена</a></div>
            </form>
        </section>
    </Layout>
}

export function calculator(session: Session, animals: Animal[], values: FormValues = {}, errors: FormErrors = {}, result?: ReturnType<CourseService['costs']>) {
    return <Layout title="Стоимость содержания" session={session}>
        <section class="card form-card">
            <h1>Стоимость содержания</h1>
            <p>Выберите животное и месяц. Сумма рассчитывается по сохранённым расходам.</p>
            <FormNotice errors={errors} />
            <form action="/course/calculator" method="post">
                <Csrf session={session} /><AnimalSelect animals={animals} values={values} errors={errors} />
                <Field name="month" label="Месяц" type="month" values={values} errors={errors} min="1900-01" />
                <button type="submit">Рассчитать</button>
            </form>
        </section>
        {result && <section class="card result">
            <h2 safe>{result.animal.name} · {result.month}</h2>
            <dl>
                <dt>Записей расходов</dt><dd>{result.count}</dd>
                <dt>Всего за месяц</dt><dd safe>{money(result.totalCents)}</dd>
                <dt>Среднее за день ({result.days} дней)</dt><dd safe>{money(result.dailyCents)}</dd>
                {result.byCategory.map(row => <><dt safe>{categories[row.category]}</dt><dd safe>{money(row.totalCents)}</dd></>)}
            </dl>
            <p>Итого — сумма расходов за выбранный месяц. Среднее за день округляется до копеек.</p>
        </section>}
    </Layout>
}

export function logs(rows: UserAction[], session: Session) {
    return <Layout title="Журнал действий" session={session}>
        <h1>Журнал действий</h1>
        <p>{isAdmin(session.user!) ? 'Действия всех пользователей.' : 'Ваши действия в приложении.'} Последние 100 записей; время Екатеринбурга (UTC+5).</p>
        <section class="card table-wrap"><table>
            <thead><tr><th>Дата</th><th>Пользователь</th><th>Действие</th><th>Описание</th></tr></thead>
            <tbody>{rows.map(row => <tr>
                <td safe>{new Date(row.dateActions).toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' })}</td>
                <td safe>{row.username}</td><td safe>{row.action}</td><td safe>{row.description}</td>
            </tr>)}</tbody>
        </table></section>
        {rows.length === 100 && <p class="pagination"><a href={`/course/logs?before=${rows[rows.length - 1].id}`}>Более ранние записи →</a></p>}
    </Layout>
}

export function roles(users: User[], session: Session, saved = false) {
    return <Layout title="Управление доступом" session={session}>
        <h1>Управление доступом</h1>
        <p>USER — свои записи, ADMIN — полный доступ. Новые аккаунты имеют READ_ONLY.</p>
        {saved && <p class="notice" role="status">Роль добавлена.</p>}
        <section class="card table-wrap"><table>
            <thead><tr><th>Пользователь</th><th>Роли</th><th>Добавить роль</th></tr></thead>
            <tbody>{users.map(user => <tr>
                <td><span safe>{user.firstName} {user.lastName}</span><br /><span safe>{user.email}</span></td>
                <td safe>{user.roles.join(', ')}</td>
                <td><form class="actions" action="/course/roles" method="post">
                    <Csrf session={session} /><input type="hidden" name="userId" value={String(user.id)} />
                    <label class="visually-hidden" for={`role-${user.id}`} safe>Роль для {user.email}</label>
                    <select id={`role-${user.id}`} name="role"><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select>
                    <button type="submit">Добавить</button>
                </form></td>
            </tr>)}</tbody>
        </table></section>
    </Layout>
}
