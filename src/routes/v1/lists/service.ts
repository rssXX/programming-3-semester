import { status } from 'elysia'

import type { ListsModel } from './model'

export abstract class Lists {
    static arrayList?: string[];
    static hashMap?: Map<number, string>;

    static updateArrayList({ s }: typeof ListsModel.static) {
        if (!this.arrayList) {
            this.arrayList = []

            return status(201)
        }

        if (!s) return status(400)

        this.arrayList.push(s)

        return status(201)
    }

    static showArrayList() {
        return this.arrayList ?? []
    }

    static updateHashMap({ s }: typeof ListsModel.static) {
        if (!this.hashMap) {
            this.hashMap = new Map()

            return status(201)
        }

        if (!s) return status(400)

        this.hashMap.set(this.hashMap.size + 1, s)

        return status(201)
    }

    static showHashMap() {
        return Array.from(this.hashMap?.values() ?? [])
    }

    static showAllLenght() {
        return {
            arrayList: this.arrayList?.length || 0,
            hashMap: this.hashMap?.size  || 0,
        }
    }
}
