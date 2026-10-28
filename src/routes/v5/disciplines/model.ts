// ЛР6: поля дисциплины выбраны в рамках работы, так как в задании они не заданы.
import { t } from 'elysia'
import { IdSchema } from '../common'

export const DisciplineCreateModel = t.Object({
    name: t.String({ maxLength: 100, pattern: '\\S', description: 'Название учебной дисциплины' }),
    hours: t.Integer({ minimum: 1, maximum: 10000, description: 'Объём в учебных часах' }),
})

export const DisciplineModel = t.Object({ id: IdSchema, ...DisciplineCreateModel.properties })
