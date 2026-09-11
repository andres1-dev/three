/**
 * Componente: OperacionGridComponent
 * Renderiza la matriz simétrica de 4 columnas con datos del producto, logística, fechas de entrega y progreso.
 */
export function OperacionGridComponent(reporte) {
  return `
    <style>
      .data-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .data-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .data-label {
        font-size: 8.5px;
        text-transform: uppercase;
        color: var(--text-muted);
        font-weight: 700;
        letter-spacing: 0.3px;
      }
      .data-value {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-dark);
        word-break: break-word;
      }
      .data-value.highlight {
        color: var(--primary);
        font-weight: 800;
      }
      .progress-bar-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 4px;
      }
      .progress-track {
        flex: 1;
        height: 7px;
        background: var(--border);
        border-radius: 4px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: var(--primary);
        border-radius: 4px;
      }
    </style>

    <div class="section avoid-break">
      <div class="section-header">
        <i class="fas fa-boxes-stacked"></i> Detalles de Operación y Tiempos de Compromiso
      </div>
      <div class="section-content">
        <div class="data-grid">
          <!-- Fila 1 -->
          <div class="data-item">
            <span class="data-label">Referencia</span>
            <span class="data-value highlight">${reporte.referencia}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Línea de Producción</span>
            <span class="data-value">${reporte.linea}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Tipo de Visita</span>
            <span class="data-value">${(reporte.tipoVisita || '').toUpperCase()}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Cantidad Auditada</span>
            <span class="data-value highlight">${reporte.cantidadTotal}</span>
          </div>

          <!-- Fila 2 -->
          <div class="data-item">
            <span class="data-label">Tipo de Prenda</span>
            <span class="data-value">${reporte.prenda}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Género</span>
            <span class="data-value">${reporte.genero}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Proceso Destino</span>
            <span class="data-value highlight">${reporte.destinoProceso}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Lugar Destino</span>
            <span class="data-value">${reporte.destinoPlanta}</span>
          </div>

          <!-- Fila 3: Tiempos y Contacto -->
          <div class="data-item">
            <span class="data-label">Fecha Despacho</span>
            <span class="data-value">${reporte.fechaDespacho}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Fecha Entrega</span>
            <span class="data-value">${reporte.fechaEntrega}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Teléfono</span>
            <span class="data-value">${reporte.telefonoPlanta}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Correo</span>
            <span class="data-value">${reporte.correoNotificacion}</span>
          </div>

          <!-- Fila 4: Barra de Avance -->
          <div class="data-item" style="grid-column: span 4; margin-top: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="data-label">Avance General del Lote</span>
              <span style="font-weight:800; font-size:11px; color:var(--text-dark);">${reporte.avancePorcentaje}% Completado</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-track">
                <div class="progress-fill" style="width: ${reporte.avancePorcentaje}%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
