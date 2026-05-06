'use strict';
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
        console.log(result);
        let appt = filtArray(result.slots);
        console.log(appt);
        let futureId = -1;
        appt.forEach(elem => {
            futureId++;
            let el = document.createElement('button');
            el.setAttribute('class', 'alltimes-item');
            el.setAttribute('id', String(futureId));
            el.innerText = elem.time;
            document.querySelector('.alltimes').appendChild(el);
        });
    }
    catch (error) {
        console.error('Ошибка загрузки записей:', error.message);
        alert(error.message);
    }
}

document.querySelector('.search').addEventListener('input', () =>{
    let text = document.querySelector('#date').value;
    if (text.length === 5 && 0<Number(text.split('.')[0])<32 && 0<Number(text.split('.')[1])<13){
        document.querySelector('.alltimes').innerHTML = '';
        loadSlots(new Date().getFullYear() + '-' + text.split('.')[1] + '-' + text.split('.')[0]);
    };
});

document.querySelector('.alltimes').addEventListener('click', (e) => {
    if (e.target.type === "submit"){
        let dateSearch = (document.querySelector('.search').value).split('.');
        localStorage.setItem('date', new Date().getFullYear() + '-' + dateSearch[1] + '-' + dateSearch[0]);
        localStorage.setItem('time', e.target.textContent);
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