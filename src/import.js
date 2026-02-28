const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');

// Импорт врачей
function importDoctors(filePath, callback) {
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

// Импорт слотов
function importSlots(filePath, callback) {
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

// Импорт записей
function importAppointments(filePath, callback) {
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

module.exports = {
    importDoctors,
    importSlots,
    importAppointments
};