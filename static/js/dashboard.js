// ============================================================
// SISTEMA DE NOTIFICACIONES TOAST
// ============================================================
function toast(mensaje, tipo = 'info', duracion = 3500) {
    let contenedor = document.getElementById('toast-contenedor');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-contenedor';
        contenedor.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            z-index: 9999; display: flex; flex-direction: column; gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(contenedor);
    }

    const colores = {
        success: { bg: '#1e7e4a', icon: '✅', borde: '#27ae60' },
        error:   { bg: '#c0392b', icon: '❌', borde: '#e74c3c' },
        warning: { bg: '#d68910', icon: '⚠️', borde: '#f39c12' },
        info:    { bg: '#1a5276', icon: 'ℹ️', borde: '#2980b9' }
    };
    const c = colores[tipo] || colores.info;

    const t = document.createElement('div');
    t.style.cssText = `
        background: ${c.bg};
        color: white;
        padding: 14px 18px;
        border-radius: 10px;
        font-size: 14px;
        font-family: 'Segoe UI', sans-serif;
        box-shadow: 0 6px 24px rgba(0,0,0,0.25);
        display: flex; align-items: center; gap: 10px;
        min-width: 260px; max-width: 380px;
        border-left: 4px solid ${c.borde};
        pointer-events: all;
        cursor: pointer;
        opacity: 0;
        transform: translateX(40px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    t.innerHTML = `<span style="font-size:18px;flex-shrink:0">${c.icon}</span><span style="flex:1;line-height:1.4">${mensaje}</span><span style="opacity:0.6;font-size:18px;flex-shrink:0">×</span>`;
    t.onclick = () => cerrarToast(t);
    contenedor.appendChild(t);

    requestAnimationFrame(() => {
        t.style.opacity = '1';
        t.style.transform = 'translateX(0)';
    });

    setTimeout(() => cerrarToast(t), duracion);
}

function cerrarToast(t) {
    t.style.opacity = '0';
    t.style.transform = 'translateX(40px)';
    setTimeout(() => t.remove(), 300);
}

// Modal de confirmación bonito (reemplaza confirm())
function confirmar(mensaje) {
    return new Promise(function(resolve) {
        var prev = document.getElementById('modal-confirmar-custom');
        if (prev) prev.remove();

        var overlay = document.createElement('div');
        overlay.id = 'modal-confirmar-custom';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        var box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:14px;padding:28px 30px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;';
        header.innerHTML = '<div style="width:42px;height:42px;border-radius:50%;background:#fff3e0;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">⚠️</div><div><div style="font-weight:700;font-size:16px;color:#1a2e22;margin-bottom:6px;">¿Estás seguro?</div><div style="font-size:14px;color:#666;line-height:1.5;">' + mensaje + '</div></div>';

        var botones = document.createElement('div');
        botones.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

        var btnNo = document.createElement('button');
        btnNo.textContent = 'Cancelar';
        btnNo.style.cssText = 'padding:9px 20px;border-radius:8px;border:1.5px solid #ddd;background:white;color:#555;font-size:14px;cursor:pointer;font-family:inherit;font-weight:500;';
        btnNo.onmouseover = function(){ this.style.background='#f5f5f5'; };
        btnNo.onmouseout  = function(){ this.style.background='white'; };

        var btnSi = document.createElement('button');
        btnSi.textContent = 'Sí, eliminar';
        btnSi.style.cssText = 'padding:9px 20px;border-radius:8px;border:none;background:#e74c3c;color:white;font-size:14px;cursor:pointer;font-family:inherit;font-weight:600;';
        btnSi.onmouseover = function(){ this.style.background='#c0392b'; };
        btnSi.onmouseout  = function(){ this.style.background='#e74c3c'; };

        botones.appendChild(btnNo);
        botones.appendChild(btnSi);
        box.appendChild(header);
        box.appendChild(botones);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        btnSi.onclick = function() { overlay.remove(); resolve(true); };
        btnNo.onclick = function() { overlay.remove(); resolve(false); };
        overlay.onclick = function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

// ============================================================
// dashboard.js — corregido y mejorado
// ============================================================

// Variable global: dispositivo seleccionado para WiFi y Bomba
let dispositivoActualId = null;
let dispositivosGlobal  = [];   // lista completa cargada al inicio

// ============================================================
// CARGA GLOBAL DE DISPOSITIVOS (al arrancar)
// ============================================================
async function cargarDispositivosGlobal() {
    try {
        const res = await fetch('/api/dispositivos/lista');
        dispositivosGlobal = await res.json();
        if (dispositivosGlobal.length > 0 && !dispositivoActualId) {
            dispositivoActualId = dispositivosGlobal[0].idDispositivo;
        }
        _llenarSelectoresDispositivo();
    } catch(e) { console.error('Error cargando dispositivos globales:', e); }
}

function _llenarSelectoresDispositivo() {
    ['select-wifi-dispositivo', 'select-bomba-dispositivo'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = dispositivosGlobal.map(d =>
            `<option value="${d.idDispositivo}">${d.nombre}</option>`
        ).join('');
        if (dispositivoActualId) sel.value = dispositivoActualId;
    });
}

function cambiarDispositivoWifi() {
    const sel = document.getElementById('select-wifi-dispositivo');
    if (sel) dispositivoActualId = parseInt(sel.value);
    cargarRedActual();
}

function cambiarDispositivoBomba() {
    const sel = document.getElementById('select-bomba-dispositivo');
    if (sel) dispositivoActualId = parseInt(sel.value);
    cargarSeccionRelevador();
}

// --- 1. Navegación ---
function mostrarSeccion(idSeccion) {
    const elementos = document.querySelectorAll('.seccion, #dashboard-contenido');
    elementos.forEach(s => { s.style.display = 'none'; });
    const target = document.getElementById(idSeccion);
    if (target) target.style.display = 'block';

    // Recargar datos según la sección a la que se entra
    if (idSeccion === 'dashboard-contenido') cargarDashboardInicio();
    if (idSeccion === 'seccion-hardware')  actualizarListaDispositivos();
    if (idSeccion === 'seccion-logica')    cargarSensoresEnLogica();
    if (idSeccion === 'seccion-analitica') cargarSensoresEnAnalitica();
    if (idSeccion === 'seccion-cultivos')  cargarSeccionCultivos();
}


// --- 2. Modales ---
async function abrirModal(idModal) {
    const modal = document.getElementById(idModal);

    if (idModal === 'modal-siembra')     await cargarTiposCultivo();
    if (idModal === 'modal-cosecha')     await cargarCultivosActivos();
    if (idModal === 'modal-cultivo')     await cargarCultivosEnModal();

    if (idModal === 'modal-sensor') {
        const response = await fetch('/api/dispositivos/lista');
        const dispositivos = await response.json();
        if (dispositivos.length === 0) { toast("No hay dispositivos registrados aún", "warning"); return; }
        cargarListaDispositivos();
    }

    if (idModal === 'modal-parametro') {
        await cargarSensoresEnSelectParametro();
    }

    if (modal) modal.classList.add('activo');
}

function cerrarModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) modal.classList.remove('activo');
}

function mostrarModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('activo');
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('activo');
});


// --- 3. Dispositivos ---
async function guardarDispositivo() {
    const data = {
        nombre: document.getElementById('nombreDispositivo').value,
        tipo: `${document.getElementById('tipoControlador').value} (${document.getElementById('tipoConexion').value})`
    };
    if (!data.nombre) return toast("Por favor ingresa un nombre", "warning");

    const response = await fetch('/api/dispositivos/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    if (response.ok && result.status === 'success') {
        toast("Dispositivo guardado", "info");
        cerrarModal('modal-dispositivo');
        document.getElementById('nombreDispositivo').value = '';
        actualizarListaDispositivos();
    }
}

// CORREGIDO: Muestra dispositivos Y sus sensores vinculados con estado
async function actualizarListaDispositivos() {
    const contenedor = document.getElementById('lista-hardware');
    const btnSensor  = document.getElementById('btn-agregar-sensor');

    contenedor.innerHTML = '<p style="color:#888;">Cargando...</p>';

    try {
        const [resDis, resSen] = await Promise.all([
            fetch('/api/dispositivos/lista'),
            fetch('/api/sensores/lista')
        ]);
        const dispositivos = await resDis.json();
        const sensores     = await resSen.json();

        if (btnSensor) btnSensor.disabled = (dispositivos.length === 0);

        if (dispositivos.length === 0) {
            contenedor.innerHTML = `
                <div class="card" style="text-align:center; padding:30px; color:#888;">
                    No hay dispositivos registrados aún.<br>
                    <button style="margin-top:12px;" onclick="abrirModal('modal-dispositivo')">+ Agregar primer dispositivo</button>
                </div>`;
            return;
        }

        let html = '<h3 style="margin-bottom:12px;">Dispositivos y Sensores Conectados</h3>';

        dispositivos.forEach(d => {
            // Filtrar sensores que pertenecen a este dispositivo
            const sensoresDev = sensores.filter(s => String(s.idDispositivo) === String(d.idDispositivo));

            html += `
            <div class="card" style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="font-size:15px;">🔌 ${d.nombre}</strong>
                        <span class="badge badge-azul" style="margin-left:8px;">${d.tipo || 'Sin tipo'}</span>
                    </div>
                    <span class="badge ${sensoresDev.length > 0 ? 'badge-verde' : 'badge-gris'}">
                        ${sensoresDev.length} sensor${sensoresDev.length !== 1 ? 'es' : ''}
                    </span>
                </div>`;

            if (sensoresDev.length > 0) {
                html += `<div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">`;
                sensoresDev.forEach(s => {
                    html += `
                    <div style="background:#f8f9fa; border:1px solid #e0e0e0; border-radius:6px; padding:8px 12px; min-width:160px;">
                        <div style="font-weight:600; font-size:13px;">📡 ${s.tipo_sensor}</div>

                        <div style="font-size:12px; color:#666;">Unidad: ${s.unidad_medida || '—'}</div>
                        <div style="font-size:11px; color:#999;">ID: ${s.idSensore}</div>
                    </div>`;
                });
                html += `</div>`;
            } else {
                html += `<p style="color:#aaa; font-size:13px; margin-top:8px;">Sin sensores vinculados aún.</p>`;
            }

            html += `</div>`;
        });

        contenedor.innerHTML = html;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar dispositivos.</p>';
        console.error(e);
    }
}


