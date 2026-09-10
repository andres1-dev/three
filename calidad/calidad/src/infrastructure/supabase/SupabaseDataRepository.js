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

    // ── EDGE FUNCTION /FORMULARIOS ───────────────────────────────────────────

    /**
     * Llama a la Edge Function /formularios
     */
    async _callFormularios(payload = {}) {
        const token = await this._getAccessToken();
        const resp = await fetch(`${ENV.FUNCTIONS_URL}/formularios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': ENV.SUPABASE_KEY
            },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => resp.status);
            throw new Error(`[formularios] HTTP ${resp.status}: ${text}`);
        }
        return resp.json();
    }

    /**
     * Lista las productoras activas exclusivamente vía Edge Function /formularios
     */
    async getProductoras() {
        try {
            const res = await this._callFormularios({ accion: 'LISTAR_PRODUCTORAS' });
            if (res && res.data) return res.data;
        } catch (err) {
            console.error('[DataRepository] Error al listar productoras vía Edge Function:', err);
        }
        return [];
    }

    /**
     * Obtiene lotes para el selector de formularios exclusivamente vía Edge Function /formularios
     */
    async getLotes({ query = '', planta = '', productora = '', limit = 50, searchConfig = null } = {}) {
        try {
            const payload = {
                accion: 'LISTAR_LOTES',
                query,
                planta,
                productora,
                limit
            };

            // Incluir configuración de búsqueda si está disponible
            if (searchConfig) {
                payload.searchConfig = searchConfig;
            }

            const res = await this._callFormularios(payload);
            if (res && res.data) return res.data;
        } catch (err) {
            console.error('[DataRepository] Error al obtener lotes vía Edge Function:', err);
        }
        return [];
    }

    /**
     * Obtiene la CURVA (extensiones talla x color) de una OP vía Edge Function
     * /formularios. Clave: id_productora + op (lo que el usuario acepta).
     */
    async getCurvaOP({ op = 0, idProductora = '' } = {}) {
        try {
            const res = await this._callFormularios({
                accion: 'LISTAR_CURVA',
                op,
                idProductora
            });
            if (res && res.data) return res.data;
        } catch (err) {
            console.error('[DataRepository] Error al obtener curva de la OP vía Edge Function:', err);
        }
        return [];
    }

    /**
     * Lista plantillas de calidad por tipo ('PAQUETEO' | 'ETIQUETA').
     * @param {string} tipo
     * @returns {Promise<Array<{id:number, tipo:string, texto:string}>>}
     */
    async getPlantillas(tipo = '') {
        try {
            const res = await this._callFormularios({ accion: 'LISTAR_PLANTILLAS', tipo });
            return res?.data || [];
        } catch (err) {
            console.error('[DataRepository] Error al listar plantillas:', err);
            return [];
        }
    }

    /**
     * Crea una plantilla de calidad.
     * @param {{ tipo: string, texto: string }} plantilla
     */
    async createPlantilla({ tipo, texto }) {
        const res = await this._callFormularios({ accion: 'CREAR_PLANTILLA', tipo, texto });
        if (!res?.success) throw new Error(res?.message || 'Error al crear plantilla.');
        return res.data;
    }

    /**
     * Elimina una plantilla por id.
     * @param {number} id
     */
    async deletePlantilla(id) {
        const res = await this._callFormularios({ accion: 'ELIMINAR_PLANTILLA', id });
        if (!res?.success) throw new Error(res?.message || 'Error al eliminar plantilla.');
        return true;
    }

    /**
     * Envía reporte de Novedad a Supabase con mapeo exacto de esquema y fallback SDK
     */
    async submitNovedad(novedad) {
        // Desglose dinámico estructurado para JSONB nativo
        let tipoDetalle = null;
        if (Array.isArray(novedad.insumos) && novedad.insumos.length > 0) {
            tipoDetalle = novedad.insumos;
        } else if (Array.isArray(novedad.telas) && novedad.telas.length > 0) {
            tipoDetalle = novedad.telas;
        } else if (Array.isArray(novedad.cortes) && novedad.cortes.length > 0) {
            tipoDetalle = novedad.cortes;
        } else if (Array.isArray(novedad.codigos) && novedad.codigos.length > 0) {
            tipoDetalle = novedad.codigos;
        } else if (novedad.tipo_detalle) {
            try {
                tipoDetalle = typeof novedad.tipo_detalle === 'string' ? JSON.parse(novedad.tipo_detalle) : novedad.tipo_detalle;
            } catch (_) {
                tipoDetalle = novedad.tipo_detalle;
            }
        }

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const bogotaDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
        const ymd = `${bogotaDate.getFullYear()}${pad(bogotaDate.getMonth() + 1)}${pad(bogotaDate.getDate())}`;
        const fechaBogota = `${bogotaDate.getFullYear()}-${pad(bogotaDate.getMonth() + 1)}-${pad(bogotaDate.getDate())}T${pad(bogotaDate.getHours())}:${pad(bogotaDate.getMinutes())}:${pad(bogotaDate.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}-05:00`;
        
        const prodId = Number(novedad.idProductora || novedad.id_productora || novedad.productora) || 1;
        const nombreProductora = novedad.nombreProductora || novedad.productoraNombre || novedad.productora_nombre || '';
        // El consecutivo id_novedad (NOV{YYYYMMDD}-{COUNT}) lo genera la Edge
        // Function /formularios consultando la tabla `novedades`; NO se calcula
        // aquí para no romper el correlativo creciente de la tabla.

        // 1. Imágenes: enviar TODAS las fotos en `imagenes` para que la Edge
        //    Function /formularios las suba y las guarde SEPARADAS POR COMA en
        //    la columna (mismo formato legacy: "url1,url2,url3").
        //    `imagen` sigue siendo la primera, por compatibilidad.
        const fotosNovedad = Array.isArray(novedad.fotos) ? novedad.fotos : [];
        const imagenesNov = fotosNovedad
            .filter(f => f && f.base64)
            .map(f => ({
                base64: f.base64,
                mimeType: f.mimeType || f.type || 'image/jpeg',
                fileName: f.fileName || f.name || 'foto.jpg'
            }));
        const imagenPayload = imagenesNov.length
            ? imagenesNov[0]
            : (typeof novedad.imagen === 'string' ? novedad.imagen : '');

        const cleanPayload = {
            hoja: 'NOVEDADES',
            fecha: fechaBogota,
            lote: Number(novedad.lote || novedad.op || novedad.id) || 0,
            referencia: novedad.referencia || '',
            cantidad: Number(novedad.cantidadTotal || novedad.cantidad_total || 0),
            planta: novedad.planta || '',
            salida: novedad.salida || novedad.fecha_salida || null,
            cuento: novedad.cuento || novedad.modulo || novedad.linea || null,
            proceso: (novedad.proceso || 'CONFECCION').toUpperCase(),
            prenda: novedad.prenda || novedad.tipoPrenda || novedad.descripcion || '',
            genero: novedad.genero || '',
            area: novedad.area || '',
            tipo_novedad: novedad.tipoNovedad || novedad.tipo_novedad || '',
            tipo_detalle: tipoDetalle,
            descripcion: novedad.observaciones || novedad.descripcion || '',
            cantidad_solicitada: Number(novedad.cantidadSolicitada || novedad.cantidad_solicitada || novedad.cantidad || 0),
            imagen: imagenPayload,
            imagenes: imagenesNov.length ? imagenesNov : undefined,
            estado: 'PENDIENTE',
            idProductora: prodId,
            nombreProductora: nombreProductora,
            auditor: novedad.auditor || novedad.auditorNombre || '',
            correo: novedad.email || novedad.correo || '',
            tejido: novedad.tejido || null,
            comentarios: novedad.comentarios || ''
        };

        // Envío obligatorio y exclusivo a través de Edge Function /formularios
        const res = await this._callFormularios(cleanPayload);
        if (res && res.success) {
            return {
                success: true,
                message: res.message || `Novedad ${res.id_novedad} registrada exitosamente.`,
                id_novedad: res.id_novedad,
                data: res.data
            };
        }

        throw new Error(res?.message || 'Error al registrar la novedad en el servidor.');
    }

    /**
     * Envía auditoría de Calidad a Edge Function /formularios
     */
    async submitCalidad(calidadReport) {
        // Normalizar evidencias: enviar TODAS las fotos en `imagenes` (array de
        // { base64, mimeType, fileName }) para que la Edge Function /formularios
        // las suba y las guarde SEPARADAS POR COMA en `soporte` (mismo formato
        // del legacy uploadArchivoAsync: "url1,url2,url3").
        // `imagen` se mantiene con la primera por compatibilidad.

        const payload = { ...calidadReport };
        const fotosCal = Array.isArray(payload.fotos) ? payload.fotos : [];
        const imagenesCal = fotosCal
            .filter(f => f && f.base64)
            .map(f => ({
                base64: f.base64,
                mimeType: f.mimeType || f.type || 'image/jpeg',
                fileName: f.fileName || f.name || 'foto.jpg'
            }));
        if (imagenesCal.length > 0) {
            payload.imagenes = imagenesCal;
            if (typeof payload.imagen !== 'object' || !payload.imagen?.base64) {
                payload.imagen = imagenesCal[0];
            }
        }
        delete payload.fotos;

        return this._callFormularios({
            accion: 'REPORTE_CALIDAD',
            hoja: 'REPORTES',
            ...payload
        });
    }

    /**
     * Envía visita de Rutero a Edge Function /formularios
     */
    async submitRutero(ruteroItem) {
        return this._callFormularios({
            hoja: 'RUTERO',
            ...ruteroItem
        });
    }

    /**
     * Actualiza datos técnicos de planta a Edge Function /formularios
     */
    async updatePlantaDatos(plantaData) {
        this._plantsCache = null;
        return this._callFormularios({
            accion: 'ACTUALIZAR_PLANTA',
            ...plantaData
        });
    }

    // ── MASTER / LOTES LEGACY COMPAT ──────────────────────────────────────────

    async getMasterLotes(options = {}) {
        return this.getLotes(options);
    }
}
