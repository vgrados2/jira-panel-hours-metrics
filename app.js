// Global variables
let rawData = [];
let filteredData = [];
// Mobile responsive helpers
let isMobile = window.innerWidth <= 768;

const formatDate = (date) => {
    if (!date || isNaN(date.getTime())) {
        return 'N/A';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// DOM Elements
const uploadSection = document.getElementById('upload-section');
const dashboardSection = document.getElementById('dashboard-section');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file-btn');
const uploadZone = document.querySelector('.upload-zone');
const dateFilter = document.getElementById('date-filter');
const projectFilter = document.getElementById('project-filter');
const personFilter = document.getElementById('person-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const totalHoursEl = document.getElementById('total-hours');
// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});
// File upload handlers
selectFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        processFile(file);
    } else {
        alert('Por favor, sube un archivo .xlsx válido');
    }
});
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}
function processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

            // Usar sheet_to_json con header: 1 para obtener un array de arrays
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

            if (rows.length < 2) {
                alert("El archivo no contiene suficientes datos.");
                return;
            }

            // La primera fila es el encabezado
            const header = rows[0];

            // Las filas de datos son el resto
            const dataRows = rows.slice(1);

            // Filtrar las filas de resumen (las que empiezan con ' ->')
            const filteredRows = dataRows.filter(row => {
                const firstCell = String(row[0] || '').trim();
                return !firstCell.startsWith('->');
            });

            // Convertir las filas filtradas en objetos JSON
            const jsonData = filteredRows.map(row => {
                const rowData = {};
                header.forEach((col, index) => {
                    rowData[col] = row[index];
                });
                return rowData;
            });

            console.log('📂 Datos cargados y filtrados:', jsonData.length, 'filas');
            console.log('📋 Primera fila:', jsonData[0]);

            if (validateAndProcessData(jsonData)) {
                initializeDashboard(); // Se asegura que el dashboard esté visible y los listeners activos
                updateUI(); // Actualiza los filtros y gráficos con los nuevos datos
            }
        } catch (error) {
            alert('Error al procesar el archivo: ' + error.message);
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
}

