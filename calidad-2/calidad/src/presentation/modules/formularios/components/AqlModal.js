/**
 * Componente: AqlModal (Calculadora y Reglas de Muestreo ISO 2859-1)
 */
export const AQL_TABLES = {
    ranges: [
        { min: 2, max: 8, I: 'A', II: 'A', III: 'B' },
        { min: 9, max: 15, I: 'A', II: 'B', III: 'C' },
        { min: 16, max: 25, I: 'B', II: 'C', III: 'D' },
        { min: 26, max: 50, I: 'C', II: 'D', III: 'E' },
        { min: 51, max: 90, I: 'C', II: 'E', III: 'F' },
        { min: 91, max: 150, I: 'D', II: 'F', III: 'G' },
        { min: 151, max: 280, I: 'E', II: 'G', III: 'H' },
        { min: 281, max: 500, I: 'F', II: 'H', III: 'J' },
        { min: 501, max: 1200, I: 'G', II: 'J', III: 'K' },
        { min: 1201, max: 3200, I: 'H', II: 'K', III: 'L' },
        { min: 3201, max: 10000, I: 'J', II: 'L', III: 'M' },
        { min: 10001, max: 35000, I: 'K', II: 'M', III: 'N' },
        { min: 35001, max: 150000, I: 'L', II: 'N', III: 'P' },
    ],
    samples: {
        'A': { '1.0': [2, 0, 1], '1.5': [2, 0, 1], '2.5': [2, 0, 1], '4.0': [2, 0, 1], '6.5': [2, 0, 1] },
        'B': { '1.0': [3, 0, 1], '1.5': [3, 0, 1], '2.5': [3, 0, 1], '4.0': [3, 0, 1], '6.5': [3, 0, 1] },
        'C': { '1.0': [5, 0, 1], '1.5': [5, 0, 1], '2.5': [5, 0, 1], '4.0': [5, 0, 1], '6.5': [5, 1, 2] },
        'D': { '1.0': [8, 0, 1], '1.5': [8, 0, 1], '2.5': [8, 0, 1], '4.0': [8, 0, 1], '6.5': [8, 1, 2] },
        'E': { '1.0': [13, 0, 1], '1.5': [13, 0, 1], '2.5': [13, 0, 1], '4.0': [13, 1, 2], '6.5': [13, 1, 2] },
        'F': { '1.0': [20, 0, 1], '1.5': [20, 0, 1], '2.5': [20, 1, 2], '4.0': [20, 1, 2], '6.5': [20, 2, 3] },
        'G': { '1.0': [32, 0, 1], '1.5': [32, 1, 2], '2.5': [32, 1, 2], '4.0': [32, 2, 3], '6.5': [32, 3, 4] },
        'H': { '1.0': [50, 0, 1], '1.5': [50, 1, 2], '2.5': [50, 2, 3], '4.0': [50, 3, 4], '6.5': [50, 5, 6] },
        'J': { '1.0': [80, 1, 2], '1.5': [80, 1, 2], '2.5': [80, 3, 4], '4.0': [80, 5, 6], '6.5': [80, 7, 8] },
        'K': { '1.0': [125, 1, 2], '1.5': [125, 2, 3], '2.5': [125, 5, 6], '4.0': [125, 7, 8], '6.5': [125, 10, 11] },
        'L': { '1.0': [200, 2, 3], '1.5': [200, 3, 4], '2.5': [200, 7, 8], '4.0': [200, 10, 11], '6.5': [200, 14, 15] },
        'M': { '1.0': [315, 3, 4], '1.5': [315, 5, 6], '2.5': [315, 10, 11], '4.0': [315, 14, 15], '6.5': [315, 21, 22] },
        'N': { '1.0': [500, 5, 6], '1.5': [500, 7, 8], '2.5': [500, 14, 15], '4.0': [500, 21, 22], '6.5': [500, 21, 22] },
        'P': { '1.0': [800, 7, 8], '1.5': [800, 10, 11], '2.5': [800, 21, 22], '4.0': [800, 21, 22], '6.5': [800, 21, 22] },
    }
};

