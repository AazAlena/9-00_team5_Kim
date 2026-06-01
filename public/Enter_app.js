'use strict';

let isPasswordVisible = false;

const page = {
    email: document.querySelector('#email'),
    password: document.querySelector('#pass'),
    eyeBtn1: document.querySelector('#eye_close1'),
    eyeIcon1: document.querySelector('#eye1'),
    enterButton: document.querySelector('#entr_butt'),
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
OpenClosePassword(page.eyeBtn1, page.password, page.eyeIcon1, isPasswordVisible);

// Функция входа
async function loginUser(email, password) {
  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.status === 200) {
      return data;
    }
    
    if (response.status === 401) {
      throw new Error(data.error); // "Неверный email или пароль"
    }
    
    if (response.status === 500) {
      throw new Error(data.error || 'Ошибка сервера');
    }
    
    throw new Error(data.error || 'Ошибка входа');
    
  } catch (error) {
    console.error('Ошибка входа:', error.message);
    throw error;
  }
}

page.enterButton.addEventListener('click', async () => {
    const email = page.email.value;
    const password = page.password.value;
    try {
        const result = await loginUser(email, password);
        let userId = result.id;
        let role = result.role;
        localStorage.setItem('userId', userId);
        localStorage.setItem('role',role);
        window.location.href = './Main_screen.html';
    }
    catch (error) {
        console.error('Ошибка входа:', error.message);
        alert(error.message);
    }
})

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
    }
}

(() => {
    CheckTheme();
})();