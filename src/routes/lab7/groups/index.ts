// ЛР7: независимый HTML-контроллер полного CRUD учебных групп.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import type { ApplicationDatabase } from '../../../database'
import { FormInput, html, pageError, readId } from '../common'
import { groupForm, groupList } from '../views/groups'
import { SqliteStudyGroupDAO } from './dao'
import { StudyGroupService } from './service'

export const createGroupPages = (connection: ApplicationDatabase, logger = consola) => {
    const service = new StudyGroupService(new SqliteStudyGroupDAO(connection))
    const detail = { tags: ['ЛР7: формы учебных групп'] }
    return new Elysia()
        .onError(({ code, error }) => pageError(code, error, logger))
        .get('/groups', ({ query }) => html(groupList(service.findAll(), query.status)), { detail })
        .get('/addGroupForm', () => html(groupForm()), { detail })
        .get('/showGroupUpdateForm', ({ query }) => {
            const group = service.findById(readId(query.groupId))
            return html(groupForm({ ...group, id: String(group.id), course: String(group.course) }))
        }, { detail })
        .post('/saveGroup', ({ body, redirect }) => {
            const form = new FormInput(body)
            const group = {
                name: form.text('name', 'Название группы', 30),
                faculty: form.text('faculty', 'Факультет', 20),
                course: form.integer('course', 'Курс', 1, 6),
            }
            const id = form.optionalId()
            if (form.invalid) return html(groupForm(form.values, form.errors), 400)
            if (id === undefined) service.create(group)
            else service.update({ ...group, id })
            return redirect('/groups?status=saved', 303)
        }, { parse: 'urlencoded', detail })
        .post('/deleteGroup', ({ body, redirect }) => {
            const form = new FormInput(body)
            service.delete(readId(form.values.groupId))
            return redirect('/groups?status=deleted', 303)
        }, { parse: 'urlencoded', detail })
}
