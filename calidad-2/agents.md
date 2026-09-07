# AGENTS.MD — Reglas, Infraestructura y Estrategia del Proyecto CALIDAD

## 0. ESTRUCTURA DEL PROYECTO Y CARPETAS DE TRABAJO

```
CALIDAD3.0/
├── calidad/                   ← CÓDIGO PRINCIPAL ACTIVO (Arquitectura Hexagonal ES Modules)
│   ├── index.html             ← Shell SPA (Viewport + Bottom Nav fijo)
│   ├── login.html             ← Página de autenticación standalone
│   ├── manifest.json          ← Configuración PWA
│   ├── assets/
│   │   ├── css/               ← Estilos globales y por módulo (tokens, base, components, styles, personas, perfil...)
│   │   └── icons/             ← SVGs e iconos estáticos
│   ├── src/                   ← Código fuente modular ES6+
│   │   ├── main.js            ← ★ COMPOSITION ROOT (inyección de dependencias y registro de rutas)
│   │   ├── core/              ← Lógica de negocio pura (independiente de UI y Frameworks)
│   │   │   ├── domain/        ← Modelos (User, Plant, Session, Lote, Novedad) y Constantes (Roles, TableNames)
│   │   │   ├── ports/         ← Interfaces/Contratos (IAuthService, IDataService, ICacheService...)
│   │   │   └── usecases/      ← Casos de uso (GetUserProfile, UpdateUser, SubmitNovedad...)
│   │   ├── infrastructure/    ← Adaptadores tecnológicos externos
│   │   │   ├── config/env.js  ← Variables de entorno, URLs y API keys
│   │   │   ├── supabase/      ← Adaptadores de Supabase (Auth, Data, Storage)
│   │   │   ├── gas/           ← Adaptadores de Google Apps Script
│   │   │   └── cache/         ← Adaptador de caché en memoria con TTL
│   │   └── presentation/      ← Capa de Interfaz de Usuario
│   │       ├── router/        ← SPA Router con guards y ciclo de vida (mount / unmount)
│   │       ├── state/         ← Store reactivo global (Pub/Sub: currentUser, session)
│   │       ├── components/    ← UI Reutilizable (Toast.js, Modal.js)
│   │       └── modules/       ← Módulos de vista (apps, inicio, perfil, personas, formularios...)
│   └── supabase/              ← Edge functions y scripts SQL de backend (formularios, perfiles, personas...)
├── migracion [ Imput ]/       ← CÓDIGO DE REFERENCIA LEGACY PARA MIGRACIÓN (Solo Lectura)
│   ├── private/               ← Servidor local legacy
│   └── public/                ← Código legacy a consultar
└── agents.md                  ← Este archivo de reglas
```

### Reglas de Carpetas:
- **`calidad/`** es la ÚNICA carpeta donde se escribe, refactoriza y mantiene el código activo.
- **`migracion [ Imput ]/`** es exclusivamente de referencia histórica para consultar reglas de negocio legacy (NUNCA modificar).
- **NO crear carpetas intermedias obsoletas** como `calidad [ Output ]` o `calidad2/`.

---

## 1. ARQUITECTURA DEL SISTEMA (HEXAGONAL / PORTS & ADAPTERS)

El proyecto utiliza **Arquitectura Hexagonal** con **ES Modules nativos** (sin bundlers como Webpack/Vite para máxima velocidad en desarrollo):

```
┌──────────────────────────────────────────────────────────┐
│                       PRESENTATION                       │
│   (Modules: PersonasModule, PerfilModule... / Router / UI)│
└────────────────────────────┬─────────────────────────────┘
                             │ usa
                             ▼
┌──────────────────────────────────────────────────────────┐
│                       CORE / PORTS                       │
│     (IAuthService, IDataService, ICacheService, UseCases)│
└────────────────────────────▲─────────────────────────────┘
                             │ implementa
┌────────────────────────────┴─────────────────────────────┐
│                      INFRASTRUCTURE                      │
│   (SupabaseAuthAdapter, SupabaseDataRepository, Cache)   │
└──────────────────────────────────────────────────────────┘
                             ▲
                main.js (Composition Root)
             Inyecta adaptadores en casos de uso
                y casos de uso en módulos
```

