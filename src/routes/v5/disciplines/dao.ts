// ЛР6: отдельный DAO для таблицы disciplines с параметризованными SQL-запросами.
import type { ApplicationDatabase } from '../../../database'
import type { Discipline, DisciplineData } from './entity'

export interface DisciplineDAO {
    findAll(): Discipline[]
    findById(id: number): Discipline | null
    create(discipline: DisciplineData): Discipline
    update(discipline: Discipline): Discipline | null
    delete(id: number): boolean
}

export class SqliteDisciplineDAO implements DisciplineDAO {
    constructor(private readonly connection: ApplicationDatabase) {}

    findAll(): Discipline[] {
        return this.connection.database.query<Discipline, []>('SELECT id, name, hours FROM disciplines ORDER BY id').all()
    }

    findById(id: number): Discipline | null {
        return this.connection.database.query<Discipline, [number]>('SELECT id, name, hours FROM disciplines WHERE id = ?').get(id)
    }

    create(discipline: DisciplineData): Discipline {
        return this.connection.database.query<Discipline, [string, number]>(
            'INSERT INTO disciplines (name, hours) VALUES (?, ?) RETURNING id, name, hours',
        ).get(discipline.name, discipline.hours)!
    }

    update(discipline: Discipline): Discipline | null {
        return this.connection.database.query<Discipline, [string, number, number]>(
            'UPDATE disciplines SET name = ?, hours = ? WHERE id = ? RETURNING id, name, hours',
        ).get(discipline.name, discipline.hours, discipline.id)
    }

    delete(id: number): boolean {
        return this.connection.database.query('DELETE FROM disciplines WHERE id = ?').run(id).changes === 1
    }
}
