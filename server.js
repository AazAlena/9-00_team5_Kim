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
//app.use((req, res, next) => {
//    console.log(`\n📨 ${req.method} ${req.url}`);
//    console.log('📦 Headers:', req.headers['content-type']);
//    console.log('📦 Body:', req.body);
//    next();
//});
app.use(express.static('public'));

require('./src/routes')(app);

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}/test.html`);
    console.log('📌 Доступные эндпоинты:');
    console.log('   GET  /doctors');
    console.log('   GET  /slots?doctorId=?&date=?');
    console.log('   POST /appointments');
    console.log('   PUT  /appointments/:id/cancel');
    console.log('   GET  /report/utilization?startDate=?&endDate=?');
    console.log('   POST /import - загрузить данные из CSV\n');
});