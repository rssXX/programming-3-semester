-- ЛР6: файловая SQLite вместо H2 из Java-примера.
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 15),
    surname TEXT NOT NULL CHECK (length(trim(surname)) BETWEEN 1 AND 25),
    faculty TEXT NOT NULL CHECK (length(trim(faculty)) BETWEEN 1 AND 20),
    age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 150)
) STRICT;

-- Поля второй таблицы в методичке не заданы: приняты название и число учебных часов.
CREATE TABLE IF NOT EXISTS disciplines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    hours INTEGER NOT NULL CHECK (hours BETWEEN 1 AND 10000)
) STRICT;

-- ЛР7: учебные группы. Поля дополнительной сущности выбраны в рамках работы.
CREATE TABLE IF NOT EXISTS study_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 30),
    faculty TEXT NOT NULL CHECK (length(trim(faculty)) BETWEEN 1 AND 20),
    course INTEGER NOT NULL CHECK (course BETWEEN 1 AND 6)
) STRICT;
