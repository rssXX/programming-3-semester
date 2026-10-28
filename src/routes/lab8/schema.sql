-- ЛР8: пользователи, роли, связь many-to-many и серверные сессии.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 50),
    last_name TEXT NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 50),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
    password_hash TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
) STRICT;

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL CHECK (length(csrf_token) = 64),
    expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

-- Как в UserServiceImpl из методички, регистрация назначает ROLE_ADMIN.
INSERT OR IGNORE INTO roles (name) VALUES ('ROLE_ADMIN');
