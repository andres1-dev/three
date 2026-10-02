import { IProductoRepository } from '../ports/IProductoRepository';
import { ProductoEntity } from '../../domain/entities/Producto';

export class GetProductoUseCase {
  constructor(private readonly productoRepository: IProductoRepository) {}

  async execute(id: string): Promise<ProductoEntity | null> {
    const producto = await this.productoRepository.findById(id);
    return producto ? ProductoEntity.fromObject(producto) : null;
  }
}
