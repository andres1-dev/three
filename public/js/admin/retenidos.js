/* ==========================================================================
   retenidos.js — Módulo OPs Retenidas · v2
   Tabla dedicada `retenidos` + Realtime + Edge Function
   ========================================================================== */

'use strict';

// ── Estado del módulo ──────────────────────────────────────────────────────
const RetModule = {
    data: [],          // Todos los registros cargados
    filtered: [],      // Registros según la pestaña activa
    tab: 'retenidos',  // 'retenidos' | 'liberados' | 'todos'
    sortCol: null,
    sortDir: 'asc',
    timerInterval: null,
    refreshInterval: null,
    realtimeChannel: null,
    loading: false,
    dateRange: { desde: null, hasta: null },  // Rango de fechas activo
};

// ── Colores por motivo ─────────────────────────────────────────────────────
const MOTIVO_COLORS = {
    'PROMOCIONES': { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1', label: 'PROMOCIONES', icon: 'fa-tag' },
    'CORREO':      { bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6', label: 'CORREO',      icon: 'fa-envelope' },
    'LAVADO':      { bg: 'rgba(20,184,166,0.12)',   color: '#14b8a6', label: 'LAVADO',      icon: 'fa-tint' },
    'ARREGLO':     { bg: 'rgba(245,158,11,0.12)',   color: '#f59e0b', label: 'ARREGLO',     icon: 'fa-tools' },
    'PENDIENTES':  { bg: 'rgba(239,68,68,0.12)',    color: '#ef4444', label: 'PENDIENTES',  icon: 'fa-clock' },
    'CONTEO':      { bg: 'rgba(168,85,247,0.12)',   color: '#a855f7', label: 'CONTEO',      icon: 'fa-hashtag' },
};

// ── Mapeo de usuarios por correo ───────────────────────────────────────────
const USER_NAME_MAP = {
    'escaner1cdi@gmail.com': 'PAULA',
    'escaner2cdi@gmail.com': 'KELLY',
    'escaner3cdi@gmail.com': 'NICOL',
    'escaner4cdi@gmail.com': 'TATIANA',
    'coordinadorlogisticocdi@gmail.com': 'ANDRES'
};

const USER_EMAIL_MAP = {
    'PAULA': 'escaner1cdi@gmail.com',
    'KELLY': 'escaner2cdi@gmail.com',
    'NICOL': 'escaner3cdi@gmail.com',
    'TATIANA': 'escaner4cdi@gmail.com',
    'ANDRES': 'coordinadorlogisticocdi@gmail.com'
};

function _getNombreReportado(val) {
    if (!val) return '—';
    const lower = String(val).toLowerCase().trim();
    if (USER_NAME_MAP[lower]) return USER_NAME_MAP[lower];
    const upper = String(val).toUpperCase().trim();
    if (['PAULA', 'KELLY', 'NICOL', 'TATIANA', 'ANDRES'].includes(upper)) return upper;
    if (lower.includes('@')) return lower.split('@')[0].toUpperCase();
    return upper;
}

// ── Inicialización ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    // Esperar a que auth.js resuelva la sesión
    const checkReady = setInterval(() => {
        if (window.currentUser && window.getSupabaseClient && window.getSupabaseClient()) {
            clearInterval(checkReady);
            _initRetenidos();
        }
    }, 150);
    // Timeout de seguridad (5 s)
    setTimeout(() => {
        clearInterval(checkReady);
        if (!RetModule.data.length && !RetModule.loading) _initRetenidos();
    }, 5000);
});

async function _initRetenidos() {
    _bindTabEvents();
    _bindSearchEvent();
    _initDatePicker();   // Inicializa Flatpickr con semana actual
    await _loadData();
    _startLiveTimers();
    _startAutoRefresh();
    _subscribeRealtime();
}

// ── Rango semana actual ────────────────────────────────────────────────────
function _getWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=dom 1=lun ... 6=sab
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { desde: monday, hasta: sunday };
}

function _toISODate(d) {
    // Retorna 'YYYY-MM-DD' en hora local
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ── Flatpickr ─────────────────────────────────────────────────────────────
function _initDatePicker() {
    if (typeof flatpickr === 'undefined') {
        // Flatpickr no cargó todavía — reintentar en 500ms
        setTimeout(_initDatePicker, 500);
        return;
    }
    const { desde, hasta } = _getWeekRange();
    RetModule.dateRange = { desde: _toISODate(desde), hasta: _toISODate(hasta) + 'T23:59:59' };

    const input = document.getElementById('ret-daterange');
    if (!input) return;

    const picker = flatpickr(input, {
        mode: 'range',
        dateFormat: 'd/m/Y',
        locale: 'es',
        defaultDate: [desde, hasta],
        showMonths: 1,
        onChange: (selectedDates) => {
            if (selectedDates.length === 2) {
                const [d1, d2] = selectedDates;
                RetModule.dateRange = {
                    desde: _toISODate(d1),
                    hasta: _toISODate(d2) + 'T23:59:59'
                };
                _loadData();
            }
        }
    });

    RetModule._picker = picker;
    _updateDateLabel();
}

function _updateDateLabel() {
    const input = document.getElementById('ret-daterange');
    const { desde, hasta } = RetModule.dateRange;
    if (input && desde && hasta) {
        const d1 = new Date(desde + 'T00:00:00');
        const d2 = new Date(hasta);
        const fmt = (d) => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        input.value = `${fmt(d1)} — ${fmt(d2)}`;
    }
}

function retResetDateRange() {
    const { desde, hasta } = _getWeekRange();
    RetModule.dateRange = { desde: _toISODate(desde), hasta: _toISODate(hasta) + 'T23:59:59' };
    if (RetModule._picker) {
        RetModule._picker.setDate([desde, hasta], false);
    }
    _updateDateLabel();
    _loadData();
}
window.retResetDateRange = retResetDateRange;

// ── Token de sesión ────────────────────────────────────────────────────────
function _getToken() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes('-auth-token')) {
                const s = JSON.parse(localStorage.getItem(k));
                if (s?.access_token) return s.access_token;
            }
        }
    } catch (_) {}
    // fallback: anon key (definida en api.js)
    return (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '';
}

function _getFunctionsUrl() {
    return (typeof getFunctionsUrl === 'function')
        ? getFunctionsUrl()
        : 'https://zpikjjcbievfpzegupmw.supabase.co/functions/v1';
}

