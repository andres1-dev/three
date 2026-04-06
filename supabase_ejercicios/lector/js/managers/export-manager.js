// Gestión de exportación

const ExportManager = {
  toCSV() {
    if (AppState.consolidated.size === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const items = Array.from(AppState.consolidated.values());
    const sessionDuration = AppState.sessionEndTime 
      ? Utils.formatDuration(AppState.sessionEndTime - AppState.sessionStartTime)
      : Utils.formatDuration(new Date() - AppState.sessionStartTime);
    
    const csv = [
      ['Sistema de Conteo - Reporte'],
      ['Fecha:', new Date().toLocaleString('es-ES')],
      ['Inicio Sesión:', AppState.sessionStartTime.toLocaleString('es-ES')],
      ['Fin Sesión:', AppState.sessionEndTime ? AppState.sessionEndTime.toLocaleString('es-ES') : 'En curso'],
      ['Duración:', sessionDuration],
      ['Total Escaneos:', AppState.totalScans],
      ['Items Únicos:', AppState.consolidated.size],
      [''],
      ['Referencia', 'Talla', 'Color', 'Cantidad', 'Primera Escaneo', 'Último Escaneo'],
      ...items.map(item => [
        item.referencia,
        item.talla,
        item.color,
        item.count,
        item.firstScan.toLocaleString('es-ES'),
        item.lastScan.toLocaleString('es-ES')
      ])
    ].map(row => row.join(',')).join('\n');

    Utils.downloadFile(csv, `inventario_${Utils.formatFilename()}.csv`, 'text/csv');
    AudioManager.playBeep(1200, 150);
  },

  toJSON() {
    if (AppState.consolidated.size === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const sessionDuration = AppState.sessionEndTime 
      ? AppState.sessionEndTime - AppState.sessionStartTime
      : new Date() - AppState.sessionStartTime;

    const data = {
      exportDate: new Date().toISOString(),
      session: {
        startTime: AppState.sessionStartTime.toISOString(),
        endTime: AppState.sessionEndTime ? AppState.sessionEndTime.toISOString() : null,
        durationMs: sessionDuration,
        durationFormatted: Utils.formatDuration(sessionDuration),
        active: AppState.sessionActive
      },
      summary: {
        totalScans: AppState.totalScans,
        uniqueItems: AppState.consolidated.size
      },
      items: Array.from(AppState.consolidated.values()).map(item => ({
        referencia: item.referencia,
        talla: item.talla,
        color: item.color,
        cantidad: item.count,
        primerEscaneo: item.firstScan.toISOString(),
        ultimoEscaneo: item.lastScan.toISOString()
      }))
    };

    Utils.downloadFile(JSON.stringify(data, null, 2), `inventario_${Utils.formatFilename()}.json`, 'application/json');
    AudioManager.playBeep(1200, 150);
  }
};

function exportToCSV() {
  ExportManager.toCSV();
}

function exportToJSON() {
  ExportManager.toJSON();
}
