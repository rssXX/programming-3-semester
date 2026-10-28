// ЛР6: сервисный слой зависит от интерфейса DAO и не содержит SQL или HTTP-статусов.
import { ResourceNotFoundError } from '../common'
import type { StudentDAO } from './dao'
import type { Student, StudentData } from './entity'

export interface StudentService {
    findAll(): Student[]
    findById(id: number): Student
    create(student: StudentData): Student
    update(student: Student): Student
    delete(id: number): { id: number }
}

export class StudentServiceImpl implements StudentService {
    constructor(private readonly dao: StudentDAO) {}

    findAll(): Student[] {
        return this.dao.findAll()
    }

    findById(id: number): Student {
        const student = this.dao.findById(id)
        if (!student) throw new ResourceNotFoundError(`Студент с id=${id} не найден`)
        return student
    }

    create(student: StudentData): Student {
        return this.dao.create(this.normalize(student))
    }

    update(student: Student): Student {
        const result = this.dao.update({ ...this.normalize(student), id: student.id })
        if (!result) throw new ResourceNotFoundError(`Студент с id=${student.id} не найден`)
        return result
    }

    delete(id: number): { id: number } {
        if (!this.dao.delete(id)) throw new ResourceNotFoundError(`Студент с id=${id} не найден`)
        return { id }
    }

    private normalize(student: StudentData): StudentData {
        return { name: student.name.trim(), surname: student.surname.trim(), faculty: student.faculty.trim(), age: student.age }
    }
}