// ── Carga de datos via Edge Function ──────────────────────────────────────
async function _loadData() {
    if (RetModule.loading) return;
    RetModule.loading = true;
    _setLoadingState(true);

    try {
        const user = window.currentUser;
        const prodId = user?.ID_PRODUCTORA || user?.id_productora ||
                       user?.user_metadata?.id_productora;

        const body = {
            accion: 'LISTAR_RETENIDOS',
        };
        if (prodId) body.productora = parseInt(prodId);

        // Enviar rango de fechas si está definido
        if (RetModule.dateRange.desde && RetModule.dateRange.hasta) {
            body.fecha_desde = RetModule.dateRange.desde;
            body.fecha_hasta = RetModule.dateRange.hasta;
        }

        const resp = await fetch(`${_getFunctionsUrl()}/retenidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '',
                'Authorization': `Bearer ${_getToken()}`,
            },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const errJson = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
            throw new Error(errJson.message || `Error HTTP ${resp.status}`);
        }

        const json = await resp.json();
        if (!json.success) throw new Error(json.message || 'Error en la respuesta');

        RetModule.data = (json.retenidos || []).map(_normalizeRecord);
        _renderAll();

    } catch (err) {
        console.error('[RETENIDOS] Error al cargar datos:', err);
        _showError(`No se pudieron cargar los datos: ${err.message}`);
    } finally {
        RetModule.loading = false;
        _setLoadingState(false);
    }
}

function _normalizeRecord(r) {
    return {
        id:               r.id,
        id_master:        String(r.id_master || r.lote || ''),
        lote:             r.lote || r.id_master || '',
        referencia:       r.referencia || '',
        taller:           r.taller || '',
        linea:            r.linea || '',
        prenda:           r.prenda || '',
        genero:           r.genero || '',
        cantidad:         Number(r.cantidad) || 0,
        motivo:           (r.motivo || '').toUpperCase(),
        retenido:         r.retenido === true || r.retenido === 'true',
        fecha_reporte:    r.fecha_reporte || null,
        fecha_liberacion: r.fecha_liberacion || null,
        reportado_por:    r.reportado_por || '',
        liberado_por:     r.liberado_por || '',
        productora:       r.productora,
    };
}

// ── Realtime Subscription ─────────────────────────────────────────────────
function _subscribeRealtime() {
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!sb) {
        console.warn('[RETENIDOS] Supabase client no disponible para Realtime');
        return;
    }

    // Desuscribir canal anterior si existe
    if (RetModule.realtimeChannel) {
        sb.removeChannel(RetModule.realtimeChannel);
    }

    const user = window.currentUser;
    const prodId = user?.ID_PRODUCTORA || user?.id_productora;

    RetModule.realtimeChannel = sb
        .channel('retenidos-live')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'retenidos' },
            (payload) => {
                console.log('[REALTIME] INSERT retenidos:', payload.new);
                const rec = _normalizeRecord(payload.new);
                // Ignorar si no es de la misma productora
                if (prodId && rec.productora && String(rec.productora) !== String(prodId)) return;
                // Evitar duplicados
                const exists = RetModule.data.find(r => r.id === rec.id);
                if (!exists) {
                    RetModule.data.unshift(rec);
                    _renderAll();
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'retenidos' },
            (payload) => {
                console.log('[REALTIME] UPDATE retenidos:', payload.new);
                const rec = _normalizeRecord(payload.new);
                const idx = RetModule.data.findIndex(r => r.id === rec.id);
                if (idx !== -1) {
                    RetModule.data[idx] = rec;
                } else {
                    // Registro nuevo para este cliente (ej. filtro cambió)
                    RetModule.data.unshift(rec);
                }
                _renderAll();
            }
        )
        .subscribe((status) => {
            console.log('[REALTIME] Estado canal retenidos:', status);
            const dot = document.querySelector('.ret-live-dot');
            if (dot) {
                dot.style.background = status === 'SUBSCRIBED' ? '#10b981' : '#f59e0b';
                dot.title = status === 'SUBSCRIBED' ? 'Realtime activo' : `Reconectando… (${status})`;
            }
        });
}

// ── Toast de Realtime (Desactivado según preferencia de usuario) ───────────
function _showRealtimeToast() {
    // No-op
}

// ── Renderizado principal ──────────────────────────────────────────────────
function _renderAll() {
    const search = (document.getElementById('ret-search')?.value || '').trim().toLowerCase();
    let pool = RetModule.data;

    if (RetModule.tab === 'retenidos') {
        pool = pool.filter(r => r.retenido);
    } else if (RetModule.tab === 'liberados') {
        pool = pool.filter(r => !r.retenido);
    }

    if (search) {
        pool = pool.filter(r =>
            String(r.lote).includes(search) ||
            r.referencia.toLowerCase().includes(search) ||
            r.taller.toLowerCase().includes(search) ||
            r.prenda.toLowerCase().includes(search) ||
            r.genero.toLowerCase().includes(search) ||
            r.motivo.toLowerCase().includes(search)
        );
    }

    if (!RetModule.sortCol) {
        // Orden por defecto: los más antiguos primero (mayor tiempo arriba)
        pool = [...pool].sort((a, b) => {
            const da = a.fecha_reporte ? new Date(a.fecha_reporte).getTime() : 0;
            const db = b.fecha_reporte ? new Date(b.fecha_reporte).getTime() : 0;
            return da - db;
        });
    } else {
        const dir = RetModule.sortDir === 'asc' ? 1 : -1;
        pool = [...pool].sort((a, b) => {
            let av = a[RetModule.sortCol];
            let bv = b[RetModule.sortCol];
            if (RetModule.sortCol === 'fecha_reporte') {
                const da = av ? new Date(av).getTime() : 0;
                const db = bv ? new Date(bv).getTime() : 0;
                return (da - db) * dir;
            }
            if (typeof av === 'number') return (av - bv) * dir;
            return String(av || '').localeCompare(String(bv || '')) * dir;
        });
    }

    RetModule.filtered = pool;
    _renderKPIs();
    _renderTable(pool);
    _updateRowCount(pool.length);
    _updateColumnVisibility();
    _renderAnalyticsCharts();
    _applyRoleVisibility();
}

function _updateColumnVisibility() {
    const isRetenidos = (RetModule.tab === 'retenidos');
    document.querySelectorAll('.col-liberado').forEach(el => {
        el.style.display = isRetenidos ? 'none' : '';
    });
}

// ── Visibilidad por rol (USER-I no ve gráficas ni columna Tiempo) ────────────────
function _applyRoleVisibility() {
    const rol = window.currentUser?.ROL || '';
    const isUserI = (rol === 'USER-I');

    // — Sección de gráficas / analytics
    const analyticsSection = document.getElementById('ret-analytics-section');
    if (analyticsSection) {
        analyticsSection.style.display = isUserI ? 'none' : '';
    }

    // — Columna Tiempo: cabecera + todas las celdas
    document.querySelectorAll('.col-tiempo').forEach(el => {
        el.style.display = isUserI ? 'none' : '';
    });
}

// ── KPIs ───────────────────────────────────────────────────────────────────
function _renderKPIs() {
    const all      = RetModule.data;
    const ret      = all.filter(r => r.retenido);
    const lib      = all.filter(r => !r.retenido);
    const retUnits = ret.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);

    _animateCounter('kpi-ops-retenidas',   ret.length);
    _animateCounter('kpi-unids-retenidas', retUnits);
    _animateCounter('kpi-ops-liberadas',   lib.length);
    _animateCounter('kpi-total-ops',       all.length);
}

// ── Gráficos & Analytics Avanzados ─────────────────────────────────────────
let retCharts = {
    radarMotivos: null,
    barHorarios: null,
    barTiempoResolucion: null
};

function _renderAnalyticsCharts() {
    if (typeof Chart === 'undefined') return;
    const data = RetModule.data;
    if (!data || !data.length) return;

    // 1. KPI: Tiempo promedio de liberación
    const liberados = data.filter(r => !r.retenido && r.fecha_reporte && r.fecha_liberacion);
    let avgMs = 0;
    if (liberados.length) {
        const totalMs = liberados.reduce((acc, r) => {
            const start = new Date(r.fecha_reporte).getTime();
            const end = new Date(r.fecha_liberacion).getTime();
            return acc + Math.max(0, end - start);
        }, 0);
        avgMs = totalMs / liberados.length;
    }
    const avgTimeEl = document.getElementById('ret-kpi-avg-time');
    if (avgTimeEl) {
        if (avgMs > 0) {
            avgTimeEl.textContent = _formatDuration(avgMs);
        } else {
            avgTimeEl.textContent = '—';
        }
    }

    // 2. KPI: Motivo más frecuente
    const motivoCounts = {};
    data.forEach(r => {
        const m = r.motivo || 'OTROS';
        motivoCounts[m] = (motivoCounts[m] || 0) + 1;
    });
    let topMotivo = '—';
    let topCount = 0;
    Object.entries(motivoCounts).forEach(([m, c]) => {
        if (c > topCount) { topCount = c; topMotivo = m; }
    });
    const pctMotivo = data.length ? Math.round((topCount / data.length) * 100) : 0;
    const topMotivoEl = document.getElementById('ret-kpi-top-motivo');
    if (topMotivoEl) {
        const labelMotivo = MOTIVO_COLORS[topMotivo]?.label || topMotivo;
        topMotivoEl.textContent = topCount > 0 ? `${labelMotivo} (${pctMotivo}%)` : '—';
    }

    // 3. KPI: Tasa de Eficacia (% Liberado)
    const liberadosCount = data.filter(r => !r.retenido).length;
    const pctEficacia = data.length ? Math.round((liberadosCount / data.length) * 100) : 0;
    const tasaEl = document.getElementById('ret-kpi-tasa-liberacion');
    if (tasaEl) {
        tasaEl.textContent = data.length ? `${pctEficacia}%` : '—';
    }

    // ── CHART 1: SPIDER / RADAR CHART DE MOTIVOS ──────────────────────────────
    const radarCanvas = document.getElementById('chart-motivos-radar');
    if (radarCanvas) {
        const radarCtx = radarCanvas.getContext('2d');
        const labelsKeys = ['PROMOCIONES', 'CORREO', 'LAVADO', 'ARREGLO', 'PENDIENTES', 'CONTEO'];
        const values = labelsKeys.map(l => motivoCounts[l] || 0);

        if (retCharts.radarMotivos) retCharts.radarMotivos.destroy();
        retCharts.radarMotivos = new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: labelsKeys.map(l => (MOTIVO_COLORS[l]?.label || l)),
                datasets: [{
                    label: 'Retenciones',
                    data: values,
                    backgroundColor: 'rgba(99, 102, 241, 0.22)',
                    borderColor: 'rgba(99, 102, 241, 0.55)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(99, 102, 241, 0.6)',
                    pointBorderColor: 'rgba(99, 102, 241, 0.3)',
                    pointHoverBackgroundColor: 'rgba(99, 102, 241, 0.85)',
                    pointHoverBorderColor: 'rgba(99, 102, 241, 0.4)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(148, 163, 184, 0.25)' },
                        grid: { color: 'rgba(148, 163, 184, 0.25)' },
                        pointLabels: { color: '#475569', font: { weight: '700', size: 10 } },
                        ticks: { backdropColor: 'transparent', color: '#94a3b8', precision: 0 }
                    }
                }
            }
        });
    }

    // ── CHART 2: RETENCIONES VS SOLUCIONES POR HORA ───────────────────────────
    const horCanvas = document.getElementById('chart-horarios');
    if (horCanvas) {
        const horCtx = horCanvas.getContext('2d');
        const hourLabels = ['6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
        const retCounts = new Array(14).fill(0);
        const solCounts = new Array(14).fill(0);

        data.forEach(r => {
            if (r.fecha_reporte) {
                const h = new Date(r.fecha_reporte).getHours();
                if (h >= 6 && h <= 19) retCounts[h - 6]++;
            }
            if (r.fecha_liberacion) {
                const h = new Date(r.fecha_liberacion).getHours();
                if (h >= 6 && h <= 19) solCounts[h - 6]++;
            }
        });

        if (retCharts.barHorarios) retCharts.barHorarios.destroy();
        retCharts.barHorarios = new Chart(horCtx, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [
                    {
                        label: 'Retenidas',
                        data: retCounts,
                        backgroundColor: 'rgba(239, 68, 68, 0.26)',
                        borderColor: 'rgba(239, 68, 68, 0.50)',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Solucionadas',
                        data: solCounts,
                        backgroundColor: 'rgba(16, 185, 129, 0.26)',
                        borderColor: 'rgba(16, 185, 129, 0.50)',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 10, weight: '700' }, color: '#475569' }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9, weight: '600' } } },
                    y: { grid: { color: 'rgba(226, 232, 240, 0.4)' }, ticks: { color: '#94a3b8', precision: 0 } }
                }
            }
        });
    }

    // ── CHART 3: TIEMPO DE RESOLUCIÓN POR MOTIVO ─────────────────────
    const resCanvas = document.getElementById('chart-tiempo-resolucion');
    if (resCanvas) {
        const resCtx = resCanvas.getContext('2d');
        const motivoTotalsMs = {};
        const motivoCountsLib = {};

        data.forEach(r => {
            if (!r.retenido && r.fecha_reporte && r.fecha_liberacion) {
                const start = new Date(r.fecha_reporte).getTime();
                const end = new Date(r.fecha_liberacion).getTime();
                const diffMs = Math.max(0, end - start);
                const m = r.motivo || 'OTROS';

                motivoTotalsMs[m] = (motivoTotalsMs[m] || 0) + diffMs;
                motivoCountsLib[m] = (motivoCountsLib[m] || 0) + 1;
            }
        });

        const allMotivos = ['PROMOCIONES', 'CORREO', 'LAVADO', 'ARREGLO', 'PENDIENTES', 'CONTEO'];
        const motivoAvgs = allMotivos.map(m => {
            const count = motivoCountsLib[m] || 0;
            const avgMs = count > 0 ? (motivoTotalsMs[m] / count) : 0;
            const mInfo = MOTIVO_COLORS[m] || { bg: 'rgba(99,102,241,0.28)', color: '#6366f1', label: m };
            // Extraer los componentes rgb del color para crear un rgba con opacidad 0.28 (como metricas)
            const bgFill = mInfo.bg.replace(/[\d.]+\)$/, '0.28)');
            return {
                key: m,
                label: mInfo.label || m,
                avgMs: avgMs,
                avgHrs: parseFloat((avgMs / (1000 * 3600)).toFixed(2)),
                color: mInfo.color,
                bgFill: bgFill
            };
        });

        // Ordenar por mayor tiempo de resolución
        motivoAvgs.sort((a, b) => b.avgMs - a.avgMs);

        if (retCharts.barTiempoResolucion) retCharts.barTiempoResolucion.destroy();
        retCharts.barTiempoResolucion = new Chart(resCtx, {
            type: 'bar',
            data: {
                labels: motivoAvgs.map(m => m.label),
                datasets: [{
                    label: 'Tiempo Promedio',
                    data: motivoAvgs.map(m => m.avgHrs),
                    backgroundColor: motivoAvgs.map(m => m.bgFill),
                    borderColor: motivoAvgs.map(m => m.color + '99'),
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const item = motivoAvgs[context.dataIndex];
                                const ms = item ? item.avgMs : (context.raw || 0) * 3600 * 1000;
                                return ` Tiempo Promedio: ${_formatDuration(ms)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(226, 232, 240, 0.4)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10, weight: '600' },
                            callback: (v) => `${v} h`
                        }
                    },
                    y: { grid: { display: false }, ticks: { color: '#475569', font: { size: 10, weight: '700' } } }
                }
            }
        });
    }
}

