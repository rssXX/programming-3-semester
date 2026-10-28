// ЛР6: бизнес-логика дисциплин и проверка существования записи.
import { ResourceNotFoundError } from '../common'
import type { DisciplineDAO } from './dao'
import type { Discipline, DisciplineData } from './entity'

export interface DisciplineService {
    findAll(): Discipline[]
    findById(id: number): Discipline
    create(discipline: DisciplineData): Discipline
    update(discipline: Discipline): Discipline
    delete(id: number): { id: number }
}

export class DisciplineServiceImpl implements DisciplineService {
    constructor(private readonly dao: DisciplineDAO) {}

    findAll(): Discipline[] {
        return this.dao.findAll()
    }

    findById(id: number): Discipline {
        const discipline = this.dao.findById(id)
        if (!discipline) throw new ResourceNotFoundError(`Дисциплина с id=${id} не найдена`)
        return discipline
    }

    create(discipline: DisciplineData): Discipline {
        return this.dao.create({ name: discipline.name.trim(), hours: discipline.hours })
    }

    update(discipline: Discipline): Discipline {
        const result = this.dao.update({ ...discipline, name: discipline.name.trim() })
        if (!result) throw new ResourceNotFoundError(`Дисциплина с id=${discipline.id} не найдена`)
        return result
    }

    delete(id: number): { id: number } {
        if (!this.dao.delete(id)) throw new ResourceNotFoundError(`Дисциплина с id=${id} не найдена`)
        return { id }
    }
}