function validateAndProcessData(data) {
    if (data.length === 0) {
        alert('El archivo está vacío');
        return false;
    }
    const columns = Object.keys(data[0]);
    console.log('📋 Columnas encontradas:', columns);
    console.log('📊 Total de filas:', data.length);
    // Mapear columnas flexiblemente
    const colMap = {
        persona: columns.find(c => c.toLowerCase().includes('persona asignada')),
        proyecto: columns.find(c => c.toLowerCase().includes('proyecto')),
        tiempo: columns.find(c => c.toLowerCase().includes('suma(tiempo invertido)')),
        fecha: columns.find(c => c.toLowerCase().includes('fecha de creación (registro de trabajo)')),
        issueKey: columns.find(c => c.toLowerCase().includes('ticket')),
        issueSummary: columns.find(c => c.toLowerCase().includes('resumen')),
        issueDescription: columns.find(c => c.toLowerCase().includes('descripción del trabajo')),
        // 'Nombre de la incidencia' no parece estar en el CSV, se usará 'Proyecto' o 'Resumen'
        issueName: columns.find(c => c.toLowerCase().includes('nombre de la incidencia')),
    };
    // Asignar fallback para issueName después de la inicialización
    if (!colMap.issueName) {
        colMap.issueName = colMap.proyecto;
    }

    console.log('🗺️ Mapeo de columnas:', colMap);
    // Validar que encontramos las columnas esenciales
    const missing = [];
    if (!colMap.tiempo) missing.push('Tiempo invertido');
    if (!colMap.fecha) missing.push('Fecha');
    if (missing.length > 0) {
        alert(`No se encontraron las columnas: ${missing.join(', ')}\n\nColumnas disponibles:\n${columns.join('\n')}`);
        return false;
    }
    // Procesar datos
    rawData = data
        .map((row, index) => {
            const timeStr = String(row[colMap.tiempo] || '0');
            const hours = parseFloat(timeStr.replace('h', '').replace(',', '.').trim()) || 0;
            const fechaRaw = row[colMap.fecha];
            const fecha = parseDate(fechaRaw);
            // Debug primera fila
            if (index === 0) {
                console.log('🔍 Ejemplo de fila procesada:');
                console.log('  - Tiempo original:', row[colMap.tiempo]);
                console.log('  - Horas parseadas:', hours);
                console.log('  - Fecha original:', fechaRaw);
                console.log('  - Fecha parseada:', fecha);
            }
            return {
                proyecto: colMap.proyecto ? (row[colMap.proyecto] || 'General') : 'General',
                persona: colMap.persona ? (row[colMap.persona] || 'Sin asignar') : 'Sin asignar',
                issueKey: colMap.issueKey ? (row[colMap.issueKey] || '-') : '-',
                issueSummary: colMap.issueSummary ? (row[colMap.issueSummary] || '-') : '-',
                issueDescription: colMap.issueDescription ? (row[colMap.issueDescription] || '-') : '-',
                issueName: colMap.issueName ? (row[colMap.issueName] || '-') : '-',
                fechaStr: fechaRaw ? String(fechaRaw) : '',
                fecha: fecha,
                tiempoInvertido: timeStr,
                horas: hours
            };
        })
        .filter(row => {
            const valid = row.fecha && row.horas > 0;
            return valid;
        });
    console.log('✅ Datos procesados:', rawData.length, 'filas válidas de', data.length, 'totales');
    if (rawData.length === 0) {
        console.error('❌ No se encontraron datos válidos');
        console.log('Verifica que:');
        console.log('  1. Las fechas estén en formato válido');
        console.log('  2. Las horas sean mayores a 0');
        alert('No se encontraron datos válidos en el archivo.\n\nVerifica que haya filas con fechas y horas válidas.\nRevisa la consola (F12) para más detalles.');
        return false;
    }
    // Mostrar resumen
    console.log('📈 Resumen de datos:');
    console.log('  - Total horas:', rawData.reduce((sum, r) => sum + r.horas, 0).toFixed(1));
    console.log('  - Personas únicas:', [...new Set(rawData.map(r => r.persona))].length);
    console.log('  - Proyectos únicos:', [...new Set(rawData.map(r => r.proyecto))].length);
    return true;
}
function parseDate(dateStr) {
    if (!dateStr) return null;
    // Si es un número o una cadena que puede convertirse a número, tratar como serial de Excel
    let serial = null;
    if (typeof dateStr === 'number') {
        serial = dateStr;
    } else if (typeof dateStr === 'string' && /^\d+(\.\d+)?$/.test(dateStr.trim())) {
        serial = parseFloat(dateStr.trim());
    }
    if (serial !== null) {
        // Excel serial date: días desde 1899-12-30
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        // Ajuste de horas y minutos
        const fractional_day = serial - Math.floor(serial);
        const total_seconds = Math.round(86400 * fractional_day);
        date_info.setSeconds(total_seconds);
        return date_info;
    }
    // Si es una cadena tipo fecha, intentar parsear normalmente
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

let dashboardInitialized = false;

function initializeDashboard() {
    if (dashboardInitialized) return;

    uploadSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    // Add filter listeners only once
    dateFilter.addEventListener('change', () => {
        console.log('Filtro de fecha cambiado:', dateFilter.value);
        applyFilters();
    });
    projectFilter.addEventListener('change', () => {
        console.log('Filtro de proyecto cambiado:', projectFilter.value);
        applyFilters();
    });
    personFilter.addEventListener('change', () => {
        console.log('Filtro de persona cambiado:', personFilter.value);
        applyFilters();
    });
    resetFiltersBtn.addEventListener('click', () => {
        console.log('Filtros reseteados');
        resetFilters();
    });

    dashboardInitialized = true;
}

function updateUI() {
    // Establecer los valores por defecto ANTES de poblar y aplicar
    dateFilter.value = 'current-month';
    projectFilter.value = 'all';
    personFilter.value = 'all';

    populateFilters();
    applyFilters();
}

function populateFilters() {
    // Guardar la selección actual si existe
    const selectedProject = projectFilter.value;
    const selectedPerson = personFilter.value;

    // Get unique projects and persons
    const projects = [...new Set(rawData.map(r => r.proyecto))].filter(Boolean).sort();
    const persons = [...new Set(rawData.map(r => r.persona))].filter(Boolean).sort();

    // Populate project filter
    projectFilter.innerHTML = '<option value="all">Todos</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectFilter.appendChild(option);
    });

    // Populate person filter
    personFilter.innerHTML = '<option value="all">Todos</option>';
    persons.forEach(person => {
        const option = document.createElement('option');
        option.value = person;
        option.textContent = person;
        personFilter.appendChild(option);
    });

    // Restaurar la selección si todavía es válida
    if (projects.includes(selectedProject)) {
        projectFilter.value = selectedProject;
    }
    if (persons.includes(selectedPerson)) {
        personFilter.value = selectedPerson;
    }
}

