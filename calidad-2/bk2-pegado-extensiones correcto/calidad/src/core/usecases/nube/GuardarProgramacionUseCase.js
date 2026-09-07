export class GuardarProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(data) {
        if (!data) throw new Error('Datos de programación requeridos.');
        if (!Array.isArray(data.rows) || data.rows.length === 0) {
            throw new Error('No hay filas de programación para guardar.');
        }
        if (!data.idProductora) throw new Error('Debe indicar la productora.');
        if (!data.productora) throw new Error('Debe indicar el nombre de la productora.');
        if (!data.usuarioEmail) throw new Error('No hay usuario autenticado para registrar la edición.');

        return await this.nubeService.guardarProgramacion({
            rows: data.rows,
            idProductora: data.idProductora,
            productora: data.productora,
            usuarioEmail: data.usuarioEmail,
            usuarioNombre: data.usuarioNombre || ''
        });
    }
}
