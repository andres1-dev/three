import { IProductoRepository } from '../ports/IProductoRepository';
import { ProductoEntity, Producto } from '../../domain/entities/Producto';
import { ProductoValidator } from '../../domain/services/ProductoValidator';

export class UpdateProductoUseCase {
  constructor(private readonly productoRepository: IProductoRepository) {}

  async execute(id: string, updates: Partial<Producto>): Promise<ProductoEntity> {
    const existing = await this.productoRepository.findById(id);
    if (!existing) {
      throw new Error('Producto not found');
    }

    const updatedProducto = { ...existing, ...updates };
    const productoEntity = ProductoEntity.fromObject(updatedProducto);
    const validation = ProductoValidator.validate(productoEntity);

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const updated = await this.productoRepository.update(id, updates);
    return ProductoEntity.fromObject(updated);
  }
}
