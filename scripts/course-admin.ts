// Курсовая: первый ADMIN назначается локально существующему аккаунту, без общего пароля.
import { createCourseDatabase } from '../src/course/database'
import { CourseService } from '../src/course/service'
import { UserDAO } from '../src/routes/lab8/dao'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) throw new Error('Использование: bun run course:admin ваш-email; сначала зарегистрируйтесь в /course/register')
const connection = createCourseDatabase()
try {
    const users = new UserDAO(connection, 'READ_ONLY')
    const user = users.findByEmail(email)
    if (!user) throw new Error('Пользователь не найден. Сначала зарегистрируйтесь в курсовом приложении.')
    connection.database.transaction(() => {
        const result = connection.database.query("INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'ADMIN'").run(user.id)
        if (result.changes) new CourseService(connection).log(user, 'role.bootstrap', 'Первое назначение ADMIN локальной командой')
    })()
    console.log(`ADMIN: ${email}`)
} finally { connection.close() }
