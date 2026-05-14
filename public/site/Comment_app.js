'use strict';

let flag = localStorage.getItem('flag');
if (flag === 'delete'){
    document.querySelector('form').action = './Lk_patient.html';
}
else if (flag === 'transfer'){
    document.querySelector('form').action = './ch2_date.html';
}

const page = {
    comm: document.querySelector('#comm'),
    button: document.querySelector('#comm_butt'),
}

// Функция отмены записи на прием
async function cancelAppointment(doctorId, patientCode, slotDateTime, whycanceled) {
    try {
        const response = await fetch('http://localhost:3000/appointments/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                doctorId: doctorId,
                patientCode: patientCode,
                slotDateTime: slotDateTime,  // формат "YYYY-MM-DD HH:MM"
                whycanceled: whycanceled
            })
        });

        const data = await response.json();

        if (response.status === 200) {
            return data;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Все поля обязательны"
        }
        
        if (response.status === 404) {
            throw new Error(data.error); // "Запись не найдена"
        }
        
        throw new Error(data.error || 'Ошибка отмены записи');
        
    } catch (error) {
        console.error('Ошибка отмены записи:', error.message);
        throw error;
    }
}

page.button.addEventListener('click', async () => {
    
    let comment = page.comm.value;
    if (flag === 'delete'){
        comment = 'Отмена: ' + comment;
    }
    else if (flag === 'transfer'){
        comment = 'Перенос: ' + comment;
    }
    let doctorId = localStorage.getItem('doctorId');
    let patientCode = localStorage.getItem('userId');
    let slotDateTime = `${localStorage.getItem('date')} ${localStorage.getItem('time')}`;
    try {
        let result = await cancelAppointment(doctorId, patientCode, slotDateTime, comment);
    }
    catch (error) {
        console.error('Ошибка:', error.message);
        alert(error.message);
    }
});