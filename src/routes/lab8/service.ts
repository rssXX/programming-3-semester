// ЛР8: хеширование паролей и поиск пользователя по email.
import type { RegistrationDTO, User } from './entity'
import type { UserDAO } from './dao'

export class DuplicateEmailError extends Error {}
let dummyHash: Promise<string> | undefined

export class UserService {
    constructor(private readonly dao: UserDAO) {}

    async register(data: RegistrationDTO): Promise<User> {
        const email = data.email.trim().toLowerCase()
        if (this.dao.findByEmail(email)) throw new DuplicateEmailError('На этот email уже зарегистрирована учётная запись')
        const passwordHash = await Bun.password.hash(data.password, 'argon2id')
        try {
            return this.dao.create({ firstName: data.firstName.trim(), lastName: data.lastName.trim(), email }, passwordHash)
        } catch (error) {
            // UNIQUE в БД защищает и от одновременной регистрации одного email.
            if (this.dao.findByEmail(email)) throw new DuplicateEmailError('На этот email уже зарегистрирована учётная запись')
            throw error
        }
    }

    async authenticate(email: string, password: string): Promise<User | null> {
        const user = this.dao.findByEmail(email.trim().toLowerCase())
        // Для неизвестного email тоже выполняется проверка хеша.
        const hash = user?.passwordHash ?? await (dummyHash ??= Bun.password.hash('Not-an-account-password-8', 'argon2id'))
        const matches = await Bun.password.verify(password, hash)
        if (!user || !matches) return null
        const { passwordHash: _passwordHash, ...profile } = user
        return profile
    }

    findAll(): User[] { return this.dao.findAll() }
}
