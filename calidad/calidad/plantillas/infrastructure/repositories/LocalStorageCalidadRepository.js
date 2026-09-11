import { IReportRepository }    from '../../core/ports/IReportRepository.js';
import { ReporteCalidadEntity }  from '../../core/domain/calidad/ReporteCalidadEntity.js';
import { CurvaProduccionEntity } from '../../core/domain/calidad/CurvaProduccionEntity.js';
import { HallazgoDefectoEntity } from '../../core/domain/calidad/HallazgoDefectoEntity.js';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

const COLOR_HEX_MAP = {
    negro:'#1e293b', blanco:'#f1f5f9', rojo:'#ef4444', azul:'#3b82f6',
    verde:'#22c55e', camel:'#c2944e', crema:'#f5e6c8', gris:'#64748b',
    rosado:'#f472b6', naranja:'#f97316', amarillo:'#eab308', morado:'#8b5cf6',
    fucsia:'#d946ef', café:'#92400e', vinotinto:'#881337', negro:'#1e293b',
};

function colorHex(nombre) {
    const k = (nombre || '').toLowerCase();
    for (const [n, h] of Object.entries(COLOR_HEX_MAP)) {
        if (k.includes(n)) return h;
    }
    // Generar color HSL determinista desde el nombre para que colores
    // desconocidos siempre tengan el mismo hex y sean visualmente distintos
    let hash = 0;
    for (let i = 0; i < k.length; i++) hash = k.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 40%)`;
}

function parseJson(raw) {
    if (!raw) return null;
    if (typeof raw !== 'string') return raw;
    try { const v = JSON.parse(raw); return typeof v === 'string' ? JSON.parse(v) : v; }
    catch (_) { return null; }
}

function fmtFecha(raw) {
    if (!raw) return 'N/A';
    try {
        const d = new Date(raw);
        if (isNaN(d)) return String(raw);
        const pad = n => String(n).padStart(2, '0');
        let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())} ${ap}`;
    } catch (_) { return String(raw); }
}

function normalizarCoords(loc) {
    if (!loc) return null;
    if (typeof loc === 'object' && loc.lat && loc.lng) return `${loc.lat},${loc.lng}`;
    if (typeof loc === 'string' && loc.includes(',')) return loc.trim();
    const p = parseJson(loc);
    if (p?.lat && p?.lng) return `${p.lat},${p.lng}`;
    return null;
}

// ─────────────────────────────────────────────────────────────
//  Curva desde extensiones
//  Formato BD: [{color, talla, cantidad}, ...]
//  Salida: CurvaProduccionEntity con filas agrupadas por color
// ─────────────────────────────────────────────────────────────
function buildCurva(raw) {
    const items = parseJson(raw);
    if (!Array.isArray(items) || !items.length) {
        return new CurvaProduccionEntity({ tallas: [], filas: [] });
    }

    // Tallas en orden de aparición, sin tocar
    const tallasOrden = [];
    const tallasVistas = new Set();
    items.forEach(i => {
        const t = i.talla;
        if (!tallasVistas.has(t)) { tallasVistas.add(t); tallasOrden.push(t); }
    });

    // Agrupar por color, sin tocar el valor
    const colorMap = new Map(); // color → { hex, cantidades }
    items.forEach(i => {
        const color = i.color;
        const talla = i.talla;
        const cant  = Number(i.cantidad || 0);
        if (!colorMap.has(color)) {
            colorMap.set(color, { hex: colorHex(color), cantidades: {} });
        }
        const fila = colorMap.get(color);
        fila.cantidades[talla] = (fila.cantidades[talla] || 0) + cant;
    });

    const filas = [...colorMap.entries()].map(([color, { hex, cantidades }]) => ({
        color, hex, cantidades
    }));

    return new CurvaProduccionEntity({ tallas: tallasOrden, filas });
}

// ─────────────────────────────────────────────────────────────
//  Hallazgos desde novedades_auditoria
//  Formato BD: [{tipo, codigos:[{color,talla,cantidad}],
//               proceso, sin_proceso, totalUnidades}]
//  La plantilla HallazgosTableComponent espera HallazgoDefectoEntity[]
//  con cantidadesPorTalla como Record<talla, qty>.
//  Agrupamos por (tipo + color) para que cada fila de la tabla sea
//  una combinación única.
// ─────────────────────────────────────────────────────────────

const TIPO_CLASE = {
    'SIN CONFECCIONAR': 'sin-confeccionar',
    'PROMOCIONES':      'promociones',
    'COBROS':           'cobros',
    'LAVADO':           'lavado',
};

