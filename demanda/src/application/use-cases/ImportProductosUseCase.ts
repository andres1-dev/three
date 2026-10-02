import { IProductoRepository, ImportResult } from '../ports/IProductoRepository';
import { Producto, ProductoEntity } from '../../domain/entities/Producto';
import { ImportModeVO } from '../../domain/value-objects/ImportMode';
import { ProductoNormalizer, RawProductoRow } from '../../domain/services/ProductoNormalizer';
import { ProductoValidator } from '../../domain/services/ProductoValidator';

export class ImportProductosUseCase {
  constructor(private readonly productoRepository: IProductoRepository) {}

  async execute(rawRows: RawProductoRow[], mode: string): Promise<ImportResult> {
    const importMode = ImportModeVO.create(mode);
    const normalizedRows = ProductoNormalizer.normalizeRows(rawRows);

    if (normalizedRows.length === 0) {
      return {
        ok: false,
        modo: importMode.value,
        recibidos: rawRows.length,
        insertados: 0,
        errores: ['No valid rows to import'],
      };
    }

    const productoEntities = normalizedRows.map(row => {
      const entity = ProductoEntity.fromObject(row);
      const validation = ProductoValidator.validate(entity);
      if (!validation.valid) {
        throw new Error(`Validation failed for row: ${validation.errors.join(', ')}`);
      }
      return entity;
    });

    const productos = productoEntities.map(entity => entity.toObject());
    return await this.productoRepository.importProductos(productos, importMode);
  }
}
