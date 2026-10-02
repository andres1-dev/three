import { ProductoEntity } from '../entities/Producto';

export class ProductoValidator {
  static validate(producto: ProductoEntity): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!producto.empresa || producto.empresa.trim() === '') {
      errors.push('Empresa es requerida');
    }

    if (!producto.referencia || producto.referencia.trim() === '') {
      errors.push('Referencia es requerida');
    }

    if (producto.precio !== null && producto.precio < 0) {
      errors.push('Precio no puede ser negativo');
    }

    if (producto.total_ventas !== null && producto.total_ventas < 0) {
      errors.push('Total ventas no puede ser negativo');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateBatch(productos: ProductoEntity[]): { valid: number; invalid: number; errors: string[] } {
    let valid = 0;
    let invalid = 0;
    const allErrors: string[] = [];

    productos.forEach((producto, index) => {
      const result = this.validate(producto);
      if (result.valid) {
        valid++;
      } else {
        invalid++;
        allErrors.push(`Fila ${index + 1}: ${result.errors.join(', ')}`);
      }
    });

    return { valid, invalid, errors: allErrors };
  }
}
