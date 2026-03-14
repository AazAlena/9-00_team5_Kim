const path = require('path');
const fs = require('fs');
const db = require('./db');
const importFunctions = require('./import');
const validation = require('./validation');

module.exports = function (app) {

    // GET /doctors - список всех врачей
    app.get('/doctors', (req, res) => {
        db.all('SELECT doctor_id, doctor_full_name, specialty FROM doctors', [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    // GET /slots - слоты врача на дату (с учетом перерыва)
    app.get('/slots', (req, res) => {
        const { doctorId, date } = req.query;

        // Валидация
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
            SELECT strftime('%H:%M', slot_datetime) as time 
            FROM appointments 
            WHERE doctor_id = ? AND date(slot_datetime) = ? AND status = 'booked'
        `, [doctorId, date], (err, booked) => {
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

        //существует ли такой слот
        db.get(`
        SELECT * FROM work_slots 
        WHERE doctor_id = ? AND work_date = ?
    `, [doctorValidation.value, dateTimeValidation.value.split(' ')[0]], (err, workSlot) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!workSlot) {
                return res.status(400).json({ error: 'Врач не работает в указанную дату' });
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
                INSERT INTO appointments (doctor_id, patient_id, slot_datetime, status) 
                VALUES (?, ?, ?, 'booked')
            `, [doctorValidation.value, patientValidation.value, dateTimeValidation.value], function (err) {
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
    });

    // POST /appointments/cancel - отменить запись
    app.post('/appointments/cancel', (req, res) => {

        const { doctorId, patientCode, slotDateTime, whyCancelled } = req.body;

        // Валидация всех полей
        const doctorValidation = validation.validateDoctorId(doctorId);
        const dateTimeValidation = validation.validateDateTime(slotDateTime);
        const patientValidation = validation.validatePatientCode(patientCode);
        const whyCancelledValidation = validation.validateWhyCancelled(whyCancelled);

        const errors = [];
        if (!doctorValidation.valid) errors.push(doctorValidation.message);
        if (!dateTimeValidation.valid) errors.push(dateTimeValidation.message);
        if (!patientValidation.valid) errors.push(patientValidation.message);
        if (!whyCancelledValidation.valid) errors.push(whyCancelledValidation.message);

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Ошибка валидации',
                details: errors
            });
        }

        db.get(`
        SELECT appointment_id FROM appointments 
        WHERE doctor_id = ? AND slot_datetime = ? AND patient_id = ? AND status = 'booked'
    `, [doctorValidation.value, dateTimeValidation.value, patientValidation.value], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.status(404).json({ error: 'Запись не найдена' });
            }

            const cancelledAppointmentId = row.appointment_id;

            //отменить прошлую запис
            db.run(`
            UPDATE appointments 
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
                        [doctorValidation.value, dateTimeValidation.value, patientValidation.value], (err, row) => {
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

                db.run(`
                INSERT INTO cancelled_appointments (appointment_id, why_cancelled) 
                VALUES (?,?)
            `, [cancelledAppointmentId, whyCancelledValidation.value], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.status(201).json({
                        message: 'Запись успешно отменена',
                        oldAppointment: {
                            appointmentId: cancelledAppointmentId,
                            doctorId: doctorValidation.value,
                            slotDateTime: dateTimeValidation.value,
                            whyCancelled: whyCancelledValidation.value,
                            status: 'cancelled'
                        }
                    });
                });
            });
        });
    });

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
        SELECT * FROM work_slots 
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
            SELECT appointment_id FROM appointments 
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
                SELECT appointment_id FROM appointments 
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
                    UPDATE appointments 
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
                        INSERT INTO cancelled_appointments (appointment_id, why_cancelled) 
                        VALUES (?,?)
                    `, [cancelledAppointmentId,whyCancelledValidation.value], function (err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }

                            db.run(`
                            INSERT INTO appointments (doctor_id, patient_id, slot_datetime, status) 
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

    // POST /import - загрузить все CSV
    app.post('/import', (req, res) => {
        const { doctorsPath, slotsPath, appointmentsPath, appointmentsCancelledPath} = req.body;

        const docsPath = doctorsPath || path.join(__dirname, '..', 'data', 'doctors.csv');
        const slsPath = slotsPath || path.join(__dirname, '..', 'data', 'work_slots.csv');
        const appsPath = appointmentsPath || path.join(__dirname, '..', 'data', 'appointments.csv');
        const cancelledPath = appointmentsCancelledPath || path.join(__dirname, '..', 'data', 'cancelled_appointments.csv');

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

                    importFunctions.importCancelledAppointments(cancelledPath, (err) => {
                        if (err) {
                            res.status(500).json({ error: 'Ошибка импорта записей' });
                            return;
                        }
                    
                        res.json({ message: '✅ Все данные успешно импортированы' });
                    });
                });
            });
        });
    });

    // Регистрация (новый пациент)
    app.post('/register', (req, res) => {
        const { patient_id, patient_full_name, patient_mail, password } = req.body;
        console.log(patient_id, patient_full_name, patient_mail, password)
        if (!patient_id || !patient_full_name || !patient_mail || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        db.get('SELECT patient_id FROM patients WHERE patient_id = ? OR patient_mail = ?',
            [patient_id, patient_mail], (err, row) => {
                if (row) {
                    return res.status(400).json({ error: 'Пациент с таким кодом или email уже существует' });
                }

                db.run(
                    'INSERT INTO patients (patient_id, patient_full_name, patient_mail, password) VALUES (?, ?, ?, ?)',
                    [patient_id, patient_full_name, patient_mail, password],
                    function (err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.status(201).json({
                            message: '✅ Пациент зарегистрирован',
                            patient_id: patient_id
                        });
                    }
                );
            });
    });

    // Вход
    app.post('/login', (req, res) => {
        const { login, password } = req.body; // login может быть code или email
        db.get(
            'SELECT * FROM patients WHERE patient_full_name = ?',
            [login],
            (err, patient) => {
                if (err) {

                    res.status(500).json({ error: err.message });
                    return;
                }
                if (!patient || patient.password !== password) {

                    return res.status(401).json({ error: 'Неверный код/email или пароль' });
                }

                res.json({
                    message: '✅ Вход выполнен',
                    patient_id: patient.patient_id,
                    patient_full_name: patient.patient_full_name
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


    //---------connect with 1C---------------------------------------
    const multer = require('multer');
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'data')),
        filename: (req, file, cb) => cb(null, file.originalname)
    });
    const uploadToData = multer({ storage });

    app.post('/api/1c/upload-csv', uploadToData.fields([
        { name: 'doctors' }, { name: 'slots' }, { name: 'appointments' }, {name: "cancelled"}
    ]), (req, res) => {
        console.log('📥 Файлы получены:', req.files);

        // Импорт
        importFunctions.importDoctors(
            path.join(__dirname, '..', 'data', 'doctors.csv'),
            () => importFunctions.importSlots(
                path.join(__dirname, '..', 'data', 'work_slots.csv'),
                () => importFunctions.importAppointments(
                    path.join(__dirname, '..', 'data', 'appointments.csv'),
                    () => importFunctions.importCancelledAppointments(
                        path.join(__dirname, '..', 'data', 'cancelled_appointments.csv'),
                        () => res.json({ success: true, message: '✅ Готово' })
                    )
                )
            )
        );
    });
    //-----------end---------------------------------------------------
};