const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Создаем папку для базы данных, если её нет
if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'));
}

app.use(express.json());
app.use(express.static('public'));

require('./src/routes')(app);

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}/site/Main_screen.html`);
    //console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}/auth.html`);
});

setTimeout(async () => {
    try {
        const response = await fetch('http://localhost:3000/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        console.log('✅ Автоимпорт:', result.message);
    } catch (err) {
        console.log('⚠️ Автоимпорт не выполнен (CSV могут отсутствовать)');
    }
}, 2000);
