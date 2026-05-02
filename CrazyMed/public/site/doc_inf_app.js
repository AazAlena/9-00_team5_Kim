'use strict';

const page = {
    fioDateDoctor: document.querySelector('#title'),
    workSlotsCount: document.querySelector('#sum_work_slots'),
    apptCount: document.querySelector('#sum_appt'),
    utilization: document.querySelector('#disposal'),
    cancelledCount: document.querySelector('#sum_canceled'),
    cancelledFill: document.querySelector('.comments-cancellation'),
    transferCount: document.querySelector('#sum_reappt'),
    transferFill: document.querySelector('.comments-transfer'),
    button: document.querySelector('#arrow'),
};

page.button.addEventListener('click', () => {
    window.location.href = './Lk_admin2.html';
});

function loadData(){
    let data = JSON.parse(localStorage.getItem('doctorUtil'));
    let dateTime = localStorage.getItem('dateTime').split('-').reverse().join('.');
    page.fioDateDoctor.innerHTML = `${localStorage.getItem('doctorFio')}, <br> ${dateTime}`
    page.workSlotsCount.innerText = 'Кол-во рабочих слотов: ' + data.total_slots;
    page.apptCount.innerText = 'Кол-во отработанных слотов: ' + data.booked_slots; //?
    page.utilization.innerHTML = 'Утилизация: ' + data.completed_percent + '%';
    page.cancelledCount.innerText = 'Кол-во отменённых записей: ' + data.cancel_arr.length;
    loadComments(data.cancel_arr, 'cancel');
    page.transferCount.innerText = 'Кол-во перенесённых записей: ' + data.transfer_arr.length;
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
            page.cancelledFill.appendChild(elem);
        }
        else if (flag === 'transfer'){
            text.innerText = el.reason.slice(9,el.reason.length);
            elem.appendChild(text);
            page.transferFill.appendChild(elem);
        }
    });
};

(() => {
    loadData();
})()