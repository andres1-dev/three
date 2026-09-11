/**
 * EvidenciaComponent
 * Todo el carrusel funciona con onclick inline puro — sin scripts externos,
 * sin addEventListener, sin funciones globales. Funciona con innerHTML.
 */
export function EvidenciaComponent(reporte) {
    let fotos = [];
    const raw = reporte.fotoUrl || reporte.soporte || '';

    if (Array.isArray(raw)) {
        fotos = raw.filter(Boolean);
    } else if (typeof raw === 'string' && raw.trim()) {
        fotos = raw.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (!fotos.length) return '';

    const uid        = 'ev_' + Math.random().toString(36).slice(2, 7);
    const esMultiple = fotos.length > 1;
    const total      = fotos.length;

    // ── Lógica de navegación completamente inline ─────────────
    // Se incrusta como string literal en cada onclick para que sea
    // autónoma — no depende de ningún scope externo.
    function goToFn(uidVal, totalVal) {
        return `(function(uid,total){
            return function(to){
                var wrap = document.getElementById(uid+'_wrap');
                if(!wrap) return;
                var cur = parseInt(wrap.dataset.idx||'0');
                if(cur===to) return;
                var fromS = document.getElementById(uid+'_s'+cur);
                var toS   = document.getElementById(uid+'_s'+to);
                if(fromS) fromS.style.display='none';
                if(toS)   toS.style.display='flex';
                var fromD = document.getElementById(uid+'_d'+cur);
                var toD   = document.getElementById(uid+'_d'+to);
                if(fromD) fromD.style.background='#cbd5e1';
                if(toD)   toD.style.background='#3f51b5';
                var curEl = document.getElementById(uid+'_cur');
                if(curEl) curEl.textContent=(to+1)+' / '+total;
                wrap.dataset.idx=to;
            };
        })('${uidVal}',${totalVal})`;
    }

    // Slides
    const slides = fotos.map((url, i) => `
        <div id="${uid}_s${i}"
             style="display:${i === 0 ? 'flex' : 'none'};
                    width:100%;height:100%;
                    align-items:center;justify-content:center;
                    box-sizing:border-box;">
            <img src="${url}"
                 alt="Evidencia ${i + 1}"
                 style="max-width:100%;max-height:100%;
                        object-fit:contain;display:block;">
        </div>
    `).join('');

    // Puntos
    const dots = esMultiple ? fotos.map((_, i) => `
        <span id="${uid}_d${i}"
              onclick="${goToFn(uid, total)}(${i})"
              style="width:8px;height:8px;border-radius:50%;
                     cursor:pointer;display:inline-block;
                     background:${i === 0 ? '#3f51b5' : '#cbd5e1'};
                     transition:background 0.15s;"></span>
    `).join('') : '';

    // Botón anterior
    const prevBtn = esMultiple ? `
        <button onclick="(function(){
                    var wrap=document.getElementById('${uid}_wrap');
                    var cur=parseInt(wrap?wrap.dataset.idx||'0':'0');
                    var to=(cur-1+${total})%${total};
                    ${goToFn(uid, total)}(to);
                })()"
                style="position:absolute;top:50%;left:10px;
                       transform:translateY(-50%);
                       background:rgba(255,255,255,0.9);
                       border:1px solid #e2e8f0;color:#1e293b;
                       width:32px;height:32px;border-radius:50%;
                       display:flex;align-items:center;justify-content:center;
                       cursor:pointer;z-index:10;
                       box-shadow:0 2px 6px rgba(0,0,0,0.1);
                       padding:0;"
                aria-label="Anterior">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                 stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"/>
            </svg>
        </button>
    ` : '';

    // Botón siguiente
    const nextBtn = esMultiple ? `
        <button onclick="(function(){
                    var wrap=document.getElementById('${uid}_wrap');
                    var cur=parseInt(wrap?wrap.dataset.idx||'0':'0');
                    var to=(cur+1)%${total};
                    ${goToFn(uid, total)}(to);
                })()"
                style="position:absolute;top:50%;right:10px;
                       transform:translateY(-50%);
                       background:rgba(255,255,255,0.9);
                       border:1px solid #e2e8f0;color:#1e293b;
                       width:32px;height:32px;border-radius:50%;
                       display:flex;align-items:center;justify-content:center;
                       cursor:pointer;z-index:10;
                       box-shadow:0 2px 6px rgba(0,0,0,0.1);
                       padding:0;"
                aria-label="Siguiente">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                 stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        </button>
    ` : '';

    // Contador
    const counter = esMultiple ? `
        <span id="${uid}_cur"
              style="position:absolute;top:8px;right:10px;
                     background:rgba(255,255,255,0.9);
                     border:1px solid #e2e8f0;
                     color:#1e293b;font-size:10px;font-weight:700;
                     padding:2px 8px;border-radius:100px;z-index:10;
                     font-family:'JetBrains Mono',monospace;">
            1 / ${total}
        </span>
    ` : '';

    // Puntos wrap
    const dotsWrap = esMultiple ? `
        <div style="position:absolute;bottom:10px;left:50%;
                    transform:translateX(-50%);
                    display:flex;gap:6px;z-index:10;">
            ${dots}
        </div>
    ` : '';

    return `
        <div class="section avoid-break" style="margin-bottom:12px;">
            <div class="section-header">
                <i class="fas fa-camera"></i> Evidencia Fotográfica
                ${esMultiple ? `<span style="margin-left:6px;font-size:9px;
                    font-weight:600;color:#64748b;">(${total} fotos)</span>` : ''}
            </div>
            <div id="${uid}_wrap"
                 data-idx="0"
                 style="position:relative;width:100%;height:280px;
                        background:#f8fafc;
                        border-top:1px solid #e2e8f0;
                        overflow:hidden;
                        border-radius:0 0 6px 6px;
                        box-sizing:border-box;">
                ${slides}
                ${prevBtn}
                ${nextBtn}
                ${counter}
                ${dotsWrap}
            </div>
        </div>
    `;
}
