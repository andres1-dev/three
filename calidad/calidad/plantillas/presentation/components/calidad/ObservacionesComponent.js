/**
 * Componente: ObservacionesComponent
 * Renderiza las observaciones técnicas del auditor y las políticas corporativas de entrega y plazos de reclamación.
 */
export function ObservacionesComponent(reporte) {
  const obsTexto = reporte.observaciones || 'Sin observaciones técnicas adicionales registradas.';

  return `
    <style>
      .obs-box {
        background: var(--bg-light);
        padding: 12px 14px;
        border-radius: 0 0 6px 6px;
        font-size: 11.5px;
        font-weight: 500;
        line-height: 1.55;
        color: var(--text-dark);
        white-space: pre-wrap;
      }
      .terms-box {
        background: #FAFAFA;
        border-top: 1px solid var(--border);
        padding: 9px 12px;
        font-size: 9px;
        color: var(--text-muted);
        line-height: 1.45;
      }
      .terms-box ol {
        margin: 0;
        padding-left: 14px;
      }
      .terms-box li {
        margin-bottom: 2px;
      }
    </style>

    <div class="section avoid-break">
      <div class="section-header">
        <i class="fas fa-comment-dots"></i> Observaciones Generales del Auditor
      </div>
      <div class="obs-box">${obsTexto}</div>
      
      <!-- Términos y Políticas Integradas -->
      <div class="terms-box">
        <ol>
          <li>De acuerdo con las políticas operativas del <strong>Grupo TDM</strong>, la planta receptora dispone de un plazo máximo de <strong>24 horas hábiles</strong> a partir del despacho para reportar cualquier faltante o inconsistencia técnica. Vencido dicho plazo, se considerará recibido a entera conformidad.</li>
          <li>Cualquier reclamación posterior no reportada dentro del periodo establecido podrá generar cobros proporcionales según políticas de producción.</li>
          <li>Horario de atención y soporte técnico: lunes a viernes de 7:10 a.m. a 4:43 p.m.</li>
        </ol>
      </div>
    </div>
  `;
}
