// ЛР7: дополнительная сущность «Учебная группа».
// Связь со студентами в задании не требуется: состав students из ЛР6 сохранён.
export interface StudyGroup {
    id: number
    /** Обозначение группы, до 30 символов. */
    name: string
    /** Факультет, до 20 символов. */
    faculty: string
    /** Курс обучения, от 1 до 6. */
    course: number
}

export type StudyGroupData = Omit<StudyGroup, 'id'>
