const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// СХЕМЫ ДЛЯ КАЖДОГО CSV

const schemas = {
    'user.csv': {
        required: ['id', 'fio', 'email', 'password', 'role'],
        types: {
            id: 'string',
            fio: 'string',
            email: 'email',
            password: 'string',
            role: ['patient', 'doctor', 'admin']
        },
        unique: ['id', 'email']
    },
    'speciality.csv': {
        required: ['id', 'speciality'],
        types: {
            id: 'string',
            speciality: 'string'
        },
        unique: ['id']
    },
    'work_slot.csv': {
        required: ['id', 'date', 'start_time', 'end_time', 'slots_minutes'],
        types: {
            id: 'string',
            date: 'date',
            start_time: 'time',
            end_time: 'time',
            slots_minutes: 'number',
            break_start: 'time',
            break_end: 'time'
        },
        rules: [
            {
                condition: (row) => row.start_time < row.end_time,
                message: 'start_time должна быть меньше end_time'
            },
            {
                condition: (row) => !row.break_start || !row.break_end || row.break_start < row.break_end,
                message: 'break_start должна быть меньше break_end'
            },
            {
                condition: (row) => !row.break_start || !row.break_end ||
                    (row.break_start >= row.start_time && row.break_end <= row.end_time),
                message: 'перерыв должен быть внутри рабочего интервала'
            }
        ]
    },
    'appointment.csv': {
        required: ['appt_id', 'doctor_id', 'patient_code', 'slot_datetime', 'status'],
        types: {
            appt_id: 'number',
            doctor_id: 'string',
            patient_code: 'string',
            slot_datetime: 'datetime',
            status: ['booked', 'cancelled', 'completed']
        },
        unique: ['appt_id']
    },
    'canceled_appointment.csv': {
        required: ['appt_id', 'why_cancelled'],
        types: {
            appt_id: 'number',
            why_cancelled: 'string'
        },
        unique: ['appt_id']
    }
};

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

function validateType(value, type) {
    if (value === undefined || value === null || value === '') return type === 'optional';

    switch (type) {
        case 'number':
            return !isNaN(parseFloat(value)) && isFinite(value);
        case 'date':
            return /^\d{4}-\d{2}-\d{2}$/.test(value);
        case 'time':
            return /^\d{2}:\d{2}$/.test(value);
        case 'datetime':
            return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value);
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'string':
            return typeof value === 'string' && value.length > 0;
        default:
            if (Array.isArray(type)) {
                return type.includes(value);
            }
            return true;
    }
}

function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csv())
            .on('data', (row) => {
                // Очищаем значения от возможных кавычек и пробелов
                const cleanRow = {};
                for (const [key, val] of Object.entries(row)) {
                    cleanRow[key] = val ? val.trim().replace(/^['"]|['"]$/g, '') : '';
                }
                rows.push(cleanRow);
            })
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}


// БИЗНЕС-ПРОВЕРКИ


function validateNoOverlappingSlots(workSlots) {
    const errors = [];
    const byDoctor = {};

    for (const slot of workSlots) {
        if (!byDoctor[slot.id]) byDoctor[slot.id] = [];
        byDoctor[slot.id].push(slot);
    }

    for (const [doctorId, slots] of Object.entries(byDoctor)) {
        for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
                const s1 = slots[i];
                const s2 = slots[j];
                if (s1.date !== s2.date) continue;

                if (s1.start_time < s2.end_time && s2.start_time < s1.end_time) {
                    errors.push(`❌ work_slot.csv: пересечение слотов у врача ${doctorId} на дату ${s1.date}: ${s1.start_time}-${s1.end_time} и ${s2.start_time}-${s2.end_time}`);
                }
            }
        }
    }
    return errors;
}

