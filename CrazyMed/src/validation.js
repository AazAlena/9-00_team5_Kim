// validation.js
// Все проверки только формата и типа, без обращения к БД.

/**
 * Проверка целочисленного идентификатора (для doctor_id, patient_id, speciality_id)
 * @param {any} id - значение из запроса
 * @returns {{valid: boolean, value: number|null, message: string}}
 */

function validateTextId(id) {
    if (!id || typeof id !== 'string') {
        return { valid: false, value: null, message: 'ID должен быть непустой строкой' };
    }
    if (id.length > 50) {
        return { valid: false, value: null, message: 'ID слишком длинный (макс. 50 символов)' };
    }
    // Дополнительно можно разрешить только определённые символы
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return { valid: false, value: null, message: 'ID может содержать только буквы, цифры, _ и -' };
    }
    return { valid: true, value: id, message: '' };
}

// Алиасы для конкретных ролей
const validateDoctorId = validateTextId;
const validatePatientId = validateTextId;
const validateSpeciality = validateTextId;   // для названия специальности (не id)
const validateSpecialityId = validateTextId; // для id специальности

// ==================== ДАТЫ И ВРЕМЯ ====================

/**
 * Проверка даты в формате YYYY-MM-DD
 * @param {string} dateStr
 */
function validateDate(dateStr) {
    if (typeof dateStr !== 'string') {
        return { valid: false, value: null, message: 'Дата должна быть строкой' };
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        return { valid: false, value: null, message: 'Дата должна быть в формате ГГГГ-ММ-ДД' };
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return { valid: false, value: null, message: 'Некорректная дата' };
    }
    // (опционально) запрет на прошедшие даты – раскомментировать при необходимости
    // const today = new Date();
    // today.setHours(0,0,0,0);
    // if (date < today) {
    //     return { valid: false, value: null, message: 'Дата не может быть в прошлом' };
    // }
    return { valid: true, value: dateStr, message: '' };
}

/**
 * Проверка времени в формате HH:MM
 * @param {string} timeStr
 */
function validateTime(timeStr) {
    if (typeof timeStr !== 'string') {
        return { valid: false, value: null, message: 'Время должно быть строкой' };
    }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeStr)) {
        return { valid: false, value: null, message: 'Время должно быть в формате ЧЧ:ММ (00:00 – 23:59)' };
    }
    return { valid: true, value: timeStr, message: '' };
}

/**
 * Проверка даты и времени в формате YYYY-MM-DD HH:MM (без секунд)
 * @param {string} dateTimeStr
 */
function validateDateTime(dateTimeStr) {
    if (typeof dateTimeStr !== 'string') {
        return { valid: false, value: null, message: 'Дата и время должны быть строкой' };
    }
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!dateTimeRegex.test(dateTimeStr)) {
        return { valid: false, value: null, message: 'Дата и время должны быть в формате ГГГГ-ММ-ДД ЧЧ:ММ' };
    }
    const [datePart, timePart] = dateTimeStr.split(' ');
    const dateValid = validateDate(datePart);
    const timeValid = validateTime(timePart);
    if (!dateValid.valid || !timeValid.valid) {
        return { valid: false, value: null, message: 'Некорректные дата или время' };
    }
    // Дополнительно: можно проверить, что минуты кратны длительности слота? Не здесь.
    return { valid: true, value: dateTimeStr, message: '' };
}

// ==================== ТЕКСТОВЫЕ ПОЛЯ ====================

/**
 * Проверка причины отмены / переноса
 * @param {string} text
 */
function validateWhycanceled(text) {
    if (typeof text !== 'string') {
        return { valid: false, value: null, message: 'Причина отмены должна быть строкой' };
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return { valid: false, value: null, message: 'Причина отмены не может быть пустой' };
    }
    if (trimmed.length > 500) {
        return { valid: false, value: null, message: 'Причина отмены не может быть длиннее 500 символов' };
    }
    return { valid: true, value: trimmed, message: '' };
}

/**
 * Проверка кода пациента (patient_code) – используется при создании записи,
 * но в новой БД пациент идентифицируется по patient_id (число).
 * Оставляем для совместимости с фронтом, где может быть patientCode.
 */
function validatePatientCode(code) {
    if (code === undefined || code === null) {
        return { valid: false, value: null, message: 'Код пациента обязателен' };
    }
    // Если код — число (новый стиль), проверяем как id
    if (typeof code === 'number' || /^\d+$/.test(code)) {
        return validateId(code);
    }
    // Если строка (старый стиль), просто проверяем на пустоту
    if (typeof code !== 'string') {
        return { valid: false, value: null, message: 'Код пациента должен быть строкой или числом' };
    }
    const trimmed = code.trim();
    if (trimmed.length === 0) {
        return { valid: false, value: null, message: 'Код пациента не может быть пустым' };
    }
    if (trimmed.length > 50) {
        return { valid: false, value: null, message: 'Код пациента слишком длинный (макс. 50 символов)' };
    }
    return { valid: true, value: trimmed, message: '' };
}

// ==================== ДОПОЛНИТЕЛЬНО (ЕСЛИ ПОТРЕБУЕТСЯ) ====================

/**
 * Проверка статуса записи (для фильтров или обновлений)
 */
function validateAppointmentStatus(status) {
    const allowed = ['booked', 'canceled', 'served'];
    if (allowed.includes(status)) {
        return { valid: true, value: status, message: '' };
    }
    return { valid: false, value: null, message: `Недопустимый статус. Допустимые: ${allowed.join(', ')}` };
}

/**
 * Проверка email (для регистрации / логина)
 */
function validateEmail(email) {
    if (typeof email !== 'string') {
        return { valid: false, value: null, message: 'Email должен быть строкой' };
    }
    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return { valid: false, value: null, message: 'Неверный формат email' };
    }
    return { valid: true, value: trimmed, message: '' };
}

/**
 * Проверка пароля (минимальная длина)
 */
function validatePassword(password) {
    if (typeof password !== 'string') {
        return { valid: false, value: null, message: 'Пароль должен быть строкой' };
    }
    if (password.length < 3) {
        return { valid: false, value: null, message: 'Пароль должен содержать минимум 3 символа' };
    }
    return { valid: true, value: password, message: '' };
}

module.exports = {
    validateDoctorId,
    validatePatientId,
    validateSpecialityId,
    validateDate,
    validateTime,
    validateDateTime,
    validateWhycanceled,
    validatePatientCode,
    validateAppointmentStatus,
    validateEmail,
    validatePassword
};