import { IReportRenderer } from '../../core/ports/IReportRenderer.js';
import { HeaderNovedadComponent }    from '../../presentation/components/novedad/HeaderNovedadComponent.js';
import { DatosProduccionComponent }  from '../../presentation/components/novedad/DatosProduccionComponent.js';
import { InfoTallerComponent }       from '../../presentation/components/novedad/InfoTallerComponent.js';
import { DetalleNovedadComponent }   from '../../presentation/components/novedad/DetalleNovedadComponent.js';
import { CobroEntregaComponent }     from '../../presentation/components/novedad/CobroEntregaComponent.js';
import { FirmasNovedadComponent }    from '../../presentation/components/novedad/FirmasNovedadComponent.js';

/**
 * Adaptador de Infraestructura: HtmlNovedadRenderer
 * Implementa IReportRenderer orquestando los componentes de la plantilla de Novedad.
 * El layout replica la estructura del legacy: datos de producción e info de taller en dos columnas.
 */
export class HtmlNovedadRenderer extends IReportRenderer {
  /**
   * @param {import('../../core/domain/novedad/NovedadEntity.js').NovedadEntity} novedad
   * @returns {string} HTML completo de la hoja de novedad
   */
  render(novedad) {
    if (!novedad) {
      return '<div class="sheet"><p style="color:#ef4444; text-align:center;">No se proporcionó información de novedad.</p></div>';
    }

    return `
      <div class="sheet" id="novedadSheet">
        ${HeaderNovedadComponent(novedad)}

        <!-- Fila de dos columnas: Producción + Taller -->
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
          ${DatosProduccionComponent(novedad)}
          ${InfoTallerComponent(novedad)}
        </div>

        ${DetalleNovedadComponent(novedad)}
        ${CobroEntregaComponent(novedad)}
        ${FirmasNovedadComponent(novedad)}
      </div>
    `;
  }
}
