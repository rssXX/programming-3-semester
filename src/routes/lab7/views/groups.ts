// ЛР7: дополнительное задание — такие же две страницы для учебных групп.
import type { StudyGroup } from '../groups/entity'
import type { FormErrors, FormValues } from '../common'
import { escapeHtml, formNotice, input, layout, listNotice, rowActions } from './layout'

export const groupList = (groups: StudyGroup[], status?: unknown) => layout('Учебные группы', `
<div class="page-heading"><div><p class="eyebrow">Учебный журнал</p><h1>Учебные группы</h1><p>Группы, факультеты и курсы обучения.</p></div><a class="button" href="/addGroupForm">Добавить группу</a></div>
${listNotice(status)}<section class="card table-wrap"><table><caption>Всего групп: ${groups.length}</caption>
<thead><tr><th scope="col">Группа</th><th scope="col">Факультет</th><th scope="col">Курс</th><th scope="col">Действия</th></tr></thead>
<tbody>${groups.map(group => `<tr><td>${escapeHtml(group.name)}</td><td>${escapeHtml(group.faculty)}</td><td>${group.course}</td><td>${rowActions(group.id, `/showGroupUpdateForm?groupId=${group.id}`, '/deleteGroup', 'groupId')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Учебных групп пока нет. Добавьте первую группу.</td></tr>'}</tbody></table></section>`)

export const groupForm = (values: FormValues = {}, errors: FormErrors = {}) => {
    const title = values.id ? 'Редактирование группы' : 'Добавление группы'
    return layout(title, `<a class="back" href="/groups">← К списку групп</a><section class="card form-card"><h1>${title}</h1>
${formNotice(errors)}<form action="/saveGroup" method="post"><input type="hidden" name="id" value="${escapeHtml(values.id)}">
${input({ name: 'name', label: 'Название группы', maxLength: 30 }, values, errors)}
${input({ name: 'faculty', label: 'Факультет', maxLength: 20 }, values, errors)}
${input({ name: 'course', label: 'Курс', type: 'number', min: 1, max: 6 }, values, errors)}
<div class="actions"><button type="submit">Сохранить</button><a class="button secondary" href="/groups">Отмена</a></div></form></section>`)
}
