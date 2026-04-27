/**
 * Data Mapper
 * Mapeo de datos a formato JSON requerido
 */

export class DataMapper {
    /**
     * Mapea filas de datos al formato JSON
     * @param {Array} headers - Headers
     * @param {Array} rows - Filas de datos
     * @param {string} type - Tipo de formato
     * @returns {Array} Array de objetos JSON
     */
    map(headers, rows, type) {
        // Crear mapa de índices
        const headerIndexMap = this.createHeaderIndexMap(headers);

        // Seleccionar función de mapeo
        const mapFunction = type === 'CONFECCION' 
            ? this.mapConfeccionRow.bind(this)
            : this.mapProcesosRow.bind(this);

        // Mapear cada fila y filtrar filas vacías
        const mappedData = rows
            .map(row => mapFunction(row, headerIndexMap))
            .filter(item => this.isValidRow(item));

        return mappedData;
    }

    /**
     * Valida si una fila tiene datos válidos
     * @param {Object} row - Fila mapeada
     * @returns {boolean} True si la fila tiene datos válidos
     */
    isValidRow(row) {
        // Verificar que al menos tenga OP o Ref con datos
        const hasOP = row.OP && String(row.OP).trim().length > 0;
        const hasRef = row.Ref && String(row.Ref).trim().length > 0;
        
        // Si no tiene ni OP ni Ref, es una fila vacía
        if (!hasOP && !hasRef) {
            return false;
        }

        // Verificar que no sea una fila completamente vacía
        const values = Object.values(row);
        const hasAnyData = values.some(value => {
            if (value === null || value === undefined) {
                return false;
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                // Ignorar valores como "null", "undefined", "N/A", etc.
                if (trimmed === '' || 
                    trimmed.toLowerCase() === 'null' || 
                    trimmed.toLowerCase() === 'undefined' ||
                    trimmed.toLowerCase() === 'n/a') {
                    return false;
                }
                return trimmed.length > 0;
            }
            if (typeof value === 'number') {
                return !isNaN(value) && value !== 0;
            }
            return false;
        });

        return hasAnyData;
    }

    /**
     * Crea un mapa de índices de headers
     * @param {Array} headers - Headers
     * @returns {Object} Mapa header -> índice
     */
    createHeaderIndexMap(headers) {
        const map = {};
        headers.forEach((h, idx) => {
            map[h] = idx;
        });
        return map;
    }

    /**
     * Obtiene el valor de una celda y maneja valores vacíos
     * @param {Array} rowData - Datos de la fila
     * @param {Object} headerIndexMap - Mapa de índices
     * @param {string} headerName - Nombre del header
     * @returns {string} Valor de la celda (vacío si no existe)
     */
    getValue(rowData, headerIndexMap, headerName) {
        const idx = headerIndexMap[headerName];
        
        if (idx === undefined) {
            // Header no existe en el mapa
            return '';
        }
        
        if (idx >= rowData.length) {
            // Índice fuera de rango
            return '';
        }
        
        const cellValue = rowData[idx];
        
        // Manejar valores null, undefined o vacíos
        if (cellValue === null || cellValue === undefined) {
            return '';
        }
        
        const value = String(cellValue).trim();
        
        // Retornar vacío si es solo espacios o valores inválidos
        if (value === '' || 
            value.toLowerCase() === 'null' || 
            value.toLowerCase() === 'undefined' ||
            value.toLowerCase() === 'n/a' ||
            value === '-') {
            return '';
        }
        
        return value;
    }

    /**
     * Normaliza el campo Proceso quitando "SERVICIO" del inicio
     * Ejemplos:
     * - "SERVICIODETERMINACIÓN" -> "TERMINACIÓN"
     * - "SERVICIO SESGOS" -> "SESGOS"
     * - "CONFECCION" -> "CONFECCION" (sin cambios)
     * @param {string} proceso - Valor del proceso
     * @returns {string} Proceso normalizado
     */
    normalizeProceso(proceso) {
        if (!proceso) return '';
        
        // Convertir a mayúsculas para comparación
        const procesoUpper = proceso.toUpperCase().trim();
        
        // Caso 1: "SERVICIODETERMINACIÓN" -> quitar "SERVICIODE" y dejar "TERMINACIÓN"
        if (procesoUpper.startsWith('SERVICIODE')) {
            return proceso.substring(10).trim(); // Quita "SERVICIODE"
        }
        
        // Caso 2: "SERVICIO SESGOS" o "SERVICIO TERMINACIÓN" -> quitar "SERVICIO "
        if (procesoUpper.startsWith('SERVICIO ')) {
            return proceso.substring(9).trim(); // Quita "SERVICIO "
        }
        
        // Caso 3: "SERVICIO" solo -> quitar "SERVICIO"
        if (procesoUpper === 'SERVICIO') {
            return '';
        }
        
        // Si no tiene "SERVICIO" al inicio, devolver tal cual
        return proceso.trim();
    }

