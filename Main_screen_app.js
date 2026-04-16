'use strict';

if (document.getElementById('but_enter')){
    document.getElementById('but_enter').addEventListener('click', () => {
        window.location.href = './Enter.html';
    });
}

if (document.querySelector('.appt_but')){
    document.querySelector('.appt_but').addEventListener('click', () => {
        window.location.href = '../specialties-page/specialty.html';
    })
}

if (document.querySelector('.reg_but')){
    document.querySelector('.reg_but').addEventListener('click', () => {
        window.location.href = './Main_screen.html';
    })
}

const toogleBtn1 = document.getElementById('eye_close1');
const passwordInput = document.getElementById('password');
const eyeIcon1 = document.getElementById('eye1');
let isPasswordVisible = false;

const toogleBtn2 = document.getElementById('eye_close2');
const repassInput = document.getElementById('repass');
const eyeIcon2 = document.getElementById('eye2');
let isRePassVisible = false;

toogleBtn1.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;
    passwordInput.type = isPasswordVisible ? 'text' : 'password';
    if (isPasswordVisible){
        eyeIcon1.src = './img/eye.svg';
    } else{
        eyeIcon1.src = './img/eye_close.svg';
    }
});

toogleBtn2.addEventListener('click', () => {
    isRePassVisible = !isRePassVisible;
    repassInput.type = isRePassVisible ? 'text' : 'password';
    if (isRePassVisible){
        eyeIcon2.src = './img/eye.svg';
    } else{
        eyeIcon2.src = './img/eye_close.svg';
    }
});

function CheckPass(){
    return passwordInput.value === repassInput.value;
}

repassInput.addEventListener('change', () => {
    if (!CheckPass()){
        alert('Пароли не совпадают');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    //------ Slider Begin
    const CaroS = document.querySelector('.Carousel-slider');
    const CaroSlider = new MicroSlider(CaroS, { indicators: true, indicatorText: '' });
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
