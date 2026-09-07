/**
 * API Module: Google Apps Script Integrator (Asentar Programación)
 */
import { CONFIG } from './config.js';
import { state } from './state.js';

export async function asentarProgramacionToGAS(rows, fechaPrograma, observacion) {
    const url = state.gasWebAppUrl || CONFIG.DEFAULT_GAS_URL;
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'asentardespachosn',
            rows: rows,
            fechaPrograma: fechaPrograma,
            observacion: observacion || ''
        }),
        mode: 'no-cors'
    });
}
