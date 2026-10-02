import { Producto } from '../types';

const COLS: { key: keyof Producto; label: string; align?: 'right'; mono?: boolean }[] = [
  { key: 'empresa',       label: 'Empresa' },
  { key: 'referencia',    label: 'Referencia',   mono: true },
  { key: 'ref_proveedor', label: 'Ref. Prov.',   mono: true },
  { key: 'descripcion',   label: 'Descripción' },
  { key: 'marca',         label: 'Marca' },
  { key: 'f_grupo',       label: 'Grupo' },
  { key: 'f_subgrupo',    label: 'Subgrupo' },
  { key: 'precio',        label: 'Precio',       align: 'right' },
  { key: 'total_ventas',  label: 'Total ventas', align: 'right' },
  { key: 'despacho',      label: 'Despacho',     align: 'right' },
  { key: 'pct_rot',       label: '% Rot.',       align: 'right' },
  { key: 'inv_pv',        label: 'Inv. PV',      align: 'right' },
  { key: 'transito',      label: 'Tránsito',     align: 'right' },
  { key: 'inv_cedi',      label: 'Inv. CEDI',    align: 'right' },
  { key: 'ventas_mes',    label: 'Meses' },
  { key: 'updated_at',    label: 'Actualizado',  mono: true },
];

const NUM_KEYS = new Set<keyof Producto>([
  'precio', 'total_ventas', 'despacho', 'inv_pv', 'transito', 'inv_cedi',
]);

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function sparkline(vals: number[], w = 200, h = 48): string {
  if (vals.length < 2) return '';
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const pad = 4;
  const step = (w - pad * 2) / (vals.length - 1);

  const pts = vals.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Area fill
  const areaPath = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ')
    + ` L${(pad + (vals.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;

  // Line
  const linePath = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ');

  // Last dot
  const lastPt = pts[pts.length - 1].split(',');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <path d="${areaPath}" fill="rgba(26,25,24,.06)"/>
    <path d="${linePath}" stroke="#1a1918" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="3" fill="#1a1918"/>
  </svg>`;
}

// ── Modal singleton ────────────────────────────────────────────────────────
function ensureModal(): HTMLElement {
  let modal = document.getElementById('mesesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mesesModal';
    modal.className = 'meses-modal-backdrop hidden';
    modal.innerHTML = `
      <div class="meses-modal" role="dialog" aria-modal="true">
        <div class="meses-modal-header">
          <div>
            <div class="meses-modal-title" id="mesesModalTitle"></div>
            <div class="meses-modal-sub"  id="mesesModalSub"></div>
          </div>
          <button class="meses-modal-close" id="mesesModalClose" aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="meses-modal-body" id="mesesModalBody"></div>
      </div>`;
    document.body.appendChild(modal);

    // Cerrar al click en backdrop o botón X
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.getElementById('mesesModalClose')!.addEventListener('click', closeModal);

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }
  return modal;
}

function closeModal() {
  const modal = document.getElementById('mesesModal');
  modal?.classList.add('hidden');
  document.body.style.overflow = '';
}

