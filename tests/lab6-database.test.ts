// ЛР6: сохранность данных на диске, схема и отдельное заполнение демонстрационными данными.
import { describe, expect, test } from 'bun:test'
import { createConsola } from 'consola'
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApplicationDatabase } from '../src/database'
import { createApp } from '../src/app'
import { SqliteStudentDAO } from '../src/routes/v5/students/dao'
import { SqliteDisciplineDAO } from '../src/routes/v5/disciplines/dao'

const student = { name: 'Иван', surname: 'Иванов', faculty: 'ИТ', age: 25 }
const logger = createConsola({ reporters: [] })

describe('ЛР6: база данных', () => {
    test('не создаёт файл до первого обращения к БД', () => {
        const directory = mkdtempSync(join(tmpdir(), 'programming-3-lab6-lazy-'))
        const filename = join(directory, 'students.sqlite')
        const connection = new ApplicationDatabase(filename)
        try {
            expect(existsSync(filename)).toBe(false)
            connection.close()
            expect(existsSync(filename)).toBe(false)
        } finally {
            connection.close()
            rmdirSync(directory)
        }
    })

    test('seed заполняет обе таблицы и не дублирует данные при повторном вызове', () => {
        const connection = new ApplicationDatabase(':memory:')
        try {
            connection.seed()
            connection.seed()
            const students = new SqliteStudentDAO(connection).findAll()
            const disciplines = new SqliteDisciplineDAO(connection).findAll()
            expect(students).toHaveLength(2)
            expect(disciplines).toHaveLength(2)
            expect(students[0]).toMatchObject(student)
            expect(disciplines[0]).toMatchObject({ name: 'Технологии программирования', hours: 144 })
        } finally {
            connection.close()
        }
    })

    test('две таблицы независимы и имеют собственные идентификаторы', () => {
        const connection = new ApplicationDatabase(':memory:')
        try {
            const students = new SqliteStudentDAO(connection)
            const disciplines = new SqliteDisciplineDAO(connection)
            const first = students.create(student)
            const second = disciplines.create({ name: 'Базы данных', hours: 108 })
            expect(first.id).toBe(1)
            expect(second.id).toBe(1)
            students.delete(first.id)
            expect(students.findAll()).toEqual([])
            expect(disciplines.findById(second.id)).toEqual(second)
        } finally {
            connection.close()
        }
    })

    test('ограничения БД действуют и при обходе HTTP-валидации', () => {
        const connection = new ApplicationDatabase(':memory:')
        try {
            const dao = new SqliteStudentDAO(connection)
            expect(() => dao.create({ ...student, name: 'a'.repeat(16) })).toThrow()
            expect(() => dao.create({ ...student, age: -1 })).toThrow()
            expect(dao.findAll()).toEqual([])
        } finally {
            connection.close()
        }
    })

    test('данные обеих таблиц сохраняются после перезапуска HTTP-приложения', async () => {
        const directory = mkdtempSync(join(tmpdir(), 'programming-3-lab6-persistence-'))
        const filename = join(directory, 'students.sqlite')
        let app = createApp({ databasePath: filename, logger }).listen({ port: 0, hostname: '127.0.0.1' })
        try {
            let base = `http://127.0.0.1:${app.server!.port}/api/v5`
            for (const [resource, body] of [['students', student], ['disciplines', { name: 'Базы данных', hours: 108 }]] as const) {
                const response = await fetch(`${base}/${resource}`, {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
                })
                expect(response.status).toBe(201)
            }
            await app.stop()
            expect(existsSync(filename)).toBe(true)

            app = createApp({ databasePath: filename, logger }).listen({ port: 0, hostname: '127.0.0.1' })
            base = `http://127.0.0.1:${app.server!.port}/api/v5`
            expect((await (await fetch(`${base}/students/1`)).json()).data).toMatchObject(student)
            expect((await (await fetch(`${base}/disciplines/1`)).json()).data).toEqual({ id: 1, name: 'Базы данных', hours: 108 })
        } finally {
            await app.stop()
            unlinkSync(filename)
            rmdirSync(directory)
        }
    })
})
