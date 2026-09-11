/**
 * CurvaMatrizComponent
 * Renderiza la matriz talla×color con toggle entre:
 *   - CURVA REAL   : extensiones originales del lote
 *   - CURVA ACTUAL : curva real − unidades SIN CONFECCIONAR (pendientes)
 *
 * El toggle es interactivo en pantalla. En impresión se muestra la curva activa.
 */
export function CurvaMatrizComponent(reporte) {
    const curva  = reporte.curva;
    const tallas = curva.tallas || [];
    const filas  = curva.filas  || [];

    if (!tallas.length || !filas.length) return '';

    // ── Descuentos de SIN CONFECCIONAR por (color, talla) exactos ──────
    const descuentos = {}; // { 'COLOR||TALLA': qty } — valores tal cual de la BD
    for (const h of (reporte.hallazgos || [])) {
        if (h.tipo !== 'SIN CONFECCIONAR') continue;
        for (const [talla, qty] of Object.entries(h.cantidadesPorTalla || {})) {
            const k = `${h.color}||${talla}`;
            descuentos[k] = (descuentos[k] || 0) + Number(qty);
        }
    }

    const hayDescuentos = Object.values(descuentos).some(v => v > 0);

    // ── Matrices real y actual ────────────────────────────────────────────
    const real   = {};
    const actual = {};
    let granTotalReal   = 0;
    let granTotalActual = 0;

    for (const f of filas) {
        real[f.color]   = {};
        actual[f.color] = {};
        for (const t of tallas) {
            const qR   = Number(f.cantidades?.[t] || 0);
            const desc = descuentos[`${f.color}||${t}`] || 0;
            const qA   = Math.max(0, qR - desc);
            real[f.color][t]   = qR;
            actual[f.color][t] = qA;
            granTotalReal   += qR;
            granTotalActual += qA;
        }
    }

    const uid = 'curva_' + Math.random().toString(36).slice(2, 7);

    // ── Función helper que genera las filas de la tabla ──────────────────
    function renderFilas(modo) {
        const data = modo === 'real' ? real : actual;

        return filas.map(f => {
            const totalColor = tallas.reduce((s, t) => s + (data[f.color]?.[t] || 0), 0);
            const celdas = tallas.map(t => {
                const qty = data[f.color]?.[t] ?? 0;
                const esDescuento = modo === 'actual' && (descuentos[`${f.color}||${t}`] || 0) > 0;
                const style = esDescuento
                    ? 'background:#fff5f5;color:#dc2626;font-weight:700;'
                    : qty > 0 ? 'font-weight:600;color:#1e293b;' : 'color:#cbd5e1;font-weight:400;';
                return `<td style="${style}">${qty > 0 ? qty : '-'}</td>`;
            }).join('');

            const totalStyle = totalColor === 0 && modo === 'actual'
                ? 'background:#fee2e2;color:#dc2626;font-weight:900;'
                : 'background:#f1f5f9;font-weight:800;color:#3f51b5;';

            return `
                <tr>
                    <td style="text-align:left;padding-left:12px;font-weight:600;color:#1e293b;">
                            ${f.color}
                        </td>
                    ${celdas}
                    <td style="${totalStyle}">${totalColor}</td>
                </tr>
            `;
        }).join('');
    }

    function renderTotales(modo) {
        const data = modo === 'real' ? real : actual;
        const gran = modo === 'real' ? granTotalReal : granTotalActual;
        const totalsPorTalla = tallas.map(t => {
            const tot = filas.reduce((s, f) => s + (data[f.color]?.[t] || 0), 0);
            return `<td style="font-weight:${tot > 0 ? '900' : '400'};
                        color:${tot > 0 ? '#1e293b' : '#94a3b8'};">${tot || '-'}</td>`;
        }).join('');
        return `
            <tr style="background:#e8eaf6;">
                <td style="text-align:left;padding-left:12px;font-weight:800;font-size:9.5px;
                            text-transform:uppercase;color:#1e293b;">TOTAL POR TALLA</td>
                ${totalsPorTalla}
                <td style="background:#3f51b5;color:#fff;font-weight:900;font-size:11px;">${gran}</td>
            </tr>
        `;
    }

    const thTallas = tallas.map(t => `<th style="width:9%;">${t}</th>`).join('');

    return `
        <style>
            .curva-section { margin-bottom:12px; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; }
            .curva-header  {
                display:flex; align-items:center; justify-content:space-between;
                padding:6px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
                font-weight:700; font-size:10.5px; color:#3f51b5; text-transform:uppercase;
                letter-spacing:0.4px;
            }
            .curva-header i { margin-right:7px; }
            .curva-toggle-wrap { display:flex; align-items:center; gap:8px; }
            .curva-toggle-label {
                font-size:9.5px; font-weight:700; text-transform:uppercase;
                letter-spacing:0.3px; padding:3px 10px; border-radius:100px;
                color:#fff; background:#3f51b5; transition:background 0.15s;
            }
            .curva-toggle-label.actual { background:#dc2626; }
            .curva-toggle-btn {
                display:inline-flex; align-items:center; gap:5px;
                padding:3px 10px; border-radius:100px; border:1.5px solid #e2e8f0;
                background:#fff; font-size:9px; font-weight:700; text-transform:uppercase;
                letter-spacing:0.3px; cursor:pointer; color:#64748b;
                transition:all 0.15s; font-family:inherit;
            }
            .curva-toggle-btn:hover { border-color:#3f51b5; color:#3f51b5; }
            .curva-table {
                width:100%; border-collapse:collapse; font-size:10.5px; text-align:center;
            }
            .curva-table th, .curva-table td { border:1px solid #e2e8f0; padding:5px 8px; }
            .curva-table th {
                background:#f8fafc; color:#0f172a; font-weight:800;
                font-size:9.5px; text-transform:uppercase; letter-spacing:0.3px;
            }
            .curva-desc-note {
                padding:5px 12px; font-size:9px; font-weight:600;
                color:#dc2626; background:#fff5f5; border-top:1px solid #fecaca;
                display:flex; align-items:center; gap:5px;
            }
            @media print {
                .curva-toggle-btn, .curva-toggle-wrap { display:none !important; }
            }
        </style>

        <div class="curva-section avoid-break" id="${uid}_section">
            <div class="curva-header">
                <span>
                    <i class="fas fa-layer-group"></i>
                    Extensiones — OP ${reporte.op} ·
                    <span id="${uid}_total">${hayDescuentos ? granTotalActual : granTotalReal}</span>
                    <span id="${uid}_modo_label" class="curva-toggle-label ${hayDescuentos ? 'actual' : ''}" style="margin-left:6px;">${hayDescuentos ? 'ACTUAL' : 'REAL'}</span>
                </span>
                ${hayDescuentos ? `
                <div class="curva-toggle-wrap">
                    <button class="curva-toggle-btn" id="${uid}_btn"
                        data-modo="actual"
                        data-uid="${uid}"
                        data-real-total="${granTotalReal}"
                        data-actual-total="${granTotalActual}"
                        data-real-html="${encodeURIComponent(renderFilas('real')   + renderTotales('real'))}"
                        data-actual-html="${encodeURIComponent(renderFilas('actual') + renderTotales('actual'))}"
                        onclick="(function(btn){
                            var uid   = btn.dataset.uid;
                            var body  = document.getElementById(uid+'_body');
                            var label = document.getElementById(uid+'_modo_label');
                            var total = document.getElementById(uid+'_total');
                            var note  = document.getElementById(uid+'_note');
                            if (!body) return;
                            if (btn.dataset.modo === 'actual') {
                                btn.dataset.modo = 'real';
                                body.innerHTML  = decodeURIComponent(btn.dataset.realHtml);
                                label.textContent = 'REAL';
                                label.className   = 'curva-toggle-label';
                                total.textContent = btn.dataset.realTotal;
                                btn.querySelector('span') && (btn.querySelector('span').textContent = 'Ver curva actual');
                                if (note) note.style.display = 'none';
                            } else {
                                btn.dataset.modo = 'actual';
                                body.innerHTML  = decodeURIComponent(btn.dataset.actualHtml);
                                label.textContent = 'ACTUAL';
                                label.className   = 'curva-toggle-label actual';
                                total.textContent = btn.dataset.actualTotal;
                                btn.querySelector('span') && (btn.querySelector('span').textContent = 'Ver curva real');
                                if (note) note.style.display = 'flex';
                            }
                        })(this)">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none"
                             stroke="currentColor" stroke-width="2.5">
                            <path d="M1 4v6h6M23 20v-6h-6"/>
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        <span>Ver curva real</span>
                    </button>
                </div>` : ''}
            </div>
            <div style="padding:0; overflow-x:auto;">
                <table class="curva-table" id="${uid}_table">
                    <thead>
                        <tr>
                            <th style="text-align:left;width:32%;padding-left:12px;">Color / Variante</th>
                            ${thTallas}
                            <th style="width:14%;">Total</th>
                        </tr>
                    </thead>
                    <tbody id="${uid}_body">
                        ${hayDescuentos ? renderFilas('actual') + renderTotales('actual') : renderFilas('real') + renderTotales('real')}
                    </tbody>
                </table>
            </div>
            ${hayDescuentos ? `
            <div class="curva-desc-note" id="${uid}_note" style="display:flex;">
                <i class="fas fa-scissors" style="color:#dc2626;"></i>
                Curva actual: Unidades sin confeccionar ya descontadas.
            </div>` : ''}
        </div>
    `;
}
