'use strict';

const page = {
    comm: document.querySelector('#comm'),
    button: document.querySelector('#comm_butt'),
}

// Функция отмены записи на прием
async function cancelAppointment(doctorId, patientCode, slotDateTime, whyCancelled) {
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
                whyCancelled: whyCancelled
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
    let flag = localStorage.getItem('flag');
    let comment = page.comm.value;
    if (flag === 'delete'){
        comment = 'Отмена: ' + comment;
    }
    else if (flag === 'transfer'){
        comment = 'Перенос: ' + comment;
    }
    let doctorId = localStorage.getItem('doctorId');
    let patientCode = localStorage.getItem('userId');
    let slotDateTime = localStorage.getItem('dateTime');
    try {
        let result = await cancelAppointment(doctorId, patientCode, slotDateTime, comment);
        localStorage.removeItem('doctorId');
        if (flag === 'delete'){
            localStorage.removeItem('flag');
            window.location.href = './Lk_patient.html';
        }
        else{
            localStorage.removeItem('flag');
            window.location.href = './speciality.html';
        }
        
    }
    catch (error) {
        console.error('Ошибка:', error.message);
        alert(error.message);
    }
});