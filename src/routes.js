const path = require('path');
const fs = require('fs');
const db = require('./db');
const importFunctions = require('./import');
const validation = require('./validation');
const { validateAll } = require('../data/validate');
const CURRENT_DATE = new Date();
module.exports = function (app) {

    //

    // ========== 1. ВСЕ ВРАЧИ (без фильтра по специальности) ==========
    app.get('/doctors/all', (req, res) => {
        db.all(`
            SELECT id, fio, email
            FROM user
            WHERE role = 'doctor'
            ORDER BY fio
        `, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ doctors: rows });
        });
    });

    // ========== АГРЕГИРОВАННАЯ СТАТИСТИКА ПО ВРАЧАМ ЗА ПЕРИОД ==========
    app.get('/api/doctors/report', async (req, res) => {
        const { from, to, speciality, doctorId } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: 'Параметры from и to обязательны' });
        }

        // 1. Получаем список врачей с учётом фильтров
        let doctorsQuery = `
            SELECT u.id, u.fio, s.speciality
            FROM user u
            LEFT JOIN speciality s ON u.id = s.id
            WHERE u.role = 'doctor'
        `;
        const params = [];
        if (speciality && speciality !== 'Все') {
            doctorsQuery += ` AND s.speciality = ?`;
            params.push(speciality);
        }
        if (doctorId) {
            doctorsQuery += ` AND u.id = ?`;
            params.push(doctorId);
        }
        doctorsQuery += ` ORDER BY u.fio`;

        const doctors = await new Promise((resolve, reject) => {
            db.all(doctorsQuery, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const result = [];
        const toMinutes = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        for (const doc of doctors) {
            // 2. Слоты за период
            const workDays = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT start_time, end_time, slots_minutes, break_start, break_end
                    FROM work_slot
                    WHERE id = ? AND date BETWEEN ? AND ?
                `, [doc.id, from, to], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            let totalSlots = 0;
            for (const day of workDays) {
                const start = toMinutes(day.start_time);
                const end = toMinutes(day.end_time);
                const step = day.slots_minutes;
                let workMinutes = end - start;
                if (day.break_start && day.break_end) {
                    workMinutes -= (toMinutes(day.break_end) - toMinutes(day.break_start));
                }
                totalSlots += Math.floor(workMinutes / step);
            }

            // 3. Статистика по записям (правильные поля)
            const stats = await new Promise((resolve, reject) => {
    db.get(`
        SELECT 
            COALESCE(COUNT(*), 0) as all_bookings,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN a.status = 'canceled' AND (c.why_canceled IS NULL OR c.why_canceled NOT LIKE 'Перенос:%') THEN 1 ELSE 0 END), 0) as cancels,
            COALESCE(SUM(CASE WHEN a.status = 'canceled' AND c.why_canceled LIKE 'Перенос:%' THEN 1 ELSE 0 END), 0) as reschedules
        FROM appointment a
        LEFT JOIN canceled_appointment c ON a.appt_id = c.appt_id
        WHERE a.doctor_id = ? AND a.slot_datetime BETWEEN ? AND ?
        `, [doc.id, `${from} 00:00:00`, `${to} 23:59:59`], (err, row) => {
            if (err) reject(err);
            else resolve(row);
                });
            });
        // Принудительная страховка от null
        stats.all_bookings = stats.all_bookings || 0;
        stats.completed = stats.completed || 0;
        stats.cancels = stats.cancels || 0;
        stats.reschedules = stats.reschedules || 0;

            result.push({
                doctorId: doc.id,
                fio: doc.fio,
                speciality: doc.speciality || 'Не указана',
                totalSlots: totalSlots,
                totalBookingsAll: stats.all_bookings,   // все записи
                totalCancels: stats.cancels,
                totalReschedules: stats.reschedules,
                totalCompleted: stats.completed
            });
        }

        res.json({ from, to, doctors: result });
    });

    // ========== 3. ДЕТАЛЬНАЯ СТАТИСТИКА ПО ВРАЧУ (с комментариями) ==========
    // GET /api/doctor/details?doctorId=D1&from=2026-05-01&to=2026-05-31
    app.get('/api/doctor/details', async (req, res) => {
        const { doctorId, from, to } = req.query;
        if (!doctorId || !from || !to) {
            return res.status(400).json({ error: 'doctorId, from, to обязательны' });
        }

        // Получаем ФИО врача и его специальность
        const doctorInfo = await new Promise((resolve, reject) => {
            db.get(`
                SELECT u.id, u.fio, s.speciality
                FROM user u
                LEFT JOIN speciality s ON u.id = s.id
                WHERE u.id = ? AND u.role = 'doctor'
            `, [doctorId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (!doctorInfo) {
            return res.status(404).json({ error: 'Врач не найден' });
        }

        // 1. Общее количество слотов за период (аналогично предыдущему)
        const workDays = await new Promise((resolve, reject) => {
            db.all(`
                SELECT start_time, end_time, slots_minutes, break_start, break_end
                FROM work_slot
                WHERE id = ? AND date BETWEEN ? AND ?
            `, [doctorId, from, to], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        const toMinutes = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        let totalSlots = 0;
        for (const day of workDays) {
            const start = toMinutes(day.start_time);
            const end = toMinutes(day.end_time);
            const step = day.slots_minutes;
            let workMinutes = end - start;
            if (day.break_start && day.break_end) {
                workMinutes -= (toMinutes(day.break_end) - toMinutes(day.break_start));
            }
            totalSlots += Math.floor(workMinutes / step);
        }

        // 2. Общие цифры по записям
        const totals = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN a.status = 'canceled' AND (c.why_canceled IS NULL OR c.why_canceled NOT LIKE 'Перенос:%') THEN 1 END) as cancels,
                    COUNT(CASE WHEN a.status = 'canceled' AND c.why_canceled LIKE 'Перенос:%' THEN 1 END) as reschedules
                FROM appointment a
                LEFT JOIN canceled_appointment c ON a.appt_id = c.appt_id
                WHERE a.doctor_id = ? AND a.slot_datetime BETWEEN ? AND ?
            `, [doctorId, `${from} 00:00:00`, `${to} 23:59:59`], (err, row) => {
                if (err) reject(err);
                else resolve(row || { completed: 0, cancels: 0, reschedules: 0 });
            });
        });

        // 3. Список отмен (с комментариями и ФИО пациента)
        const cancellations = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    a.slot_datetime,
                    p.fio as patient_fio,
                    c.why_canceled as reason
                FROM appointment a
                JOIN user p ON a.patient_code = p.id
                JOIN canceled_appointment c ON a.appt_id = c.appt_id
                WHERE a.doctor_id = ? 
                AND a.status = 'canceled'
                AND (c.why_canceled IS NULL OR c.why_canceled NOT LIKE 'Перенос:%')
                AND a.slot_datetime BETWEEN ? AND ?
                ORDER BY a.slot_datetime
            `, [doctorId, `${from} 00:00:00`, `${to} 23:59:59`], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 4. Список переносов (с комментариями и ФИО пациента)
        const reschedules = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    a.slot_datetime,
                    p.fio as patient_fio,
                    c.why_canceled as reason
                FROM appointment a
                JOIN user p ON a.patient_code = p.id
                JOIN canceled_appointment c ON a.appt_id = c.appt_id
                WHERE a.doctor_id = ? 
                AND a.status = 'canceled'
                AND c.why_canceled LIKE 'Перенос:%'
                AND a.slot_datetime BETWEEN ? AND ?
                ORDER BY a.slot_datetime
            `, [doctorId, `${from} 00:00:00`, `${to} 23:59:59`], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            doctor: {
                id: doctorInfo.id,
                fio: doctorInfo.fio,
                speciality: doctorInfo.speciality || 'Не указана'
            },
            period: { from, to },
            totalSlots,
            totalBookings: totals.completed,
            totalCancels: totals.cancels,
            totalReschedules: totals.reschedules,
            totalCompleted: totals.completed,
            cancellations: cancellations.map(c => ({
                datetime: c.slot_datetime,
                patientFio: c.patient_fio,
                reason: c.reason
            })),
            reschedules: reschedules.map(r => ({
                datetime: r.slot_datetime,
                patientFio: r.patient_fio,
                reason: r.reason
            }))
        });
    });

    //

    //1)запрос на получение списка специальностей
    //на странице со специальностями:
    //получить все специальности
    app.get('/speciality', (req, res) => {
        db.all('SELECT id, speciality FROM speciality', [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });


    //2)с фронтэнда поступают дата и специальность, нужно отдать слоты на эту дату, по этим специальностям
    //на странице с выбором времени:
    //отдаю дату и специальность, получаю слоты на эту дату, по этим специальностям
    // GET /slots?date=2025-05-20&speciality=1
    app.get('/slots', (req, res) => {
        const { date, speciality } = req.query;
        if (!date || !speciality) {
            return res.status(400).json({ error: 'Нужны date и speciality' });
        }
        const dateValidation = validation.validateDate(date);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.message });
        }

        // 1. Получаем всех врачей этой специальности с их расписанием на этот день
        db.all(`
        SELECT 
            u.id as doctor_id,
            u.fio as doctor_name,
            ws.start_time,
            ws.end_time,
            ws.slots_minutes,
            ws.break_start,
            ws.break_end,
            ws.date as slot_date
        FROM user u
        JOIN speciality s ON u.id = s.id
        JOIN work_slot ws ON u.id = ws.id
        WHERE u.role = 'doctor' 
            AND s.speciality = ?
            AND ws.date = ?
        ORDER BY u.fio, ws.start_time
    `, [speciality, date], (err, doctors) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (doctors.length === 0) {
                return res.json([]);
            }

            // 2. Получаем все занятые слоты (booked) для этих врачей на эту дату
            const doctorIds = doctors.map(d => d.doctor_id);
            const placeholders = doctorIds.map(() => '?').join(',');

            db.all(`
            SELECT doctor_id, strftime('%H:%M', slot_datetime) as time
            FROM appointment
            WHERE doctor_id IN (${placeholders}) 
                AND date(slot_datetime) = ? 
                AND status = 'booked'
        `, [...doctorIds, date], (err, bookedRows) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Создаём Set занятых слотов (ключ: doctor_id|время)
                const bookedSet = new Set();
                bookedRows.forEach(b => {
                    bookedSet.add(`${b.doctor_id}|${b.time}`);
                });

                // 3. Генерируем слоты для каждого врача
                const result = {};

                doctors.forEach(doctor => {
                    const doctorId = doctor.doctor_id;
                    if (!result[doctorId]) {
                        result[doctorId] = {
                            doctor_id: doctorId,
                            doctor_name: doctor.doctor_name,
                            slots: []
                        };
                    }

                    // Генерируем слоты на основе расписания
                    function toMinutes(timeStr) {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        return hours * 60 + minutes;
                    }

                    function toTimeStr(minutes) {
                        const hours = Math.floor(minutes / 60);
                        const mins = minutes % 60;
                        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                    }

                    const startMin = toMinutes(doctor.start_time);
                    const endMin = toMinutes(doctor.end_time);
                    const stepMinutes = doctor.slots_minutes;

                    let breakStartMin = null, breakEndMin = null;
                    if (doctor.break_start && doctor.break_end) {
                        breakStartMin = toMinutes(doctor.break_start);
                        breakEndMin = toMinutes(doctor.break_end);
                    }

                    const isDatePast = date < CURRENT_DATE;

                    for (let current = startMin; current < endMin; current += stepMinutes) {
                        if (breakStartMin !== null && current >= breakStartMin && current < breakEndMin) {
                            continue;
                        }

                        const timeStr = toTimeStr(current);
                        const isBooked = bookedSet.has(`${doctorId}|${timeStr}`);
                        const isAvailable = !isBooked && !isDatePast;

                        result[doctorId].slots.push({
                            time: timeStr,
                            available: isAvailable
                        });
                    }
                });

                res.json(Object.values(result));
            });
        });
    });


    //3)с фронтенда поступает специальность, нужно отдать всех врачей этой специальности
    //на странице с выбором врача:
    //отдаю специальность, получаю всех врачей этой специальности
    app.get('/doctors/speciality', (req, res) => {
        const { speciality } = req.query;
        if (!speciality) {
            return res.status(400).json({ error: 'Нужна специальность' });
        }
        db.all(`
            SELECT u.id, u.fio, u.email
            FROM user u
            JOIN speciality s ON u.id = s.id
            WHERE u.role = 'doctor' AND s.speciality = ?
            ORDER BY u.fio
        `, [speciality], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    //4)с фронтенда поступает конкретное время, дата, специальность, нужно отдать всех врачей, работающих в эту дату и время по этой специальности
    //на странице с выбором врача после выбора времени:
    //отдаю конкретное время, дату, специальность, получаю врачей
    // POST /doctors/speciality/data/time - ищем врачей на конкретное время
    app.post('/doctors/speciality/data/time', (req, res) => {
        const { date, time, speciality } = req.body;
        if (!date || !time || !speciality) {
            return res.status(400).json({ error: 'Нужны date, time и speciality' });
        }
        db.all(`
            SELECT 
                u.id, u.fio, u.email,
                ws.start_time, ws.end_time, ws.break_start, ws.break_end,
                (
                    SELECT COUNT(*) FROM appointment a 
                    WHERE a.doctor_id = u.id 
                    AND a.slot_datetime = ? || ' ' || ?
                    AND a.status = 'booked'
                ) as is_booked
            FROM user u
            JOIN speciality s ON u.id = s.id
            JOIN work_slot ws ON u.id = ws.id
            WHERE u.role = 'doctor' 
                AND s.speciality = ?
                AND ws.date = ?
                AND ? BETWEEN ws.start_time AND ws.end_time
                AND (ws.break_start IS NULL OR ? NOT BETWEEN ws.break_start AND ws.break_end)
            ORDER BY u.fio
        `, [date, time, speciality, date, time, time], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            const availableDoctors = rows.filter(row => row.is_booked === 0);
            res.json({
                date, time, speciality,
                count: availableDoctors.length,
                doctors: availableDoctors.map(d => ({
                    id: d.id, fio: d.fio, email: d.email,
                    work_hours: `${d.start_time} - ${d.end_time}`
                }))
            });
        });
    });

    //5)с фронтенда поступает врач, дата, нужно отдать все слоты врача на эту время и дату (занятость слота помечается false/true)
    // GET /doctor/slots?doctorId=1&date=2025-05-20
    app.get('/slots/doctors/data', (req, res) => {
        const { doctorId, date } = req.query;
        if (!doctorId || !date) {
            return res.status(400).json({ error: 'Нужны doctorId и date' });
        }
        const dateValidation = validation.validateDate(date);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.message });
        }

        db.get(`SELECT * FROM work_slot WHERE id = ? AND date = ?`, [doctorId, date], (err, workSlot) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!workSlot) {
                return res.status(404).json({ error: 'Расписание не найдено', message: `Врач ${doctorId} не работает ${date}` });
            }

            db.all(`SELECT strftime('%H:%M', slot_datetime) as time FROM appointment WHERE doctor_id = ? AND date(slot_datetime) = ? AND status = 'booked'`, [doctorId, date], (err, bookedRows) => {
                if (err) return res.status(500).json({ error: err.message });

                const bookedTimes = new Set(bookedRows.map(row => row.time));
                const slots = [];

                function toMinutes(timeStr) {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                }

                function toTimeStr(minutes) {
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                }

                const startMin = toMinutes(workSlot.start_time);
                const endMin = toMinutes(workSlot.end_time);
                const stepMinutes = workSlot.slots_minutes;

                let breakStartMin = null, breakEndMin = null;
                if (workSlot.break_start && workSlot.break_end) {
                    breakStartMin = toMinutes(workSlot.break_start);
                    breakEndMin = toMinutes(workSlot.break_end);
                }

                const isDatePast = date < CURRENT_DATE;  // ← проверка даты

                for (let current = startMin; current < endMin; current += stepMinutes) {
                    if (breakStartMin !== null && current >= breakStartMin && current < breakEndMin) {
                        continue;
                    }

                    const timeStr = toTimeStr(current);
                    const isAvailable = !bookedTimes.has(timeStr) && !isDatePast;  // ← недоступно, если дата прошла

                    slots.push({ time: timeStr, isAvailable: isAvailable });
                }

                res.json({
                    doctor: {
                        id: doctorId, date,
                        workHours: `${workSlot.start_time} - ${workSlot.end_time}`,
                        break: (workSlot.break_start && workSlot.break_end) ? `${workSlot.break_start} - ${workSlot.break_end}` : null,
                        slotDuration: `${workSlot.slots_minutes} минут`
                    },
                    slots
                });
            });
        });
    });


    //6)с фонтенда постпает айди пациента, врача, дата и время - добавить запись и ответить что все ок
    //на странице подтверждения записи:
    //я отдаю пациента, врача, дату и время
    app.post('/appointments', (req, res) => {
        const { doctorId, slotDateTime, patientCode } = req.body;
        if (!doctorId || !slotDateTime || !patientCode) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        const [datePart, timePart] = slotDateTime.split(' ');
        const currentDate = CURRENT_DATE;
        if (datePart < currentDate) {
            return res.status(400).json({ error: 'Нельзя записаться на прошедшую дату' });
        }

        const workDate = slotDateTime.split(' ')[0];
        db.get(`SELECT * FROM work_slot WHERE id = ? AND date = ?`, [doctorId, workDate], (err, workSlot) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!workSlot) return res.status(400).json({ error: 'Врач не работает в указанную дату' });
            db.get(`SELECT appt_id FROM appointment WHERE doctor_id = ? AND slot_datetime = ? AND status = 'booked'`, [doctorId, slotDateTime], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (row) return res.status(409).json({ error: 'Слот уже занят' });
                db.run(`INSERT INTO appointment (doctor_id, patient_code, slot_datetime, status) VALUES (?, ?, ?, 'booked')`, [doctorId, patientCode, slotDateTime], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ appointmentId: this.lastID, doctorId, patientCode, slotDateTime, status: 'booked' });
                });
            });
        });
    });


    //9)с фронтенда поступает пациент, дата, нужно отдать все его записи на этот день
    //на странице личного кабинета пациента:
    //отдаю пациента, дату, получаю все его записи на этот день
    // GET /patient/appointments?patientId=1&date=2025-05-20
    app.get('/patient/appointments', (req, res) => {
        const { patientId, date } = req.query;
        if (!patientId || !date) return res.status(400).json({ error: 'Нужны patientId и date' });
        db.all(`
            SELECT 
                a.appt_id, a.doctor_id, a.slot_datetime, a.status,
                d.fio as doctor_name,
                s.speciality as doctor_specialty,
                c.why_canceled
            FROM appointment a
            JOIN user d ON a.doctor_id = d.id
            LEFT JOIN speciality s ON d.id = s.id
            LEFT JOIN canceled_appointment c ON a.appt_id = c.appt_id
            WHERE a.patient_code = ? AND date(a.slot_datetime) = ?
            ORDER BY a.slot_datetime
        `, [patientId, date], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const appointments = rows.map(row => ({
                appointmentId: row.appt_id,
                doctorId: row.doctor_id,
                doctorName: row.doctor_name,
                doctorSpecialty: row.doctor_specialty,
                datetime: row.slot_datetime,
                status: row.status,
                cancelReason: row.why_canceled
            }));
            res.json({ patientId, date, count: appointments.length, appointments });
        });
    });
    //10)при отмене с фронтенда поступает айди пациента, айди врача, дата, время, комментарий - нужно поменять в бд статус записи на отмененную и добавить в canceled_appontment причину отмены этой записи
    // POST /appointments/cancel - отменить запись
    app.post('/appointments/cancel', (req, res) => {
        const { doctorId, patientCode, slotDateTime, whycanceled } = req.body;
        if (!doctorId || !patientCode || !slotDateTime || !whycanceled) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        db.get(`SELECT appt_id FROM appointment WHERE doctor_id = ? AND slot_datetime = ? AND patient_code = ? AND status = 'booked'`, [doctorId, slotDateTime, patientCode], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Запись не найдена' });
            const appt_id = row.appt_id;
            db.run(`UPDATE appointment SET status = 'canceled' WHERE appt_id = ?`, [appt_id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Запись не найдена' });
                db.run(`INSERT INTO canceled_appointment (appt_id, why_canceled) VALUES (?, ?)`, [appt_id, whycanceled], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Запись успешно отменена', appointmentId: appt_id, status: 'canceled' });
                });
            });
        });
    });
    

    ///report/doctor/daily?doctorId=${doctorId}&date=${date}
    app.get('/report/doctor/daily', (req, res) => {
        const { doctorId, date } = req.query;

        if (!doctorId || !date) {
            return res.status(400).json({ error: 'Нужны doctorId и date' });
        }

        // Проверяем существование врача
        db.get('SELECT id, fio FROM user WHERE id = ? AND role = ?', [doctorId, 'doctor'], (err, doctor) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!doctor) {
                return res.status(404).json({ error: 'Врач не найден' });
            }

            // 1. Получаем расписание врача на эту дату
            db.get(`
            SELECT * FROM work_slot 
            WHERE id = ? AND date = ?
        `, [doctorId, date], (err, workSlot) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (!workSlot) {
                    return res.status(404).json({
                        error: 'Расписание не найдено',
                        message: `Врач ${doctorId} не работает ${date}`
                    });
                }

                // 2. Считаем общее количество слотов на этот день
                function toMinutes(timeStr) {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                }

                const startMin = toMinutes(workSlot.start_time);
                const endMin = toMinutes(workSlot.end_time);
                const slotMinutes = workSlot.slots_minutes;

                let breakStartMin = null;
                let breakEndMin = null;
                if (workSlot.break_start && workSlot.break_end) {
                    breakStartMin = toMinutes(workSlot.break_start);
                    breakEndMin = toMinutes(workSlot.break_end);
                }

                let workMinutes = endMin - startMin;
                if (breakStartMin !== null && breakEndMin !== null) {
                    workMinutes -= (breakEndMin - breakStartMin);
                }

                const totalSlots = Math.floor(workMinutes / slotMinutes);

                // 3. Получаем статистику по записям
                db.get(`
                SELECT 
                    COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_count,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
                FROM appointment 
                WHERE doctor_id = ? AND date(slot_datetime) = ?
            `, [doctorId, date], (err, stats) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    const canceledCount = stats?.canceled_count || 0;
                    const completedCount = stats?.completed_count || 0;

                    const completedPercent = totalSlots > 0
                        ? Math.round((completedCount / totalSlots) * 100)
                        : 0;

                    res.json({
                        canceled_count: canceledCount,
                        completed_percent: completedPercent
                    });
                });
            });
        });
    });
   

    // POST /report/daily-stats - статистика врача за день
    app.post('/report/daily-stats', (req, res) => {
        const { doctorId, date } = req.body;

        if (!doctorId || !date) {
            return res.status(400).json({ error: 'Нужны doctorId и date' });
        }

        // Проверяем существование врача
        db.get('SELECT id FROM user WHERE id = ? AND role = ?', [doctorId, 'doctor'], (err, doctor) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!doctor) {
                return res.status(404).json({ error: 'Врач не найден' });
            }

            // 1. Получаем расписание врача на эту дату
            db.get(`
            SELECT * FROM work_slot 
            WHERE id = ? AND date = ?
        `, [doctorId, date], (err, workSlot) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (!workSlot) {
                    return res.status(404).json({
                        error: 'Расписание не найдено',
                        message: `Врач ${doctorId} не работает ${date}`
                    });
                }

                // 2. Считаем общее количество слотов
                function toMinutes(timeStr) {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                }

                const startMin = toMinutes(workSlot.start_time);
                const endMin = toMinutes(workSlot.end_time);
                const slotMinutes = workSlot.slots_minutes;

                let breakStartMin = null;
                let breakEndMin = null;
                if (workSlot.break_start && workSlot.break_end) {
                    breakStartMin = toMinutes(workSlot.break_start);
                    breakEndMin = toMinutes(workSlot.break_end);
                }

                let workMinutes = endMin - startMin;
                if (breakStartMin !== null && breakEndMin !== null) {
                    workMinutes -= (breakEndMin - breakStartMin);
                }

                const totalSlots = Math.floor(workMinutes / slotMinutes);

                // 3. Получаем статистику по записям
                db.get(`
                SELECT 
                    COUNT(CASE WHEN status = 'booked' THEN 1 END) as booked_count,
                    COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_count,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
                FROM appointment 
                WHERE doctor_id = ? AND date(slot_datetime) = ?
            `, [doctorId, date], (err, stats) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    const bookedCount = stats?.booked_count || 0;
                    const canceledCount = stats?.canceled_count || 0;
                    const completedCount = stats?.completed_count || 0;

                    const completedPercent = totalSlots > 0
                        ? Math.round((completedCount / totalSlots) * 100)
                        : 0;

                    // 4. Получаем список отмен
                    db.all(`
                    SELECT 
                        a.appt_id, 
                        p.fio as patient_fio,
                        c.why_canceled
                    FROM appointment a
                    JOIN user p ON a.patient_code = p.id
                    JOIN canceled_appointment c ON a.appt_id = c.appt_id
                    WHERE a.doctor_id = ? 
                        AND a.status = 'canceled' 
                        AND date(a.slot_datetime) = ?
                    ORDER BY a.slot_datetime
                `, [doctorId, date], (err, canceledList) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }

                        res.json({
                            total_slots: totalSlots,
                            booked_slots: completedCount, //Поменяли
                            completed_percent: completedPercent,
                            canceled_count: canceledCount,
                            canceled_list: canceledList.map(item => ({
                                appointment_id: item.appt_id,
                                patient_fio: item.patient_fio,
                                reason: item.why_canceled
                            }))
                        });
                    });
                });
            });
        });
    });

    //7)поступает фио, почту, пароль пациента (регистрироваться могут исключительно пациенты, эту роль им нужно при регистрации ставить автоматически) - нужно записать нового пациента в бд
    //на главной странице есть форма регистрации и есть просто форма регистрации:
    //отдаю фио, почту, пароль пациента (роль: пациент тоже могу если надо)
    //ПРОЛЕМА: нао решить кто генерирует айди
    app.post('/register', (req, res) => {
        const { fio, email, password } = req.body;
        if (!fio || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        db.get(`SELECT id FROM user WHERE email = ?`, [email], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
            const newId = 'P' + Date.now() + Math.floor(Math.random() * 1000);
            db.run(`INSERT INTO user (id, fio, email, password, role) VALUES (?, ?, ?, ?, 'patient')`, [newId, fio, email, password], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: '✅ Пациент зарегистрирован', patient_id: newId });
            });
        });
    });

    //8)с фронтенда поступает почта, пароль, нужно отдать роль пользователя (я отдаю не только роль, но и имя и айди) и ошибку если не найден
    // на форме входа:
    //отдаю почту, пароль, получаю роль пользователя и ошибку если не найден
    app.post('/login', (req, res) => {
        const { email, password } = req.body;
        db.get(`SELECT * FROM user WHERE email = ?`, [email], (err, user) => {
            //db.get(`SELECT * FROM user`, (err, user) => {
            console.log(user);
            if (err) return res.status(500).json({ error: err.message });
            if (!user || user.password !== password) {
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            res.json({ message: '✅ Вход выполнен', id: user.id, name: user.fio, role: user.role });
        });
    });

    // GET /doctor/appointments?doctorId=D1&date=2025-05-20
    //11)с фронтенда поступает айди врача, дата, отдать надо все записи к этому врачу на этот день
    app.get('/doctor/appointments', (req, res) => {
        const { doctorId, date } = req.query;

        if (!doctorId || !date) {
            return res.status(400).json({ error: 'Нужны doctorId и date' });
        }

        const dateValidation = validation.validateDate(date);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.message });
        }

        db.all(`
        SELECT 
            a.appt_id,
            a.patient_code,
            a.slot_datetime,
            a.status,
            p.fio as patient_name,
            c.why_canceled
        FROM appointment a
        JOIN user p ON a.patient_code = p.id
        LEFT JOIN canceled_appointment c ON a.appt_id = c.appt_id
        WHERE a.doctor_id = ? AND date(a.slot_datetime) = ?
        ORDER BY a.slot_datetime
    `, [doctorId, date], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const appointments = rows.map(row => ({
                appointmentId: row.appt_id,
                patientCode: row.patient_code,
                patientName: row.patient_name,
                datetime: row.slot_datetime,
                status: row.status,
                cancelReason: row.why_canceled || null
            }));

            res.json({
                doctorId,
                date,
                count: appointments.length,
                appointments
            });
        });
    });

    //12)с фронтенда поступает дата, отдать надо врачей, которые работают в тот день
    // GET /doctors/working?date=2025-05-20
    app.get('/doctors/working', (req, res) => {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Нужна date' });
        }

        const dateValidation = validation.validateDate(date);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.message });
        }

        db.all(`
        SELECT DISTINCT
            u.id,
            u.fio,
            u.email,
            s.speciality,
            ws.start_time,
            ws.end_time,
            ws.slots_minutes,
            ws.break_start,
            ws.break_end
        FROM user u
        JOIN work_slot ws ON u.id = ws.id
        LEFT JOIN speciality s ON u.id = s.id
        WHERE u.role = 'doctor' AND ws.date = ?
        ORDER BY u.fio
    `, [date], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const doctors = rows.map(row => ({
                id: row.id,
                fio: row.fio,
                email: row.email,
                speciality: row.speciality || 'Не указана',
                workHours: `${row.start_time} - ${row.end_time}`,
                slotDuration: `${row.slots_minutes} минут`,
                break: row.break_start && row.break_end
                    ? `${row.break_start} - ${row.break_end}`
                    : null
            }));

            res.json({
                date,
                count: doctors.length,
                doctors
            });
        });
    });

    // Получение данных пациента
    app.get('/patient/:code', (req, res) => {
        db.get(
            'SELECT patient_id, patient_full_name, patient_mail FROM patients WHERE patient_id = ?',
            [req.params.code],
            (err, patient) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                if (!patient) {
                    res.status(404).json({ error: 'Пациент не найден' });
                    return;
                }
                res.json(patient);
            }
        );
    });

    // POST /import - загрузить все CSV (отдельной кнопки дл этого нет и по расписанию это не происходит. пока просто пееходим на этот роут)
    app.post('/import', async (req, res) => {
        try {
            // 1. Получаем пути к файлам
            const { specialityPath, userPath, workSlotPath, appointmentPath, canceledAppointmentPath } = req.body;
            const specPath = specialityPath || path.join(__dirname, '..', 'data', 'speciality.csv');
            const userPathFinal = userPath || path.join(__dirname, '..', 'data', 'user.csv');
            const workSlotPathFinal = workSlotPath || path.join(__dirname, '..', 'data', 'work_slot.csv');
            const appointmentPathFinal = appointmentPath || path.join(__dirname, '..', 'data', 'appointment.csv');
            const canceledPathFinal = canceledAppointmentPath || path.join(__dirname, '..', 'data', 'canceled_appointment.csv');

            // 2. Проверяем существование файлов
            if (!fs.existsSync(specPath)) return res.status(400).json({ error: `Файл не найден: ${specPath}` });
            if (!fs.existsSync(userPathFinal)) return res.status(400).json({ error: `Файл не найден: ${userPathFinal}` });
            if (!fs.existsSync(workSlotPathFinal)) return res.status(400).json({ error: `Файл не найден: ${workSlotPathFinal}` });
            if (!fs.existsSync(appointmentPathFinal)) return res.status(400).json({ error: `Файл не найден: ${appointmentPathFinal}` });
            if (!fs.existsSync(canceledPathFinal)) return res.status(400).json({ error: `Файл не найден: ${canceledPathFinal}` });

            // 3. Валидация данных (читает из стандартных путей data/)
            console.log('🔍 Запуск валидации данных...');
            const validationResult = await validateAll();

            if (!validationResult.valid) {
                return res.status(400).json({
                    error: 'Ошибка валидации данных',
                    details: validationResult.errors
                });
            }

            console.log('✅ Данные прошли валидацию');

            // 4. Очищаем таблицы (только после всех проверок)
            db.serialize(() => {
                db.run('DELETE FROM canceled_appointment');
                db.run('DELETE FROM appointment');
                db.run('DELETE FROM work_slot');
                db.run('DELETE FROM speciality');
                db.run('DELETE FROM user');
            });

            // 5. Импорт
            importFunctions.importUsers(userPathFinal, (err) => {
                if (err) return res.status(500).json({ error: 'Ошибка импорта пользователей' });
                importFunctions.importSpeciality(specPath, (err) => {
                    if (err) return res.status(500).json({ error: 'Ошибка импорта специальностей' });
                    importFunctions.importWorkSlots(workSlotPathFinal, (err) => {
                        if (err) return res.status(500).json({ error: 'Ошибка импорта рабочих слотов' });
                        importFunctions.importAppointments(appointmentPathFinal, (err) => {
                            if (err) return res.status(500).json({ error: 'Ошибка импорта записей' });
                            importFunctions.importcanceledAppointments(canceledPathFinal, (err) => {
                                if (err) return res.status(500).json({ error: 'Ошибка импорта отменённых записей' });
                                res.json({ message: '✅ Все данные успешно импортированы' });
                            });
                        });
                    });
                });
            });

        } catch (error) {
            console.error('Ошибка импорта:', error);
            res.status(500).json({ error: error.message });
        }
    });



    function updateCompletedAppointments() {
        console.log(`\n🔄 Проверка записей (сейчас: ${new Date()})`);

        db.run(`
        UPDATE appointment 
        SET status = 'completed' 
        WHERE status = 'booked'
        AND datetime(slot_datetime) < datetime('now')
    `, function (err) {
            if (err) {
                console.error('❌ Ошибка:', err.message);
            } else if (this.changes > 0) {
                console.log(`✅ Обновлено ${this.changes} записей до 'completed'`);
            } else {
                console.log(`ℹ️ Нет записей для обновления`);
            }
        });
    }

    // Обновляем при запуске (через 1 секунду)
    setTimeout(() => {
        updateCompletedAppointments();
    }, 1000);

    // Обновляем каждую минуту
    setInterval(() => {
        console.log('\n⏰ Плановое обновление (каждую минуту)...');
        updateCompletedAppointments();
    }, 60000);
}