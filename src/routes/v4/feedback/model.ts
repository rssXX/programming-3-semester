// ЛР5: расширение документированных Request/Response из ЛР2–3.
import { t } from 'elysia'
import { FeedbackModelRequest, FeedbackModelResponse } from '../../v2/feedback/model'
import { Positions } from './enums'

export const BonusModelRequest = t.Object({
    ...FeedbackModelRequest.properties,
    /** Должность сотрудника, определяющая коэффициент и право на квартальную премию. */
    position: t.Enum(Positions, { description: 'Должность сотрудника' }),
    /** Зарплата сотрудника, неотрицательное конечное число. */
    salary: t.Number({ minimum: 0, description: 'Зарплата сотрудника' }),
    /** Множитель премии, например 2 означает два оклада. */
    bonus: t.Number({ minimum: 0, description: 'Множитель премии' }),
    /** Количество отработанных дней за расчётный год, от 1 до числа дней в году. */
    workDays: t.Integer({ minimum: 1, maximum: 366, description: 'Отработанные дни за год' }),
    /** Расчётный год; при отсутствии используется текущий год сервера. */
    year: t.Optional(t.Integer({ minimum: 1, maximum: 9999, description: 'Расчётный год, по умолчанию текущий' })),
})

export const BonusModelResponse = t.Object({
    ...FeedbackModelResponse.properties,
    /** Годовая премия по формуле из методических материалов. */
    annualBonus: t.Number({ minimum: 0, description: 'Годовая премия' }),
    /** Четверть годовой премии для руководителей; null для остальных сотрудников. */
    quarterlyBonus: t.Nullable(t.Number({ minimum: 0 }), { description: 'Квартальная премия; null, если сотрудник не руководитель' }),
})

export type BonusRequest = typeof BonusModelRequest.static
export type BonusResponse = typeof BonusModelResponse.static
