import { Producto, ProductoEntity } from '../../domain/entities/Producto';
import { ImportModeVO } from '../../domain/value-objects/ImportMode';

export interface PaginationOptions {
  page: number;
  size: number;
}

export interface FilterOptions {
  empresa?: string;
  marca?: string;
  q?: string;
}

export interface PaginationResult<T> {
  data: T[];
  count: number;
  page: number;
  size: number;
}

export interface ImportResult {
  ok: boolean;
  modo: string;
  recibidos: number;
  insertados: number;
  errores: string[];
}

export interface IProductoRepository {
  findAll(pagination: PaginationOptions, filters?: FilterOptions): Promise<PaginationResult<Producto>>;
  findById(id: string): Promise<Producto | null>;
  create(producto: Producto): Promise<Producto>;
  createBatch(productos: Producto[]): Promise<Producto[]>;
  update(id: string, producto: Partial<Producto>): Promise<Producto>;
  delete(id: string): Promise<void>;
  importProductos(productos: Producto[], mode: ImportModeVO): Promise<ImportResult>;
}
