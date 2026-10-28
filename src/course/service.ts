// Курсовая: SQL, роли и журнал собраны в одном сервисе.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ApplicationDatabase } from '../database'
import type { User } from '../routes/lab8/entity'
import { categories, validMonth, type Expense, type ExpenseData, type Animal, type AnimalData } from './model'

export class CourseError extends Error {
    constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message) }
}

export const isAdmin = (user: User) => user.roles.includes('ADMIN')
export const canWrite = (user: User) => isAdmin(user) || user.roles.includes('USER')
const ownOnly = (user: User) => !isAdmin(user) && user.roles.includes('USER')

export function requireWrite(user: User) {
    if (!canWrite(user)) throw new CourseError(403, 'Ваша роль разрешает только чтение. Для изменения данных нужна роль USER или ADMIN.')
}

export function requireAdmin(user: User) {
    if (!isAdmin(user)) throw new CourseError(403, 'Для этого действия требуется роль ADMIN.')
}

export interface UserAction {
    id: number
    dateActions: string
    userId: number | null
    username: string
    action: string
    description: string
}

export class CourseService {
    readonly logPath: string

    constructor(private readonly connection: ApplicationDatabase, logPath = process.env.COURSE_LOG_PATH ?? 'logs/course.log') {
        this.logPath = resolve(logPath)
    }

    animals(user: User): Animal[] {
        return this.connection.database.query<Animal, [number, number]>(
            'SELECT id, owner_id AS ownerId, name, species, age FROM animals WHERE (? = 0 OR owner_id = ?) ORDER BY id',
        ).all(ownOnly(user) ? 1 : 0, user.id)
    }

    animal(user: User, id: number): Animal {
        const row = this.connection.database.query<Animal, [number, number, number]>(
            'SELECT id, owner_id AS ownerId, name, species, age FROM animals WHERE id = ? AND (? = 0 OR owner_id = ?)',
        ).get(id, ownOnly(user) ? 1 : 0, user.id)
        if (!row) throw new CourseError(404, 'Животное не найдено')
        return row
    }

    expenses(user: User): Expense[] {
        return this.connection.database.query<Expense, [number, number]>(
            'SELECT c.id, c.owner_id AS ownerId, c.animal_id AS animalId, c.category, c.amount_cents AS amountCents, c.expense_date AS expenseDate, c.description, t.name AS animalName FROM expenses c JOIN animals t ON t.id = c.animal_id WHERE (? = 0 OR c.owner_id = ?) ORDER BY c.id',
        ).all(ownOnly(user) ? 1 : 0, user.id)
    }

    expense(user: User, id: number): Expense {
        const row = this.connection.database.query<Expense, [number, number, number]>(
            'SELECT c.id, c.owner_id AS ownerId, c.animal_id AS animalId, c.category, c.amount_cents AS amountCents, c.expense_date AS expenseDate, c.description, t.name AS animalName FROM expenses c JOIN animals t ON t.id = c.animal_id WHERE c.id = ? AND (? = 0 OR c.owner_id = ?)',
        ).get(id, ownOnly(user) ? 1 : 0, user.id)
        if (!row) throw new CourseError(404, 'Расход не найден')
        return row
    }

    animalsForExpense(user: User, expenseId?: number): Animal[] {
        let ownerId = user.id
        if (expenseId !== undefined) ownerId = this.expense(user, expenseId).ownerId
        const animals = this.animals(user)
        if (isAdmin(user) && ownerId === user.id) return animals
        return animals.filter(animal => animal.ownerId === ownerId)
    }

    saveAnimal(user: User, data: AnimalData, id?: number): void {
        requireWrite(user)
        const old = id === undefined ? undefined : this.animal(user, id)
        this.connection.database.transaction(() => {
            const result = old
                ? this.connection.database.query('UPDATE animals SET name = ?, species = ?, age = ? WHERE id = ?').run(data.name, data.species, data.age, old.id)
                : this.connection.database.query('INSERT INTO animals (owner_id, name, species, age) VALUES (?, ?, ?, ?)').run(user.id, data.name, data.species, data.age)
            this.log(user, old ? 'animal.update' : 'animal.create', `Животное id=${old?.id ?? result.lastInsertRowid}`)
        })()
    }

