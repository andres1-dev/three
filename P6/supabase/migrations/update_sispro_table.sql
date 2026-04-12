-- ============================================================================
-- Tabla SISPRO - TODAS las columnas del CSV tal cual (sin columnas extras)
-- ============================================================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON "SISPRO";
DROP POLICY IF EXISTS "Allow insert/update to authenticated users" ON "SISPRO";
DROP POLICY IF EXISTS "Allow all access" ON "SISPRO";

-- Eliminar tabla existente si existe (CUIDADO: esto borra todos los datos)
DROP TABLE IF EXISTS "SISPRO";

-- Crear tabla SISPRO con TODAS las columnas del CSV en el orden exacto
CREATE TABLE "SISPRO" (
  "OP" TEXT PRIMARY KEY,
  "Ref" TEXT,
  "Coleccion" TEXT,
  "UndProg" INTEGER,
  "UndCort" INTEGER,
  "FechaCorte" DATE,
  "Estado de integracion" TEXT,
  "Bodega Despacho" TEXT,
  "InvPlanta" INTEGER,
  "NombrePlanta" TEXT,
  "FSalidaConf" DATE,
  "FEntregaConf" DATE,
  "Proceso" TEXT,
  "InvBPT" INTEGER,
  "Saldo BPT" INTEGER,
  "Descripcion" TEXT,
  "Cuento" TEXT,
  "Genero" TEXT,
  "Tipo Tejido" TEXT,
  "pvp" INTEGER,
  "TEMPLO DE LA MODA" INTEGER,
  "BARRANCA" INTEGER,
  "VALOR FACTURACION" INTEGER
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_sispro_op ON "SISPRO"("OP");
CREATE INDEX IF NOT EXISTS idx_sispro_nombreplanta ON "SISPRO"("NombrePlanta");
CREATE INDEX IF NOT EXISTS idx_sispro_proceso ON "SISPRO"("Proceso");
CREATE INDEX IF NOT EXISTS idx_sispro_ref ON "SISPRO"("Ref");
CREATE INDEX IF NOT EXISTS idx_sispro_fsalidaconf ON "SISPRO"("FSalidaConf");

-- Habilitar Row Level Security (RLS)
ALTER TABLE "SISPRO" ENABLE ROW LEVEL SECURITY;

-- Política: Permitir TODO a usuarios anónimos y autenticados (sin restricciones)
CREATE POLICY "Allow all operations" ON "SISPRO"
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE "SISPRO" IS 'Tabla de lotes - Columnas EXACTAS del CSV sin modificaciones';
COMMENT ON COLUMN "SISPRO"."FechaCorte" IS 'Fecha de corte (convertida de dd/mm/yyyy o dd-mmm-yy a DATE)';
COMMENT ON COLUMN "SISPRO"."FSalidaConf" IS 'Fecha de salida confirmada (convertida de dd-mmm-yy a DATE)';
COMMENT ON COLUMN "SISPRO"."FEntregaConf" IS 'Fecha de entrega confirmada (convertida de dd-mmm-yy a DATE)';
COMMENT ON COLUMN "SISPRO"."pvp" IS 'Precio de venta público (convertido de $ X.XXX a INTEGER)';
COMMENT ON COLUMN "SISPRO"."TEMPLO DE LA MODA" IS 'Precio Templo de la Moda (convertido de $ X.XXX a INTEGER)';
COMMENT ON COLUMN "SISPRO"."BARRANCA" IS 'Precio Barranca (convertido de $ X.XXX a INTEGER)';
COMMENT ON COLUMN "SISPRO"."VALOR FACTURACION" IS 'Valor de facturación (convertido de $ X.XXX.XXX a INTEGER)';

