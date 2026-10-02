export interface Producto {
  id?: string;
  empresa: string;
  referencia: string;
  ref_proveedor?: string | null;
  descripcion?: string | null;
  f_grupo?: string | null;
  f_subgrupo?: string | null;
  marca?: string | null;
  precio?: number | null;
  total_ventas?: number | null;
  despacho?: number | null;
  pct_rot?: number | null;
  inv_pv?: number | null;
  transito?: number | null;
  inv_cedi?: number | null;
  ventas_mes?: Record<string, number | null>;
  updated_at?: string;
}

export interface PaginationResult {
  data: Producto[];
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
  error?: string;
}

export type ImportMode = 'merge' | 'replace';

export interface AuthSession {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}
