/**
 * Header Detector
 * Detección y validación de tipos de headers
 */

import { HEADER_SETS } from '../config/headerSets.js';

export class HeaderDetector {
    /**
     * Detecta qué conjunto de headers está presente (VALIDACIÓN FLEXIBLE)
     * Solo valida que los headers requeridos estén presentes, ignora extras
     * @param {Array} headers - Array de headers
     * @returns {string} Tipo detectado: 'CONFECCION', 'PROCESOS', 'UNKNOWN'
     */
    detect(headers) {
        // Verificar si tiene todos los headers de CONFECCION
        if (this.hasAllRequiredHeaders(headers, HEADER_SETS.CONFECCION)) {
            return 'CONFECCION';
        }
        
        // Verificar si tiene todos los headers de PROCESOS
        if (this.hasAllRequiredHeaders(headers, HEADER_SETS.PROCESOS)) {
            return 'PROCESOS';
        }
        
        return 'UNKNOWN';
    }

    /**
     * Verifica si todos los headers requeridos están presentes
     * @param {Array} headers - Headers recibidos
     * @param {Array} requiredHeaders - Headers requeridos
     * @returns {boolean} True si todos los headers requeridos están presentes
     */
    hasAllRequiredHeaders(headers, requiredHeaders) {
        // Verificar que TODOS los headers requeridos estén presentes
        for (const required of requiredHeaders) {
            if (!headers.includes(required)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Valida que los headers requeridos estén presentes
     * Las columnas extra se ignoran
     * @param {Array} headers - Array de headers
     * @param {string} type - Tipo de headers
     * @returns {Object} { valid, missing }
     */
    validate(headers, type) {
        const requiredHeaders = this.getExpectedHeaders(type);
        
        // Headers que faltan
        const missing = requiredHeaders.filter(h => !headers.includes(h));

        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Obtiene las diferencias entre headers recibidos y esperados
     * @param {Array} headers - Headers recibidos
     * @param {string} type - Tipo de formato
     * @returns {Object} { missing, totalDiff }
     */
    getDifferences(headers, type) {
        const requiredHeaders = this.getExpectedHeaders(type);
        
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        
        return {
            missing,
            totalDiff: missing.length
        };
    }

    /**
     * Obtiene TODOS los headers esperados según el tipo
     * @param {string} type - Tipo de headers
     * @returns {Array} Headers esperados completos
     */
    getExpectedHeaders(type) {
        if (type === 'CONFECCION') {
            return HEADER_SETS.CONFECCION;
        }
        
        if (type === 'PROCESOS') {
            return HEADER_SETS.PROCESOS;
        }
        
        return [];
    }
}
