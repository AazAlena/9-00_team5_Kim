const fioArr = [
    'Иванов Иван Иванович',
    'Петрова Мария Сергеевна',
    'Сидоров Алексей Владимирович',
    'Кузнецова Елена Андреевна',
    'Смирнов Дмитрий Николаевич',
    'Васильева Ольга Петровна',
    'Попов Андрей Викторович',
    'Соколова Татьяна Дмитриевна',
    'Михайлов Сергей Александрович',
    'Федорова Наталья Юрьевна'
];

function loadFio(){
    for (const el of fioArr){
        const butt = document.createElement('button');
        butt.classList.add('allfio-item');
        butt.textContent = el;
        document.querySelector('.allfio').appendChild(butt);
    }
}


document.querySelector('.search').addEventListener('input', () => {
    // для ввода и поиска нужной фамилии
    if (document.querySelector('.search').type === 'text'){
        if (document.querySelectorAll('.allfio-item')){
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
                    doctorName.includes(word));
                    item.style.display = matchesAllWords ? 'block' : 'none';
                });
            }
    }
});

loadFio();