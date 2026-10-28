// ЛР6: обе сущности используют одну файловую базу данных.
import { Elysia } from 'elysia'
import { consola } from 'consola'
import type { ApplicationDatabase } from '../../database'
import { createStudents } from './students'
import { createDisciplines } from './disciplines'

export const createDatabaseRoutes = (connection: ApplicationDatabase, logger = consola.withTag('Service 1 / LR6')) => new Elysia()
    .use(createStudents(connection, logger))
    .use(createDisciplines(connection, logger))
