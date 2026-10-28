-- Курсовая, вариант 5: животные и стоимость содержания, отдельно от лабораторных.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 50),
    last_name TEXT NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 50),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    username TEXT GENERATED ALWAYS AS (email) VIRTUAL,
    password_hash TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE) STRICT;
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
CREATE INDEX IF NOT EXISTS course_sessions_expiry ON sessions(expires_at);
INSERT OR IGNORE INTO roles (name) VALUES ('READ_ONLY'), ('USER'), ('ADMIN');

CREATE TABLE IF NOT EXISTS animals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    species TEXT NOT NULL CHECK (length(trim(species)) BETWEEN 1 AND 50),
    age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 100)
) STRICT;
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK (category IN ('FOOD', 'VET', 'CARE', 'OTHER')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 1000000000),
    expense_date TEXT NOT NULL CHECK (length(expense_date) = 10),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200)
) STRICT;
CREATE INDEX IF NOT EXISTS animal_owner ON animals(owner_id);
CREATE INDEX IF NOT EXISTS course_owner ON expenses(owner_id);
CREATE INDEX IF NOT EXISTS course_animal ON expenses(animal_id);

CREATE TABLE IF NOT EXISTS user_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_actions TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS action_user ON user_actions(user_id, id);
