// Курсовая: отдельная схема и файл. Учебные аккаунты автоматически не создаются.
import { readFileSync } from 'node:fs'
import { ApplicationDatabase } from '../database'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
export const createCourseDatabase = (filename = process.env.COURSE_DATABASE_PATH ?? 'testdb/course.sqlite') =>
    new ApplicationDatabase(filename, { schema, seed: '' })
