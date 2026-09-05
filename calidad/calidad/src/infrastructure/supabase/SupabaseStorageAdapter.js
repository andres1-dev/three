import { IStorageService } from '../../core/ports/IStorageService.js';
import { getSupabaseClient } from './SupabaseClient.js';
import { ENV } from '../config/env.js';

/**
 * Adaptador para subir archivos a Supabase Storage con compresión
 */
export class SupabaseStorageAdapter extends IStorageService {
    constructor(bucket = 'archivos') {
        super();
        this.bucket = bucket;
        this.sb = getSupabaseClient();
    }

    _getClient() {
        if (!this.sb) this.sb = getSupabaseClient();
        return this.sb;
    }

    async uploadFile(file, folder = 'avatars') {
        const client = this._getClient();
        if (!client) throw new Error('Cliente de almacenamiento no disponible.');

        const ext = file.name ? file.name.split('.').pop() : 'jpg';
        const cleanName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const { data, error } = await client.storage
            .from(this.bucket)
            .upload(cleanName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            console.error('[StorageAdapter] Error al subir archivo:', error);
            throw error;
        }

        return this.getPublicUrl(data.path);
    }

    getPublicUrl(path) {
        const client = this._getClient();
        if (!client) return '';

        const { data } = client.storage.from(this.bucket).getPublicUrl(path);
        return data?.publicUrl || '';
    }
}