    saveExpense(user: User, data: ExpenseData, id?: number): void {
        requireWrite(user)
        const old = id === undefined ? undefined : this.expense(user, id)
        const animal = this.animal(user, data.animalId)
        // Владелец — автор записи, в том числе для расходов, добавленных ADMIN.
        const ownerId = old?.ownerId ?? user.id
        if (animal.ownerId !== ownerId && !(isAdmin(user) && ownerId === user.id)) {
            throw new CourseError(400, 'Выберите животное того же владельца, что и расход')
        }
        this.connection.database.transaction(() => {
            const result = old
                ? this.connection.database.query('UPDATE expenses SET animal_id = ?, category = ?, amount_cents = ?, expense_date = ?, description = ? WHERE id = ?').run(data.animalId, data.category, data.amountCents, data.expenseDate, data.description, old.id)
                : this.connection.database.query('INSERT INTO expenses (owner_id, animal_id, category, amount_cents, expense_date, description) VALUES (?, ?, ?, ?, ?, ?)').run(ownerId, data.animalId, data.category, data.amountCents, data.expenseDate, data.description)
            this.log(user, old ? 'expense.update' : 'expense.create', `Расход id=${old?.id ?? result.lastInsertRowid}`)
        })()
    }

    deleteAnimal(user: User, id: number): void {
        requireWrite(user)
        this.animal(user, id)
        const db = this.connection.database
        if (db.query('SELECT 1 FROM expenses WHERE animal_id = ? LIMIT 1').get(id)) throw new CourseError(409, 'Сначала удалите или переназначьте расходы этого животного')
        db.transaction(() => {
            db.query('DELETE FROM animals WHERE id = ?').run(id)
            this.log(user, 'animal.delete', `Животное id=${id}`)
        })()
    }

    deleteExpense(user: User, id: number): void {
        requireWrite(user)
        this.expense(user, id)
        this.connection.database.transaction(() => {
            this.connection.database.query('DELETE FROM expenses WHERE id = ?').run(id)
            this.log(user, 'expense.delete', `Расход id=${id}`)
        })()
    }

    costs(user: User, animalId: number, month: string) {
        if (!validMonth(month)) throw new CourseError(400, 'Выберите корректный месяц')
        const animal = this.animal(user, animalId)
        let count = 0
        let totalCents = 0
        const totals: Record<string, number> = { FOOD: 0, VET: 0, CARE: 0, OTHER: 0 }
        for (const expense of this.expenses(user)) {
            if (expense.animalId !== animalId || !expense.expenseDate.startsWith(month + '-')) continue
            count++
            totalCents += expense.amountCents
            totals[expense.category] += expense.amountCents
        }
        const [year, selectedMonth] = month.split('-').map(Number)
        const days = new Date(Date.UTC(year, selectedMonth, 0)).getUTCDate()
        const byCategory = []
        for (const category in categories) byCategory.push({ category, totalCents: totals[category] })
        const result = { animal, month, count, totalCents, days, dailyCents: Math.round(totalCents / days), byCategory }
        this.log(user, 'cost.calculate', `Животное id=${animalId}, месяц=${month}, сумма=${totalCents} коп.`)
        return result
    }

    grant(actor: User, userId: number, role: string): void {
        requireAdmin(actor)
        if (role !== 'USER' && role !== 'ADMIN') throw new CourseError(400, 'Можно добавить только USER или ADMIN')
        if (!this.connection.database.query('SELECT id FROM users WHERE id = ?').get(userId)) {
            throw new CourseError(404, 'Пользователь не найден')
        }
        this.connection.database.transaction(() => {
            const result = this.connection.database.query('INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?').run(userId, role)
            if (result.changes) this.log(actor, 'role.grant', `Пользователь id=${userId}, добавлена роль ${role}`)
        })()
    }

    log(user: User | null, action: string, description: string, username = user?.email ?? 'anonymous'): void {
        const date = new Date().toISOString()
        this.connection.database.query('INSERT INTO user_actions (date_actions, user_id, username, action, description) VALUES (?, ?, ?, ?, ?)')
            .run(date, user?.id ?? null, username, action, description)
        mkdirSync(dirname(this.logPath), { recursive: true })
        appendFileSync(this.logPath, JSON.stringify({ dateActions: date, userId: user?.id ?? null, username, action, description }) + '\n', 'utf8')
    }

    logs(user: User, before = Number.MAX_SAFE_INTEGER): UserAction[] {
        return this.connection.database.query<UserAction, [number, number, number]>(
            `SELECT id, date_actions AS dateActions, user_id AS userId, username, action, description
             FROM user_actions
             WHERE (? = 1 OR user_id = ?) AND id < ?
             ORDER BY id DESC LIMIT 100`,
        ).all(isAdmin(user) ? 1 : 0, user.id, before)
    }
}
