const fs = require('fs');
const path = require('path');

// ============================================
// НАСТРОЙКИ
// ============================================
const DATA_DIR = path.join(__dirname);

const DOCTOR_COUNT = 10;
const PATIENT_COUNT = 30;          // 30 пациентов
const APPOINTMENT_COUNT = 300;     // 300 записей
const WORK_DAYS = 4;               // 4 дня

// Специальности
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
    { id: 'D10', name: 'Офтальмолог' }
];

// Врачи
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

// Пациенты (30 штук)
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

// Рабочие дни
const workDates = [];
const startDate = new Date(2025, 4, 20); // 20 мая 2025
for (let i = 0; i < WORK_DAYS; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    workDates.push(`${year}-${month}-${day}`);
}

// Расписание для каждого врача (30-минутные слоты)
const doctorSchedules = {
    D1: { start: '09:00', end: '17:00', break_start: '13:00', break_end: '14:00' },
    D2: { start: '10:00', end: '18:00', break_start: '14:00', break_end: '15:00' },
    D3: { start: '09:00', end: '16:00', break_start: '12:00', break_end: '13:00' },
    D4: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D5: { start: '08:00', end: '16:00', break_start: '12:00', break_end: '13:00' },
    D6: { start: '10:00', end: '19:00', break_start: '14:00', break_end: '15:00' },
    D7: { start: '09:00', end: '17:00', break_start: '13:00', break_end: '14:00' },
    D8: { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
    D9: { start: '08:00', end: '17:00', break_start: '12:00', break_end: '13:00' },
    D10: { start: '10:00', end: '18:00', break_start: '14:00', break_end: '15:00' }
};

// Причины отмен
const cancelReasons = [
    'Пациент передумал',
    'Не явился на приём',
    'Перенос по просьбе пациента',
    'Ошибка записи',
    'Отмена администратором',
    'Болезнь врача'
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Переводит время в минуты от начала дня
function toMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Переводит минуты в формат HH:MM
function toTimeStr(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Генерирует все возможные слоты для врача на дату (с учётом перерыва и длительности слота)
function generateTimeSlotsForDoctor(doctorId, date, schedules, slotMinutes = 30) {
    const schedule = schedules[doctorId];
    if (!schedule) return [];
    
    const startMin = toMinutes(schedule.start);
    const endMin = toMinutes(schedule.end);
    const breakStartMin = schedule.break_start ? toMinutes(schedule.break_start) : null;
    const breakEndMin = schedule.break_end ? toMinutes(schedule.break_end) : null;
    
    const slots = [];
    for (let current = startMin; current < endMin; current += slotMinutes) {
        // Пропускаем перерыв
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

// 1. speciality.csv
function generateSpeciality() {
    let csv = 'id,speciality\n';
    specialities.forEach(s => {
        csv += `${s.id},${s.name}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'speciality.csv'), csv, 'utf8');
    console.log('✅ speciality.csv');
}

// 2. user.csv
function generateUsers() {
    const allUsers = [...doctors, ...patients, ...admin];
    let csv = 'id,fio,email,password,role\n';
    allUsers.forEach(u => {
        csv += `${u.id},${u.fio},${u.email},${u.password},${u.role}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'user.csv'), csv, 'utf8');
    console.log(`✅ user.csv (${allUsers.length} пользователей)`);
}

// 3. work_slot.csv (30-минутные слоты)
function generateWorkSlots() {
    let csv = 'id,date,start_time,end_time,slots_minutes,break_start,break_end\n';
    
    for (const doctor of doctors) {
        const schedule = doctorSchedules[doctor.id];
        if (!schedule) continue;
        
        for (const date of workDates) {
            // В work_slot хранится шаблон рабочего дня, а не каждый слот отдельно
            // slots_minutes = 30 означает, что слоты будут по 30 минут
            csv += `${doctor.id},${date},${schedule.start},${schedule.end},30,${schedule.break_start},${schedule.break_end}\n`;
        }
    }
    
    fs.writeFileSync(path.join(DATA_DIR, 'work_slot.csv'), csv, 'utf8');
    console.log(`✅ work_slot.csv (${doctors.length * workDates.length} записей)`);
}

// 4. appointment.csv и canceled_appointment.csv
function generateAppointmentsAndCancelled() {
    // Генерируем все возможные слоты (30-минутные)
    const allPossibleSlots = [];
    
    for (const doctor of doctors) {
        for (const date of workDates) {
            const slots = generateTimeSlotsForDoctor(doctor.id, date, doctorSchedules, 30);
            allPossibleSlots.push(...slots);
        }
    }
    
    console.log(`   Всего возможных слотов: ${allPossibleSlots.length}`);
    
    // Перемешиваем и выбираем APPOINTMENT_COUNT слотов
    const shuffled = [...allPossibleSlots];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const selectedSlots = shuffled.slice(0, Math.min(APPOINTMENT_COUNT, shuffled.length));
    
    // Генерируем записи (15% cancelled)
    const appointments = [];
    const cancelledList = [];
    let nextId = 1;
    
    for (const slot of selectedSlots) {
        const isCancelled = Math.random() < 0.15; // 15% cancelled
        const status = isCancelled ? 'cancelled' : 'booked';
        
        // Случайный пациент
        const patient = patients[Math.floor(Math.random() * patients.length)];
        
        appointments.push({
            appt_id: nextId,
            doctor_id: slot.doctor_id,
            patient_code: patient.id,
            slot_datetime: slot.slot_datetime,
            status: status
        });
        
        if (isCancelled) {
            const reason = cancelReasons[Math.floor(Math.random() * cancelReasons.length)];
            cancelledList.push({
                appt_id: nextId,
                why_cancelled: reason
            });
        }
        
        nextId++;
    }
    
    // Сохраняем appointment.csv
    let appointmentCsv = 'appt_id,doctor_id,patient_code,slot_datetime,status\n';
    appointments.forEach(a => {
        appointmentCsv += `${a.appt_id},${a.doctor_id},${a.patient_code},${a.slot_datetime},${a.status}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'appointment.csv'), appointmentCsv, 'utf8');
    console.log(`✅ appointment.csv (${appointments.length} записей)`);
    
    // Сохраняем canceled_appointment.csv
    let cancelledCsv = 'appt_id,why_cancelled\n';
    cancelledList.forEach(c => {
        cancelledCsv += `${c.appt_id},${c.why_cancelled}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'canceled_appointment.csv'), cancelledCsv, 'utf8');
    console.log(`✅ canceled_appointment.csv (${cancelledList.length} записей)`);
}

// ============================================
// ЗАПУСК
// ============================================

console.log('\n🚀 Начинаем генерацию тестовых данных T1\n');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

generateSpeciality();
generateUsers();
generateWorkSlots();
generateAppointmentsAndCancelled();

console.log('\n✅ Генерация T1 завершена! Файлы сохранены в папку data/\n');
console.log('📊 Статистика T1:');
console.log(`   - Врачей: ${DOCTOR_COUNT}`);
console.log(`   - Пациентов: ${PATIENT_COUNT}`);
console.log(`   - Рабочих дней: ${WORK_DAYS}`);
console.log(`   - Длительность слота: 30 минут`);
console.log(`   - Записей: ~${APPOINTMENT_COUNT} (15% отменённых)`);

console.log('\n✅ Генерация завершена! Файлы сохранены в папку data/\n');