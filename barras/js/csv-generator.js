// Generador de CSV

const CSVGenerator = {
  generate(records) {
    // Crear CSV con las 4 columnas
    const csvRows = [
      // Encabezado
      'referencia,talla,id_color,barcode'
    ];

    // Agregar datos
    records.forEach(record => {
      const row = [
        this.escapeCSV(record.referencia),
        this.escapeCSV(record.talla),
        this.escapeCSV(record.id_color),
        this.escapeCSV(record.barcode)
      ].join(',');
      
      csvRows.push(row);
    });

    return csvRows.join('\n');
  },

  escapeCSV(value) {
    const str = String(value).trim();
    
    // Si contiene coma, comillas o salto de línea, envolver en comillas
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  },

  download(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
};
