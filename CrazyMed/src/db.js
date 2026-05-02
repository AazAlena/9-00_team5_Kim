const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к базе данных (из корня проекта)
const dbPath = path.join(__dirname, '..', 'database', 'clinic.db');
const db = new sqlite3.Database(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

// Создаем таблицы
db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS user (
            id TEXT PRIMARY KEY,
            fio TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('patient', 'doctor', 'admin'))
        )
    `)
    
    db.run(`
        CREATE TABLE IF NOT EXISTS work_slot (
            id TEXT NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            slots_minutes INTEGER NOT NULL,
            break_start TEXT,
            break_end TEXT,
            FOREIGN KEY (id) REFERENCES user(id)
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS appointment (
            appt_id INTEGER PRIMARY KEY,
            doctor_id TEXT NOT NULL,
            patient_code TEXT NOT NULL,
            slot_datetime TEXT NOT NULL,
            status TEXT CHECK(status IN ('booked', 'cancelled', 'completed')) DEFAULT 'booked',
            FOREIGN KEY (doctor_id) REFERENCES user(id)
            FOREIGN KEY (patient_code) REFERENCES user(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS cancelled_appointment (
            appt_id INTEGER,
            why_cancelled TEXT NOT NULL,
            FOREIGN KEY (appt_id) REFERENCES appointment(appt_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS speciality (
            id TEXT,
            speciality TEXT NOT NULL,
            FOREIGN KEY (id) REFERENCES user(id)
        )
    `);

    /*db.run(`
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            patient_full_name TEXT NOT NULL,
            patient_mail TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES appointments(patient_id)
        )
    `);*/

    /*db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            admin_id TEXT PRIMARY KEY,
            admin_full_name TEXT NOT NULL,
            admin_mail TEXT UNIQUE NOT NULL,
            admin_password TEXT NOT NULL
        )
    `);*/
    
    console.log('✅ Таблицы созданы или уже существуют');
});
//created_at DATETIME DEFAULT CURRENT_TIMESTAMP
module.exports = db;