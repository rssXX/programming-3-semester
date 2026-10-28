// ЛР7: серверные шаблоны вместо Thymeleaf; пользовательские значения экранируются.
import type { FormErrors, FormValues } from '../common'

export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))

export const layout = (title: string, content: string) => `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ЛР7</title><link rel="stylesheet" href="/lab7/styles.css"></head>
<body><header><div class="container header"><a class="brand" href="/list">Учебный журнал <span>ЛР7</span></a>
<nav aria-label="Основная навигация"><a href="/list">Студенты</a><a href="/groups">Учебные группы</a><a href="/actuator">Мониторинг</a></nav></div></header>
<main class="container">${content}</main><footer class="container">Технологии программирования · Лабораторная работа № 7</footer></body></html>`

interface Field {
    name: string
    label: string
    type?: 'text' | 'number'
    maxLength?: number
    min?: number
    max?: number
}

export const input = (field: Field, values: FormValues, errors: FormErrors) => {
    const { name, label, type = 'text', maxLength, min, max } = field
    const error = errors[name]
    return `<div class="field"><label for="${name}">${label}</label>
<input id="${name}" name="${name}" type="${type}" value="${escapeHtml(values[name])}" required
${maxLength === undefined ? '' : `maxlength="${maxLength}"`}
${type === 'number' ? `min="${min}" max="${max}" step="1"` : ''}
${error ? `aria-invalid="true" aria-describedby="${name}-error"` : ''}>
${error ? `<p class="field-error" id="${name}-error">${escapeHtml(error)}</p>` : ''}</div>`
}

export const formNotice = (errors: FormErrors) => Object.keys(errors).length
    ? `<div class="notice error" role="alert">Проверьте введённые данные.${errors.id ? ` ${escapeHtml(errors.id)}` : ''}</div>` : ''

export const listNotice = (status: unknown) => status === 'saved' ? '<p class="notice" role="status">Изменения сохранены.</p>'
    : status === 'deleted' ? '<p class="notice" role="status">Запись удалена.</p>' : ''

export const rowActions = (id: number, editUrl: string, deleteUrl: string, idField: string) => `<div class="actions">
<a class="button secondary" href="${editUrl}">Изменить</a>
<form action="${deleteUrl}" method="post"><input type="hidden" name="${idField}" value="${id}"><button class="danger" type="submit" aria-label="Удалить запись ${id}">Удалить</button></form></div>`
