'use strict';

const page = {
    dateFrom: document.querySelector('#dateFrom'),
    dateTo: document.querySelector('#dateTo'),
    speciality: document.querySelector('#spec-select'),
    fio: document.querySelector('#fio-select'),
    doctors: document.querySelector('.doctors'),
    export: document.querySelector('#exportExcelBtn'),
}

async function fetchReport(from, to, speciality, doctorId){
    let url = `http://localhost:3000/api/doctors/report?from=${from}&to=${to}`;
    if (speciality && speciality !== 'Все') url += `&speciality=${encodeURIComponent(speciality)}`;
    if (doctorId) url += `&doctorId=${doctorId}`;
    const response = await fetch(url);
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка получения отчёта');
    }
    return response.json();
}

function renderDoctorsTable(doctors) {
    page.doctors.innerHTML = '';
    if (!doctors.length) {
        page.doctors.innerHTML = '<div class="no-data">Нет данных за выбранный период</div>';
        return;
    }
    doctors.forEach(doc => {
        const row = document.createElement('div');
        row.className = 'doctors-item';
        row.id = doc.doctorId;
        row.innerHTML = `
            <div class="fio">${doc.fio}</div>
            <div class="speciality">${doc.speciality}</div>
            <div class="slots">${doc.totalSlots}</div>
            <div class="booked-slots">${doc.totalBookingsAll}</div>
            <div class="cancel-return-slots">${doc.totalCancels + doc.totalReschedules}</div>
            <div class="completed-slots">${doc.totalCompleted}</div>
        `;
        page.doctors.appendChild(row);
        
    });
}

async function loadReport() {
    const from = page.dateFrom.value;
    const to = page.dateTo.value;
    if (!from || !to) {
        alert('Выберите период дат');
        return;
    }
    const speciality = page.speciality.value === '0' ? null : page.speciality.value;
    const doctorId = page.fio.value || null;
    try {
        const data = await fetchReport(from, to, speciality, doctorId);
        renderDoctorsTable(data.doctors);
    } catch (error) {
        console.error('loadReport:', error.message);
        alert('Не удалось загрузить статистику: ' + error.message);
    }
}


page.dateFrom.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateTo.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
        loadDailyChart();
    }
});

page.dateTo.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
        loadDailyChart();
    }
});

page.speciality.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    page.fio.value = '0';
    loadDoctorsFilt(page.speciality.value);
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
        loadDailyChart();
    }
});

page.fio.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
        loadDailyChart();
    }
});


