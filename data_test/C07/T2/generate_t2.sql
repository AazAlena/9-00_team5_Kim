-- =====================================================
-- T2 Data Generation for Case 7 (Doctor's Schedule)
-- SEED: 2025 (фиксированный для воспроизводимости)
-- Database: SQLite
-- =====================================================

-- Включаем фиксированный SEED для random()
SELECT RANDOMSEED(2025);

-- =====================================================
-- 1. Вспомогательные таблицы для генерации
-- =====================================================

-- Список специальностей
DROP TABLE IF EXISTS temp_specialties;
CREATE TEMP TABLE temp_specialties (name TEXT);
INSERT INTO temp_specialties VALUES 
    ('Терапевт'), ('Хирург'), ('Дерматолог'), 
    ('Окулист'), ('ЛОР'), ('Невролог'), ('Кардиолог');

-- Список имён
DROP TABLE IF EXISTS temp_first_names;
CREATE TEMP TABLE temp_first_names (name TEXT);
INSERT INTO temp_first_names VALUES 
    ('Иван'), ('Петр'), ('Сидор'), ('Анна'), ('Мария'), 
    ('Елена'), ('Дмитрий'), ('Ольга'), ('Алексей'), ('Татьяна');

-- Список фамилий
DROP TABLE IF EXISTS temp_last_names;
CREATE TEMP TABLE temp_last_names (name TEXT);
INSERT INTO temp_last_names VALUES 
    ('Иванов'), ('Петров'), ('Сидоров'), ('Кузнецова'), ('Смирнова'),
    ('Волков'), ('Морозова'), ('Новиков'), ('Федорова'), ('Васильев');

-- Список отчеств
DROP TABLE IF EXISTS temp_middle_names;
CREATE TEMP TABLE temp_middle_names (name TEXT);
INSERT INTO temp_middle_names VALUES 
    ('Ивановна'), ('Петрович'), ('Сергеевна'), ('Андреевна'), ('Владимирович');

-- Статусы записей
DROP TABLE IF EXISTS temp_statuses;
CREATE TEMP TABLE temp_statuses (status TEXT, weight INTEGER);
INSERT INTO temp_statuses VALUES 
    ('booked', 60),   -- 60%
    ('served', 30),   -- 30%
    ('canceled', 10); -- 10%

-- Причины отмены
DROP TABLE IF EXISTS temp_cancel_reasons;
CREATE TEMP TABLE temp_cancel_reasons (reason TEXT);
INSERT INTO temp_cancel_reasons VALUES 
    ('Передумал(а)'), ('Не пришел(ла)'), ('Ошибка записи'), ('Перенос');

-- =====================================================
-- 2. Генерация speciality.csv (доктор → специальность)
-- =====================================================

DROP TABLE IF EXISTS temp_doctor_specialty;
CREATE TEMP TABLE temp_doctor_specialty AS
SELECT 
    'doc_' || printf('%03d', doctor_num) AS id,
    (SELECT name FROM temp_specialties 
     ORDER BY RANDOM() LIMIT 1) AS specialty
FROM (
    WITH RECURSIVE cnt(doctor_num) AS (
        SELECT 1 UNION ALL SELECT doctor_num + 1 FROM cnt WHERE doctor_num < 40
    ) SELECT doctor_num FROM cnt
);

-- Экспорт в CSV
.headers on
.mode csv
.output ./data/C07/T2/speciality.csv
SELECT * FROM temp_doctor_specialty ORDER BY id;

-- =====================================================
-- 3. Генерация user.csv (40 врачей + 180 пациентов + 5 админов)
-- =====================================================

DROP TABLE IF EXISTS temp_users;
CREATE TEMP TABLE temp_users (id TEXT, fio TEXT, email TEXT, password TEXT, role TEXT);

-- Врачи (40 человек)
INSERT INTO temp_users
SELECT 
    'doc_' || printf('%03d', doctor_num) AS id,
    (SELECT name FROM temp_last_names ORDER BY RANDOM() LIMIT 1) || ' ' ||
    (SELECT name FROM temp_first_names ORDER BY RANDOM() LIMIT 1) || ' ' ||
    (SELECT name FROM temp_middle_names ORDER BY RANDOM() LIMIT 1) AS fio,
    'doc_' || printf('%03d', doctor_num) || '@clinic.com' AS email,
    'pass_doctor' AS password,
    'doctor' AS role
FROM (
    WITH RECURSIVE cnt(doctor_num) AS (
        SELECT 1 UNION ALL SELECT doctor_num + 1 FROM cnt WHERE doctor_num < 40
    ) SELECT doctor_num FROM cnt
);

-- Пациенты (180 человек)
INSERT INTO temp_users
SELECT 
    'pat_' || printf('%04d', patient_num) AS id,
    (SELECT name FROM temp_last_names ORDER BY RANDOM() LIMIT 1) || ' ' ||
    (SELECT name FROM temp_first_names ORDER BY RANDOM() LIMIT 1) AS fio,
    'pat_' || printf('%04d', patient_num) || '@mail.com' AS email,
    'pass_patient' AS password,
    'patient' AS role
FROM (
    WITH RECURSIVE cnt(patient_num) AS (
        SELECT 1 UNION ALL SELECT patient_num + 1 FROM cnt WHERE patient_num < 180
    ) SELECT patient_num FROM cnt
);

-- Админы (5 человек)
INSERT INTO temp_users
SELECT 
    'adm_' || printf('%04d', abmin_num) AS id,
    (SELECT name FROM temp_last_names ORDER BY RANDOM() LIMIT 1) || ' ' ||
    (SELECT name FROM temp_first_names ORDER BY RANDOM() LIMIT 1) AS fio,
    'abm_' || printf('%03d', admin_num) || '@mail.com' AS email,
    'pass_admin' AS password,
    'admin' AS role
FROM (
    WITH RECURSIVE cnt(admin_num) AS (
        SELECT 1 UNION ALL SELECT amdin_num + 1 FROM cnt WHERE admin_num < 6
    ) SELECT admin_num FROM cnt
);

-- Экспорт в CSV
.output ./data/C07/T2/user.csv
SELECT * FROM temp_users ORDER BY id;

-- =====================================================
-- 4. Генерация work_slot.csv (расписание на 30 дней)
-- =====================================================

DROP TABLE IF EXISTS temp_work_slots;
CREATE TEMP TABLE temp_work_slots (
    id TEXT, date TEXT, start_time TEXT, end_time TEXT, 
    slot_minutes INTEGER, break_start TEXT, break_end TEXT
);

-- Генерируем для каждого врача и каждого дня
WITH RECURSIVE 
    dates(date_num) AS (
        SELECT 0 UNION ALL SELECT date_num + 1 FROM dates WHERE date_num < 30
    ),
    hours_config AS (
        SELECT 
            doctor_id,
            -- start_time: 8:00, 9:00 или 10:00
            printf('%02d:00:00', 8 + (ABS(RANDOM()) % 3)) AS start_hour,
            -- end_time: start + 8..10 часов
            (8 + (ABS(RANDOM()) % 3)) AS work_hours,
            -- slot_minutes: 15, 20, 30 или 60
            (CASE (ABS(RANDOM()) % 4)
                WHEN 0 THEN 15 WHEN 1 THEN 20 WHEN 2 THEN 30 ELSE 60
            END) AS slot_minutes,
            -- break: 30 или 60 минут
            (CASE (ABS(RANDOM()) % 2) WHEN 0 THEN 30 ELSE 60 END) AS break_len
        FROM (SELECT DISTINCT id AS doctor_id FROM temp_doctor_specialty)
    )
INSERT INTO temp_work_slots
SELECT 
    doctor_id || '_' || date_num AS id,
    date('2024-10-21', '+' || date_num || ' days') AS date,
    start_hour AS start_time,
    printf('%02d:00:00', CAST(SUBSTR(start_hour, 1, 2) AS INTEGER) + work_hours) AS end_time,
    slot_minutes,
    -- break_start: примерно в середине дня
    printf('%02d:00:00', CAST(SUBSTR(start_hour, 1, 2) AS INTEGER) + (work_hours / 2)) AS break_start,
    printf('%02d:00:00', CAST(SUBSTR(start_hour, 1, 2) AS INTEGER) + (work_hours / 2) + (break_len / 60)) AS break_end
FROM hours_config, dates
WHERE break_start < end_time AND break_end <= end_time;

-- Экспорт в CSV
.output ./data/C07/T2/work_slot.csv
SELECT * FROM temp_work_slots ORDER BY id;

-- =====================================================
-- 5. Генерация appointment.csv (записи на приём)
-- =====================================================

DROP TABLE IF EXISTS temp_appointments;
CREATE TEMP TABLE temp_appointments (
    appt_id TEXT, doctor_id TEXT, patient_code TEXT, 
    slot_datetime TEXT, status TEXT
);

-- Для каждого work_slot генерируем 1-3 записи
INSERT INTO temp_appointments
SELECT 
    'appt_' || printf('%06d', ROW_NUMBER) AS appt_id,
    ws.doctor_id,
    (SELECT id FROM temp_users WHERE role = 'patient' ORDER BY RANDOM() LIMIT 1) AS patient_code,
    -- slot_datetime: date + start_time + смещение (0, slot_minutes, 2*slot_minutes...)
    ws.date || ' ' || 
    printf('%02d:00:00', 
        CAST(SUBSTR(ws.start_time, 1, 2) AS INTEGER) + 
        ((ABS(RANDOM()) % (SELECT CAST((JULIANDAY(ws.end_time) - JULIANDAY(ws.start_time)) * 24 * 60 / ws.slot_minutes AS INTEGER))) * ws.slot_minutes / 60)
    ) AS slot_datetime,
    (SELECT status FROM temp_statuses 
     WHERE weight >= (ABS(RANDOM()) % 100) 
     ORDER BY weight LIMIT 1) AS status
FROM temp_work_slots ws
CROSS JOIN (
    -- Каждый work_slot даёт от 1 до 3 записей
    WITH RECURSIVE slots(slot_num) AS (
        SELECT 1 UNION ALL SELECT slot_num + 1 FROM slots WHERE slot_num < (1 + (ABS(RANDOM()) % 3))
    ) SELECT * FROM slots
)
WHERE ROW_NUMBER IN (SELECT ROW_NUMBER FROM (
    SELECT ROW_NUMBER() OVER () AS ROW_NUMBER 
    FROM temp_work_slots, slots LIMIT 2000
));

-- Ограничиваем объём до 2000 записей
DELETE FROM temp_appointments WHERE ROWID > 2000;

-- Экспорт в CSV
.output ./data/C07/T2/appointment.csv
SELECT * FROM temp_appointments ORDER BY appt_id;

-- =====================================================
-- 6. Генерация canceled_appointment.csv (отменённые записи)
-- =====================================================

DROP TABLE IF EXISTS temp_canceled;
CREATE TEMP TABLE temp_canceled AS
SELECT 
    appt_id,
    (SELECT reason FROM temp_cancel_reasons ORDER BY RANDOM() LIMIT 1) AS why_canceled
FROM temp_appointments
WHERE status = 'canceled'
LIMIT 300;

-- Экспорт в CSV
.output ./data/C07/T2/canceled_appointment.csv
SELECT * FROM temp_canceled ORDER BY appt_id;

-- =====================================================
-- 7. Вывод статистики
-- =====================================================

.output stdout
.print '=========================================='
.print 'T2 Data Generation Complete!'
.print '=========================================='
.print ''
.print 'Statistics:'
SELECT 'speciality.csv: ' || COUNT(*) || ' rows' FROM temp_doctor_specialty
UNION ALL
SELECT 'user.csv (doctors): ' || COUNT(*) || ' rows' FROM temp_users WHERE role = 'doctor'
UNION ALL
SELECT 'user.csv (patients): ' || COUNT(*) || ' rows' FROM temp_users WHERE role = 'patient'
UNION ALL
SELECT 'work_slot.csv: ' || COUNT(*) || ' rows' FROM temp_work_slots
UNION ALL
SELECT 'appointment.csv: ' || COUNT(*) || ' rows' FROM temp_appointments
UNION ALL
SELECT 'canceled_appointment.csv: ' || COUNT(*) || ' rows' FROM temp_canceled;

.print ''
.print 'Files saved to: ./data/C07/T2/'
.print '=========================================='