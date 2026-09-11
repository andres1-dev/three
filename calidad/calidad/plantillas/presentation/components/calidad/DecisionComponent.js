/**
 * Componente: DecisionComponent
 * Muestra la tarjeta del dictamen final (APROBADO / RECHAZADO) con los metadatos de planta y OP.
 */
export function DecisionComponent(reporte) {
  const isAprobado = reporte.isAprobado();
  const cardClass = isAprobado ? 'aprobado' : 'rechazado';
  const iconClass = isAprobado ? 'fa-check-circle' : 'fa-times-circle';

  return `
    <style>
      .conclusion-card {
        padding: 10px 16px;
        border-radius: 6px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 16px;
        border: 1px solid var(--border);
      }
      .conclusion-card.aprobado {
        background-color: var(--success-bg);
        border-color: var(--success-border);
      }
      .conclusion-card.rechazado {
        background-color: var(--danger-bg);
        border-color: var(--danger-border);
      }
      .conclusion-badge {
        font-weight: 900;
        font-size: 15px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .conclusion-badge.aprobado { color: var(--success); }
      .conclusion-badge.rechazado { color: var(--danger); }
      .conclusion-audited-info {
        flex: 1;
        display: grid;
        grid-template-columns: 2.2fr 1.3fr 0.8fr;
        gap: 14px;
        border-left: 2px solid rgba(0,0,0,0.1);
        padding-left: 16px;
      }
      .info-block .label {
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.4px;
        margin-bottom: 2px;
      }
      .info-block .value {
        font-size: 12px;
        font-weight: 800;
        color: var(--text-dark);
        text-transform: uppercase;
        line-height: 1.2;
      }
    </style>

    <div class="conclusion-card ${cardClass}" id="decisionCard">
      <div class="conclusion-badge ${cardClass}" id="decisionBadge">
        <i class="fas ${iconClass}" id="decisionIcon"></i>
        <span id="decisionText">${reporte.conclusion}</span>
      </div>
      <div class="conclusion-audited-info">
        <div class="info-block">
          <div class="label">Planta</div>
          <div class="value">${reporte.planta}</div>
        </div>
        <div class="info-block">
          <div class="label">Proceso Auditado</div>
          <div class="value">${reporte.proceso}</div>
        </div>
        <div class="info-block">
          <div class="label">OP</div>
          <div class="value">${reporte.op}</div>
        </div>
      </div>
    </div>
  `;
}
