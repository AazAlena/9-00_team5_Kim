
// Проверка ID врача
function validateDoctorId(doctorId) {
    const id = Number(doctorId);

    return { valid: true, value: id };
}

// Проверка даты (формат YYYY-MM-DD)
function validateDate(dateStr) {
    // Проверка формата регулярным выражением
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        return { valid: false, message: 'Дата должна быть в формате ГГГГ-ММ-ДД' };
    }
    
    // Проверка, что это реальная дата
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return { valid: false, message: 'Некорректная дата' };
    }
    
    return { valid: true, value: dateStr };
}

// Проверка даты и времени (формат YYYY-MM-DD HH:MM:SS)
function validateDateTime(dateTimeStr) {
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!dateTimeRegex.test(dateTimeStr)) {
        return { 
            valid: false, 
            message: 'Дата и время должны быть в формате ГГГГ-ММ-ДД ЧЧ:ММ:СС' 
        };
    }
    
    const dateTime = new Date(dateTimeStr);
    if (isNaN(dateTime.getTime())) {
        return { valid: false, message: 'Некорректная дата и время' };
    }
    
    // Проверка, что дата не в прошлом (опционально)
    // if (dateTime < new Date()) {
    //     return { valid: false, message: 'Нельзя записаться на прошедшую дату' };
    // }
    
    return { valid: true, value: dateTimeStr };
}

// Проверка кода пациента
function validatePatientCode(code) {
    
    
    return { valid: true, value: code };
}

module.exports = {
    validateDoctorId,
    validateDate,
    validateDateTime,
    validatePatientCode
};