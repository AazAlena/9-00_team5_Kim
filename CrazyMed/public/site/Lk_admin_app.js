'use strict';

let doctors = [];
let selectedDate = '';

//Объявление переменных
const page = {
    nav: {
        button: document.querySelector('#nav_butt'),
        fill: document.querySelector('#nav_fill'),
        main: document.querySelector('#main_butt'),
        newAppt: document.querySelector('#Appt_butt'),
        exit: document.querySelector('#Esc_butt'),
    },
    calendar: {
        section: document.querySelector('#calendar'),
        monthInput: document.querySelector('#month'),
    },
    appt: document.querySelector('.doctors'),
};

//клик на кнопку навигации
page.nav.button.addEventListener('click', () => {
    let navFill = page.nav.fill;
    if (navFill.style.display === 'block'){
        navFill.style.display = 'none';
    }
    else{
        navFill.style.display = 'block';
    }
});

//клик на кнопку главная
page.nav.main.addEventListener('click', () => {
    localStorage.removeItem('dateTime');
    localStorage.removeItem('doctorFio');
    localStorage.removeItem('doctorId');
    window.location.href = './Main_screen.html';
});

//клик на кнопку выхода
page.nav.exit.addEventListener('click', () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('dateTime');
    localStorage.removeItem('doctorFio');
    localStorage.removeItem('doctorId');
    localStorage.removeItem('role');
    window.location.href = './Main_screen.html';
});

//Загрузка календаря
function loadDays(emptyLen,daysLen){
    const namesDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    for (let i = 0; i < 7; i++){
        let elem = document.createElement('div');
        elem.setAttribute('class','day');
        elem.innerText = namesDays[i];
        page.calendar.section.appendChild(elem);
    }
    for (let i = 0; i < emptyLen; i++){
        let elem = document.createElement('div');
        elem.setAttribute('class','item');
        page.calendar.section.appendChild(elem);
    }
    for (let i = 0; i < daysLen; i++) {
        let elem = document.createElement('div');
        elem.setAttribute('class','item');
        let but = document.createElement('button');
        but.innerText = String(i+1);
        elem.appendChild(but);
        page.calendar.section.appendChild(elem);
    }
}

function getFirstDay(){
    let month = Number(page.calendar.monthInput.value) - 1;
    let yearNow = '2025'; //(new Date()).getFullYear();
    let firstDayIndex = (new Date(yearNow, month, 1, 0, 0, 0)).getDay()
    let firstDay =  firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    let lastDay = new Date(yearNow, month+1, 0).getDate();
    loadDays(firstDay,lastDay);
}

//Отчистка календаря
function removeDays(){
    page.calendar.section.innerHTML = '';
}

//Отчистка временных слотов
function removeAppt(){
    page.appt.innerHTML = '';
}

//Обновление календаря при изменении месяца
page.calendar.monthInput.addEventListener('change', () => {
    removeDays();
    getFirstDay();
});

//Клик на дату
page.calendar.section.addEventListener('click', async (e) => {
    if (e.target.type === 'submit'){
        removeAppt();
        let allButtons = Array.from(page.calendar.section.querySelectorAll('.item button'));
        allButtons.forEach(button => {
            button.style.backgroundColor = '';
        });
        e.target.style.backgroundColor = '#EFEFFF';
        let selectedMonth = String(page.calendar.monthInput.value).padStart(2, '0');
        let selectedDayNumber = String(e.target.textContent).padStart(2, '0');
        selectedDate = `2025-${selectedMonth}-${selectedDayNumber}`;
        console.log(selectedDate);
        try {
            doctors = await getWorkingDoctors(selectedDate);
            loadDoctors(doctors);
        }
        catch (error) {
            console.error('Ошибка загрузки записей:', error.message);
            alert(error.message);
        }
    }
});

//Загрузка врачей
function loadDoctors(arrDoctors){
    for (let i = 0; i < arrDoctors.length; i++) {
        let item = document.createElement('div');
        item.setAttribute('class','doctors_item');
        let doctorFio = (arrDoctors[i]).fio.split(' ');
        let doctorSurname = doctorFio[0];
        let doctorFirstName = (doctorFio[1])[0];
        let doctorSecondName = (doctorFio[2])[0];
        item.innerText = `${doctorSurname} ${doctorFirstName}.${doctorSecondName}.`;
        item.setAttribute('id', i);
        page.appt.appendChild(item);
    }
}

// Функция получения врачей, работающих в указанную дату
async function getWorkingDoctors(date) {
    try {
        const url = `http://localhost:3000/doctors/working?date=${encodeURIComponent(date)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.status === 200) {
            return data.doctors;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Нужна date" или ошибка валидации даты
        }
        
        if (response.status === 404) {
            throw new Error(data.error || 'Врачи не найдены');
        }
        
        throw new Error(data.error || 'Ошибка получения списка врачей');
        
    } catch (error) {
        console.error('Ошибка получения работающих врачей:', error.message);
        throw error;
    }
}

//Клик на врача
page.appt.addEventListener('click', async (e) => {
    if (e.target.className === 'doctors_item'){
        localStorage.setItem('doctorId', doctors[e.target.id].id);
        localStorage.setItem('doctorFio', doctors[e.target.id].fio);
        localStorage.setItem('dateTime', selectedDate);
        window.location.href = './Lk_admin2.html';
    }
});

//Проверка входа 
function CheckEnter(){
    if (!localStorage.getItem('userId')){
        window.location.href = './Enter.html';
    }
}

(()=>{
    CheckEnter();
    if (localStorage.getItem('dateTime')){
        page.calendar.monthInput.value = String(Number(localStorage.getItem('dateTime').split('-')[1]));
        getFirstDay();
        Array.from(page.calendar.section.children).forEach(elem => {
            if (elem.innerText === String(Number(localStorage.getItem('dateTime').split('-')[2]))){
                elem.firstChild.style.backgroundColor = '#EFEFFF';
                elem.firstChild.click();
            }
        });
    }else{
        getFirstDay();
    }
})()