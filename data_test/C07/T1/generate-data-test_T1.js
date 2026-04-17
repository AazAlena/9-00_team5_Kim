const fs = require('fs');
const path = require('path');

 
// НАСТРОЙКИ
 
const DATA_DIR = path.join(__dirname);

// Специальности (id совпадает с id врача)
const specialities = [
    { id: 'D1', name: 'Терапевт' },
    { id: 'D2', name: 'Кардиолог' },
    { id: 'D3', name: 'Хирург' },
    { id: 'D4', name: 'Невролог' },
    { id: 'D5', name: 'Офтальмолог' }
];

// Врачи
const doctors = [
    { id: 'D1', fio: 'Иванов Иван Иванович', email: 'ivanov@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D2', fio: 'Петрова Мария Сергеевна', email: 'petrova@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D3', fio: 'Сидоров Алексей Петрович', email: 'sidorov@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D4', fio: 'Кузнецова Елена Владимировна', email: 'kuznetsova@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D5', fio: 'Смирнов Андрей Андреевич', email: 'smirnov@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D6', fio: 'Васильева Ольга Дмитриевна', email: 'vasilyeva@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D7', fio: 'Федоров Игорь Павлович', email: 'fedorov@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D8', fio: 'Михайлова Татьяна Сергеевна', email: 'mikhailova@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D9', fio: 'Новиков Дмитрий Алексеевич', email: 'novikov@clinic.ru', password: '123', role: 'doctor' },
    { id: 'D10', fio: 'Соколова Анна Владимировна', email: 'sokolova@clinic.ru', password: '123', role: 'doctor' }
];

// Пациенты
const patients = [];
for (let i = 1; i <= 15; i++) {
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

// Рабочие дни (даты)
const workDates = ['2025-05-20', '2025-05-21', '2025-05-22', '2025-05-23'];

// Расписание для каждого врача
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

 
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 

function getAllAvailableHoursForDoctor(doctorId, date, workSlots) {
    // Находим слот для этого врача на эту дату
    const slot = workSlots.find(ws => ws.id === doctorId && ws.date === date);
    if (!slot) return [];
    
    const startHour = parseInt(slot.start_time.split(':')[0]);
    const endHour = parseInt(slot.end_time.split(':')[0]);
    const slotMinutes = slot.slots_minutes;
    const stepHours = slotMinutes / 60;
    
    const breakStartHour = slot.break_start ? parseInt(slot.break_start.split(':')[0]) : null;
    const breakEndHour = slot.break_end ? parseInt(slot.break_end.split(':')[0]) : null;
    
    const hours = [];
    for (let hour = startHour; hour < endHour; hour += stepHours) {
        // Пропускаем перерыв
        if (breakStartHour !== null && hour >= breakStartHour && hour < breakEndHour) {
            continue;
        }
        const timeStr = `${Math.floor(hour).toString().padStart(2, '0')}:00`;
        hours.push(timeStr);
    }
    return hours;
}

 
// ГЕНЕРАЦИЯ ФАЙЛОВ
 

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
    console.log('✅ user.csv');
}

// 3. work_slot.csv
function generateWorkSlots() {
    let csv = 'id,date,start_time,end_time,slots_minutes,break_start,break_end\n';
    
    for (const doctor of doctors) {
        const schedule = doctorSchedules[doctor.id];
        if (!schedule) continue;
        
        for (const date of workDates) {
            csv += `${doctor.id},${date},${schedule.start},${schedule.end},60,${schedule.break_start},${schedule.break_end}\n`;
        }
    }
    
    fs.writeFileSync(path.join(DATA_DIR, 'work_slot.csv'), csv, 'utf8');
    console.log('✅ work_slot.csv');
}

// 4. appointment.csv (200 записей) и canceled_appointment.csv
function generateAppointmentsAndCancelled() {
    // Сначала генерируем work_slot, чтобы знать доступные часы
    const workSlots = [];
    for (const doctor of doctors) {
        const schedule = doctorSchedules[doctor.id];
        if (!schedule) continue;
        for (const date of workDates) {
            workSlots.push({
                id: doctor.id,
                date: date,
                start_time: schedule.start,
                end_time: schedule.end,
                slots_minutes: 60,
                break_start: schedule.break_start,
                break_end: schedule.break_end
            });
        }
    }
    
    // Собираем все возможные варианты записи (врач, дата, время)
    const allPossibleAppointments = [];
    for (const slot of workSlots) {
        const hours = getAllAvailableHoursForDoctor(slot.id, slot.date, workSlots);
        for (const hour of hours) {
            allPossibleAppointments.push({
                doctor_id: slot.id,
                date: slot.date,
                time: hour,
                slot_datetime: `${slot.date} ${hour}`
            });
        }
    }
    
    console.log(`   Возможных слотов для записи: ${allPossibleAppointments.length}`);
    
    // Берём случайные 200 записей (или меньше, если недостаточно)
    const targetCount = Math.min(200, allPossibleAppointments.length);
    const shuffled = [...allPossibleAppointments];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedAppointments = shuffled.slice(0, targetCount);
    
    // Генерируем статусы (80% booked, 20% cancelled)
    const appointments = [];
    const cancelledList = [];
    let nextId = 1;
    
    for (const apt of selectedAppointments) {
        const isCancelled = Math.random() < 0.2; // 20% cancelled
        const status = isCancelled ? 'cancelled' : 'booked';
        
        // Случайный пациент
        const patient = patients[Math.floor(Math.random() * patients.length)];
        
        appointments.push({
            appt_id: nextId,
            doctor_id: apt.doctor_id,
            patient_code: patient.id,
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
 
// ЗАПУСК
 

console.log('\n🚀 Начинаем генерацию тестовых данных T1...\n');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

generateSpeciality();
generateUsers();
generateWorkSlots();
generateAppointmentsAndCancelled();

console.log('\n✅ Генерация завершена! Файлы сохранены в папку data/\n');