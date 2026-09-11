/**
 * HallazgosTableComponent
 * Modo A (con tallas) → tabla cruzada tipo×color×talla con filas coloreadas por tipo
 * Modo B (sin tallas) → lista simple agrupada por tipo
 */
export function HallazgosTableComponent(reporte) {
    const hallazgos = reporte.hallazgos || [];
    const tallas    = reporte.curva?.tallas || [];

    if (!hallazgos.length) return '';

    const totalGlobal = reporte.getTotalDefectos?.() ??
        hallazgos.reduce((a, h) => a + h.getTotalUnidades(), 0);
    const tasa = reporte.getTasaAfectacion?.() ?? 0;

    /**
     * Por tipo: iconColor (ícono), rowBg (fondo muy claro de la fila),
     * qtyBg (fondo de celdas con cantidad), icon FA
     */
    function tipoCfg(h) {
        const label = (h.tipo || '').toUpperCase();

        if (label === 'SIN CONFECCIONAR')
            return { icon:'fa-scissors',             iconColor:'#dc2626', rowBg:'#fff5f5', qtyBg:'#fee2e2', label: h.tipo };

        if (label === 'PROMOCION — SIN PROCESO')
            return { icon:'fa-triangle-exclamation', iconColor:'#be185d', rowBg:'#fdf2f8', qtyBg:'#fce7f3', label: h.tipo };

        if (label === 'PROMOCION')
            return { icon:'fa-percent',              iconColor:'#b45309', rowBg:'#fffbeb', qtyBg:'#fef3c7', label: h.tipo };

        if (label.startsWith('COBROS —'))
            return { icon:'fa-money-bill-wave',      iconColor:'#7c3aed', rowBg:'#f5f3ff', qtyBg:'#ede9fe', label: h.tipo };

        if (label === 'COBROS')
            return { icon:'fa-file-invoice-dollar',  iconColor:'#047857', rowBg:'#f0fdf4', qtyBg:'#d1fae5', label: h.tipo };

        if (label === 'LAVADO')
            return { icon:'fa-droplet',              iconColor:'#4338ca', rowBg:'#eef2ff', qtyBg:'#e0e7ff', label: h.tipo };

        return     { icon:'fa-tag',                  iconColor:'#1d4ed8', rowBg:'#eff6ff', qtyBg:'#dbeafe', label: h.tipo };
    }

    const styles = `
        <style>
            .hall-table { width:100%; border-collapse:collapse; font-size:10.5px; text-align:center; }
            .hall-table th, .hall-table td { border:1px solid #e2e8f0; padding:5px 8px; }
            .hall-table th {
                background:#f8fafc; color:#0f172a; font-weight:800;
                font-size:9.5px; text-transform:uppercase; letter-spacing:0.3px;
            }
            .hall-td-tipo {
                text-align:left; padding-left:12px;
                font-size:9px; font-weight:800; text-transform:uppercase;
                white-space:nowrap; color:#1e293b;
            }
            .hall-td-tipo i { margin-right:5px; }
            .hall-td-color {
                text-align:left; padding-left:12px;
                font-weight:600; font-size:10px; color:#1e293b;
            }
            .hall-cell-empty { color:#cbd5e1; font-weight:400; }
            /* Totales globales */
            .hall-grand-total td {
                background:#f1f5f9; color:#1e293b;
                font-weight:800; font-size:10.5px;
            }
            /* Modo lista */
            .hall-list-wrap   { margin-bottom:8px; border:1px solid #e2e8f0; border-radius:4px; overflow:hidden; }
            .hall-list-header {
                display:flex; justify-content:space-between; align-items:center;
                padding:6px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
                font-size:9.5px; font-weight:800; text-transform:uppercase;
                letter-spacing:0.3px; color:#1e293b;
            }
            .hall-list-header i { margin-right:6px; }
            .hall-list-table { width:100%; border-collapse:collapse; font-size:10.5px; }
            .hall-list-table th, .hall-list-table td { border:1px solid #e2e8f0; padding:5px 10px; }
            .hall-list-table th {
                background:#f8fafc; font-size:9.5px; font-weight:800; text-transform:uppercase;
            }
            .hall-list-table td.tr { text-align:right; font-weight:700; }
        </style>
    `;

    // ── MODO A: tabla cruzada con tallas ─────────────────────
    if (tallas.length > 0) {
        const thTallas = tallas.map(t => `<th style="width:7%;">${t}</th>`).join('');

        const filas = hallazgos.map(h => {
            const cfg   = tipoCfg(h);
            const total = h.getTotalUnidades();
            const celdas = tallas.map(t => {
                const qty = h.getCantidad(t);
                return qty > 0
                    ? `<td style="background:${cfg.qtyBg};font-weight:800;color:#1e293b;">${qty}</td>`
                    : `<td class="hall-cell-empty">-</td>`;
            }).join('');

            return `
                <tr style="background:${cfg.rowBg};">
                    <td class="hall-td-tipo">
                        <i class="fas ${cfg.icon}" style="color:${cfg.iconColor};"></i>${cfg.label}
                    </td>
                    <td class="hall-td-color" style="background:${cfg.rowBg};">${h.color}</td>
                    ${celdas}
                    <td style="background:${cfg.qtyBg};font-weight:900;color:#1e293b;">${total}</td>
                </tr>
            `;
        }).join('');

        const totalesTalla = tallas.map(t => {
            const tot = reporte.getTotalDefectosPorTalla?.(t) ??
                hallazgos.reduce((a, h) => a + h.getCantidad(t), 0);
            return `<td style="font-weight:${tot > 0 ? '900' : '400'};color:${tot > 0 ? '#1e293b' : '#94a3b8'};">${tot || '-'}</td>`;
        }).join('');

        return `
            ${styles}
            <div class="section avoid-break">
                <div class="section-header">
                    <i class="fas fa-magnifying-glass-chart"></i>
                    Hallazgos Cuantitativos — ${totalGlobal} unds. · Tasa de afectación: ${tasa}%
                </div>
                <div class="section-content" style="padding:0;">
                    <table class="hall-table">
                        <thead>
                            <tr>
                                <th style="width:22%;text-align:left;padding-left:12px;">Tipo / Novedad</th>
                                <th style="width:22%;text-align:left;padding-left:12px;">Color</th>
                                ${thTallas}
                                <th style="width:10%;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filas}
                            <tr class="hall-grand-total">
                                <td colspan="2" style="text-align:left;padding-left:12px;font-weight:800;">
                                    TOTAL DEFECTOS POR TALLA
                                </td>
                                ${totalesTalla}
                                <td style="font-weight:900;">${totalGlobal} UNDS.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ── MODO B: lista simple agrupada por tipo ────────────────
    const grupos = new Map();
    for (const h of hallazgos) {
        const tipo = h.tipo;
        if (!grupos.has(tipo)) grupos.set(tipo, { h, filas: [] });
        for (const [talla, cant] of Object.entries(h.cantidadesPorTalla || {})) {
            if (cant > 0) grupos.get(tipo).filas.push({ talla, color: h.color, cant });
        }
    }

    const bloques = [...grupos.values()].map(({ h, filas }) => {
        const cfg   = tipoCfg(h);
        const total = filas.reduce((a, f) => a + f.cant, 0);
        const rows  = filas.map(f => `
            <tr style="background:${cfg.rowBg};">
                <td>${f.talla || '-'}</td>
                <td style="text-align:left;padding-left:10px;">${f.color || '-'}</td>
                <td class="tr" style="background:${cfg.qtyBg};">${f.cant}</td>
            </tr>
        `).join('');

        return `
            <div class="hall-list-wrap">
                <div class="hall-list-header">
                    <span>
                        <i class="fas ${cfg.icon}" style="color:${cfg.iconColor};"></i>${cfg.label}
                    </span>
                    <span style="font-weight:900;">${total} UNDS.</span>
                </div>
                <table class="hall-list-table">
                    <thead>
                        <tr>
                            <th style="width:30%">TALLA</th>
                            <th style="width:50%;text-align:left;padding-left:10px;">COLOR</th>
                            <th style="width:20%;text-align:right">CANT.</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }).join('');

    return `
        ${styles}
        <div class="section avoid-break">
            <div class="section-header">
                <i class="fas fa-search"></i>
                Hallazgos Cuantitativos — ${totalGlobal} unds.
            </div>
            <div class="section-content" style="padding:10px 12px 2px;">
                ${bloques}
            </div>
        </div>
    `;
}
