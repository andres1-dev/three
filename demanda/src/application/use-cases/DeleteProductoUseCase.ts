import { IProductoRepository } from '../ports/IProductoRepository';

export class DeleteProductoUseCase {
  constructor(private readonly productoRepository: IProductoRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.productoRepository.findById(id);
    if (!existing) {
      throw new Error('Producto not found');
    }

    await this.productoRepository.delete(id);
  }
}
