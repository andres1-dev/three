import * as XLSX from 'xlsx';
import { Producto } from '../types';

export interface ParseResult {
  rows: Producto[];
  monthColumns: string[];
  totalRows: number;
  validRows: number;
}

export class ExcelParserService {
  /** Campos que se guardan SIEMPRE como enteros (sin .00 / ,00) en Supabase */
  private static readonly INTEGER_FIELDS: string[] = [
    'precio',
    'total_ventas',
    'despacho',
    'inv_pv',
    'transito',
    'inv_cedi',
  ];

  static async parseFile(file: File): Promise<ParseResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawData.length === 0) {
      return {
        rows: [],
        monthColumns: [],
        totalRows: 0,
        validRows: 0,
      };
    }

    const headers = Object.keys(rawData[0]);
    const monthColumns = this.detectMonthColumns(headers);
    const normalizedRows = this.normalizeRows(rawData);

    return {
      rows: normalizedRows,
      monthColumns,
      totalRows: rawData.length,
      validRows: normalizedRows.length,
    };
  }

  private static detectMonthColumns(headers: string[]): string[] {
    const monthPattern = /^\d{4}-\d{2}$/;
    return headers.filter(header => monthPattern.test(header.trim()));
  }

  private static normalizeRows(rows: any[]): Producto[] {
    const headerMap: Record<string, string> = {
      'empresa': 'empresa',
      'referencia': 'referencia',
      'ref proveedor': 'ref_proveedor',
      'descripción': 'descripcion',
      'descripcion': 'descripcion',
      'f_grupo': 'f_grupo',
      'f_subgrupo': 'f_subgrupo',
      'marca': 'marca',
      'precio': 'precio',
      'total ventas': 'total_ventas',
      'despacho': 'despacho',
      '% rot': 'pct_rot',
      'pct_rot': 'pct_rot',
      'inv pv': 'inv_pv',
      'transito': 'transito',
      'inv cedi': 'inv_cedi',
    };

    const monthPattern = /^\d{4}-\d{2}$/;

    return rows
      .map(row => {
        const normalized: Producto = {
          empresa: '',
          referencia: '',
          ref_proveedor: null,
          descripcion: null,
          f_grupo: null,
          f_subgrupo: null,
          marca: null,
          precio: null,
          total_ventas: null,
          despacho: null,
          pct_rot: null,
          inv_pv: null,
          transito: null,
          inv_cedi: null,
          ventas_mes: {},
        };

        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = key.toString().trim().toLowerCase();

          if (monthPattern.test(key.toString().trim())) {
            normalized.ventas_mes![key.toString().trim()] = this.toInteger(value);
          } else if (headerMap[normalizedKey]) {
            const field = headerMap[normalizedKey];

            if (field === 'pct_rot') {
              // pct_rot puede tener decimales reales: 1.0000 -> 1
              (normalized as any)[field] = this.toDecimal(value);
            } else if (this.INTEGER_FIELDS.includes(field)) {
              // Contadores y valores: SIEMPRE enteros (sin .00 ni ,00)
              (normalized as any)[field] = this.toInteger(value);
            } else {
              (normalized as any)[field] = this.toString(value);
            }
          }
        }

        return normalized;
      })
      .filter(row => row.empresa !== '' && row.referencia !== '');
  }

  private static toString(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const str = String(value).trim();
    return str === '' ? null : str;
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
  private static toInteger(value: any): number | null {
    const num = this.toNumber(value);
    return num === null ? null : Math.round(num);
  }

  /**
   * Convierte a número con máximo de decimales indicado, sin ceros sobrantes.
   * Para pct_rot (porcentaje) se usan 6 decimales: no se pierde ningún valor.
   * 1.0000 => 1 | 1.003054730589733 => 1.003055
   */
  private static toDecimal(value: any, decimales = 6): number | null {
    const num = this.toNumber(value);
    return num === null ? null : Number(num.toFixed(decimales));
  }
}
