
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const dbPath = path.join(__dirname, 'database', 'clinic.db');

// Создаем папку для базы данных, если её нет
if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'));
}

// Подключаемся к базе данных
const db = new sqlite3.Database(dbPath);

// Создаем таблицы
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS doctors (
            doctor_id INTEGER PRIMARY KEY,
            full_name TEXT NOT NULL,
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
            patient_code TEXT NOT NULL,
            slot_datetime TEXT NOT NULL,
            status TEXT CHECK(status IN ('booked', 'cancelled', 'served')) DEFAULT 'booked',
            FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        )
    `);
    
    console.log('✅ Таблицы созданы или уже существуют');
});

app.use(express.json());
app.use(express.static('public'));
//app.use((req, res, next) => {
 //   res.header('Access-Control-Allow-Origin', '*');
//    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//    res.header('Access-Control-Allow-Headers', 'Content-Type');
 //   next();
//});

// =============================================
// 1. ИМПОРТ ИЗ CSV - самые простые функции
// =============================================

// Функция для импорта врачей из CSV
function importDoctorsFromCSV(filePath, callback) {
    const doctors = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            doctors.push({
                doctor_id: parseInt(row.doctor_id),
                full_name: row.full_name,
                specialty: row.specialty
            });
        })
        .on('end', () => {
            // Очищаем таблицу и вставляем новые данные
            db.serialize(() => {
                db.run('DELETE FROM doctors');
                
                const stmt = db.prepare('INSERT INTO doctors (doctor_id, full_name, specialty) VALUES (?, ?, ?)');
                doctors.forEach(d => {
                    stmt.run(d.doctor_id, d.full_name, d.specialty);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано врачей: ${doctors.length}`);
                if (callback) callback(null, doctors);
            });
        })
        .on('error', (err) => {
            console.error('❌ Ошибка чтения CSV:', err);
            if (callback) callback(err);
        });
}

// Функция для импорта слотов из CSV
function importSlotsFromCSV(filePath, callback) {
    const slots = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            slots.push({
                slot_id: parseInt(row.slot_id),
                doctor_id: parseInt(row.doctor_id),
                work_date: row.work_date,
                start_time: row.start_time,
                end_time: row.end_time,
                slot_duration_minutes: parseInt(row.slot_duration_minutes),
                break_start: row.break_start || null,
                break_end: row.break_end || null
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM work_slots');
                
                const stmt = db.prepare(`
                    INSERT INTO work_slots 
                    (slot_id, doctor_id, work_date, start_time, end_time, slot_duration_minutes, break_start, break_end) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                slots.forEach(s => {
                    stmt.run(s.slot_id, s.doctor_id, s.work_date, s.start_time, s.end_time, 
                             s.slot_duration_minutes, s.break_start, s.break_end);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано слотов: ${slots.length}`);
                if (callback) callback(null, slots);
            });
        });
}

// Функция для импорта записей из CSV
function importAppointmentsFromCSV(filePath, callback) {
    const appointments = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            appointments.push({
                appointment_id: parseInt(row.appointment_id),
                doctor_id: parseInt(row.doctor_id),
                patient_code: row.patient_code,
                slot_datetime: row.slot_datetime,
                status: row.status
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM appointments');
                
                const stmt = db.prepare(`
                    INSERT INTO appointments (appointment_id, doctor_id, patient_code, slot_datetime, status) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                appointments.forEach(a => {
                    stmt.run(a.appointment_id, a.doctor_id, a.patient_code, a.slot_datetime, a.status);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано записей: ${appointments.length}`);
                if (callback) callback(null, appointments);
            });
        });
}

// =============================================
// 2. API ЭНДПОИНТЫ
// =============================================

