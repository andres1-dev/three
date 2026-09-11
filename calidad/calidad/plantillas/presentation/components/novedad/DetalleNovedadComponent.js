/**
 * Componente: DetalleNovedadComponent
 * Renderiza el cuerpo central de la novedad:
 * descripción, métricas rápidas (cantidad, área, tipo) y detalle específico por área.
 */
export function DetalleNovedadComponent(novedad) {
  // Descripción
  const descripcionHtml = novedad.descripcion
    ? `<div class="detnov-card">
        <div class="detnov-icon-circle"><i class="fas fa-comment-dots"></i></div>
        <div class="detnov-card-body">
          <p class="detnov-card-label">DESCRIPCIÓN</p>
          <p class="detnov-card-text">${novedad.descripcion}</p>
        </div>
      </div>`
    : '';

  // Métricas rápidas
  const metricasHtml = `
    <div class="detnov-metrics">
      <div class="detnov-metric-item">
        <div class="detnov-icon-circle"><i class="fas fa-boxes-stacked"></i></div>
        <div>
          <p class="detnov-metric-label">CANTIDAD</p>
          <p class="detnov-metric-val">${novedad.cantidadSolicitada || '0'}</p>
        </div>
      </div>
      <div class="detnov-metric-item" style="border-left: 1px solid var(--border); border-right: 1px solid var(--border);">
        <div class="detnov-icon-circle"><i class="fas fa-map-location-dot"></i></div>
        <div>
          <p class="detnov-metric-label">ÁREA</p>
          <p class="detnov-metric-val">${novedad.area || 'N/A'}</p>
        </div>
      </div>
      ${novedad.tipoNovedad
        ? `<div class="detnov-metric-item">
            <div class="detnov-icon-circle"><i class="fas fa-exclamation-triangle"></i></div>
            <div>
              <p class="detnov-metric-label">TIPO</p>
              <p class="detnov-metric-val">${novedad.tipoNovedad}</p>
            </div>
          </div>`
        : ''
      }
    </div>`;

  // Detalle específico según área/tipo
  const detalleHtml = _renderDetalleEspecifico(novedad);

  // Comentarios
  const comentariosHtml = novedad.comentarios
    ? `<div class="detnov-card" style="margin-top: 8px; background: var(--bg-subtle);">
        <div class="detnov-icon-circle" style="background: var(--bg-subtle);"><i class="fas fa-comment-dots"></i></div>
        <div class="detnov-card-body">
          <p class="detnov-card-label">COMENTARIOS</p>
          <p class="detnov-card-text" style="font-style: italic;">${novedad.comentarios}</p>
        </div>
      </div>`
    : '';

  return `
    <style>
      .detnov-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px 10px;
        margin-bottom: 8px;
      }
      .detnov-icon-circle {
        width: 28px;
        height: 28px;
        min-width: 28px;
        background: var(--primary-light);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary);
        font-size: 11px;
      }
      .detnov-card-body { flex: 1; }
      .detnov-card-label {
        font-size: 8px;
        font-weight: 800;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.3px;
        margin: 0 0 2px;
      }
      .detnov-card-text {
        font-size: 10.5px;
        font-weight: 500;
        color: var(--text-dark);
        margin: 0;
        text-transform: uppercase;
        line-height: 1.5;
      }
      .detnov-metrics {
        display: flex;
        background: #FAFBFF;
        border: 1px solid var(--border);
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      .detnov-metric-item {
        flex: 1;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .detnov-metric-label {
        font-size: 8px;
        font-weight: 800;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.3px;
        margin: 0;
      }
      .detnov-metric-val {
        font-size: 13px;
        font-weight: 800;
        color: var(--text-dark);
        margin: 0;
        line-height: 1.2;
      }
      /* Detalle items específico */
      .detnov-items-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
        margin-top: 6px;
        background: #fff;
        border-radius: 4px;
        overflow: hidden;
      }
      .detnov-items-table thead tr { background: var(--bg-subtle); }
      .detnov-items-table th {
        padding: 4px 8px;
        text-align: center;
        font-size: 8px;
        font-weight: 800;
        color: var(--text-muted);
        text-transform: uppercase;
        border-bottom: 1px solid var(--border);
      }
      .detnov-items-table td {
        padding: 4px 8px;
        text-align: center;
        border-bottom: 1px solid #f1f5f9;
        font-weight: 600;
        color: var(--text-dark);
      }
      .detnov-items-table td.qty { color: var(--primary); font-weight: 800; }
      .detnov-items-table td.num { color: var(--text-muted); }
      .detnov-lote-box {
        background: #fff;
        border-left: 3px solid var(--primary);
        padding: 6px 10px;
        border-radius: 3px;
        margin-top: 6px;
      }
      .detnov-lote-box .lote-qty {
        font-size: 18px;
        font-weight: 900;
        color: var(--primary);
        line-height: 1;
      }
    </style>

    <div class="section avoid-break">
      <div class="section-header">
        <i class="fas fa-triangle-exclamation"></i> Detalle de la Novedad
      </div>
      <div class="section-content">
        ${descripcionHtml}
        ${metricasHtml}
        ${detalleHtml}
        ${comentariosHtml}
      </div>
    </div>
  `;
}

