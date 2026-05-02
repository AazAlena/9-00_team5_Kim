Что изменилось в бд:

appointmernts:
appointment_id -> appt_id

cancelled_appointments:
appointment_id -> appt_id

admins, doctors, patients deleted

user add:
id
fio
email
password
role

speciality add:
speciality
id 

work_slot:
slot_id delete
id (connect woth doctor id)
work_date -> date
slots_duration_minutes -> slots_minutes


черновик запроса
// GET /slots - слоты врача на дату (с учетом перерыва)

    //на странице с выбором времени:
    //отдаю дату и специальность, получаю слоты на эту дату, по этим специальностям
    /*WITH RECURSIVE time_slots AS (
    -- Генерируем слоты для каждого врача на указанную дату
    SELECT 
        ws.id AS doctor_id,
        ws.date,
        ws.start_time AS slot_start,
        ws.start_time + INTERVAL (ws.slots_minutes || ' minutes') AS slot_end,
        ws.slots_minutes,
        ws.break_start,
        ws.break_end,
        1 as slot_number
    FROM work_slots ws
    WHERE ws.date = :target_date
      AND ws.id IN (
          SELECT u.id 
          FROM user u 
          WHERE u.id = :speciality_id
      )
    
    UNION ALL
    
    SELECT 
        ts.doctor_id,
        ts.date,
        ts.slot_end AS slot_start,
        ts.slot_end + INTERVAL (ts.slots_minutes || ' minutes') AS slot_end,
        ts.slots_minutes,
        ts.break_start,
        ts.break_end,
        ts.slot_number + 1
    FROM time_slots ts
    WHERE ts.slot_end < (
        SELECT ws.end_time 
        FROM work_slots ws 
        WHERE ws.id = ts.doctor_id AND ws.date = ts.date
    )
),
filtered_slots AS (
    -- Фильтруем слоты, исключая перерыв
    SELECT 
        ts.doctor_id,
        ts.date,
        u.fio,
        u.email,
        ts.slot_start,
        ts.slot_end,
        ts.slot_number,
        CASE 
            WHEN ts.slot_start >= ts.break_start AND ts.slot_start < ts.break_end THEN true
            ELSE false
        END AS is_break_time
    FROM time_slots ts
    JOIN user u ON ts.doctor_id = u.id
)
SELECT 
    fs.doctor_id,
    fs.date,
    fs.fio,
    fs.email,
    fs.slot_start,
    fs.slot_end,
    fs.slot_number,
    COALESCE(a.status, 'available') AS slot_status  -- берем статус из appointments или 'available'
FROM filtered_slots fs
LEFT JOIN appointments a ON a.doctor_id = fs.doctor_id
    AND a.slot_datetime = CONCAT(fs.date, ' ', fs.slot_start)
WHERE fs.is_break_time = false
  //AND fs.slot_start >= :target_time
ORDER BY fs.doctor_id, fs.slot_start; */
    app.get('/slots', (req, res) => {
        const { date, speciality } = req.query;

        // Валидация
        const dateValidation = validation.validateDate(date);
        const specialityValidation = validation.validateSpeciality(speciality);

        // составить таблицу: к work_slots присоединить специальности определенных врачей по id из speciality
        db.get(`
        SELECT * FROM work_slots 
        WHERE work_date = ?
    `, [dateValidation.value], (err, workSlot) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!workSlot) {
                return res.status(404).json({
                    error: 'Расписание не найдено',
                    message: `В дату ${date} никто не работает`
                });
            }

            // Получаем все ЗАНЯТЫЕ слоты на эту дату
            db.all(`
            SELECT strftime('%H:%M', slot_datetime) as time 
            FROM appointments 
            WHERE date(slot_datetime) = ? AND status = 'booked'
        `, [date], (err, booked) => {
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



    
    //на странице с выбором врача после выбора времени:
    //отдаю конкретное время, дату, специальность, получаю врачей

    app.post('/doctors/speciality/data/time', (req, res) => {
    // Валидация всех полей
        const { data, time, spiciality } = req.body;
        const dateValidation = validation.validateDate(data);
        const timeValidation = validation.validateTime(time);
        const specialityValidation = validation.validateSpeciality(spiciality);

        const errors = [];
        if (!dateValidation.valid) errors.push(dateValidation.message);
        if (!timeValidation.valid) errors.push(timeValidation.message);
        if (!specialityValidation.valid) errors.push(specialityValidation.message);

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Ошибка валидации',
                details: errors
            });
        }
        
//-- Генерируем слоты для каждого врача на указанную дату
//-- Фильтруем слоты, исключая перерыв
        db.all(`WITH RECURSIVE time_slots AS (
            SELECT 
                ws.id AS doctor_id,
                ws.date,
                ws.start_time AS slot_start,
                ws.start_time + INTERVAL (ws.slots_minutes || ' minutes') AS slot_end,
                ws.slots_minutes,
                ws.break_start,
                ws.break_end,
                1 as slot_number
            FROM work_slots ws
            WHERE ws.date = ? 
            AND ws.id IN (
                SELECT u.id 
                FROM user u 
                WHERE u.id = ? (speciality_id!!!!!!!!!)
            )
    
        UNION ALL
    
        SELECT 
            ts.doctor_id,
            ts.date,
            ts.slot_end AS slot_start,
            ts.slot_end + INTERVAL (ts.slots_minutes || ' minutes') AS slot_end,
            ts.slots_minutes,
            ts.break_start,
            ts.break_end,
            ts.slot_number + 1
            FROM time_slots ts
            WHERE ts.slot_end < (
                SELECT ws.end_time 
                FROM work_slots ws 
                WHERE ws.id = ts.doctor_id AND ws.date = ts.date
            )
        ),
        filtered_slots AS (
            
            SELECT 
                ts.doctor_id,
                ts.date,
                u.fio,
                u.email,
                ts.slot_start,
                ts.slot_end,
                ts.slot_number,
                CASE 
                    WHEN ts.slot_start >= ts.break_start AND ts.slot_start < ts.break_end THEN true
                    ELSE false
                END AS is_break_time
            FROM time_slots ts
            JOIN user u ON ts.doctor_id = u.id
        )
        SELECT 
            fs.doctor_id,
            fs.date,
            fs.fio,
            fs.email,
            fs.slot_start,
            fs.slot_end,
            fs.slot_number,
            COALESCE(a.status, 'available') AS slot_status
        FROM filtered_slots fs
        LEFT JOIN appointments a ON a.doctor_id = fs.doctor_id
        AND a.slot_datetime = CONCAT(fs.date, ' ', fs.slot_start)
        WHERE fs.is_break_time = false
            AND fs.slot_start == ?
            AND fs.status == NULL
        ORDER BY fs.doctor_id, fs.slot_start; `, [dateValidation.value, speciality_id.value, timeValidation.value], (err, Doctrs) => {
            
        })
        

       
        /*НЕ ТО
        db.all(`SELECT id FROM speciality
            WHERE speciality = ?`, [specialityValidation.value], (err, idDoctrs) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!idDoctors){
                return res.status(400).json({ error: 'Врачей по этой специальности нет' });
            }
            doctors_by_speciality_date = [];
            for (i=0; i<length(idDoctrs); i++){
                db.all(`SELECT id FROM work_slots
                    WHERE id = ? AND date = ?`, [idDoctors[i], date], (err, doctors) => {
                    if (err){
                        return res.status(500).json({ error: err.message });
                    }
                    doctors_by_speciality_date.app(doctors);
                })
            }
            

            res.json(doctors_by_speciality);
        });*/



    });


