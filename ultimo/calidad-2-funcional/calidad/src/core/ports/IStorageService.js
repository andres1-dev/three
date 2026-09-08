/**
 * Puerto de Salida: Servicio de Almacenamiento de Archivos e Imágenes
 */
export class IStorageService {
    async uploadFile(file, folder = 'avatars') {
        throw new Error('Method not implemented: uploadFile');
    }

    async getPublicUrl(path) {
        throw new Error('Method not implemented: getPublicUrl');
    }
}
