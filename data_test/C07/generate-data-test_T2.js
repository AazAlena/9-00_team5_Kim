const fs = require('fs');
const path = require('path');

// ============================================
// НАСТРОЙКИ T2
// ============================================
const DATA_DIR = path.join(__dirname, 'data');  // ← сохраняем в data/

// Увеличенные объёмы для T2
const DOCTOR_COUNT = 20;        // 20 врачей
const PATIENT_COUNT = 30;       // 30 пациентов
const APPOINTMENT_COUNT = 450;   // 450 записей (~T1×1.5, т.к. больше врачей и дней)
const WORK_DAYS = 30;            // 23 дня (1–23 мая)

// Специальности (20 врачей, 5 специальностей повторяются)
const specialities = [
    { id: 'D1', name: 'Терапевт' },
    { id: 'D2', name: 'Кардиолог' },
    { id: 'D3', name: 'Хирург' },
    { id: 'D4', name: 'Невролог' },
    { id: 'D5', name: 'Офтальмолог' },
    { id: 'D6', name: 'Терапевт' },
    { id: 'D7', name: 'Кардиолог' },
    { id: 'D8', name: 'Хирург' },
    { id: 'D9', name: 'Невролог' },
    { id: 'D10', name: 'Офтальмолог' },
    { id: 'D11', name: 'Терапевт' },
    { id: 'D12', name: 'Терапевт' },
    { id: 'D13', name: 'Кардиолог' },
    { id: 'D14', name: 'Кардиолог' },
    { id: 'D15', name: 'Хирург' },
    { id: 'D16', name: 'Хирург' },
    { id: 'D17', name: 'Невролог' },
    { id: 'D18', name: 'Невролог' },
    { id: 'D19', name: 'Офтальмолог' },
    { id: 'D20', name: 'Офтальмолог' }
];

// Врачи (20)
const doctors = [];
for (let i = 1; i <= DOCTOR_COUNT; i++) {
    doctors.push({
        id: `D${i}`,
        fio: `Врач ${i}`,
        email: `doctor${i}@clinic.ru`,
        password: '123',
        role: 'doctor'
    });
}

// Пациенты (30)
const patients = [];
for (let i = 1; i <= PATIENT_COUNT; i++) {
    const num = i.toString().padStart(3, '0');
    patients.push({
        id: `P${num}`,
        fio: `Пациент ${num}`,
        email: `patient${num}@mail.ru`,
        password: '123',
        role: 'patient'
    });
}

// Админ
const admin = [
    { id: 'A1', fio: 'Администратор', email: 'admin@clinic.ru', password: '123', role: 'admin' }
];

// Рабочие дни (1–23 мая 2026)
const workDates = [];
for (let day = 1; day <= WORK_DAYS; day++) {
    const year = 2026;
    const month = 5;
    const d = new Date(year, month - 1, day);
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    workDates.push(`${yearStr}-${monthStr}-${dayStr}`);
}

// Расписание для каждого врача (30-минутные слоты)
const doctorSchedules = {
    D1: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D2: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D3: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D4: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D5: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D6: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D7: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D8: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D9: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D10: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D11: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D12: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D13: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D14: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D15: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D16: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D17: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D18: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D19: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D20: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' }
};

