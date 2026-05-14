'use strict';

const page = {
    text: document.querySelector('#fill_txt'),
    deleteBut: document.querySelector('#delete'),
    transferBut: document.querySelector('#transfer'),
    backBut: document.querySelector('#arrow'),
};

function getMonth(num){
    switch (num) {
        case '01':
            return 'Января';
        case '02':
            return 'Февраля';
        case '03':
            return 'Марта';
        case '04':
            return 'Апреля';
        case '05':
            return 'Мая';
        case '06':
            return 'Июня';
        case '07':
            return 'Июля';
        case '08':
            return 'Августа';
        case '09':
            return 'Сентября';
        case '10':
            return 'Октября';
        case '11':
            return 'Ноября';
        case '12':
            return 'Декабря';
        default:
            break;
    }
};

function loadText(){
    let date = localStorage.getItem('date').split('-');
    let time = localStorage.getItem('time');
    let day = date[2];
    let month = getMonth(date[1]);
    page.text.innerHTML = `
    <h1>Когда?</h1>
    <p>${day} ${month}, ${time}</p>
    <h2>Куда?</h2>
    <p>ул.Первомайская 19с5, 3 этаж, каб. 305</p>
    <h2>К кому?</h2>
    <p>${localStorage.getItem('doctorFio')}, ${localStorage.getItem('doctorSpecialty')}</p>`
};


page.deleteBut.addEventListener('click', () => {
    localStorage.setItem('flag','delete');
    window.location.href = './Comment.html';
});

page.transferBut.addEventListener('click', () => {
    localStorage.setItem('flag', 'transfer');
    window.location.href = './Comment.html';
});

page.backBut.addEventListener('click', () => {
    localStorage.removeItem('doctorFio');
    localStorage.removeItem('doctorId');
    localStorage.removeItem('doctorSpecialty');
    window.location.href = './Lk_patient.html';
});

(()=>{
    loadText();
})()