// GET /doctors - список всех врачей
app.get('/doctors', (req, res) => {
    db.all('SELECT doctor_id, full_name, specialty FROM doctors', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// GET /slots - слоты врача на дату
app.get('/slots', (req, res) => {
    const { doctorId, date } = req.query;
    
    if (!doctorId || !date) {
        return res.status(400).json({ error: 'Нужен doctorId и date' });
    }
    
    // Получаем все ЗАНЯТЫЕ слоты на эту дату
    db.all(`
        SELECT time(slot_datetime) as time 
        FROM appointments 
        WHERE doctor_id = ? AND date(slot_datetime) = ? AND status = 'booked'
    `, [doctorId, date], (err, booked) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Создаем массив занятых времен
        const bookedTimes = booked.map(b => b.time);
        
        // Генерируем слоты (упрощенно: с 9 до 17 каждый час)
        const slots = [];
        for (let hour = 9; hour < 17; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            slots.push({
                slotId: slots.length + 1,
                time: timeStr,
                isAvailable: !bookedTimes.includes(timeStr)
            });
        }
        
        res.json(slots);
    });
});

// POST /appointments - создать запись
app.post('/appointments', (req, res) => {
    const { doctorId, slotDateTime, patientCode } = req.body;
    
    if (!doctorId || !slotDateTime || !patientCode) {
        return res.status(400).json({ error: 'Нужны все поля' });
    }
    
    // Проверяем, свободен ли слот
    db.get(`
        SELECT appointment_id FROM appointments 
        WHERE doctor_id = ? AND slot_datetime = ? AND status = 'booked'
    `, [doctorId, slotDateTime], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            return res.status(409).json({ error: 'Слот уже занят' });
        }
        
        // Создаем запись
        db.run(`
            INSERT INTO appointments (doctor_id, patient_code, slot_datetime, status) 
            VALUES (?, ?, ?, 'booked')
        `, [doctorId, patientCode, slotDateTime], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.status(201).json({
                appointmentId: this.lastID,
                doctorId,
                patientCode,
                slotDateTime,
                status: 'booked'
            });
        });
    });
});

// PUT /appointments/:id/cancel - отменить запись
app.put('/appointments/:id/cancel', (req, res) => {
    const id = req.params.id;
    
    db.run(`
        UPDATE appointments 
        SET status = 'cancelled' 
        WHERE appointment_id = ? AND status = 'booked'
    `, [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        res.json({ message: 'Запись отменена' });
    });
});

// GET /report/utilization - отчет по утилизации
app.get('/report/utilization', (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Нужны startDate и endDate' });
    }
    
    db.all(`
        SELECT 
            d.doctor_id,
            d.full_name,
            d.specialty,
            COUNT(DISTINCT ws.slot_id) as total_slots,
            COUNT(a.appointment_id) as booked_slots
        FROM doctors d
        LEFT JOIN work_slots ws ON d.doctor_id = ws.doctor_id 
            AND ws.work_date BETWEEN ? AND ?
        LEFT JOIN appointments a ON d.doctor_id = a.doctor_id 
            AND date(a.slot_datetime) = ws.work_date 
            AND a.status = 'booked'
        GROUP BY d.doctor_id
    `, [startDate, endDate], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Добавляем процент утилизации
        rows.forEach(r => {
            r.utilization = r.total_slots > 0 
                ? Math.round((r.booked_slots / r.total_slots) * 100) 
                : 0;
        });
        
        // Итоговая утилизация по всем
        const totalSlots = rows.reduce((sum, r) => sum + r.total_slots, 0);
        const totalBooked = rows.reduce((sum, r) => sum + r.booked_slots, 0);
        const totalUtilization = totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 100) : 0;
        
        res.json({
            doctors: rows,
            summary: {
                totalSlots,
                totalBooked,
                totalUtilization
            }
        });
    });
});

// =============================================
// 3. ЭНДПОИНТ ДЛЯ ИМПОРТА CSV (админка)
// =============================================

// POST /import - загрузить все CSV
app.post('/import', (req, res) => {
    const { doctorsPath, slotsPath, appointmentsPath } = req.body;
    
    // Используем пути по умолчанию, если не указаны
    const docsPath = doctorsPath || path.join(__dirname, 'data', 'doctors.csv');
    const slsPath = slotsPath || path.join(__dirname, 'data', 'work_slots.csv');
    const appsPath = appointmentsPath || path.join(__dirname, 'data', 'appointments.csv');
    
    // Проверяем, существуют ли файлы
    if (!fs.existsSync(docsPath)) {
        return res.status(400).json({ error: `Файл не найден: ${docsPath}` });
    }
    
    // Импортируем последовательно
    importDoctorsFromCSV(docsPath, (err) => {
        if (err) {
            res.status(500).json({ error: 'Ошибка импорта врачей' });
            return;
        }
        
        importSlotsFromCSV(slsPath, (err) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка импорта слотов' });
                return;
            }
            
            importAppointmentsFromCSV(appsPath, (err) => {
                if (err) {
                    res.status(500).json({ error: 'Ошибка импорта записей' });
                    return;
                }
                
                res.json({ message: '✅ Все данные успешно импортированы' });
            });
        });
    });
});

// =============================================
// ЗАПУСК СЕРВЕРА
// =============================================

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log('📌 Доступные эндпоинты:');
    console.log('   GET  /doctors');
    console.log('   GET  /slots?doctorId=1&date=2025-05-20');
    console.log('   POST /appointments');
    console.log('   PUT  /appointments/:id/cancel');
    console.log('   GET  /report/utilization?startDate=2025-05-01&endDate=2025-05-31');
    console.log('   POST /import - загрузить данные из CSV\n');
});