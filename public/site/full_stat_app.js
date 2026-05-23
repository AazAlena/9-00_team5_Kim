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
    }
});

page.dateTo.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
    }
});

page.speciality.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    page.fio.value = '0';
    loadDoctorsFilt(page.speciality.value);
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
    }
});

page.fio.addEventListener('change', () => {
    page.doctors.innerHTML = '';
    if (page.dateFrom.value != '' && new Date(page.dateTo.value) >= new Date(page.dateFrom.value)){
        loadReport();
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

// ========== ЭКСПОРТ В EXCEL (клиентский) ==========
async function exportToExcel() {
    const from = page.dateFrom.value;
    const to = page.dateTo.value;
    if (!from || !to) {
        alert('Выберите период дат');
        return;
    }

    // Получаем текущие данные из таблицы (или запрашиваем заново)
    // Проще всего взять уже загруженные данные из переменной, но у вас их нет.
    // Поэтому сделаем отдельный запрос к /api/doctors/report и сформируем Excel.
    const speciality = page.speciality.value === '0' ? null : page.speciality.value;
    const doctorId = page.fio.value || null;

    let url = `http://localhost:3000/api/doctors/report?from=${from}&to=${to}`;
    if (speciality && speciality !== 'Все') url += `&speciality=${encodeURIComponent(speciality)}`;
    if (doctorId) url += `&doctorId=${doctorId}`;

    try {
        const exportBtn = page.export;
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '⏳ Загрузка данных...';
        exportBtn.disabled = true;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка получения данных');
        const data = await response.json();

        exportBtn.textContent = '📊 Формирование Excel...';

        // Преобразуем данные в формат для XLSX
        const rows = data.doctors.map(doc => ({
            'ФИО врача': doc.fio,
            'Специальность': doc.speciality,
            'Всего слотов': doc.totalSlots,
            'Количество записей': doc.totalBookingsAll,
            'Отмены': doc.totalCancels,
            'Переносы': doc.totalReschedules,
            'Завершено': doc.totalCompleted
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Стат_${from}_${to}`);
        XLSX.writeFile(wb, `report_${from}_to_${to}.xlsx`);

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

(() => {
    loadData();
})();