import { IReportRenderer } from '../../core/ports/IReportRenderer.js';
import { HeaderComponent }         from '../../presentation/components/calidad/HeaderComponent.js';
import { DecisionComponent }       from '../../presentation/components/calidad/DecisionComponent.js';
import { OperacionGridComponent }  from '../../presentation/components/calidad/OperacionGridComponent.js';
import { CurvaMatrizComponent }    from '../../presentation/components/calidad/CurvaMatrizComponent.js';
import { EvidenciaComponent }      from '../../presentation/components/calidad/EvidenciaComponent.js';
import { HallazgosTableComponent } from '../../presentation/components/calidad/HallazgosTableComponent.js';
import { ObservacionesComponent }  from '../../presentation/components/calidad/ObservacionesComponent.js';
import { FirmasComponent }         from '../../presentation/components/calidad/FirmasComponent.js';

/**
 * Adaptador de Infraestructura: HtmlCalidadRenderer
 * Implementa IReportRenderer orquestando los componentes de presentación y los datos del dominio.
 */
export class HtmlCalidadRenderer extends IReportRenderer {
  /**
   * @param {import('../../core/domain/calidad/ReporteCalidadEntity.js').ReporteCalidadEntity} reporte
   * @returns {string} Fragmento HTML completo de la hoja de reporte
   */
  render(reporte) {
    if (!reporte) {
      return '<div class="sheet"><p style="color:#ef4444; text-align:center;">No se proporcionó información de reporte.</p></div>';
    }

    return `
      <div class="sheet" id="reporteSheet">
        ${HeaderComponent(reporte)}
        ${DecisionComponent(reporte)}
        ${OperacionGridComponent(reporte)}
        ${CurvaMatrizComponent(reporte)}
        ${EvidenciaComponent(reporte)}
        ${HallazgosTableComponent(reporte)}
        ${ObservacionesComponent(reporte)}
        ${FirmasComponent(reporte)}
      </div>
    `;
  }
}
