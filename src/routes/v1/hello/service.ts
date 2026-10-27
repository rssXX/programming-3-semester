import { status } from 'elysia'

import type { HelloModel } from './model'

export abstract class Hello {
    static hello({ name }: typeof HelloModel.static) {
        return status(200, `Hello ${name}!`)
    }
}