async function loadSpecialityFilt(){
    try {
        const response = await fetch('http://localhost:3000/speciality');
        if (!response.ok) throw new Error('Ошибка загрузки специальностей');
        const data = await response.json();
        // Очищаем select, оставляя "Все"
        page.speciality.innerHTML = '<option value="0">Все</option>';
        const uniqueSpecs = new Set();
        data.forEach(item => {
            if (item.speciality) uniqueSpecs.add(item.speciality);
        });
        uniqueSpecs.forEach(spec => {
            const option = document.createElement('option');
            option.value = spec;
            option.textContent = spec;
            page.speciality.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
}

async function loadDoctorsFilt(speciality = null) {
    try {
        let url = 'http://localhost:3000/doctors/all';
        if (speciality && speciality !== "0") {
            url = `http://localhost:3000/doctors/speciality?speciality=${encodeURIComponent(speciality)}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки врачей');
        const data = await response.json();
        const doctors = data.doctors || data;
        page.fio.innerHTML = '<option value="">Все врачи</option>';
        if (Array.isArray(doctors)) {
            doctors.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.fio;
                page.fio.appendChild(option);
            });
        }
        page.fio.value = '';
    } catch (error) {
        console.error('loadDoctors:', error.message);
    }
}

page.doctors.addEventListener('click', (e) => {
    if (e.target.className != 'doctors'){
        if (e.target.className === 'doctors-item'){
            localStorage.setItem('doctorId',e.target.id);
            localStorage.setItem('doctorFio',e.target.querySelector('.fio').innerText);
        }else{
            localStorage.setItem('doctorId',e.target.parentElement.id);
            localStorage.setItem('doctorFio',e.target.parentElement.querySelector('.fio').innerText);
        }
    }
});

function loadData(){
    loadSpecialityFilt();
    loadDoctorsFilt();
}

// ========== ДИАГРАММА ЗАГРУЗКИ ПО ДНЯМ ==========
let diagramma = null;
let currentDailyData = [];

async function loadDailyChart() {

    const from = page.dateFrom.value;
    const to = page.dateTo.value;
    if (!from || !to) return;

    const speciality = page.speciality.value === '0' ? null : page.speciality.value;
    const doctorId = page.fio.value || null;

    let url = `http://localhost:3000/api/doctors/daily-report?from=${from}&to=${to}`;
    if (speciality && speciality !== 'Все') url += `&speciality=${encodeURIComponent(speciality)}`;
    if (doctorId) url += `&doctorId=${doctorId}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка получения дневной статистики');
        const data = await response.json();
        const dailyData = data.daily;

        const dates = dailyData.map(d => d.date);
        const slotsData = dailyData.map(d => d.totalSlots);
        const bookingsData = dailyData.map(d => d.totalBookings);
        const utilizationData = dailyData.map(d => d.utilization); // для тултипа

        const options = {
            series: [
                { name: 'Всего слотов', type: 'column', data: slotsData },
                { name: 'Занято слотов', type: 'column', data: bookingsData }
            ],
            chart: {
                type: 'bar',
                height: 400,
                toolbar: {
                    show: true,
                    tools: {
                        download: true,   // скачать PNG
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                },
                zoom: {
                    enabled: true,
                    type: 'x',
                    autoScaleYaxis: true
                },
                fontFamily: 'Comic Relief, cursive',
                animations: { enabled: true, easing: 'easeinout' }
            },
            title: {
                text: 'Загрузка по дням',
                align: 'center',
                style: { fontSize: '20px', fontWeight: 'bold', fontFamily: 'Comic Relief, cursive', color: '#171260' }
            },
            xaxis: {
                categories: dates,
                title: { text: 'Дата', style: { color: '#171260', fontSize: '15px' } },
                labels: { rotate: -30 }
            },
            yaxis: {
                title: { text: 'Количество слотов', style: { color: '#171260', fontSize: '15px' } },
                min: 0,
                tickAmount: 5,
                forceNiceScale: false,
                labels: { formatter: (val) => Math.round(val) }
            },
            tooltip: {
                shared: true,
                intersect: false,
                y: {
                    formatter: (value, { seriesIndex, dataPointIndex }) => {
                        if (seriesIndex === 0) return `Всего слотов: ${value}`;
                        if (seriesIndex === 1) {
                            const percent = utilizationData[dataPointIndex];
                            return `Занято слотов: ${value} (${percent}%)`;
                        }
                        return value;
                    }
                }
            },
            dataLabels: { enabled: false },     // ← отключаем надписи на столбцах
            stroke: { width: [0, 0] },
            colors: ['#222676', '#5267af'],
            plotOptions: {
                bar: { borderRadius: 10, columnWidth: '60%' }
            },
            legend: {
                position: 'bottom',
                horizontalAlign: 'center',
                fontSize: '20px',
                fontFamily: 'Comic Relief, cursive',
                itemMargin: { horizontal: 12, vertical: 0 }
            }
        };

        if (diagramma) diagramma.destroy();
        diagramma = new ApexCharts(document.querySelector("#diagramma"), options);
        diagramma.render();
    } catch (error) {
        console.error('loadDailyChart:', error);
        const chartDiv = document.querySelector("#diagramma");
        if (chartDiv) chartDiv.innerHTML = '<div style="color:black;">Не удалось загрузить диаграмму</div>';
    }
}

// ========== ЭКСПОРТ В EXCEL (клиентский) ==========
async function exportToExcel() {
    const from = page.dateFrom.value;
    const to = page.dateTo.value;
    if (!from || !to) {
        alert('Выберите период дат');
        return;
    }

    const speciality = page.speciality.value === '0' ? null : page.speciality.value;
    const doctorId = page.fio.value || null;

    // Формируем URL для отчёта по врачам
    let reportUrl = `http://localhost:3000/api/doctors/report?from=${from}&to=${to}`;
    if (speciality && speciality !== 'Все') reportUrl += `&speciality=${encodeURIComponent(speciality)}`;
    if (doctorId) reportUrl += `&doctorId=${doctorId}`;

    // Формируем URL для дневной статистики
    let dailyUrl = `http://localhost:3000/api/doctors/daily-report?from=${from}&to=${to}`;
    if (speciality && speciality !== 'Все') dailyUrl += `&speciality=${encodeURIComponent(speciality)}`;
    if (doctorId) dailyUrl += `&doctorId=${doctorId}`;

    try {
        const exportBtn = page.export;
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '⏳ Загрузка данных...';
        exportBtn.disabled = true;

        // Запрашиваем оба набора данных параллельно
        const [reportRes, dailyRes] = await Promise.all([
            fetch(reportUrl),
            fetch(dailyUrl)
        ]);

        if (!reportRes.ok) throw new Error('Ошибка получения отчёта по врачам');
        if (!dailyRes.ok) throw new Error('Ошибка получения дневной статистики');

        const reportData = await reportRes.json();
        const dailyData = await dailyRes.json();

        exportBtn.textContent = '📊 Формирование Excel...';

        // Лист 1: Врачи
        const doctorsRows = reportData.doctors.map(doc => ({
            'ФИО врача': doc.fio,
            'Специальность': doc.speciality,
            'Всего слотов': doc.totalSlots,
            'Количество записей': doc.totalBookingsAll,
            'Отмены': doc.totalCancels,
            'Переносы': doc.totalReschedules,
            'Завершено': doc.totalCompleted
        }));
        const wsDoctors = XLSX.utils.json_to_sheet(doctorsRows);

        // Лист 2: Загрузка по дням
        const dailyRows = dailyData.daily.map(item => ({
            'Дата': item.date,
            'Всего слотов': item.totalSlots,
            'Занято слотов': item.totalBookings,
            'Загрузка, %': item.utilization
        }));
        const wsDaily = XLSX.utils.json_to_sheet(dailyRows);

        // Создаём книгу и добавляем листы
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsDoctors, `Врачи_${from}_${to}`);
        XLSX.utils.book_append_sheet(wb, wsDaily, `Загрузка_по_дням`);

        // Сохраняем файл
        XLSX.writeFile(wb, `report_${from}_to_${to}.xlsx`);

        // Восстанавливаем кнопку
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    } catch (error) {
        console.error('exportToExcel:', error);
        alert('Ошибка выгрузки: ' + error.message);
        if (page.export) {
            page.export.textContent = '📎 Выгрузить Excel';
            page.export.disabled = false;
        }
    }
}

if (page.export) {
    page.export.addEventListener('click', exportToExcel);
}

function CheckTheme(){
    let theme = localStorage.getItem('theme');
    if (theme === 'dark'){
        document.body.classList.add('dark-theme');
    }
}

//Проверка входа 
function CheckEnter(){
    if (!localStorage.getItem('userId')){
        window.location.href = './Enter.html';
    }
}

(() => {
    CheckEnter();
    CheckTheme();
    loadData();
})();