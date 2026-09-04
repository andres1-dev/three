/**
 * Puerto de Salida: Servicio de Acceso a Datos
 * Define el contrato de persistencia y lectura de entidades.
 */
export class IDataService {
    async getUsers(options = {}) {
        throw new Error('Method not implemented: getUsers');
    }

    async getPlants(options = {}) {
        throw new Error('Method not implemented: getPlants');
    }

    async getUserByCedula(cedula) {
        throw new Error('Method not implemented: getUserByCedula');
    }

    async updateUser(cedula, updates) {
        throw new Error('Method not implemented: updateUser');
    }

    async updatePersonaUser(payload) {
        throw new Error('Method not implemented: updatePersonaUser');
    }

    async updatePersonaPlant(payload) {
        throw new Error('Method not implemented: updatePersonaPlant');
    }

    async createPersonaUser(payload) {
        throw new Error('Method not implemented: createPersonaUser');
    }

    async createPersonaPlant(payload) {
        throw new Error('Method not implemented: createPersonaPlant');
    }

    async getMasterLotes(options = {}) {
        throw new Error('Method not implemented: getMasterLotes');
    }
}
