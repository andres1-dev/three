import { Producto, PaginationResult, ImportResult, ImportMode } from '../types';

const SUPABASE_URL = "https://obawmpfnjiazyyugsrms.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iYXdtcGZuamlhenl5dWdzcm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzUxNDYsImV4cCI6MjEwNjAxMTE0Nn0.SKaQcQP7LKZzoswU5PnE-kcgLAfJxkrOz0udUxVnqRc";

export class ProductoService {
  /** Campos que se guardan SIEMPRE como enteros (sin .00 / ,00) en Supabase */
  private static readonly INTEGER_FIELDS = ['precio', 'total_ventas', 'despacho', 'inv_pv', 'transito', 'inv_cedi'];

  private static normalizeNumericFields(producto: Producto): Producto {
    const normalized: any = { ...producto };

    this.INTEGER_FIELDS.forEach(field => {
      const value = normalized[field];
      if (value !== null && value !== undefined && value !== '') {
        normalized[field] = this.toInteger(value);
      }
    });

    // pct_rot puede tener decimales reales: 1.0000 => 1
    if (normalized.pct_rot !== null && normalized.pct_rot !== undefined && normalized.pct_rot !== '') {
      normalized.pct_rot = this.toDecimal(normalized.pct_rot);
    }

    // Normalizar ventas_mes (siempre enteros)
    if (normalized.ventas_mes) {
      const ventasMes: Record<string, number> = {};
      Object.entries(normalized.ventas_mes).forEach(([key, value]) => {
        ventasMes[key] = this.toInteger(value);
      });
      normalized.ventas_mes = ventasMes;
    }

    return normalized as Producto;
  }

  private static toNumber(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    let str = String(value).trim();
    if (str === '') {
      return null;
    }

    // Formato contable: (1234) => -1234
    const entreParentesis = /^\((.*)\)$/.exec(str);
    if (entreParentesis) {
      str = entreParentesis[1];
    }

    // Quita símbolos de moneda ($), %, espacios (incluye NBSP) y letras
    str = str.replace(/[^0-9.,-]/g, '');
    if (str === '' || str === '-' || str === '.' || str === ',') {
      return null;
    }

    const tieneComa = str.includes(',');
    const tienePunto = str.includes('.');

    if (tieneComa && tienePunto) {
      // El último separador es el decimal: 27.990,55 / 27,990.55
      str = str.lastIndexOf(',') > str.lastIndexOf('.')
        ? str.replace(/\./g, '').replace(',', '.')
        : str.replace(/,/g, '');
    } else if (tieneComa) {
      // 1,234 => miles | 1234,5 => decimal
      str = /^-?\d{1,3}(,\d{3})+$/.test(str) ? str.replace(/,/g, '') : str.replace(',', '.');
    } else if (tienePunto) {
      // 27.990 => miles (formato colombiano) | 27990.00 => decimal
      str = /^-?\d{1,3}(\.\d{3})+$/.test(str) ? str.replace(/\./g, '') : str;
    }

    const num = Number(str);
    if (!Number.isFinite(num)) {
      return null;
    }

    return entreParentesis ? -Math.abs(num) : num;
  }

  /** Convierte a entero: 27990.00 / "27.990,00" / "27990" => 27990 */
  private static toInteger(value: any): number {
    const num = this.toNumber(value);
    return num === null ? 0 : Math.round(num);
  }

  /**
   * Convierte a número con máximo de decimales indicado, sin ceros sobrantes.
   * Para pct_rot (porcentaje) se usan 6 decimales: no se pierde ningún valor.
   * 1.0000 => 1 | 1.003054730589733 => 1.003055
   */
  private static toDecimal(value: any, decimales = 6): number {
    const num = this.toNumber(value);
    return num === null ? 0 : Number(num.toFixed(decimales));
  }

  private static getHeaders(accessToken: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    };
  }

  static async listProductos(
    accessToken: string,
    page: number = 1,
    size: number = 50,
    filters?: { empresa?: string; marca?: string; q?: string; ref_proveedor?: string }
  ): Promise<PaginationResult> {
    const url = new URL(`${SUPABASE_URL}/functions/v1/productos-crud`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('size', size.toString());
    if (filters?.empresa) url.searchParams.set('empresa', filters.empresa);
    if (filters?.marca) url.searchParams.set('marca', filters.marca);
    if (filters?.q) url.searchParams.set('q', filters.q.trim());
    if (filters?.ref_proveedor) url.searchParams.set('ref_proveedor', filters.ref_proveedor.trim());

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error fetching productos');
    }

    return response.json();
  }

  static async getProducto(accessToken: string, id: string): Promise<Producto> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/productos-crud/${id}`, {
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error fetching producto');
    }

    const result = await response.json();
    return result.data;
  }

  static async createProducto(accessToken: string, producto: Producto): Promise<Producto> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/productos-crud`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(producto),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error creating producto');
    }

    const result = await response.json();
    return result.data[0];
  }

  static async updateProducto(accessToken: string, id: string, updates: Partial<Producto>): Promise<Producto> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/productos-crud/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error updating producto');
    }

    const result = await response.json();
    return result.data;
  }

  static async deleteProducto(accessToken: string, id: string): Promise<void> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/productos-crud/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error deleting producto');
    }
  }

  static async importProductos(
    accessToken: string,
    rows: Producto[],
    mode: ImportMode
  ): Promise<ImportResult> {
    // Normalizar campos numéricos antes de enviar
    const normalizedRows = rows.map(row => this.normalizeNumericFields(row));

    const response = await fetch(`${SUPABASE_URL}/functions/v1/productos-import`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({ rows: normalizedRows, modo: mode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error importing productos');
    }

    return response.json();
  }
}
