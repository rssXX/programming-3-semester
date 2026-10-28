// ЛР6: Data Access Object. SQL и работа с соединением находятся только на этом уровне.
import type { ApplicationDatabase } from '../../../database'
import type { Student, StudentData } from './entity'

export interface StudentDAO {
    findAll(): Student[]
    findById(id: number): Student | null
    create(student: StudentData): Student
    update(student: Student): Student | null
    delete(id: number): boolean
}

export class SqliteStudentDAO implements StudentDAO {
    constructor(private readonly connection: ApplicationDatabase) {}

    findAll(): Student[] {
        return this.connection.database.query<Student, []>('SELECT id, name, surname, faculty, age FROM students ORDER BY id').all()
    }

    findById(id: number): Student | null {
        return this.connection.database.query<Student, [number]>('SELECT id, name, surname, faculty, age FROM students WHERE id = ?').get(id)
    }

    create(student: StudentData): Student {
        return this.connection.database.query<Student, [string, string, string, number]>(
            'INSERT INTO students (name, surname, faculty, age) VALUES (?, ?, ?, ?) RETURNING id, name, surname, faculty, age',
        ).get(student.name, student.surname, student.faculty, student.age)!
    }

    update(student: Student): Student | null {
        return this.connection.database.query<Student, [string, string, string, number, number]>(
            'UPDATE students SET name = ?, surname = ?, faculty = ?, age = ? WHERE id = ? RETURNING id, name, surname, faculty, age',
        ).get(student.name, student.surname, student.faculty, student.age, student.id)
    }

    delete(id: number): boolean {
        return this.connection.database.query('DELETE FROM students WHERE id = ?').run(id).changes === 1
    }
}
