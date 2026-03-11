'use scrict';

const doctors = [
    {
        "fio": "Булкин Богдан Богданович"
    },
    {
        "fio": "Иванов Иван Иванович"
    },
    {
        "fio": "Петрова Елена Владимировна"
    },
    {
        "fio": "Сидоров Алексей Петрович"
    },
    {
        "fio": "Козлова Мария Дмитриевна"
    },
    {
        "fio": "Смирнов Андрей Сергеевич"
    },
    {
        "fio": "Васильева Ольга Николаевна"
    },
    {
        "fio": "Кузнецов Денис Александрович"
    },
    {
        "fio": "Михайлова Татьяна Викторовна"
    },
    {
        "fio": "Новиков Павел Валерьевич"
    },
    {
        "fio": "Федорова Наталья Игоревна"
    }
];

document.querySelector('.search').addEventListener('input', () =>{
    const doctorItems = document.querySelectorAll('.alldoctors-item');
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
})

function getDoctors(doctors){
    for (const doctor of doctors){
        const element = document.createElement('div');
        element.setAttribute('class','alldoctors-item');
        element.innerText = doctor.fio;
        document.querySelector('.alldoctors').appendChild(element);
    }
}

(()=>{
    getDoctors(doctors);
})();