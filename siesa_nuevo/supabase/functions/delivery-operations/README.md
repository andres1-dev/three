# Delivery Operations - Edge Function

Función de Supabase para gestionar operaciones de entregas (delivery).

## Endpoints

### 1. GET - Obtener datos combinados
```
GET /delivery-operations?action=get
```

Retorna todas las facturas de SIESA con sus entregas asociadas.

**Respuesta:**
```json
{
  "facturas": [...],
  "entregas": [...],
  "combined": [
    {
      "Nro documento": "FEV-12345",
      "Fecha": "01/01/2024",
      "Razón social cliente factura": "Cliente XYZ",
      "entregas": [
        {
          "Registro": "1",
          "Documento": "DOC-001",
          "Lote": "LOTE-001",
          "Referencia": "REF-001",
          "Cantidad": 10,
          "Factura": "FEV-12345",
          "Nit": "123456789",
          "SoporteID": "SOP-001",
          "Url_Ih3": "https://...",
          "Usuario": "user@example.com"
        }
      ],
      "tieneEntregas": true
    }
  ]
}
```

### 2. POST - Crear/actualizar entregas
```
POST /delivery-operations?action=upsert
Content-Type: application/json

{
  "entregas": [
    {
      "Registro": "1",
      "Documento": "DOC-001",
      "Lote": "LOTE-001",
      "Referencia": "REF-001",
      "Cantidad": 10,
      "Factura": "FEV-12345",
      "Nit": "123456789",
      "SoporteID": "SOP-001",
      "Url_Ih3": "https://drive.google.com/...",
      "Usuario": "user@example.com"
    }
  ]
}
```

**Campos requeridos:**
- Documento
- Lote
- Referencia
- Factura
- Nit

**Campos opcionales:**
- Registro (se genera automáticamente si no se proporciona)
- Cantidad (default: 0)
- SoporteID
- Url_Ih3
- Usuario

**Respuesta:**
```json
{
  "total": 1,
  "success": 1,
  "failed": 0,
  "errors": []
}
```

### 3. POST - Eliminar entregas
```
POST /delivery-operations?action=delete
Content-Type: application/json

{
  "registros": ["1", "2", "3"]
}
```

**Respuesta:**
```json
{
  "success": true,
  "deleted": 3,
  "message": "3 entregas eliminadas correctamente"
}
```

### 4. GET - Obtener entregas por factura
```
GET /delivery-operations?action=by-factura&factura=FEV-12345
```

**Respuesta:**
```json
{
  "factura": "FEV-12345",
  "entregas": [...],
  "count": 5
}
```

### 5. GET - Estadísticas de entregas
```
GET /delivery-operations?action=stats
```

**Respuesta:**
```json
{
  "totalFacturas": 100,
  "facturasConEntregas": 75,
  "facturasSinEntregas": 25,
  "totalEntregas": 150,
  "porcentajeEntregado": "75.00%",
  "promedioEntregasPorFactura": "2.00"
}
```

## Despliegue

```bash
# Desplegar la función
supabase functions deploy delivery-operations

# Probar localmente
supabase functions serve delivery-operations
```

## Variables de entorno

La función usa automáticamente:
- `SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (con permisos completos)

## Uso desde el frontend

### Opción 1: Fetch directo
```javascript
const response = await fetch(
  'https://tu-proyecto.supabase.co/functions/v1/delivery-operations?action=get',
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  }
);
const data = await response.json();
```

### Opción 2: Usando el cliente de Supabase
```javascript
const { data, error } = await supabase.functions.invoke('delivery-operations', {
  body: { action: 'get' }
});
```

## Permisos

Esta función usa la `SERVICE_ROLE_KEY` por lo que tiene acceso completo a todas las tablas. Asegúrate de validar los datos de entrada adecuadamente.

## Tablas requeridas

### Tabla: SIESA
- Nro documento (PK)
- Fecha
- Razón social cliente factura
- Valor subtotal local
- Cantidad inv.
- Referencia
- Compáa
- op
- tipo

### Tabla: entregas
- Registro (PK, auto-increment)
- Documento
- Lote
- Referencia
- Cantidad
- Factura (FK a SIESA)
- Nit
- SoporteID
- Url_Ih3
- Usuario

## Ejemplos de uso

### Cargar datos en el dashboard
```javascript
const response = await fetch(
  `${FUNCTIONS_URL}/delivery-operations?action=get`
);
const { combined } = await response.json();
// combined contiene facturas con sus entregas
```

### Registrar nuevas entregas
```javascript
const entregas = [
  {
    Documento: "DOC-001",
    Lote: "LOTE-001",
    Referencia: "REF-001",
    Cantidad: 10,
    Factura: "FEV-12345",
    Nit: "123456789",
    Url_Ih3: "https://drive.google.com/...",
    Usuario: "operador@empresa.com"
  }
];

const response = await fetch(
  `${FUNCTIONS_URL}/delivery-operations?action=upsert`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entregas })
  }
);
const result = await response.json();
```

### Obtener estadísticas
```javascript
const response = await fetch(
  `${FUNCTIONS_URL}/delivery-operations?action=stats`
);
const stats = await response.json();
console.log(`${stats.porcentajeEntregado} de facturas entregadas`);
```
