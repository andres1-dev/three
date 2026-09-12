/**
 * Genera HTML completamente estático del reporte de calidad (sin scripts, sin imports).
 * Con los SVGs vectoriales originales de FontAwesome incrustados (sin emojis ni dependencias externas).
 * Apto para visualización directa como .html o conversión a PDF.
 */

// ── FontAwesome SVGs Oficiales (Free 6.5.2) ───────────────────────────

const FA_ICONS = {
    'user-check': {
        vb: '0 0 640 512',
        d: 'M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM625 177L497 305c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L591 143c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z'
    },
    'store': {
        vb: '0 0 576 512',
        d: 'M547.6 103.8L490.3 13.1C485.2 5 476.1 0 466.4 0H109.6C99.9 0 90.8 5 85.7 13.1L28.3 103.8c-29.6 46.8-3.4 111.9 51.9 119.4c4 .5 8.1 .8 12.1 .8c26.1 0 49.3-11.4 65.2-29c15.9 17.6 39.1 29 65.2 29c26.1 0 49.3-11.4 65.2-29c15.9 17.6 39.1 29 65.2 29c26.2 0 49.3-11.4 65.2-29c16 17.6 39.1 29 65.2 29c4.1 0 8.1-.3 12.1-.8c55.5-7.4 81.8-72.5 52.1-119.4zM499.7 254.9l-.1 0c-5.3 .7-10.7 1.1-16.2 1.1c-12.4 0-24.3-1.9-35.4-5.3V384H128V250.6c-11.2 3.5-23.2 5.4-35.6 5.4c-5.5 0-11-.4-16.3-1.1l-.1 0c-4.1-.6-8.1-1.3-12-2.3V384v64c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V384 252.6c-4 1-8 1.8-12.3 2.3z'
    },
    'clipboard-list': {
        vb: '0 0 384 512',
        d: 'M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM72 272a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zm104-16H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16zM72 368a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zm88 0c0-8.8 7.2-16 16-16H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16z'
    },
    'truck-ramp-box': {
        vb: '0 0 640 512',
        d: 'M640 0V400c0 61.9-50.1 112-112 112c-61 0-110.5-48.7-112-109.3L48.4 502.9c-17.1 4.6-34.6-5.4-39.3-22.5s5.4-34.6 22.5-39.3L352 353.8V64c0-35.3 28.7-64 64-64H640zM576 400a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM23.1 207.7c-4.6-17.1 5.6-34.6 22.6-39.2l46.4-12.4 20.7 77.3c2.3 8.5 11.1 13.6 19.6 11.3l30.9-8.3c8.5-2.3 13.6-11.1 11.3-19.6l-20.7-77.3 46.4-12.4c17.1-4.6 34.6 5.6 39.2 22.6l41.4 154.5c4.6 17.1-5.6 34.6-22.6 39.2L103.7 384.9c-17.1 4.6-34.6-5.6-39.2-22.6L23.1 207.7z'
    },
    'layer-group': {
        vb: '0 0 576 512',
        d: 'M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z'
    },
    'scissors': {
        vb: '0 0 512 512',
        d: 'M256 192l-39.5-39.5c4.9-12.6 7.5-26.2 7.5-40.5C224 50.1 173.9 0 112 0S0 50.1 0 112s50.1 112 112 112c14.3 0 27.9-2.7 40.5-7.5L192 256l-39.5 39.5c-12.6-4.9-26.2-7.5-40.5-7.5C50.1 288 0 338.1 0 400s50.1 112 112 112s112-50.1 112-112c0-14.3-2.7-27.9-7.5-40.5L499.2 76.8c7.1-7.1 7.1-18.5 0-25.6c-28.3-28.3-74.1-28.3-102.4 0L256 192zm22.6 150.6L396.8 460.8c28.3 28.3 74.1 28.3 102.4 0c7.1-7.1 7.1-18.5 0-25.6L342.6 278.6l-64 64zM64 112a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm48 240a48 48 0 1 1 0 96 48 48 0 1 1 0-96z'
    },
    'money-bill': {
        vb: '0 0 576 512',
        d: 'M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm64 320H64V320c35.3 0 64 28.7 64 64zM64 192V128h64c0 35.3-28.7 64-64 64zM448 384c0-35.3 28.7-64 64-64v64H448zm64-192c-35.3 0-64-28.7-64-64h64v64zM288 160a96 96 0 1 1 0 192 96 96 0 1 1 0-192z'
    },
    'tag': {
        vb: '0 0 448 512',
        d: 'M0 80V229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7H48C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'
    },
    'droplet': {
        vb: '0 0 384 512',
        d: 'M192 512C86 512 0 426 0 320C0 228.8 130.2 57.7 166.6 11.7C172.6 4.2 181.5 0 191.1 0h1.8c9.6 0 18.5 4.2 24.5 11.7C253.8 57.7 384 228.8 384 320c0 106-86 192-192 192zM96 336c0-8.8-7.2-16-16-16s-16 7.2-16 16c0 61.9 50.1 112 112 112c8.8 0 16-7.2 16-16s-7.2-16-16-16c-44.2 0-80-35.8-80-80z'
    },
    'circle-dot': {
        vb: '0 0 512 512',
        d: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-352a96 96 0 1 1 0 192 96 96 0 1 1 0-192z'
    },
    'triangle-exclamation': {
        vb: '0 0 512 512',
        d: 'M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z'
    },
    'clipboard-check': {
        vb: '0 0 384 512',
        d: 'M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM305 273L177 401c-9.4 9.4-24.6 9.4-33.9 0L79 337c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L271 239c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z'
    },
    'comment-dots': {
        vb: '0 0 512 512',
        d: 'M256 448c141.4 0 256-93.1 256-208S397.4 32 256 32S0 125.1 0 240c0 45.1 17.7 86.8 47.7 120.9c-1.9 24.5-11.4 46.3-21.4 62.9c-5.5 9.2-11.1 16.6-15.2 21.6c-2.1 2.5-3.7 4.4-4.9 5.7c-.6 .6-1 1.1-1.3 1.4l-.3 .3 0 0 0 0 0 0 0 0c-4.6 4.6-5.9 11.4-3.4 17.4c2.5 6 8.3 9.9 14.8 9.9c28.7 0 57.6-8.9 81.6-19.3c22.9-10 42.4-21.9 54.3-30.6c31.8 11.5 67 17.9 104.1 17.9zM128 208a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm128 0a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm96 32a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z'
    },
    'signature': {
        vb: '0 0 640 512',
        d: 'M192 128c0-17.7 14.3-32 32-32s32 14.3 32 32v7.8c0 27.7-2.4 55.3-7.1 82.5l-84.4 25.3c-40.6 12.2-68.4 49.6-68.4 92v71.9c0 40 32.5 72.5 72.5 72.5c26 0 50-13.9 62.9-36.5l13.9-24.3c26.8-47 46.5-97.7 58.4-150.5l94.4-28.3-12.5 37.5c-3.3 9.8-1.6 20.5 4.4 28.8s15.7 13.3 26 13.3H544c17.7 0 32-14.3 32-32s-14.3-32-32-32H460.4l18-53.9c3.8-11.3 .9-23.8-7.4-32.4s-20.7-11.8-32.2-8.4L316.4 198.1c2.4-20.7 3.6-41.4 3.6-62.3V128c0-53-43-96-96-96s-96 43-96 96v32c0 17.7 14.3 32 32 32s32-14.3 32-32V128zm-9.2 177l49-14.7c-10.4 33.8-24.5 66.4-42.1 97.2l-13.9 24.3c-1.5 2.6-4.3 4.3-7.4 4.3c-4.7 0-8.5-3.8-8.5-8.5V335.6c0-14.1 9.3-26.6 22.8-30.7zM24 368c-13.3 0-24 10.7-24 24s10.7 24 24 24H64.3c-.2-2.8-.3-5.6-.3-8.5V368H24zm592 48c13.3 0 24-10.7 24-24s-10.7-24-24-24H305.9c-6.7 16.3-14.2 32.3-22.3 48H616z'
    }
};

