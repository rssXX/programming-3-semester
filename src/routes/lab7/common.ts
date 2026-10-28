// ЛР7: обработка обычных HTML-форм и безопасная выдача страниц.
import { consola } from 'consola'
import { ResourceNotFoundError } from '../v5/common'
import { layout, escapeHtml } from './views/layout'

export type FormValues = Record<string, string>
export type FormErrors = Record<string, string>

export const html = (body: string, status = 200) => new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
})

export class FormValidationError extends Error {}

export const readId = (value: unknown): number => {
    if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
        throw new FormValidationError('Идентификатор должен быть положительным целым числом')
    }
    return Number(value)
}

export class FormInput {
    readonly values: FormValues = {}
    readonly errors: FormErrors = {}

    constructor(body: unknown) {
        if (body && typeof body === 'object' && !Array.isArray(body)) {
            for (const [key, value] of Object.entries(body)) {
                if (typeof value === 'string') this.values[key] = value
                else this.errors[key] = 'Поле должно содержать одно строковое значение'
            }
        }
    }

    text(name: string, label: string, maxLength: number): string {
        const value = (this.values[name] ?? '').trim()
        if (!value || [...value].length > maxLength) this.errors[name] = `${label}: от 1 до ${maxLength} символов`
        return value
    }

    integer(name: string, label: string, min: number, max: number): number {
        const value = (this.values[name] ?? '').trim()
        const number = Number(value)
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
            this.errors[name] = `${label}: целое число от ${min} до ${max}`
        }
        return number
    }

    optionalId(): number | undefined {
        if (!this.values.id) return undefined
        try { return readId(this.values.id) }
        catch { this.errors.id = 'Некорректный идентификатор записи'; return undefined }
    }

    get invalid(): boolean { return Object.keys(this.errors).length > 0 }
}

export const pageError = (code: string | number, error: unknown, logger = consola) => {
    const status = error instanceof ResourceNotFoundError ? 404
        : error instanceof FormValidationError || code === 'VALIDATION' || code === 'PARSE' ? 400 : 500
    const message = status === 500 ? 'Не удалось выполнить операцию с базой данных. Попробуйте позже.'
        : error instanceof ResourceNotFoundError || error instanceof FormValidationError ? error.message : 'Некорректные данные запроса'
    logger.error('LR7 page request failed:', error instanceof Error ? error.message : error)
    return html(layout(`Ошибка ${status}`, `<section class="card"><h1>Ошибка ${status}</h1><p role="alert">${escapeHtml(message)}</p><a href="/list">К списку студентов</a> · <a href="/groups">К списку групп</a></section>`), status)
}