function applyFilters() {
    console.log('Aplicando filtros...');
    const minDate = getDateRange();
    const selectedProject = projectFilter.value;
    const selectedPerson = personFilter.value;
    filteredData = rawData.filter(row => {
        const dateMatch = row.fecha >= minDate;
        const projectMatch = selectedProject === 'all' || row.proyecto === selectedProject;
        const personMatch = selectedPerson === 'all' || row.persona === selectedPerson;
        return dateMatch && projectMatch && personMatch;
    });
    console.log('Datos filtrados:', filteredData);
    updateDashboard();
}

function resetFilters() {
    // Simplemente llama a updateUI para restaurar el estado inicial
    updateUI();
}

function getDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparaciones correctas

    switch (dateFilter.value) {
        case 'current-month':
            return new Date(today.getFullYear(), today.getMonth(), 1);
        case 'last-month':
            // Retrocede al mes anterior
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            return lastMonth;
        case 'last-quarter':
            // Retrocede 3 meses
            const lastQuarter = new Date(today);
            lastQuarter.setMonth(today.getMonth() - 3);
            return lastQuarter;
        case 'last-semester':
            // Retrocede 6 meses
            const lastSemester = new Date(today);
            lastSemester.setMonth(today.getMonth() - 6);
            return lastSemester;
        default:
            // Por defecto, el mes actual
            return new Date(today.getFullYear(), today.getMonth(), 1);
    }
}

