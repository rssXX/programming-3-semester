// ЛР6: сущность соответствует строке таблицы students.
export interface Student {
    /** Автоматически назначаемый идентификатор. */
    id: number
    /** Имя студента, до 15 символов. */
    name: string
    /** Фамилия студента, до 25 символов. */
    surname: string
    /** Факультет, до 20 символов. */
    faculty: string
    /** Возраст в полных годах. */
    age: number
}

export type StudentData = Omit<Student, 'id'>
