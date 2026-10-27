import { t } from 'elysia'

export const HelloModel = t.Object({
    name: t.Optional(t.String({ default: 'Word' }))
})
