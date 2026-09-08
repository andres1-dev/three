import { ProgramacionItem } from '../../domain/ProgramacionItem.js';

export class SaveProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(items, usuarioEditor, proveedor) {
        if (!this.nubeService) {
            throw new Error('Servicio de nube no disponible');
        }

        if (!Array.isArray(items) || !items.length) {
            throw new Error('Debe proporcionar al menos un registro de programación');
        }

        if (!usuarioEditor) {
            throw new Error('Debe especificar el usuario editor');
        }

        if (!proveedor) {
            throw new Error('Debe especificar el proveedor');
        }

        const validados = items.map(item => {
            const pi = new ProgramacionItem(item);
            if (!pi.numlote && !pi.ref) {
                throw new Error('Cada registro debe tener al menos NUMLOTE o REF');
            }
            return pi;
        });

        return await this.nubeService.guardarProgramacion(validados, usuarioEditor, proveedor);
    }
}