    /**
     * Normaliza el campo Cuento
     * Ejemplos:
     * - "HACEMOS MODA S2" -> "HACEMOS MODA"
     * - "Hacemos Moda S2" -> "HACEMOS MODA"
     * - "HACEMOS MODA" -> "HACEMOS MODA"
     * @param {string} cuento - Valor del cuento
     * @returns {string} Cuento normalizado
     */
    normalizeCuento(cuento) {
        if (!cuento) return '';
        
        // Convertir a mayúsculas y quitar espacios extras
        let normalizado = cuento.toUpperCase().trim();
        
        // Quitar " S2" si existe al final
        normalizado = normalizado.replace(/\s*S2\s*$/i, '');
        
        // Normalizar espacios múltiples a uno solo
        normalizado = normalizado.replace(/\s+/g, ' ');
        
        return normalizado.trim();
    }

    /**
     * Normaliza el campo Genero
     * Ejemplos:
     * - "MODA FEMENINA" -> "DAMA"
     * - "Moda Femenina" -> "DAMA"
     * - "FEMENINA" -> "DAMA"
     * - "MODA MASCULINA" -> "CABALLERO"
     * - "MASCULINA" -> "CABALLERO"
     * @param {string} genero - Valor del genero
     * @returns {string} Genero normalizado
     */
    normalizeGenero(genero) {
        if (!genero) return '';
        
        // Convertir a mayúsculas para comparación
        const generoUpper = genero.toUpperCase().trim();
        
        // Mapeo de géneros
        if (generoUpper.includes('FEMENINA') || generoUpper.includes('MUJER') || generoUpper.includes('DAMA')) {
            return 'DAMA';
        }
        
        if (generoUpper.includes('MASCULINA') || generoUpper.includes('HOMBRE') || generoUpper.includes('CABALLERO')) {
            return 'CABALLERO';
        }
        
        if (generoUpper.includes('NIÑA') || generoUpper.includes('NINA')) {
            return 'NIÑA';
        }
        
        if (generoUpper.includes('NIÑO') || generoUpper.includes('NINO')) {
            return 'NIÑO';
        }
        
        if (generoUpper.includes('UNISEX') || generoUpper.includes('MIXTO')) {
            return 'UNISEX';
        }
        
        // Si no coincide con ninguno, devolver tal cual
        return genero.trim();
    }

    /**
     * Normaliza fechas de formato "16-mar-26" a "2026-03-16"
     * @param {string} fecha - Fecha en formato "dd-mmm-yy"
     * @returns {string} Fecha en formato "YYYY-MM-DD"
     */
    normalizeFecha(fecha) {
        if (!fecha || !fecha.trim()) return '';
        
        const fechaTrim = fecha.trim();
        
        // Mapeo de meses en español
        const meses = {
            'ene': '01', 'enero': '01',
            'feb': '02', 'febrero': '02',
            'mar': '03', 'marzo': '03',
            'abr': '04', 'abril': '04',
            'may': '05', 'mayo': '05',
            'jun': '06', 'junio': '06',
            'jul': '07', 'julio': '07',
            'ago': '08', 'agosto': '08',
            'sep': '09', 'septiembre': '09',
            'oct': '10', 'octubre': '10',
            'nov': '11', 'noviembre': '11',
            'dic': '12', 'diciembre': '12'
        };
        
        // Intentar parsear formato "16-mar-26" o "16-marzo-26"
        const regex = /^(\d{1,2})-([a-zA-Z]+)-(\d{2})$/;
        const match = fechaTrim.match(regex);
        
        if (match) {
            const dia = match[1].padStart(2, '0');
            const mesTexto = match[2].toLowerCase();
            const anio = '20' + match[3]; // Asume siglo 20xx
            
            const mes = meses[mesTexto];
            
            if (mes) {
                return `${anio}-${mes}-${dia}`;
            }
        }
        
        // Si ya está en formato correcto o no se puede parsear, devolver tal cual
        return fechaTrim;
    }

