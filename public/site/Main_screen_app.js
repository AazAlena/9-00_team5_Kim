'use strict';

let isPasswordVisible = false;
let isRePassVisible = false;
let loginFlag = false;
let userId = null;
let role = '';

//Объявление переменных
const page = {
    nav: {
        appt: document.querySelector('#appt'),
        lk: document.querySelector('#lk'),
        theme: document.querySelector('.theme'),
        enterExitBtn: document.querySelector('#but_enter'),
    },
    appoinmentBtn: document.querySelector('.appt_but'),
    register: {
        fio: document.querySelector('#fio'),
        email: document.querySelector('#email'),
        password: document.querySelector('#password'),
        repass: document.querySelector('#repass'),
        eyeBtn1: document.querySelector('#eye_close1'),
        eyeBtn2: document.querySelector('#eye_close2'),
        eyeIcon1: document.querySelector('#eye1'),
        eyeIcon2: document.querySelector('#eye2'),
        registerBtn: document.querySelector('#reg_butt'),
    }
}

//клик на личный кабинет
page.nav.lk.addEventListener('click', (e) => {
    e.preventDefault();
    if (!loginFlag){
        window.location.href = './Enter.html';
    }
    else{
        switch (role){
            case 'doctor':
                window.location.href = './Lk_doctor.html';
                break;
            case 'patient':
                window.location.href = './Lk_patient.html';
                break;
            case 'admin':
                window.location.href = './Lk_admin.html';
                break;
        }
    }
});

//клик на кнопку записи на приём
function appointment(element){
    element.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginFlag && localStorage.getItem('role') === 'patient'){
            window.location.href = './speciality.html';
        }
        else{
            window.location.href = './Enter.html';
        }
    });
}
appointment(page.nav.appt);
appointment(page.appoinmentBtn);

//Клик на кнопку входа/выхода
page.nav.enterExitBtn.addEventListener('click', () => {
    if (loginFlag){
        localStorage.removeItem('userId');
        CheckEnter();
    }
    else{
        window.location.href = './Enter.html'
    }
});

//Функции регистрации
async function registerPatient(fio, email, password) {
  try {
    const response = await fetch('http://localhost:3000/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fio, email, password })
    });

    const data = await response.json();

    if (response.status === 201) {
      console.log(data.message);
      console.log('ID пациента:', data.patient_id);
      return data;
    } 
    
    if (response.status === 400) {
      throw new Error(data.error); // "Все поля обязательны"
    }
    
    if (response.status === 409) {
      throw new Error(data.error); // "Пользователь с таким email уже существует"
    }
    
    throw new Error(data.error || 'Ошибка регистрации');
    
  } catch (error) {
    throw error;
  }
}

//Проверка входа и клик по кнопке регистрации
function CheckEnter(){
    if (localStorage.getItem('speciality')){
        localStorage.removeItem('speciality');
    }
    if (localStorage.getItem('flag')){
        localStorage.removeItem('flag');
    }
    if (localStorage.getItem('dateTime')){
        localStorage.removeItem('dateTime');
    }
    if (localStorage.getItem('doctorId')){
        localStorage.removeItem('doctorId');
    }
    if (localStorage.getItem('doctorUtil')){
        localStorage.removeItem('doctorUtil')
    }
    if (localStorage.getItem('userId')){
        userId = localStorage.getItem('userId');
        role = localStorage.getItem('role');
        loginFlag = true;
        page.nav.enterExitBtn.textContent = 'Выйти';
        document.querySelectorAll('input').forEach(input => input.disabled = true);
        document.querySelector('#a').href = '';
        page.register.registerBtn.disabled = true;
        if (role != 'patient'){
            page.nav.appt.parentElement.style.display = 'none';
        }
    }
    else {
        page.nav.appt.parentElement.style.display = 'flex';
        loginFlag = false;
        page.nav.enterExitBtn.textContent = 'Войти';
        document.querySelectorAll('input').forEach(input => input.disabled = false);
        document.querySelector('#a').href = './Enter.html';
        page.register.registerBtn.disabled = false;
        page.register.registerBtn.addEventListener('click', async () => {
            const fio = page.register.fio.value;
            const email = page.register.email.value;
            const password = page.register.password.value;
            if (fio.split(' ').length != 3){
                alert('Введите раздельно Фамилию Имя Отчество');
            }
            else{
                try {
                    const result = await registerPatient(fio, email, password);
                    userId = result.patient_id;
                    role = 'patient';
                    localStorage.setItem('userId', userId);
                    localStorage.setItem('role', role);
                    window.location.href = '';
                } catch (error) {
                    console.error('Ошибка регистрации:', error.message);
                    alert(error.message);
                }
            }
        });
    }
}