function openModal(producto: Producto) {
  const modal  = ensureModal();
  const vMes   = producto.ventas_mes as Record<string, number | null> | undefined;
  const entries = vMes
    ? Object.entries(vMes).sort(([a], [b]) => a.localeCompare(b))
    : [];

  const vals   = entries.map(([, v]) => Number(v ?? 0));
  const total  = vals.reduce((a, b) => a + b, 0);
  const maxVal = Math.max(...vals, 1);
  const prom   = vals.length > 0 ? total / vals.length : 0;

  // Header
  document.getElementById('mesesModalTitle')!.textContent =
    `${producto.empresa} · ${producto.referencia}`;
  document.getElementById('mesesModalSub')!.textContent =
    producto.descripcion ?? '';

  // Stats rápidas
  const statsHtml = `
    <div class="meses-stats">
      <div class="meses-stat">
        <span class="meses-stat-label">Meses</span>
        <span class="meses-stat-value">${entries.length}</span>
      </div>
      <div class="meses-stat">
        <span class="meses-stat-label">Total ventas (meses)</span>
        <span class="meses-stat-value">${total.toLocaleString('es-CO')}</span>
      </div>
      <div class="meses-stat">
        <span class="meses-stat-label">Promedio mensual</span>
        <span class="meses-stat-value">${Math.round(prom).toLocaleString('es-CO')}</span>
      </div>
      <div class="meses-stat">
        <span class="meses-stat-label">Mes pico</span>
        <span class="meses-stat-value">${maxVal.toLocaleString('es-CO')}</span>
      </div>
    </div>`;

  // Sparkline
  const sparkHtml = entries.length >= 2
    ? `<div class="meses-spark">${sparkline(vals, 480, 56)}</div>`
    : '';

  // Tabla de meses
  const rowsHtml = entries.map(([mes, v]) => {
    const num    = Number(v ?? 0);
    const barPct = maxVal > 0 ? (num / maxVal) * 100 : 0;
    const isMax  = num === maxVal && maxVal > 0;
    return `
      <tr class="${isMax ? 'meses-row-peak' : ''}">
        <td class="meses-td-mes">${mes}</td>
        <td class="meses-td-val">${num.toLocaleString('es-CO')}</td>
        <td class="meses-td-bar">
          <div class="meses-bar-track">
            <div class="meses-bar-fill ${isMax ? 'meses-bar-peak' : ''}" style="width:${barPct.toFixed(1)}%"></div>
          </div>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('mesesModalBody')!.innerHTML = `
    ${statsHtml}
    ${sparkHtml}
    <div class="meses-table-wrap">
      <table class="meses-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th style="text-align:right">Unidades</th>
            <th style="width:40%"></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// ── ProductTable ───────────────────────────────────────────────────────────
export class ProductTable {
  private container: HTMLElement;
  private productos: Producto[] = [];

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.renderEmpty('idle');
    ensureModal(); // pre-crear el modal
  }

  render(productos: Producto[], _count: number) {
    this.productos = productos;

    if (!productos.length) {
      this.renderEmpty('no-results');
      return;
    }

    const thead = `<thead><tr>${
      COLS.map(c =>
        `<th style="${c.align === 'right' ? 'text-align:right' : ''}">${c.label}</th>`
      ).join('')
    }</tr></thead>`;

    const tbody = productos.map((r, rowIdx) => {
      const cells = COLS.map(c => {
        const raw = r[c.key];
        let display = '';
        let extra   = '';

        if (c.key === 'ventas_mes') {
          if (raw && typeof raw === 'object') {
            const entries = Object.entries(raw as Record<string, number | null>)
              .sort(([a], [b]) => a.localeCompare(b));
            const count = entries.length;
            display = `
              <button class="td-meses-btn" data-row="${rowIdx}" aria-label="Ver ventas por mes">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8"  y1="2" x2="8"  y2="6"/>
                  <line x1="3"  y1="10" x2="21" y2="10"/>
                </svg>
                ${count} meses
              </button>`;
          } else {
            display = '<span style="color:var(--ink-3)">—</span>';
          }
        } else if (NUM_KEYS.has(c.key)) {
          display = raw !== null && raw !== undefined
            ? Number(raw).toLocaleString('es-CO')
            : '<span style="color:var(--ink-3)">—</span>';
          extra = 'td-num';
        } else if (c.key === 'pct_rot') {
          display = raw !== null && raw !== undefined
            ? `${Number(raw).toFixed(2)}%`
            : '<span style="color:var(--ink-3)">—</span>';
          extra = 'td-num';
        } else if (c.key === 'updated_at' && raw) {
          const d = new Date(raw as string);
          display = `<span title="${d.toLocaleString('es-CO')}">${d.toLocaleDateString('es-CO')}</span>`;
          extra = 'td-mono';
        } else if (c.key === 'referencia' || c.key === 'ref_proveedor') {
          display = raw
            ? `<span class="td-pill">${raw}</span>`
            : '<span style="color:var(--ink-3)">—</span>';
        } else {
          display = raw !== null && raw !== undefined && raw !== ''
            ? String(raw)
            : '<span style="color:var(--ink-3)">—</span>';
          if (c.mono) extra = 'td-mono';
        }

        const align = c.align === 'right' ? 'text-align:right' : '';
        return `<td class="${extra}" style="${align}">${display}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    this.container.innerHTML =
      `<div class="tbl-container"><table>${thead}<tbody>${tbody}</tbody></table></div>`;

    // Delegación de eventos para los botones de meses
    this.container.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('.td-meses-btn');
      if (!btn) return;
      const rowIdx = Number(btn.dataset.row);
      const prod   = this.productos[rowIdx];
      if (prod) openModal(prod);
    });
  }

  private renderEmpty(state: 'idle' | 'no-results') {
    const svg = state === 'idle'
      ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-3)">
           <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
         </svg>
         <p>Ingresa un término de búsqueda</p>
         <span>Busca por referencia de proveedor o descripción</span>`
      : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-3)">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
           <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
         </svg>
         <p>Sin resultados</p>
         <span>Ningún producto coincide con la búsqueda</span>`;

    this.container.innerHTML = `<div class="empty-state">${svg}</div>`;
  }

  clear() {
    this.productos = [];
    this.renderEmpty('idle');
  }
}
