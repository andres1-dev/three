# Instrucciones para configurar tabla SISPRO en Supabase

## 1. Crear la tabla SISPRO en Supabase

Ve a tu proyecto de Supabase → SQL Editor y ejecuta este SQL:

```sql
-- Crear tabla SISPRO con TODAS las columnas del CSV
CREATE TABLE IF NOT EXISTS "SISPRO" (
  "OP" TEXT PRIMARY KEY,
  "Ref" TEXT,
  "Coleccion" TEXT,
  "UndProg" INTEGER,
  "UndCort" INTEGER,
  "FechaCorte" TEXT,
  "Estado de integracion" TEXT,
  "Bodega Despacho" TEXT,
  "InvPlanta" INTEGER,
  "NombrePlanta" TEXT,
  "FSalidaConf" TEXT,
  "FEntregaConf" TEXT,
  "Proceso" TEXT,
  "InvBPT" INTEGER,
  "Saldo BPT" INTEGER,
  "Descripcion" TEXT,
  "Cuento" TEXT,
  "Genero" TEXT,
  "Tipo Tejido" TEXT,
  "pvp" TEXT,
  "TEMPLO DE LA MODA" TEXT,
  "BARRANCA" TEXT,
  "VALOR FACTURACION" TEXT
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_sispro_op ON "SISPRO"("OP");
CREATE INDEX IF NOT EXISTS idx_sispro_nombreplanta ON "SISPRO"("NombrePlanta");
CREATE INDEX IF NOT EXISTS idx_sispro_proceso ON "SISPRO"("Proceso");
CREATE INDEX IF NOT EXISTS idx_sispro_ref ON "SISPRO"("Ref");

-- Habilitar Row Level Security (RLS)
ALTER TABLE "SISPRO" ENABLE ROW LEVEL SECURITY;

-- Política: Permitir acceso a usuarios autenticados y anónimos
CREATE POLICY "Allow all access" ON "SISPRO"
  FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
```

## 2. Formato del CSV

El CSV debe tener **exactamente estos 23 headers** separados por punto y coma (;):

```
OP;Ref;Coleccion;UndProg;UndCort;FechaCorte;Estado de integracion;Bodega Despacho;InvPlanta;NombrePlanta;FSalidaConf;FEntregaConf;Proceso;InvBPT;Saldo BPT;Descripcion;Cuento;Genero;Tipo Tejido;pvp;TEMPLO DE LA MODA;BARRANCA;VALOR FACTURACION
```

### Ejemplo de datos:

```csv
OP;Ref;Coleccion;UndProg;UndCort;FechaCorte;Estado de integracion;Bodega Despacho;InvPlanta;NombrePlanta;FSalidaConf;FEntregaConf;Proceso;InvBPT;Saldo BPT;Descripcion;Cuento;Genero;Tipo Tejido;pvp;TEMPLO DE LA MODA;BARRANCA;VALOR FACTURACION
372;MS0355;MODA UNIVERSO 2025;306;306;23/04/2025;No;0;306;ARANGO HIDALGO MARTA ISABEL;22-may-25;05-jun-25;CONFECCION;0;306;SHORT;MODAFRESCA;DAMA;PLANO;$ 39.900;$ 17.606;$ 15.563;$ 5.199.889
490;U24050;MODA UNIVERSO 2025;228;202;15/09/2025;No;0;202;NARVAEZ URBANO WILDER MAURICIO;25-mar-26;20-abr-26;CONFECCION;0;202;PANTALONETAS;URBANO;HOMBRE;PUNTO;$ 59.990;$ 28.644;$ 25.321;$ 5.584.714
```

## 3. Cómo usar el módulo de carga CSV

1. **Inicia sesión como ADMIN** en la aplicación
2. En el header (arriba a la derecha) verás un **ícono de CSV** 📄
3. Haz clic en el ícono para abrir el modal de carga
4. Selecciona tu archivo CSV
5. Verás un preview de las primeras 5 filas
6. Haz clic en "Subir a Supabase"
7. El sistema subirá los datos en lotes de 100 registros

## 4. Mapeo interno de la aplicación

La aplicación usa internamente estos nombres (no necesitas cambiar nada):

| CSV Column | App Internal Name |
|------------|-------------------|
| OP | LOTE |
| Ref | REFERENCIA |
| InvPlanta | CANTIDAD |
| NombrePlanta | PLANTA |
| FSalidaConf | SALIDA |
| Proceso | PROCESO |
| Descripcion | PRENDA |
| Cuento | LINEA |
| Genero | GENERO |
| Tipo Tejido | TEJIDO |

El resto de columnas se guardan en la base de datos pero no se usan actualmente en la app.

## 5. Verificación

Después de subir el CSV, verifica en Supabase:
- Ve a Table Editor → SISPRO
- Deberías ver todos los registros con las 23 columnas
- La columna "OP" es la clave primaria (no puede haber duplicados)

## Notas importantes

- Si subes el mismo CSV dos veces, los registros se actualizarán (upsert por OP)
- Los datos se suben en lotes de 100 para evitar timeouts
- Solo usuarios con ROL='ADMIN' pueden ver y usar el botón de carga CSV
