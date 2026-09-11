/**
 * Componente: FirmasComponent
 * Renderiza el sellado digital de certificación para el auditor institucional
 * y la firma manuscrita digitalizada del representante de planta o taller.
 */
export function FirmasComponent(reporte) {
  const auditor = reporte.auditor;
  const planta = reporte.representantePlanta;

  const firmaPlantaSvg = planta.firmaSvg || `
    <svg viewBox="0 0 300 80" style="max-height: 65px; width: auto;" stroke="#1E293B" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M 20 50 Q 50 10, 80 45 T 140 30 Q 180 60, 220 20 T 280 40 M 60 45 L 240 45" />
    </svg>
  `;

  return `
    <style>
      .signatures-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        padding: 14px 20px;
        background: var(--bg-light);
        border-radius: 0 0 6px 6px;
        min-height: 160px;
      }
      .sig-col {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        text-align: center;
      }
      .sig-col.border-right {
        border-right: 1px dashed var(--border-dark);
        padding-right: 16px;
      }
      .sig-col.padding-left {
        padding-left: 16px;
      }
      .sig-img-wrap {
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .digital-seal {
        border: 1.5px dashed var(--primary);
        border-radius: 6px;
        padding: 6px 12px;
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 8.5px;
        color: var(--primary);
        font-weight: 700;
        letter-spacing: 0.3px;
      }
      .digital-seal i {
        font-size: 16px;
        margin-bottom: 3px;
        color: var(--primary);
      }
      .digital-seal .seal-meta {
        font-size: 7.5px;
        color: var(--text-muted);
        font-weight: 500;
        margin-top: 2px;
      }
      .sig-line {
        width: 85%;
        border-top: 1px solid var(--text-dark);
        margin: 8px 0 4px;
      }
      .sig-name {
        font-weight: 800;
        font-size: 10.5px;
        color: var(--text-dark);
        text-transform: uppercase;
      }
      .sig-doc {
        font-size: 9px;
        color: var(--text-muted);
        font-weight: 600;
      }
      .sig-role {
        font-size: 8px;
        color: var(--primary);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.3px;
        margin-top: 1px;
      }
      .footer-doc {
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8.5px;
        color: var(--text-muted);
      }
    </style>

    <div class="section avoid-break">
      <div class="section-header">
        <i class="fas fa-file-signature"></i> Firmas de Conformidad y Responsabilidad
      </div>
      <div class="signatures-grid">
        <!-- Columna 1: Auditor -->
        <div class="sig-col border-right">
          <div class="sig-img-wrap">
            ${auditor.firmaSvg
              ? auditor.firmaSvg
              : `<div class="digital-seal">
                  <i class="fas fa-certificate"></i> Certificación Digital de Auditoría
                  <div class="seal-meta">
                    AUDITOR: ${auditor.nombre}<br>
                    REGISTRO: ${auditor.registroDigital}<br>
                    ESTADO: FIRMADO ELECTRÓNICAMENTE
                  </div>
                </div>`
            }
          </div>
          <div class="sig-line"></div>
          <span class="sig-name">${auditor.nombre}</span>
          <span class="sig-doc">C.C. ${auditor.cedula}</span>
          <span class="sig-role">${auditor.cargo}</span>
        </div>

        <!-- Columna 2: Planta / Taller -->
        <div class="sig-col padding-left">
          <div class="sig-img-wrap">
            ${firmaPlantaSvg}
          </div>
          <div class="sig-line"></div>
          <span class="sig-name">${planta.nombre}</span>
          <span class="sig-doc">C.C. ${planta.cedula}</span>
          <span class="sig-role">${planta.cargo}</span>
        </div>
      </div>
    </div>

    <!-- Pie de Página Institucional -->
    <div class="footer-doc">
      <span>Grupo TDM — El Templo de la Moda | Sistema Integral de Gestión de Calidad</span>
      <span>Generado: ${reporte.fecha} — Documento Oficial Válido</span>
      <span>Página 1 de 1</span>
    </div>
  `;
}