### Regla de Oro de Dependencias:
1. `presentation` interactúa con `core/ports` o `core/usecases` (NUNCA importa directamente adaptadores de `infrastructure`).
2. `core/usecases` solo depende de interfaces de `core/ports` y entidades de `core/domain` (código JS puro, sin DOM ni Supabase).
3. `infrastructure` implementa los contratos de `core/ports`.
4. `src/main.js` es el **único lugar** donde se instancian las implementaciones concretas y se inyectan a la UI.

---

## 2. REGLAS CRÍTICAS Y PROHIBICIONES

### 2.1. 🚫 PROHIBICIÓN ESTRICTA DE BROWSER AUTOMÁTICO (GOAL / SUBAGENTS)
- **NUNCA** abrir ventanas de navegador ni ejecutar subagentes de navegador (`browser_subagent`, `Goal`, `Open`, `open_browser_url`) de manera autónoma.
- **NO** lanzar tareas de browser en segundo plano para "verificaciones visuales" o inspección de DOM a menos que el usuario lo solicite de forma explícita y directa.
- **Razón:** Estas ventanas e interacciones interrumpen al usuario, consumen recursos innecesarios y alteran el flujo de trabajo. Todas las modificaciones deben realizarse directamente en el código.

### 2.2. 🚫 PROHIBIDO CARGAR MÓDULOS CON `fetch()` LOCAL O TEMPLATES OBSOLETOS
- No usar `fetch('modules/<id>/index.html')` ni `<template id="template-<id>">`.
- Cada módulo es una clase exportada como ES Module que implementa `mount(viewport)` y `unmount()`.

### 2.3. 🚫 PROHIBIDO DEJAR ELEMENTOS COLGANDO AL DESMONTAR
- Modales, sheets o backdrops montados en `document.body` deben ser eliminados explícitamente en el método `unmount()` del módulo para evitar fugas de memoria o colisiones de IDs en el DOM.

### 2.4. ESTÁNDAR DE DISEÑO DE HEADERS (page-header)
TODOS los módulos y subvistas deben usar la misma estructura estándar de page-header:
- El botón de volver: SIEMPRE solo el icono SVG de flecha, SIN texto 'Volver' ni 'Regresar'.
- El page-title: nombre simple del módulo sin badges, contadores ni decoraciones.
- Los subtítulos van en el contenido, nunca dentro del page-header.

### 2.5. 🚫 PROHIBICIÓN TOTAL DE ACCESO A TABLAS POR SDK (SOLO EDGE FUNCTIONS)
- **NUNCA** realizar consultas (`.select()`), inserciones (`.insert()`), actualizaciones (`.update()`) ni eliminaciones (`.delete()`) directas desde el cliente hacia las tablas de la base de datos mediante el SDK de Supabase o la clave `anon`.
- **TODAS** las operaciones de base de datos (tanto lectura como escritura) deben canalizarse **estrictamente y sin excepción a través de Edge Functions** (`/formularios`, `/personas`, `/perfiles`, `/operations`), las cuales validan la sesión, ejecutan la lógica de negocio y operan de forma segura con el Service Role de Supabase.
- **El SDK del cliente queda restringido ÚNICAMENTE a:**
  1. Autenticación y estado de sesión (`client.auth`).
  2. Almacenamiento y subida de archivos multimedia a Storage (`client.storage`).

