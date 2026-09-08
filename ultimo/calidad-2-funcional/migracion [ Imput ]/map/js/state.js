/**
 * Centralized Application State (Programación)
 */
import { CONFIG } from './config.js';

export const state = {
    // GAS Web App URL
    gasWebAppUrl: localStorage.getItem('gas_webapp_url') || CONFIG.DEFAULT_GAS_URL
};
