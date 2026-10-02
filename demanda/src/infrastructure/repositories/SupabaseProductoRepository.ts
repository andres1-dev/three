import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  IProductoRepository,
  PaginationOptions,
  FilterOptions,
  PaginationResult,
  ImportResult,
} from '../../application/ports/IProductoRepository';
import { Producto } from '../../domain/entities/Producto';
import { ImportModeVO } from '../../domain/value-objects/ImportMode';

export class SupabaseProductoRepository implements IProductoRepository {
  private readonly client: SupabaseClient;
  private readonly batchSize = 300;

  constructor(supabaseUrl: string, supabaseKey: string, authHeader?: string) {
    const options = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : {};
    this.client = createClient(supabaseUrl, supabaseKey, options);
  }

  async findAll(pagination: PaginationOptions, filters?: FilterOptions): Promise<PaginationResult<Producto>> {
    const { page, size } = pagination;
    const from = (page - 1) * size;

    let query = this.client
      .from('productos')
      .select('*', { count: 'exact' });

    if (filters?.empresa) {
      query = query.eq('empresa', filters.empresa);
    }

    if (filters?.marca) {
      query = query.eq('marca', filters.marca);
    }

    if (filters?.q) {
      query = query.or(`referencia.ilike.%${filters.q}%,descripcion.ilike.%${filters.q}%`);
    }

    const { data, error, count } = await query
      .range(from, from + size - 1)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching productos: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      page,
      size,
    };
  }

  async findById(id: string): Promise<Producto | null> {
    const { data, error } = await this.client
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching producto: ${error.message}`);
    }

    return data;
  }

  async create(producto: Producto): Promise<Producto> {
    const { data, error } = await this.client
      .from('productos')
      .insert(producto)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating producto: ${error.message}`);
    }

    return data;
  }

  async createBatch(productos: Producto[]): Promise<Producto[]> {
    const { data, error } = await this.client
      .from('productos')
      .insert(productos)
      .select();

    if (error) {
      throw new Error(`Error creating productos: ${error.message}`);
    }

    return data || [];
  }

  async update(id: string, producto: Partial<Producto>): Promise<Producto> {
    const { data, error } = await this.client
      .from('productos')
      .update(producto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating producto: ${error.message}`);
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting producto: ${error.message}`);
    }
  }

  async importProductos(productos: Producto[], mode: ImportModeVO): Promise<ImportResult> {
    let insertados = 0;
    const errores: string[] = [];

    if (mode.isReplace()) {
      for (let i = 0; i < productos.length; i += this.batchSize) {
        const batch = productos.slice(i, i + this.batchSize);
        const { error } = await this.client
          .from('productos')
          .upsert(batch, { onConflict: 'empresa,referencia' });

        if (error) {
          errores.push(error.message);
        } else {
          insertados += batch.length;
        }
      }
    } else {
      for (let i = 0; i < productos.length; i += this.batchSize) {
        const batch = productos.slice(i, i + this.batchSize);
        const { error } = await this.client.rpc('upsert_productos_merge', {
          p_rows: batch,
        });

        if (error) {
          errores.push(error.message);
        } else {
          insertados += batch.length;
        }
      }
    }

    return {
      ok: errores.length === 0,
      modo: mode.value,
      recibidos: productos.length,
      insertados,
      errores,
    };
  }
}
