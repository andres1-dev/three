/**
 * Data Processor
 * Servicio principal de procesamiento de datos
 */

import { DataParser } from './DataParser.js';
import { HeaderDetector } from './HeaderDetector.js';
import { DataMapper } from './DataMapper.js';

export class DataProcessor {
    constructor() {
        this.parser = new DataParser();
        this.detector = new HeaderDetector();
        this.mapper = new DataMapper();
        
        this.currentData = {
            headers: [],
            rows: [],
            jsonData: [],
            detectedType: ''
        };
    }

    /**
     * Procesa los datos crudos
     * @param {string} rawData - Datos en formato texto
     * @returns {Object} Resultado del procesamiento
     */
    process(rawData) {
        try {
            // 1. Parsear datos
            const { headers, rows } = this.parser.parse(rawData);
            
            if (headers.length === 0) {
                return {
                    success: false,
                    error: 'Error: No se detectaron columnas'
                };
            }

            // 2. Detectar tipo de headers (FLEXIBLE - ignora columnas extra)
            const detectedType = this.detector.detect(headers);
            
            if (detectedType === 'UNKNOWN') {
                // Intentar determinar cuál formato es más cercano
                const confeccionDiff = this.detector.getDifferences(headers, 'CONFECCION');
                const procesosDiff = this.detector.getDifferences(headers, 'PROCESOS');
                
                // Usar el formato con menos diferencias
                const closestFormat = confeccionDiff.totalDiff <= procesosDiff.totalDiff ? 'CONFECCION' : 'PROCESOS';
                const diff = closestFormat === 'CONFECCION' ? confeccionDiff : procesosDiff;
                
                let errorMsg = `Headers no reconocidos.\n\nFormato más cercano: ${closestFormat}\n`;
                
                if (diff.missing.length > 0) {
                    errorMsg += `\n❌ Faltan estos headers requeridos:\n   ${diff.missing.join('\n   ')}`;
                }
                
                errorMsg += `\n\n💡 Asegúrese de que todos los headers requeridos estén presentes.`;
                errorMsg += `\n💡 Las columnas extra serán ignoradas automáticamente.`;
                
                return {
                    success: false,
                    error: errorMsg
                };
            }

            // 3. Validar headers requeridos (columnas extra se ignoran)
            const validation = this.detector.validate(headers, detectedType);
            
            if (!validation.valid) {
                let errorMsg = 'Error de validación de headers:\n';
                
                if (validation.missing.length > 0) {
                    errorMsg += `\n❌ Faltan estos headers requeridos:\n   ${validation.missing.join('\n   ')}`;
                }
                
                errorMsg += `\n\n✅ Formato detectado: ${detectedType}`;
                errorMsg += `\n💡 Las columnas extra serán ignoradas automáticamente.`;
                
                return {
                    success: false,
                    error: errorMsg
                };
            }

            // 4. Mapear datos (filtra filas vacías automáticamente)
            const jsonData = this.mapper.map(headers, rows, detectedType);

            // Verificar que haya datos válidos después del filtrado
            if (jsonData.length === 0) {
                return {
                    success: false,
                    error: 'No se encontraron filas con datos válidos después del procesamiento.'
                };
            }

            // 5. Guardar estado
            this.currentData = {
                headers,
                rows,
                jsonData,
                detectedType
            };

            return {
                success: true,
                headers,
                rows,
                jsonData,
                detectedType
            };

        } catch (error) {
            console.error('Error en DataProcessor:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene los datos JSON generados
     * @returns {Array}
     */
    getJSONData() {
        return this.currentData.jsonData;
    }

    /**
     * Resetea el estado del procesador
     */
    reset() {
        this.currentData = {
            headers: [],
            rows: [],
            jsonData: [],
            detectedType: ''
        };
    }
}
