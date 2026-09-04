/**
 * Casos de Uso para el perfil de usuario: lectura y actualización
 *
 * FLUJO IDÉNTICO AL ORIGINAL (calidad/public/js/auth.js + perfil/script.js):
 *
 * Original auth.js loadUsers():
 *   1. Llama POST /personas { accion: 'LISTAR_USUARIOS' }
 *   2. Busca match: u.find(x => x.ID_USUARIO === currentUser.ID_USUARIO)
 *      → ID_USUARIO en la EF es: perfil?.cedula || meta.cedula || authUser.id (UUID)
 *      → ID_USUARIO en currentUser es: meta.id_usuario || user.id (también UUID si no hay cedula)
 *   3. Object.assign(window.currentUser, real) — la BD tiene prioridad
 *
 * Original perfil/script.js init():
 *   1. _waitForUser(5000) → currentUser ya enriquecido
 *   2. _fetchPerfilExtra() → POST /perfiles { accion: 'OBTENER_PERFIL' }
 *      → if (!resp.ok) return null;  ← SILENCIOSO si falla
 *   3. Merge extra (foto_url, portada_url, estado_personalizado)
 *   4. _populateFields(root, u)
 */
import { ENV } from '../../../infrastructure/config/env.js';
import { User } from '../../domain/models/User.js';

export class GetProfileUseCase {
    constructor(dataService, authService) {
        this.dataService = dataService;
        this.authService = authService;
    }