function _animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.textContent.replace(/\D/g, '')) || 0;
    if (current === target) return;
    const step = Math.ceil(Math.abs(target - current) / 12);
    let val = current;
    const interval = setInterval(() => {
        val = val < target ? Math.min(val + step, target) : Math.max(val - step, target);
        el.textContent = val.toLocaleString('es-CO');
        if (val === target) clearInterval(interval);
    }, 40);
}

// ── Tabla ──────────────────────────────────────────────────────────────────
function _renderTable(rows) {
    const tbody = document.getElementById('ret-tbody');
    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
              <td colspan="12" style="text-align:center;padding:3rem;color:#94a3b8;">
                <i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.35;"></i>
                No hay registros para mostrar
              </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => _buildRow(r)).join('');
    _applyTimerColors();
}

function _buildRow(r) {
    const mInfo = MOTIVO_COLORS[r.motivo] || { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: r.motivo, icon: 'fa-info-circle' };
    const estadoBadge = r.retenido
        ? `<span class="ret-badge ret-badge--retenido"><i class="fas fa-lock" style="margin-right:4px;font-size:0.65rem;"></i>RETENIDO</span>`
        : `<span class="ret-badge ret-badge--liberado"><i class="fas fa-lock-open" style="margin-right:4px;font-size:0.65rem;"></i>LIBERADO</span>`;

    const fechaRep = r.fecha_reporte    ? _fmtDate(r.fecha_reporte)    : '—';
    const fechaLib = r.fecha_liberacion ? _fmtDate(r.fecha_liberacion) : '—';
    const timerLabel = r.retenido ? 'Atraso' : 'Resolución';
    const timerMode = r.retenido ? 'atraso' : 'resolucion';
    const timerAttrs = `data-ret-start="${r.fecha_reporte || ''}" data-ret-end="${r.fecha_liberacion || ''}" data-ret-mode="${timerMode}"`;

    const user = window.currentUser;
    const canEdit = ['ADMIN', 'MODERATOR', 'USER-I'].includes(user?.ROL);

    const liberarBtn = (r.retenido && canEdit)
        ? `<button class="ret-liberar-btn" onclick="retLiberarOP(${r.id}, '${r.lote}')" title="Liberar esta OP">
               <i class="fas fa-lock-open"></i>
           </button>`
        : '';

    const cantDisplay = (canEdit && r.retenido)
        ? `<span class="ret-cant-click" onclick="retEditarCantidadInline(this.parentElement, ${r.id}, ${r.cantidad})" title="Toca para editar cantidad">${r.cantidad.toLocaleString('es-CO')} <i class="fas fa-pencil-alt ret-cant-edit-icon"></i></span>`
        : r.cantidad.toLocaleString('es-CO');

    const reportadorNombre = _getNombreReportado(r.reportado_por);
    const reportadorHtml = (canEdit && r.retenido)
        ? `<span class="ret-user-click" onclick="retEditarReportadorInline(this.parentElement, ${r.id}, '${reportadorNombre}')" title="Toca para cambiar usuario"><i class="fas fa-user" style="font-size:0.65rem;"></i>${reportadorNombre} <i class="fas fa-pencil-alt ret-user-edit-icon"></i></span>`
        : `<span class="ret-user-tag"><i class="fas fa-user" style="margin-right:4px;font-size:0.65rem;"></i>${reportadorNombre}</span>`;

    return `
        <tr class="ret-row" data-id="${r.id}">
            <td class="ret-td ret-td--op">${r.lote || '—'} ${liberarBtn}</td>
            <td class="ret-td">${r.referencia || '—'}</td>
            <td class="ret-td ret-td--taller" title="${r.taller}">${_truncate(r.taller, 22)}</td>
            <td class="ret-td col-linea">${r.linea || '—'}</td>
            <td class="ret-td">${r.prenda || '—'}</td>
            <td class="ret-td col-genero">${r.genero || '—'}</td>
            <td class="ret-td ret-td--num">${cantDisplay}</td>
            <td class="ret-td">
                <span class="ret-motivo" style="background:${mInfo.bg};color:${mInfo.color};"><i class="fas ${mInfo.icon || 'fa-tag'}" style="margin-right:4px;font-size:0.65rem;"></i>${mInfo.label || r.motivo}</span>
            </td>
            <td class="ret-td">${estadoBadge}</td>
            <td class="ret-td">${reportadorHtml}</td>
            <td class="ret-td ret-td--fecha">${fechaRep}</td>
            <td class="ret-td ret-td--timer col-tiempo" ${timerAttrs}>
                <span class="ret-timer"><i class="fas fa-stopwatch" style="margin-right: 5px; font-size: 0.75rem;"></i>${_calcElapsed(r)}</span>
            </td>
            <td class="ret-td col-liberado">${fechaLib}</td>
        </tr>`;
}

