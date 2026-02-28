const path = require('path');
const fs = require('fs');
const db = require('./db');
const importFunctions = require('./import');
const validation = require('./validation');

module.exports = function(app) {
    
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
    // GET /slots - слоты врача на дату (с учетом перерыва)
app.get('/slots', (req, res) => {
    const { doctorId, date } = req.query;
    
    // Валидация...
    const doctorValidation = validation.validateDoctorId(doctorId);
    const dateValidation = validation.validateDate(date);
    
    // Сначала получаем расписание врача на этот день
    db.get(`
        SELECT * FROM work_slots 
        WHERE doctor_id = ? AND work_date = ?
    `, [doctorValidation.value, dateValidation.value], (err, workSlot) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!workSlot) {
            return res.status(404).json({ 
                error: 'Расписание не найдено',
                message: `Врач ${doctorId} не работает ${date}`
            });
        }
        
        // Получаем все ЗАНЯТЫЕ слоты на эту дату
        db.all(`
            SELECT time(slot_datetime) as time 
            FROM appointments 
            WHERE doctor_id = ? AND date(slot_datetime) = ? AND status = 'booked'
        `, [doctorValidation.value, dateValidation.value], (err, booked) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const bookedTimes = booked.map(b => b.time);
            
            // Генерируем слоты с учетом расписания и перерыва
            const slots = [];
            const startHour = parseInt(workSlot.start_time.split(':')[0]);
            const endHour = parseInt(workSlot.end_time.split(':')[0]);
            const duration = workSlot.slot_duration_minutes;
            
            // Есть ли перерыв?
            const hasBreak = workSlot.break_start && workSlot.break_end;
            let breakStartHour = null;
            let breakEndHour = null;
            
            if (hasBreak) {
                breakStartHour = parseInt(workSlot.break_start.split(':')[0]);
                breakEndHour = parseInt(workSlot.break_end.split(':')[0]);
            }
            
            // Генерируем слоты
            for (let hour = startHour; hour < endHour; hour++) {
                // Проверяем, не попадает ли час на перерыв
                if (hasBreak && hour >= breakStartHour && hour < breakEndHour) {
                    continue; // Пропускаем часы перерыва
                }
                
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                slots.push({
                    slotId: slots.length + 1,
                    time: timeStr,
                    isAvailable: !bookedTimes.includes(timeStr)
                });
            }
            
            // Добавляем информацию о расписании в ответ
            res.json({
                doctor: {
                    id: doctorValidation.value,
                    date: dateValidation.value,
                    workHours: `${workSlot.start_time} - ${workSlot.end_time}`,
                    break: hasBreak ? `${workSlot.break_start} - ${workSlot.break_end}` : 'Нет перерыва',
                    slotDuration: `${duration} минут`
                },
                slots: slots
            });
        });
    });
});

    app.post('/appointments', (req, res) => {
    const { doctorId, slotDateTime, patientCode } = req.body;
    
    // Валидация всех полей
    const doctorValidation = validation.validateDoctorId(doctorId);
    const dateTimeValidation = validation.validateDateTime(slotDateTime);
    const patientValidation = validation.validatePatientCode(patientCode);
    
    const errors = [];
    if (!doctorValidation.valid) errors.push(doctorValidation.message);
    if (!dateTimeValidation.valid) errors.push(dateTimeValidation.message);
    if (!patientValidation.valid) errors.push(patientValidation.message);
    
    if (errors.length > 0) {
        return res.status(400).json({ 
            error: 'Ошибка валидации',
            details: errors 
        });
    }
    
    // Проверяем, свободен ли слот
    db.get(`
        SELECT appointment_id FROM appointments 
        WHERE doctor_id = ? AND slot_datetime = ? AND status = 'booked'
    `, [doctorValidation.value, dateTimeValidation.value], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            return res.status(409).json({ error: 'Слот уже занят' });
        }
        
        db.run(`
            INSERT INTO appointments (doctor_id, patient_code, slot_datetime, status) 
            VALUES (?, ?, ?, 'booked')
        `, [doctorValidation.value, patientValidation.value, dateTimeValidation.value], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.status(201).json({
                appointmentId: this.lastID,
                doctorId: doctorValidation.value,
                patientCode: patientValidation.value,
                slotDateTime: dateTimeValidation.value,
                status: 'booked'
            });
        });
    });
});

    // PUT /appointments/:id/cancel - отменить запись
    app.put('/appointments/:id/cancel', (req, res) => {
    const id = req.params.id;
    
    // Проверка, что ID - число
    const idNum = Number(id);
    if (isNaN(idNum) || idNum <= 0 || !Number.isInteger(idNum)) {
        return res.status(400).json({ 
            error: 'ID записи должен быть положительным целым числом' 
        });
    }
    
    db.run(`
        UPDATE appointments 
        SET status = 'cancelled' 
        WHERE appointment_id = ? AND status = 'booked'
    `, [idNum], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            // Проверяем, существует ли такая запись вообще
            db.get('SELECT status FROM appointments WHERE appointment_id = ?', [idNum], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                if (!row) {
                    return res.status(404).json({ error: 'Запись не найдена' });
                } else {
                    return res.status(400).json({ 
                        error: `Запись не может быть отменена (текущий статус: ${row.status})` 
                    });
                }
            });
            return;
        }
        
        res.json({ message: 'Запись отменена' });
    });
});s

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
            
            rows.forEach(r => {
                r.utilization = r.total_slots > 0 
                    ? Math.round((r.booked_slots / r.total_slots) * 100) 
                    : 0;
            });
            
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

    // POST /import - загрузить все CSV
    app.post('/import', (req, res) => {
        const { doctorsPath, slotsPath, appointmentsPath } = req.body;
        
        const docsPath = doctorsPath || path.join(__dirname, '..', 'data', 'doctors.csv');
        const slsPath = slotsPath || path.join(__dirname, '..', 'data', 'work_slots.csv');
        const appsPath = appointmentsPath || path.join(__dirname, '..', 'data', 'appointments.csv');
        
        if (!fs.existsSync(docsPath)) {
            return res.status(400).json({ error: `Файл не найден: ${docsPath}` });
        }
        
        importFunctions.importDoctors(docsPath, (err) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка импорта врачей' });
                return;
            }
            
            importFunctions.importSlots(slsPath, (err) => {
                if (err) {
                    res.status(500).json({ error: 'Ошибка импорта слотов' });
                    return;
                }
                
                importFunctions.importAppointments(appsPath, (err) => {
                    if (err) {
                        res.status(500).json({ error: 'Ошибка импорта записей' });
                        return;
                    }
                    
                    res.json({ message: '✅ Все данные успешно импортированы' });
                });
            });
        });
    });
};