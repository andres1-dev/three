/**
 * BiometricLoginUseCase.js
 * Autentica al usuario mediante biometría WebAuthn.
 *
 * Dependencias inyectadas:
 *   - biometryService : BiometryService (infrastructure)
 *   - authService     : IAuthService (para setSession)
 *   - functionsUrl    : string (ENV.FUNCTIONS_URL)
 */
export class BiometricLoginUseCase {
    /**
     * @param {{ biometryService: object, authService: object, functionsUrl: string }} deps
     */
    constructor({ biometryService, authService, functionsUrl }) {
        this.biometryService = biometryService;
        this.authService     = authService;
        this.functionsUrl    = functionsUrl;
    }

    /**
     * Inicia sesión con biometría.
     * @param {string} email - Correo del usuario a autenticar
     * @returns {Promise<void>} Resuelve si la autenticación fue exitosa
     * @throws {Error} Si la biometría falla o no hay credencial registrada
     */
    async execute(email) {
        if (!email) throw new Error('Email requerido para la autenticación biométrica.');

        const credentialId = this.biometryService.getCredentialId(email);
        if (!credentialId) {
            throw new Error('No hay biometría registrada para este usuario.');
        }

        // 1. Verificar biometría en el hardware (lanza NotAllowedError si el usuario cancela)
        await this.biometryService.assertCredential(credentialId);

        // 2. Obtener sesión del servidor
        const res = await fetch(`${this.functionsUrl}/biometric-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action:        'authenticate',
                email,
                credential_id: credentialId,
            }),
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.error || 'Error de autenticación en el servidor.');
        }

        // 3. Establecer la sesión en el cliente Supabase
        const supabaseClient = this.authService._getClient?.();
        if (!supabaseClient) throw new Error('Cliente Supabase no disponible.');

        const { error } = await supabaseClient.auth.setSession(result.session);
        if (error) throw new Error('No se pudo establecer la sesión: ' + error.message);
    }
}
