import { ProductoController } from '../controllers/ProductoController';
import { SupabaseProductoRepository } from '../../infrastructure/repositories/SupabaseProductoRepository';
import { ListProductosUseCase } from '../../application/use-cases/ListProductosUseCase';
import { GetProductoUseCase } from '../../application/use-cases/GetProductoUseCase';
import { CreateProductoUseCase } from '../../application/use-cases/CreateProductoUseCase';
import { UpdateProductoUseCase } from '../../application/use-cases/UpdateProductoUseCase';
import { DeleteProductoUseCase } from '../../application/use-cases/DeleteProductoUseCase';
import { ImportProductosUseCase } from '../../application/use-cases/ImportProductosUseCase';
import { HttpAdapter, HttpResponse } from './HttpAdapter';

export class SupabaseFunctionAdapter {
  private static controller: ProductoController;

  static initialize(supabaseUrl: string, supabaseKey: string, authHeader?: string) {
    const repository = new SupabaseProductoRepository(supabaseUrl, supabaseKey, authHeader);
    this.controller = new ProductoController(
      new ListProductosUseCase(repository),
      new GetProductoUseCase(repository),
      new CreateProductoUseCase(repository),
      new UpdateProductoUseCase(repository),
      new DeleteProductoUseCase(repository),
      new ImportProductosUseCase(repository),
    );
  }

  static async handleRequest(req: Request, supabaseUrl: string, supabaseKey: string): Promise<Response> {
    const httpReq = await HttpAdapter.parseRequest(req);

    if (httpReq.method === 'OPTIONS') {
      return HttpAdapter.toResponse(HttpAdapter.corsResponse());
    }

    try {
      const authHeader = httpReq.headers.get('Authorization');
      if (!authHeader) {
        return HttpAdapter.toResponse(HttpAdapter.errorResponse('Missing Authorization header', 401));
      }

      const url = new URL(httpReq.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const id = pathParts[1] || null;

      this.initialize(supabaseUrl, supabaseKey, authHeader);

      let response: HttpResponse;

      switch (httpReq.method) {
        case 'GET':
          if (id) {
            const producto = await this.controller.getProducto(id);
            response = producto
              ? HttpAdapter.jsonResponse({ data: producto.toObject() })
              : HttpAdapter.errorResponse('Producto not found', 404);
          } else {
            const page = parseInt(url.searchParams.get('page') || '1');
            const size = Math.min(parseInt(url.searchParams.get('size') || '50'), 500);
            const filters = {
              empresa: url.searchParams.get('empresa') || undefined,
              marca: url.searchParams.get('marca') || undefined,
              q: url.searchParams.get('q') || undefined,
            };
            const result = await this.controller.listProductos({ page, size }, filters);
            response = HttpAdapter.jsonResponse({
              data: result.data.map(p => p.toObject()),
              count: result.count,
              page: result.page,
              size: result.size,
            });
          }
          break;

        case 'POST':
          if (httpReq.body?.rows && httpReq.body?.modo) {
            const importResult = await this.controller.importProductos(
              httpReq.body.rows,
              httpReq.body.modo
            );
            response = HttpAdapter.jsonResponse(importResult);
          } else {
            const productos = Array.isArray(httpReq.body) ? httpReq.body : [httpReq.body];
            const created = await this.controller.createProductosBatch(productos);
            response = HttpAdapter.jsonResponse(
              { data: created.map(p => p.toObject()) },
              201
            );
          }
          break;

        case 'PATCH':
          if (!id) {
            response = HttpAdapter.errorResponse('ID required for PATCH', 400);
          } else {
            const updated = await this.controller.updateProducto(id, httpReq.body);
            response = HttpAdapter.jsonResponse({ data: updated.toObject() });
          }
          break;

        case 'DELETE':
          if (!id) {
            response = HttpAdapter.errorResponse('ID required for DELETE', 400);
          } else {
            await this.controller.deleteProducto(id);
            response = HttpAdapter.jsonResponse({ ok: true });
          }
          break;

        default:
          response = HttpAdapter.errorResponse('Method not supported', 405);
      }

      return HttpAdapter.toResponse(response);
    } catch (error) {
      console.error('Error handling request:', error);
      return HttpAdapter.toResponse(HttpAdapter.errorResponse(String(error), 500));
    }
  }
}
