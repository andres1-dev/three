/**
 * Entidad de Dominio: NovedadEntity
 * Modela una Novedad / Solicitud de Área con su detalle específico, cobros y estado.
 * Mapeada desde los campos del sistema legacy (LOTE, REFERENCIA, AREA, COBRO, etc.)
 */
export class NovedadEntity {
  constructor(data = {}) {
    // Identificación
    this.idNovedad          = data.idNovedad          || data.ID_NOVEDAD  || 'NOV-SIN-ID';
    this.estado             = (data.estado            || data.ESTADO      || 'PENDIENTE').toUpperCase();
    this.fecha              = data.fecha              || data.FECHA       || data.TIMESTAMP || new Date().toISOString();
    this.salida             = data.salida             || data.SALIDA      || null;

    // Producción
    this.op                 = data.op                 || data.LOTE        || data.ID   || 'N/A';
    this.referencia         = data.referencia         || data.REFERENCIA  || 'N/A';
    this.prenda             = data.prenda             || data.PRENDA      || 'N/A';
    this.genero             = data.genero             || data.GENERO      || 'N/A';
    this.tejido             = data.tejido             || data.TEJIDO      || null;
    this.linea              = data.linea              || data.CUENTO      || data.LINEA || null;
    this.proceso            = data.proceso            || data.PROCESO     || 'N/A';
    this.cantidad           = Number(data.cantidad    || data.CANTIDAD    || 0);

    // Novedad
    this.area               = data.area               || data.AREA        || 'N/A';
    this.tipoNovedad        = data.tipoNovedad        || data.TIPO_NOVEDAD || null;
    this.descripcion        = data.descripcion        || data.DESCRIPCION || '';
    this.comentarios        = data.comentarios        || data.COMENTARIOS || '';
    this.cantidadSolicitada = Number(data.cantidadSolicitada || data.CANTIDAD_SOLICITADA || 0);
    this.cobro              = data.cobro              || data.COBRO       || null;

    // Detalle específico (puede ser JSON string o objeto)
    const rawDetalle        = data.tipoDetalle        || data.TIPO_DETALLE || null;
    this.tipoDetalle        = rawDetalle
      ? (typeof rawDetalle === 'string' ? this._parseDetalle(rawDetalle) : rawDetalle)
      : null;

    // Planta / Taller
    const infoPlanta        = data.planta || {};
    this.planta = {
      nombre:   infoPlanta.nombre   || infoPlanta.PLANTA    || data.PLANTA   || 'N/A',
      idPlanta: infoPlanta.idPlanta || infoPlanta.ID_PLANTA || '',
      telefono: infoPlanta.telefono || infoPlanta.TELEFONO  || '',
      correo:   infoPlanta.correo   || infoPlanta.EMAIL     || infoPlanta.CORREO || '',
    };

    // Imagen / referencia para QR
    this.imagen = data.imagen || data.IMAGEN || this.idNovedad;
  }

  /** @private */
  _parseDetalle(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  /** Color semántico según estado */
  getEstadoColor() {
    if (this.estado === 'FINALIZADO')  return '#166534';
    if (this.estado === 'ELABORACION') return '#92400E';
    return '#991B1B'; // PENDIENTE
  }

  /** Fondo semántico según estado */
  getEstadoBg() {
    if (this.estado === 'FINALIZADO')  return '#F0FDF4';
    if (this.estado === 'ELABORACION') return '#FFFBEB';
    return '#FEF2F2';
  }

  /** Borde semántico según estado */
  getEstadoBorder() {
    if (this.estado === 'FINALIZADO')  return '#BBF7D0';
    if (this.estado === 'ELABORACION') return '#FDE68A';
    return '#FECACA';
  }

  /** Días hábiles transcurridos desde el registro hasta hoy */
  getDiasHabiles() {
    return _calcularDiasHabiles(this.fecha, new Date());
  }

  /** Días hábiles entre salida y fecha de ingreso */
  getDiasHabilesSalida() {
    if (!this.salida) return 0;
    return _calcularDiasHabiles(this.salida, this.fecha);
  }

  /** ¿Tiene items en el detalle específico? */
  tieneItemsDetalle() {
    return this.tipoDetalle?.items && Array.isArray(this.tipoDetalle.items) && this.tipoDetalle.items.length > 0;
  }

  /** ¿Es solicitud de lote completo? */
  esLoteCompleto() {
    return this.tipoDetalle?.tipo_solicitud === 'LOTE_COMPLETO';
  }

  /** ¿Es solicitud de unidades específicas? */
  esUnidadesEspecificas() {
    return this.tipoDetalle?.tipo_solicitud === 'UNIDADES' && this.tieneItemsDetalle();
  }

  /** ¿Tiene información de contacto de planta? */
  tienePlantaInfo() {
    return !!(this.planta.nombre !== 'N/A' || this.planta.telefono || this.planta.correo);
  }

  /** Formatea teléfono colombiano */
  getPlantaTelefonoFormateado() {
    const raw = this.planta.telefono;
    if (!raw) return '';
    const limpio = String(raw).replace(/\D/g, '');
    if (limpio.length === 10) return `+57 (${limpio.substring(0,3)}) ${limpio.substring(3,6)}-${limpio.substring(6)}`;
    if (limpio.length === 12 && limpio.startsWith('57')) {
      const n = limpio.substring(2);
      return `+57 (${n.substring(0,3)}) ${n.substring(3,6)}-${n.substring(6)}`;
    }
    return raw;
  }

  /** Formatea cédula/NIT con puntos */
  getPlantaIdFormateado() {
    const raw = this.planta.idPlanta;
    if (!raw) return '';
    return String(raw).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
}

/**
 * Calcula días hábiles (lun–vie) entre dos fechas.
 * @param {string|Date} inicio
 * @param {string|Date} fin
 * @returns {number}
 */
function _calcularDiasHabiles(inicio, fin) {
  const parse = (d) => {
    if (!d) return null;
    if (d instanceof Date) return d;
    const s = String(d).replace('T', ' ').trim();
    const sep = s.includes('/') ? '/' : (s.includes('-') ? '-' : null);
    if (sep) {
      const [datePart] = s.split(/\s+/);
      const parts = datePart.split(sep);
      if (parts.length === 3) {
        let dia, mes, anio;
        if (parts[0].length === 4) { anio = +parts[0]; mes = +parts[1] - 1; dia = +parts[2]; }
        else if (parts[2].length === 4) { dia = +parts[0]; mes = +parts[1] - 1; anio = +parts[2]; }
        else { dia = +parts[0]; mes = +parts[1] - 1; anio = +(parts[2].length === 2 ? '20' + parts[2] : parts[2]); }
        const date = new Date(anio, mes, dia);
        if (!isNaN(date.getTime())) return date;
      }
    }
    const fallback = new Date(d);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  const d1 = parse(inicio);
  const d2 = parse(fin);
  if (!d1 || !d2) return 0;

  const start = new Date(d1);
  const end   = new Date(d2);
  if (start > end) return 0;

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
