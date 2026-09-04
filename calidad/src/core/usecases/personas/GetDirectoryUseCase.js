import { User } from '../../domain/models/User.js';
import { Plant } from '../../domain/models/Plant.js';

/**
 * Caso de Uso: Obtener y filtrar directorio (Usuarios y Talleres/Plantas)
 */
export class GetDirectoryUseCase {
    constructor(dataService, cacheService = null) {
        this.dataService = dataService;
        this.cacheService = cacheService;
    }

    async getUsers({ query = '', rol = null } = {}) {
        let users = [];
        const cacheKey = 'DIR_USERS';

        if (this.cacheService) {
            const cached = this.cacheService.get(cacheKey);
            if (cached && Array.isArray(cached) && cached.length) {
                users = cached.map(u => u instanceof User ? u : User.fromRecord(u));
            }
        }

        if (!users || users.length === 0) {
            const rawUsers = await this.dataService.getUsers();
            users = (rawUsers || []).map(u => u instanceof User ? u : User.fromRecord(u));
            if (this.cacheService && users.length) {
                this.cacheService.set(cacheKey, users, 10 * 60 * 1000); // 10 min TTL
            }
        }

        // Aplicar filtros en memoria
        let filtered = [...users];
        if (rol) {
            filtered = filtered.filter(u => u.rol === rol);
        }
        if (query) {
            const q = query.toLowerCase().trim();
            filtered = filtered.filter(u =>
                (u.nombre || '').toLowerCase().includes(q) ||
                (u.cedula || '').includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.planta || '').toLowerCase().includes(q) ||
                (u.cargo || '').toLowerCase().includes(q)
            );
        }

        return filtered;
    }

    async getPlants({ query = '' } = {}) {
        let plants = [];
        const cacheKey = 'DIR_PLANTS';

        if (this.cacheService) {
            const cached = this.cacheService.get(cacheKey);
            if (cached && Array.isArray(cached) && cached.length) {
                plants = cached.map(p => p instanceof Plant ? p : Plant.fromRecord(p));
            }
        }

        if (!plants || plants.length === 0) {
            const rawPlants = await this.dataService.getPlants();
            plants = (rawPlants || []).map(p => p instanceof Plant ? p : Plant.fromRecord(p));
            if (this.cacheService && plants.length) {
                this.cacheService.set(cacheKey, plants, 15 * 60 * 1000); // 15 min TTL
            }
        }

        let filtered = [...plants];
        if (query) {
            const q = query.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.nombre || '').toLowerCase().includes(q) ||
                (p.nit || '').includes(q) ||
                (p.contacto || '').toLowerCase().includes(q) ||
                (p.municipio || '').toLowerCase().includes(q)
            );
        }

        return filtered;
    }
}
