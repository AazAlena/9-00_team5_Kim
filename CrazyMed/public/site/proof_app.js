'use strict';

const page = {
    buttonProof: document.querySelector('.proof-button'),
    content: document.querySelector('.data-content'),
    return: document.querySelector('.return'),
};

function loadData(){
    console.log(1);
    let fio = localStorage.getItem('doctorFio').split(' ');
    let spec = localStorage.getItem('doctorSpecialty');
    let date = localStorage.getItem('date').split('-').reverse().join('.');
    let time = localStorage.getItem('time');
    page.content.innerHTML = `Ф.И.О.:<p>${fio[0]} ${fio[1]}<br>${fio[2]}</p><br>
                Специальность:<p>${spec}</p><br>
                Дата и время:<p>${date} ${time}</p>`;
}

// Функция создания новой записи на прием
async function createAppointment(doctorId, slotDateTime, patientCode) {
    try {
        const response = await fetch('http://localhost:3000/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                doctorId: doctorId,
                slotDateTime: slotDateTime,  // формат "YYYY-MM-DD HH:MM"
                patientCode: patientCode
             })
        });

        const data = await response.json();

        if (response.status === 201) {
            return data;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Все поля обязательны", "Нельзя записаться на прошедшую дату", "Врач не работает в указанную дату"
        }
        
        if (response.status === 409) {
            throw new Error(data.error); // "Слот уже занят"
        }
        
        throw new Error(data.error || 'Ошибка создания записи');
        
    } catch (error) {
        console.error('Ошибка создания записи:', error.message);
        throw error;
    }
}

page.buttonProof.addEventListener('click', async () => {
    let patientCode = localStorage.getItem('userId');
    let doctorId = localStorage.getItem('doctorId');
    let slotDateTime = `${localStorage.getItem('date')} ${localStorage.getItem('time')}` ;
    console.log(patientCode,doctorId,slotDateTime);
    try {
        const result = await createAppointment(doctorId, slotDateTime, patientCode);
        localStorage.removeItem('doctorFio');
        localStorage.removeItem('doctorId');
        localStorage.removeItem('time');
        localStorage.removeItem('date');
        localStorage.removeItem('doctorsAvailable');
        localStorage.removeItem('doctorSpecialty');
        window.location.href = './Lk_patient.html';
    } catch (error) {
        console.error('Ошибка:', error.message);
        alert(`Не удалось записаться: ${error.message}`);
    }
});

page.return.addEventListener('click', () => {
    localStorage.removeItem('dateTime');
    window.location.href = './speciality.html';
});

(() => {
    loadData();
})();