// --- 4. Sensores ---
async function cargarListaDispositivos() {
    const select = document.getElementById('selectDispositivoVinculado');
    const response = await fetch('/api/dispositivos/lista');
    const dispositivos = await response.json();
    select.innerHTML = '';
    dispositivos.forEach(d => {
        let o = document.createElement('option');
        o.value = d.idDispositivo; o.text = d.nombre; select.add(o);
    });
}

async function guardarSensor() {
    const data = {
        idDispositivo: document.getElementById('selectDispositivoVinculado').value,
        tipo:    document.getElementById('tipoSensor').value,

        unidad:  document.getElementById('unidadMedida').value
    };
    const response = await fetch('/api/sensores/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (response.ok && result.status === 'success') {
        toast('✅ Sensor guardado correctamente', "success");
        cerrarModal('modal-sensor');
        actualizarListaDispositivos(); // Refrescar la lista de hardware
        cargarSensoresEnLogica();      // Refrescar también en Lógica
        cargarSensoresEnAnalitica();
    }
}

async function cargarSensoresEnAnalitica() {
    const select = document.getElementById('selectSensorAnalitica');
    if (!select) return;
    try {
        const response = await fetch('/api/sensores/lista');
        const sensores = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un sensor --</option>';
        sensores.forEach(s => {
            let o = document.createElement('option');
            o.value = s.idSensore;
            o.text = `${s.tipo_sensor} – ${s.unidad_medida || ''} (ID: ${s.idSensore})`;
            select.add(o);
        });
    } catch (e) { console.error("Error cargando sensores analítica:", e); }
}


// --- 5. Lógica de Control (CORREGIDO y con gráfica en tiempo real) ---

// CORREGIDO: Se llama con await y popula el select correctamente
async function cargarSensoresEnLogica() {
    const select = document.getElementById('selectSensorLogica');
    if (!select) return;
    try {
        const response = await fetch('/api/sensores/lista');
        const sensores = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un sensor --</option>';
        sensores.forEach(s => {
            let o = document.createElement('option');
            o.value = s.idSensore;
            o.text = `${s.tipo_sensor} – ${s.unidad_medida || ''} (ID: ${s.idSensore})`;
            select.add(o);
        });
    } catch (e) {
        console.error("Error cargando sensores en lógica:", e);
    }
}

