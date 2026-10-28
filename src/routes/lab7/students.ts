// ЛР7: HTML-контроллер использует сервис, DAO и таблицу студентов из ЛР6.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import type { ApplicationDatabase } from '../../database'
import { SqliteStudentDAO } from '../v5/students/dao'
import { StudentServiceImpl } from '../v5/students/service'
import { FormInput, html, pageError, readId } from './common'
import { studentForm, studentList } from './views/students'

export const createStudentPages = (connection: ApplicationDatabase, logger = consola) => {
    const service = new StudentServiceImpl(new SqliteStudentDAO(connection))
    const detail = { tags: ['ЛР7: формы студентов'] }
    return new Elysia()
        .onError(({ code, error }) => pageError(code, error, logger))
        .get('/list', ({ query }) => html(studentList(service.findAll(), query.status)), { detail })
        .get('/addStudentForm', () => html(studentForm()), { detail })
        .get('/showUpdateForm', ({ query }) => {
            const student = service.findById(readId(query.studentId))
            return html(studentForm({ ...student, id: String(student.id), age: String(student.age) }))
        }, { detail })
        .post('/saveStudent', ({ body, redirect }) => {
            const form = new FormInput(body)
            const student = {
                name: form.text('name', 'Имя', 15),
                surname: form.text('surname', 'Фамилия', 25),
                faculty: form.text('faculty', 'Факультет', 20),
                age: form.integer('age', 'Возраст', 0, 150),
            }
            const id = form.optionalId()
            if (form.invalid) return html(studentForm(form.values, form.errors), 400)
            if (id === undefined) service.create(student)
            else service.update({ ...student, id })
            // Post/Redirect/Get: обновление списка не повторяет сохранение формы.
            return redirect('/list?status=saved', 303)
        }, { parse: 'urlencoded', detail })
        .post('/deleteStudent', ({ body, redirect }) => {
            const form = new FormInput(body)
            service.delete(readId(form.values.studentId))
            return redirect('/list?status=deleted', 303)
        }, { parse: 'urlencoded', detail })
}
