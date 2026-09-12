/**
 * Utilidad para generar mensajes formateados de WhatsApp para los reportes de calidad.
 * Estilo LEGACY: Sin emojis, decorado exclusivamente con markdown nativo de WhatsApp
 * (*negrita*, _cursiva_, > citas, y tablas con comillas simples `...` por fila).
 */

// ── Helpers de formato y padding ─────────────────────────────────────

function padR(str, len) {
    const s = String(str ?? '');
    return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function padL(str, len) {
    const s = String(str ?? '');
    return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

function fmt(val, fallback = '—') {
    if (val === null || val === undefined || val === '' || val === 'N/A' || val === 'null') return fallback;
    return String(val).trim();
}

function parseJsonSafe(raw) {
    if (!raw) return null;
    if (typeof raw !== 'string') return raw;
    try {
        const v = JSON.parse(raw);
        return typeof v === 'string' ? JSON.parse(v) : v;
    } catch (_) {
        return null;
    }
}

function parsearFecha(fechaStr) {
    if (!fechaStr) return null;
    if (fechaStr instanceof Date && !isNaN(fechaStr.getTime())) return fechaStr;

    const s = String(fechaStr).trim();
    if (!s) return null;

    // DD/MM/YYYY o DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        const dia = parseInt(dmy[1], 10);
        const mes = parseInt(dmy[2], 10) - 1;
        const anio = parseInt(dmy[3], 10);
        const d = new Date(anio, mes, dia);
        if (!isNaN(d.getTime())) return d;
    }

    // YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
        const anio = parseInt(ymd[1], 10);
        const mes = parseInt(ymd[2], 10) - 1;
        const dia = parseInt(ymd[3], 10);
        const d = new Date(anio, mes, dia);
        if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatearFechaLarga(fechaStr) {
    const d = parsearFecha(fechaStr);
    if (!d) return fmt(fechaStr);

    try {
        const formatted = d.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (_) {
        return String(fechaStr);
    }
}

export function normalizarTelefonoColombia(telefono) {
    if (!telefono) return '';
    let clean = String(telefono).replace(/[\s\-\(\)\+\.]/g, '');
    if (!clean) return '';
    if (clean.length === 10 && clean.startsWith('3')) {
        clean = '57' + clean;
    }
    return clean;
}

export function generarUrlWhatsApp(telefono, mensaje) {
    const cleanPhone = normalizarTelefonoColombia(telefono);
    const encoded = encodeURIComponent(mensaje);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

function limpiarProductora(val) {
    if (!val || val === 'N/A' || val === 'null') return 'GRUPO TDM';
    const str = String(val).trim();
    if (/^\d+$/.test(str)) return str;
    const stripped = str.replace(/^\s*\d+\s*[-—–]+\s*/, '').trim();
    return stripped || str;
}

function getTituloVisita(tipo) {
    const t = (tipo || '').toUpperCase();
    if (t.includes('RONDA'))       return 'RONDA DE CALIDAD';
    if (t.includes('CONTRAMUESTRA')) return 'CONTRAMUESTRA DE CALIDAD';
    if (t.includes('SEGUIMIENTO')) return 'SEGUIMIENTO DE CALIDAD';
    if (t.includes('APROBACION') || t.includes('APROBACIÓN')) return 'APROBACIÓN DE PLANTA';
    return 'AUDITORÍA DE CALIDAD';
}

// ── 1. Renderizado de Curva (Estilo Legacy: comillas simples por fila) ───

function renderCurvaWhatsAppLegacy(raw) {
    let c = null;
    const rawCurva = raw?.curva_extensiones || raw?.curvaExtensiones || raw?.curva || raw?.extensiones;
    if (rawCurva) {
        try {
            const items = typeof rawCurva === 'string' ? JSON.parse(rawCurva) : rawCurva;
            if (items && Array.isArray(items.tallas) && Array.isArray(items.filas) && items.filas.length) {
                c = items;
            } else if (Array.isArray(items) && items.length) {
                const tallasSet = new Set();
                items.forEach(i => { const t = String(i.talla ?? i.TALLA ?? '').trim(); if (t) tallasSet.add(t); });
                const tallas = Array.from(tallasSet);
                const colorMap = new Map();
                items.forEach(i => {
                    const color = i.color || i.COLOR || 'ÚNICO';
                    const talla = String(i.talla ?? i.TALLA ?? '').trim();
                    const cant  = Number(i.cantidad ?? i.CANTIDAD ?? 0);
                    if (!colorMap.has(color)) colorMap.set(color, { color, cantidades: {} });
                    colorMap.get(color).cantidades[talla] = (colorMap.get(color).cantidades[talla] || 0) + cant;
                });
                c = { tallas, filas: Array.from(colorMap.values()) };
            }
        } catch (_) {}
    }

    if (!c || !c.tallas?.length || !c.filas?.length) {
        return '';
    }

    // Descuentos y anotaciones
    const descuentos = {};
    const anotaciones = {};
    let novRaw = raw?.novedades_auditoria || raw?.novedades;
    if (typeof novRaw === 'string') { try { novRaw = JSON.parse(novRaw); } catch (_) { novRaw = null; } }
    if (Array.isArray(novRaw)) {
        for (const nov of novRaw) {
            const tipoUp = (nov.tipo || '').toUpperCase();
            const esSinConf = tipoUp === 'SIN CONFECCIONAR';
            const esAnot = tipoUp.includes('COBR') || tipoUp.includes('PROMOCI') || tipoUp.includes('LAVADO') || esSinConf;
            for (const cod of (nov.codigos || [])) {
                const k = `${(cod.color || '').toUpperCase()}||${cod.talla}`;
                if (esSinConf) descuentos[k] = (descuentos[k] || 0) + Number(cod.cantidad || 0);
                if (esAnot) {
                    if (!anotaciones[k]) anotaciones[k] = [];
                    anotaciones[k].push({ tipo: nov.tipo, qty: Number(cod.cantidad || 0) });
                }
            }
        }
    }

    const totalDescontado = Object.values(descuentos).reduce((s, v) => s + v, 0);
    const totalCobros    = Object.values(anotaciones).flat().filter(a => (a.tipo||'').toUpperCase().includes('COBR')).reduce((s,a)=>s+a.qty,0);
    const totalPromos    = Object.values(anotaciones).flat().filter(a => (a.tipo||'').toUpperCase().includes('PROMOCI')).reduce((s,a)=>s+a.qty,0);
    const totalLavados   = Object.values(anotaciones).flat().filter(a => (a.tipo||'').toUpperCase().includes('LAVADO')).reduce((s,a)=>s+a.qty,0);

    const badgeParts = [];
    if (totalDescontado > 0) badgeParts.push(`S/C: ${totalDescontado}`);
    if (totalCobros    > 0) badgeParts.push(`Cobro: ${totalCobros}`);
    if (totalPromos    > 0) badgeParts.push(`Promo: ${totalPromos}`);
    if (totalLavados   > 0) badgeParts.push(`Lavado: ${totalLavados}`);

    let res = '*CURVA DE PRODUCCIÓN:*\n\n';
    if (badgeParts.length > 0) {
        res += `_${badgeParts.join(' | ')}_\n`;
    }

    const tallas = c.tallas;
    const maxColorLen = Math.max(5, ...c.filas.map(f => String(f.color || f.COLOR || '').length));
    const colColorW = Math.min(maxColorLen, 10);
    const colTallaW = 4;
    const colTotW   = 4;

    const hColor = padR('COLOR', colColorW);
    const hTallas = tallas.map(t => padL(t, colTallaW)).join(' |');
    res += `\`${hColor} | ${hTallas} | ${padL('TOT', colTotW)}\`\n`;

    let granTotal = 0;
    c.filas.forEach(f => {
        const colorKey = (f.color || f.COLOR || '').toUpperCase();
        let totalFila = 0;
        const celdas = tallas.map(t => {
            const qR = Number(f.cantidades?.[t] ?? f.cantidadesPorTalla?.[t] ?? f[t] ?? 0);
            const desc = descuentos[`${colorKey}||${t}`] || 0;
            const qA = Math.max(0, qR - desc);
            totalFila += qA;
            return padL(qA > 0 ? qA : '—', colTallaW);
        }).join(' |');
        granTotal += totalFila;
        const colorName = padR(f.color || f.COLOR || 'ÚNICO', colColorW);
        res += `\`${colorName} | ${celdas} | ${padL(totalFila, colTotW)}\`\n`;
    });

    const totPorTalla = tallas.map(t => {
        const tot = c.filas.reduce((acc, f) => {
            const colorKey = (f.color || f.COLOR || '').toUpperCase();
            const qR = Number(f.cantidades?.[t] ?? f.cantidadesPorTalla?.[t] ?? f[t] ?? 0);
            const desc = descuentos[`${colorKey}||${t}`] || 0;
            return acc + Math.max(0, qR - desc);
        }, 0);
        return padL(tot, colTallaW);
    }).join(' |');

    res += `\`${padR('TOTAL', colColorW)} | ${totPorTalla} | ${padL(granTotal, colTotW)}\`\n\n`;

    return res;
}

// ── 2. Renderizado de Hallazgos (Estilo Legacy: comillas simples por fila) 

function renderHallazgosWhatsAppLegacy(raw) {
    let items = [];
    let novRaw = raw?.novedades_auditoria || raw?.novedades;
    if (typeof novRaw === 'string') { try { novRaw = JSON.parse(novRaw); } catch (_) { novRaw = null; } }
    if (Array.isArray(novRaw) && novRaw.length) {
        items = novRaw.map((n, i) => {
            const cods = Array.isArray(n.codigos) ? n.codigos : [];
            const sumaCods = cods.reduce((s, c) => s + (Number(c.cantidad) || 0), 0);
            const total = Number(n.totalUnidades || n.defectuosas || n.cantidad || (sumaCods > 0 ? sumaCods : 1));
            return {
                idx: i + 1,
                tipo: n.tipo || 'HALLAZGO',
                proceso: n.proceso || null,
                sin_proceso: !!n.sin_proceso,
                codigos: cods,
                color: n.color || '—',
                total: total
            };
        });
    }

    if (!items.length) {
        return '';
    }

    let res = '*HALLAZGOS CUANTITATIVOS:*\n\n';

    // Agrupar consecutivos por tipo
    const grupos = [];
    for (const it of items) {
        const last = grupos[grupos.length - 1];
        if (last && last.tipo === it.tipo) { last.entries.push(it); last.total += Number(it.total) || 0; }
        else grupos.push({ tipo: it.tipo, idx: it.idx, entries: [it], total: Number(it.total) || 0 });
    }

    grupos.forEach((g, idx) => {
        const allCodigos = g.entries.flatMap(e => (e.codigos && e.codigos.length ? e.codigos : [{ color: e.color, talla: '—', cantidad: e.total }]));
        const totalUnds = g.total;

        res += `*${idx + 1}. ${g.tipo.toUpperCase()}* *(${totalUnds} unds.)*\n`;

        const maxColorLength = Math.max(5, ...allCodigos.map(c => String(c.color || '-').length));
        const maxTallaLength = Math.max(5, ...allCodigos.map(c => String(c.talla || '-').length));

        const hTalla = 'TALLA'.padEnd(maxTallaLength, ' ');
        const hColor = 'COLOR'.padEnd(maxColorLength, ' ');
        res += `\`${hTalla} | ${hColor} | CANT\`\n`;

        allCodigos.forEach(c => {
            const talla = String(c.talla || '-').padEnd(maxTallaLength, ' ');
            const color = String(c.color || '-').padEnd(maxColorLength, ' ');
            const cant  = String(c.cantidad || '0');
            res += `\`${talla} | ${color} | ${cant}\`\n`;
        });

        res += '\n';
    });

    return res;
}

// ── 3. Reporte Individual al Taller (Estilo Legacy estricto) ─────────

/**
 * Genera el mensaje individual para enviar al taller por WhatsApp (sin emojis, estilo Legacy).
 * @param {Object} reporte - Datos del reporte
 * @returns {string} Mensaje formateado para WhatsApp
 */
export function generarMensajeWhatsAppCalidad(reporte) {
    if (!reporte) return '';

    const r = {};
    for (const k in reporte) {
        if (Object.prototype.hasOwnProperty.call(reporte, k)) {
            r[k.toLowerCase()] = reporte[k];
        }
    }

    const radicado = r.id_reporte || r.idreporte || r.id || 'S/N';
    const tallerNombre = (r.planta || r.nombre_planta || r.productora || 'TALLER DE CONFECCIÓN').trim().toUpperCase();
    const tituloVisita = getTituloVisita(r.tipo_visita || r.tipovisita);
    const conclusion   = (r.conclusion || 'PENDIENTE').trim().toUpperCase();
    const fechaLarga   = formatearFechaLarga(r.fecha);

    const proceso    = (r.proceso || 'N/A').trim().toUpperCase();
    const referencia = r.referencia || 'N/A';
    const lote       = r.op || r.lote || r.id || 'N/A';

    // Descontar sin confeccionar
    const cantidadBase = Number(r.cantidad || r.cantidadtotal || 0);
    let sinConf = 0;
    const novD = parseJsonSafe(r.novedades_auditoria || r.novedades) || [];
    if (Array.isArray(novD)) {
        for (const n of novD) {
            if ((n.tipo || '').toUpperCase() === 'SIN CONFECCIONAR') {
                sinConf += (n.codigos || []).reduce((s, c) => s + Number(c.cantidad || 0), 0);
            }
        }
    }
    const cantidadFinal = cantidadBase > 0 ? Math.max(0, cantidadBase - sinConf) : cantidadBase;

    const destino = r.destino_proceso && r.destino_proceso !== 'N/A' ? r.destino_proceso.toUpperCase() : null;
    let lugar = r.destino_planta && r.destino_planta !== 'N/A' ? r.destino_planta.toUpperCase() : null;
    if (lugar === 'CDI') lugar = 'CDI (CENTRO DE DISTRIBUCION)';

    // Construcción del mensaje (idéntico a enviarWhatsAppIndividual de Legacy)
    let message = '';
    message += `*${tituloVisita}*\n`;
    message += `*\`${tallerNombre}\`*\n`;
    message += `*${fechaLarga}*\n\n`;

    message += '*Conclusión:*\n';
    message += `> ${conclusion}\n\n`;

    message += `*Radicado:* #${radicado}\n`;
    message += `*Proceso:* ${proceso}\n`;
    message += `*Referencia:* ${referencia}\n`;
    message += `*OP / Lote:* ${lote}\n`;
    message += `*Cantidad:* ${cantidadFinal}\n`;

    if (destino && destino !== 'N/A') {
        message += `*Destino:* ${destino}\n`;
    }
    if (lugar && lugar !== 'N/A') {
        message += `*Lugar:* ${lugar}\n`;
    }

    message += '\n';

    // Hallazgos tabulados con comillas simples por fila
    const hallazgosTxt = renderHallazgosWhatsAppLegacy(reporte);
    if (hallazgosTxt) {
        message += hallazgosTxt;
    }

    // Curva tabulada con comillas simples por fila
    const curvaTxt = renderCurvaWhatsAppLegacy(reporte);
    if (curvaTxt) {
        message += curvaTxt;
    }

    // Observaciones
    const observaciones = (r.observaciones || r.comentarios || '').trim();
    message += '*OBSERVACIONES GENERALES:*\n\n';
    if (observaciones) {
        message += `_${observaciones}_\n\n`;
    } else {
        message += '_Sin observaciones adicionales._\n\n';
    }

    // Auditor
    const auditorNombre = r.auditor || r.auditor_nombre || r.auditor_nombre_completo;
    const auditorCedula = r.auditor_cedula || r.cedula_auditor;
    if (auditorNombre) {
        message += `*Auditor:* ${auditorNombre}${auditorCedula ? ` (${auditorCedula})` : ''}\n`;
    }

    return message;
}

// ── 4. Consolidado del Día (Estilo Legacy: enviarWhatsApp de mis-reportes) ─

/**
 * Genera el reporte consolidado del día para WhatsApp agrupado por Productora (estilo Legacy).
 * @param {Object} options
 * @param {Array} options.reportes - Lista de reportes del día
 * @param {Object} options.currentUser - Usuario/auditor logueado
 * @param {string|Date} options.fecha - Fecha del filtro
 * @returns {string} Mensaje consolidado formateado para WhatsApp
 */
export function generarConsolidadoDiarioWhatsApp({ reportes = [], currentUser = {}, fecha = null }) {
    if (!reportes || !reportes.length) return '';

    const auditorNombre = (currentUser?.nombre || currentUser?.NOMBRE || currentUser?.name || currentUser?.full_name || 'Auditor').trim().toUpperCase();
    const fechaLarga = formatearFechaLarga(fecha || new Date());

    let message = '*MI REPORTE DIARIO:*\n\n';
    message += `*\`${auditorNombre}\`*\n`;
    message += `*${fechaLarga}*\n\n`;

    message += '*Total Reportes:*\n';
    message += `> ${reportes.length}\n\n`;

    // Agrupar por productora
    const productoraGroups = {};
    reportes.forEach(r => {
        const prod = limpiarProductora(r.productora || r.PRODUCTORA || r.nombre_productora);
        if (!productoraGroups[prod]) productoraGroups[prod] = [];
        productoraGroups[prod].push(r);
    });

    Object.keys(productoraGroups).forEach(productoraNombre => {
        const reps = productoraGroups[productoraNombre];
        if (!reps.length) return;

        message += `*${productoraNombre.toUpperCase()} (${reps.length})*\n\n`;

        reps.forEach((r, idx) => {
            const planta     = r.planta || r.PLANTA || r.nombre_planta || 'SIN PLANTA';
            const lote       = r.op || r.lote || r.id_reporte || r.id || r.ID || 'N/A';
            const referencia = r.referencia || r.REFERENCIA || 'N/A';
            const cantidad   = r.cantidad || r.CANTIDAD || r.cant || 'N/A';
            const conclusion = (r.conclusion || r.CONCLUSION || 'PENDIENTE').trim().toUpperCase();
            const comentarios = (r.observaciones || r.comentarios || r.COMENTARIOS || '').trim();

            message += `*${idx + 1}.* *${planta.toUpperCase()}*\n`;
            message += `*Lote:* ${lote}\n`;
            message += `*Referencia:* ${referencia}\n`;
            message += `*Cantidad:* ${cantidad}\n\n`;

            message += '*Conclusión:*\n';
            message += `> ${conclusion}\n\n`;

            if (comentarios) {
                message += '*Comentarios:*\n';
                message += `_${comentarios}_\n`;
            }

            message += '\n━━━━━━━━━━━━━━━━━━\n\n';
        });
    });

    message += 'Muchas gracias por la atención prestada.';
    return message;
}
