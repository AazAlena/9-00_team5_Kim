'use strict';

let appointments = [];

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
    localStorage.removeItem('doctorFio');
    localStorage.removeItem('doctorSpecialty');
    window.location.href = './Main_screen.html';
});

//клик на кнопку записи на приём
page.nav.newAppt.addEventListener('click', () => {
    window.location.href = './speciality.html';
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
    console.log(firstDay,lastDay);
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
            appointments = await getPatientAppointments(localStorage.getItem('userId'), selectedDate);
            loadAppointments(appointments);
        }
        catch (error) {
            console.error('Ошибка загрузки записей:', error.message);
            alert(error.message);
        }
    }
});

//Загрузка записей
function loadAppointments(arrAppt){
    for (let i = 0; i < arrAppt.length; i++) {
        if (arrAppt[i].status != "canceled"){
            let item = document.createElement('div');
            item.setAttribute('class','appt_item');
            item.setAttribute('id',String(i))
            let content = document.createElement('div');
            content.setAttribute('class', 'text_content');
            let specialty = (arrAppt[i]).doctorSpecialty;
            let time = (((arrAppt[i]).datetime).split(' '))[1];
            content.innerText = `${specialty} ${time}`;
            if ((arrAppt[i]).status === 'completed'){
                content.style.textDecoration = 'line-through';
                item.style.pointerEvents = 'none';
            }
            item.appendChild(content);
            let buttons = document.createElement('div');
            buttons.setAttribute('class','buttons');
            buttons.innerHTML = `<button class="delete" type="button"></button><button class="transfer" type="button"></button>`;
            item.appendChild(buttons);
            page.appt.appendChild(item);
        }
    }
}

// Функция получения записей пациента на конкретную дату
async function getPatientAppointments(patientId, date) {
    try {
        const url = `http://localhost:3000/patient/appointments?patientId=${encodeURIComponent(patientId)}&date=${encodeURIComponent(date)}`;
        
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
            throw new Error(data.error); // "Нужны patientId и date"
        }
        
        if (response.status === 404) {
            throw new Error(data.error || 'Записи не найдены');
        }
        
        throw new Error(data.error || 'Ошибка получения записей');
        
    }
    catch (error) {
        console.error('Ошибка получения записей:', error.message);
        throw error;
    }
}

//Клик на слот
page.appt.addEventListener('click', async (e) => {
    if (e.target.className === 'appt_item'){
        localStorage.setItem('date', (appointments[e.target.id].datetime).split(' ')[0]);
        localStorage.setItem('time', (appointments[e.target.id].datetime).split(' ')[1]);
        localStorage.setItem('doctorId', appointments[e.target.id].doctorId);
        localStorage.setItem('doctorFio', appointments[e.target.id].doctorName);
        localStorage.setItem('doctorSpecialty', appointments[e.target.id].doctorSpecialty);
    }
    if (e.target.className === 'text_content'){
        localStorage.setItem('date', (appointments[e.target.parentElement.id].datetime).split(' ')[0]);
        localStorage.setItem('time', (appointments[e.target.parentElement.id].datetime).split(' ')[1]);
        localStorage.setItem('doctorId', appointments[e.target.parentElement.id].doctorId);
        localStorage.setItem('doctorFio', appointments[e.target.parentElement.id].doctorName);
        localStorage.setItem('doctorSpecialty', appointments[e.target.parentElement.id].doctorSpecialty);
    }
    if (e.target.className != 'appointments'&& e.target.className != 'delete' && e.target.className != 'transfer'){
        window.location.href = './Appt_inf.html';
    }
    else if (e.target.className === 'delete'){
        localStorage.setItem('date', (appointments[e.target.parentElement.parentElement.id].datetime).split(' ')[0]);
        localStorage.setItem('time', (appointments[e.target.parentElement.parentElement.id].datetime).split(' ')[1]);
        localStorage.setItem('doctorId', appointments[e.target.parentElement.parentElement.id].doctorId);
        
        localStorage.setItem('flag', 'delete');
        window.location.href = './Comment.html';
    }
    else if (e.target.className === 'transfer'){
        localStorage.setItem('date', (appointments[e.target.parentElement.parentElement.id].datetime).split(' ')[0]);
        localStorage.setItem('time', (appointments[e.target.parentElement.parentElement.id].datetime).split(' ')[1]);
        localStorage.setItem('doctorId', appointments[e.target.parentElement.parentElement.id].doctorId);
        localStorage.setItem('doctorFio', appointments[e.target.parentElement.parentElement.id].doctorName);
        localStorage.setItem('doctorSpecialty', appointments[e.target.parentElement.parentElement.id].doctorSpecialty);
        localStorage.setItem('flag', 'transfer');
        window.location.href = './Comment.html';
    }
});

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
    if (localStorage.getItem('date')){
        page.calendar.monthInput.value = String(Number(localStorage.getItem('date').split('-')[1]));
        Array.from(page.calendar.section.children).forEach(elem => {
            if (elem.innerText === String(Number(localStorage.getItem('date').split('-')[2]))){
                if (localStorage.getItem('theme') === 'light'){
                    elem.firstChild.style.backgroundColor = '#EFEFFF';
                }
                else if (localStorage.getItem('theme') === 'dark'){
                    elem.firstChild.style.backgroundColor = '#5267af';
                }
                elem.firstChild.click();
            }
        });
        localStorage.removeItem('date');
    }
    if(localStorage.getItem('flag')){
        localStorage.removeItem('flag');
    }
})()

