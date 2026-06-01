'use strict';

//Объявление переменных
const page = {
    sectionForBlock: document.querySelector('.first'),
    calendar: {
        section: document.querySelector('#calendar'),
        monthInput: document.querySelector('#month'),
    },
    utilization: {
        fioData: document.querySelector('#fio_data'),
        percent: document.querySelector('#util'),
        cancel: document.querySelector('#canceled'),
        transfer: document.querySelector('#redo'),
    },
    more: document.querySelector('#more_butt'),
    back: document.querySelector('#arrow'),
};

page.more.addEventListener('click', () => {
    window.location.href = './doc_inf.html';
});

page.back.addEventListener('click', () => {
    window.location.href = './Lk_admin.html';
});

//Загрузка календаря
function loadDays(emptyLen,daysLen){
    page.calendar.monthInput.value = new Date().getMonth()+1;
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
        if (String(i+1) === String(Number(localStorage.getItem('date').split('-')[2]))){
            but.style.backgroundColor = '#EFEFFF';
            if (localStorage.getItem('theme') === 'light'){
                but.style.backgroundColor = '#EFEFFF';
            }
            else if (localStorage.getItem('theme') === 'dark'){
                but.style.backgroundColor = '#5267af';
            }
        }
        elem.appendChild(but);
        page.calendar.section.appendChild(elem);
    }
}

function getFirstDay(){
    let month = Number(localStorage.getItem('date').split('-')[1]) - 1;
    let yearNow = (new Date()).getFullYear();
    let firstDayIndex = (new Date(yearNow, month, 1, 0, 0, 0)).getDay();
    let firstDay =  firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    let lastDay = new Date(yearNow, month+1, 0).getDate();
    page.calendar.monthInput.value = month+1;
    loadDays(firstDay,lastDay);
}

//Проверка входа 
function CheckEnter(){
    if (!localStorage.getItem('userId')){
        window.location.href = './Enter.html';
    }
}

// Функция получения дневной статистики врача (отчет)
async function getDoctorDailyStats(doctorId, date) {
    try {
        const response = await fetch('http://localhost:3000/report/daily-stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                doctorId: doctorId,
                date: date  // формат "YYYY-MM-DD"
            })
        });

        const data = await response.json();

        if (response.status === 200) {
            return data;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Нужны doctorId и date"
        }
        
        if (response.status === 404) {
            throw new Error(data.error || data.message || 'Врач или расписание не найдены');
        }
        
        throw new Error(data.error || 'Ошибка получения статистики');
        
    } catch (error) {
        console.error('Ошибка получения статистики:', error.message);
        throw error;
    }
}

async function loadDoctorInfo(){
    let fio = localStorage.getItem('doctorFio').split(' ');
    let date = localStorage.getItem('date').split('-').reverse().join('.');
    let doctorSurname = fio[0];
    let doctorFirstName = (fio[1])[0];
    let doctorSecondName = (fio[2])[0];
    page.utilization.fioData.innerHTML = `${doctorSurname} ${doctorFirstName}.${doctorSecondName}.<br>${date}`;
    try {
        let result = await getDoctorDailyStats(localStorage.getItem('doctorId'), localStorage.getItem('date'));
        page.utilization.percent.innerText = 'Утилизация: ' + result.completed_percent + '%';
        let arr = result.canceled_list;
        let totalArr = result;
        let transferArr = [];
        let cancelArr = [];
        arr.forEach(el => {
            if (el.reason.slice(0,7) === 'Отмена:'){
                cancelArr.push(el)
            }
            else if (el.reason.slice(0,8) === 'Перенос:'){
                transferArr.push(el)
            }
        });
        delete totalArr.canceled_count;
        delete totalArr.canceled_list;
        totalArr.cancel_arr = cancelArr;
        totalArr.transfer_arr = transferArr;
        localStorage.setItem('doctorUtil', JSON.stringify(totalArr));
        page.utilization.cancel.innerText = 'Кол-во отмен: ' + cancelArr.length;
        page.utilization.transfer.innerText = 'Кол-во переносов: ' + transferArr.length;
    }
    catch (error) {
        console.error('Ошибка загрузки записей:', error.message);
    }
}

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
        document.querySelector('#dark').style.display = 'inline';
        document.querySelector('#light').style.display = 'none';
    }
}

(()=>{
    CheckEnter();
    CheckTheme();
    page.calendar.monthInput.value = new Date().getMonth()+1;
    getFirstDay();
    loadDoctorInfo();
})();