// ── Edición On-Demand de Cantidad en Tabla (Click-to-edit) ─────────────────
function retEditarCantidadInline(cell, id, currentVal) {
    if (cell.querySelector('input')) return;
    const rawVal = Number(currentVal) || 0;

    cell.innerHTML = `<input type="number" class="ret-cant-inline-input" value="${rawVal}" min="1" autofocus style="width: 75px; text-align: right; padding: 2px 6px; border: 1.5px solid #6366f1; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.82rem; background: #fff; color: #1e293b; outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.2);">`;

    const input = cell.querySelector('input');
    input.focus();
    input.select();

    let saved = false;
    const guardar = () => {
        if (saved) return;
        saved = true;
        const newCant = parseInt(input.value, 10);
        if (!isNaN(newCant) && newCant > 0 && newCant !== rawVal) {
            retActualizarCantidadTabla(id, newCant);
            cell.innerHTML = `<span class="ret-cant-click" onclick="retEditarCantidadInline(this.parentElement, ${id}, ${newCant})" title="Toca para editar cantidad">${newCant.toLocaleString('es-CO')} <i class="fas fa-pencil-alt ret-cant-edit-icon"></i></span>`;
        } else {
            cell.innerHTML = `<span class="ret-cant-click" onclick="retEditarCantidadInline(this.parentElement, ${id}, ${rawVal})" title="Toca para editar cantidad">${rawVal.toLocaleString('es-CO')} <i class="fas fa-pencil-alt ret-cant-edit-icon"></i></span>`;
        }
    };

    input.addEventListener('blur', guardar);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            guardar();
        } else if (e.key === 'Escape') {
            saved = true;
            cell.innerHTML = `<span class="ret-cant-click" onclick="retEditarCantidadInline(this.parentElement, ${id}, ${rawVal})" title="Toca para editar cantidad">${rawVal.toLocaleString('es-CO')} <i class="fas fa-pencil-alt ret-cant-edit-icon"></i></span>`;
        }
    });
}
window.retEditarCantidadInline = retEditarCantidadInline;

