const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');

// Импорт пользователей
function importUsers(filePath, callback) {
    const users = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            users.push({
                id: row.id,
                fio: row.fio,
                email: row.email,
                password: row.password,
                role: row.role
            });
        })

        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM user');
                
                const stmt = db.prepare('INSERT INTO user (id, fio, email, password, role) VALUES (?, ?, ?, ?, ?)');
                users.forEach(u => {
                    stmt.run(u.id, u.fio, u.email, u.password, u.role);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано пользователей: ${users.length}`);
                if (callback) callback(null, users);
            });
        })
        .on('error', (err) => {
            console.error('❌ Ошибка чтения CSV:', err);
            if (callback) callback(err);
        });
}

// Импорт слотов
function importWorkSlots(filePath, callback) {
    const slots = [];
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            slots.push({
                id: row.id,                     
                date: row.date,
                start_time: row.start_time,
                end_time: row.end_time,
                slots_minutes: row.slots_minutes,
                break_start: row.break_start,
                break_end: row.break_end
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM work_slot');
                const stmt = db.prepare(`
                    INSERT INTO work_slot (id, date, start_time, end_time, slots_minutes, break_start, break_end) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                slots.forEach(ws => {
                    stmt.run(ws.id, ws.date, ws.start_time, ws.end_time, ws.slots_minutes, ws.break_start, ws.break_end);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано рабочих слотов: ${slots.length}`);
                if (callback) callback(null, slots);
            });
        });
}

// Импорт отмененных записей
function importCancelledAppointments(filePath, callback) {
    const cancelled_appointments = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            cancelled_appointments.push({
                appt_id: parseInt(row.appt_id),
                why_cancelled: row.why_cancelled
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM cancelled_appointment');
                
                const stmt = db.prepare(`
                    INSERT INTO cancelled_appointment (appt_id, why_cancelled) 
                    VALUES (?, ?)
                `);
                
                cancelled_appointments.forEach(a => {
                    stmt.run(a.appt_id, a.why_cancelled);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано отмененных записей: ${cancelled_appointments.length}`);
                if (callback) callback(null, cancelled_appointments);
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
                appt_id: parseInt(row.appt_id),
                doctor_id: row.doctor_id,
                patient_code: row.patient_code,
                slot_datetime: row.slot_datetime,
                status: row.status
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM appointment');
                
                const stmt = db.prepare(`
                    INSERT INTO appointment (appt_id, doctor_id, patient_code, slot_datetime, status) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                appointments.forEach(a => {
                    stmt.run(a.appt_id, a.doctor_id, a.patient_code, a.slot_datetime, a.status);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано записей: ${appointments.length}`);
                if (callback) callback(null, appointments);
            });
        });
}



//импорт специаьности
function importSpeciality(filePath, callback) {
    const speciality = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            speciality.push({
                id: row.id,
                speciality: row.speciality
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM speciality');
                
                const stmt = db.prepare(
                    'INSERT INTO speciality (id, speciality) VALUES (?, ?)'
                );
                
                speciality.forEach(s => {
                    stmt.run(s.id, s.speciality);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано специальностей: ${speciality.length}`);
                callback(null, speciality);
            });
        })
        .on('error', callback);
}
/*
// Импорт admins
function importAdmins(filePath, callback) {
    const admins = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            admins.push({
                admin_id: row.admin_id,
                admin_full_name: row.admin_full_name,
                admin_mail: row.admin_mail,
                admin_password: row.admin_password
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('DELETE FROM admins');
                
                const stmt = db.prepare('INSERT INTO admins (admin_id, admin_full_name, admin_mail, admin_password) VALUES (?, ?, ?, ?)');
                admins.forEach(a => {
                    stmt.run(a.admin_id, a.admin_full_name, a.admin_mail, a.admin_password);
                });
                stmt.finalize();
                
                console.log(`✅ Импортировано админов: ${admins.length}`);
                if (callback) callback(null, admins);
            });
        })
        .on('error', (err) => {
            console.error('❌ Ошибка чтения CSV:', err);
            if (callback) callback(err);
        });
}*/

module.exports = {
    importUsers,
    importWorkSlots,
    importCancelledAppointments,
    importAppointments,
    importSpeciality
};