// ЛР6: сущность второй таблицы — учебная дисциплина.
export interface Discipline {
    /** Автоматически назначаемый идентификатор. */
    id: number
    /** Название учебной дисциплины, до 100 символов. */
    name: string
    /** Объём дисциплины в учебных часах, от 1 до 10000. */
    hours: number
}

export type DisciplineData = Omit<Discipline, 'id'>