function updateDashboard() {
    console.log('Actualizando dashboard...');
    if (filteredData.length === 0) {
        totalHoursEl.textContent = '0 h';
        document.getElementById('chart-person').innerHTML = '<p style="text-align:center; color: #a0a0a0;">No hay datos para los filtros seleccionados.</p>';
        document.getElementById('chart-project').innerHTML = '';
        document.querySelector('#data-table tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay datos</td></tr>';
        return;
    }
    updateTotalHours();
    updateCharts();
    updateTable();
}

function updateTotalHours() {
    const total = filteredData.reduce((sum, row) => sum + row.horas, 0);
    totalHoursEl.textContent = `${total.toFixed(1)} h`;
}

function updateCharts() {
    console.log('Actualizando gráficos...');

    // Hours by Person
    const hoursByPerson = {};
    filteredData.forEach(row => {
        hoursByPerson[row.persona] = (hoursByPerson[row.persona] || 0) + row.horas;
    });
    const personData = Object.entries(hoursByPerson)
        .sort((a, b) => b[1] - a[1]) // Ordenar descendente para mejor visualización
        .map(([name, hours]) => ({
            name: name.length > 35 ? name.substring(0, 32) + '...' : name, // Aumentado de 25 a 35 chars
            fullName: name, // Mantener nombre completo para hover
            hours
        }));

    if (personData.length === 0) {
        document.getElementById('chart-person').innerHTML = '<p style="text-align:center; color: #a0a0a0;">No hay datos para mostrar.</p>';
    } else {
        // Calcular altura dinámica basada en número de elementos (más compacta)
        const minHeight = isMobile ? 250 : 350;
        const itemHeight = isMobile ? 28 : 35; // Reducido de 35/45 a 28/35
        const calculatedHeight = Math.max(minHeight, personData.length * itemHeight + 80);

        // Calcular margen izquierdo dinámico basado en la longitud máxima de nombres (aumentado)
        const maxNameLength = Math.max(...personData.map(d => d.name.length));
        const leftMargin = isMobile ?
            Math.min(200, Math.max(120, maxNameLength * 8)) :
            Math.min(300, Math.max(180, maxNameLength * 10));

        const personLayout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#fafafa', size: isMobile ? 11 : 13 },
            xaxis: {
                title: { text: 'Horas', font: { size: isMobile ? 12 : 14 } },
                gridcolor: '#2e3440',
                tickfont: { size: isMobile ? 10 : 12 },
                showline: true,
                linecolor: '#2e3440'
            },
            yaxis: {
                title: '',
                gridcolor: '#2e3440',
                tickfont: { size: isMobile ? 9 : 11 },
                showline: false,
                tickmode: 'linear',
                automargin: true,
                ticklabelposition: 'outside',
                ticks: 'outside',
                ticklen: 10,
                tickcolor: 'rgba(0,0,0,0)',
                align: 'left'
            },
            margin: {
                l: leftMargin,
                r: 40,
                t: 20,
                b: 40
            },
            height: calculatedHeight,
            showlegend: false,
            bargap: 0.5 // Aumentado para hacer las barras más delgadas
        };

        Plotly.newPlot('chart-person', [{
            x: personData.map(d => d.hours),
            y: personData.map(d => d.name),
            type: 'bar',
            orientation: 'h',
            marker: {
                color: personData.map((_, i) => `hsl(${210 + i * 15}, 70%, ${50 + (i % 3) * 10}%)`),
                line: { color: 'rgba(255,255,255,0.1)', width: 1 }
            },
            text: personData.map(d => `${Math.round(d.hours)}h`),
            textposition: 'outside',
            textfont: { size: isMobile ? 9 : 11, color: '#fafafa' },
            hoverinfo: 'none'
        }], personLayout, {
            responsive: true,
            displayModeBar: !isMobile,
            modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian', 'toggleSpikelines']
        });
    }

    // Hours by Project
    const hoursByProject = {};
    filteredData.forEach(row => {
        hoursByProject[row.proyecto] = (hoursByProject[row.proyecto] || 0) + row.horas;
    });
    const projectData = Object.entries(hoursByProject)
        .sort((a, b) => b[1] - a[1]) // Ordenar descendente para mejor visualización
        .map(([name, hours]) => ({
            name: name.length > 40 ? name.substring(0, 37) + '...' : name, // Aumentado de 30 a 40 chars
            fullName: name, // Mantener nombre completo para hover
            hours
        }));

    if (projectData.length === 0) {
        document.getElementById('chart-project').innerHTML = '<p style="text-align:center; color: #a0a0a0;">No hay datos para mostrar.</p>';
    } else {
        // Calcular altura dinámica basada en número de elementos (más compacta)
        const minHeight = isMobile ? 250 : 350;
        const itemHeight = isMobile ? 28 : 35; // Reducido para hacer más compacto
        const calculatedHeight = Math.max(minHeight, projectData.length * itemHeight + 80);

        // Calcular margen izquierdo dinámico basado en la longitud máxima de nombres (aumentado)
        const maxNameLength = Math.max(...projectData.map(d => d.name.length));
        const leftMargin = isMobile ?
            Math.min(200, Math.max(120, maxNameLength * 8)) :
            Math.min(300, Math.max(180, maxNameLength * 10));

        const projectLayout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#fafafa', size: isMobile ? 11 : 13 },
            xaxis: {
                title: { text: 'Horas', font: { size: isMobile ? 12 : 14 } },
                gridcolor: '#2e3440',
                tickfont: { size: isMobile ? 10 : 12 },
                showline: true,
                linecolor: '#2e3440'
            },
            yaxis: {
                title: '',
                gridcolor: '#2e3440',
                tickfont: { size: isMobile ? 9 : 11 },
                showline: false,
                tickmode: 'linear',
                automargin: true,
                ticklabelposition: 'outside',
                ticks: 'outside',
                ticklen: 10,
                tickcolor: 'rgba(0,0,0,0)',
                align: 'left'
            },
            margin: {
                l: leftMargin,
                r: 40,
                t: 20,
                b: 40
            },
            height: calculatedHeight,
            showlegend: false,
            bargap: 0.5 // Aumentado para hacer las barras más delgadas
        };

        Plotly.newPlot('chart-project', [{
            x: projectData.map(d => d.hours),
            y: projectData.map(d => d.name),
            type: 'bar',
            orientation: 'h',
            marker: {
                color: projectData.map((_, i) => `hsl(${120 + i * 15}, 60%, ${45 + (i % 3) * 10}%)`),
                line: { color: 'rgba(255,255,255,0.1)', width: 1 }
            },
            text: projectData.map(d => `${Math.round(d.hours)}h`),
            textposition: 'outside',
            textfont: { size: isMobile ? 9 : 11, color: '#fafafa' },
            hoverinfo: 'none'
        }], projectLayout, {
            responsive: true,
            displayModeBar: !isMobile,
            modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian', 'toggleSpikelines']
        });
    }
}

