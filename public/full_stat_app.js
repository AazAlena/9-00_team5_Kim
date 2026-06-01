'use strict';

const MAX_DAYS = 62; // Максимально допустимое количество дней

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОВЕРКИ ДАТ ==========
function getDateDiffDays(fromDateStr, toDateStr) {
    const from = new Date(fromDateStr);
    const to = new Date(toDateStr);
    const diffTime = to - from;
    return diffTime / (1000 * 60 * 60 * 24);
}

function isDateRangeValid(fromDateStr, toDateStr) {
    if (!fromDateStr || !toDateStr) return false;
    const days = getDateDiffDays(fromDateStr, toDateStr);
    return days >= 0 && days <= MAX_DAYS;
}

const page = {
    dateFrom: document.querySelector('#dateFrom'),
    dateTo: document.querySelector('#dateTo'),
    speciality: document.querySelector('#spec-select'),
    fio: document.querySelector('#fio-select'),
    doctors: document.querySelector('.doctors'),
    export: document.querySelector('#exportExcelBtn'),
}

async function fetchReport(from, to, speciality, doctorId) {
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
    // Проверка на максимальную длительность периода
    if (!isDateRangeValid(from, to)) {
        alert(`Превышен допустимый период в ${MAX_DAYS} дня. Пожалуйста, выберите диапазон не более ${MAX_DAYS} дней.`);
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
    if (page.dateTo.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)) {
        loadReport();
        loadDailyChart();
    }
});

page.dateTo.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)) {
        loadReport();
        loadDailyChart();
    }
});

page.speciality.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    page.fio.value = '0';
    loadDoctorsFilt(page.speciality.value);
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)) {
        loadReport();
        loadDailyChart();
    }
});

page.fio.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)) {
        loadReport();
        loadDailyChart();
    }
});

async function loadSpecialityFilt() {
    try {
        const response = await fetch('http://localhost:3000/speciality');
        if (!response.ok) throw new Error('Ошибка загрузки специальностей');
        const data = await response.json();
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
    if (e.target.className != 'doctors') {
        if (e.target.className === 'doctors-item') {
            localStorage.setItem('doctorId', e.target.id);
            localStorage.setItem('doctorFio', e.target.querySelector('.fio').innerText);
        } else {
            localStorage.setItem('doctorId', e.target.parentElement.id);
            localStorage.setItem('doctorFio', e.target.parentElement.querySelector('.fio').innerText);
        }
    }
});

function loadData() {
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

    // Проверка на максимальную длительность периода
    if (!isDateRangeValid(from, to)) {
        const chartDiv = document.querySelector("#diagramma");
        if (chartDiv) chartDiv.innerHTML = '<div style="color:black;">⚠️ Период превышает 62 дня. Выберите меньший интервал.</div>';
        return;
    }

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
        const utilizationData = dailyData.map(d => d.utilization);

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
                        download: true,
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
            dataLabels: { enabled: false },
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

// ========== ЭКСПОРТ В CSV ==========
async function exportToCSV() {
    const from = page.dateFrom.value;
    const to = page.dateTo.value;
    if (!from || !to) {
        alert('Выберите период дат');
        return;
    }

    // Проверка на максимальную длительность периода
    if (!isDateRangeValid(from, to)) {
        alert(`Превышен допустимый период в ${MAX_DAYS} дня. Невозможно выгрузить отчёт за ${Math.round(getDateDiffDays(from, to))} дней.`);
        return;
    }

    const speciality = page.speciality.value === '0' ? null : page.speciality.value;
    const doctorId = page.fio.value || null;

    let reportUrl = `http://localhost:3000/api/doctors/report?from=${from}&to=${to}`;
    if (speciality && speciality !== 'Все') reportUrl += `&speciality=${encodeURIComponent(speciality)}`;
    if (doctorId) reportUrl += `&doctorId=${doctorId}`;

    try {
        const exportBtn = page.export;
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '⏳ Загрузка...';
        exportBtn.disabled = true;

        const response = await fetch(reportUrl);
        if (!response.ok) throw new Error('Ошибка получения данных');

        const reportData = await response.json();

        const headers = [
            'doctor_id',
            'doctor_full_name',
            'specialty',
            'total_slots',
            'booked_slots',
            'utilization'
        ];

        const rows = reportData.doctors.map(doc => {
            const booked = doc.totalBookingsAll;
            const total = doc.totalSlots;
            let utilization = 0;
            if (total > 0) {
                utilization = (booked / total) * 100;
                utilization = Math.round(utilization);
            }
            return [
                doc.doctorId,
                doc.fio,
                doc.speciality,
                total,
                booked,
                utilization
            ];
        });

        const csvLines = [headers.join(',')];
        for (const row of rows) {
            csvLines.push(row.join(','));
        }
        const csvContent = csvLines.join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `report_${from}_to_${to}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    } catch (error) {
        console.error('exportToCSV:', error);
        alert('Ошибка выгрузки: ' + error.message);
        if (page.export) {
            page.export.textContent = '📎 Выгрузить CSV';
            page.export.disabled = false;
        }
    }
}

if (page.export) {
    page.export.addEventListener('click', exportToCSV);
}

function CheckTheme() {
    let theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

function CheckEnter() {
    if (!localStorage.getItem('userId')) {
        window.location.href = './Enter.html';
    }
}

(() => {
    CheckEnter();
    CheckTheme();
    loadData();
})();