async function verificarEstadoSensor() {
    const idSensor = document.getElementById('selectSensorLogica').value;
    if (!idSensor) return toast("Selecciona un sensor primero", "warning");

    const contenedor = document.getElementById('resultado-logica');
    contenedor.innerHTML = '<p style="color:#888;">Verificando...</p>';

    try {
        const response = await fetch(`/api/sensores/estado/${idSensor}`);
        const data = await response.json();
        const activo = data.activo;
        const ultimaLectura = data.ultima_lectura || null;

        contenedor.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <div style="font-size:32px;">${activo ? '✅' : '❌'}</div>
                <div>
                    <div style="font-size:16px; font-weight:600;">${activo ? 'Sensor Funcionando' : 'Sensor Desconectado'}</div>
                    <div style="font-size:13px; color:#666;">Sensor ID: ${idSensor}</div>
                    ${ultimaLectura ? `<div style="font-size:13px; color:#666;">Última lectura: <strong>${ultimaLectura.valor} ${ultimaLectura.unidad}</strong> — ${ultimaLectura.fecha_hora}</div>` : ''}
                </div>
            </div>`;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:red;">Error al verificar el sensor.</p>';
    }
}


// Gráfica en tiempo real
let intervaloVisualizacion = null;
let graficaTiempoReal      = null;
const MAX_PUNTOS_GRAFICA   = 30;

function visualizarInformacion() {
    const idSensor = document.getElementById('selectSensorLogica').value;
    if (!idSensor) return toast("Selecciona un sensor primero", "warning");

    // Detener intervalo anterior
    if (intervaloVisualizacion) clearInterval(intervaloVisualizacion);

    const contenedor = document.getElementById('resultado-logica');

    // Obtener etiqueta del sensor seleccionado
    const select   = document.getElementById('selectSensorLogica');
    const etiqueta = select.options[select.selectedIndex]?.text || `Sensor ${idSensor}`;

    contenedor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div>
                <strong>📡 ${etiqueta}</strong>
                <span id="valor-actual-badge" style="display:inline-block; margin-left:10px; font-size:18px; font-weight:700; color:#2c3e50;">--</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                <span id="estado-live" style="font-size:12px; color:#27ae60; font-weight:600;">● EN VIVO</span>
                <button class="btn-rojo btn-sm" onclick="limpiarVisualizacion()">⏹ Detener</button>
            </div>
        </div>
        <canvas id="graficaTiempoReal" height="120"></canvas>`;

    // Inicializar Chart.js
    const ctx = document.getElementById('graficaTiempoReal').getContext('2d');
    if (graficaTiempoReal) graficaTiempoReal.destroy();

    graficaTiempoReal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: etiqueta,
                data: [],
                borderColor: 'rgb(44, 62, 80)',
                backgroundColor: 'rgba(44, 62, 80, 0.08)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 300 },
            scales: {
                x: { ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                y: { beginAtZero: false, ticks: { font: { size: 11 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}` } }
            }
        }
    });

    // Función que obtiene dato y lo agrega a la gráfica
    async function obtenerYGraficar() {
        try {
            const res  = await fetch(`/api/sensores/datos-actuales/${idSensor}`);
            const data = await res.json();

            if (data.error) {
                document.getElementById('estado-live').textContent = '⚠ Sin datos';
                document.getElementById('estado-live').style.color = '#e67e22';
                return;
            }

            const ahora = new Date().toLocaleTimeString();
            const valor = parseFloat(data.valor);

            // Actualizar badge de valor actual
            const badge = document.getElementById('valor-actual-badge');
            if (badge) badge.textContent = `${data.valor} ${data.unidad || ''}`;

            // Agregar punto a la gráfica
            graficaTiempoReal.data.labels.push(ahora);
            graficaTiempoReal.data.datasets[0].data.push(valor);

            // Mantener solo los últimos N puntos
            if (graficaTiempoReal.data.labels.length > MAX_PUNTOS_GRAFICA) {
                graficaTiempoReal.data.labels.shift();
                graficaTiempoReal.data.datasets[0].data.shift();
            }

            graficaTiempoReal.update();
        } catch (e) {
            console.error("Error obteniendo dato:", e);
        }
    }

    obtenerYGraficar(); // Primera lectura inmediata
    intervaloVisualizacion = setInterval(obtenerYGraficar, 2000);
}

function limpiarVisualizacion() {
    if (intervaloVisualizacion) {
        clearInterval(intervaloVisualizacion);
        intervaloVisualizacion = null;
    }
    if (graficaTiempoReal) {
        graficaTiempoReal.destroy();
        graficaTiempoReal = null;
    }
    document.getElementById('resultado-logica').innerHTML = '';
}


// --- 6. Analítica ---
let miGrafica = null;

async function cargarGrafica(rango) {
    const idSensor = document.getElementById('selectSensorAnalitica').value;
    if (!idSensor) return toast("Selecciona un sensor primero", "warning");

    const response = await fetch(`/api/sensores/analitica/${idSensor}/${rango}`);
    const datos    = await response.json();

    if (datos.error) return toast("Error: " + datos.error, "error");

    const ctx = document.getElementById('graficaSensor').getContext('2d');
    if (miGrafica) miGrafica.destroy();

    const etiquetaRango = { 'ahora': 'Última 1 hora', '24h': 'Últimas 24 horas', 'semana': 'Última semana' }[rango] || rango;

    miGrafica = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datos.map(d => new Date(d.fecha_hora).toLocaleTimeString()),
            datasets: [{
                label: etiquetaRango,
                data: datos.map(d => d.valor),
                borderColor: 'rgb(44, 62, 80)',
                backgroundColor: 'rgba(44, 62, 80, 0.08)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: datos.length > 50 ? 0 : 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { ticks: { maxTicksLimit: 10 } }
            }
        }
    });
}


// --- 7. Cultivos ---
async function cargarTiposCultivo() {
    const select = document.getElementById('selectTipoCultivo');
    if (!select) return;
    try {
        const response = await fetch('/api/tipo_cultivo/lista');
        const tipos    = await response.json();
        select.innerHTML = '<option value="">-- Selecciona el tipo --</option>';
        tipos.forEach(t => {
            let o = document.createElement('option');
            o.value = t.idTipo_Cultivo; o.textContent = t.nombre_planta; select.appendChild(o);
        });
    } catch (error) { console.error("Error tipos cultivo:", error); }
}

async function guardarSiembra() {
    const nombre   = document.getElementById('nombreCultivo').value;
    const fecha    = document.getElementById('fechaSiembra').value;
    const cantidad = document.getElementById('cantidadPlantas').value;
    const tamano   = document.getElementById('tamanoPlanta').value;
    const idTipo   = document.getElementById('selectTipoCultivo').value;

    if (!nombre || !fecha || !cantidad || !tamano || !idTipo) {
        return toast("Completa todos los campos", "warning");
    }
    try {
        const response = await fetch('/api/cultivos/sembrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, fecha, cantidad, tamano, idTipo, idSistema: 1 })
        });
        const result = await response.json();
        if (response.ok && result.status === 'success') { toast("¡Siembra guardada correctamente!", "success"); cerrarModal('modal-siembra'); cargarTablaCultivosSeccion(); }
        else toast("Error al guardar siembra: " + (result.error || "Revisa los datos"), "error");
    } catch (error) { toast("Error de conexión: " + error.message, "error"); }
}

async function guardarTipoCultivo() {
    const data = {
        nombre:      document.getElementById('nombrePlanta').value,
        descripcion: document.getElementById('descPlanta').value
    };
    if (!data.nombre) return toast("El nombre es obligatorio", "warning");
    const response = await fetch('/api/tipo_cultivo/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (response.ok && result.status === 'success') {
        toast("¡Tipo de cultivo registrado!", "success");
        cerrarModal('modal-tipo-cultivo');
        document.getElementById('nombrePlanta').value = '';
        document.getElementById('descPlanta').value   = '';
    } else toast("Error al guardar", "error");
}


// --- 8. Cosecha ---
async function cargarCultivosActivos() {
    const select = document.getElementById('selectCultivoCosecha');
    if (!select) return;
    try {
        const response = await fetch('/api/cultivos/lista');
        const lista    = await response.json();
        select.innerHTML = '<option value="">-- Selecciona el cultivo --</option>';
        lista.forEach(c => {
            let o = document.createElement('option');
            o.value = c.idCultivo; o.textContent = c.nombreCultivo; select.appendChild(o);
        });
    } catch (e) { console.error("Error cultivos:", e); }
}

async function guardarCosecha() {
    const elFecha         = document.getElementById('fechaCosecha');
    const elCantidad      = document.getElementById('cantidadCosechada');
    const elCalidad       = document.getElementById('calidadCosecha');
    const elObservaciones = document.getElementById('observacionesCosecha');
    const elIdCultivo     = document.getElementById('selectCultivoCosecha');

    if (!elIdCultivo.value) return toast("Selecciona un cultivo primero", "warning");

    const data = {
        fecha:         elFecha.value,
        cantidad:      elCantidad.value,
        calidad:       elCalidad.value || 'N/A',
        observaciones: elObservaciones ? elObservaciones.value : '',
        idCultivo:     elIdCultivo.value
    };
    try {
        const response = await fetch('/api/cosechas/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok && result.status === 'success') { toast("¡Cosecha guardada correctamente!", "success"); cerrarModal('modal-cosecha'); cargarTablaCosechasSeccion(); }
        else toast("Error al guardar cosecha: " + (result.error || "Revisa los datos"), "error");
    } catch (e) { toast("Error de conexión: " + e.message, "info"); }
}


// --- 9. Validaciones ---
function validarTextoSoloLetras(input) {
    input.value = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    input.setCustomValidity(input.value.length > 0 && input.value.length < 3
        ? "La calidad debe tener al menos 3 letras." : "");
}


// --- 10. Tabs ---
function cambiarTab(idTab, btn) {
    document.querySelectorAll('.tab-contenido').forEach(t => t.classList.remove('activo'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btn.classList.add('activo');
}

function cambiarTabAlerta(idTab, btn) {
    const seccion = document.getElementById('seccion-alertas');
    seccion.querySelectorAll('.tab-contenido').forEach(t => t.classList.remove('activo'));
    seccion.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btn.classList.add('activo');

    if (idTab === 'tab-historial')  cargarHistorialAlertas();
    if (idTab === 'tab-parametros') cargarParametrosAlerta();
}


// --- 11. Modal cultivos/cosechas ---
async function cargarCultivosEnModal() {
    await Promise.all([cargarTablaCultivos(), cargarTablaCosechas()]);
}

async function cargarTablaCultivos() {
    const contenedor = document.getElementById('tabla-cultivos-modal');
    contenedor.innerHTML = '<p style="color:#888;">Cargando...</p>';
    try {
        const cultivos = await (await fetch('/api/cultivos/lista')).json();
        if (cultivos.length === 0) {
            contenedor.innerHTML = '<p style="color:#888;">No hay cultivos registrados.</p>'; return;
        }
        let html = `<table><thead><tr>
            <th>#</th><th>Nombre</th><th>Tipo</th>
            <th>Fecha Siembra</th><th>Cantidad</th><th>Tamaño</th>
            <th>Acciones</th>
        </tr></thead><tbody>`;
        cultivos.forEach(c => {
            html += `<tr id="fila-cultivo-${c.idCultivo}">
                <td>${c.idCultivo}</td>
                <td><strong>${c.nombreCultivo}</strong></td>
                <td>${c.tipo_cultivo || '—'}</td>
                <td>${c.fecha_siembra || '—'}</td>
                <td>${c.cantidad} plantas</td>
                <td>${c.tamano_planta ? c.tamano_planta + ' cm' : '—'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn-naranja btn-sm" onclick='abrirEditarCultivo(${JSON.stringify(c)})'>✏️ Editar</button>
                    <button class="btn-rojo btn-sm"    onclick="eliminarCultivo(${c.idCultivo})">🗑 Eliminar</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (e) { contenedor.innerHTML = '<p style="color:red;">Error al cargar cultivos.</p>'; }
}

// ── EDITAR CULTIVO ──────────────────────────────────────────
let _tiposCultivoCache = [];

async function abrirEditarCultivo(c) {
    // Cargar tipos si no están cargados
    if (_tiposCultivoCache.length === 0) {
        const res = await fetch('/api/tipo_cultivo/lista');
        _tiposCultivoCache = await res.json();
    }
    // Rellenar el modal de edición
    document.getElementById('editCultivoId').value       = c.idCultivo;
    document.getElementById('editNombreCultivo').value   = c.nombreCultivo;
    document.getElementById('editFechaSiembra').value    = c.fecha_siembra || '';
    document.getElementById('editCantidadPlantas').value = c.cantidad;
    document.getElementById('editTamanoPlantas').value   = c.tamano_planta || '';

    const sel = document.getElementById('editTipoCultivo');
    sel.innerHTML = _tiposCultivoCache.map(t =>
        `<option value="${t.idTipo_Cultivo}" ${t.idTipo_Cultivo == c.idTipo_Cultivo ? 'selected' : ''}>${t.nombre_planta}</option>`
    ).join('');

    abrirModal('modal-editar-cultivo');
}

async function guardarEdicionCultivo() {
    const id = document.getElementById('editCultivoId').value;
    const body = {
        nombre:  document.getElementById('editNombreCultivo').value.trim(),
        fecha:   document.getElementById('editFechaSiembra').value,
        cantidad:document.getElementById('editCantidadPlantas').value,
        tamano:  document.getElementById('editTamanoPlantas').value,
        idTipo:  document.getElementById('editTipoCultivo').value
    };
    if (!body.nombre || !body.fecha || !body.cantidad) {
        toast("Completa todos los campos obligatorios", "warning"); return;
    }
    try {
        const res = await fetch(`/api/cultivos/editar/${id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status === 'success') {
            cerrarModal('modal-editar-cultivo');
            await cargarTablaCultivos();
            await cargarCultivosActivos();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}

async function eliminarCultivo(id) {
    if (!await confirmar('¿Eliminar este cultivo? También se eliminarán sus cosechas asociadas.')) return;
    try {
        const res  = await fetch(`/api/cultivos/eliminar/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            await cargarTablaCultivos();
            await cargarCultivosActivos();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}

// ── TABLA COSECHAS ──────────────────────────────────────────
async function cargarTablaCosechas() {
    const contenedor = document.getElementById('tabla-cosechas-modal');
    contenedor.innerHTML = '<p style="color:#888;">Cargando...</p>';
    try {
        const cosechas = await (await fetch('/api/cosechas/lista')).json();
        if (cosechas.length === 0) {
            contenedor.innerHTML = '<p style="color:#888;">No hay cosechas registradas.</p>'; return;
        }
        let html = `<table><thead><tr>
            <th>#</th><th>Cultivo</th><th>Fecha</th>
            <th>Cantidad</th><th>Calidad</th><th>Observaciones</th><th>Acciones</th>
        </tr></thead><tbody>`;
        cosechas.forEach(cs => {
            html += `<tr id="fila-cosecha-${cs.idCosecha}">
                <td>${cs.idCosecha}</td>
                <td><strong>${cs.nombreCultivo || '—'}</strong></td>
                <td>${cs.fecha || '—'}</td>
                <td>${cs.cantidad}</td>
                <td><span class="badge badge-verde">${cs.calidad || '—'}</span></td>
                <td style="max-width:180px;white-space:pre-wrap;">${cs.observaciones || '—'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn-naranja btn-sm" onclick='abrirEditarCosecha(${JSON.stringify(cs)})'>✏️ Editar</button>
                    <button class="btn-rojo btn-sm"    onclick="eliminarCosecha(${cs.idCosecha})">🗑 Eliminar</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (e) { contenedor.innerHTML = '<p style="color:red;">Error al cargar cosechas.</p>'; }
}

// ── EDITAR COSECHA ──────────────────────────────────────────
function abrirEditarCosecha(cs) {
    document.getElementById('editCosechaId').value           = cs.idCosecha;
    document.getElementById('editFechaCosecha').value        = cs.fecha || '';
    document.getElementById('editCantidadCosecha').value     = cs.cantidad;
    document.getElementById('editCalidadCosecha').value      = cs.calidad || '';
    document.getElementById('editObservacionesCosecha').value= cs.observaciones || '';
    abrirModal('modal-editar-cosecha');
}

async function guardarEdicionCosecha() {
    const id = document.getElementById('editCosechaId').value;
    const body = {
        fecha:         document.getElementById('editFechaCosecha').value,
        cantidad:      document.getElementById('editCantidadCosecha').value,
        calidad:       document.getElementById('editCalidadCosecha').value.trim(),
        observaciones: document.getElementById('editObservacionesCosecha').value.trim()
    };
    if (!body.fecha || !body.cantidad) { toast("Completa todos los campos obligatorios", "warning"); return; }
    try {
        const res  = await fetch(`/api/cosechas/editar/${id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status === 'success') {
            cerrarModal('modal-editar-cosecha');
            await cargarTablaCosechas();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}

async function eliminarCosecha(id) {
    if (!await confirmar('¿Seguro que quieres eliminar esta cosecha?')) return;
    try {
        const res  = await fetch(`/api/cosechas/eliminar/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            await cargarTablaCosechas();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}


// --- 12. Usuario ---
async function cargarInfoUsuario() {
    try {
        const res  = await fetch('/api/usuario/info');
        const user = await res.json();
        document.getElementById('userNombre').textContent = user.nombre || '—';
        document.getElementById('userCorreo').textContent = user.correo || '—';

        // Cargar foto de perfil si existe
        const fotoEl = document.getElementById('fotoPerfil');
        const initEl = document.getElementById('fotoInicial');
        if (user.foto_perfil && fotoEl) {
            fotoEl.src = user.foto_perfil;
            fotoEl.style.display = 'block';
            if (initEl) initEl.style.display = 'none';
        } else if (fotoEl) {
            fotoEl.style.display = 'none';
            if (initEl) {
                initEl.style.display = 'flex';
                initEl.textContent = (user.nombre || 'U')[0].toUpperCase();
            }
        }
    } catch (e) { console.error("Error usuario:", e); }
}

async function cambiarPassword() {
    const passEl = document.getElementById('nuevaPass');
    const pass   = passEl ? passEl.value.trim() : '';

    if (!pass) return toast("Escribe una nueva contraseña", "warning");
    if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres", "warning");

    const btnEl = document.getElementById('btnCambiarPass');
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Guardando...'; }

    try {
        const res  = await fetch('/api/usuario/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            toast("✅ Contraseña actualizada correctamente", "success");
            if (passEl) passEl.value = '';
        } else {
            toast("Error: " + (data.error || "No se pudo actualizar"), "error");
        }
    } catch (e) {
        toast("Error de conexión: " + e.message, "error");
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Actualizar Contraseña'; }
    }
}

async function subirFotoPerfil(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        toast("La imagen debe pesar menos de 2 MB", "warning");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result; // data:image/...;base64,...

        // Mostrar preview inmediato
        const fotoEl = document.getElementById('fotoPerfil');
        const initEl = document.getElementById('fotoInicial');
        if (fotoEl) { fotoEl.src = base64; fotoEl.style.display = 'block'; }
        if (initEl) initEl.style.display = 'none';

        try {
            const res = await fetch('/api/usuario/foto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto: base64 })
            });
            const data = await res.json();
            if (!res.ok) toast("Error al guardar foto: " + (data.error || "Error desconocido"), "error");
        } catch (err) {
            toast("Error de red al subir foto", "error");
        }
    };
    reader.readAsDataURL(file);
}


// ============================================================
// --- 13. MÓDULO DE ALERTAS ---
// ============================================================

function badgePrioridad(p) {
    const mapa  = { critica: 'badge-rojo', alta: 'badge-naranja', media: 'badge-amarillo', baja: 'badge-verde' };
    const emoji = { critica: '🔴', alta: '🟠', media: '🟡', baja: '🟢' };
    return `<span class="badge ${mapa[p] || 'badge-gris'}">${emoji[p] || ''} ${p}</span>`;
}

function badgeEstado(e) {
    const mapa = { nueva: 'badge-rojo', vista: 'badge-amarillo', resuelta: 'badge-verde' };
    return `<span class="badge ${mapa[e] || 'badge-gris'}">${e}</span>`;
}

function labelCondicion(c) {
    return { mayor_que: '>', menor_que: '<', igual_a: '=' }[c] || c;
}

async function actualizarBadgeNav() {
    try {
        const res   = await fetch('/api/alertas/conteo');
        const data  = await res.json();
        const badge = document.getElementById('badge-alertas-nav');
        if (badge) {
            badge.textContent   = data.nuevas;
            badge.style.display = data.nuevas > 0 ? 'flex' : 'none';
        }
    } catch (e) { /* silencioso */ }
}

async function cargarAlertasSeccion() {
    await Promise.all([
        cargarHistorialAlertas(),
        cargarParametrosAlerta(),
        cargarSensoresEnFiltro()
    ]);
}

async function cargarSensoresEnFiltro() {
    const select = document.getElementById('filtro-sensor-historial');
    if (!select) return;
    try {
        const sensores = await (await fetch('/api/sensores/lista')).json();
        select.innerHTML = '<option value="">Todos los sensores</option>';
        sensores.forEach(s => {
            let o = document.createElement('option');
            o.value = s.idSensore;
            o.textContent = `${s.tipo_sensor} (ID:${s.idSensore})`;
            select.appendChild(o);
        });
    } catch (e) { console.error("Error cargando sensores filtro:", e); }
}

async function cargarSensoresEnSelectParametro() {
    const select = document.getElementById('selectSensorParametro');
    if (!select) return;
    try {
        const sensores = await (await fetch('/api/sensores/lista')).json();
        select.innerHTML = '<option value="">-- Selecciona sensor --</option>';
        sensores.forEach(s => {
            let o = document.createElement('option');
            o.value = s.idSensore;
            o.textContent = `${s.tipo_sensor} – ${s.unidad_medida || ''} (ID:${s.idSensore})`;
            select.appendChild(o);
        });
    } catch (e) { console.error("Error cargando sensores parámetro:", e); }
}

function aplicarFiltros() {
    cargarHistorialAlertas();
}

async function cargarHistorialAlertas() {
    const contenedor = document.getElementById('tabla-historial-alertas');
    contenedor.innerHTML = '<p style="color:#888;">Cargando historial...</p>';

    const prioridad = document.getElementById('filtro-prioridad')?.value || '';
    const estado    = document.getElementById('filtro-estado')?.value    || '';
    const idSensor  = document.getElementById('filtro-sensor-historial')?.value || '';

    let qs = new URLSearchParams();
    if (prioridad) qs.append('prioridad', prioridad);
    if (estado)    qs.append('estado', estado);
    if (idSensor)  qs.append('idSensor', idSensor);

    try {
        const alertas = await (await fetch('/api/alertas/historial?' + qs.toString())).json();

        if (alertas.length === 0) {
            contenedor.innerHTML = '<p style="color:#888; padding:16px;">No hay alertas con esos criterios.</p>';
            return;
        }

        let html = `<table>
            <thead><tr>
                <th>ID</th><th>Sensor</th><th>Parámetro</th>
                <th>Valor</th><th>Umbral</th><th>Prioridad</th>
                <th>Estado</th><th>Fecha</th><th>Acciones</th>
            </tr></thead><tbody>`;

        alertas.forEach(a => {
            html += `<tr class="prioridad-${a.prioridad}">
                <td>${a.idHistorial}</td>
                <td>${a.tipo_sensor} <small style="color:#888;">${a.unidad_medida || ''}</small></td>
                <td>${a.nombre_parametro}</td>
                <td><strong>${a.valor_detectado}</strong></td>
                <td>${labelCondicion(a.condicion)} ${a.valor_umbral}</td>
                <td>${badgePrioridad(a.prioridad)}</td>
                <td>${badgeEstado(a.estado)}</td>
                <td style="white-space:nowrap;">${a.fecha_hora}</td>
                <td style="white-space:nowrap;">
                    <button class="btn-sm" onclick="verDetalleAlerta(${a.idHistorial})">👁 Ver</button>
                    ${a.estado === 'nueva'
                        ? `<button class="btn-naranja btn-sm" onclick="cambiarEstadoAlerta(${a.idHistorial},'vista')">✓ Vista</button>`
                        : ''}
                    ${a.estado !== 'resuelta'
                        ? `<button class="btn-verde btn-sm" onclick="cambiarEstadoAlerta(${a.idHistorial},'resuelta')">✔ Resolver</button>`
                        : ''}
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar el historial.</p>';
        console.error(e);
    }
}

let _alertaDetalleId = null;

async function verDetalleAlerta(idHistorial) {
    _alertaDetalleId = idHistorial;
    try {
        const alertas = await (await fetch('/api/alertas/historial?limite=500')).json();
        const a = alertas.find(x => x.idHistorial === idHistorial);
        if (!a) return toast("No se encontró la alerta", "error");

        document.getElementById('contenido-detalle-alerta').innerHTML = `
            <p><strong>Sensor:</strong> ${a.tipo_sensor} (${a.unidad_medida || '—'})</p>
            <p><strong>Parámetro:</strong> ${a.nombre_parametro}</p>
            <p><strong>Condición:</strong> valor ${labelCondicion(a.condicion)} ${a.valor_umbral} ${a.unidad_medida || ''}</p>
            <p><strong>Valor detectado:</strong> ${a.valor_detectado} ${a.unidad_medida || ''}</p>
            <p><strong>Prioridad:</strong> ${badgePrioridad(a.prioridad)}</p>
            <p><strong>Estado:</strong> ${badgeEstado(a.estado)}</p>
            <p><strong>Fecha / Hora:</strong> ${a.fecha_hora}</p>
            ${a.fecha_resolucion ? `<p><strong>Resuelta el:</strong> ${a.fecha_resolucion}</p>` : ''}
            ${a.mensaje ? `<p><strong>Mensaje:</strong> ${a.mensaje}</p>` : ''}
        `;

        const btnVista    = document.getElementById('btn-marcar-vista');
        const btnResuelta = document.getElementById('btn-marcar-resuelta');

        btnVista.style.display    = a.estado === 'nueva'    ? 'inline-block' : 'none';
        btnResuelta.style.display = a.estado !== 'resuelta' ? 'inline-block' : 'none';

        btnVista.onclick    = () => cambiarEstadoAlerta(idHistorial, 'vista',    true);
        btnResuelta.onclick = () => cambiarEstadoAlerta(idHistorial, 'resuelta', true);

        document.getElementById('modal-detalle-alerta').classList.add('activo');
    } catch (e) { console.error("Error detalle alerta:", e); }
}

async function cambiarEstadoAlerta(idHistorial, nuevoEstado, desdeModal = false) {
    try {
        const res = await fetch(`/api/alertas/historial/estado/${idHistorial}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        if (res.ok) {
            if (desdeModal) cerrarModal('modal-detalle-alerta');
            await cargarHistorialAlertas();
            await actualizarBadgeNav();
        }
    } catch (e) { toast("Error al actualizar el estado", "error"); }
}

async function cargarParametrosAlerta() {
    const contenedor = document.getElementById('tabla-parametros-alerta');
    contenedor.innerHTML = '<p style="color:#888;">Cargando...</p>';
    try {
        const params = await (await fetch('/api/alertas/parametros/lista')).json();

        if (params.length === 0) {
            contenedor.innerHTML = `<div class="card" style="text-align:center; padding:30px; color:#888;">
                No hay parámetros configurados aún.<br>
                <button class="btn-verde" style="margin-top:12px;" onclick="abrirModal('modal-parametro')">+ Crear el primero</button>
            </div>`;
            return;
        }

        let html = `<table>
            <thead><tr>
                <th>ID</th><th>Sensor</th><th>Nombre</th><th>Condición</th>
                <th>Umbral</th><th>Prioridad</th><th>Estado</th><th>Acciones</th>
            </tr></thead><tbody>`;

        params.forEach(p => {
            html += `<tr>
                <td>${p.idParametro}</td>
                <td>${p.tipo_sensor} <small style="color:#888;">${p.unidad_medida || ''}</small></td>
                <td>${p.nombre}</td>
                <td>${labelCondicion(p.condicion)}</td>
                <td><strong>${p.valor_umbral}</strong></td>
                <td>${badgePrioridad(p.prioridad)}</td>
                <td>
                    <span class="badge ${p.activo ? 'badge-verde' : 'badge-gris'}">
                        ${p.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                </td>
                <td style="white-space:nowrap;">
                    <button class="btn-sm" onclick="editarParametro(${p.idParametro})">✏️ Editar</button>
                    <button class="btn-rojo btn-sm" onclick="eliminarParametro(${p.idParametro})">🗑 Eliminar</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar parámetros.</p>';
        console.error(e);
    }
}

async function guardarParametro() {
    const idParam   = document.getElementById('editParamId').value;
    const idSensor  = document.getElementById('selectSensorParametro').value;
    const nombre    = document.getElementById('paramNombre').value.trim();
    const condicion = document.getElementById('paramCondicion').value;
    const umbral    = document.getElementById('paramUmbral').value;
    const prioridad = document.getElementById('paramPrioridad').value;
    const activo    = document.getElementById('paramActivo').value;

    if (!idSensor || !nombre || umbral === '') {
        return toast("Completa todos los campos obligatorios.", "info");
    }

    const data = { idSensor, nombre, condicion, valor_umbral: umbral, prioridad, activo };

    try {
        let res;
        if (idParam) {
            res = await fetch(`/api/alertas/parametros/editar/${idParam}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            res = await fetch('/api/alertas/parametros/agregar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        if (res.ok) {
            toast(idParam ? "Parámetro actualizado." : "Parámetro creado.", "info");
            cerrarModal('modal-parametro');
            limpiarFormParametro();
            cargarParametrosAlerta();
        } else {
            const err = await res.json();
            toast("Error: " + (err.error || "Intenta de nuevo"), "error");
        }
    } catch (e) { toast("Error de red: " + e.message, "info"); }
}

async function editarParametro(idParam) {
    await abrirModal('modal-parametro');
    try {
        const params = await (await fetch('/api/alertas/parametros/lista')).json();
        const p = params.find(x => x.idParametro === idParam);
        if (!p) return;

        document.getElementById('titulo-modal-parametro').textContent = 'Editar Parámetro';
        document.getElementById('editParamId').value      = p.idParametro;
        document.getElementById('paramNombre').value      = p.nombre;
        document.getElementById('paramCondicion').value   = p.condicion;
        document.getElementById('paramUmbral').value      = p.valor_umbral;
        document.getElementById('paramPrioridad').value   = p.prioridad;
        document.getElementById('paramActivo').value      = p.activo ? '1' : '0';

        const sel = document.getElementById('selectSensorParametro');
        sel.value = p.idSensor;
    } catch (e) { console.error("Error al cargar parámetro:", e); }
}

async function eliminarParametro(idParam) {
    if (!await confirmar("¿Eliminar este parámetro? Se borrará también su historial de alertas.")) return;
    try {
        const res = await fetch(`/api/alertas/parametros/eliminar/${idParam}`, { method: 'DELETE' });
        if (res.ok) { toast("Parámetro eliminado", "success"); cargarParametrosAlerta(); }
        else toast("Error al eliminar", "error");
    } catch (e) { toast("Error de conexión con el servidor", "error"); }
}

function limpiarFormParametro() {
    document.getElementById('titulo-modal-parametro').textContent = 'Nuevo Parámetro de Alerta';
    document.getElementById('editParamId').value    = '';
    document.getElementById('paramNombre').value    = '';
    document.getElementById('paramUmbral').value    = '';
    document.getElementById('paramCondicion').value = 'mayor_que';
    document.getElementById('paramPrioridad').value = 'media';
    document.getElementById('paramActivo').value    = '1';
}


// ============================================================
// --- 15. CULTIVOS EN SECCIÓN (sin modal) ---
// ============================================================

function cambiarTabCultivos(idTab, btn) {
    const seccion = document.getElementById('seccion-cultivos');
    seccion.querySelectorAll('.tab-contenido').forEach(t => t.classList.remove('activo'));
    seccion.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btn.classList.add('activo');
}

async function cargarSeccionCultivos() {
    await Promise.all([cargarTablaCultivosSeccion(), cargarTablaCosechasSeccion()]);
}

async function cargarTablaCultivosSeccion() {
    const contenedor = document.getElementById('tabla-cultivos-seccion');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="color:#888;">Cargando...</p>';
    try {
        const cultivos = await (await fetch('/api/cultivos/lista')).json();
        if (!Array.isArray(cultivos) || cultivos.length === 0) {
            contenedor.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:#888;">
                No hay cultivos registrados aún.<br>
                <button style="margin-top:12px;" onclick="abrirModal('modal-siembra')">🌱 Registrar primera siembra</button>
            </div>`;
            return;
        }
        let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:13px;color:#666;">${cultivos.length} cultivo(s) registrado(s)</span>
            <button class="btn-verde btn-sm" onclick="cargarTablaCultivosSeccion()">↺ Actualizar</button>
        </div>
        <table><thead><tr>
            <th>#</th><th>Nombre</th><th>Tipo</th>
            <th>Fecha Siembra</th><th>Cantidad</th><th>Tamaño</th>
            <th>Acciones</th>
        </tr></thead><tbody>`;
        cultivos.forEach(c => {
            html += `<tr id="fila-cultivo-sec-${c.idCultivo}">
                <td>${c.idCultivo}</td>
                <td><strong>${c.nombreCultivo}</strong></td>
                <td>${c.tipo_cultivo || '—'}</td>
                <td>${c.fecha_siembra || '—'}</td>
                <td>${c.cantidad} plantas</td>
                <td>${c.tamano_planta ? c.tamano_planta + ' cm' : '—'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn-naranja btn-sm" onclick='abrirEditarCultivo(${JSON.stringify(c)})'>✏️ Editar</button>
                    <button class="btn-rojo btn-sm" onclick="eliminarCultivoSeccion(${c.idCultivo})">🗑 Eliminar</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar cultivos.</p>';
    }
}

async function eliminarCultivoSeccion(id) {
    if (!await confirmar('¿Eliminar este cultivo? También se eliminarán sus cosechas asociadas.')) return;
    try {
        const res  = await fetch(`/api/cultivos/eliminar/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            await cargarTablaCultivosSeccion();
            await cargarTablaCosechasSeccion();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}

// Override de guardarEdicionCultivo para refrescar tabla de sección también
const _guardarEdicionCultivoOrig = guardarEdicionCultivo;
async function guardarEdicionCultivo() {
    const id = document.getElementById('editCultivoId').value;
    const body = {
        nombre:  document.getElementById('editNombreCultivo').value.trim(),
        fecha:   document.getElementById('editFechaSiembra').value,
        cantidad:document.getElementById('editCantidadPlantas').value,
        tamano:  document.getElementById('editTamanoPlantas').value,
        idTipo:  document.getElementById('editTipoCultivo').value
    };
    if (!body.nombre || !body.fecha || !body.cantidad) {
        toast("Completa todos los campos obligatorios", "warning"); return;
    }
    try {
        const res = await fetch(`/api/cultivos/editar/${id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status === 'success') {
            cerrarModal('modal-editar-cultivo');
            await cargarTablaCultivosSeccion();
            await cargarTablaCultivos();
            await cargarCultivosActivos();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}

async function cargarTablaCosechasSeccion() {
    const contenedor = document.getElementById('tabla-cosechas-seccion');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="color:#888;">Cargando...</p>';
    try {
        const cosechas = await (await fetch('/api/cosechas/lista')).json();
        if (!Array.isArray(cosechas) || cosechas.length === 0) {
            contenedor.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:#888;">
                No hay cosechas registradas aún.<br>
                <button style="margin-top:12px;" onclick="abrirModal('modal-cosecha')">🌾 Registrar cosecha</button>
            </div>`;
            return;
        }
        let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:13px;color:#666;">${cosechas.length} cosecha(s) registrada(s)</span>
            <button class="btn-verde btn-sm" onclick="cargarTablaCosechasSeccion()">↺ Actualizar</button>
        </div>
        <table><thead><tr>
            <th>#</th><th>Cultivo</th><th>Fecha</th>
            <th>Cantidad</th><th>Calidad</th><th>Observaciones</th><th>Acciones</th>
        </tr></thead><tbody>`;
        cosechas.forEach(cs => {
            html += `<tr>
                <td>${cs.idCosecha}</td>
                <td><strong>${cs.nombreCultivo || '—'}</strong></td>
                <td>${cs.fecha || '—'}</td>
                <td>${cs.cantidad}</td>
                <td><span class="badge badge-verde">${cs.calidad || '—'}</span></td>
                <td style="max-width:180px;white-space:pre-wrap;">${cs.observaciones || '—'}</td>
                <td style="white-space:nowrap;">
                    <button class="btn-naranja btn-sm" onclick='abrirEditarCosecha(${JSON.stringify(cs)})'>✏️ Editar</button>
                    <button class="btn-rojo btn-sm" onclick="eliminarCosechaSeccion(${cs.idCosecha})">🗑 Eliminar</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar cosechas.</p>';
    }
}

async function eliminarCosechaSeccion(id) {
    if (!await confirmar('¿Seguro que quieres eliminar esta cosecha?')) return;
    try {
        const res  = await fetch(`/api/cosechas/eliminar/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            await cargarTablaCosechasSeccion();
            await cargarTablaCosechas();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}

// Override de guardarEdicionCosecha para refrescar tabla de sección
async function guardarEdicionCosecha() {
    const id = document.getElementById('editCosechaId').value;
    const body = {
        fecha:         document.getElementById('editFechaCosecha').value,
        cantidad:      document.getElementById('editCantidadCosecha').value,
        calidad:       document.getElementById('editCalidadCosecha').value.trim(),
        observaciones: document.getElementById('editObservacionesCosecha').value.trim()
    };
    if (!body.fecha || !body.cantidad) { toast("Completa todos los campos obligatorios", "warning"); return; }
    try {
        const res  = await fetch(`/api/cosechas/editar/${id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status === 'success') {
            cerrarModal('modal-editar-cosecha');
            await cargarTablaCosechasSeccion();
            await cargarTablaCosechas();
        } else { toast('Error: ' + (data.error || 'desconocido', "info")); }
    } catch(e) { toast('Error de red: ' + e, "info"); }
}


// ============================================================
// --- 16. ANALÍTICA — REPORTES DE CULTIVOS Y COSECHAS ---
// ============================================================

function cambiarTabAnalitica(idTab, btn) {
    const seccion = document.getElementById('seccion-analitica');
    seccion.querySelectorAll('.tab-contenido').forEach(t => t.classList.remove('activo'));
    seccion.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btn.classList.add('activo');
}

// Gráficas reutilizables de analítica
let _grafCultivosTipo = null;
let _grafCultivosMes  = null;
let _grafCosechasCult = null;
let _grafCosechasMes  = null;

async function cargarReporteCultivos() {
    // Cargar tipos en el filtro
    try {
        const tipos = await (await fetch('/api/tipo_cultivo/lista')).json();
        const sel = document.getElementById('filtro-an-tipo-cultivo');
        if (sel && sel.options.length === 1) {
            tipos.forEach(t => {
                const o = document.createElement('option');
                o.value = t.idTipo_Cultivo;
                o.textContent = t.nombre_planta;
                sel.appendChild(o);
            });
        }
    } catch(e) {}

    let cultivos;
    try {
        cultivos = await (await fetch('/api/cultivos/lista')).json();
    } catch(e) {
        document.getElementById('tabla-reporte-cultivos').innerHTML = '<p style="color:red;">Error al cargar datos.</p>';
        return;
    }

    // Aplicar filtros
    const tipoFiltro  = document.getElementById('filtro-an-tipo-cultivo')?.value || '';
    const desdeStr    = document.getElementById('filtro-an-fecha-desde')?.value || '';
    const hastaStr    = document.getElementById('filtro-an-fecha-hasta')?.value || '';

    let filtrados = cultivos;
    if (tipoFiltro) filtrados = filtrados.filter(c => String(c.idTipo_Cultivo) === tipoFiltro);
    if (desdeStr)   filtrados = filtrados.filter(c => c.fecha_siembra >= desdeStr);
    if (hastaStr)   filtrados = filtrados.filter(c => c.fecha_siembra <= hastaStr);

    // KPIs
    const totalPlantas = filtrados.reduce((s, c) => s + (parseInt(c.cantidad) || 0), 0);
    const tipos = [...new Set(filtrados.map(c => c.tipo_cultivo).filter(Boolean))];
    document.getElementById('kpi-reporte-cultivos').innerHTML = `
        <div class="kpi-card" style="cursor:default;">
            <div class="kpi-icono kpi-icono-naranja">🌱</div>
            <div><div class="kpi-valor">${filtrados.length}</div><div class="kpi-label">Cultivos</div></div>
        </div>
        <div class="kpi-card" style="cursor:default;">
            <div class="kpi-icono kpi-icono-verde">🪴</div>
            <div><div class="kpi-valor">${totalPlantas.toLocaleString()}</div><div class="kpi-label">Total plantas</div></div>
        </div>
        <div class="kpi-card" style="cursor:default;">
            <div class="kpi-icono kpi-icono-azul">🏷️</div>
            <div><div class="kpi-valor">${tipos.length}</div><div class="kpi-label">Tipos distintos</div></div>
        </div>`;

    // Gráfica: plantas por tipo
    const porTipo = {};
    filtrados.forEach(c => {
        const t = c.tipo_cultivo || 'Sin tipo';
        porTipo[t] = (porTipo[t] || 0) + (parseInt(c.cantidad) || 0);
    });
    const coloresTipo = ['#27ae60','#3498db','#e67e22','#9b59b6','#e74c3c','#1abc9c'];
    const ctx1 = document.getElementById('graficaCultivosTipo')?.getContext('2d');
    if (ctx1) {
        if (_grafCultivosTipo) _grafCultivosTipo.destroy();
        _grafCultivosTipo = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: Object.keys(porTipo),
                datasets: [{ data: Object.values(porTipo), backgroundColor: coloresTipo, borderWidth: 2 }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Gráfica: siembras por mes
    const porMes = {};
    filtrados.forEach(c => {
        if (!c.fecha_siembra) return;
        const mes = c.fecha_siembra.substring(0, 7); // YYYY-MM
        porMes[mes] = (porMes[mes] || 0) + 1;
    });
    const mesesOrden = Object.keys(porMes).sort();
    const ctx2 = document.getElementById('graficaCultivosMes')?.getContext('2d');
    if (ctx2) {
        if (_grafCultivosMes) _grafCultivosMes.destroy();
        _grafCultivosMes = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: mesesOrden,
                datasets: [{ label: 'Siembras', data: mesesOrden.map(m => porMes[m]), backgroundColor: '#2c3e50' }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }

    // Tabla
    const tabla = document.getElementById('tabla-reporte-cultivos');
    if (filtrados.length === 0) {
        tabla.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No hay cultivos con los filtros aplicados.</p>';
        return;
    }
    let html = `<table><thead><tr>
        <th>#</th><th>Nombre</th><th>Tipo</th><th>Fecha Siembra</th><th>Cantidad</th><th>Tamaño</th>
    </tr></thead><tbody>`;
    filtrados.forEach(c => {
        html += `<tr>
            <td>${c.idCultivo}</td>
            <td><strong>${c.nombreCultivo}</strong></td>
            <td>${c.tipo_cultivo || '—'}</td>
            <td>${c.fecha_siembra || '—'}</td>
            <td>${c.cantidad} plantas</td>
            <td>${c.tamano_planta ? c.tamano_planta + ' cm' : '—'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    tabla.innerHTML = html;
}

async function cargarReporteCosechas() {
    // Cargar cultivos en el filtro
    try {
        const cultivos = await (await fetch('/api/cultivos/lista')).json();
        const sel = document.getElementById('filtro-an-cultivo-cosecha');
        if (sel && sel.options.length === 1) {
            cultivos.forEach(c => {
                const o = document.createElement('option');
                o.value = c.idCultivo;
                o.textContent = c.nombreCultivo;
                sel.appendChild(o);
            });
        }
    } catch(e) {}

    let cosechas;
    try {
        cosechas = await (await fetch('/api/cosechas/lista')).json();
    } catch(e) {
        document.getElementById('tabla-reporte-cosechas').innerHTML = '<p style="color:red;">Error al cargar datos.</p>';
        return;
    }

    // Aplicar filtros
    const cultFiltro = document.getElementById('filtro-an-cultivo-cosecha')?.value || '';
    const desdeStr   = document.getElementById('filtro-an-cosecha-desde')?.value || '';
    const hastaStr   = document.getElementById('filtro-an-cosecha-hasta')?.value || '';

    let filtradas = cosechas;
    if (cultFiltro) filtradas = filtradas.filter(c => String(c.idCultivo) === cultFiltro);
    if (desdeStr)   filtradas = filtradas.filter(c => c.fecha >= desdeStr);
    if (hastaStr)   filtradas = filtradas.filter(c => c.fecha <= hastaStr);

    // KPIs
    const totalCant = filtradas.reduce((s, c) => s + (parseFloat(c.cantidad) || 0), 0);
    const cultivos  = [...new Set(filtradas.map(c => c.nombreCultivo).filter(Boolean))];
    document.getElementById('kpi-reporte-cosechas').innerHTML = `
        <div class="kpi-card" style="cursor:default;">
            <div class="kpi-icono kpi-icono-verde">🌾</div>
            <div><div class="kpi-valor">${filtradas.length}</div><div class="kpi-label">Cosechas</div></div>
        </div>
        <div class="kpi-card" style="cursor:default;">
            <div class="kpi-icono kpi-icono-naranja">📦</div>
            <div><div class="kpi-valor">${totalCant.toLocaleString()}</div><div class="kpi-label">Total cosechado</div></div>
        </div>
        <div class="kpi-card" style="cursor:default;">
            <div class="kpi-icono kpi-icono-azul">🌱</div>
            <div><div class="kpi-valor">${cultivos.length}</div><div class="kpi-label">Cultivos involucrados</div></div>
        </div>`;

    // Gráfica: cantidad por cultivo
    const porCultivo = {};
    filtradas.forEach(c => {
        const k = c.nombreCultivo || 'Sin nombre';
        porCultivo[k] = (porCultivo[k] || 0) + (parseFloat(c.cantidad) || 0);
    });
    const colores = ['#27ae60','#3498db','#e67e22','#9b59b6','#e74c3c','#1abc9c'];
    const ctx3 = document.getElementById('graficaCosechasCultivo')?.getContext('2d');
    if (ctx3) {
        if (_grafCosechasCult) _grafCosechasCult.destroy();
        _grafCosechasCult = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: Object.keys(porCultivo),
                datasets: [{ label: 'Cosechado', data: Object.values(porCultivo), backgroundColor: colores }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    // Gráfica: cosechas por mes
    const porMes = {};
    filtradas.forEach(c => {
        if (!c.fecha) return;
        const mes = c.fecha.substring(0, 7);
        porMes[mes] = (porMes[mes] || 0) + (parseFloat(c.cantidad) || 0);
    });
    const meses = Object.keys(porMes).sort();
    const ctx4 = document.getElementById('graficaCosechasMes')?.getContext('2d');
    if (ctx4) {
        if (_grafCosechasMes) _grafCosechasMes.destroy();
        _grafCosechasMes = new Chart(ctx4, {
            type: 'line',
            data: {
                labels: meses,
                datasets: [{ label: 'Cosecha total', data: meses.map(m => porMes[m]),
                    borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)',
                    borderWidth: 2, fill: true, tension: 0.4 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    // Tabla
    const tabla = document.getElementById('tabla-reporte-cosechas');
    if (filtradas.length === 0) {
        tabla.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No hay cosechas con los filtros aplicados.</p>';
        return;
    }
    let html = `<table><thead><tr>
        <th>#</th><th>Cultivo</th><th>Fecha</th><th>Cantidad</th><th>Calidad</th><th>Observaciones</th>
    </tr></thead><tbody>`;
    filtradas.forEach(cs => {
        html += `<tr>
            <td>${cs.idCosecha}</td>
            <td><strong>${cs.nombreCultivo || '—'}</strong></td>
            <td>${cs.fecha || '—'}</td>
            <td>${cs.cantidad}</td>
            <td><span class="badge badge-verde">${cs.calidad || '—'}</span></td>
            <td style="max-width:200px;">${cs.observaciones || '—'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    tabla.innerHTML = html;
}


// ============================================================
// --- 14. Inicialización Global ---
// ============================================================
// ============================================================
// DASHBOARD INICIO — Panel General
// ============================================================

async function cargarDashboardInicio() {
    // Fecha actual
    const fechaEl = document.getElementById('inicio-fecha');
    if (fechaEl) {
        const ahora = new Date();
        fechaEl.textContent = ahora.toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Nombre de usuario y foto en bienvenida
    const nombreEl  = document.getElementById('inicio-nombre');
    const avatarEl  = document.getElementById('inicio-avatar');
    try {
        const res  = await fetch('/api/usuario/info');
        const user = await res.json();
        if (nombreEl) nombreEl.textContent = user.nombre?.split(' ')[0] || '—';
        if (avatarEl) {
            if (user.foto_perfil) {
                avatarEl.innerHTML = '<img src="' + user.foto_perfil + '" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">';
                avatarEl.style.background = 'transparent';
                avatarEl.style.padding = '0';
            } else {
                avatarEl.textContent = (user.nombre || 'U')[0].toUpperCase();
                avatarEl.style.background = '';
            }
        }
    } catch (e) {}

    // KPIs + paneles en paralelo
    await Promise.allSettled([
        _kpiDispSensores(),
        _kpiCultivos(),
        _kpiAlertas(),
        _panelLecturas(),
        _panelAlertasRecientes(),
        _panelCultivos(),
        _panelBomba()
    ]);
}

async function _kpiDispSensores() {
    try {
        const [rd, rs] = await Promise.all([
            fetch('/api/dispositivos/lista'),
            fetch('/api/sensores/lista')
        ]);
        const disp = await rd.json();
        const sens = await rs.json();
        const dEl = document.getElementById('kpi-dispositivos');
        const sEl = document.getElementById('kpi-sensores');
        if (dEl) dEl.textContent = Array.isArray(disp) ? disp.length : '—';
        if (sEl) sEl.textContent = Array.isArray(sens) ? sens.length : '—';
    } catch (e) {}
}

async function _kpiCultivos() {
    try {
        const res = await fetch('/api/cultivos/lista');
        const data = await res.json();
        const el = document.getElementById('kpi-cultivos');
        if (el) el.textContent = Array.isArray(data) ? data.length : '—';
    } catch (e) {}
}

async function _kpiAlertas() {
    try {
        const res  = await fetch('/api/alertas/conteo');
        const data = await res.json();
        const el   = document.getElementById('kpi-alertas');
        if (el) el.textContent = data.nuevas ?? '—';
    } catch (e) {}
}

async function _panelLecturas() {
    const cont = document.getElementById('inicio-lecturas');
    if (!cont) return;
    try {
        const res     = await fetch('/api/sensores/lista');
        const sensores = await res.json();
        if (!Array.isArray(sensores) || sensores.length === 0) {
            cont.innerHTML = '<div class="inicio-vacio">No hay sensores registrados.</div>'; return;
        }
        // Pedir última lectura de cada sensor (máx 5)
        const slice = sensores.slice(0, 5);
        const lecturas = await Promise.allSettled(
            slice.map(s => fetch(`/api/sensores/datos-actuales/${s.idSensore}`).then(r => r.json()))
        );
        cont.innerHTML = slice.map((s, i) => {
            const lec = lecturas[i].status === 'fulfilled' ? lecturas[i].value : null;
            const valor = lec && !lec.error ? lec.valor : null;
            const unidad = lec && !lec.error ? (lec.unidad || '') : '';
            const activo = valor !== null;
            return `
            <div class="sensor-fila">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="sensor-dot ${activo ? 'sensor-dot-on' : 'sensor-dot-off'}"></div>
                    <div class="sensor-nombre">${s.tipo_sensor}</div>
                </div>
                <div>
                    ${activo
                        ? `<span class="sensor-valor-big">${valor}</span><span class="sensor-unidad">${unidad}</span>`
                        : `<span style="color:#ccc;font-size:13px;">Sin datos</span>`
                    }
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        cont.innerHTML = '<div class="inicio-vacio" style="color:#e74c3c;">Error al cargar.</div>';
    }
}

async function _panelAlertasRecientes() {
    const cont = document.getElementById('inicio-alertas');
    if (!cont) return;
    try {
        const res    = await fetch('/api/alertas/historial?limite=5');
        const alertas = await res.json();
        if (!Array.isArray(alertas) || alertas.length === 0) {
            cont.innerHTML = '<div class="inicio-vacio">✅ Sin alertas recientes.</div>'; return;
        }
        const colores = { critica:'badge-rojo', alta:'badge-naranja', media:'badge-amarillo', baja:'badge-verde' };
        cont.innerHTML = alertas.map(a => `
            <div class="alerta-fila">
                <span class="badge ${colores[a.prioridad] || 'badge-gris'}" style="flex-shrink:0">${a.prioridad}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;color:#2c3e50;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.tipo_sensor || 'Sensor'}</div>
                    <div style="color:#999;font-size:11px;">${a.fecha_hora || ''}</div>
                </div>
                <span class="badge ${a.estado === 'nueva' ? 'badge-rojo' : 'badge-gris'}" style="flex-shrink:0;font-size:11px;">${a.estado}</span>
            </div>`).join('');
    } catch (e) {
        cont.innerHTML = '<div class="inicio-vacio" style="color:#e74c3c;">Error al cargar.</div>';
    }
}

async function _panelCultivos() {
    const cont = document.getElementById('inicio-cultivos');
    if (!cont) return;
    try {
        const res     = await fetch('/api/cultivos/lista');
        const cultivos = await res.json();
        if (!Array.isArray(cultivos) || cultivos.length === 0) {
            cont.innerHTML = `<div class="inicio-vacio">No hay cultivos registrados.<br>
                <button style="margin-top:10px;" onclick="mostrarSeccion('seccion-cultivos')">+ Nueva siembra</button>
            </div>`; return;
        }
        cont.innerHTML = cultivos.slice(0, 5).map(c => `
            <div class="cultivo-fila">
                <div>
                    <div style="font-weight:600;color:#2c3e50;">${c.nombreCultivo}</div>
                    <div style="color:#aaa;font-size:11px;">${c.tipo_cultivo || 'Sin tipo'} · Sembrado ${c.fecha_siembra || '—'}</div>
                </div>
                <span class="badge badge-verde">${c.cantidad} plantas</span>
            </div>`).join('') +
            (cultivos.length > 5 ? `<div class="inicio-vacio" style="padding:10px;">+${cultivos.length - 5} más</div>` : '');
    } catch (e) {
        cont.innerHTML = '<div class="inicio-vacio" style="color:#e74c3c;">Error al cargar.</div>';
    }
}

async function _panelBomba() {
    const cont = document.getElementById('inicio-bomba');
    if (!cont) return;
    try {
        const did = dispositivoActualId || '';
        const res  = await fetch('/api/relevador/estado' + (did ? '?device_id=' + did : ''));
        const data = await res.json();
        const modo     = data.modo || 'automatico';
        const manual   = data.estado_manual || 'apagado';
        const encendida = modo === 'manual' && manual === 'encendido';
        cont.innerHTML = `
            <div class="bomba-mini">
                <div class="bomba-dot ${encendida ? 'bomba-dot-on' : 'bomba-dot-off'}"></div>
                <div>
                    <div style="font-weight:700;font-size:15px;color:#2c3e50;">
                        ${encendida ? '⚡ Bomba encendida' : '⏹ Bomba apagada'}
                    </div>
                    <div style="font-size:12px;color:#aaa;margin-top:2px;">
                        Modo: ${modo === 'automatico' ? '🤖 Automático' : '🖐 Manual'} ·
                        ON ${data.tiempo_on || 30}s / OFF ${data.tiempo_off || 60}s
                    </div>
                </div>
            </div>
            <div style="padding:0 16px 14px;display:flex;gap:8px;">
                <button class="btn-verde btn-sm" onclick="controlManualBomba('encendido'); setTimeout(_panelBomba, 800)">⚡ Encender</button>
                <button class="btn-rojo btn-sm"  onclick="controlManualBomba('apagado');  setTimeout(_panelBomba, 800)">⏹ Apagar</button>
            </div>`;
    } catch (e) {
        cont.innerHTML = '<div class="inicio-vacio" style="color:#e74c3c;">Error al cargar estado.</div>';
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await cargarDispositivosGlobal();   // ← carga dispositivos y setea dispositivoActualId
    cargarDashboardInicio();
    await actualizarListaDispositivos();
    await cargarSensoresEnLogica();
    await cargarSensoresEnAnalitica();
    cargarInfoUsuario();
    actualizarBadgeNav();

    // Actualiza badge de alertas cada 60 segundos
    setInterval(actualizarBadgeNav, 60000);
});

// ============================================================
// SECCION WIFI — Configurar red del Arduino desde el dashboard
// ============================================================

async function cargarRedActual() {
    if (!dispositivoActualId) {
        await cargarDispositivosGlobal();
    }
    try {
        const r = await fetch('/api/wifi/estado?device_id=' + dispositivoActualId);
        const d = await r.json();
        const icon  = document.getElementById('wifi-estado-icon');
        const red   = document.getElementById('wifi-red-actual');
        const texto = document.getElementById('wifi-estado-texto');

        if (d.ssid) {
            icon.textContent  = '✅';
            red.textContent   = 'Red: ' + d.ssid;
            texto.textContent = 'Última configuración enviada: ' + (d.fecha || 'desconocida');
        } else {
            icon.textContent  = '❓';
            red.textContent   = 'Sin configuración enviada aún';
            texto.textContent = 'Usa el formulario para enviar una red al Arduino';
        }

        cargarHistorialWifi();
    } catch(e) {
        document.getElementById('wifi-red-actual').textContent = 'Error al consultar estado';
    }
}

async function cargarHistorialWifi() {
    try {
        const r = await fetch('/api/wifi/historial?device_id=' + dispositivoActualId);
        const d = await r.json();
        const cont = document.getElementById('wifi-historial');

        if (!d.historial || d.historial.length === 0) {
            cont.innerHTML = '<p>Aún no has enviado ninguna red.</p>';
            return;
        }

        cont.innerHTML = d.historial.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:10px 0; border-bottom:1px solid #eee;">
                <div>
                    <div style="font-weight:600;">📶 ${item.ssid}</div>
                    <div style="font-size:12px; color:#999;">${item.fecha}</div>
                </div>
                <button onclick="usarRedGuardada('${item.ssid}')"
                    style="padding:5px 12px; border-radius:6px; border:1px solid #27ae60;
                           color:#27ae60; background:white; cursor:pointer; font-size:13px;">
                    Usar esta
                </button>
            </div>
        `).join('');
    } catch(e) {
        document.getElementById('wifi-historial').textContent = 'Error al cargar historial';
    }
}

function usarRedGuardada(ssid) {
    document.getElementById('wifi-ssid').value = ssid;
    document.getElementById('wifi-pass').value = '';
    document.getElementById('wifi-pass').focus();
    toast('Red seleccionada. Ingresa la contraseña y envía.', 'info');
}

function toggleVerPass() {
    const input = document.getElementById('wifi-pass');
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function enviarRedWifi() {
    if (!dispositivoActualId) {
        toast('Selecciona un dispositivo primero', 'warning');
        return;
    }

    const ssid = document.getElementById('wifi-ssid').value.trim();
    const pass = document.getElementById('wifi-pass').value;

    if (!ssid) { toast('Ingresa el nombre de la red (SSID)', 'warning'); return; }
    if (!pass)  { toast('Ingresa la contraseña de la red', 'warning'); return; }

    const btn = document.querySelector('#seccion-wifi .btn-verde');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const r = await fetch('/api/wifi/configurar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssid, password: pass, device_id: dispositivoActualId })
        });
        const d = await r.json();

        if (r.ok && d.status === 'ok') {
            toast('¡Red enviada al Arduino correctamente!', 'success');
            document.getElementById('wifi-ssid').value = '';
            document.getElementById('wifi-pass').value = '';
            cargarRedActual();
        } else {
            toast('Error: ' + (d.mensaje || 'No se pudo enviar'), 'error');
        }
    } catch(e) {
        toast('Error de conexión al enviar la red', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📡 Enviar al Arduino';
    }
}

