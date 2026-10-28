// ЛР7: список студентов и общая форма создания/редактирования.
import type { Student } from '../../v5/students/entity'
import type { FormErrors, FormValues } from '../common'
import { csrfField, escapeHtml, formNotice, input, layout, listNotice, rowActions } from './layout'

// ЛР8: общий шаблон с отдельными адресами, оформлением и CSRF. Значения по умолчанию — ЛР7.
interface StudentPageOptions {
    basePath?: string
    render?: typeof layout
    csrfToken?: string
}

export const studentList = (students: Student[], status?: unknown, options: StudentPageOptions = {}) => {
    const base = options.basePath ?? ''
    return (options.render ?? layout)('Студенты', `
<div class="page-heading"><div><p class="eyebrow">Учебный журнал</p><h1>Студенты</h1><p>Список студентов и их данные.</p></div><a class="button" href="${base}/addStudentForm">Добавить студента</a></div>
${listNotice(status)}<section class="card table-wrap"><table><caption>Всего студентов: ${students.length}</caption>
<thead><tr><th scope="col">Имя</th><th scope="col">Фамилия</th><th scope="col">Факультет</th><th scope="col">Возраст</th><th scope="col">Действия</th></tr></thead>
<tbody>${students.map(student => `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.surname)}</td><td>${escapeHtml(student.faculty)}</td><td>${student.age}</td><td>${rowActions(student.id, `${base}/showUpdateForm?studentId=${student.id}`, `${base}/deleteStudent`, 'studentId', options.csrfToken)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Студентов пока нет. Добавьте первого студента.</td></tr>'}</tbody></table></section>`)
}

export const studentForm = (values: FormValues = {}, errors: FormErrors = {}, options: StudentPageOptions = {}) => {
    const base = options.basePath ?? ''
    const title = values.id ? 'Редактирование студента' : 'Добавление студента'
    return (options.render ?? layout)(title, `<a class="back" href="${base}/list">← К списку студентов</a><section class="card form-card"><h1>${title}</h1>
${formNotice(errors)}<form action="${base}/saveStudent" method="post">${csrfField(options.csrfToken)}<input type="hidden" name="id" value="${escapeHtml(values.id)}">
${input({ name: 'name', label: 'Имя', maxLength: 15 }, values, errors)}
${input({ name: 'surname', label: 'Фамилия', maxLength: 25 }, values, errors)}
${input({ name: 'faculty', label: 'Факультет', maxLength: 20 }, values, errors)}
${input({ name: 'age', label: 'Возраст', type: 'number', min: 0, max: 150 }, values, errors)}
<div class="actions"><button type="submit">Сохранить</button><a class="button secondary" href="${base}/list">Отмена</a></div></form></section>`)
}