// ── Edición On-Demand de Reportador en Tabla (Click-to-edit) ────────────────
function retEditarReportadorInline(cell, id, currentNombre) {
    if (cell.querySelector('select')) return;

    const nombres = ['PAULA', 'KELLY', 'NICOL', 'TATIANA', 'ANDRES'];
    const optionsHtml = nombres.map(n => 
        `<option value="${n}" ${n === currentNombre ? 'selected' : ''}>${n}</option>`
    ).join('');

    cell.innerHTML = `<select class="ret-select-inline" autofocus style="padding: 2px 6px; border: 1.5px solid #6366f1; border-radius: 6px; font-weight: 700; font-size: 0.75rem; background: #fff; color: #1e293b; outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.2);">${optionsHtml}</select>`;

    const select = cell.querySelector('select');
    select.focus();

    let saved = false;
    const guardar = () => {
        if (saved) return;
        saved = true;
        const newNombre = select.value;
        if (newNombre && newNombre !== currentNombre) {
            retCambiarReportador(id, newNombre);
            cell.innerHTML = `<span class="ret-user-click" onclick="retEditarReportadorInline(this.parentElement, ${id}, '${newNombre}')" title="Toca para cambiar usuario"><i class="fas fa-user" style="font-size:0.65rem;"></i>${newNombre} <i class="fas fa-pencil-alt ret-user-edit-icon"></i></span>`;
        } else {
            cell.innerHTML = `<span class="ret-user-click" onclick="retEditarReportadorInline(this.parentElement, ${id}, '${currentNombre}')" title="Toca para cambiar usuario"><i class="fas fa-user" style="font-size:0.65rem;"></i>${currentNombre} <i class="fas fa-pencil-alt ret-user-edit-icon"></i></span>`;
        }
    };

    select.addEventListener('change', guardar);
    select.addEventListener('blur', guardar);
}
window.retEditarReportadorInline = retEditarReportadorInline;

