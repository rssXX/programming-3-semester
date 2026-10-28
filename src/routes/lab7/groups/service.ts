// ЛР7: сервис групп не зависит от HTTP и HTML.
import { ResourceNotFoundError } from '../../v5/common'
import type { StudyGroupDAO } from './dao'
import type { StudyGroup, StudyGroupData } from './entity'

export class StudyGroupService {
    constructor(private readonly dao: StudyGroupDAO) {}

    findAll(): StudyGroup[] {
        return this.dao.findAll()
    }

    findById(id: number): StudyGroup {
        const group = this.dao.findById(id)
        if (!group) throw new ResourceNotFoundError(`Учебная группа с id=${id} не найдена`)
        return group
    }

    create(group: StudyGroupData): StudyGroup {
        return this.dao.create(this.normalize(group))
    }

    update(group: StudyGroup): StudyGroup {
        const result = this.dao.update({ ...this.normalize(group), id: group.id })
        if (!result) throw new ResourceNotFoundError(`Учебная группа с id=${group.id} не найдена`)
        return result
    }

    delete(id: number): void {
        if (!this.dao.delete(id)) throw new ResourceNotFoundError(`Учебная группа с id=${id} не найдена`)
    }

    private normalize(group: StudyGroupData): StudyGroupData {
        return { name: group.name.trim(), faculty: group.faculty.trim(), course: group.course }
    }
}
