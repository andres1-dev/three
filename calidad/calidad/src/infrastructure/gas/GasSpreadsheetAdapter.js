import { ENV } from '../config/env.js';

/**
 * Adaptador para interactuar con Google Apps Script y Google Sheets
 */
export class GasSpreadsheetAdapter {
    constructor(endpoint = ENV.GAS_ENDPOINT) {
        this.endpoint = endpoint;
    }

    async sendReport(hoja, data) {
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
