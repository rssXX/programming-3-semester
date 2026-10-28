// ЛР8: SQL аутентификации выполняется только в отдельной БД этого этапа.
import { readFileSync } from 'node:fs'
import type { Database } from 'bun:sqlite'
import type { ApplicationDatabase } from '../../database'
import type { RegistrationDTO, User, UserCredentials } from './entity'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
type UserRow = Omit<User, 'roles'>

export class SecurityStore {
    private initialized?: Database

    constructor(private readonly connection: ApplicationDatabase) {}

    get database(): Database {
        const db = this.connection.database
        if (this.initialized !== db) {
            db.transaction(() => { db.exec(schema) })()
            this.initialized = db
        }
        return db
    }
}

export class UserDAO {
    constructor(private readonly store: SecurityStore) {}

    findById(id: number): User | null {
        const row = this.store.database.query<UserRow, [number]>(
            'SELECT id, first_name AS firstName, last_name AS lastName, email FROM users WHERE id = ?',
        ).get(id)
        return row ? this.withRoles(row) : null
    }

    findByEmail(email: string): UserCredentials | null {
        const row = this.store.database.query<UserRow & { passwordHash: string }, [string]>(
            'SELECT id, first_name AS firstName, last_name AS lastName, email, password_hash AS passwordHash FROM users WHERE email = ?',
        ).get(email)
        return row ? { ...this.withRoles(row), passwordHash: row.passwordHash } : null
    }

    findAll(): User[] {
        return this.store.database.query<UserRow, []>(
            'SELECT id, first_name AS firstName, last_name AS lastName, email FROM users ORDER BY id',
        ).all().map(row => this.withRoles(row))
    }

    create(data: Omit<RegistrationDTO, 'password'>, passwordHash: string): User {
        const db = this.store.database
        return db.transaction(() => {
            const result = db.query<{ id: number }, [string, string, string, string]>(
                'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?) RETURNING id',
            ).get(data.firstName, data.lastName, data.email, passwordHash)!
            db.query("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'ROLE_ADMIN'").run(result.id)
            return this.findById(result.id)!
        })()
    }

    private withRoles(row: UserRow): User {
        const roles = this.store.database.query<{ name: string }, [number]>(
            'SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.name',
        ).all(row.id).map(role => role.name)
        // Явный DTO: хеш никогда не попадает в сессию или список пользователей.
        return { id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email, roles }
    }
}
