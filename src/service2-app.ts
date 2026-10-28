// ЛР4: Сервис 2 принимает запрос и отвечает по тем же правилам ЛР2–3, без пересылки.
import { Elysia } from 'elysia'
import { openapi } from '@elysia/openapi'
import { consola } from 'consola'
import { createService2Feedback } from './routes/v3'

export const createService2App = (logger = consola.withTag('Service 2 / LR4')) => new Elysia()
    .use(openapi())
    .group('/api/v3', group => group.use(createService2Feedback(logger)))
