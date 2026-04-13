'use strict';
document.querySelector('.button-time').disabled = true; 

const date = new Date();
const date1 = date.toISOString().split('T')[0];
const date2 = new Date(date.getTime()+31536000000).toISOString().split('T')[0];
document.querySelector('.search').min = date1;
document.querySelector('.search').max = date2;

// для кнопочки выбора по дате
document.querySelector('.button-time').addEventListener('click', () => {
    document.querySelector('.button-time').disabled = true; 
    document.querySelector('.button-fio').disabled = false;
    document.querySelector('.button-time').style.cursor = 'default';
    document.querySelector('.button-fio').style.cursor = 'pointer';
    document.querySelector('.alltimes').style.display = 'flex';
    document.querySelector('.allfio').style.display = 'none';
    document.querySelector('.search').type = 'date';
    document.querySelector('.search').id = 'date';
    document.querySelector('.h1').textContent = 'Выберите время';
    document.querySelector('.search').classList.remove('search-icon');
    document.querySelector('.search').value = '';
});

// для кнопочки выбора по фамилии
document.querySelector('.button-fio').addEventListener('click', () => {
    document.querySelector('.button-time').disabled = false; 
    document.querySelector('.button-fio').disabled = true;
    document.querySelector('.button-fio').style.cursor = 'default';
    document.querySelector('.button-time').style.cursor = 'pointer';
    document.querySelector('.allfio').style.display = 'flex';
    document.querySelector('.alltimes').style.display = 'none';
    document.querySelector('.search').type = 'text';
    document.querySelector('.search').id = 'fio';
    document.querySelector('.h1').textContent = 'Выберите врача';
    document.querySelector('.search').classList.add('search-icon');
    document.querySelector('.search').value = '';
});

const timeArr = ['8:00','9:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
const fioArr = [
    'Иванов Иван Иванович',
    'Петрова Мария Сергеевна',
    'Сидоров Алексей Владимирович',
    'Кузнецова Елена Андреевна',
    'Смирнов Дмитрий Николаевич',
    'Васильева Ольга Петровна',
    'Попов Андрей Викторович',
    'Соколова Татьяна Дмитриевна',
    'Михайлов Сергей Александрович',
    'Федорова Наталья Юрьевна'
];

function loadTime(){
    for (const el of timeArr){
        const butt = document.createElement('button');
        butt.classList.add('alltimes-item');
        butt.textContent = el;
        document.querySelector('.alltimes').appendChild(butt);
    }
}

function loadFio(){
    for (const el of fioArr){
        const butt = document.createElement('button');
        butt.classList.add('allfio-item');
        butt.textContent = el;
        document.querySelector('.allfio').appendChild(butt);
    }
}


document.querySelector('.search').addEventListener('input', () => {
    // для ввода и поиска нужной фамилии
    if (document.querySelector('.search').type === 'text'){
        if (document.querySelectorAll('.allfio-item')){
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
                    doctorName.includes(word));
                    item.style.display = matchesAllWords ? 'block' : 'none';
                });
            }
    }
});

loadTime();
loadFio();