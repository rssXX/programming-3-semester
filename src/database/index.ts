// ЛР6: одно лениво открываемое соединение для двух DAO; при остановке приложения закрывается.
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
const seed = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8')

export class ApplicationDatabase {
    readonly filename: string
    private connection?: Database

    // Курсовая: собственная схема при сохранении поведения ЛР6–8 по умолчанию.
    constructor(filename = process.env.DATABASE_PATH ?? 'testdb/students.sqlite', private readonly scripts = { schema, seed }) {
        this.filename = filename === ':memory:' ? filename : resolve(filename)
    }

    get database(): Database {
        if (!this.connection) {
            if (this.filename !== ':memory:') mkdirSync(dirname(this.filename), { recursive: true })
            const db = new Database(this.filename, { create: true, strict: true })
            try {
                db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
                db.transaction(() => { db.exec(this.scripts.schema) })()
                this.connection = db
            } catch (error) {
                db.close()
                throw error
            }
        }
        return this.connection
    }

    seed(): void {
        const db = this.database
        if (this.scripts.seed.trim()) db.transaction(() => { db.exec(this.scripts.seed) })()
    }

    close(): void {
        this.connection?.close()
        this.connection = undefined
    }
}