    /**
     * POST /perfiles { accion: 'OBTENER_PERFIL' }
     * Igual que el original: if (!resp.ok) return null; — nunca bloquea
     */
    async _fetchPerfilExtra(accessToken) {
        if (!accessToken || accessToken === ENV.SUPABASE_KEY) return null;
        try {
            const resp = await fetch(`${ENV.FUNCTIONS_URL}/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': ENV.SUPABASE_KEY
                },
                body: JSON.stringify({ accion: 'OBTENER_PERFIL' })
            });
            if (!resp.ok) return null;  // Silencioso — igual que el original
            const result = await resp.json();
            return result.success ? result.data : null;
        } catch (e) {
            console.warn('[GetProfileUseCase] No se pudo obtener perfil extra:', e.message);
            return null;
        }
    }

    async execute(cedula = null) {
        // ─── PASO 1: Sesión activa (token + datos básicos de auth) ────────────
        let accessToken = null;
        let authUUID = null;   // UUID de Supabase Auth — clave primaria para matchear
        let authEmail = null;
        let authMeta = {};

        try {
            if (this.authService && typeof this.authService.getSession === 'function') {
                const session = await this.authService.getSession();
                if (session) {
                    accessToken = session.accessToken;
                    authUUID  = session.user?.id;
                    authEmail = session.user?.email;
                    authMeta  = session.user?._rawMeta || {};
                }
            }
        } catch (err) {
            console.warn('[GetProfileUseCase] Error al obtener sesión:', err);
        }

        // Fallback directo desde localStorage (igual que fetchUsuariosData en original)
        if (!accessToken || !authUUID) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k || !k.includes('-auth-token')) continue;
                    const s = JSON.parse(localStorage.getItem(k) || 'null');
                    if (s?.access_token && s?.user) {
                        accessToken = s.access_token;
                        authUUID    = s.user.id;
                        authEmail   = s.user.email;
                        authMeta    = s.user.user_metadata || {};
                        break;
                    }
                }
            } catch (_) {}
        }

        if (!authUUID && !authEmail) {
            // Sin sesión — usuario demo
            return new User({
                id: 'demo-user',
                cedula: '00000000',
                nombre: 'Colaborador Grupo TDM',
                email: 'usuario@grupotdm.com',
                rol: 'GUEST'
            });
        }

        // ─── PASO 2: POST /personas LISTAR_USUARIOS → enriquecer ─────────────
        // Igual que loadUsers() en auth.js original:
        //   busca match por ID_USUARIO (= auth UUID cuando no hay cedula)
        //   o por email como fallback
        let dbRaw = null;

        if (this.dataService && typeof this.dataService.getUsers === 'function') {
            try {
                // getUsers() llama POST /personas { accion: 'LISTAR_USUARIOS' }
                // que devuelve usuarios con id = authUser.id (UUID) y email
                const allUsers = await this.dataService.getUsers();

                // Match 1: por auth UUID (más confiable, igual al original por ID_USUARIO)
                if (authUUID) {
                    dbRaw = allUsers.find(u =>
                        String(u.id || '').trim() === authUUID
                    ) || null;
                }

                // Match 2: por email (fallback exacto igual al original)
                if (!dbRaw && authEmail) {
                    const lc = authEmail.toLowerCase();
                    dbRaw = allUsers.find(u =>
                        (u.email || '').toLowerCase() === lc
                    ) || null;
                }
            } catch (err) {
                console.warn('[GetProfileUseCase] Error al cargar usuarios desde /personas:', err);
            }
        }

        // ─── PASO 3: Construir usuario final ──────────────────────────────────
        // La BD tiene prioridad; lo que falta se completa desde auth
        // Igual que: Object.assign(window.currentUser, real)
        let finalUser;

        if (dbRaw) {
            // Usuario encontrado en la BD — usar sus datos directamente
            finalUser = dbRaw;
            // Completar email si falta (la BD puede no tenerlo explícito)
            if (!finalUser.email && authEmail) finalUser.email = authEmail;
        } else {
            // No encontrado en BD — construir desde auth metadata (igual que _buildCurrentUser)
            finalUser = User.fromRecord({
                id:        authUUID,
                cedula:    authMeta.cedula || '',
                nombre:    authMeta.full_name || authMeta.name || authMeta.USUARIO || authEmail,
                email:     authEmail,
                rol:       authMeta.role || authMeta.ROL || 'GUEST',
                telefono:  authMeta.phone || authMeta.telefono || '',
                productora: authMeta.productora || authMeta.PRODUCTORA || '',
                foto_url:  authMeta.avatar_url || authMeta.foto_url || ''
            });
        }

        // ─── PASO 4: POST /perfiles OBTENER_PERFIL ────────────────────────────
        // Igual que _fetchPerfilExtra() en perfil/script.js:
        //   solo foto_url, portada_url, estado_personalizado
        //   si falla → null → se ignora SILENCIOSAMENTE
        const isViewingSelf = !cedula ||
            cedula === authUUID ||
            cedula === authEmail ||
            (finalUser && cedula === finalUser.cedula);

        if (isViewingSelf && accessToken) {
            const extra = await this._fetchPerfilExtra(accessToken);
            if (extra) {
                // Merge igual que el original:
                if (extra.foto_url)             finalUser.fotoUrl             = extra.foto_url;
                if (extra.portada_url)          finalUser.portadaUrl          = extra.portada_url;
                if (extra.estado_personalizado) finalUser.estadoPersonalizado = extra.estado_personalizado;
                // Campos adicionales que /perfiles puede tener más actualizados
                if (extra.cedula)               finalUser.cedula              = extra.cedula;
                if (extra.email)                finalUser.email               = extra.email;
                if (extra.full_name)            finalUser.nombre              = extra.full_name;
                if (extra.cargo)                finalUser.cargo               = extra.cargo;
                if (extra.area)                 finalUser.area                = extra.area;
                if (extra.telefono)             finalUser.telefono            = extra.telefono;
                if (extra.fecha_nacimiento)     finalUser.cumpleanos          = extra.fecha_nacimiento;
                if (extra.fecha_contratacion)   finalUser.fechaIngreso        = extra.fecha_contratacion;
                if (extra.antiguedad)           finalUser.antiguedad          = extra.antiguedad;
                if (extra.productora)           finalUser.productora          = extra.productora;
                if (extra.id_productora)        finalUser.idProductora        = extra.id_productora;
                if (extra.sede)                 finalUser.sede                = extra.sede;
                if (extra.pais)                 finalUser.pais                = extra.pais;
                if (extra.departamento)         finalUser.departamento        = extra.departamento;
                if (extra.ciudad)               finalUser.ciudad              = extra.ciudad;
                if (extra.direccion)            finalUser.direccion           = extra.direccion;
                if (extra.barrio)               finalUser.barrio              = extra.barrio;
            }
        }

        // Fusión de rescate: si la BD no tenía cédula, teléfono o productora, rescatar de Auth metadata
        if (!finalUser.cedula && (authMeta.cedula || authMeta.ID_USUARIO)) {
            finalUser.cedula = authMeta.cedula || authMeta.ID_USUARIO;
        }
        if (!finalUser.telefono && (authMeta.phone || authMeta.telefono)) {
            finalUser.telefono = authMeta.phone || authMeta.telefono;
        }
        if (!finalUser.productora && authMeta.productora) {
            finalUser.productora = authMeta.productora;
        }
        if (!finalUser.idProductora && authMeta.id_productora) {
            finalUser.idProductora = authMeta.id_productora;
        }

        return finalUser;
    }
}

export class UpdateProfileUseCase {
    constructor(dataService, storageService = null) {
        this.dataService = dataService;
        this.storageService = storageService;
    }

    async execute(identifier, updates, newAvatarFile = null) {
        const patch = { ...updates };

        if (newAvatarFile && this.storageService) {
            const avatarUrl = await this.storageService.uploadFile(newAvatarFile, 'avatars');
            if (avatarUrl) patch.foto_url = avatarUrl;
        }

        return await this.dataService.updateUser(identifier, patch);
    }
}

