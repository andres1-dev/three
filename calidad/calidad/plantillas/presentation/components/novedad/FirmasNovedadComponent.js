/**
 * Componente: FirmasNovedadComponent
 * Sección de firmas al pie de la plantilla de Novedad.
 */
export function FirmasNovedadComponent(novedad) {
  return `
    <style>
      .nov-firmas {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
        padding-top: 10px;
        page-break-inside: avoid;
      }
      .nov-firma-box {
        width: 45%;
        text-align: center;
      }
      .nov-firma-line {
        border-bottom: 1.5px solid var(--text-dark);
        height: 35px;
        margin-bottom: 6px;
      }
      .nov-firma-leyenda {
        font-size: 10px;
        font-weight: 800;
        color: var(--text-dark);
        text-transform: uppercase;
        margin: 0;
      }
      .nov-firma-sub {
        font-size: 9px;
        color: var(--text-muted);
        font-weight: 600;
        margin: 2px 0 0;
      }
    </style>

    <div class="nov-firmas">
      <div class="nov-firma-box">
        <div class="nov-firma-line"></div>
        <p class="nov-firma-leyenda">Firma de Aceptación</p>
        <p class="nov-firma-sub">Coordinador del Área</p>
      </div>
      <div class="nov-firma-box">
        <div class="nov-firma-line"></div>
        <p class="nov-firma-leyenda">Firma de Autorización</p>
        <p class="nov-firma-sub">Dirección / Auditoría de Control</p>
      </div>
    </div>
  `;
}