function validateAppointmentInWorkSlot(appointments, workSlots) {
    const errors = [];
    const workSlotMap = {};

    for (const slot of workSlots) {
        const key = `${slot.id}|${slot.date}`;
        workSlotMap[key] = slot;
    }

    for (const apt of appointments) {
        if (!apt.slot_datetime) continue;
        const parts = apt.slot_datetime.split(' ');
        if (parts.length !== 2) {
            errors.push(`❌ appointment.csv: запись ${apt.appt_id} имеет неверный формат slot_datetime: ${apt.slot_datetime}`);
            continue;
        }
        const [date, time] = parts;
        const key = `${apt.doctor_id}|${date}`;
        const slot = workSlotMap[key];

        if (!slot) {
            errors.push(`❌ appointment.csv: запись ${apt.appt_id} – у врача ${apt.doctor_id} нет расписания на ${date}`);
            continue;
        }

        if (time < slot.start_time || time > slot.end_time) {
            errors.push(`❌ appointment.csv: запись ${apt.appt_id} – время ${time} вне рабочего интервала ${slot.start_time}-${slot.end_time}`);
        }

        if (slot.break_start && slot.break_end) {
            if (time >= slot.break_start && time < slot.break_end) {
                errors.push(`❌ appointment.csv: запись ${apt.appt_id} – время ${time} попадает на перерыв ${slot.break_start}-${slot.break_end}`);
            }
        }
    }
    return errors;
}

function validateCancelledHasReason(appointments, cancelled) {
    const errors = [];
    const cancelledMap = new Map();
    for (const c of cancelled) {
        cancelledMap.set(c.appt_id, c);
    }

    for (const apt of appointments) {
        if (apt.status === 'cancelled' && !cancelledMap.has(apt.appt_id)) {
            errors.push(`❌ appointment.csv: запись ${apt.appt_id} имеет статус 'cancelled', но нет причины в canceled_appointment.csv`);
        }
        if (apt.status !== 'cancelled' && cancelledMap.has(apt.appt_id)) {
            errors.push(`❌ canceled_appointment.csv: запись ${apt.appt_id} имеет причину отмены, но статус в appointment.csv не 'cancelled'`);
        }
    }
    return errors;
}

function validateReferences(rows, filename, field, refFile, refField, allData) {
    const errors = [];
    const refSet = new Set();
    const refRows = allData[refFile];
    if (!refRows) return errors;

    for (const row of refRows) {
        if (row[refField]) refSet.add(row[refField]);
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const value = row[field];
        if (value && !refSet.has(value)) {
            errors.push(`❌ ${filename}: строка ${i + 2}, поле '${field}' = '${value}' не найдено в ${refFile}.${refField}`);
        }
    }
    return errors;
}
// ГЛАВНАЯ ФУНКЦИЯ ВАЛИДАЦИИ

