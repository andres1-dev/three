export interface VentasMes {
  [key: string]: number | null;
}

export interface Producto {
  id?: string;
  empresa: string;
  referencia: string;
  ref_proveedor?: string | null;
  descripcion?: string | null;
  f_grupo?: string | null;
  f_subgrupo?: string | null;
  marca?: string | null;
  precio?: number | null;
  total_ventas?: number | null;
  despacho?: number | null;
  pct_rot?: number | null;
  inv_pv?: number | null;
  transito?: number | null;
  inv_cedi?: number | null;
  ventas_mes?: VentasMes;
  updated_at?: string;
}

export class ProductoEntity {
  constructor(private readonly data: Producto) {}

  get id(): string | undefined {
    return this.data.id;
  }

  get empresa(): string {
    return this.data.empresa!;
  }

  get referencia(): string {
    return this.data.referencia!;
  }

  get ref_proveedor(): string | null {
    return this.data.ref_proveedor ?? null;
  }

  get descripcion(): string | null {
    return this.data.descripcion ?? null;
  }

  get f_grupo(): string | null {
    return this.data.f_grupo ?? null;
  }

  get f_subgrupo(): string | null {
    return this.data.f_subgrupo ?? null;
  }

  get marca(): string | null {
    return this.data.marca ?? null;
  }

  get precio(): number | null {
    return this.data.precio ?? null;
  }

  get total_ventas(): number | null {
    return this.data.total_ventas ?? null;
  }

  get despacho(): number | null {
    return this.data.despacho ?? null;
  }

  get pct_rot(): number | null {
    return this.data.pct_rot ?? null;
  }

  get inv_pv(): number | null {
    return this.data.inv_pv ?? null;
  }

  get transito(): number | null {
    return this.data.transito ?? null;
  }

  get inv_cedi(): number | null {
    return this.data.inv_cedi ?? null;
  }

  get ventas_mes(): VentasMes {
    return this.data.ventas_mes ?? {};
  }

  get updated_at(): string | undefined {
    return this.data.updated_at;
  }

  get uniqueKey(): string {
    return `${this.empresa}-${this.referencia}`;
  }

  toObject(): Producto {
    return { ...this.data };
  }

  static fromObject(data: Producto): ProductoEntity {
    return new ProductoEntity(data);
  }
}
