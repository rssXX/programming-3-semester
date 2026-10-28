-- ЛР6: демонстрационные данные. Повторный запуск не дублирует эти записи.
INSERT INTO students (name, surname, faculty, age)
SELECT 'Иван', 'Иванов', 'ИТ', 25
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Иван' AND surname = 'Иванов' AND faculty = 'ИТ' AND age = 25);

INSERT INTO students (name, surname, faculty, age)
SELECT 'Анна', 'Петрова', 'РТФ', 21
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Анна' AND surname = 'Петрова' AND faculty = 'РТФ' AND age = 21);

INSERT INTO disciplines (name, hours)
SELECT 'Технологии программирования', 144
WHERE NOT EXISTS (SELECT 1 FROM disciplines WHERE name = 'Технологии программирования' AND hours = 144);

INSERT INTO disciplines (name, hours)
SELECT 'Базы данных', 108
WHERE NOT EXISTS (SELECT 1 FROM disciplines WHERE name = 'Базы данных' AND hours = 108);
