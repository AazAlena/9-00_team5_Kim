'use strict';

const specialtiesArr = [
    'Терапевт',
    'Педиатр',
    'Кардиолог',
    'Невролог',
    'Хирург',
    'Офтальмолог',
    'ЛОР',
    'Стоматолог',
    'Гинеколог',
    'Уролог',
    'Дерматолог',
    'Эндокринолог',
    'Гастроэнтеролог',
    'Психиатр',
    'Травматолог'
];

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
})

function getSpecialties(specialtiesArr){
    for (const specialty of specialtiesArr){
        const element = document.createElement('button');
        element.setAttribute('class','allspecialties-item');
        element.textContent = specialty;
        document.querySelector('.allspecialties').appendChild(element);
    }
}

getSpecialties(specialtiesArr);