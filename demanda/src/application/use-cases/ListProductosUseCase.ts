import { IProductoRepository, PaginationOptions, FilterOptions, PaginationResult } from '../ports/IProductoRepository';
import { ProductoEntity } from '../../domain/entities/Producto';

export class ListProductosUseCase {
  constructor(private readonly productoRepository: IProductoRepository) {}

  async execute(pagination: PaginationOptions, filters?: FilterOptions): Promise<PaginationResult<ProductoEntity>> {
    const result = await this.productoRepository.findAll(pagination, filters);
    return {
      ...result,
      data: result.data.map(producto => ProductoEntity.fromObject(producto)),
    };
  }
}