### 2.6. 🚫 CODIFICACIÓN ESTRICTA UTF-8 (ESPAÑOL COLOMBIA, TILDES Y 'Ñ')
- **TODOS** los archivos de código, documentación, prompts y herramientas deben leerse, escribirse y editarse estrictamente en codificación **UTF-8 limpia**, preservando siempre los caracteres nativos del español (tildes `á, é, í, ó, ú`, diéresis `ü`, letra `ñ/Ñ`, apertura de signos `¿`, `¡`).
- **PROHIBICIÓN ESTRICTA CON POWERSHELL Y TERMINAL:**
  1. **NUNCA** usar operadores de redirección simples de PowerShell (`>`, `>>`) ni comandos como `echo ... > archivo` o `Out-File` / `Set-Content` sin codificación UTF-8 explícita (`-Encoding utf8`), ya que PowerShell por defecto en Windows usa ANSI / UTF-16LE o Windows-1252, corrompiendo tildes y eñes.
  2. Si se ejecutan comandos en PowerShell que manipulen texto en español, debe garantizarse previamente `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` y `$OutputEncoding = [System.Text.Encoding]::UTF8`.
  3. **Usar siempre herramientas de edición de archivos seguras en UTF-8 nativo** (`write_to_file`, `replace_file_content`) en lugar de pipes o concatenaciones de terminal que puedan dañar el encoding.
- **PROHIBIDO** generar o introducir caracteres corruptos por mal manejo de encoding (mojibake por ISO-8859 o Windows-1252). Cualquier herramienta de edición debe garantizar UTF-8 nativo.

---

## 3. PATRÓN ESTÁNDAR PARA MÓDULOS (PRESENTATION)

Cada módulo en `src/presentation/modules/<nombre>/<Nombre>Module.js` debe seguir esta estructura:

```js
import { Store } from '../../state/Store.js';
import { Toast } from '../../components/Toast.js';

export class EjemploModule {
    constructor({ router, useCase, dataService }) {
        this.router = router;
        this.useCase = useCase;
        this.dataService = dataService;
        this.container = null;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.className = 'mod-ejemplo';
        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn" id="btn-back" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Título del Módulo</h1>
            </div>
            <div class="mod-content" id="mod-content">
                <!-- Contenido dinámico -->
            </div>
        `;

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        this._bindEvents();
        await this._cargarDatos();
    }

    _bindEvents() {
        this.container.querySelector('#btn-back')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });
    }

    async _cargarDatos() {
        try {
            const data = await this.useCase.execute();
            // renderizar
        } catch (error) {
            Toast.error('Error al cargar datos: ' + error.message);
        }
    }

    unmount() {
        // Limpieza de eventos, observers o elementos en body
        this.container = null;
    }
}
```

---

## 4. ESTADO GLOBAL, SESIÓN Y SERVICIOS

### Estado Global con `Store.js`:
```js
import { Store } from '../../state/Store.js';

// Leer estado actual:
const { currentUser, session } = Store.getState();

// Suscribirse a cambios:
const unsubscribe = Store.subscribe((state, prevState) => {
    console.log('Nuevo usuario:', state.currentUser);
});

// Desuscribirse al salir:
unsubscribe();
```

### Notificaciones Globales con `Toast.js`:
```js
import { Toast } from '../../components/Toast.js';

Toast.success('Operación exitosa');
Toast.error('Ocurrió un error inesperado');
Toast.warning('Verifique los campos requeridos');
Toast.info('Cargando información...');
```

### Modales Reutilizables con `Modal.js`:
```js
import { Modal } from '../../components/Modal.js';

Modal.open({
    title: 'Confirmación',
    contentHtml: '<p>¿Desea continuar con esta acción?</p>',
    onOpen: (body) => {
        // vincular eventos en body
    },
    onClose: () => {
        // callback al cerrar
    }
});
```

---

## 5. CAPAS DE DISEÑO, Z-INDEX Y COMPORTAMIENTO MÓVIL

Para garantizar que los modales y bottom sheets no queden tapados por la barra de navegación inferior fija (`.bottom-nav`), se deben respetar las siguientes jerarquías de capas:

| Componente | z-index | Posicionamiento / Observaciones |
|---|---|---|
| `Contenido normal` | `1 - 10` | En flujo de scroll dentro de `#module-viewport` |
| `.page-header` | `50` | `sticky; top: 0;` con backdrop-filter |
| `.bottom-nav` | `100` | `fixed; bottom: 0;` fijo en la parte inferior |
| `.p-backdrop` / `.modal-backdrop` | `1000` | `fixed; inset: 0;` en `document.body` |
| `.p-sheet` / `.modal-content` | `1001` | `fixed; bottom: 0; max-width: 480px; margin: 0 auto;` |
| `.toast-container` | `9999` | `fixed; top: 18px; left: 50%;` Dynamic Island / HUD |

