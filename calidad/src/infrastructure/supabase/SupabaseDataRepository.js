import { IDataService } from '../../core/ports/IDataService.js';
import { getSupabaseClient } from './SupabaseClient.js';
import { ENV } from '../config/env.js';
import { TableNames } from '../../core/domain/constants/TableNames.js';
import { User } from '../../core/domain/models/User.js';
import { Plant } from '../../core/domain/models/Plant.js';

/**
 * Repositorio de datos conectado a Supabase.
 *
 * IMPORTANTE: Las tablas `usuarios` y `plantas` NO son accesibles directamente
 * desde el SDK con el key anon (RLS + schema custom). Exactamente como hace el
 * proyecto original (calidad/), se usan las Edge Functions:
 *   - /personas  → LISTAR_USUARIOS, LISTAR_PLANTAS
 *   - /perfiles  → OBTENER_PERFIL, ACTUALIZAR_PERFIL, SUBIR_FOTO
 *
 * Solo `master` y similares se acceden por SDK directo.
 */
export class SupabaseDataRepository extends IDataService {
    constructor() {
        super();
        this.sb = getSupabaseClient();
        this._usersCache = null;
        this._plantsCache = null;
    }

    _isCacheEnabled() {
        if (typeof window !== 'undefined' && typeof window.__CALIDAD_ENABLE_CACHE__ === 'boolean') {
            return window.__CALIDAD_ENABLE_CACHE__;
        }
        return Boolean(ENV.ENABLE_CACHE);
    }

    _getClient() {

        if (!this.sb) this.sb = getSupabaseClient();
        return this.sb;
    }

