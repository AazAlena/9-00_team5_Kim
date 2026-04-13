'use strict';

const date = new Date();
const date1 = date.toISOString().split('T')[0];
const date2 = new Date(date.getTime()+31536000000).toISOString().split('T')[0];
document.querySelector('.search').min = date1;
document.querySelector('.search').max = date2;

const timeArr = ['8:00','9:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

function loadTime(){
    for (const el of timeArr){
        const butt = document.createElement('button');
        butt.classList.add('alltimes-item');
        butt.textContent = el;
        document.querySelector('.alltimes').appendChild(butt);
    }
}

loadTime();