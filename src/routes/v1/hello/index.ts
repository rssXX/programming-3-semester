import { Elysia } from 'elysia'

import { Hello } from './service'
import { HelloModel } from './model'

export const hello = new Elysia({ prefix: '/hello' })
	.get(
		'',
		({ query }) => {
			return Hello.hello(query)
		}, {
            query: HelloModel,
		}
	)
