import { ProgramacionItem } from '../../domain/ProgramacionItem.js';

export class AsentarProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(items, fechaPrograma, observacion, usuarioEditor) {
        if (!this.nubeService) {
            throw new Error('Servicio de nube no disponible');
        }

        if (!Array.isArray(items) || !items.length) {
            throw new Error('No hay datos para asentar');
        }

        if (!fechaPrograma) {
            throw new Error('Debe seleccionar una fecha de programación');
        }

        if (!usuarioEditor) {
            throw new Error('Debe especificar el usuario editor');
        }

        const validados = items.map(item => {
            const pi = new ProgramacionItem(item);
            if (!pi.numlote && !pi.ref) {
                throw new Error('Cada registro debe tener al menos NUMLOTE o REF');
            }
            return pi;
        });

        return await this.nubeService.asentarProgramacion(validados, fechaPrograma, observacion || '', usuarioEditor);
    }
}
