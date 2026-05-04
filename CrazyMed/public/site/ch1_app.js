'use strict';

let appts = []

// для кнопочки выбора по дате
document.querySelector('.button-time').addEventListener('click', () => {
    document.querySelector('.button-time').disabled = true;
    document.querySelector('.button-time').style.cursor = 'default';
    document.querySelector('.button-fio').disabled = false;
    document.querySelector('.button-fio').style.cursor = 'pointer';
    document.querySelector('.alltimes').style.display = 'flex';
    document.querySelector('.allfio').style.display = 'none';
    document.querySelector('.search').id = 'date';
    document.querySelector('.search').value = '';
    document.querySelector('.h1').textContent = 'Выберите время';
    document.querySelector('.search').placeholder = 'ДД.ММ';
    document.querySelector('.search').pattern="(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[012])";
    document.querySelector('.allfio').innerHTML = '';
});

// для кнопочки выбора по фамилии
document.querySelector('.button-fio').addEventListener('click', () => {
    document.querySelector('.button-time').disabled = false;
    document.querySelector('.button-fio').style.cursor = 'default';
    document.querySelector('.button-fio').disabled = true;
    document.querySelector('.button-time').style.cursor = 'pointer';
    document.querySelector('.allfio').style.display = 'flex';
    document.querySelector('.alltimes').style.display = 'none';
    document.querySelector('.search').id = 'fio';
    document.querySelector('.search').value = '';
    document.querySelector('.h1').textContent = 'Выберите врача';
    document.querySelector('.search').placeholder = '';
    document.querySelector('.search').pattern = "none";
    document.querySelector('.alltimes').innerHTML = '';
});

// Функция получения слотов для записи по дате и специальности
async function getAvailableSlots(date, speciality) {
    try {
        const url = `http://localhost:3000/slots?date=${encodeURIComponent(date)}&speciality=${encodeURIComponent(speciality)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.status === 200) {
            console.log(data)
            return data;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Нужны date и speciality" или ошибка валидации даты
        }
        
        if (response.status === 404) {
            throw new Error(data.error || 'Слоты не найдены');
        }
        
        throw new Error(data.error || 'Ошибка получения слотов');
        
    } catch (error) {
        console.error('Ошибка получения слотов:', error.message);
        throw error;
    }
}

function filtArray(arr){
    const len = arr.length;
    let filterArr = [];
    if ((arr.filter(elem => elem.available === true)).length === arr.length){
        filterArr = arr;
    }
    else{
        for (let index = 0; index < len; index++){
            if (index != 0 && index != len-1){
                if ( (arr[index+1].available === false && arr[index].available === true) || 
                (arr[index-1].available === false && arr[index].available === true)){
                    filterArr.push(arr[index]);
                }
            }else if ((index==0 && arr[index+1].available === false && arr[index].available === true) ||
                (index==len-1 && arr[index-1].available === false && arr[index].available === true)){
                    filterArr.push(arr[index]);
            };
        }
    }

    return filterArr;
}

function addDoctor(obj){
    let docId = obj.doctor_id;
    let docFio = obj.doctor_name;
    let slots = obj.slots;
    let i = -1;
    let newSlots = slots.map(slot => {
        i++;
        return {doctor_id: docId, doctor_name: docFio, time: slots[i].time, available: slots[i].available}
    });
    return newSlots;
}

function group(groupedByDoctor){
    // 1. Соединяем все подмассивы в один плоский массив
    const allAppointments = groupedByDoctor.flat();

    // 2. Группируем по полю time с помощью Map
    const timeMap = new Map();

    for (const item of allAppointments) {
    const { time, doctor_id, doctor_name } = item;
    
    if (!timeMap.has(time)) {
        // Если время встречается впервые, создаём структуру с массивами
        timeMap.set(time, {
        time: time,
        doctor_id: [doctor_id],
        doctor_name: [doctor_name],
        available: true // или можно вычислить по всем записям, но у вас везде true
        });
    } else {
        // Добавляем врача к существующему времени
        const entry = timeMap.get(time);
        entry.doctor_id.push(doctor_id);
        entry.doctor_name.push(doctor_name);
        // если вдруг available различается, можно обновить логически
    }
    }

    // 3. Преобразуем Map обратно в массив
    const result = Array.from(timeMap.values());

    return (result);
}

async function loadSlots(date, spec){
    try {
        let result = await getAvailableSlots(date, spec);
        let res = result.map(elem => addDoctor(elem));
        let totalRes = res.map(elem => filtArray(elem));
        let appt = group(totalRes);
        appts = appt;
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

// Функция получения врачей по специальности
async function getDoctorsBySpeciality(speciality) {
    try {
        const url = `http://localhost:3000/doctors/speciality?speciality=${encodeURIComponent(speciality)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.status === 200) {
            return data;
        }
        
        if (response.status === 400) {
            throw new Error(data.error); // "Нужна специальность"
        }
        
        if (response.status === 404) {
            throw new Error(data.error || 'Врачи не найдены');
        }
        
        throw new Error(data.error || 'Ошибка получения врачей');
        
    } catch (error) {
        console.error('Ошибка получения врачей:', error.message);
        throw error;
    }
}

