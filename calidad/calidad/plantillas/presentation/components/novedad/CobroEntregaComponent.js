/**
 * Componente: CobroEntregaComponent
 * Renderiza las opciones de cobro (TALLER, LÍNEA, REFERENCIA, FICHA, OTROS)
 * y la modalidad de entrega (MANO A MANO), con checkboxes visuales.
 */
export function CobroEntregaComponent(novedad) {
  const cobro = novedad.cobro;

  const opcionesCobro = [
    { key: 'TALLER',         label: 'TALLER' },
    { key: 'LINEA',          label: 'LÍNEA' },
    { key: 'REFERENCIA',     label: 'REFERENCIA' },
    { key: 'FICHA',          label: 'FICHA' },
    { key: 'PERSONALIZADO',  label: 'OTROS' },
  ];

  const entregaActiva = cobro === 'MANO_A_MANO' || cobro === 'ENTREGA';

  const makeCheck = (activo) => `
    <span class="cobro-check ${activo ? 'activo' : ''}">
      ${activo ? '<i class="fas fa-check"></i>' : ''}
    </span>`;

  const cobroItemsHtml = opcionesCobro.map(op => `
    <div class="cobro-item">
      <span class="cobro-lbl">${op.label}</span>
      ${makeCheck(cobro === op.key)}
    </div>`).join('');

  return `
    <style>
      .cobro-panel {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .cobro-box {
        border: 2px solid var(--primary);
        border-radius: 6px;
        background: var(--bg-subtle);
        padding: 8px 10px;
      }
      .cobro-box h4 {
        font-size: 9.5px;
        font-weight: 800;
        color: var(--primary);
        text-transform: uppercase;
        text-align: center;
        margin: 0 0 8px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 4px;
      }
      .cobro-items-row {
        display: flex;
        justify-content: space-around;
        flex-wrap: wrap;
        gap: 10px;
      }
      .cobro-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 9px;
        font-weight: 700;
        color: var(--text-dark);
        text-transform: uppercase;
      }
      .cobro-check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border: 1.5px solid var(--primary);
        border-radius: 3px;
        background: #fff;
        font-size: 9px;
        color: #fff;
        flex-shrink: 0;
      }
      .cobro-check.activo {
        background: var(--primary);
      }
      .entrega-box {
        min-width: 110px;
        text-align: center;
      }
      .entrega-box .cobro-items-row {
        justify-content: center;
      }
    </style>

    <div class="cobro-panel">
      <!-- Opciones de Cobro -->
      <div class="cobro-box" style="flex: 2;">
        <h4><i class="fas fa-hand-holding-dollar"></i> Opciones de Cobro</h4>
        <div class="cobro-items-row">
          ${cobroItemsHtml}
        </div>
      </div>

      <!-- Entrega -->
      <div class="cobro-box entrega-box">
        <h4><i class="fas fa-handshake"></i> Entrega</h4>
        <div class="cobro-items-row">
          <div class="cobro-item">
            <span class="cobro-lbl">MANO A MANO</span>
            ${makeCheck(entregaActiva)}
          </div>
        </div>
      </div>
    </div>
  `;
}
