/**
 * Componente: InfoTallerComponent
 * Muestra los datos de contacto del taller / planta productora.
 */
export function InfoTallerComponent(novedad) {
  const p = novedad.planta;
  const rows = [
    { label: 'Planta', value: p.nombre !== 'N/A' ? p.nombre : null },
    { label: 'NIT / Cédula', value: novedad.getPlantaIdFormateado() || null },
    { label: 'Teléfono', value: novedad.getPlantaTelefonoFormateado() || null },
    { label: 'Correo', value: p.correo || null },
  ].filter(r => r.value);

  const content = rows.length > 0
    ? `<table class="dtaller-table"><tbody>
        ${rows.map(r => `<tr><td class="dprod-label">${r.label}</td><td class="dprod-val">${r.value}</td></tr>`).join('')}
      </tbody></table>`
    : `<div class="dtaller-empty">
        <i class="fas fa-exclamation-triangle"></i>
        No se encontraron datos de contacto registrados para esta planta.
      </div>`;

  return `
    <style>
      .dtaller-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
      .dtaller-table tr td { padding: 3px 6px; }
      .dtaller-empty {
        padding: 8px;
        background: #FEF2F2;
        border: 1px solid #FECACA;
        color: #991B1B;
        border-radius: 4px;
        font-size: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
    </style>

    <div class="section avoid-break" style="flex: 1;">
      <div class="section-header">
        <i class="fas fa-store"></i> Información del Taller
      </div>
      <div class="section-content" style="padding: 8px 12px;">
        ${content}
      </div>
    </div>
  `;
}