document.querySelector('.search').addEventListener('input', () =>{
    if (document.querySelector('#fio')){
        const doctorItems = document.querySelectorAll('.allfio-item');
        const searchTerm = document.querySelector('.search').value.toLowerCase().trim();
        const searchWords = searchTerm.split(' ').filter(word => word.length > 0);
        doctorItems.forEach(item => {
            const doctorName = item.textContent.toLowerCase();
            if (searchTerm === '') {
                item.style.display = 'block';
                return;
            }
            // Проверяем, содержит ли имя все слова из поиска
            const matchesAllWords = searchWords.every(word => 
                doctorName.includes(word)
            );
            item.style.display = matchesAllWords ? 'block' : 'none';
        });
    }
    else{
        let text = document.querySelector('#date').value;
        if (text.length === 5 && 0<Number(text.split('.')[0])<32 && 0<Number(text.split('.')[1])<13){
            document.querySelector('.alltimes').innerHTML = '';
            loadSlots('2025'+ '-' + text.split('.')[1] + '-' + text.split('.')[0], localStorage.getItem('doctorSpecialty'));
        
        };
    }
});

document.querySelector('.alltimes').addEventListener('click', (e) => {
    if (e.target.type === "submit"){
        let dateSearch = (document.querySelector('.search').value).split('.');
        localStorage.setItem('date','2025' + '-' + dateSearch[1] + '-' + dateSearch[0]);
        localStorage.setItem('time', e.target.textContent);
        localStorage.setItem('doctorsAvailable', JSON.stringify(appts[Number(e.target.id)]));
        window.location.href = './ch2_fio.html';
    };
});

document.querySelector('.allfio').addEventListener('click', (e) => {
    if (e.target.type === "submit"){
        localStorage.setItem('doctorFio',e.target.textContent);
        localStorage.setItem('doctorId', e.target.id);
        window.location.href = './ch2_date.html';
    };
});

async function loadDoctors(){
    try {
        let result = await getDoctorsBySpeciality(localStorage.getItem('doctorSpecialty'));
        result.forEach(elem => {
            let el = document.createElement('button');
            el.setAttribute('class', 'allfio-item');
            el.setAttribute('id', elem.id);
            el.innerText = elem.fio;
            document.querySelector('.allfio').appendChild(el);
        });
    }
    catch (error) {
        console.error('Ошибка загрузки записей:', error.message);
        alert(error.message);
    }
}

(()=>{
    document.querySelector('.button-time').click();
    if (document.querySelector('.search').value != ''){
        document.querySelector('.search').input();
    }
    loadDoctors();
})()