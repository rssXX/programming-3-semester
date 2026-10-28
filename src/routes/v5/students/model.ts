// ЛР6: схемы тела запроса и ответа для студента.
import { t } from 'elysia'
import { IdSchema } from '../common'

export const StudentCreateModel = t.Object({
    name: t.String({ maxLength: 15, pattern: '\\S', description: 'Имя студента' }),
    surname: t.String({ maxLength: 25, pattern: '\\S', description: 'Фамилия студента' }),
    faculty: t.String({ maxLength: 20, pattern: '\\S', description: 'Факультет' }),
    age: t.Integer({ minimum: 0, maximum: 150, description: 'Возраст в полных годах' }),
})

export const StudentModel = t.Object({ id: IdSchema, ...StudentCreateModel.properties })