// Responsive utilities
function checkMobileView() {
    isMobile = window.innerWidth <= 768;
    // Optimize charts for mobile
    if (typeof Plotly !== 'undefined') {
        updateChartsLayout();
    }
}

function updateChartsLayout() {
    const chartPersonEl = document.getElementById('chart-person');
    const chartProjectEl = document.getElementById('chart-project');

    if (chartPersonEl && chartProjectEl) {
        // Get current chart data
        const personData = chartPersonEl.data;
        const projectData = chartProjectEl.data;

        if (personData && personData.length > 0 && projectData && projectData.length > 0) {
            // Calculate optimal margins based on current screen size
            const personYLabels = personData[0].y || [];
            const projectYLabels = projectData[0].y || [];

            const maxPersonNameLength = Math.max(...personYLabels.map(label => String(label).length));
            const maxProjectNameLength = Math.max(...projectYLabels.map(label => String(label).length));

            const personLeftMargin = isMobile ?
                Math.min(200, Math.max(120, maxPersonNameLength * 8)) :
                Math.min(300, Math.max(180, maxPersonNameLength * 10));

            const projectLeftMargin = isMobile ?
                Math.min(200, Math.max(120, maxProjectNameLength * 8)) :
                Math.min(300, Math.max(180, maxProjectNameLength * 10));

            // Mobile-optimized layout for person chart
            const personMobileLayout = {
                height: Math.max(isMobile ? 250 : 350, personYLabels.length * (isMobile ? 28 : 35) + 80),
                margin: {
                    l: personLeftMargin,
                    r: 40,
                    t: 20,
                    b: 40
                },
                font: { size: isMobile ? 11 : 13 },
                xaxis: {
                    tickfont: { size: isMobile ? 10 : 12 }
                },
                yaxis: {
                    tickfont: { size: isMobile ? 9 : 11 },
                    automargin: true
                },
                bargap: 0.5 // Barras más delgadas
            };

            // Mobile-optimized layout for project chart
            const projectMobileLayout = {
                height: Math.max(isMobile ? 250 : 350, projectYLabels.length * (isMobile ? 28 : 35) + 80),
                margin: {
                    l: projectLeftMargin,
                    r: 40,
                    t: 20,
                    b: 40
                },
                font: { size: isMobile ? 11 : 13 },
                xaxis: {
                    tickfont: { size: isMobile ? 10 : 12 }
                },
                yaxis: {
                    tickfont: { size: isMobile ? 9 : 11 },
                    automargin: true
                },
                bargap: 0.5 // Barras más delgadas
            };

            // Update charts with optimized layout
            Plotly.relayout('chart-person', personMobileLayout);
            Plotly.relayout('chart-project', projectMobileLayout);
        }
    }
}

// Window resize handler for responsive behavior
window.addEventListener('resize', () => {
    checkMobileView();
    // Debounce chart updates
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
        if (document.getElementById('chart-person').data) {
            updateChartsLayout();
        }
    }, 250);
});

function updateTable() {
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';
    // Ordenar los datos por fecha descendente para la tabla
    const sortedData = [...filteredData].sort((a, b) => b.fecha - a.fecha);

    sortedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Persona asignada">${row.persona}</td>
            <td data-label="Ticket">${row.issueKey}</td>
            <td data-label="Resumen">${row.issueSummary}</td>
            <td data-label="Proyecto">${row.proyecto}</td>
            <td data-label="Descripción del trabajo">${row.issueDescription}</td>
            <td data-label="Fecha de creación">${formatDate(row.fecha)}</td>
            <td data-label="Tiempo invertido">${row.tiempoInvertido}</td>
            <td data-label="Horas">${Math.round(row.horas)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Inicializar con datos de ejemplo si es necesario
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mobile check
    checkMobileView();

    // Aquí podrías cargar un archivo de ejemplo automáticamente
    // o dejarlo vacío para que el usuario suba el suyo
});
