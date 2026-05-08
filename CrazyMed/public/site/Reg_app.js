'use strict';

let isPasswordVisible = false;
let isRePassVisible = false;

const page = {
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

page.registerBtn.addEventListener('click', async () => {
    const fio = page.fio.value;
    const email = page.email.value;
    const password = page.password.value;
    if (fio.split(' ').length != 3){
        alert('Введите раздельно Фамилию Имя Отчество');
    }
    else{
        try {
            const result = await registerPatient(fio, email, password);
            let userId = result.patient_id;
            localStorage.setItem('userId', userId);
            localStorage.setItem('role', 'patient');
            window.location.href = './Main_screen.html';
        } catch (error) {
            console.error('Ошибка регистрации:', error.message);
            alert(error.message);
        }
    }

});

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
OpenClosePassword(page.eyeBtn1, page.password, page.eyeIcon1, isPasswordVisible);
OpenClosePassword(page.eyeBtn2, page.repass, page.eyeIcon2, isRePassVisible);

//Проверка совпадения паролей
page.repass.addEventListener('change', () => {
    if (page.password.value != page.repass.value){
        alert('Пароли не совпадают');
    }
});