// Причины отмен (с префиксами)
const cancelReasons = [
    'Отмена: Пациент передумал',
    'Отмена: Не явился на приём',
    'Перенос: Перенос по просьбе пациента',
    'Отмена: Ошибка записи',
    'Отмена: Отмена администратором',
    'Отмена: Болезнь врача'
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function toMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function toTimeStr(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function generateTimeSlotsForDoctor(doctorId, date, schedules, slotMinutes = 30) {
    const schedule = schedules[doctorId];
    if (!schedule) return [];
    
    const startMin = toMinutes(schedule.start);
    const endMin = toMinutes(schedule.end);
    const breakStartMin = schedule.break_start ? toMinutes(schedule.break_start) : null;
    const breakEndMin = schedule.break_end ? toMinutes(schedule.break_end) : null;
    
    const slots = [];
    for (let current = startMin; current < endMin; current += slotMinutes) {
        if (breakStartMin !== null && current >= breakStartMin && current < breakEndMin) {
            continue;
        }
        slots.push({
            doctor_id: doctorId,
            date: date,
            time: toTimeStr(current),
            slot_datetime: `${date} ${toTimeStr(current)}`
        });
    }
    return slots;
}

// ============================================
// ГЕНЕРАЦИЯ ФАЙЛОВ
// ============================================

function generateSpeciality() {
    let csv = 'id,speciality\n';
    specialities.forEach(s => {
        csv += `${s.id},${s.name}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'speciality.csv'), csv, 'utf8');
    console.log('✅ speciality.csv');
}

function generateUsers() {
    const allUsers = [...doctors, ...patients, ...admin];
    let csv = 'id,fio,email,password,role\n';
    allUsers.forEach(u => {
        csv += `${u.id},${u.fio},${u.email},${u.password},${u.role}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'user.csv'), csv, 'utf8');
    console.log(`✅ user.csv (${allUsers.length} пользователей)`);
}

function generateWorkSlots() {
    let csv = 'id,date,start_time,end_time,slots_minutes,break_start,break_end\n';
    
    for (const doctor of doctors) {
        const schedule = doctorSchedules[doctor.id];
        if (!schedule) continue;
        for (const date of workDates) {
            csv += `${doctor.id},${date},${schedule.start},${schedule.end},30,${schedule.break_start},${schedule.break_end}\n`;
        }
    }
    fs.writeFileSync(path.join(DATA_DIR, 'work_slot.csv'), csv, 'utf8');
    console.log(`✅ work_slot.csv (${doctors.length * workDates.length} записей)`);
}

function generateAppointmentsAndCanceled() {
    // 1. Генерируем все возможные слоты (30-минутные)
    const allPossibleSlots = [];
    for (const doctor of doctors) {
        for (const date of workDates) {
            const slots = generateTimeSlotsForDoctor(doctor.id, date, doctorSchedules, 30);
            allPossibleSlots.push(...slots);
        }
    }
    console.log(`   Всего возможных слотов: ${allPossibleSlots.length}`);
    
    // 2. Перемешиваем и выбираем APPOINTMENT_COUNT слотов
    const shuffled = [...allPossibleSlots];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedSlots = shuffled.slice(0, Math.min(APPOINTMENT_COUNT, shuffled.length));
    
    // 3. Генерируем записи (15% canceled, среди них часть — переносы)
    const appointments = [];
    const canceledList = [];
    let nextId = 1;
    
    // Для распределения: 70% отмен — обычные отмены, 30% отмен — переносы
    const CANCEL_PERCENT = 0.15;      // всего 15% отмен
    const RESCHEDULE_PERCENT = 0.3;   // из них 30% — переносы
    
    for (const slot of selectedSlots) {
        const isCanceled = Math.random() < CANCEL_PERCENT;
        
        let status = 'booked';
        let reason = null;
        
        if (isCanceled) {
            const isReschedule = Math.random() < RESCHEDULE_PERCENT;
            if (isReschedule) {
                status = 'canceled';
                const baseReason = cancelReasons.find(r => r.startsWith('Перенос:'));
                reason = baseReason || 'Перенос: Перенос по просьбе пациента';
            } else {
                status = 'canceled';
                const normalReasons = cancelReasons.filter(r => r.startsWith('Отмена:'));
                reason = normalReasons[Math.floor(Math.random() * normalReasons.length)];
            }
        }
        
        const patient = patients[Math.floor(Math.random() * patients.length)];
        
        appointments.push({
            appt_id: nextId,
            doctor_id: slot.doctor_id,
            patient_code: patient.id,
            slot_datetime: slot.slot_datetime,
            status: status
        });
        
        if (reason) {
            canceledList.push({
                appt_id: nextId,
                why_canceled: reason
            });
        }
        
        nextId++;
    }
    
    // 4. Сохраняем appointment.csv
    let appointmentCsv = 'appt_id,doctor_id,patient_code,slot_datetime,status\n';
    appointments.forEach(a => {
        appointmentCsv += `${a.appt_id},${a.doctor_id},${a.patient_code},${a.slot_datetime},${a.status}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'appointment.csv'), appointmentCsv, 'utf8');
    console.log(`✅ appointment.csv (${appointments.length} записей)`);
    
    // 5. Сохраняем canceled_appointment.csv
    let canceledCsv = 'appt_id,why_canceled\n';
    canceledList.forEach(c => {
        canceledCsv += `${c.appt_id},${c.why_canceled}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'canceled_appointment.csv'), canceledCsv, 'utf8');
    console.log(`✅ canceled_appointment.csv (${canceledList.length} записей)`);
}

// ============================================
// ЗАПУСК
// ============================================
console.log('\n🚀 Начинаем генерацию тестовых данных T2\n');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

generateSpeciality();
generateUsers();
generateWorkSlots();
generateAppointmentsAndCanceled();

console.log('\n✅ Генерация T2 завершена! Файлы сохранены в папку data/\n');
console.log('📊 Статистика T2:');
console.log(`   - Врачей: ${DOCTOR_COUNT}`);
console.log(`   - Пациентов: ${PATIENT_COUNT}`);
console.log(`   - Рабочих дней: ${WORK_DAYS}`);
console.log(`   - Длительность слота: 30 минут`);
console.log(`   - Записей: ~${APPOINTMENT_COUNT} (15% отменённых, из них ~30% — переносы)`);
console.log('   - Префиксы в why_canceled: Отмена: / Перенос:\n');