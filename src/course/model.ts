// Курсовая, вариант 5: животные и расходы на содержание. Деньги — целые копейки.
export interface Animal {
    id: number
    ownerId: number
    name: string
    species: string
    age: number
}
export interface Expense {
    id: number
    ownerId: number
    animalId: number
    category: string
    amountCents: number
    expenseDate: string
    description: string
    animalName: string
}
export type AnimalData = Pick<Animal, 'name' | 'species' | 'age'>
export type ExpenseData = Pick<Expense, 'animalId' | 'category' | 'amountCents' | 'expenseDate' | 'description'>

export const categories: Record<string, string> = { FOOD: 'Корм', VET: 'Ветеринар', CARE: 'Уход', OTHER: 'Прочее' }
export const money = (cents: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(cents / 100)

export const parseMoney = (value: string): number | null => {
    if (!/^\d{1,8}([.,]\d{1,2})?$/.test(value.trim())) return null
    const [whole, fraction = ''] = value.trim().replace(',', '.').split('.')
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
    return cents >= 1 && cents <= 1_000_000_000 ? cents : null
}
export const validDate = (value: string) => /^(19\d{2}|[2-9]\d{3})-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value
export const validMonth = (value: string) => /^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(value)
