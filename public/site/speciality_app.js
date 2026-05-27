'use strict';

let specialtiesArr = [];

// Функция получения всех специальностей
async function getSpecialities() {
    try {
        const url = `http://localhost:3000/speciality`;
        
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
        
        if (response.status === 500) {
            throw new Error(data.error || 'Ошибка сервера');
        }
        
        throw new Error(data.error || 'Ошибка получения списка специальностей');
        
    } catch (error) {
        console.error('Ошибка получения специальностей:', error.message);
        throw error;
    }
}

async function loadSpecialties(){
    try {
        specialtiesArr = await getSpecialities();
        const uniqueSpecialities = [...new Set(specialtiesArr.map(item => item.speciality))];
        getSpecialtiesPage(uniqueSpecialities);
    }
    catch (error) {
        console.error('Ошибка загрузки записей:', error.message);
    }
}

document.querySelector('.search').addEventListener('input', () =>{
    const specialtyItems = document.querySelectorAll('.allspecialties-item');
    const searchTerm = document.querySelector('.search').value.toLowerCase().trim();
    const searchWords = searchTerm.split(' ').filter(word => word.length > 0);
    specialtyItems.forEach(item => {
        const specialtyName = item.textContent.toLowerCase();
        if (searchTerm === '') {
            item.style.display = 'block'; 
            return;
        }
        // Проверяем, содержит ли имя все слова из поиска
        const matchesAllWords = searchWords.every(word => 
            specialtyName.includes(word)
        );
        item.style.display = matchesAllWords ? 'block' : 'none';
    });
});

document.querySelector('.allspecialties').addEventListener('click', async (e) => {
    if (e.target.className === 'allspecialties-item'){
        localStorage.setItem('doctorSpecialty', e.target.innerText);
        window.location.href = './ch1.html';
    }
})

function getSpecialtiesPage(specialtiesArr){
    for (const elem of specialtiesArr){
        const element = document.createElement('button');
        element.setAttribute('class','allspecialties-item');
        element.textContent = elem;
        document.querySelector('.allspecialties').appendChild(element);
    }
}

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
    }
}

(()=>{
    CheckTheme();
    loadSpecialties();
})()