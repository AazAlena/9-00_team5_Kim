const path = require('path');
const fs = require('fs');
const db = require('./db');
const importFunctions = require('./import');
const validation = require('./validation');

module.exports = function (app) {

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

    /*// GET /doctors - список всех врачей
    app.get('/doctors', (req, res) => {
        db.all('SELECT doctor_id, doctor_full_name, specialty FROM doctors', [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });*/

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

        db.all(`
            SELECT 
                u.id as doctor_id,
                u.fio as doctor_name,
                ws.id as slot_id,
                ws.start_time,
                ws.end_time,
                ws.slots_minutes,
                ws.break_start,
                ws.break_end,
                (
                    SELECT COUNT(*) FROM appointment a 
                    WHERE a.doctor_id = u.id 
                    AND a.slot_datetime = ws.date || ' ' || ?
                    AND a.status = 'booked'
                ) as is_booked
            FROM user u
            JOIN speciality s ON u.id = s.id
            JOIN work_slot ws ON u.id = ws.id
            WHERE u.role = 'doctor' 
                AND s.speciality = ?
                AND ws.date = ?
            ORDER BY u.fio, ws.start_time
        `, [`${date} `, speciality, date], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            const result = {};
            rows.forEach(row => {
                if (!result[row.doctor_id]) {
                    result[row.doctor_id] = {
                        doctor_id: row.doctor_id,
                        doctor_name: row.doctor_name,
                        slots: []
                    };
                }
                const slots = generateSlotsForDay(
                    row.start_time, row.end_time, row.slots_minutes,
                    row.break_start, row.break_end, row.is_booked > 0
                );
                result[row.doctor_id].slots = slots;
            });
            res.json(Object.values(result));
        });
    });


    // Вспомогательная функция генерации слотов
    function generateSlotsForDay(start_time, end_time, slot_minutes, break_start, break_end, hasBooking) {
        const slots = [];
        const startHour = parseInt(start_time.split(':')[0]);
        const endHour = parseInt(end_time.split(':')[0]);
        let breakStartHour = null, breakEndHour = null;
        if (break_start && break_end) {
            breakStartHour = parseInt(break_start.split(':')[0]);
            breakEndHour = parseInt(break_end.split(':')[0]);
        }
        for (let hour = startHour; hour < endHour; hour++) {
            if (breakStartHour !== null && hour >= breakStartHour && hour < breakEndHour) continue;
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            slots.push({ time: timeStr, available: !hasBooking });
        }
        return slots;
    }

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
                const startHour = parseInt(workSlot.start_time.split(':')[0]);
                const endHour = parseInt(workSlot.end_time.split(':')[0]);
                const slotMinutes = workSlot.slots_minutes;
                const hasBreak = workSlot.break_start && workSlot.break_end;
                let breakStartHour = null, breakEndHour = null;
                if (hasBreak) {
                    breakStartHour = parseInt(workSlot.break_start.split(':')[0]);
                    breakEndHour = parseInt(workSlot.break_end.split(':')[0]);
                }
                const stepHours = slotMinutes / 60;
                for (let hour = startHour; hour < endHour; hour += stepHours) {
                    if (hasBreak && hour >= breakStartHour && hour < breakEndHour) continue;
                    const timeStr = `${Math.floor(hour).toString().padStart(2, '0')}:00`;
                    slots.push({ time: timeStr, isAvailable: !bookedTimes.has(timeStr) });
                }
                res.json({
                    doctor: {
                        id: doctorId, date,
                        workHours: `${workSlot.start_time} - ${workSlot.end_time}`,
                        break: hasBreak ? `${workSlot.break_start} - ${workSlot.break_end}` : null,
                        slotDuration: `${slotMinutes} минут`
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
        const workDate = slotDateTime.split(' ')[0];
        db.get(`SELECT * FROM work_slot WHERE id = ? AND date = ?`, [doctorId, workDate], (err, workSlot) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!workSlot) return res.status(400).json({ error: 'Врач не работает в указанную дату' });
            db.get(`SELECT appt_id FROM appointment WHERE doctor_id = ? AND slot_datetime = ? AND status = 'booked'`, [doctorId, slotDateTime], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (row) return res.status(409).json({ error: 'Слот уже занят' });
                db.run(`INSERT INTO appointment (doctor_id, patient_code, slot_datetime, status) VALUES (?, ?, ?, 'booked')`, [doctorId, patientCode, slotDateTime], function(err) {
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
                c.why_cancelled
            FROM appointment a
            JOIN user d ON a.doctor_id = d.id
            LEFT JOIN speciality s ON d.id = s.id
            LEFT JOIN cancelled_appointment c ON a.appt_id = c.appt_id
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
                cancelReason: row.why_cancelled
            }));
            res.json({ patientId, date, count: appointments.length, appointments });
        });
    });
    //10)при отмене с фронтенда поступает айди пациента, айди врача, дата, время, комментарий - нужно поменять в бд статус записи на отмененную и добавить в canceled_appontment причину отмены этой записи
    // POST /appointments/cancel - отменить запись
    app.post('/appointments/cancel', (req, res) => {
        const { doctorId, patientCode, slotDateTime, whyCancelled } = req.body;
        if (!doctorId || !patientCode || !slotDateTime || !whyCancelled) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        db.get(`SELECT appt_id FROM appointment WHERE doctor_id = ? AND slot_datetime = ? AND patient_code = ? AND status = 'booked'`, [doctorId, slotDateTime, patientCode], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Запись не найдена' });
            const appt_id = row.appt_id;
            db.run(`UPDATE appointment SET status = 'cancelled' WHERE appt_id = ?`, [appt_id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Запись не найдена' });
                db.run(`INSERT INTO cancelled_appointment (appt_id, why_cancelled) VALUES (?, ?)`, [appt_id, whyCancelled], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Запись успешно отменена', appointmentId: appt_id, status: 'cancelled' });
                });
            });
        });
    });
