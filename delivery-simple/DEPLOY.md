# Guía de Despliegue - Delivery Simple

## Requisitos Previos

1. Instalar Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Iniciar sesión en Supabase:
   ```bash
   supabase login
   ```

3. Vincular el proyecto:
   ```bash
   supabase link --project-ref djgnfyglyvlfhnhvpzxy
   ```

## Desplegar Edge Function

Para desplegar la función optimizada con filtros de fecha:

```bash
supabase functions deploy delivery-operations
```

## Verificar Despliegue

La función estará disponible en:
```
https://djgnfyglyvlfhnhvpzxy.supabase.co/functions/v1/delivery-operations
```

## Probar la Función

```bash
curl "https://djgnfyglyvlfhnhvpzxy.supabase.co/functions/v1/delivery-operations?fechaInicio=2026-04-01&fechaFin=2026-04-06"
```

## Características Implementadas

- ✅ Carga solo datos del rango de fechas solicitado
- ✅ Filtrado eficiente en memoria (más rápido que SQL con fechas DD/MM/YYYY)
- ✅ Flatpickr para selección de rango personalizado
- ✅ Carga automática del primer día del mes actual hasta hoy
- ✅ Muestra TODOS los campos de SIESA exactamente como están en Supabase
- ✅ Columna "ENTREGAS" (mayúsculas) con contador de entregas por factura
- ✅ DataTables con ordenamiento, paginación y búsqueda
- ✅ Diseño responsive con Bootstrap 5

## Estructura de Archivos

```
delivery-simple/
├── index.html          # HTML principal con flatpickr
├── css/
│   └── style.css       # Estilos con header flexbox
└── js/
    └── app.js          # Lógica con carga automática y filtros
```

## Parámetros de la Edge Function

- `fechaInicio`: Fecha inicial en formato YYYY-MM-DD (requerido)
- `fechaFin`: Fecha final en formato YYYY-MM-DD (requerido)

## Respuesta de la Edge Function

```json
{
  "success": true,
  "data": [
    {
      "Estado": "Aprobadas",
      "Nro documento": "017-00044381",
      "Fecha": "02/03/2026",
      "Razón social cliente factura": "QUINTERO ORTIZ JOSE ALEXANDER",
      "Docto. referencia": "4568",
      "Notas": "L.MF- 4568 ALEX",
      "Compáa": 5,
      "Valor subtotal local": "168600",
      "Referencia": "ME15006",
      "Cantidad inv.": 4568,
      "op": null,
      "tipo": "REMISION",
      "entregas": []
    }
  ],
  "stats": {
    "totalFacturas": 1,
    "totalEntregas": 0,
    "facturasConEntregas": 0,
    "tiempoCarga": "245ms",
    "rangoFechas": "02/03/2026 - 06/04/2026"
  }
}
```

## Notas Importantes

- Las fechas en SIESA se mantienen en formato DD/MM/YYYY
- La tabla ENTREGAS está en mayúsculas en Supabase
- El filtrado se hace en memoria para máxima velocidad
- Solo se cargan las entregas de las facturas filtradas