### Botones de Acción en Bottom Sheets:
Los botones de confirmación/cancelación de modales inferiores deben usar:
```css
.p-sheet-actions {
    position: sticky;
    bottom: 0;
    background: #fff;
    border-top: 1px solid #f1f5f9;
    padding: 14px 20px calc(env(safe-area-inset-bottom, 0px) + 16px);
    z-index: 10;
}
```

---

## 6. REGISTRO DE NUEVAS RUTAS Y MÓDULOS

Para añadir un nuevo módulo al sistema:

1. **Crear el módulo UI:** `calidad/src/presentation/modules/<nombre>/<Nombre>Module.js`.
2. **Crear estilos (si aplica):** `calidad/assets/css/<nombre>.css` e importarlo en `calidad/index.html`.
3. **Registrar en `calidad/src/main.js`:**
   ```js
   import { MiNuevoModule } from './presentation/modules/minuevo/MiNuevoModule.js';
   // ...
   router.register('minuevo', class {
       constructor({ router }) {
           this._mod = new MiNuevoModule({ router, useCase: getMiUseCase });
       }
       async mount(vp) { await this._mod.mount(vp); }
       unmount() { this._mod.unmount(); }
   });
   ```
4. **Habilitar en el catálogo de Apps:** En `calidad/src/presentation/modules/apps/AppsModule.js` (`APPS_REGISTRY`), configurar `active: true`.

---

## 7. PROCESO DE MIGRACIÓN DESDE `migracion [ Imput ]/`

1. **Consultar:** Revisar el HTML, lógica y CSS legacy en `migracion [ Imput ]/public/modules/<modulo>/`.
2. **Refactorizar a Hexagonal:**
   - Separar llamadas directas a APIs o Supabase en `core/ports` y `infrastructure/supabase/`.
   - Encapsular la lógica de negocio en `core/usecases/`.
   - Construir la vista con ES6 Modules en `src/presentation/modules/`.
   - Aplicar los tokens CSS modernos (`tokens.css`, `styles.css`).
3. **Verificar:** Validar sin browser automático que el ciclo de vida `mount`/`unmount` y la gestión de datos operen correctamente.

---

## 8. MODO CAVEMAN (COMUNICACIÓN Y EJECUCIÓN DIRECTA)

Para maximizar la eficiencia y velocidad en el desarrollo:

- **Cero Relleno / Sin Rodeos:** Respuestas directas, cortas y al grano. Sin introducciones floridas, sin disculpas, sin saludos repetitivos.
- **Acción Primero:** Resolver el problema directamente en el código. Menos charla, más código y diffs precisos.
- **Densidad de Información:** Explicar *qué se hizo*, *por qué* y *archivos modificados* usando viñetas directas y compactas.
- **Precisión Técnica:** Ir directo a la causa raíz de bugs o requerimientos sin rodeos teóricos.

---

## 9. ESTÁNDARES DE DISEÑO UI: HEADERS GLOBALES
- **Títulos de Header Siempre Centrados:** Todos los encabezados (`.page-header`, `.feed-header`, `.profile-header`) deben tener el título (`.page-title`) matemáticamente centrado en el viewport.
- **Botones de Navegación y Acciones:** El botón de regreso (`.back-btn`) se ubica anclado a la izquierda (`left: 1rem`), y las acciones secundarias (`.feed-actions`, `.header-actions`) se anclan a la derecha (`right: 1rem`) sin empujar ni desfasar el título central.