    /**
     * Obtiene el access_token de la sesión activa.
     * Primero intenta el SDK; si no, lee localStorage directamente.
     */
    async _getAccessToken() {
        try {
            const client = this._getClient();
            if (client) {
                const { data } = await client.auth.getSession();
                if (data?.session?.access_token) return data.session.access_token;
            }
        } catch (_) {}

        // Fallback: leer directamente del localStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k) || 'null');
                    if (s?.access_token) return s.access_token;
                }
            }
        } catch (_) {}

        return ENV.SUPABASE_KEY; // Fallback al key anon
    }

    /**
     * Llama a la Edge Function /personas (igual que fetchUsuariosData en original)
     */
    async _callPersonas(accion, extra = {}) {
        const token = await this._getAccessToken();
        const resp = await fetch(`${ENV.FUNCTIONS_URL}/personas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': ENV.SUPABASE_KEY
            },
            body: JSON.stringify({ accion, ...extra })
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => resp.status);
            throw new Error(`[personas/${accion}] HTTP ${resp.status}: ${text}`);
        }
        return resp.json();
    }

    // ── USUARIOS ──────────────────────────────────────────────────────────────

    async getUsers(options = {}) {
        try {
            // Usar caché en memoria solo si el interruptor de caché está activo
            if (this._isCacheEnabled() && this._usersCache) {
                return this._filterUsers(this._usersCache, options);
            }

            const result = await this._callPersonas('LISTAR_USUARIOS');
            const raw = result.data || [];
            const users = raw.map(User.fromRecord);

            if (this._isCacheEnabled()) {
                this._usersCache = users;
                // Limpiar caché después de 10 min
                setTimeout(() => { this._usersCache = null; }, 10 * 60 * 1000);
            } else {
                this._usersCache = null;
            }

            return this._filterUsers(users, options);
        } catch (err) {
            console.error('[DataRepository] Error al obtener usuarios:', err);
            return [];
        }
    }


    _filterUsers(users, options = {}) {
        if (!options.query) return users;
        const q = options.query.toLowerCase();
        return users.filter(u =>
            (u.nombre || '').toLowerCase().includes(q) ||
            (u.cedula || '').includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.cargo || '').toLowerCase().includes(q) ||
            (u.planta || '').toLowerCase().includes(q)
        );
    }

    /**
     * Busca un usuario por cédula o email en la lista completa de usuarios.
     * Carga todos y filtra en memoria (igual que el original).
     */
    async getUserByCedula(cedulaOrEmail) {
        if (!cedulaOrEmail) return null;
        const key = String(cedulaOrEmail).trim().toLowerCase();

        try {
            const all = await this.getUsers();
            let found = all.find(u => {
                const ced   = String(u.cedula || '').trim().toLowerCase();
                const email = String(u.email  || '').trim().toLowerCase();
                const id    = String(u.id     || '').trim().toLowerCase();
                return ced === key || email === key || id === key;
            });

            // Si no se encuentra como usuario, buscar en plantas (para cuentas USER-P)
            if (!found) {
                const plants = await this.getPlants();
                const plant = plants.find(p => {
                    const nit   = String(p.nit    || '').trim().toLowerCase();
                    const email = String(p.email  || '').trim().toLowerCase();
                    const id    = String(p.id     || '').trim().toLowerCase();
                    const name  = String(p.nombre || '').trim().toLowerCase();
                    return nit === key || email === key || id === key || name === key;
                });
                if (plant) {
                    found = User.fromRecord({
                        id: plant.id,
                        cedula: plant.nit,
                        nombre: plant.nombre,
                        email: plant.email,
                        rol: 'USER-P',
                        planta: plant.nombre,
                        telefono: plant.telefono,
                        ciudad: plant.municipio,
                        direccion: plant.direccion
                    });
                }
            }

            return found || null;
        } catch (err) {
            console.warn('[DataRepository] getUserByCedula:', err);
            return null;
        }
    }

    // ── PLANTAS ───────────────────────────────────────────────────────────────

    async getPlants(options = {}) {
        try {
            if (this._isCacheEnabled() && this._plantsCache) {
                return this._filterPlants(this._plantsCache, options);
            }

            const result = await this._callPersonas('LISTAR_PLANTAS');
            const raw = result.data || [];
            const plants = raw.map(Plant.fromRecord);

            if (this._isCacheEnabled()) {
                this._plantsCache = plants;
                setTimeout(() => { this._plantsCache = null; }, 15 * 60 * 1000);
            } else {
                this._plantsCache = null;
            }

            return this._filterPlants(plants, options);
        } catch (err) {
            console.error('[DataRepository] Error al obtener plantas:', err);
            return [];
        }
    }

    _filterPlants(plants, options = {}) {
        if (!options.query) return plants;
        const q = options.query.toLowerCase();
        return plants.filter(p =>
            (p.nombre || '').toLowerCase().includes(q) ||
            (p.nit    || '').includes(q) ||
            (p.municipio || '').toLowerCase().includes(q) ||
            (p.contacto  || '').toLowerCase().includes(q)
        );
    }

    // ── ACTUALIZAR PERFIL ─────────────────────────────────────────────────────

    /**
     * Actualiza datos del perfil vía Edge Function /perfiles (ACTUALIZAR_PERFIL).
     * Exactamente como hace perfil-editor.js en el proyecto original.
     */
    async updateUser(identifier, updates) {
        const token = await this._getAccessToken();

        // Mapear campos al formato esperado por Edge Function /perfiles
        const perfilPayload = {
            accion: 'ACTUALIZAR_PERFIL'
        };

        if (identifier && !updates.cedula && !updates.auth_user_id) {
            // Puede ser cédula o UUID
            if (String(identifier).includes('-')) {
                perfilPayload.auth_user_id = identifier;
            } else {
                perfilPayload.cedula = identifier;
            }
        }

        if (updates.nombre !== undefined || updates.full_name !== undefined) {
            perfilPayload.full_name = updates.full_name || updates.nombre;
            perfilPayload.USUARIO   = updates.full_name || updates.nombre;
        }
        if (updates.cedula !== undefined) {
            perfilPayload.cedula = updates.cedula;
            perfilPayload.CEDULA = updates.cedula;
        }
        if (updates.email !== undefined) {
            perfilPayload.email  = updates.email;
            perfilPayload.EMAIL  = updates.email;
            perfilPayload.CORREO = updates.email;
        }
        if (updates.telefono !== undefined) {
            perfilPayload.telefono = updates.telefono;
            perfilPayload.TELEFONO = updates.telefono;
        }
        if (updates.cargo !== undefined) {
            perfilPayload.cargo = updates.cargo;
            perfilPayload.CARGO = updates.cargo;
        }
        if (updates.area !== undefined) {
            perfilPayload.area = updates.area;
            perfilPayload.AREA = updates.area;
        }
        if (updates.cumpleanos !== undefined || updates.fecha_nacimiento !== undefined) {
            const f = updates.fecha_nacimiento !== undefined ? updates.fecha_nacimiento : updates.cumpleanos;
            perfilPayload.fecha_nacimiento = f ? f : null;
            perfilPayload.FECHA_NACIMIENTO = f ? f : null;
        }
        if (updates.fechaIngreso !== undefined || updates.fecha_contratacion !== undefined) {
            const fi = updates.fecha_contratacion !== undefined ? updates.fecha_contratacion : updates.fechaIngreso;
            perfilPayload.fecha_contratacion = fi ? fi : null;
            perfilPayload.FECHA_CONTRATACION = fi ? fi : null;
        }
        if (updates.antiguedad !== undefined) {
            perfilPayload.antiguedad = updates.antiguedad;
            perfilPayload.ANTIGUEDAD = updates.antiguedad;
        }
        if (updates.productora !== undefined) {
            perfilPayload.productora = updates.productora;
            perfilPayload.PRODUCTORA = updates.productora;
        }
        if (updates.id_productora !== undefined) {
            perfilPayload.id_productora = (updates.id_productora !== null && updates.id_productora !== '') ? Number(updates.id_productora) : null;
        }
        if (updates.sede !== undefined) {
            perfilPayload.sede = updates.sede;
            perfilPayload.SEDE = updates.sede;
        }
        if (updates.pais !== undefined) {
            perfilPayload.pais = updates.pais;
            perfilPayload.PAIS = updates.pais;
        }
        if (updates.departamento !== undefined) {
            perfilPayload.departamento = updates.departamento;
            perfilPayload.DEPARTAMENTO = updates.departamento;
        }
        if (updates.ciudad !== undefined) {
            perfilPayload.ciudad = updates.ciudad;
            perfilPayload.CIUDAD = updates.ciudad;
        }
        if (updates.direccion !== undefined) {
            perfilPayload.direccion = updates.direccion;
            perfilPayload.DIRECCION = updates.direccion;
        }
        if (updates.barrio !== undefined) {
            perfilPayload.barrio = updates.barrio;
            perfilPayload.BARRIO = updates.barrio;
        }
        if (updates.foto_url !== undefined) {
            perfilPayload.foto_url = updates.foto_url;
        }
        if (updates.portada_url !== undefined) {
            perfilPayload.portada_url = updates.portada_url;
        }
        if (updates.estado_personalizado !== undefined) {
            perfilPayload.estado_personalizado = updates.estado_personalizado;
        }

        const resp = await fetch(`${ENV.FUNCTIONS_URL}/perfiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': ENV.SUPABASE_KEY
            },
            body: JSON.stringify(perfilPayload)
        });

        const resJson = await resp.json().catch(() => ({}));
        if (!resp.ok || !resJson.success) {
            const errText = resJson.message || resJson.error || `HTTP ${resp.status}`;
            console.error('[DataRepository] updateUser /perfiles error:', errText);
            throw new Error(`Error en Supabase: ${errText}`);
        }

        // Invalidar caché para que el próximo getUsers() traiga datos frescos
        this._usersCache = null;

        // Retornar el usuario actualizado
        const ced = updates.cedula || identifier;
        return ced ? this.getUserByCedula(ced) : null;
    }

    // ── GESTIÓN DE PERSONAS (Edge Function /personas) ──────────────────────────

    /**
     * Actualiza un colaborador en Auth y tabla usuarios vía Edge Function /personas (UPDATE_USER)
     */
    async updatePersonaUser(payload) {
        this._usersCache = null;
        return this._callPersonas('UPDATE_USER', payload);
    }

    /**
     * Actualiza un taller/planta vía Edge Function /personas (ACTUALIZAR_PLANTA)
     */
    async updatePersonaPlant(payload) {
        this._plantsCache = null;
        return this._callPersonas('ACTUALIZAR_PLANTA', payload);
    }

    /**
     * Crea un nuevo usuario en Auth y tabla usuarios vía Edge Function /personas (CREAR_USUARIO)
     */
    async createPersonaUser(payload) {
        this._usersCache = null;
        return this._callPersonas('CREAR_USUARIO', payload);
    }

    /**
     * Crea una nueva planta/taller vía Edge Function /personas (CREAR_PLANTA)
     */
    async createPersonaPlant(payload) {
        this._plantsCache = null;
        return this._callPersonas('CREAR_PLANTA', payload);
    }

    // ── MASTER / LOTES ────────────────────────────────────────────────────────

    async getMasterLotes(options = {}) {
        const client = this._getClient();
        if (!client) return [];
        try {
            const { data, error } = await client
                .from(TableNames.MASTER)
                .select('*')
                .limit(options.limit || 50);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[DataRepository] Error al consultar master/lotes:', err);
            return [];
        }
    }
}