function tipoClaseFromNovedad(novedad) {
    const tipo = (novedad.tipo || '').toUpperCase();
    if (novedad.tipo_base === 'COBROS' || tipo.startsWith('COBRO')) return 'cobros';
    return TIPO_CLASE[tipo] || 'sin-confeccionar';
}

function buildHallazgos(raw, tallas) {
    const novedades = parseJson(raw);
    if (!Array.isArray(novedades) || !novedades.length) return [];

    const grupos = new Map(); // key: `label||color`

    for (const nov of novedades) {
        const tipoBase  = nov.tipo;
        const sinProc   = nov.sin_proceso === true;
        const proceso   = nov.proceso || '';
        const codigos   = Array.isArray(nov.codigos) ? nov.codigos : [];

        // Label exacto
        let label     = tipoBase;
        let tipoClase = TIPO_CLASE[tipoBase] || 'sin-confeccionar';

        if (tipoBase === 'PROMOCIONES') {
            label     = sinProc ? 'PROMOCION — SIN PROCESO' : 'PROMOCION';
            tipoClase = 'promociones';
        } else if (tipoBase === 'COBROS') {
            label     = proceso ? `COBROS — ${proceso}` : 'COBROS';
            tipoClase = 'cobros';
        }

        for (const cod of codigos) {
            const color = cod.color;   // ← sin tocar
            const talla = cod.talla;   // ← sin tocar
            const cant  = Number(cod.cantidad || 0);
            const key   = `${label}||${color}`;

            if (!grupos.has(key)) {
                grupos.set(key, {
                    tipo: label,
                    tipoClase,
                    color,
                    colorHex: colorHex(color),
                    causa: proceso || tipoBase,
                    sinProceso: sinProc,
                    cantidadesPorTalla: {}
                });
            }
            const g = grupos.get(key);
            g.cantidadesPorTalla[talla] = (g.cantidadesPorTalla[talla] || 0) + cant;
        }
    }

    return [...grupos.values()].map(g => new HallazgoDefectoEntity(g));
}

// ─────────────────────────────────────────────────────────────
//  Repositorio principal
// ─────────────────────────────────────────────────────────────
export class LocalStorageCalidadRepository extends IReportRepository {
    async getReportById() {
        const raw = localStorage.getItem('printReporteCalidad');
        if (!raw) throw new Error(
            'No hay datos de reporte. Abre el reporte desde Mis Reportes.'
        );

        let r;
        try {
            r = JSON.parse(raw);
            if (Array.isArray(r)) r = r[0];
        } catch (_) {
            throw new Error('Datos de reporte corruptos.');
        }

        if (!r) throw new Error('Datos de reporte vacíos.');

        // Construir curva y hallazgos
        const curva     = buildCurva(r.curva_extensiones);
        const hallazgos = buildHallazgos(r.novedades_auditoria, curva.tallas);

        // Solo borrar localStorage DESPUÉS de construir todo exitosamente
        localStorage.removeItem('printReporteCalidad');

        return new ReporteCalidadEntity({
            idReporte:   r.id_reporte  || 'S/N',
            fecha:       fmtFecha(r.fecha),
            productora:  r.productora  || String(r.id_productora || '') || 'N/A',
            tipoVisita:  r.tipo_visita || '',
            conclusion:  r.conclusion  || 'SIN CONCLUSIÓN',
            planta:      r.planta      || 'N/A',
            proceso:     r.proceso     || 'N/A',
            op:          r.op          || 'N/A',
            referencia:  r.referencia  || 'N/A',
            linea:       r.linea       || 'N/A',
            prenda:      r.prenda      || 'N/A',
            genero:      r.genero      || 'N/A',
            cantidadTotal:      Number(r.cantidad || 0),
            destinoProceso:     r.destino_proceso || '',
            destinoPlanta:      r.destino_planta  || '',
            fechaDespacho:      r.salida   || 'N/A',
            fechaEntrega:       r.entrada  || 'N/A',
            telefonoPlanta:     'N/A',
            correoNotificacion: r.correo   || 'N/A',
            avancePorcentaje:   Number(r.avance || 0),
            coordenadas:        normalizarCoords(r.localizacion),
            fotoUrl:            r.soporte  || '',
            curva,
            hallazgos,
            observaciones: r.observaciones || '',
            auditor: {
                nombre:          r.auditor_nombre || r.auditor || 'N/A',
                cedula:          r.auditor_cedula || 'N/A',
                cargo:           'Auditor de Calidad — Grupo TDM',
                registroDigital: r.id_reporte || 'AUTH-TDM-OK',
                firmaSvg:        r.auditor_firma  || null,
            },
            representantePlanta: {
                nombre:   r.planta   || 'N/A',
                cedula:   'N/A',
                cargo:    'Representante Planta / Taller Confección',
                firmaSvg: r.firma_svg || null,
            }
        });
    }
}
