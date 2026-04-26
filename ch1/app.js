'use strict';

// для кнопочки выбора по дате
document.querySelector('.button-time').addEventListener('click', () => {
    document.querySelector('.alltimes').style.display = 'flex';
    document.querySelector('.allfio').style.display = 'none';
    document.querySelector('.search').type = 'date';
    document.querySelector('.search').id = 'date';
    document.querySelector('.h1').textContent = 'Выберите время';
    document.querySelector('.search').classList.toggle('search-icon');
});

// для кнопочки выбора по фамилии
document.querySelector('.button-fio').addEventListener('click', () => {
    document.querySelector('.allfio').style.display = 'flex';
    document.querySelector('.alltimes').style.display = 'none';
    document.querySelector('.search').type = 'text';
    document.querySelector('.search').id = 'fio';
    document.querySelector('.h1').textContent = 'Выберите врача';
    document.querySelector('.search').classList.toggle('search-icon');
});

