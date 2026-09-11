/**
 * Componente: DatosProduccionComponent
 * Muestra la grilla de campos de producción (OP, Referencia, Prenda, etc.)
 * Solo muestra campos con valor efectivo, igual que el legacy.
 */
export function DatosProduccionComponent(novedad) {
  const fields = [
    { label: 'OP / Lote',   value: novedad.op },
    { label: 'Referencia',  value: novedad.referencia },
    { label: 'Prenda',      value: novedad.prenda },
    { label: 'Género',      value: novedad.genero },
    { label: 'Tejido',      value: novedad.tejido },
    { label: 'Línea',       value: novedad.linea },
    { label: 'Proceso',     value: novedad.proceso },
    { label: 'Cantidad OP', value: novedad.cantidad > 0 ? `${novedad.cantidad} UNDS.` : null },
  ].filter(f => f.value && f.value !== 'N/A' && f.value !== '0' && f.value !== 'S/L');

  // Agrupar en pares de columnas
  let rowsHtml = '';
  for (let i = 0; i < fields.length; i += 2) {
    rowsHtml += `
      <tr>
        <td class="dprod-label">${fields[i].label}</td>
        <td class="dprod-val">${fields[i].value}</td>
        ${fields[i + 1]
          ? `<td class="dprod-label">${fields[i + 1].label}</td><td class="dprod-val">${fields[i + 1].value}</td>`
          : '<td></td><td></td>'
        }
      </tr>`;
  }

  const salidaHtml = novedad.salida
    ? `<div class="dprod-salida">
        <i class="fas fa-truck-fast"></i>
        <strong>Salida:</strong> ${_fmt(novedad.salida)}
        <span class="dias-habiles-tag">
          (${novedad.getDiasHabilesSalida()} días hábiles)
        </span>
      </div>`
    : '';

  return `
    <style>
      .dprod-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
      .dprod-table tr td { padding: 3px 6px; vertical-align: middle; }
      .dprod-label {
        font-weight: 700;
        color: var(--text-muted);
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        white-space: nowrap;
        width: 22%;
      }
      .dprod-val {
        font-weight: 600;
        color: var(--text-dark);
        width: 28%;
      }
      .dprod-salida {
        margin-top: 6px;
        padding: 5px 8px;
        border-top: 1px solid var(--border);
        font-size: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-body);
      }
      .dias-habiles-tag {
        color: var(--danger);
        font-size: 9.5px;
        font-weight: 700;
      }
    </style>

    <div class="section avoid-break" style="flex: 1;">
      <div class="section-header">
        <i class="fas fa-industry"></i> Datos de Producción
      </div>
      <div class="section-content" style="padding: 8px 12px;">
        ${fields.length > 0
          ? `<table class="dprod-table"><tbody>${rowsHtml}</tbody></table>${salidaHtml}`
          : `<p style="color: var(--text-muted); font-size: 10px;">Sin datos de producción registrados.</p>`
        }
      </div>
    </div>
  `;
}

function _fmt(dateString) {
  if (!dateString) return '';
  const d = new Date(String(dateString).replace('T', ' '));
  if (isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString('es-CO', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