// ── Actualización de cantidad directa en tabla ────────────────────────────
async function retActualizarCantidadTabla(id, novaCant) {
    const val = parseInt(novaCant, 10);
    if (isNaN(val) || val < 1) return;

    // Actualización optimista
    const idx = RetModule.data.findIndex(r => r.id === id);
    if (idx !== -1) {
        RetModule.data[idx].cantidad = val;
        _renderKPIs();
    }

    try {
        await fetch(`${_getFunctionsUrl()}/retenidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '',
                'Authorization': `Bearer ${_getToken()}`,
            },
            body: JSON.stringify({ accion: 'ACTUALIZAR_CANTIDAD', id, cantidad: val }),
        });
    } catch (err) {
        console.error('[RETENIDOS] Error al actualizar cantidad:', err);
    }
}
window.retActualizarCantidadTabla = retActualizarCantidadTabla;

// ── Actualización de usuario reportador directa en tabla ──────────────────
async function retCambiarReportador(id, nuevoNombre) {
    const email = USER_EMAIL_MAP[nuevoNombre] || nuevoNombre;

    // Actualización optimista
    const idx = RetModule.data.findIndex(r => r.id === id);
    if (idx !== -1) {
        RetModule.data[idx].reportado_por = email;
    }

    try {
        await fetch(`${_getFunctionsUrl()}/retenidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '',
                'Authorization': `Bearer ${_getToken()}`,
            },
            body: JSON.stringify({ accion: 'ACTUALIZAR_REPORTADO', id, reportado_por: email }),
        });
    } catch (err) {
        console.error('[RETENIDOS] Error al actualizar reportador:', err);
    }
}
window.retCambiarReportador = retCambiarReportador;

// ── Liberar OP (Directo sin SweetAlert) ───────────────────────────────────
async function retLiberarOP(id, lote) {
    try {
        const resp = await fetch(`${_getFunctionsUrl()}/retenidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '',
                'Authorization': `Bearer ${_getToken()}`,
            },
            body: JSON.stringify({ accion: 'LIBERAR_OP', id }),
        });

        const json = await resp.json();
        if (!resp.ok || !json.success) throw new Error(json.message || 'Error al liberar');

        const idx = RetModule.data.findIndex(r => r.id === id);
        if (idx !== -1) {
            RetModule.data[idx].retenido = false;
            RetModule.data[idx].fecha_liberacion = new Date().toISOString();
            _renderAll();
        }

    } catch (err) {
        console.error('[RETENIDOS] Error al liberar:', err);
    }
}
window.retLiberarOP = retLiberarOP;

// ── Timers en vivo ─────────────────────────────────────────────────────────
function _startLiveTimers() {
    if (RetModule.timerInterval) clearInterval(RetModule.timerInterval);
    RetModule.timerInterval = setInterval(_tickTimers, 1000);
}

function _tickTimers() {
    document.querySelectorAll('#ret-tbody td[data-ret-mode]').forEach(td => {
        const mode  = td.getAttribute('data-ret-mode');
        const start = td.getAttribute('data-ret-start');
        const end   = td.getAttribute('data-ret-end');
        const span  = td.querySelector('.ret-timer');
        if (!span || !start) return;
        const timeText = (mode === 'atraso' || !end)
            ? _elapsedSince(start)
            : _elapsedBetween(start, end);
        span.innerHTML = `<i class="fas fa-stopwatch" style="margin-right: 5px; font-size: 0.75rem;"></i>${timeText}`;
    });
    _applyTimerColors();
}

function _calcElapsed(r) {
    if (!r.fecha_reporte) return '—';
    if (r.retenido) return _elapsedSince(r.fecha_reporte);
    return r.fecha_liberacion
        ? _elapsedBetween(r.fecha_reporte, r.fecha_liberacion)
        : _elapsedSince(r.fecha_reporte);
}

function _elapsedSince(dateStr) {
    const start = new Date(dateStr);
    if (isNaN(start)) return '—';
    return _formatDuration(Date.now() - start.getTime());
}

function _elapsedBetween(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start) || isNaN(end)) return '—';
    return _formatDuration(end.getTime() - start.getTime());
}

function _formatDuration(ms) {
    if (ms < 0) return '0s';
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${_pad(m)}m ${_pad(s)}s`;
    if (h > 0) return `${h}h ${_pad(m)}m ${_pad(s)}s`;
    return `${m}m ${_pad(s)}s`;
}

// ── Colorear dinámico del texto del contador (Verde, Naranja, Rojo) ─────────
function _applyTimerColors() {
    const tds = document.querySelectorAll('#ret-tbody td[data-ret-mode]');
    if (!tds.length) return;

    const HOUR_MS = 3600 * 1000;

    tds.forEach(td => {
        const mode  = td.getAttribute('data-ret-mode');
        const start = td.getAttribute('data-ret-start');
        const end   = td.getAttribute('data-ret-end');
        const span  = td.querySelector('.ret-timer');
        const row   = td.closest('tr');
        if (!span || !start) return;

        if (row) {
            row.style.backgroundColor = '';
            row.classList.remove('ret-row--overdue');
        }

        // Sin fondos ni bordes (solo texto)
        span.style.backgroundColor = 'transparent';
        span.style.border = 'none';

        const isLive = (mode === 'atraso' || !end);
        const ms = isLive
            ? (Date.now() - new Date(start).getTime())
            : (new Date(end).getTime() - new Date(start).getTime());

        const hours = (isNaN(ms) || ms < 0) ? 0 : ms / HOUR_MS;

        if (!isLive) {
            // Liberado: texto gris suave
            span.style.color = '#64748b';
        } else if (hours <= 4) {
            // ≤ 4h: Verde aesthetic
            span.style.color = '#10b981';
        } else if (hours <= 8) {
            // 4h a 8h: Naranja
            span.style.color = '#f97316';
        } else {
            // > 8h: Rojo
            span.style.color = '#ef4444';
        }
    });
}

// ── Auto-refresh cada 4 minutos ────────────────────────────────────────────
function _startAutoRefresh() {
    if (RetModule.refreshInterval) clearInterval(RetModule.refreshInterval);
    RetModule.refreshInterval = setInterval(_loadData, 4 * 60 * 1000);
}

// ── Pestañas ───────────────────────────────────────────────────────────────
function _bindTabEvents() {
    document.querySelectorAll('.ret-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ret-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            RetModule.tab = btn.dataset.tab;
            _renderAll();
        });
    });
}

// ── Búsqueda ───────────────────────────────────────────────────────────────
function _bindSearchEvent() {
    const inp = document.getElementById('ret-search');
    if (!inp) return;
    let debounce;
    inp.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(_renderAll, 220);
    });
}

