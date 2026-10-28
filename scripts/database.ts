// ЛР6: создание таблиц и отдельное, явно запрашиваемое заполнение демонстрационными данными.
import { ApplicationDatabase } from '../src/database'

const command = process.argv[2]
if (command !== 'init' && command !== 'seed') throw new Error('Использование: bun run db:init или bun run db:seed')

const connection = new ApplicationDatabase()
try {
    const db = connection.database
    if (command === 'seed') connection.seed()
    console.log(`Database: ${connection.filename}`)
    console.log('Students:', db.query<{ count: number }, []>('SELECT count(*) AS count FROM students').get()!.count)
    console.log('Disciplines:', db.query<{ count: number }, []>('SELECT count(*) AS count FROM disciplines').get()!.count)
    // ЛР7: учебные группы используют ту же файловую БД.
    console.log('Study groups:', db.query<{ count: number }, []>('SELECT count(*) AS count FROM study_groups').get()!.count)
} finally {
    connection.close()
}
