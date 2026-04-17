const fs = require('fs');
const path = require('path');

// ============================================
// НАСТРОЙКИ T2
// ============================================
const DATA_DIR = path.join(__dirname);

// Количество
const DOCTOR_COUNT = 30;      // 30 врачей
const PATIENT_COUNT = 100;     // 100 пациентов
const WORK_DAYS_COUNT = 14;    // 14 дней (2 недели)
const APPOINTMENT_COUNT = 2000; // 2000 записей

// Специальности (расширенный список)
const specialities = [
    { id: 'D1', name: 'Терапевт' },
    { id: 'D2', name: 'Кардиолог' },
    { id: 'D3', name: 'Хирург' },
    { id: 'D4', name: 'Невролог' },
    { id: 'D5', name: 'Офтальмолог' },
    { id: 'D6', name: 'Дерматолог' },
    { id: 'D7', name: 'Гинеколог' },
    { id: 'D8', name: 'Уролог' },
    { id: 'D9', name: 'Гастроэнтеролог' },
    { id: 'D10', name: 'Эндокринолог' }
];

// Возможные расписания (разные варианты)
const scheduleTemplates = [
    { start: '08:00', end: '16:00', break_start: '12:00', break_end: '13:00', slot: 30 },
    { start: '09:00', end: '17:00', break_start: '13:00', break_end: '14:00', slot: 30 },
    { start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00', slot: 60 },
    { start: '10:00', end: '19:00', break_start: '14:00', break_end: '15:00', slot: 60 },
    { start: '08:00', end: '20:00', break_start: '13:00', break_end: '14:00', slot: 30 },
    { start: '09:00', end: '16:00', break_start: '12:00', break_end: '13:00', slot: 60 }
];

// Причины отмен
const cancelReasons = [
    'Пациент передумал',
    'Не явился на приём',
    'Перенос по просьбе пациента',
    'Ошибка записи',
    'Отмена администратором',
    'Болезнь врача',
    'Технические проблемы',
    'Двойная запись'
];

// Генерация списка дат (последние WORK_DAYS_COUNT дней от сегодня)
function generateDates(daysCount) {
    const dates = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    
    for (let i = 0; i < daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }
    return dates;
}

// Генерация ID для врача
function generateDoctorId(index) {
    return `D${index + 1}`;
}

// Генерация ID для пациента
function generatePatientId(index) {
    return `P${String(index + 1).padStart(4, '0')}`;
}

// Генерация специальностей
function generateSpeciality() {
    let csv = 'id,speciality\n';
    specialities.forEach(s => {
        csv += `${s.id},${s.name}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'speciality.csv'), csv, 'utf8');
    console.log('✅ speciality.csv');
}

// Генерация пользователей (врачи + пациенты + админ)
function generateUsers() {
    const users = [];
    
    // Врачи
    for (let i = 1; i <= DOCTOR_COUNT; i++) {
        const id = generateDoctorId(i - 1);
        const specialityIndex = (i - 1) % specialities.length;
        users.push({
            id: id,
            fio: `Врач ${i}`,
            email: `doctor${i}@clinic.ru`,
            password: '123',
            role: 'doctor'
        });
    }
    
    // Пациенты
    for (let i = 1; i <= PATIENT_COUNT; i++) {
        const id = generatePatientId(i - 1);
        users.push({
            id: id,
            fio: `Пациент ${String(i).padStart(4, '0')}`,
            email: `patient${i}@mail.ru`,
            password: '123',
            role: 'patient'
        });
    }
    
    // Админ
    users.push({
        id: 'A1',
        fio: 'Администратор',
        email: 'admin@clinic.ru',
        password: '123',
        role: 'admin'
    });
    
    let csv = 'id,fio,email,password,role\n';
    users.forEach(u => {
        csv += `${u.id},${u.fio},${u.email},${u.password},${u.role}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'user.csv'), csv, 'utf8');
    console.log(`✅ user.csv (${users.length} пользователей)`);
}

// Генерация рабочих слотов
function generateWorkSlots() {
    const dates = generateDates(WORK_DAYS_COUNT);
    const workSlots = [];
    
    for (let i = 1; i <= DOCTOR_COUNT; i++) {
        const doctorId = generateDoctorId(i - 1);
        // Каждый врач получает случайное расписание
        const schedule = scheduleTemplates[Math.floor(Math.random() * scheduleTemplates.length)];
        
        for (const date of dates) {
            workSlots.push({
                id: doctorId,
                date: date,
                start_time: schedule.start,
                end_time: schedule.end,
                slots_minutes: schedule.slot,
                break_start: schedule.break_start,
                break_end: schedule.break_end
            });
        }
    }
    
    let csv = 'id,date,start_time,end_time,slots_minutes,break_start,break_end\n';
    workSlots.forEach(ws => {
        csv += `${ws.id},${ws.date},${ws.start_time},${ws.end_time},${ws.slots_minutes},${ws.break_start},${ws.break_end}\n`;
    });
    fs.writeFileSync(path.join(DATA_DIR, 'work_slot.csv'), csv, 'utf8');
    console.log(`✅ work_slot.csv (${workSlots.length} слотов)`);
    return workSlots;
}

// Функция для получения доступных часов для врача в день
function getAvailableHoursForDoctor(doctorId, date, workSlotsMap) {
    const key = `${doctorId}|${date}`;
    const slot = workSlotsMap[key];
    if (!slot) return [];
    
    const startHour = parseInt(slot.start_time.split(':')[0]);
    const endHour = parseInt(slot.end_time.split(':')[0]);
    const slotMinutes = slot.slots_minutes;
    const stepHours = slotMinutes / 60;
    
    const breakStartHour = slot.break_start ? parseInt(slot.break_start.split(':')[0]) : null;
    const breakEndHour = slot.break_end ? parseInt(slot.break_end.split(':')[0]) : null;
    
    const hours = [];
    for (let hour = startHour; hour < endHour; hour += stepHours) {
        if (breakStartHour !== null && hour >= breakStartHour && hour < breakEndHour) {
            continue;
        }
        const timeStr = `${Math.floor(hour).toString().padStart(2, '0')}:00`;
        hours.push(timeStr);
    }
    return hours;
}

// Генерация записей и отмен
function generateAppointmentsAndCancelled(workSlots) {
    // Создаём карту слотов для быстрого доступа
    const workSlotsMap = {};
    for (const ws of workSlots) {
        const key = `${ws.id}|${ws.date}`;
        workSlotsMap[key] = ws;
    }
    
    // Собираем все возможные варианты записи
    const allPossibleAppointments = [];
    for (const ws of workSlots) {
        const hours = getAvailableHoursForDoctor(ws.id, ws.date, workSlotsMap);
        for (const hour of hours) {
            allPossibleAppointments.push({
                doctor_id: ws.id,
                date: ws.date,
                time: hour,
                slot_datetime: `${ws.date} ${hour}`
            });
        }
    }
    
    console.log(`   Возможных слотов для записи: ${allPossibleAppointments.length}`);
    
    // Берём случайные APPOINTMENT_COUNT записей
    const shuffled = [...allPossibleAppointments];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedAppointments = shuffled.slice(0, Math.min(APPOINTMENT_COUNT, shuffled.length));
    
    // Генерируем записи (15% cancelled)
    const appointments = [];
    const cancelledList = [];
    let nextId = 1;
    
    for (const apt of selectedAppointments) {
        const isCancelled = Math.random() < 0.15; // 15% cancelled
        const status = isCancelled ? 'cancelled' : 'booked';
        
        // Случайный пациент
        const patientNum = Math.floor(Math.random() * PATIENT_COUNT) + 1;
        const patientId = generatePatientId(patientNum - 1);
        
        appointments.push({
            appt_id: nextId,
            doctor_id: apt.doctor_id,
            patient_code: patientId,
            slot_datetime: apt.slot_datetime,
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
console.log('\n🚀 Начинаем генерацию тестовых данных T2...\n');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

generateSpeciality();
generateUsers();
const workSlots = generateWorkSlots();
generateAppointmentsAndCancelled(workSlots);

console.log('\n✅ Генерация T2 завершена! Файлы сохранены в папку data/\n');
console.log(`📊 Статистика T2:`);
console.log(`   - Врачей: ${DOCTOR_COUNT}`);
console.log(`   - Пациентов: ${PATIENT_COUNT}`);
console.log(`   - Рабочих дней: ${WORK_DAYS_COUNT}`);
console.log(`   - Слотов: ${workSlots.length}`);
console.log(`   - Записей: ~${APPOINTMENT_COUNT}`);