// ── Ordenamiento ───────────────────────────────────────────────────────────
function retSortBy(col) {
    RetModule.sortDir = (RetModule.sortCol === col && RetModule.sortDir === 'asc') ? 'desc' : 'asc';
    RetModule.sortCol = col;
    document.querySelectorAll('.ret-th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === col) {
            th.classList.add(RetModule.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
    _renderAll();
}
window.retSortBy = retSortBy;

// ── Exportar CSV ───────────────────────────────────────────────────────────
function retExportCSV() {
    const rows = RetModule.filtered;
    if (!rows.length) return;
    const headers = ['OP','Referencia','Taller','Línea','Prenda','Género','Cantidad','Motivo','Estado','Reportado por','Fecha Reporte','Liberado por','Fecha Liberación'];
    const csvRows = [headers.join(';')];
    rows.forEach(r => {
        csvRows.push([
            r.lote || '',
            `"${(r.referencia || '').replace(/"/g, '""')}"`,
            `"${(r.taller || '').replace(/"/g, '""')}"`,
            `"${(r.linea || '').replace(/"/g, '""')}"`,
            `"${(r.prenda || '').replace(/"/g, '""')}"`,
            `"${(r.genero || '').replace(/"/g, '""')}"`,
            r.cantidad || 0,
            `"${(r.motivo || '').replace(/"/g, '""')}"`,
            r.retenido ? 'Retenido' : 'Liberado',
            `"${_getNombreReportado(r.reportado_por)}"`,
            r.fecha_reporte    ? new Date(r.fecha_reporte).toLocaleString('es-CO')    : '',
            `"${(r.liberado_por || '').replace(/"/g, '""')}"`,
            r.fecha_liberacion ? new Date(r.fecha_liberacion).toLocaleString('es-CO') : '',
        ].join(';'));
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `retenidos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
window.retExportCSV = retExportCSV;

// ── Refresco manual ────────────────────────────────────────────────────────
function retRefresh() {
    if (typeof invalidateCache === 'function') invalidateCache('RETENIDOS');
    _loadData();
}
window.retRefresh = retRefresh;

// ── Helpers de UI ──────────────────────────────────────────────────────────
function _setLoadingState(on) {
    const skeleton = document.getElementById('ret-skeleton-container');
    const dataContainer = document.getElementById('ret-data-container');
    if (on) {
        if (skeleton) skeleton.classList.remove('hidden');
        if (dataContainer) dataContainer.classList.add('hidden');
    } else {
        if (skeleton) skeleton.classList.add('hidden');
        if (dataContainer) dataContainer.classList.remove('hidden');
    }
}

function _showError(msg) {
    const tbody = document.getElementById('ret-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
              <td colspan="12" style="text-align:center;padding:3rem;color:#ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
                ${msg}
              </td>
            </tr>`;
    }
}

function _updateRowCount(n) {
    const el = document.getElementById('ret-row-count');
    if (el) el.textContent = n > 0 ? `${n.toLocaleString('es-CO')} registro${n !== 1 ? 's' : ''}` : '';
}

function _fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('es-CO', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function _truncate(str, max) {
    if (!str) return '—';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

function _pad(n) { return String(n).padStart(2, '0'); }

// ══════════════════════════════════════════════════════════════════════════
// MODAL — Registrar Nueva Retención
// ══════════════════════════════════════════════════════════════════════════

/** Estado del modal */
const RetModal = {
    opSeleccionada: null,   // registro de master seleccionado
    motivoSeleccionado: null,
    buscandoTimer: null,
};

/** Abre el modal y resetea su estado */
function retAbrirModal() {
    const backdrop = document.getElementById('ret-modal-backdrop');
    if (!backdrop) return;
    // Reset
    RetModal.opSeleccionada    = null;
    RetModal.motivoSeleccionado = null;
    document.getElementById('ret-op-input').value = '';
    document.getElementById('ret-op-suggestions').classList.remove('open');
    document.getElementById('ret-op-suggestions').innerHTML = '';
    document.getElementById('ret-op-preview').classList.remove('visible');
    const cantInput = document.getElementById('prev-cant-input');
    if (cantInput) cantInput.value = '';
    document.querySelectorAll('.ret-motivo-chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('ret-submit-btn').disabled = true;
    // Abrir
    backdrop.classList.add('open');
    setTimeout(() => document.getElementById('ret-op-input')?.focus(), 120);
}
window.retAbrirModal = retAbrirModal;

/** Cierra el modal */
function retCerrarModal(event) {
    if (event && event.target !== document.getElementById('ret-modal-backdrop')) return;
    const backdrop = document.getElementById('ret-modal-backdrop');
    if (backdrop) backdrop.classList.remove('open');
}
window.retCerrarModal = retCerrarModal;

/** Búsqueda con debounce en la tabla master */
function retBuscarOP(query) {
    clearTimeout(RetModal.buscandoTimer);
    const sugsEl   = document.getElementById('ret-op-suggestions');
    const spinner  = document.getElementById('ret-op-spinner');
    const previewEl = document.getElementById('ret-op-preview');

    RetModal.opSeleccionada = null;
    previewEl.classList.remove('visible');
    _retCheckSubmitReady();

    const q = (query || '').trim();
    if (q.length < 2) {
        sugsEl.classList.remove('open');
        sugsEl.innerHTML = '';
        return;
    }

    spinner.classList.add('active');

    RetModal.buscandoTimer = setTimeout(async () => {
        try {
            const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
            if (!sb) throw new Error('Cliente no disponible');

            const isNumeric = /^\d+$/.test(q);

            let queryBuilder = sb
                .from('master')
                .select('*')
                .limit(8);

            if (isNumeric) {
                const num = parseInt(q, 10);
                queryBuilder = queryBuilder.or(`id_master.eq.${num},referencia.ilike.%${q}%`);
            } else {
                queryBuilder = queryBuilder.or(
                    `referencia.ilike.%${q}%,nombre_planta.ilike.%${q}%,descripcion.ilike.%${q}%`
                );
            }

            const user = window.currentUser;
            const prodId = user?.ID_PRODUCTORA || user?.id_productora;
            if (prodId && user?.ROL !== 'ADMIN') {
                queryBuilder = queryBuilder.eq('productora', parseInt(prodId));
            }

            const { data, error } = await queryBuilder;
            if (error) throw error;

            _renderOPSugerencias(data || []);
        } catch (err) {
            console.error('[RETENIDOS] Error buscando OP:', err);
            sugsEl.innerHTML = `<div style="padding:12px;color:#ef4444;font-size:0.8rem;"><i class="fas fa-exclamation-circle"></i> Error: ${err.message}</div>`;
            sugsEl.classList.add('open');
        } finally {
            spinner.classList.remove('active');
        }
    }, 320);
}
window.retBuscarOP = retBuscarOP;

function _renderOPSugerencias(items) {
    const sugsEl = document.getElementById('ret-op-suggestions');
    if (!items.length) {
        sugsEl.innerHTML = `<div style="padding:12px;color:#94a3b8;font-size:0.8rem;text-align:center;"><i class="fas fa-search" style="margin-right:6px;"></i>Sin resultados</div>`;
        sugsEl.classList.add('open');
        return;
    }

    sugsEl.innerHTML = items.map((op) => {
        const lote = op.id_master || op.lote || '?';
        const ref  = op.referencia || op.refprov || '—';
        const tal  = op.nombre_planta || op.taller || '—';
        const prd  = op.descripcion || op.prenda || '';
        const safeJson = JSON.stringify(JSON.stringify(op));
        return `
            <div class="ret-op-suggestion-item" onclick='retSeleccionarOP(${safeJson})'>
                <div>
                    <div class="ret-sug-lote">OP ${lote}</div>
                    <div class="ret-sug-meta">${ref} · ${tal}${prd ? ' · ' + prd : ''}</div>
                </div>
            </div>`;
    }).join('');
    sugsEl.classList.add('open');
}

window.retSeleccionarOP = function(opJsonStr) {
    let op;
    try { op = typeof opJsonStr === 'string' ? JSON.parse(opJsonStr) : opJsonStr; } catch (_) { return; }
    RetModal.opSeleccionada = op;

    const lote = op.id_master || op.lote || '?';
    const ref  = op.referencia || op.refprov  || '—';
    const tal  = op.nombre_planta || op.taller || '—';
    const prd  = op.descripcion || op.prenda || '—';
    const gen  = op.genero || '—';
    const cant = Number(op.cantidad) || 0;

    document.getElementById('ret-op-input').value = `${lote}  ·  ${ref}`;
    const sugsEl = document.getElementById('ret-op-suggestions');
    sugsEl.classList.remove('open');
    sugsEl.innerHTML = '';
    document.getElementById('prev-lote').textContent   = lote;
    document.getElementById('prev-ref').textContent    = ref;
    document.getElementById('prev-taller').textContent = tal;
    document.getElementById('prev-prenda').textContent = prd;
    document.getElementById('prev-genero').textContent = gen;

    // Auto-completar cantidad editable
    const cantInput = document.getElementById('prev-cant-input');
    if (cantInput) cantInput.value = cant;

    document.getElementById('ret-op-preview').classList.add('visible');
    _retCheckSubmitReady();
};

function retOnCantInputChange(val) {
    _retCheckSubmitReady();
}
window.retOnCantInputChange = retOnCantInputChange;

/** Selecciona un motivo */
function retSelMotivo(chip) {
    document.querySelectorAll('.ret-motivo-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    RetModal.motivoSeleccionado = chip.dataset.m;
    _retCheckSubmitReady();
}
window.retSelMotivo = retSelMotivo;

/** Habilita/deshabilita el botón Registrar */
function _retCheckSubmitReady() {
    const btn = document.getElementById('ret-submit-btn');
    if (!btn) return;
    const cantVal = parseInt(document.getElementById('prev-cant-input')?.value || '0', 10);
    btn.disabled = !(RetModal.opSeleccionada && RetModal.motivoSeleccionado && cantVal > 0);
}

/** Envía el registro a la Edge Function */
async function retGuardarRetenido() {
    const op     = RetModal.opSeleccionada;
    const motivo = RetModal.motivoSeleccionado;
    const cantVal = parseInt(document.getElementById('prev-cant-input')?.value || '0', 10);
    if (!op || !motivo || !cantVal) return;

    const btn = document.getElementById('ret-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';
    }

    try {
        const user   = window.currentUser;
        const prodId = op.productora ||
                       user?.ID_PRODUCTORA || user?.id_productora ||
                       user?.user_metadata?.id_productora;

        const body = {
            accion:     'GUARDAR_RETENIDO',
            id_master:  String(op.id_master || op.lote || ''),
            lote:       op.id_master ? parseInt(op.id_master) : (op.lote ? parseInt(op.lote) : null),
            referencia: op.referencia || op.refprov || '',
            taller:     op.nombre_planta || op.taller  || '',
            linea:      op.cuento || op.linea   || '',
            prenda:     op.descripcion || op.prenda  || '',
            genero:     op.genero  || '',
            cantidad:   cantVal,
            productora: prodId ? parseInt(prodId) : undefined,
            motivo,
        };

        const resp = await fetch(`${_getFunctionsUrl()}/retenidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '',
                'Authorization': `Bearer ${_getToken()}`,
            },
            body: JSON.stringify(body),
        });

        const json = await resp.json();
        if (!resp.ok || !json.success) throw new Error(json.message || 'Error al guardar');

        // Cerrar modal al instante
        const backdrop = document.getElementById('ret-modal-backdrop');
        if (backdrop) backdrop.classList.remove('open');

        // Actualización local inmediata
        if (json.retenido) {
            const rec = _normalizeRecord(json.retenido);
            const exists = RetModule.data.find(r => r.id === rec.id);
            if (!exists) {
                RetModule.data.unshift(rec);
                _renderAll();
            }
        }

    } catch (err) {
        console.error('[RETENIDOS] Error guardando retención:', err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-lock"></i> Registrar Retención';
        }
    }
}
window.retGuardarRetenido = retGuardarRetenido;

// Cerrar sugerencias al hacer click fuera
document.addEventListener('click', (e) => {
    const sugs = document.getElementById('ret-op-suggestions');
    const wrap = document.querySelector('.ret-op-search-wrap');
    if (sugs && wrap && !wrap.contains(e.target)) {
        sugs.classList.remove('open');
    }
});

