// ЛР8: cookie содержит случайный токен; в БД хранится только его SHA-256.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SecurityStore, UserDAO } from './dao'
import type { Session } from './entity'

export const SESSION_COOKIE = 'lab8_session'
export const SESSION_SECONDS = 8 * 60 * 60
const token = () => randomBytes(32).toString('hex')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

interface SessionRow {
    tokenHash: string
    userId: number | null
    csrfToken: string
    expiresAt: number
}

export class SessionService {
    constructor(private readonly store: SecurityStore, private readonly users: UserDAO) {}

    find(value: unknown): Session | null {
        if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return null
        const row = this.store.database.query<SessionRow, [string]>(
            'SELECT token_hash AS tokenHash, user_id AS userId, csrf_token AS csrfToken, expires_at AS expiresAt FROM sessions WHERE token_hash = ?',
        ).get(hash(value))
        if (!row) return null
        const user = row.userId === null ? null : this.users.findById(row.userId)
        if (row.expiresAt <= Date.now() || (row.userId !== null && !user)) {
            this.destroy(row.tokenHash)
            return null
        }
        return { tokenHash: row.tokenHash, csrfToken: row.csrfToken, expiresAt: row.expiresAt, user }
    }

    create(userId: number | null = null, previous?: Session): { token: string, session: Session } {
        const value = token()
        const row = { tokenHash: hash(value), csrfToken: token(), expiresAt: Date.now() + SESSION_SECONDS * 1000 }
        const db = this.store.database
        db.transaction(() => {
            db.query('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
            if (previous) this.destroy(previous.tokenHash)
            db.query('INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
                .run(row.tokenHash, userId, row.csrfToken, row.expiresAt)
        })()
        return { token: value, session: { ...row, user: userId === null ? null : this.users.findById(userId) } }
    }

    destroy(tokenHash: string): void {
        this.store.database.query('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    }
}

export const validCsrf = (value: unknown, session: Session): boolean => typeof value === 'string'
    && /^[a-f0-9]{64}$/.test(value)
    && timingSafeEqual(Buffer.from(value), Buffer.from(session.csrfToken))
