# CALIDAD 2.0 — Guía de Arquitectura Hexagonal

## Visión General

CALIDAD 2.0 implementa una **Arquitectura Hexagonal (Ports & Adapters)** con ES Modules nativos (sin framework) para garantizar mantenibilidad, testabilidad e independencia de tecnología en un proyecto de gran escala.

---

## Estructura de Directorios

```
calidad2/
├── index.html             # Shell SPA (no tocar salvo la nav)
├── login.html             # Página de autenticación standalone
├── manifest.json          # PWA
├── assets/
│   ├── css/
│   │   ├── tokens.css     # TOKENS: colores, tipografía, espaciados
│   │   ├── base.css       # RESET + estructura del shell
│   │   └── components.css # Botones, cards, modales, toasts...
│   └── icons/             # SVGs estáticos
└── src/
    ├── main.js            # ★ COMPOSITION ROOT (único lugar con inyección)
    ├── core/
    │   ├── domain/
    │   │   ├── models/    # Entidades: User.js, Plant.js, Session.js
    │   │   └── constants/ # Roles.js, TableNames.js
    │   ├── ports/         # Contratos / Interfaces (IAuthService, IDataService...)
    │   └── usecases/      # Casos de uso puros (sin DOM, sin Supabase)
    ├── infrastructure/
    │   ├── config/env.js  # URLs y keys
    │   ├── supabase/      # Adaptadores de Supabase (Auth, Data, Storage)
    │   ├── gas/           # Adaptador Google Apps Script
    │   └── cache/         # Adaptador de caché con TTL en memoria
    └── presentation/
        ├── router/Router.js   # SPA Router con ciclo de vida y guards
        ├── state/Store.js     # Estado global reactivo (Pub/Sub)
        ├── components/        # Toast.js, Modal.js (reutilizables)
        └── modules/           # Un directorio por módulo activo
```

---

## Regla de Oro: Jerarquía de Dependencias

```
presentation → core/ports (NO → infrastructure directamente)
core/usecases → core/ports (NO → infrastructure)
infrastructure implementa → core/ports
main.js inyecta → todo
```

**¿Por qué?** Si mañana Supabase cambia su API, solo editas los archivos en `src/infrastructure/supabase/`. Ni un solo módulo de UI ni de lógica de negocio se toca.

---

## Cómo Agregar un Nuevo Módulo (Ejemplo: `auditorias`)

### 1. Crear la Vista en `presentation/modules/`

```
src/presentation/modules/auditorias/
└── AuditoriasModule.js
```

```js
// AuditoriasModule.js
export class AuditoriasModule {
    constructor({ router, getAuditoriasUseCase }) {
        this.router = router;
        this.useCase = getAuditoriasUseCase;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn">← Volver</button>
                <h1 class="page-title">Auditorías</h1>
            </div>
            <!-- Tu HTML aquí -->
        `;
        viewport.innerHTML = '';
        viewport.appendChild(this.container);
        this.container.querySelector('.back-btn').addEventListener('click', () => this.router.navigate('apps'));
        // Cargar datos...
    }

    unmount() {
        this.container = null;
    }
}
```

### 2. Crear el Caso de Uso (si necesitas lógica) en `core/usecases/`

```
src/core/usecases/auditorias/
└── GetAuditoriasUseCase.js
```

### 3. Registrar en `src/main.js` (un solo lugar)

```js
import { AuditoriasModule } from './presentation/modules/auditorias/AuditoriasModule.js';
// ...
router.register('auditorias', class {
    constructor({ router }) {
        this._mod = new AuditoriasModule({ router, getAuditoriasUseCase });
    }
    async mount(vp) { await this._mod.mount(vp); }
    unmount() { this._mod.unmount(); }
});
```

### 4. Agregar al Registro de Apps en `AppsModule.js`

```js
// En APPS_REGISTRY dentro de AppsModule.js
{
    id: 'auditorias',
    title: 'Auditorías',
    category: 'Operaciones',
    icon: 'file-report-flat',
    palette: 'Turquesa',
    active: true  // ← Cambiar a true cuando esté listo
}
```

---

## Componentes Globales

### Toast (notificaciones)
```js
import { Toast } from '../../components/Toast.js';
Toast.success('Guardado correctamente');
Toast.error('No se pudo conectar');
Toast.info('Cargando datos...');
```

### Modal / Bottom Sheet
```js
import { Modal } from '../../components/Modal.js';
Modal.open({
    title: 'Mi Modal',
    contentHtml: '<p>Contenido</p>',
    onOpen: (body) => { /* vincular eventos al body del modal */ },
    onClose: () => { /* callback al cerrar */ }
});
Modal.close(); // Cerrar programáticamente
```

### Store (estado global)
```js
import { Store } from '../../state/Store.js';

// Leer estado
const { currentUser } = Store.getState();

// Escribir estado
Store.setState({ notificationsCount: 5 });

// Suscribirse a cambios
const unsub = Store.subscribe('currentUser', (newVal, oldVal) => {
    console.log('Usuario cambió:', newVal);
});
unsub(); // Desuscribirse
```

---

## Tokens de Diseño (variables CSS)

| Variable | Descripción |
|---|---|
| `--color-primary` | Azul principal (#2563eb) |
| `--color-text` | Texto oscuro (#0f172a) |
| `--color-text-muted` | Texto secundario (#64748b) |
| `--color-border` | Bordes (#e2e8f0) |
| `--color-surface` | Fondo de tarjetas (#ffffff) |
| `--color-bg` | Fondo general (#f8fafc) |
| `--header-height` | Altura del page-header (56px) |
| `--nav-height` | Altura del bottom-nav (64px) |
| `--radius-sm/md/lg` | Radios de 8 / 12 / 16px |
| `--shadow-sm/md/lg` | Sombras graduadas |
| `--transition-fast/normal` | Tiempos de animación |

---

## Patrón de Módulo: Mount / Unmount

Cada módulo **debe** implementar:
- `async mount(viewport)` — crea y renderiza el DOM, vincula eventos
- `unmount()` — limpieza (remover listeners globales, limpiar timers, etc.)

El router llama automáticamente a `unmount()` del módulo anterior antes de montar el nuevo.

---

## Roadmap de Módulos

| Módulo | Estado | Fuente de Migración |
|---|---|---|
| `apps` (launcher) | ✅ Activo | — |
| `inicio` (feed) | ✅ Activo | index.html legacy |
| `personas` (directorio) | ✅ Activo | usuarios.html legacy |
| `perfil` | ✅ Activo | perfil.html legacy |
| `iconos` (temas) | ✅ Activo | — |
| `calidad` | 🔄 Pendiente | calidad.html |
| `auditorias` | 🔄 Pendiente | auditorias.html |
| `rutero` | 🔄 Pendiente | rutero.html |
| `gestion-planta` | 🔄 Pendiente | gestion-planta.html |
| `resolucion` | 🔄 Pendiente | resolucion.html |
| `seguimiento` | 🔄 Pendiente | seguimiento.html |
| `aprobacion` | 🔄 Pendiente | aprobacion.html |
