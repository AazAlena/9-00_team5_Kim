'use strict';

function getDoctors(){
    let availableDoctors = JSON.parse(localStorage.getItem('doctorsAvailable'));
    loadDoctors(availableDoctors);
}

document.querySelector('.search').addEventListener('input', () =>{
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
});

function loadDoctors(availableDoctors){
    let i = -1;
    let arr = availableDoctors;
    availableDoctors.doctor_name.forEach(elem => {
        i++;
        let el = document.createElement('button');
        el.setAttribute('class', 'allfio-item');
        el.setAttribute('id', arr.doctor_id[i]);
        el.textContent = elem;
        document.querySelector('.allfio').appendChild(el);
    });
}

document.querySelector('.allfio').addEventListener('click', (e) => {
    if (e.target.type === "submit"){
        localStorage.setItem('doctorId', e.target.id);
        localStorage.setItem('doctorFio', e.target.textContent);
        window.location.href = './proof.html';
    };
});

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
    }
}

(() => {
    CheckTheme();
    getDoctors();
})()