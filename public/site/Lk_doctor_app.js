'use strict';

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
    appt: document.querySelector('.appointments'),
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
    window.location.href = './Main_screen.html';
});

//клик на кнопку выхода
page.nav.exit.addEventListener('click', () => {
    localStorage.removeItem('userId');
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
    let yearNow = (new Date()).getFullYear();
    let firstDayIndex = (new Date(yearNow, month, 1, 0, 0, 0)).getDay();
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
        if (localStorage.getItem('theme') === 'light'){
            e.target.style.backgroundColor = '#EFEFFF';
        }
        else if (localStorage.getItem('theme') === 'dark'){
            e.target.style.backgroundColor = '#5267af';
        }
        let selectedYear = new Date().getFullYear();
        let selectedMonth = String(page.calendar.monthInput.value).padStart(2, '0');
        let selectedDayNumber = String(e.target.textContent).padStart(2, '0');
        let selectedDate = `${selectedYear}-${selectedMonth}-${selectedDayNumber}`;
        try {
            const appointments = await getDoctorAppointments(localStorage.getItem('userId'), selectedDate);
            loadAppointments(appointments);
        }
        catch (error) {
            console.error('Ошибка загрузки записей:', error.message);
        }
    }
});

//Загрузка записей
function loadAppointments(arrAppt){
    let dateNow = new Date();
    for (let i = 0; i < arrAppt.length; i++) {
        if ((arrAppt[i]).status != 'canceled'){
            let item = document.createElement('div');
            item.setAttribute('class','appt_item');
            let content = document.createElement('div');
            content.setAttribute('class', 'text_content');
            let patientFio = (arrAppt[i]).patientName.split(' ');
            let patientSurname = patientFio[0];
            let patientFirstName = (patientFio[1])[0];
            let patientSecondName = (patientFio[2])[0];
            let time = (((arrAppt[i]).datetime).split(' '))[1];
            content.innerText = `${patientSurname} ${patientFirstName}.${patientSecondName}. ${time}`;
            if ((arrAppt[i]).status === 'completed'){
                content.style.textDecoration = 'line-through';
            }
            item.appendChild(content);
            page.appt.appendChild(item);
        }
        
    }
}

// Функция получения записей врача на конкретную дату
async function getDoctorAppointments(doctorId, date) {
    try {
        const url = `http://localhost:3000/doctor/appointments?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.status === 200) {
            return data.appointments;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Нужны doctorId и date" или ошибка валидации даты
        }
        
        if (response.status === 404) {
            throw new Error(data.error || 'Записи не найдены');
        }
        
        throw new Error(data.error || 'Ошибка получения записей');
        
    } catch (error) {
        console.error('Ошибка получения записей врача:', error.message);
        throw error;
    }
}



//Проверка входа 
function CheckEnter(){
    if (!localStorage.getItem('userId')){
        window.location.href = './Enter.html';
    }
}

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
        page.nav.button.style.backgroundImage = 'url(./img/Union_light.svg)';
    }
}

(()=>{
    CheckEnter();
    CheckTheme();
    page.calendar.monthInput.value = new Date().getMonth()+1;
    getFirstDay();
})()