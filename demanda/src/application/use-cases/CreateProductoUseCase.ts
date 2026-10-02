import { IProductoRepository } from '../ports/IProductoRepository';
import { ProductoEntity, Producto } from '../../domain/entities/Producto';
import { ProductoValidator } from '../../domain/services/ProductoValidator';

export class CreateProductoUseCase {
  constructor(private readonly productoRepository: IProductoRepository) {}

  async execute(producto: Producto): Promise<ProductoEntity> {
    const productoEntity = ProductoEntity.fromObject(producto);
    const validation = ProductoValidator.validate(productoEntity);

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const created = await this.productoRepository.create(producto);
    return ProductoEntity.fromObject(created);
  }

  async executeBatch(productos: Producto[]): Promise<ProductoEntity[]> {
    const productoEntities = productos.map(p => ProductoEntity.fromObject(p));
    const validation = ProductoValidator.validateBatch(productoEntities);

    if (validation.invalid > 0) {
      throw new Error(`Batch validation failed: ${validation.errors.slice(0, 5).join('; ')}...`);
    }

    const created = await this.productoRepository.createBatch(productos);
    return created.map(p => ProductoEntity.fromObject(p));
  }
}