    /**
     * Detecta el tipo de tejido de una descripción
     * Busca las palabras clave: PLANO, PUNTO, INDIGO
     * @param {string} descripcion - Descripción del producto
     * @returns {string} Tipo de tejido detectado o vacío
     */
    detectarTipoTejido(descripcion) {
        if (!descripcion) return '';
        
        const descripcionUpper = descripcion.toUpperCase().trim();
        
        // Buscar palabras clave en orden de prioridad
        if (descripcionUpper.includes('INDIGO') || descripcionUpper.includes('ÍNDIGO')) {
            return 'INDIGO';
        }
        
        if (descripcionUpper.includes('PUNTO')) {
            return 'PUNTO';
        }
        
        if (descripcionUpper.includes('PLANO')) {
            return 'PLANO';
        }
        
        // Si no se encuentra ninguna palabra clave
        return '';
    }

    /**
     * Mapea una fila del formato CONFECCION
     * @param {Array} rowData - Datos de la fila
     * @param {Object} headerIndexMap - Mapa de índices
     * @returns {Object} Objeto JSON mapeado
     */
    mapConfeccionRow(rowData, headerIndexMap) {
        const getValue = (headerName) => 
            this.getValue(rowData, headerIndexMap, headerName);

        // Obtener y normalizar el cuento
        const cuentoRaw = getValue('Cuento');
        const cuentoNormalizado = this.normalizeCuento(cuentoRaw);

        // Obtener y normalizar el genero
        const generoRaw = getValue('Linea');
        const generoNormalizado = this.normalizeGenero(generoRaw);

        // Obtener y normalizar fechas
        const fechaSalidaRaw = getValue('FechaSalda');
        const fechaSalidaNormalizada = this.normalizeFecha(fechaSalidaRaw);
        
        const fechaEntradaRaw = getValue('FechaEntrada');
        const fechaEntradaNormalizada = this.normalizeFecha(fechaEntradaRaw);

        // Detectar tipo de tejido de la descripción
        const descripcionRaw = getValue('desclarga');
        const tipoTejido = this.detectarTipoTejido(descripcionRaw);

        return {
            "OP": getValue('Numlote'),
            "Ref": getValue('Ref'),
            "InvPlanta": parseInt(getValue('Total')) || 0,
            "NombrePlanta": getValue('Nombre'),
            "FSalidaConf": fechaSalidaNormalizada,
            "FEntregaConf": fechaEntradaNormalizada,
            "Proceso": getValue('Proceso') || 'CONFECCION',
            "Descripcion": getValue('Categoria de Producto'),
            "Cuento": cuentoNormalizado,
            "Genero": generoNormalizado,
            "Obs": getValue('Obs Salida'),
            // "Tipo Tejido": tipoTejido,
            // "pvp": getValue('Total'),
            // "OS": getValue('RefExt'),
            // "TS": getValue('Obs Salida'),
            "Costo": getValue('Costo Conf+Term')
            // "Descripcionlarga": getValue('desclarga'),

        };
    }

    /**
     * Mapea una fila del formato PROCESOS
     * @param {Array} rowData - Datos de la fila
     * @param {Object} headerIndexMap - Mapa de índices
     * @returns {Object} Objeto JSON mapeado
     */
    mapProcesosRow(rowData, headerIndexMap) {
        const getValue = (headerName) => 
            this.getValue(rowData, headerIndexMap, headerName);

        // Obtener y normalizar el proceso
        const procesoRaw = getValue('Proceso');
        const procesoNormalizado = this.normalizeProceso(procesoRaw);

        // Obtener y normalizar el cuento
        const cuentoRaw = getValue('Cuento');
        const cuentoNormalizado = this.normalizeCuento(cuentoRaw);

        // Obtener y normalizar el genero
        const generoRaw = getValue('Linea');
        const generoNormalizado = this.normalizeGenero(generoRaw);

        // Obtener y normalizar fechas
        const fechaSalidaRaw = getValue('FechaSal');
        const fechaSalidaNormalizada = this.normalizeFecha(fechaSalidaRaw);
        
        const fechaEntregaRaw = getValue('FechaEntrega');
        const fechaEntregaNormalizada = this.normalizeFecha(fechaEntregaRaw);

        return {
            "OP": getValue('NumLote'),
            "Ref": getValue('Ref'),
            "InvPlanta": parseInt(getValue('Total')) || 0,
            "NombrePlanta": getValue('Planta'),
            "FSalidaConf": fechaSalidaNormalizada,
            "FEntregaConf": fechaEntregaNormalizada,
            "Proceso": procesoNormalizado,
            "Descripcion": getValue('Categoria'),
            "Cuento": cuentoNormalizado,
            "Genero": generoNormalizado,
            "Obs": getValue('Obs'),
            // "Tipo Tejido": getValue('Proceso') || '',
            // "pvp": getValue('Total'),
            // "OS": getValue('RefExt'),
            // "TS": getValue('Obs'),
            "Costo": getValue('Cant Minutos')
            // "Descripcionlarga": getValue('desclarga')
        };
    }
}
