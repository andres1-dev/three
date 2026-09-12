import { HtmlCalidadRenderer }   from '../../../../../plantillas/infrastructure/renderers/HtmlCalidadRenderer.js';
import { ReporteCalidadEntity }  from '../../../../../plantillas/core/domain/calidad/ReporteCalidadEntity.js';
import { CurvaProduccionEntity } from '../../../../../plantillas/core/domain/calidad/CurvaProduccionEntity.js';
import { HallazgoDefectoEntity } from '../../../../../plantillas/core/domain/calidad/HallazgoDefectoEntity.js';

const COLOR_HEX_MAP = {
    negro:'#1e293b', blanco:'#f1f5f9', rojo:'#ef4444', azul:'#3b82f6',
    verde:'#22c55e', camel:'#c2944e', crema:'#f5e6c8', gris:'#64748b',
    rosado:'#f472b6', naranja:'#f97316', amarillo:'#eab308', morado:'#8b5cf6',
    fucsia:'#d946ef', café:'#92400e', vinotinto:'#881337'
};

function colorHex(nombre) {
    const k = (nombre || '').toLowerCase();
    for (const [n, h] of Object.entries(COLOR_HEX_MAP)) {
        if (k.includes(n)) return h;
    }
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

function buildCurva(raw) {
    const items = parseJson(raw);
    if (!Array.isArray(items) || !items.length) {
        return new CurvaProduccionEntity({ tallas: [], filas: [] });
    }

    const tallasOrden = [];
    const tallasVistas = new Set();
    items.forEach(i => {
        const t = i.talla;
        if (!tallasVistas.has(t)) { tallasVistas.add(t); tallasOrden.push(t); }
    });

    const colorMap = new Map();
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

const TIPO_CLASE = {
    'SIN CONFECCIONAR': 'sin-confeccionar',
    'PROMOCIONES':      'promociones',
    'COBROS':           'cobros',
    'LAVADO':           'lavado',
};

function buildHallazgos(raw, tallas) {
    const novedades = parseJson(raw);
    if (!Array.isArray(novedades) || !novedades.length) return [];

    const grupos = new Map();

    for (const nov of novedades) {
        const tipoBase  = nov.tipo;
        const sinProc   = nov.sin_proceso === true;
        const proceso   = nov.proceso || '';
        const codigos   = Array.isArray(nov.codigos) ? nov.codigos : [];

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
            const color = cod.color;
            const talla = cod.talla;
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

/**
 * Convierte un reporte de BD en la entidad de dominio ReporteCalidadEntity
 */
export function buildReporteCalidadEntity(r) {
    if (r instanceof ReporteCalidadEntity) return r;

    const curva     = buildCurva(r.curva_extensiones);
    const hallazgos = buildHallazgos(r.novedades_auditoria, curva.tallas);

    return new ReporteCalidadEntity({
        idReporte:   r.id_reporte  || 'S/N',
        fecha:       fmtFecha(r.fecha),
        productora:  r.productora  || String(r.id_productora || '') || 'N/A',
        tipoVisita:  r.tipo_visita || 'AUDITORÍA DE CALIDAD',
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

/**
 * Genera el HTML de calidad-basica.html con los datos del reporte inyectados inline,
 * sin depender de localStorage. Apto para envío por correo y conversión a PDF en GAS.
 * @param {Object} reporte - Datos crudos del reporte desde Supabase
 * @returns {Promise<string>} HTML completo autocontenido
 */
import { generarReporteCalidadHtmlStatico } from './generarReporteCalidadHtmlStatico.js';

export async function generarReporteCalidadHtml(reporte) {
    return generarReporteCalidadHtmlStatico(reporte);
}
