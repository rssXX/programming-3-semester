// ЛР7: параметризованные SQL-запросы учебных групп.
import type { ApplicationDatabase } from '../../../database'
import type { StudyGroup, StudyGroupData } from './entity'

export interface StudyGroupDAO {
    findAll(): StudyGroup[]
    findById(id: number): StudyGroup | null
    create(group: StudyGroupData): StudyGroup
    update(group: StudyGroup): StudyGroup | null
    delete(id: number): boolean
}

export class SqliteStudyGroupDAO implements StudyGroupDAO {
    constructor(private readonly connection: ApplicationDatabase) {}

    findAll(): StudyGroup[] {
        return this.connection.database.query<StudyGroup, []>('SELECT id, name, faculty, course FROM study_groups ORDER BY id').all()
    }

    findById(id: number): StudyGroup | null {
        return this.connection.database.query<StudyGroup, [number]>('SELECT id, name, faculty, course FROM study_groups WHERE id = ?').get(id)
    }

    create(group: StudyGroupData): StudyGroup {
        return this.connection.database.query<StudyGroup, [string, string, number]>(
            'INSERT INTO study_groups (name, faculty, course) VALUES (?, ?, ?) RETURNING id, name, faculty, course',
        ).get(group.name, group.faculty, group.course)!
    }

    update(group: StudyGroup): StudyGroup | null {
        return this.connection.database.query<StudyGroup, [string, string, number, number]>(
            'UPDATE study_groups SET name = ?, faculty = ?, course = ? WHERE id = ? RETURNING id, name, faculty, course',
        ).get(group.name, group.faculty, group.course, group.id)
    }

    delete(id: number): boolean {
        return this.connection.database.query('DELETE FROM study_groups WHERE id = ?').run(id).changes === 1
    }
}