/*
    //10.1)перенос
    app.post('/appointments/transfer', (req, res) => {
        const { transferDoctorId, transferFromDateTime, transferToDateTime, whyCancelled, patientCode } = req.body;
        // Валидация всех полей
        const doctorValidation = validation.validateDoctorId(transferDoctorId);
        const dateFromTimeValidation = validation.validateDateTime(transferFromDateTime);
        const dateToTimeValidation = validation.validateDateTime(transferToDateTime);
        const patientValidation = validation.validatePatientCode(patientCode);
        const whyCancelledValidation = validation.validateWhyCancelled(whyCancelled);

        const errors = [];
        if (!doctorValidation.valid) errors.push(doctorValidation.message);
        if (!dateFromTimeValidation.valid) errors.push(dateFromTimeValidation.message);
        if (!dateToTimeValidation.valid) errors.push(dateToTimeValidation.message);
        if (!patientValidation.valid) errors.push(patientValidation.message);
        if (!whyCancelledValidation.valid) errors.push(whyCancelledValidation.message);

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Ошибка валидации',
                details: errors
            });
        }

        //существует ли слот для записи
        db.get(`
        SELECT * FROM work_slot
        WHERE doctor_id = ? AND work_date = ?
    `, [doctorValidation.value, dateToTimeValidation.value.split(' ')[0]], (err, workSlot) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!workSlot) {
                return res.status(400).json({ error: 'Врач не работает в указанную дату' });
            }

            // свободен ли слот для записи
            db.get(`
            SELECT appointment_id FROM appointment
            WHERE doctor_id = ? AND slot_datetime = ? AND status = 'booked'
        `, [doctorValidation.value, dateToTimeValidation.value], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (row) {
                    return res.status(409).json({ error: 'Слот уже занят' });
                }

                //получить айдишник отменяемой записи (понадобится)
                db.get(`
                SELECT appointment_id FROM appointment
                WHERE doctor_id = ? AND slot_datetime = ? AND patient_id = ? AND status = 'booked'
            `, [doctorValidation.value, dateFromTimeValidation.value, patientValidation.value], (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    if (!row) {
                        return res.status(404).json({ error: 'Запись не найдена' });
                    }

                    const cancelledAppointmentId = row.appointment_id;

                    //отменить прошлую запис
                    db.run(`
                    UPDATE appointment
                    SET status = 'cancelled' 
                    WHERE appointment_id = ?
                `, [cancelledAppointmentId], function (err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }

                        if (this.changes === 0) {
                            // Проверяем, существует ли такая запись вообще
                            db.get('SELECT status FROM appointments WHERE doctor_id = ? AND slot_datetime = ? AND patient_id = ? ',
                                [doctorValidation.value, dateFromTimeValidation.value, patientValidation.value], (err, row) => {
                                    if (err) {
                                        res.status(500).json({ error: err.message });
                                        return;
                                    }

                                    if (!row) {
                                        return res.status(404).json({ error: 'Запись не найдена или принадлежит другому пациенту' });
                                    } else {
                                        return res.status(400).json({
                                            error: `Запись не может быть отменена (текущий статус: ${row.status})`
                                        });
                                    }
                                });
                            return;
                        }

                        //добавить в список отмененных записей + причина
                        db.run(`
                        INSERT INTO cancelled_appointment (appointment_id, why_cancelled) 
                        VALUES (?,?)
                    `, [cancelledAppointmentId, whyCancelledValidation.value], function (err) {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }

                            db.run(`
                            INSERT INTO appointment (doctor_id, patient_id, slot_datetime, status) 
                            VALUES (?, ?, ?, 'booked')
                        `, [doctorValidation.value, patientValidation.value, dateToTimeValidation.value], function (err) {
                                if (err) {
                                    res.status(500).json({ error: err.message });
                                    return;
                                }

                                res.status(201).json({
                                    message: 'Запись успешно перенесена',
                                    oldAppointment: {
                                        appointmentId: cancelledAppointmentId,
                                        doctorId: doctorValidation.value,
                                        slotDateTime: dateFromTimeValidation.value,
                                        whyCancelled: whyCancelledValidation.value,
                                        status: 'cancelled'
                                    },
                                    newAppointment: {
                                        appointmentId: this.lastID,
                                        doctorId: doctorValidation.value,
                                        patientCode: patientValidation.value,
                                        slotDateTime: dateToTimeValidation.value,
                                        status: 'booked'
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
*/
/*
    // GET /report/utilization - отчет по утилизацииx
    app.get('/report/utilization', (req, res) => {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Нужны startDate и endDate' });
        }

        // 1. Получаем всех врачей
        db.all('SELECT doctor_id, doctor_full_name, specialty FROM doctors', [], (err, doctors) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            let result = [];
            let totalSlotsAll = 0;
            let totalBookedAll = 0;
            let completed = 0;

            if (doctors.length === 0) {
                return res.json({
                    doctors: [],
                    summary: { total_slots: 0, total_booked: 0, total_utilization: 0 }
                });
            }

            // Для каждого врача считаем статистику
            doctors.forEach((doctor, index) => {

                // 2. Получаем все слоты врача за период
                db.all(`
                SELECT * FROM work_slots 
                WHERE doctor_id = ? AND work_date BETWEEN ? AND ?
            `, [doctor.doctor_id, startDate, endDate], (err, workSlots) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    // Считаем общее количество слотов
                    let totalSlots = 0;
                    workSlots.forEach(slot => {
                        // Парсим время
                        const startHour = parseInt(slot.start_time.split(':')[0]);
                        const endHour = parseInt(slot.end_time.split(':')[0]);
                        const breakStartHour = slot.break_start ? parseInt(slot.break_start.split(':')[0]) : 0;
                        const breakEndHour = slot.break_end ? parseInt(slot.break_end.split(':')[0]) : 0;

                        // Часы работы = конец - начало
                        let workHours = endHour - startHour;

                        // Вычитаем перерыв
                        if (slot.break_start && slot.break_end) {
                            workHours = workHours - (breakEndHour - breakStartHour);
                        }

                        // Переводим в минуты и делим на длительность слота
                        const slotsPerDay = (workHours * 60) / slot.slot_duration_minutes;
                        totalSlots += slotsPerDay;
                    });

                    // 3. Получаем количество записей врача за период
                    db.get(`
                    SELECT COUNT(*) as count FROM appointments 
                    WHERE doctor_id = ? 
                        AND date(slot_datetime) BETWEEN ? AND ? 
                        AND status = 'booked'
                `, [doctor.doctor_id, startDate, endDate], (err, row) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        console.log(row);
                        const bookedSlots = row.count;

                        totalSlotsAll += totalSlots;
                        totalBookedAll += bookedSlots;

                        // Сохраняем результат
                        result[index] = {
                            doctor_id: doctor.doctor_id,
                            doctor_full_name: doctor.doctor_full_name,
                            specialty: doctor.specialty,
                            total_slots: Math.round(totalSlots),
                            booked_slots: bookedSlots,
                            utilization: totalSlots > 0
                                ? Math.round((bookedSlots / totalSlots) * 100)
                                : 0
                        };

                        completed++;

                        // Когда все врачи обработаны - отправляем ответ
                        if (completed === doctors.length) {
                            // Убираем пустые элементы (если были)
                            result = result.filter(r => r);

                            res.json({
                                doctors: result,
                                summary: {
                                    total_slots: totalSlotsAll,
                                    total_booked: totalBookedAll,
                                    total_utilization: totalSlotsAll > 0
                                        ? Math.round((totalBookedAll / totalSlotsAll) * 100)
                                        : 0
                                }
                            });
                        }
                    });
                });
            });
        });
    });
*/
/*
    // POST /report/cancel - причины отмены записей
    app.post('/report/cancel', (req, res) => {
        const { startDate, endDate, doctorId } = req.body;
        if (!startDate || !endDate || !doctorId) {
            return res.status(400).json({ error: 'Нужны startDate, endDate и doctorId' });
        }
        db.all(`
            SELECT a.appt_id, a.doctor_id, a.patient_code, a.slot_datetime, a.status, c.why_cancelled
            FROM appointment a
            LEFT JOIN cancelled_appointment c ON a.appt_id = c.appt_id
            WHERE a.doctor_id = ? AND a.status = 'cancelled' AND date(a.slot_datetime) BETWEEN ? AND ?
        `, [doctorId, startDate, endDate], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
*/
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
            db.run(`INSERT INTO user (id, fio, email, password, role) VALUES (?, ?, ?, ?, 'patient')`, [newId, fio, email, password], function(err) {
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

    /*
        app.get('/doctor/:code', (req, res) => {
            db.get(
                'SELECT doctor_id, doctor_full_name, doctor_mail FROM doctors WHERE doctor_id = ?',
                [req.params.code],
                (err, doctor) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    if (!doctor) {
                        res.status(404).json({ error: 'Врач не найден' });
                        return;
                    }
                    res.json(doctor);
                }
            );
        });
    */

    // POST /import - загрузить все CSV
    app.post('/import', (req, res) => {
    //на всякий случай очищаем все таблицы в безопасном порядке
    db.serialize(() => {
        db.run('DELETE FROM cancelled_appointment');
        db.run('DELETE FROM appointment');
        db.run('DELETE FROM work_slot');
        db.run('DELETE FROM speciality');
        db.run('DELETE FROM user');
    });
        const { specialityPath, userPath, workSlotPath, appointmentPath, canceledAppointmentPath } = req.body;
        const specPath = specialityPath || path.join(__dirname, '..', 'data', 'speciality.csv');
        const userPathFinal = userPath || path.join(__dirname, '..', 'data', 'user.csv');
        const workSlotPathFinal = workSlotPath || path.join(__dirname, '..', 'data', 'work_slot.csv');
        const appointmentPathFinal = appointmentPath || path.join(__dirname, '..', 'data', 'appointment.csv');
        const canceledPathFinal = canceledAppointmentPath || path.join(__dirname, '..', 'data', 'canceled_appointment.csv');

        if (!fs.existsSync(specPath)) return res.status(400).json({ error: `Файл не найден: ${specPath}` });
        if (!fs.existsSync(userPathFinal)) return res.status(400).json({ error: `Файл не найден: ${userPathFinal}` });
        if (!fs.existsSync(workSlotPathFinal)) return res.status(400).json({ error: `Файл не найден: ${workSlotPathFinal}` });
        if (!fs.existsSync(appointmentPathFinal)) return res.status(400).json({ error: `Файл не найден: ${appointmentPathFinal}` });
        if (!fs.existsSync(canceledPathFinal)) return res.status(400).json({ error: `Файл не найден: ${canceledPathFinal}` });

        importFunctions.importUsers(userPathFinal, (err) => {
            if (err) return res.status(500).json({ error: 'Ошибка импорта пользователей' });
            importFunctions.importSpeciality(specPath , (err) => {
                if (err) return res.status(500).json({ error: 'Ошибка импорта специальностей ' });
                importFunctions.importWorkSlots(workSlotPathFinal, (err) => {
                    if (err) return res.status(500).json({ error: 'Ошибка импорта рабочих слотов' });
                    importFunctions.importAppointments(appointmentPathFinal, (err) => {
                        if (err) return res.status(500).json({ error: 'Ошибка импорта записей' });
                        importFunctions.importCancelledAppointments(canceledPathFinal, (err) => {
                            if (err) return res.status(500).json({ error: 'Ошибка импорта отменённых записей' });
                            res.json({ message: '✅ Все данные успешно импортированы' });
                        });
                    });
                });
            });
        });
    });




};