export class AqlModal {
    /**
     * Calcula los parámetros AQL
     * @param {number} cantidad
     * @param {string} aqlNivel ('1.0', '1.5', '2.5', '4.0', '6.5')
     * @param {string} inspeccionNivel ('I', 'II', 'III')
     */
    static calculate(cantidad, aqlNivel = '4.0', inspeccionNivel = 'II') {
        const qty = parseInt(cantidad, 10) || 0;
        if (qty < 2) {
            return { letra: 'A', muestra: 0, ac: 0, re: 1, text: 'Cantidad insuficiente' };
        }

        const fila = AQL_TABLES.ranges.find(r => qty >= r.min && qty <= r.max)
            || AQL_TABLES.ranges[AQL_TABLES.ranges.length - 1];
        
        const letra = fila[inspeccionNivel] || 'A';
        const config = AQL_TABLES.samples[letra] || AQL_TABLES.samples['A'];
        const [muestra, ac, re] = config[aqlNivel] || [0, 0, 1];

        return {
            letra,
            muestra,
            ac,
            re,
            resumen: `Código ${letra} · Muestra: ${muestra} · Ac: ${ac} / Re: ${re}`
        };
    }

    /**
     * Muestra el modal explicativo de AQL
     */
    static open({ cantidad, aqlNivel = '4.0', nivel = 'II', onClose = null }) {
        const modalEl = document.createElement('div');
        modalEl.className = 'f-modal-backdrop';
        modalEl.id = 'modal-aql-calculator';

        const data = AqlModal.calculate(cantidad, aqlNivel, nivel);

        modalEl.innerHTML = `
            <div class="f-modal-sheet">
                <div class="f-sheet-header">
                    <div class="f-sheet-pill"></div>
                    <div class="f-sheet-title-row">
                        <div class="f-sheet-title-icon aql">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                        </div>
                        <div>
                            <h3 class="f-sheet-title">Muestreo AQL (ISO 2859-1)</h3>
                            <p class="f-sheet-subtitle">Inspección normal para control de calidad</p>
                        </div>
                    </div>
                </div>

                <div class="f-sheet-body">
                    <div class="aql-stats-cards">
                        <div class="aql-stat-card">
                            <span class="aql-stat-label">Tamaño Lote</span>
                            <span class="aql-stat-val">${cantidad || 0}</span>
                            <span class="aql-stat-sub">unidades</span>
                        </div>
                        <div class="aql-stat-card primary">
                            <span class="aql-stat-label">Muestra a Revisar</span>
                            <span class="aql-stat-val">${data.muestra}</span>
                            <span class="aql-stat-sub">prendas (${data.letra})</span>
                        </div>
                        <div class="aql-stat-card success">
                            <span class="aql-stat-label">Aceptar (Ac)</span>
                            <span class="aql-stat-val">≤ ${data.ac}</span>
                            <span class="aql-stat-sub">defectos max.</span>
                        </div>
                        <div class="aql-stat-card danger">
                            <span class="aql-stat-label">Rechazar (Re)</span>
                            <span class="aql-stat-val">≥ ${data.re}</span>
                            <span class="aql-stat-sub">defectos</span>
                        </div>
                    </div>

                    <div class="aql-details-box">
                        <div class="aql-row">
                            <span class="aql-lbl">Nivel de Inspección</span>
                            <span class="aql-val">Nivel ${nivel} (General)</span>
                        </div>
                        <div class="aql-row">
                            <span class="aql-lbl">Límite AQL seleccionado</span>
                            <span class="aql-val">${aqlNivel}%</span>
                        </div>
                        <div class="aql-row">
                            <span class="aql-lbl">Letra Código de Muestra</span>
                            <span class="aql-val badge-letra">${data.letra}</span>
                        </div>
                    </div>
                </div>

                <div class="f-sheet-footer">
                    <button class="f-btn-primary btn-close-aql" style="width:100%;">Entendido</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalEl);
        requestAnimationFrame(() => modalEl.classList.add('visible'));

        const close = () => {
            modalEl.classList.remove('visible');
            setTimeout(() => {
                modalEl.remove();
                if (typeof onClose === 'function') onClose();
            }, 200);
        };

        modalEl.querySelector('.btn-close-aql')?.addEventListener('click', close);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });
    }
}
