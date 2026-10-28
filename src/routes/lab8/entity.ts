// ЛР8: DTO отделён от хранимых учётных данных.
export interface User {
    id: number
    firstName: string
    lastName: string
    email: string
    roles: string[]
}

export interface RegistrationDTO {
    firstName: string
    lastName: string
    email: string
    password: string
}

export interface UserCredentials extends User {
    passwordHash: string
}

export interface Session {
    tokenHash: string
    csrfToken: string
    expiresAt: number
    user: User | null
}
