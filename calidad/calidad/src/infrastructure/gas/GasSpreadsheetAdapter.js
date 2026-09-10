import { ENV } from '../config/env.js';

/**
 * Adaptador para interactuar con Google Apps Script y Google Sheets
 * NOTA: Este adaptador es legacy. Los nuevos reportes deben usar la Edge Function /emails con Resend.
 */
export class GasSpreadsheetAdapter {
    constructor(endpoint = null) {
        // Legacy: endpoint puede ser null ahora que usamos Resend
        // Se mantiene por compatibilidad hacia atrás
        this.endpoint = endpoint;
    }

    async sendReport(hoja, data) {
        if (!this.endpoint) {
            console.warn('[GasAdapter] Endpoint no configurado. Omitiendo envío a Google Sheets.');
            return { success: true };
        }

        const payload = {
            hoja,
            data,
            timestamp: new Date().toISOString()
        };

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                mode: 'no-cors' // Google Apps Script redirects require no-cors in simple clients
            });
            return { success: true };
        } catch (err) {
            console.error('[GasAdapter] Error al enviar reporte:', err);
            throw err;
        }
    }
}
