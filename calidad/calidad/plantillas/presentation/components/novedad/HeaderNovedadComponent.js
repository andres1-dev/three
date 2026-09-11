/**
 * Componente: HeaderNovedadComponent
 * Header del reporte de novedad: QR, folio, fecha y badge de estado dinámico.
 */
export function HeaderNovedadComponent(novedad) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(novedad.imagen || novedad.idNovedad)}&color=3F51B5`;

  const fechaFormateada = _formatearFecha(novedad.fecha);

  return `
    <style>
      .nov-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        border: 2px dashed var(--primary);
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 12px;
        background: #FAFBFF;
      }
      .nov-header-qr img {
        width: 80px;
        height: 80px;
        mix-blend-mode: multiply;
      }
      .nov-header-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 80px;
      }
      .nov-header-title {
        font-size: 20px;
        font-weight: 900;
        color: var(--primary);
        letter-spacing: -0.5px;
        line-height: 1;
        margin: 0;
      }
      .nov-header-folio {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        font-weight: 800;
        color: var(--primary);
        margin: 2px 0;
        line-height: 1;
      }
      .nov-header-fecha {
        font-size: 10.5px;
        font-weight: 700;
        color: var(--text-muted);
        margin: 0;
        line-height: 1;
      }
      .nov-estado-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 10px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 2px;
      }
      .nov-header-right {
        text-align: right;
        font-size: 10px;
        color: var(--text-muted);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        min-width: 100px;
      }
      .nov-header-right .dias-badge {
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 9px;
        text-align: center;
      }
      .nov-header-right .dias-badge strong {
        display: block;
        font-size: 16px;
        font-weight: 900;
        color: var(--primary);
        line-height: 1;
      }
    </style>

    <div class="nov-header">
      <div class="nov-header-qr">
        <img src="${qrUrl}" alt="QR Novedad ${novedad.idNovedad}">
      </div>
      <div class="nov-header-body">
        <div>
          <h1 class="nov-header-title">REPORTE DE NOVEDADES</h1>
          <p class="nov-header-folio">${novedad.idNovedad}</p>
          <p class="nov-header-fecha">${fechaFormateada}</p>
        </div>
        <div>
          <span class="nov-estado-badge" style="background: ${novedad.getEstadoBg()}; color: ${novedad.getEstadoColor()}; border: 1px solid ${novedad.getEstadoBorder()};">
            <i class="fas ${novedad.estado === 'FINALIZADO' ? 'fa-circle-check' : novedad.estado === 'ELABORACION' ? 'fa-circle-half-stroke' : 'fa-clock'}"></i>
            ${novedad.estado}
          </span>
        </div>
      </div>
      <div class="nov-header-right">
        <div class="dias-badge">
          <strong>${novedad.getDiasHabiles()}</strong>
          día${novedad.getDiasHabiles() !== 1 ? 's' : ''} hábil${novedad.getDiasHabiles() !== 1 ? 'es' : ''}
          <br>en el sistema
        </div>
        <div style="font-size: 9px; color: var(--text-muted); text-align: right;">
          <i class="fas fa-building"></i> Grupo TDM
        </div>
      </div>
    </div>
  `;
}

function _formatearFecha(dateString) {
  if (!dateString) return '';
  const d = new Date(String(dateString).replace('T', ' '));
  if (isNaN(d.getTime())) return String(dateString);
  const format = d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  return format.charAt(0).toUpperCase() + format.slice(1);
}
