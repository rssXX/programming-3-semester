// ЛР6: независимый контроллер полного CRUD учебных дисциплин.
import { Elysia, t } from 'elysia'
import { consola } from 'consola'
import type { ApplicationDatabase } from '../../../database'
import { crudError, DeletedModel, ErrorResponse, IdParams, success, SuccessResponse } from '../common'
import { SqliteDisciplineDAO } from './dao'
import { DisciplineCreateModel, DisciplineModel } from './model'
import { DisciplineServiceImpl } from './service'

export const createDisciplines = (connection: ApplicationDatabase, logger = consola) => {
    const service = new DisciplineServiceImpl(new SqliteDisciplineDAO(connection))
    const errors = { 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse }

    return new Elysia({ prefix: '/disciplines' })
        .onError(({ code, error, set }) => {
            const result = crudError(code, error, logger)
            set.status = result.status
            return result.body
        })
        .get('', () => success(service.findAll(), 'Список дисциплин получен'), {
            response: { 200: SuccessResponse(t.Array(DisciplineModel)), ...errors }, detail: { tags: ['ЛР6: дисциплины'] },
        })
        .get('/:id', ({ params }) => success(service.findById(params.id), 'Дисциплина найдена'), {
            params: IdParams, response: { 200: SuccessResponse(DisciplineModel), ...errors }, detail: { tags: ['ЛР6: дисциплины'] },
        })
        .post('', ({ body, set }) => {
            const discipline = service.create(body)
            set.status = 201
            return success(discipline, 'Дисциплина создана')
        }, { body: DisciplineCreateModel, response: { 201: SuccessResponse(DisciplineModel), ...errors }, detail: { tags: ['ЛР6: дисциплины'] } })
        .put('', ({ body }) => success(service.update(body), 'Дисциплина обновлена'), {
            body: DisciplineModel, response: { 200: SuccessResponse(DisciplineModel), ...errors }, detail: { tags: ['ЛР6: дисциплины'] },
        })
        .delete('/:id', ({ params }) => success(service.delete(params.id), 'Дисциплина удалена'), {
            params: IdParams, response: { 200: SuccessResponse(DeletedModel), ...errors }, detail: { tags: ['ЛР6: дисциплины'] },
        })
}
