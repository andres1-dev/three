/**
 * BiometryService.js
 * Servicio de detección y gestión de autenticación biométrica (WebAuthn).
 * Compatible con Face ID, Touch ID, Windows Hello, Huella Digital Android.
 * No depende de ningún framework ni librería externa.
 */

/** Clave de localStorage donde se almacena el mapa email → credential_id */
export const BIOMETRY_MAP_KEY = 'calidad_biometric_ids';

export const BiometryService = {

    /**
     * Verifica si el dispositivo soporta autenticación biométrica/plataforma.
     * @returns {Promise<boolean>}
     */
    async isSupported() {
        try {
            return !!(
                window.PublicKeyCredential &&
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            );
        } catch (_) {
            return false;
        }
    },

    /**
     * Detecta el tipo probable de autenticador del dispositivo.
     * @returns {'faceid'|'touchid'|'fingerprint'|'windows_hello'|'generic'}
     */
    getAuthenticatorType() {
        const ua       = navigator.userAgent.toLowerCase();
        const platform = (navigator.platform || '').toLowerCase();

        if (/iphone|ipad|ipod/.test(ua)) {
            const ratio = window.devicePixelRatio || 1;
            const h = window.screen.height * ratio;
            const w = window.screen.width  * ratio;
            return (h / w > 2) ? 'faceid' : 'touchid';
        }
        if (/android/.test(ua))              return 'fingerprint';
        if (/win/.test(platform))            return 'windows_hello';
        if (/mac|linux/.test(platform))      return 'touchid';
        return 'generic';
    },

    /**
     * Etiqueta legible del autenticador detectado.
     * @returns {string}
     */
    getLabel() {
        const map = {
            faceid:         'Face ID',
            touchid:        'Touch ID',
            fingerprint:    'Huella Digital',
            windows_hello:  'Windows Hello',
            generic:        'Biometría',
        };
        return map[this.getAuthenticatorType()] || 'Biometría';
    },

    /**
     * SVG inline del icono del autenticador detectado.
     * @returns {string} HTML string con el SVG
     */
    getIcon() {
        const type = this.getAuthenticatorType();
        const icons = {
            faceid: `<svg viewBox="0 0 80 80" fill="currentColor" aria-hidden="true">
                <path fill-rule="nonzero" d="M4.114,21.943L4.114,13.029C4.114,7.993,7.993,4.114,13.029,4.114L21.943,4.114C23.079,4.114,24,3.193,24,2.057C24,0.921,23.079,0,21.943,0L13.029,0C5.721,0,0,5.721,0,13.029L0,21.943C0,23.079,0.921,24,2.057,24C3.193,24,4.114,23.079,4.114,21.943Z"/>
                <g transform="translate(68.07,11.93) scale(-1,1) translate(-68.07,-11.93) translate(56.14,0)">
                    <path fill-rule="nonzero" d="M4.114,21.943L4.114,13.029C4.114,7.993,7.993,4.114,13.029,4.114L21.943,4.114C23.079,4.114,24,3.193,24,2.057C24,0.921,23.079,0,21.943,0L13.029,0C5.721,0,0,5.721,0,13.029L0,21.943C0,23.079,0.921,24,2.057,24C3.193,24,4.114,23.079,4.114,21.943Z"/>
                </g>
                <g transform="translate(11.93,68.07) scale(1,-1) translate(-11.93,-68.07) translate(0,56.14)">
                    <path fill-rule="nonzero" d="M4.114,21.943L4.114,13.029C4.114,7.993,7.993,4.114,13.029,4.114L21.943,4.114C23.079,4.114,24,3.193,24,2.057C24,0.921,23.079,0,21.943,0L13.029,0C5.721,0,0,5.721,0,13.029L0,21.943C0,23.079,0.921,24,2.057,24C3.193,24,4.114,23.079,4.114,21.943Z"/>
                </g>
                <g transform="translate(68.07,68.07) scale(-1,-1) translate(-68.07,-68.07) translate(56.14,56.14)">
                    <path fill-rule="nonzero" d="M4.114,21.943L4.114,13.029C4.114,7.993,7.993,4.114,13.029,4.114L21.943,4.114C23.079,4.114,24,3.193,24,2.057C24,0.921,23.079,0,21.943,0L13.029,0C5.721,0,0,5.721,0,13.029L0,21.943C0,23.079,0.921,24,2.057,24C3.193,24,4.114,23.079,4.114,21.943Z"/>
                </g>
                <path d="M21.754,30.213L21.754,35.931C21.754,37.114,22.65,38.074,23.754,38.074C24.859,38.074,25.754,37.114,25.754,35.931L25.754,30.213C25.754,29.03,24.859,28.07,23.754,28.07C22.65,28.07,21.754,29.03,21.754,30.213Z"/>
                <path d="M54.737,30.213L54.737,35.931C54.737,37.114,55.632,38.074,56.737,38.074C57.841,38.074,58.737,37.114,58.737,35.931L58.737,30.213C58.737,29.03,57.841,28.07,56.737,28.07C55.632,28.07,54.737,29.03,54.737,30.213Z"/>
                <path d="M25.932,59.083C29.833,62.724,34.558,64.561,40,64.561C45.442,64.561,50.167,62.724,54.068,59.083C54.918,58.29,54.964,56.957,54.171,56.107C53.377,55.257,52.045,55.211,51.195,56.005C48.079,58.913,44.382,60.351,40,60.351C35.618,60.351,31.921,58.913,28.805,56.005C27.955,55.211,26.623,55.257,25.829,56.107C25.036,56.957,25.082,58.29,25.932,59.083Z"/>
                <path d="M40,30.175L40,44.912C40,45.855,39.539,46.316,38.591,46.316L37.193,46.316C36.03,46.316,35.088,47.258,35.088,48.421C35.088,49.584,36.03,50.526,37.193,50.526L38.591,50.526C41.863,50.526,44.211,48.182,44.211,44.912L44.211,30.175C44.211,29.013,43.268,28.07,42.105,28.07C40.943,28.07,40,29.013,40,30.175Z"/>
            </svg>`,

            fingerprint: `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
                <path d="M7,5.21a.77.77,0,0,1-.46-1.38A15.46,15.46,0,0,1,16,1c2.66,0,6.48.45,9.5,2.62a.77.77,0,0,1,.18,1.07.78.78,0,0,1-1.08.17A15,15,0,0,0,16,2.53,14,14,0,0,0,7.5,5.05A.74.74,0,0,1,7,5.21Z"/>
                <path d="M28.23,12.26a.78.78,0,0,1-.63-.33C25.87,9.49,22.78,6.24,16,6.24a14,14,0,0,0-11.63,5.7.77.77,0,0,1-1.07.17A.76.76,0,0,1,3.15,11,15.54,15.54,0,0,1,16,4.71c5.61,0,9.81,2.08,12.84,6.34a.77.77,0,0,1-.19,1.07A.79.79,0,0,1,28.23,12.26Z"/>
                <path d="M12.28,31a.78.78,0,0,1-.72-.49.75.75,0,0,1,.44-1c4.37-1.68,7-5.12,7-9.21a2.8,2.8,0,0,0-3-3c-1.86,0-2.76,1-3,3.35a4.27,4.27,0,0,1-4.52,3.83,4.27,4.27,0,0,1-4.32-4.59A11.71,11.71,0,0,1,16,8.39a12,12,0,0,1,12,11.93,18.66,18.66,0,0,1-1.39,6.5.78.78,0,0,1-1,.41.76.76,0,0,1-.41-1,17.25,17.25,0,0,0,1.27-5.91A10.45,10.45,0,0,0,16,9.92a10.18,10.18,0,0,0-10.38,10,2.77,2.77,0,0,0,2.79,3.06,2.74,2.74,0,0,0,3-2.48c.36-3.11,1.89-4.69,4.56-4.69a4.31,4.31,0,0,1,4.52,4.56c0,4.74-3,8.72-8,10.63A.92.92,0,0,1,12.28,31Z"/>
                <path d="M19.77,30.28a.81.81,0,0,1-.52-.2.76.76,0,0,1,0-1.08,12.63,12.63,0,0,0,3.54-8.68c0-1.56-.48-6.65-6.7-6.65a6.83,6.83,0,0,0-4.94,1.87A6.17,6.17,0,0,0,9.32,20a.77.77,0,0,1-.77.76h0A.76.76,0,0,1,7.78,20,7.73,7.73,0,0,1,10,14.46a8.34,8.34,0,0,1,6-2.32c6.08,0,8.24,4.4,8.24,8.18A14.09,14.09,0,0,1,20.34,30,.75.75,0,0,1,19.77,30.28Z"/>
                <path d="M8.66,27.74a14.14,14.14,0,0,1-1.56-.09.76.76,0,1,1,.17-1.52c2.49.28,4.45-.16,5.84-1.32a6.37,6.37,0,0,0,2.12-4.53.75.75,0,0,1,.82-.71.78.78,0,0,1,.72.81A7.89,7.89,0,0,1,14.09,26,8.2,8.2,0,0,1,8.66,27.74Z"/>
            </svg>`,

            touchid: `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
                <path d="M7,5.21a.77.77,0,0,1-.46-1.38A15.46,15.46,0,0,1,16,1c2.66,0,6.48.45,9.5,2.62a.77.77,0,0,1,.18,1.07.78.78,0,0,1-1.08.17A15,15,0,0,0,16,2.53,14,14,0,0,0,7.5,5.05A.74.74,0,0,1,7,5.21Z"/>
                <path d="M28.23,12.26a.78.78,0,0,1-.63-.33C25.87,9.49,22.78,6.24,16,6.24a14,14,0,0,0-11.63,5.7.77.77,0,0,1-1.07.17A.76.76,0,0,1,3.15,11,15.54,15.54,0,0,1,16,4.71c5.61,0,9.81,2.08,12.84,6.34a.77.77,0,0,1-.19,1.07A.79.79,0,0,1,28.23,12.26Z"/>
                <path d="M12.28,31a.78.78,0,0,1-.72-.49.75.75,0,0,1,.44-1c4.37-1.68,7-5.12,7-9.21a2.8,2.8,0,0,0-3-3c-1.86,0-2.76,1-3,3.35a4.27,4.27,0,0,1-4.52,3.83,4.27,4.27,0,0,1-4.32-4.59A11.71,11.71,0,0,1,16,8.39a12,12,0,0,1,12,11.93,18.66,18.66,0,0,1-1.39,6.5.78.78,0,0,1-1,.41.76.76,0,0,1-.41-1,17.25,17.25,0,0,0,1.27-5.91A10.45,10.45,0,0,0,16,9.92a10.18,10.18,0,0,0-10.38,10,2.77,2.77,0,0,0,2.79,3.06,2.74,2.74,0,0,0,3-2.48c.36-3.11,1.89-4.69,4.56-4.69a4.31,4.31,0,0,1,4.52,4.56c0,4.74-3,8.72-8,10.63A.92.92,0,0,1,12.28,31Z"/>
                <path d="M19.77,30.28a.81.81,0,0,1-.52-.2.76.76,0,0,1,0-1.08,12.63,12.63,0,0,0,3.54-8.68c0-1.56-.48-6.65-6.7-6.65a6.83,6.83,0,0,0-4.94,1.87A6.17,6.17,0,0,0,9.32,20a.77.77,0,0,1-.77.76h0A.76.76,0,0,1,7.78,20,7.73,7.73,0,0,1,10,14.46a8.34,8.34,0,0,1,6-2.32c6.08,0,8.24,4.4,8.24,8.18A14.09,14.09,0,0,1,20.34,30,.75.75,0,0,1,19.77,30.28Z"/>
                <path d="M8.66,27.74a14.14,14.14,0,0,1-1.56-.09.76.76,0,1,1,.17-1.52c2.49.28,4.45-.16,5.84-1.32a6.37,6.37,0,0,0,2.12-4.53.75.75,0,0,1,.82-.71.78.78,0,0,1,.72.81A7.89,7.89,0,0,1,14.09,26,8.2,8.2,0,0,1,8.66,27.74Z"/>
            </svg>`,

            windows_hello: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="4"/>
                <circle cx="12" cy="10" r="3"/>
                <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
            </svg>`,

            generic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>
            </svg>`,
        };
        return icons[type] || icons.generic;
    },

    // ──────────────────────────────────────────────────────────
    // Mapa local (localStorage): email → credential_id (Base64url)
    // ──────────────────────────────────────────────────────────

    /** @returns {Record<string, string>} */
    getMap() {
        try {
            return JSON.parse(localStorage.getItem(BIOMETRY_MAP_KEY) || '{}');
        } catch (_) {
            return {};
        }
    },

    /** @param {string} email  @param {string} credentialIdB64 */
    saveCredential(email, credentialIdB64) {
        const map = this.getMap();
        map[email.toLowerCase()] = credentialIdB64;
        localStorage.setItem(BIOMETRY_MAP_KEY, JSON.stringify(map));
    },

    /** @param {string} email @returns {string|null} */
    getCredentialId(email) {
        return this.getMap()[email.toLowerCase()] || null;
    },

    /** Elimina todas las credenciales guardadas localmente */
    clearMap() {
        localStorage.removeItem(BIOMETRY_MAP_KEY);
    },

    /** @param {string} email @returns {boolean} */
    hasCredential(email) {
        return !!this.getCredentialId(email);
    },

    // ──────────────────────────────────────────────────────────
    // WebAuthn helpers
    // ──────────────────────────────────────────────────────────

    /**
     * Crea una credencial WebAuthn (registro).
     * @param {string} email
     * @returns {Promise<string>} credentialId en Base64url
     */
    async createCredential(email) {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge,
                rp: { name: 'Grupo TDM', id: window.location.hostname },
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: email,
                    displayName: email,
                },
                pubKeyCredParams: [
                    { alg: -7,   type: 'public-key' },
                    { alg: -257, type: 'public-key' },
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                },
                timeout: 60000,
            },
        });

        if (!credential) throw new Error('El usuario canceló el registro.');

        return this._rawIdToB64url(/** @type {PublicKeyCredential} */ (credential).rawId);
    },

    /**
     * Solicita una aserción WebAuthn (autenticación).
     * @param {string} credentialIdB64 - credential_id en Base64url
     * @returns {Promise<void>}
     */
    async assertCredential(credentialIdB64) {
        const binaryId = this._b64urlToUint8(credentialIdB64);
        await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: 'public-key', id: binaryId }],
                userVerification: 'required',
                timeout: 60000,
            },
        });
    },

    // ──────────────────────────────────────────────────────────
    // Utilidades de codificación
    // ──────────────────────────────────────────────────────────

    /** @param {ArrayBuffer} rawId @returns {string} */
    _rawIdToB64url(rawId) {
        return btoa(String.fromCharCode(...new Uint8Array(rawId)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    },

    /** @param {string} b64url @returns {Uint8Array} */
    _b64urlToUint8(b64url) {
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    },
};
