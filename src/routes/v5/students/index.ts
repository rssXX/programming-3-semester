// ЛР6: контроллер CRUD студентов. PUT получает id в JSON, как в методичке.
import { Elysia, t } from 'elysia'
import { consola } from 'consola'
import type { ApplicationDatabase } from '../../../database'
import { crudError, DeletedModel, ErrorResponse, IdParams, success, SuccessResponse } from '../common'
import { SqliteStudentDAO } from './dao'
import { StudentCreateModel, StudentModel } from './model'
import { StudentServiceImpl } from './service'

export const createStudents = (connection: ApplicationDatabase, logger = consola) => {
    const service = new StudentServiceImpl(new SqliteStudentDAO(connection))
    const errors = { 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse }

    return new Elysia({ prefix: '/students' })
        .onError(({ code, error, set }) => {
            const result = crudError(code, error, logger)
            set.status = result.status
            return result.body
        })
        .get('', () => success(service.findAll(), 'Список студентов получен'), {
            response: { 200: SuccessResponse(t.Array(StudentModel)), ...errors }, detail: { tags: ['ЛР6: студенты'] },
        })
        .get('/:id', ({ params }) => success(service.findById(params.id), 'Студент найден'), {
            params: IdParams, response: { 200: SuccessResponse(StudentModel), ...errors }, detail: { tags: ['ЛР6: студенты'] },
        })
        .post('', ({ body, set }) => {
            const student = service.create(body)
            set.status = 201
            return success(student, 'Студент создан')
        }, { body: StudentCreateModel, response: { 201: SuccessResponse(StudentModel), ...errors }, detail: { tags: ['ЛР6: студенты'] } })
        .put('', ({ body }) => success(service.update(body), 'Студент обновлён'), {
            body: StudentModel, response: { 200: SuccessResponse(StudentModel), ...errors }, detail: { tags: ['ЛР6: студенты'] },
        })
        .delete('/:id', ({ params }) => success(service.delete(params.id), 'Студент удалён'), {
            params: IdParams, response: { 200: SuccessResponse(DeletedModel), ...errors }, detail: { tags: ['ЛР6: студенты'] },
        })
}
