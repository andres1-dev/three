import * as XLSX from 'xlsx';
import { ProductoNormalizer, RawProductoRow } from './ProductoNormalizer';
import { Producto } from '../entities/Producto';

export interface ParseResult {
  rows: Producto[];
  monthColumns: string[];
  totalRows: number;
  validRows: number;
}

export class ExcelParser {
  static async parseFile(file: File): Promise<ParseResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: RawProductoRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawData.length === 0) {
      return {
        rows: [],
        monthColumns: [],
        totalRows: 0,
        validRows: 0,
      };
    }

    const headers = Object.keys(rawData[0]);
    const monthColumns = ProductoNormalizer.detectMonthColumns(headers);
    const normalizedRows = ProductoNormalizer.normalizeRows(rawData);

    return {
      rows: normalizedRows,
      monthColumns,
      totalRows: rawData.length,
      validRows: normalizedRows.length,
    };
  }
}