function faSvg(name, extraStyle = '', size = 13, defaultColor = '#3f51b5') {
    const icon = FA_ICONS[name];
    if (!icon) return '';

    let fillColor = defaultColor;
    const colorMatch = extraStyle.match(/color\s*:\s*([^;]+)/i);
    if (colorMatch) {
        fillColor = colorMatch[1].trim();
    }

    let iconSize = size;
    const sizeMatch = extraStyle.match(/(?:font-size|width|height)\s*:\s*(\d+(?:\.\d+)?)(px|pt)?/i);
    if (sizeMatch) {
        const val = parseFloat(sizeMatch[1]);
        if (sizeMatch[2] === 'pt') {
            iconSize = Math.max(9, Math.round(val * 1.33));
        } else if (sizeMatch[2] === 'px' || !sizeMatch[2]) {
            iconSize = Math.max(9, Math.round(val));
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.vb}" width="${iconSize}" height="${iconSize}" class="fa-svg" style="width:${iconSize}px;height:${iconSize}px;vertical-align:-0.15em;fill:${fillColor};display:inline-block;${extraStyle}" aria-hidden="true"><path fill="${fillColor}" d="${icon.d}"/></svg>`;
}

// ── Helpers ─────────────────────────────────────────────────────────

function fmt(val, fallback = '—') {
    if (val === null || val === undefined || val === '' || val === 'N/A' || val === 'null') return fallback;
    return String(val).trim();
}

function parseJsonSafe(raw) {
    if (!raw) return null;
    if (typeof raw !== 'string') return raw;
    try { const v = JSON.parse(raw); return typeof v === 'string' ? JSON.parse(v) : v; } catch (_) { return null; }
}

function fmtFecha(raw) {
    if (!raw) return '—';
    try {
        const d = new Date(String(raw).replace(' ', 'T'));
        if (isNaN(d)) return String(raw);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (_) { return String(raw); }
}

function getEstadoBadge(conclusion) {
    const c = (conclusion || '').toUpperCase().trim();
    if (c === 'APROBADO')  return { cls: 'aprobado',  text: 'APROBADO' };
    if (c === 'RECHAZADO') return { cls: 'rechazado', text: 'RECHAZADO' };
    if (c === 'PAUSADO')   return { cls: 'pausado',   text: 'PAUSADO' };
    return { cls: 'pending', text: c || 'PENDIENTE' };
}

function getTituloVisita(tipo) {
    const t = (tipo || '').toUpperCase();
    if (t.includes('RONDA'))       return 'RONDA DE CALIDAD';
    if (t.includes('CONTRAMUESTRA')) return 'CONTRAMUESTRA DE CALIDAD';
    if (t.includes('SEGUIMIENTO')) return 'SEGUIMIENTO DE CALIDAD';
    if (t.includes('APROBACION') || t.includes('APROBACIÓN')) return 'APROBACIÓN DE PLANTA';
    return 'AUDITORÍA DE CALIDAD';
}

function limpiarProductora(val) {
    if (!val || val === 'N/A' || val === 'null') return '—';
    const str = String(val).trim();
    if (/^\d+$/.test(str)) return str;
    const stripped = str.replace(/^\s*\d+\s*[-—–]+\s*/, '').trim();
    return stripped || str;
}

function renderFirmaHtml(firma, fallbackText = 'Firma Digital') {
    if (!firma) return `<span style="color:#94a3b8;font-size:7.5pt;font-style:italic;">${fallbackText}</span>`;
    let f = String(firma).trim();
    if (!f || f === 'null' || f === 'undefined') return `<span style="color:#94a3b8;font-size:7.5pt;font-style:italic;">${fallbackText}</span>`;
    if (f.startsWith('<svg') || f.includes('<svg')) {
        const match = f.match(/<svg[\s\S]*<\/svg>/i);
        let svg = match ? match[0] : f;
        // Rescatar viewBox a partir de width/height si no lo tiene
        if (!svg.includes('viewBox') && !svg.includes('viewbox')) {
            const wM = svg.match(/width=["'](\d+(?:\.\d+)?)["']/i);
            const hM = svg.match(/height=["'](\d+(?:\.\d+)?)["']/i);
            if (wM && hM) svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${wM[1]} ${hM[1]}"`);
        }
        // Eliminar atributos width/height absolutos para que el CSS controle el tamaño
        svg = svg.replace(/\s+width=["'][^"']*["']/gi, '').replace(/\s+height=["'][^"']*["']/gi, '');
        return svg.replace(/<svg/i, '<svg style="max-height:46px;max-width:160px;width:auto;height:auto;display:inline-block;"');
    }
    if (f.startsWith('data:') || f.startsWith('http')) {
        return `<img src="${f}" alt="Firma" style="max-height:46px;max-width:160px;object-fit:contain;display:inline-block;">`;
    }
    return `<span style="color:#94a3b8;font-size:7.5pt;font-style:italic;">${fallbackText}</span>`;
}

// ── Rendering de Curva ───────────────────────────────────────────────

function renderCurvaStatico(raw) {
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
        return `<div class="section-card"><div class="section-header"><h4>${faSvg('layer-group')} Curva de Producción</h4></div><div class="empty-msg">Sin registro de curva para esta OP.</div></div>`;
    }

    // Calcular descuentos y anotaciones
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
    const tallas = c.tallas;
    const thTallas = tallas.map(t => `<th>${t}</th>`).join('');

    let granTotalActual = 0;

    const iconMapCurva = {
        'SIN CONF': faSvg('scissors', 'font-size:7pt;color:#64748b;'),
        COBR:       faSvg('money-bill', 'font-size:7pt;color:#64748b;'),
        PROMOCI:    faSvg('tag', 'font-size:7pt;color:#64748b;'),
        LAVADO:     faSvg('droplet', 'font-size:7pt;color:#64748b;')
    };

    const rows = c.filas.map(f => {
        const colorKey = (f.color || f.COLOR || '').toUpperCase();
        let totalActual = 0;
        const celdas = tallas.map(t => {
            const qR   = Number(f.cantidades?.[t] ?? f.cantidadesPorTalla?.[t] ?? f[t] ?? 0);
            const desc = descuentos[`${colorKey}||${t}`] || 0;
            const qA   = Math.max(0, qR - desc);
            totalActual += qA;
            const anots = anotaciones[`${colorKey}||${t}`];
            if (anots?.length) {
                const anotTxt = anots.map(a => {
                    const tipoUp = (a.tipo || '').toUpperCase();
                    const ic = Object.entries(iconMapCurva).find(([k]) => tipoUp.includes(k))?.[1] || faSvg('circle-dot', 'font-size:7pt;color:#64748b;');
                    return `<span style="display:inline-flex;align-items:center;gap:2px;font-size:6.5pt;">${ic}<span style="color:#cbd5e1;font-weight:600;">${a.qty}</span></span>`;
                }).join('');
                const valorStr = desc > 0
                    ? `${qA > 0 ? qA : '—'} <span style="text-decoration:line-through;color:#cbd5e1;font-size:7pt;font-weight:400;">${qR}</span>`
                    : (qA > 0 ? qA : '—');
                return `<td style="background:#f8fafc;padding:2px 4px;"><span style="display:flex;align-items:center;gap:3px;justify-content:center;flex-wrap:wrap;">${anotTxt}</span><span style="display:block;font-weight:700;color:#334155;font-size:8.5pt;line-height:1.3;text-align:center;">${valorStr}</span></td>`;
            }
            return `<td style="font-weight:${qA > 0 ? '700' : '400'};color:${qA > 0 ? '#1e40af' : 'inherit'};">${qA > 0 ? qA : '—'}</td>`;
        }).join('');
        granTotalActual += totalActual;
        return `<tr><td style="text-align:left;font-weight:600;">${fmt(f.color || f.COLOR)}</td>${celdas}<td style="font-weight:700;color:#3f51b5;">${totalActual}</td></tr>`;
    }).join('');

    const totalesPorTalla = tallas.map(t => {
        const tot = c.filas.reduce((acc, f) => {
            const colorKey = (f.color || f.COLOR || '').toUpperCase();
            const qR = Number(f.cantidades?.[t] ?? f.cantidadesPorTalla?.[t] ?? f[t] ?? 0);
            const desc = descuentos[`${colorKey}||${t}`] || 0;
            return acc + Math.max(0, qR - desc);
        }, 0);
        return `<td>${tot}</td>`;
    }).join('');

    // Badge consolidado
    const totalCobros  = Object.values(anotaciones).flat().filter(a => (a.tipo||'').toUpperCase().includes('COBR')).reduce((s,a)=>s+a.qty,0);
    const totalPromos  = Object.values(anotaciones).flat().filter(a => (a.tipo||'').toUpperCase().includes('PROMOCI')).reduce((s,a)=>s+a.qty,0);
    const totalLavados = Object.values(anotaciones).flat().filter(a => (a.tipo||'').toUpperCase().includes('LAVADO')).reduce((s,a)=>s+a.qty,0);
    const badgeParts = [];
    if (totalDescontado > 0) badgeParts.push(`<span style="display:inline-flex;align-items:center;gap:3px;">${faSvg('scissors', 'color:#64748b;font-size:7pt;')}<span style="color:#64748b;font-size:7pt;font-weight:600;">S/C: ${totalDescontado}</span></span>`);
    if (totalCobros    > 0) badgeParts.push(`<span style="display:inline-flex;align-items:center;gap:3px;">${faSvg('money-bill', 'color:#64748b;font-size:7pt;')}<span style="color:#64748b;font-size:7pt;font-weight:600;">Cobro: ${totalCobros}</span></span>`);
    if (totalPromos    > 0) badgeParts.push(`<span style="display:inline-flex;align-items:center;gap:3px;">${faSvg('tag', 'color:#64748b;font-size:7pt;')}<span style="color:#64748b;font-size:7pt;font-weight:600;">Promo: ${totalPromos}</span></span>`);
    if (totalLavados   > 0) badgeParts.push(`<span style="display:inline-flex;align-items:center;gap:3px;">${faSvg('droplet', 'color:#64748b;font-size:7pt;')}<span style="color:#64748b;font-size:7pt;font-weight:600;">Lavado: ${totalLavados}</span></span>`);
    const badgeHtml = badgeParts.length
        ? `<span class="badge-info">${badgeParts.join('<span style="color:#e2e8f0;">|</span>')}</span>`
        : '';

    return `
        <div class="section-card">
            <div class="section-header">
                <h4>${faSvg('layer-group')} Curva de Producción</h4>
                ${badgeHtml}
            </div>
            <table class="liquidacion-table">
                <thead><tr><th style="text-align:left;min-width:110px;">Color</th>${thTallas}<th style="min-width:60px;">Total</th></tr></thead>
                <tbody>
                    ${rows}
                    <tr class="total-row"><td style="text-align:left;">TOTAL</td>${totalesPorTalla}<td>${granTotalActual}</td></tr>
                </tbody>
            </table>
        </div>`;
}

// ── Rendering de Hallazgos ───────────────────────────────────────────

function renderHallazgosStatico(raw) {
    let items = [];
    let novRaw = raw?.novedades_auditoria || raw?.novedades;
    if (typeof novRaw === 'string') { try { novRaw = JSON.parse(novRaw); } catch (_) { novRaw = null; } }
    if (Array.isArray(novRaw) && novRaw.length) {
        items = novRaw.map((n, i) => ({
            idx: i + 1,
            tipo: n.tipo || 'HALLAZGO',
            proceso: n.proceso || null,
            sin_proceso: !!n.sin_proceso,
            codigos: Array.isArray(n.codigos) ? n.codigos : [],
            color: n.color || '—',
            total: Number(n.totalUnidades || n.defectuosas || n.cantidad || 1)
        }));
    }

    if (!items.length) {
        return `<div class="section-card"><div class="section-header"><h4>${faSvg('clipboard-check')} Hallazgos de Calidad</h4></div><div class="empty-msg">No se registraron defectos ni novedades en este lote. Auditoría conforme.</div></div>`;
    }

    const totalDefectos = items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const totalPrendas  = Number(raw?.cantidad || 0);
    const tasaGlobal    = totalPrendas > 0 ? ((totalDefectos / totalPrendas) * 100).toFixed(2) + '%' : '—';

    const grupos = [];
    for (const it of items) {
        const last = grupos[grupos.length - 1];
        if (last && last.tipo === it.tipo) { last.entries.push(it); last.total += Number(it.total) || 0; }
        else grupos.push({ tipo: it.tipo, idx: it.idx, entries: [it], total: Number(it.total) || 0 });
    }

    const rowsHtml = grupos.map(g => {
        const subFilas = [];
        for (const entry of g.entries) {
            const proceso = entry.sin_proceso ? 'SIN PROCESO' : (entry.proceso || '');
            const codigos = entry.codigos?.length ? entry.codigos : [{ color: entry.color, talla: '—', cantidad: entry.total }];
            const tipoUpper = String(entry.tipo || g.tipo || '').toUpperCase().trim();
            const isPromocion = tipoUpper.includes('PROMOCI');
            const isCobro = tipoUpper.includes('COBR');

            codigos.forEach((c, ci) => {
                const procesoCell = ci === 0 ? proceso : '';
                const procCellUpper = String(procesoCell).toUpperCase().trim();
                const cellHasData = procCellUpper !== '' && procCellUpper !== '—';

                let isRowHighlighted = false;
                if (cellHasData) {
                    if (isPromocion && procCellUpper === 'SIN PROCESO') {
                        isRowHighlighted = true;
                    } else if (isCobro && procCellUpper !== 'SIN PROCESO') {
                        isRowHighlighted = true;
                    }
                }

                subFilas.push({
                    isFirstOfGroup: subFilas.length === 0,
                    proceso: procesoCell,
                    color: c.color || '—',
                    talla: c.talla || '—',
                    cantidad: Number(c.cantidad) || 0,
                    isHighlighted: isRowHighlighted
                });
            });
        }
        return subFilas.map((sf, si) => {
            const isFirst = si === 0;
            const hlClass = sf.isHighlighted ? 'td-highlight' : '';
            const tdClasif = isFirst ? `<td rowspan="${subFilas.length}" style="font-weight:700;text-transform:uppercase;font-size:7.5pt;text-align:left;vertical-align:middle;border-right:1px solid var(--color-border);">${fmt(g.tipo)}</td>` : '';
            const tdTotal  = isFirst ? `<td rowspan="${subFilas.length}" style="font-weight:800;vertical-align:middle;text-align:center;">${g.total}</td>` : '';
            return `<tr>${tdClasif}<td class="${hlClass}" style="text-align:center;font-size:7.5pt;color:#475569;">${sf.proceso ? `<strong>${sf.proceso}</strong>` : ''}</td><td class="${hlClass}" style="font-weight:600;text-transform:uppercase;">${fmt(sf.color)}</td><td class="${hlClass}" style="text-align:center;font-weight:600;">${sf.talla}</td><td class="${hlClass}" style="text-align:center;">${sf.cantidad}</td>${tdTotal}</tr>`;
        }).join('');
    }).join('');

    return `
        <div class="section-card">
            <div class="section-header">
                <h4>${faSvg('triangle-exclamation')} Hallazgos de Calidad</h4>
                <span class="badge-info">Afectación: ${totalDefectos} prendas${tasaGlobal !== '—' ? ` (${tasaGlobal})` : ''}</span>
            </div>
            <table class="liquidacion-table">
                <thead><tr><th style="text-align:left;min-width:120px;">Clasificación</th><th style="min-width:80px;text-align:center;">Proceso</th><th style="min-width:70px;">Color</th><th style="width:50px;text-align:center;">Talla</th><th style="width:50px;text-align:center;">Cant.</th><th style="width:50px;text-align:center;">Total</th></tr></thead>
                <tbody>
                    ${rowsHtml}
                    <tr class="total-row"><td colspan="5" style="text-align:right;">TOTAL HALLAZGOS:</td><td style="text-align:center;">${totalDefectos}</td></tr>
                </tbody>
            </table>
        </div>`;
}

// ── CSS inline ───────────────────────────────────────────────────────

const CSS = `
    *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size:9pt; color:#1e293b; background:#fff; line-height:1.4; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .sheet { width:100%; max-width:794px; margin:0 auto; padding:8mm 10mm; background:#ffffff; box-sizing:border-box; }
    .header-block { margin-bottom:.8rem; padding:.75rem 1rem; background:#fff; border:2px solid #3f51b5; border-radius:8px; }
    .header-title { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.5rem; padding-bottom:.5rem; border-bottom:1px solid #e2e8f0; }
    .header-title-left { display:flex; align-items:flex-start; gap:10px; }
    .header-logo-svg { width:40px; height:40px; display:block; flex-shrink:0; }
    .header-title h2 { font-size:11.5pt; font-weight:800; color:#3f51b5; margin:0; text-transform:uppercase; letter-spacing:.6px; }
    .header-prod-name { font-size:8pt; font-weight:700; color:#334155; text-transform:uppercase; margin-top:2px; }
    .header-prod-nit { font-size:7pt; font-weight:600; color:#64748b; margin-top:1px; }
    .header-data { display:table; width:100%; table-layout:fixed; }
    .header-data p { display:table-cell; vertical-align:middle; width:33.33%; margin:0; font-size:8.5pt; font-weight:700; color:#1e293b; }
    .header-data p strong { display:block; font-size:6.5pt; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-bottom:1px; font-weight:700; }
    .status-band { display:flex; justify-content:space-between; align-items:center; padding:6px 12px; margin-bottom:.75rem; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:8pt; }
    .status-badge { display:inline-flex; align-items:center; padding:2px 10px; border-radius:6px; font-size:11.5pt; font-weight:800; letter-spacing:.6px; text-transform:uppercase; }
    .status-badge.aprobado { color:#16a34a; border:1.5px solid #16a34a; }
    .status-badge.rechazado { color:#dc2626; border:1.5px solid #dc2626; }
    .status-badge.pausado,.status-badge.pending { color:#2563eb; border:1.5px solid #2563eb; }
    .section-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:.75rem; overflow:hidden; }
    .section-header { background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:6px 12px; display:flex; justify-content:space-between; align-items:center; }
    .section-header h4 { font-size:8pt; font-weight:700; color:#3f51b5; text-transform:uppercase; letter-spacing:.5px; margin:0; display:flex; align-items:center; gap:6px; }
    .badge-info { font-size:7.5pt; font-weight:600; color:#64748b; background:#fff; padding:2px 8px; border:1px solid #e2e8f0; border-radius:4px; display:inline-flex; align-items:center; gap:8px; }
    .data-table-layout { display:table; width:100%; table-layout:fixed; border-collapse:collapse; }
    .data-row-layout { display:table-row; }
    .data-cell { display:table-cell; vertical-align:middle; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:5px 10px; box-sizing:border-box; }
    .data-cell .lbl { display:block; font-size:6.5pt; font-weight:700; text-transform:uppercase; color:#64748b; letter-spacing:.4px; margin-bottom:2px; }
    .data-cell .val { font-size:8.5pt; font-weight:700; color:#1e293b; }
    .data-cell .val.highlight { color:#3f51b5; }
    .liquidacion-table { width:100%; border-collapse:collapse; margin:0; font-size:8pt; }
    .liquidacion-table th,.liquidacion-table td { border:1px solid #e2e8f0; padding:4.5px 7px; text-align:center; vertical-align:middle; }
    .liquidacion-table th { background:#f8fafc; font-weight:700; color:#475569; text-transform:uppercase; font-size:7pt; }
    .liquidacion-table td.td-highlight { background:#f8fafc; }
    .liquidacion-table tr:hover td, .liquidacion-table tr:hover td.td-highlight { background:#f1f5f9; }
    .liquidacion-table .total-row { background:#f1f5f9; font-weight:700; color:#3f51b5; border-top:1.5px solid #e2e8f0; }
    .empty-msg { padding:12px; text-align:center; color:#64748b; font-size:8pt; font-style:italic; }
    .obs-box { padding:8px 12px; font-size:8.5pt; color:#1e293b; min-height:44px; line-height:1.5; word-break:break-word; }
    .firmas-grid { display:table; width:100%; table-layout:fixed; }
    .firma-cell { display:table-cell; vertical-align:top; width:50%; padding:8px 14px; text-align:center; border-right:1px solid #e2e8f0; box-sizing:border-box; }
    .firma-cell:last-child { border-right:none; }
    .firma-img-box { height:48px; display:flex; align-items:center; justify-content:center; margin-bottom:4px; overflow:hidden; }
    .firma-line { border-top:1px solid #cbd5e1; width:75%; margin:0 auto 3px; }
    .firma-role { font-size:6.5pt; font-weight:700; text-transform:uppercase; color:#64748b; }
    .firma-name { font-size:8.5pt; font-weight:700; color:#1e293b; margin-top:1px; }
    .firma-cc { font-size:7pt; color:#64748b; }
    .doc-footer { margin-top:8px; border-top:1px solid #e2e8f0; padding-top:5px; display:flex; justify-content:space-between; font-size:6.5pt; color:#64748b; text-transform:uppercase; }
    .fa-svg { display:inline-block; vertical-align:-0.125em; }
`;

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="99 88 826 842" width="40" height="40" style="width:40px;height:40px;display:block;" aria-label="Logo Grupo TDM">
  <defs><linearGradient id="tdmG" gradientUnits="userSpaceOnUse" x1="433" y1="929" x2="500" y2="94"><stop offset="0" stop-color="#3f51b5"/><stop offset="1" stop-color="#303f9f"/></linearGradient></defs>
  <path fill="url(#tdmG)" d="M501.29 94.22C502.23 94.18 503.17 94.14 504.11 94.12C610.95 90.39 714.86 129.47 792.76 202.68C874.77 279.04 922.28 385.41 924.41 497.45C927.94 610.9 886.34 721.12 808.73 803.95C735.84 880.85 628.02 926.37 522.38 929.03C415.75 931.76 312.19 893.19 233.33 821.37C147.09 742.19 103.37 637.2 99.56 521.11C97.15 417.07 135.16 308.02 205.34 230.91C285.17 143.21 383.61 99.15 501.29 94.22Z"/>
  <path fill="#fff" d="M510.87 287.56C527.52 288.88 525.41 303.77 525.84 316.38C528.13 382.25 623.34 399.94 619.09 467.96C617.74 489.49 608.71 505.94 592.93 520.23C604.6 532.92 603.67 539.23 591.4 550.72C591.81 562.3 591.05 574.53 591.73 586.02C600.19 586.5 609.92 586.3 618.47 586.31C630.02 586.4 641.56 586.31 653.1 586.04C653.82 580.16 653.75 565.84 653.44 559.88C647.17 552.63 646.74 549.39 653.01 542.34C642.17 531.17 635.91 522.68 634.62 506.26C631.52 469.09 670.72 455.69 686.32 428.35C690.95 420.24 689.24 403.06 691.36 393.95C692.41 389.46 696.25 384.77 701.29 385.11C714.3 386 711.67 402.81 713.15 411.8C714.16 419.04 715.9 426.11 720.92 431.77C741.72 455.22 782.51 475.25 773.53 512.71C770.39 525.8 764.82 532.35 755.16 541.29C761.85 548.54 761.98 552.26 755.47 559.41C754.7 567.95 755.03 581.69 755.03 590.51L755.03 645.47C755.03 654.76 755.29 664.18 754.62 673.44C754.28 678.15 750.38 682.18 745.61 682.38C737.49 682.72 729.27 682.55 721.12 682.54L672.32 682.48L514.25 682.48L348.91 682.47L301.32 682.5C293.69 682.51 285.38 682.77 277.8 682.26C274.06 682.01 272.15 678.75 270.07 675.87C269.1 664.49 269.69 649.89 269.56 638.28C269.25 612.39 269.96 586.14 269.51 560.28C267.14 557.17 265.62 555.39 264.04 551.82C265.78 546.92 266.21 546.13 269.62 542.54C258.93 532.49 251.34 523.21 250.02 508.09C246.73 470.66 288.25 455.03 306.15 429.27C313.73 418.35 308.54 398.31 316.05 388.61C317.6 386.78 319.6 385.7 321.91 385.55C333.45 384.78 333.13 398.3 332.88 406.71C332.16 431.12 345.62 440.58 362.21 455.64C375.82 468 390.73 482.69 390.86 502.65C391.01 521.53 383.15 530.76 371.14 543.41C377.71 550.4 376.97 552.81 371.25 559.95C370.8 568.12 371.04 577.96 371.06 586.25C378.09 586.35 429.76 587.2 431.74 585.21C434.47 582.47 433.44 555.82 433.31 550.62L429.86 547.16C419.91 537.21 422.74 529.06 432.01 520.39C420.23 508.05 412.29 497.75 408.42 480.77C393.16 413.94 462.62 396.06 490.08 347.94C495.17 338.89 496.25 328.71 497.34 318.62C498.63 306.63 495.7 291.04 510.87 287.56Z"/>
</svg>`;

// ── Función principal exportada ──────────────────────────────────────

/**
 * Genera HTML completamente estático del reporte de calidad.
 * Sin scripts, sin módulos, sin localStorage, con SVGs de FontAwesome inline.
 * @param {Object} raw - Datos crudos del reporte desde Supabase
 * @returns {string} HTML estático completo
 */
export function generarReporteCalidadHtmlStatico(raw) {
    const st           = getEstadoBadge(raw?.conclusion);
    const tituloVisita = getTituloVisita(raw?.tipo_visita);
    const fechaStr     = raw?.fecha ? fmtFecha(raw.fecha) : '—';
    const productora   = limpiarProductora(raw?.productora);

    const auditorNombre = raw?.auditor_nombre || raw?.auditor || '—';
    const auditorCedula = raw?.auditor_cedula || '';
    const auditorFirma  = raw?.auditor_firma  || null;
    const plantaNombre  = raw?.planta || '—';
    const plantaFirma   = raw?.firma_svg || null;

    // Cantidad descontada
    const cantidadBase = Number(raw?.cantidad || 0);
    let sinConf = 0;
    const novD = parseJsonSafe(raw?.novedades_auditoria) || [];
    if (Array.isArray(novD)) {
        for (const n of novD) {
            if ((n.tipo || '').toUpperCase() === 'SIN CONFECCIONAR') {
                sinConf += (n.codigos || []).reduce((s, c) => s + Number(c.cantidad || 0), 0);
            }
        }
    }
    const cantidadFinal = cantidadBase > 0 ? Math.max(0, cantidadBase - sinConf) : cantidadBase;

    const avance = Number(raw?.avance || 0);
    const esAuditoria = (raw?.tipo_visita || '').toUpperCase().includes('AUDIT');
    const avanceStr = (avance === 0 && esAuditoria) ? '100' : fmt(avance, '0');

    const fechaHoy = new Date().toLocaleDateString('es-CO');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Calidad — ${fmt(raw?.id_reporte)} — OP ${fmt(raw?.op)}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="sheet">

  <!-- CABECERA -->
  <div class="header-block">
    <div class="header-title">
      <div class="header-title-left">
        <div class="header-logo-svg">${SVG_LOGO}</div>
        <div>
          <h2>${tituloVisita}</h2>
          <p class="header-prod-name">${fmt(productora, 'Grupo TDM')}</p>
        </div>
      </div>
      <div>
        <span class="status-badge ${st.cls}">${st.text}</span>
      </div>
    </div>
    <div class="header-data">
      <p style="text-align:left;"><strong>Radicado</strong>${fmt(raw?.id_reporte)}</p>
      <p style="text-align:center;"><strong>Fecha Auditoría</strong>${fechaStr}</p>
      <p style="text-align:right;"><strong>Tipo de Visita</strong>${fmt(raw?.tipo_visita)}</p>
    </div>
  </div>

  <!-- AUDITOR Y TALLER (Sub-barra informativa) -->
  <div class="status-band" style="display:flex;gap:0;padding:0;">
    <div style="flex:1;padding:6px 12px;border-right:1px solid #bfdbfe;display:flex;align-items:center;">
      <strong style="color:#3f51b5;margin-right:5px;display:inline-flex;align-items:center;">${faSvg('user-check')}</strong>${fmt(auditorNombre)}
    </div>
    <div style="flex:1;padding:6px 12px;text-align:left;display:flex;align-items:center;">
      <strong style="color:#3f51b5;margin-right:5px;display:inline-flex;align-items:center;">${faSvg('store')}</strong>${fmt(plantaNombre)}
    </div>
  </div>

  <!-- TRAZABILIDAD -->
  <div class="section-card">
    <div class="section-header">
      <h4>${faSvg('clipboard-list')} Trazabilidad</h4>
      <span class="badge-info">OP: ${fmt(raw?.op)}</span>
    </div>
    <div class="data-table-layout">
      <div class="data-row-layout">
        <div class="data-cell" style="width:25%;"><span class="lbl">OP / Lote</span><div class="val highlight">${fmt(raw?.op)}</div></div>
        <div class="data-cell" style="width:25%;"><span class="lbl">Referencia</span><div class="val">${fmt(raw?.referencia)}</div></div>
        <div class="data-cell" style="width:25%;"><span class="lbl">Proceso</span><div class="val">${fmt(raw?.proceso)}</div></div>
        <div class="data-cell" style="width:25%;border-right:none;"><span class="lbl">Línea</span><div class="val">${fmt(raw?.linea)}</div></div>
      </div>
      <div class="data-row-layout">
        <div class="data-cell" style="width:25%;border-bottom:none;"><span class="lbl">Prenda</span><div class="val">${fmt(raw?.prenda)}</div></div>
        <div class="data-cell" style="width:25%;border-bottom:none;"><span class="lbl">Género</span><div class="val">${fmt(raw?.genero)}</div></div>
        <div class="data-cell" style="width:25%;border-bottom:none;"><span class="lbl">Cantidad Final</span><div class="val highlight">${cantidadFinal}</div></div>
        <div class="data-cell" style="width:25%;border-right:none;border-bottom:none;"><span class="lbl">Avance</span><div class="val">${avanceStr}%</div></div>
      </div>
    </div>
  </div>

  <!-- LOGÍSTICA -->
  <div class="section-card">
    <div class="section-header"><h4>${faSvg('truck-ramp-box')} Logística y Destino</h4></div>
    <div class="data-table-layout">
      <div class="data-row-layout">
        <div class="data-cell" style="width:50%;border-bottom:none;"><span class="lbl">Destino Planta</span><div class="val">${fmt(raw?.destino_planta)}</div></div>
        <div class="data-cell" style="width:50%;border-bottom:none;border-right:none;"><span class="lbl">Destino Proceso</span><div class="val">${fmt(raw?.destino_proceso)}</div></div>
      </div>
    </div>
  </div>

  <!-- CURVA DE PRODUCCIÓN -->
  ${renderCurvaStatico(raw)}

  <!-- HALLAZGOS -->
  ${renderHallazgosStatico(raw)}

  <!-- OBSERVACIONES -->
  <div class="section-card">
    <div class="section-header"><h4>${faSvg('comment-dots')} Observaciones y Conclusión</h4></div>
    <div class="obs-box" style="${(raw?.observaciones || '').trim() ? '' : 'color:#94a3b8;font-style:italic;'}">${(raw?.observaciones || '').trim() || 'Sin observaciones adicionales registradas para este lote.'}</div>
  </div>

  <!-- FIRMAS -->
  <div class="section-card">
    <div class="section-header"><h4>${faSvg('signature')} Firmas de Conformidad</h4></div>
    <div class="firmas-grid">
      <div style="display:table-row;">
        <div class="firma-cell">
          <div class="firma-img-box">${renderFirmaHtml(auditorFirma, 'Registro Digital Verificado')}</div>
          <div class="firma-line"></div>
          <div class="firma-role">Auditor de Calidad</div>
          <div class="firma-name">${fmt(auditorNombre)}</div>
          ${(auditorCedula && auditorCedula !== '—' && auditorCedula !== 'N/A') ? `<div class="firma-cc">CC: ${fmt(auditorCedula)}</div>` : ''}
        </div>
        <div class="firma-cell" style="border-right:none;">
          <div class="firma-img-box">${renderFirmaHtml(plantaFirma, 'Firma No Registrada')}</div>
          <div class="firma-line"></div>
          <div class="firma-role">Representante del Taller</div>
          <div class="firma-name">${fmt(plantaNombre)}</div>
          <div class="firma-cc">Taller / Confección</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PIE -->
  <div class="doc-footer">
    <span>Radicado #${fmt(raw?.id_reporte)} | Generado el ${fechaHoy}</span>
  </div>

</div>
</body>
</html>`;
}
