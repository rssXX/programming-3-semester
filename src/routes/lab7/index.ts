// ЛР7: веб-приложение в общей ветке; маршруты предыдущих лабораторных сохранены.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import { readFileSync } from 'node:fs'
import type { ApplicationDatabase } from '../../database'
import { createStudentPages } from './students'
import { createGroupPages } from './groups'

const styles = readFileSync(new URL('./views/styles.css', import.meta.url), 'utf8')

export const createLab7Pages = (connection: ApplicationDatabase, logger = consola) => new Elysia()
    .get('/', ({ redirect }) => redirect('/list'), { detail: { hide: true } })
    .get('/lab7/styles.css', () => new Response(styles, { headers: { 'content-type': 'text/css; charset=utf-8' } }), { detail: { hide: true } })
    .use(createStudentPages(connection, logger))
    .use(createGroupPages(connection, logger))
