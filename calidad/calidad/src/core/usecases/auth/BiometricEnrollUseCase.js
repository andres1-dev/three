/**
 * BiometricEnrollUseCase.js
 * Registra una credencial WebAuthn para el usuario y la guarda en el vault.
 *
 * Dependencias inyectadas:
 *   - biometryService : BiometryService (infrastructure)
 *   - functionsUrl    : string (ENV.FUNCTIONS_URL)
 */
export class BiometricEnrollUseCase {
    /**
     * @param {{ biometryService: object, functionsUrl: string }} deps
     */
    constructor({ biometryService, functionsUrl }) {
        this.biometryService = biometryService;
        this.functionsUrl    = functionsUrl;
    }

    /**
     * Registra la biometría para el usuario.
     * @param {string} email       - Correo del usuario ya autenticado
     * @param {string} password    - Contraseña en texto plano (solo se usa en el servidor para el vault)
     * @returns {Promise<void>}
     */
    async execute(email, password) {
        if (!email || !password) {
            throw new Error('Se requieren email y contraseña para registrar la biometría.');
        }

        // 1. Crear credencial en el hardware del dispositivo
        const credentialId = await this.biometryService.createCredential(email);

        // 2. Registrar en el vault (Edge Function)
        const res = await fetch(`${this.functionsUrl}/biometric-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action:        'enroll',
                email,
                password,
                credential_id: credentialId,
            }),
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.error || 'Error al registrar en el servidor.');
        }

        // 3. Guardar mapeo local
        this.biometryService.saveCredential(email, credentialId);
    }
}