//Скрытие и открытие пароля
function OpenClosePassword(btn, input, icon, isVisible){
    btn.addEventListener('click', () => {
        isVisible = !isVisible;
        input.type = isVisible ? 'text' : 'password';
        if (isVisible){
            icon.src = './img/eye.svg';
        } else{
            icon.src = './img/eye_close.svg';
        }
    });
}
OpenClosePassword(page.register.eyeBtn1, page.register.password, page.register.eyeIcon1, isPasswordVisible);
OpenClosePassword(page.register.eyeBtn2, page.register.repass, page.register.eyeIcon2, isRePassVisible);

//Проверка совпадения паролей
page.register.repass.addEventListener('change', () => {
    if (page.register.password.value != page.register.repass.value){
        alert('Пароли не совпадают');
    }
});

//Слайдер
document.addEventListener('DOMContentLoaded', () => {
    //------ Slider Begin
    const CaroS = document.querySelector('.Carousel-slider');
    const CaroSlider = new MicroSlider(CaroS, { indicators: false, indicatorText: '' });
    const hammer = new Hammer(CaroS);
    const CaroSTimer = 2000;
    let CaroAutoplay = setInterval(() => CaroSlider.next(), CaroSTimer);
    //----- Mouseenter Event
    CaroS.onmouseenter = function(e) {
        clearInterval(CaroAutoplay);
    }
    //----- Mouseleave Event
    CaroS.onmouseleave = function(e) {
        clearInterval(CaroAutoplay);
        CaroAutoplay = setInterval(() => CaroSlider.next(), CaroSTimer);
    }
    //----- Mouseclick Event
    CaroS.onclick = function(e) {
        clearInterval(CaroAutoplay);
        
    }
    //------ Gesture Tap Event
    hammer.on('tap', function(e) {
        clearInterval(CaroAutoplay);
    });
   
    //----- Gesture Swipe Event
    hammer.on('swipe', function(e) {
        clearInterval(CaroAutoplay);
        CaroAutoplay = setInterval(() => CaroSlider.next(), CaroSTimer);
    });

    let slideLink = document.querySelectorAll('.slider-item');
    if (slideLink && slideLink !== null && slideLink.length > 0) {
        slideLink.forEach(el => el.addEventListener('click', e => {
            e.preventDefault();
            let href = el.dataset.href;
            let target = el.dataset.target;
            if (href !== '#') window.open(href, target);
        }));
    }

    //---- Slider End
    
});

document.addEventListener('DOMContentLoaded', () => {
  const items = document.querySelectorAll('.scroll-item');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Элемент появился в области видимости
        entry.target.classList.add('visible');
      } else {
        // Элемент ушёл из области видимости
        entry.target.classList.remove('visible');
      }
    });
  }, {
    threshold: 0.2
  });

  items.forEach(item => observer.observe(item));
});

page.nav.theme.addEventListener('click', () => {
    if (document.querySelector('#sun')){
        page.nav.theme.id = 'moon';
        document.body.classList.add('dark-theme');
        document.querySelector('.theme > img').src = './img/moon.svg';
        document.querySelector('#dark').style.display = 'inline';
        document.querySelector('#light').style.display = 'none';
        localStorage.setItem('theme','dark');
    }else if (document.querySelector('#moon')){
        page.nav.theme.id = 'sun';
        document.body.classList.remove('dark-theme');
        document.querySelector('.theme > img').src = './img/sun.svg';
        document.querySelector('#dark').style.display = 'none';
        document.querySelector('#light').style.display = 'inline';
        localStorage.setItem('theme', 'light');
    };
});

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        page.nav.theme.click();
    }
}

(()=>{
    CheckEnter();
    CheckTheme();
})()