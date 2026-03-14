const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к базе данных (из корня проекта)
const dbPath = path.join(__dirname, '..', 'database', 'clinic.db');
const db = new sqlite3.Database(dbPath);

// Создаем таблицы
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS doctors (
            doctor_id INTEGER PRIMARY KEY,
            doctor_full_name TEXT NOT NULL,
            specialty TEXT NOT NULL
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS work_slots (
            slot_id INTEGER PRIMARY KEY,
            doctor_id INTEGER NOT NULL,
            work_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            slot_duration_minutes INTEGER NOT NULL,
            break_start TEXT,
            break_end TEXT,
            FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
            appointment_id INTEGER PRIMARY KEY,
            doctor_id INTEGER NOT NULL,
            patient_id TEXT NOT NULL,
            slot_datetime TEXT NOT NULL,
            status TEXT CHECK(status IN ('booked', 'cancelled', 'served')) DEFAULT 'booked',
            FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS cancelled_appointments (
            appointment_id INTEGER PRIMARY KEY,
            why_cancelled TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            patient_full_name TEXT NOT NULL,
            patient_mail TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Таблицы созданы или уже существуют');
});

module.exports = db;