/** Renderiza el bloque de detalle específico según área/tipo */
function _renderDetalleEspecifico(novedad) {
  const d = novedad.tipoDetalle;
  if (!d) return '';

  const area = novedad.area || '';
  let html = '<div class="detnov-card" style="flex-direction: column;">';

  // Lote completo
  if (novedad.esLoteCompleto()) {
    html += `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <div class="detnov-icon-circle"><i class="fas fa-layer-group"></i></div>
        <div>
          <p class="detnov-card-label">Tipo de Solicitud</p>
          <p class="detnov-metric-val">LOTE COMPLETO</p>
        </div>
      </div>
      <div class="detnov-lote-box">
        <p style="font-size: 9px; color: var(--text-muted); margin: 0 0 2px; font-weight: 600;">Cantidad Total del Lote:</p>
        <span class="lote-qty">${d.cantidad_total || 0}</span>
        <span style="font-size: 9px; color: var(--text-muted);">unidades</span>
      </div>`;

  // Unidades específicas
  } else if (novedad.esUnidadesEspecificas()) {
    html += `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <div class="detnov-icon-circle"><i class="fas fa-list-ul"></i></div>
        <div>
          <p class="detnov-card-label">Tipo de Solicitud</p>
          <p class="detnov-metric-val">UNIDADES ESPECÍFICAS</p>
        </div>
      </div>
      <table class="detnov-items-table">
        <thead>
          <tr>
            <th>#</th><th>Talla</th><th>Color</th><th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${d.items.map((item, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>${item.talla}</td>
              <td>${item.color}</td>
              <td class="qty">${item.cantidad}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

  // Insumos / Corte / Telas — lista genérica
  } else if (novedad.tieneItemsDetalle()) {
    const iconMap = { 'INSUMOS': 'fa-tags', 'CORTE': 'fa-scissors', 'TELAS': 'fa-scroll' };
    const icon = iconMap[area] || 'fa-list';
    html += `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <div class="detnov-icon-circle"><i class="fas ${icon}"></i></div>
        <div>
          <p class="detnov-card-label">Detalle de ${area}</p>
          <p style="font-size: 9px; color: var(--text-muted); margin: 0;">${d.items.length} ítem${d.items.length !== 1 ? 's' : ''} registrado${d.items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <table class="detnov-items-table">
        <thead>
          <tr><th>#</th><th>Tipo</th><th>Cantidad</th></tr>
        </thead>
        <tbody>
          ${d.items.map((item, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>${item.tipo}</td>
              <td class="qty">${item.cantidad}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } else {
    return '';
  }

  html += '</div>';
  return html;
}
