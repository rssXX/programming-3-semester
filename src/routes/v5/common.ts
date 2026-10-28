// ЛР6: единый контракт результата CRUD, независимый от feedback предыдущих работ.
import { t, type TSchema } from 'elysia'
import { consola } from 'consola'

export const IdSchema = t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description: 'Идентификатор записи' })
export const IdParams = t.Object({ id: IdSchema })
export const DeletedModel = t.Object({ id: IdSchema })
export const ErrorResponse = t.Object({ success: t.Literal(false), message: t.String(), data: t.Null() })
export const SuccessResponse = <T extends TSchema>(data: T) => t.Object({ success: t.Literal(true), message: t.String(), data })
export const success = <T>(data: T, message = 'Операция выполнена') => ({ success: true as const, message, data })

export class ResourceNotFoundError extends Error {}

export const crudError = (code: string | number, error: unknown, logger = consola) => {
    const status = error instanceof ResourceNotFoundError ? 404 : code === 'VALIDATION' || code === 'PARSE' ? 400 : 500
    const message = status === 404 && error instanceof Error ? error.message
        : status === 400 ? 'Некорректные данные запроса' : 'Ошибка работы с базой данных'
    logger.error('CRUD request failed:', error instanceof Error ? error.message : error)
    return { status, body: { success: false as const, message, data: null } }
}