async function validateAll() {
    const dataDir = __dirname;
    const errors = [];
    const allData = {};

    console.log('\n🔍 Начинаем валидацию CSV файлов...\n');

    // Загружаем все CSV файлы
    for (const [filename] of Object.entries(schemas)) {
        const filePath = path.join(dataDir, filename);
        if (!fs.existsSync(filePath)) {
            errors.push(`❌ Файл не найден: ${filename}`);
            continue;
        }
        try {
            const rows = await parseCSV(filePath);
            allData[filename] = rows;
            console.log(`📄 ${filename}: ${rows.length} строк`);
        } catch (err) {
            errors.push(`❌ Ошибка чтения ${filename}: ${err.message}`);
        }
    }

    console.log('');

    // Проверка каждого файла по схеме
    for (const [filename, schema] of Object.entries(schemas)) {
        const rows = allData[filename];
        if (!rows) continue;

        const uniqueChecks = {};
        if (schema.unique) {
            for (const field of schema.unique) {
                uniqueChecks[field] = new Set();
            }
        }

        for (let idx = 0; idx < rows.length; idx++) {
            const row = rows[idx];
            const lineNum = idx + 2;

            // Проверка обязательных полей
            for (const field of schema.required) {
                if (!row[field] || row[field].trim() === '') {
                    errors.push(`❌ ${filename}: строка ${lineNum}, поле '${field}' обязательно`);
                }
            }

            // Проверка типов
            for (const [field, type] of Object.entries(schema.types)) {
                if (row[field] !== undefined && row[field] !== '') {
                    if (!validateType(row[field], type)) {
                        errors.push(`❌ ${filename}: строка ${lineNum}, поле '${field}' имеет неверный тип (ожидается ${type})`);
                    }
                }
            }

            // Проверка уникальности
            if (schema.unique) {
                for (const field of schema.unique) {
                    if (row[field]) {
                        if (uniqueChecks[field].has(row[field])) {
                            errors.push(`❌ ${filename}: строка ${lineNum}, поле '${field}' должно быть уникальным (значение '${row[field]}' уже есть)`);
                        } else {
                            uniqueChecks[field].add(row[field]);
                        }
                    }
                }
            }

            // Проверка бизнес-правил
            if (schema.rules) {
                for (const rule of schema.rules) {
                    if (!rule.condition(row)) {
                        errors.push(`❌ ${filename}: строка ${lineNum}, ${rule.message}`);
                    }
                }
            }
        }
    }

    // БИЗНЕС-ПРОВЕРКИ МЕЖДУ ФАЙЛАМИ (выполняются всегда, даже если есть ошибки схемы)

    if (allData['work_slot.csv']) {
        const overlapErrors = validateNoOverlappingSlots(allData['work_slot.csv']);
        errors.push(...overlapErrors);
    }

    if (allData['appointment.csv'] && allData['work_slot.csv']) {
        const workSlotErrors = validateAppointmentInWorkSlot(allData['appointment.csv'], allData['work_slot.csv']);
        errors.push(...workSlotErrors);
    }

    if (allData['appointment.csv'] && allData['canceled_appointment.csv']) {
        const cancelErrors = validateCancelledHasReason(allData['appointment.csv'], allData['canceled_appointment.csv']);
        errors.push(...cancelErrors);
    }

    // Проверка ссылок appointment → user
    if (allData['appointment.csv'] && allData['user.csv']) {
        const doctorErrors = validateReferences(allData['appointment.csv'], 'appointment.csv', 'doctor_id', 'user.csv', 'id', allData);
        errors.push(...doctorErrors);
        const patientErrors = validateReferences(allData['appointment.csv'], 'appointment.csv', 'patient_code', 'user.csv', 'id', allData);
        errors.push(...patientErrors);
    }

    // Проверка ссылок work_slot → user
    if (allData['work_slot.csv'] && allData['user.csv']) {
        const workSlotUserErrors = validateReferences(allData['work_slot.csv'], 'work_slot.csv', 'id', 'user.csv', 'id', allData);
        errors.push(...workSlotUserErrors);
    }

    // Проверка ссылок speciality → user
    if (allData['speciality.csv'] && allData['user.csv']) {
        const specialityErrors = validateReferences(allData['speciality.csv'], 'speciality.csv', 'id', 'user.csv', 'id', allData);
        errors.push(...specialityErrors);
    }

    // Проверка ссылок canceled_appointment → appointment
    if (allData['canceled_appointment.csv'] && allData['appointment.csv']) {
        const cancelRefErrors = validateReferences(allData['canceled_appointment.csv'], 'canceled_appointment.csv', 'appt_id', 'appointment.csv', 'appt_id', allData);
        errors.push(...cancelRefErrors);
    }

    // ВЫВОД РЕЗУЛЬТАТОВ
    if (errors.length > 0) {
        console.log('\n❌ Найдены ошибки:');
        errors.forEach(e => console.log(`   ${e}`));
        console.log(`\n📊 Итого ошибок: ${errors.length}\n`);
        return { valid: false, errors: errors };
    } else {
        console.log('\n✅ Все CSV файлы прошли валидацию!\n');
        return { valid: true, errors: [] };
    }
}

// Запуск (если файл выполняется напрямую, а не импортируется)
if (require.main === module) {
    validateAll().then(result => {
        if (!result.valid) process.exit(1);
    });
}

module.exports = { validateAll };