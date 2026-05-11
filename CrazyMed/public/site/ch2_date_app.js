'use strict';
import * as chrono from 'https://cdn.jsdelivr.net/npm/chrono-node@2.9.0/dist/esm/locales/ru/index.js';

let appointments = [];

// Функция получения слотов врача на конкретную дату (с отметкой доступности)
async function getDoctorSlots(doctorId, date) {
    try {
        const url = `http://localhost:3000/slots/doctors/data?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.status === 200) {
            console.log(data);
            return data;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Нужны doctorId и date" или ошибка валидации даты
        }
        
        if (response.status === 404) {
            throw new Error(data.error || data.message || 'Расписание не найдено');
        }
        
        throw new Error(data.error || 'Ошибка получения слотов врача');
        
    } catch (error) {
        console.error(' Ошибка получения слотов врача:', error.message);
        throw error;
    }
}

function filtArray(arr){
    const len = arr.length;
    let filterArr = [];
    if ((arr.filter(elem => elem.isAvailable === true)).length === arr.length){
        filterArr = arr;
    }
    else{
        for (let index = 0; index < len; index++){
            if (index != 0 && index != len-1){
                if ( (arr[index+1].isAvailable === false && arr[index].isAvailable === true) || 
                (arr[index-1].isAvailable === false && arr[index].isAvailable === true)){
                    filterArr.push(arr[index]);
                }
            }else if ((index==0 && arr[index+1].isAvailable === false && arr[index].isAvailable === true) ||
                (index==len-1 && arr[index-1].isAvailable === false && arr[index].isAvailable === true)){
                    filterArr.push(arr[index]);
            };
        }
    }

    return filterArr;
}

async function loadSlots(date){
    try {
        let result = await getDoctorSlots(localStorage.getItem('doctorId'), date);
        let appt = filtArray(result.slots);
        appt.sort((a, b) => a.time.localeCompare(b.time));
        let futureId = -1;
        appt.forEach(elem => {
            futureId++;
            if (new Date(localStorage.getItem('date')).setHours(0,0,0,0) === new Date().setHours(0,0,0,0)){
                if (new Date().setHours(Number((elem.time).split(':')[0]),Number((elem.time).split(':')[1]), 0, 0) > Number(new Date())){
                    let el = document.createElement('button');
                    el.setAttribute('class', 'alltimes-item');
                    el.setAttribute('id', String(futureId));
                    el.innerText = elem.time;
                    document.querySelector('.alltimes').appendChild(el);
                }
            }else{
                let el = document.createElement('button');
                el.setAttribute('class', 'alltimes-item');
                el.setAttribute('id', String(futureId));
                el.innerText = elem.time;
                document.querySelector('.alltimes').appendChild(el);
            }
            
        });
    }
    catch (error) {
        console.error('Ошибка загрузки записей:', error.message);
        alert(error.message);
    }
}

function parseDayMonth(input, referenceDate = new Date()) {
    // Проверяем формат ДД.ММ
    const match = input.match(/^(\d{2})\.(\d{2})$/);
    if (!match) {
        // Если не подходит под ДД.ММ — пробуем распарсить chrono'м
        return chrono.parseDate(input, new Date().setHours(0,0,0) , { forwardDate: true });
    }
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const refDateOnly = new Date(referenceDate);
    refDateOnly.setHours(0, 0, 0, 0); // отбрасываем время
    let candidateDate = new Date(refDateOnly.getFullYear(), month, day);
    if (candidateDate < refDateOnly) {
        candidateDate = new Date(refDateOnly.getFullYear() + 1, month, day);
    }
    return candidateDate;
}


document.querySelector('.search').addEventListener('input', () =>{
    if (document.querySelector('.alltimes').innerHTML != ''){
        document.querySelector('.alltimes').innerHTML = '';
    };
    let text = document.querySelector('#date').value;
    let date = parseDayMonth(text);
    if (date != null && new Date(date).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0)){
        let today = new Date();
        if (date.getFullYear() != today.getFullYear() && date.getDate() === today.getDate() && date.getMonth() === today.getMonth()){
            let d = new Date(date.setFullYear(today.getFullYear()));
            date = d;
        }
        let dateSearch = String(date.getFullYear()) + '-' + String(date.getMonth()+1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        localStorage.setItem('date', dateSearch);
        console.log(dateSearch);
        loadSlots(dateSearch);
    }
});

document.querySelector('.alltimes').addEventListener('click', (e) => {
    if (e.target.type === "submit"){
        localStorage.setItem('time', e.target.textContent);
        localStorage.setItem('date', document.querySelector('.search').value);
        window.location.href = './proof.html';
    };
});

(() => {
    if (localStorage.getItem('doctorId') && localStorage.getItem('flag') === 'transfer'){
        let dateTime = (localStorage.getItem('dateTime').split(' ')[0]).split('-');
        document.querySelector('.search').value =`${dateTime[2]}.${dateTime[1]}`;
    }
    if (document.querySelector('.search').value != ''){
        let text = document.querySelector('#date').value;
        loadSlots(new Date().getFullYear() + '-' + text.split('.')[1] + '-' + text.split('.')[0]);
    };  
})();