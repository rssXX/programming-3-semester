import { Elysia } from 'elysia'

import { Lists } from './service'
import { ListsModel } from './model'

export const lists = new Elysia({ prefix: '/lists' })
	.get(
		'/update-array',
		({ query }) => {
			return Lists.updateArrayList(query)
		}, {
            query: ListsModel,
		}
	)
	.get(
		'/show-array',
		() => {
			return Lists.showArrayList()
		}
	)
	.get(
		'/update-map',
		({ query }) => {
			return Lists.updateHashMap(query)
		}, {
            query: ListsModel,
		}
	)
	.get(
		'/show-map',
		() => {
			return Lists.showHashMap()
		}
	)
	.get(
		'/show-all-lenght',
		() => {
			return Lists.showAllLenght()
		}
	)
