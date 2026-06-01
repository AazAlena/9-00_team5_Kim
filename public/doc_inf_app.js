'use strict';

const page = {
    fioDateDoctor: document.querySelector('#title'),
    stat: document.querySelector('#dis'),
    workSlotsCount: document.querySelector('#sum_work_slots'),
    apptCount: document.querySelector('#sum_appt'),
    utilization: document.querySelector('#disposal'),
    canceledCount: document.querySelector('#sum_canceled'),
    canceledFill: document.querySelector('.comments-cancellation'),
    transferCount: document.querySelector('#sum_reappt'),
    transferFill: document.querySelector('.comments-transfer'),
    button: document.querySelector('#arrow'),
};

page.stat.addEventListener('click', () => {
    window.location.href = './full_stat.html';
});

page.button.addEventListener('click', () => {
    window.location.href = './Lk_admin2.html';
});

function loadData(){
    let data = JSON.parse(localStorage.getItem('doctorUtil'));
    let dateTime = localStorage.getItem('date').split('-').reverse().join('.');
    page.fioDateDoctor.innerHTML = `${localStorage.getItem('doctorFio')}, <br> ${dateTime}`
    page.workSlotsCount.innerHTML = 'Кол-во рабочих слотов: ' + `<span style="color: #070062;">${data.total_slots}</span>`;
    page.apptCount.innerHTML = 'Кол-во отработанных слотов: ' + `<span style="color: #070062;">${data.booked_slots}</span>`;
    page.utilization.innerHTML = 'Утилизация: ' + `<span style="color: #070062;">${data.completed_percent}%</span>`;
    page.canceledCount.innerHTML = 'Кол-во отменённых записей: ' + `<span style="color: #070062;">${data.cancel_arr.length}</span>`;
    loadComments(data.cancel_arr, 'cancel');
    page.transferCount.innerHTML = 'Кол-во перенесённых записей: '+ `<span style="color: #070062;">${data.transfer_arr.length}</span>`;
    loadComments(data.transfer_arr, 'transfer');
};

function loadComments(comments, flag){
    comments.forEach(el => {
        let elem = document.createElement('div');
        elem.setAttribute('class', 'comment-item');
        let f = document.createElement('div');
        f.setAttribute('class', 'fio');
        f.innerText = el.patient_fio;
        elem.appendChild(f);
        let text = document.createElement('div');
        text.setAttribute('class', 'comment-text');
        if (flag === 'cancel'){
            text.innerText = el.reason.slice(8,el.reason.length);
            elem.appendChild(text);
            page.canceledFill.appendChild(elem);
        }
        else if (flag === 'transfer'){
            text.innerText = el.reason.slice(9,el.reason.length);
            elem.appendChild(text);
            page.transferFill.appendChild(elem);
        }
    });
};

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
        document.querySelector('#dark').style.display = 'inline';
        document.querySelector('#light').style.display = 'none';
    }
}

//Проверка входа 
function CheckEnter(){
    if (!localStorage.getItem('userId')){
        window.location.href = './Enter.html';
    }
}

(() => {
    CheckEnter();
    CheckTheme();
    loadData();
})()