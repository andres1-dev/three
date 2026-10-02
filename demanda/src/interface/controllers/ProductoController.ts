import { ListProductosUseCase } from '../../application/use-cases/ListProductosUseCase';
import { GetProductoUseCase } from '../../application/use-cases/GetProductoUseCase';
import { CreateProductoUseCase } from '../../application/use-cases/CreateProductoUseCase';
import { UpdateProductoUseCase } from '../../application/use-cases/UpdateProductoUseCase';
import { DeleteProductoUseCase } from '../../application/use-cases/DeleteProductoUseCase';
import { ImportProductosUseCase } from '../../application/use-cases/ImportProductosUseCase';
import { IProductoRepository, PaginationOptions, FilterOptions } from '../../application/ports/IProductoRepository';

export class ProductoController {
  constructor(
    private readonly listUseCase: ListProductosUseCase,
    private readonly getUseCase: GetProductoUseCase,
    private readonly createUseCase: CreateProductoUseCase,
    private readonly updateUseCase: UpdateProductoUseCase,
    private readonly deleteUseCase: DeleteProductoUseCase,
    private readonly importUseCase: ImportProductosUseCase,
  ) {}

  async listProductos(pagination: PaginationOptions, filters?: FilterOptions) {
    return await this.listUseCase.execute(pagination, filters);
  }

  async getProducto(id: string) {
    return await this.getUseCase.execute(id);
  }

  async createProducto(producto: any) {
    return await this.createUseCase.execute(producto);
  }

  async createProductosBatch(productos: any[]) {
    return await this.createUseCase.executeBatch(productos);
  }

  async updateProducto(id: string, updates: any) {
    return await this.updateUseCase.execute(id, updates);
  }

  async deleteProducto(id: string) {
    return await this.deleteUseCase.execute(id);
  }

  async importProductos(rawRows: any[], mode: string) {
    return await this.importUseCase.execute(rawRows, mode);
  }
}
