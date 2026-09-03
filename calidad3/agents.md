# AGENTS.MD — Reglas y Estrategia del Proyecto CALIDAD

## 0. ESTRUCTURA DEL PROYECTO Y CARPETAS DE TRABAJO

### Organización Principal:
```
calidad2/
├── calidad [ Output ]/        ← CÓDIGO PRINCIPAL DE TRABAJO
│   ├── private/               ← (Servidor local, no es parte del código)
│   └── public/                ← TODO EL CÓDIGO DEL PROYECTO
├── migracion Input/           ← CÓDIGO DE REFERENCIA PARA MIGRACIÓN
│   ├── private/               ← (Servidor local legacy)
│   └── public/                ← Código legacy a migrar
└── agents.md                  ← Este archivo
```

### Reglas de Carpetas:
- **`calidad [ Output ]/public/`** es donde está TODO el código del proyecto activo.
- **`migracion Input/public/`** es la fuente de información para migrar — NO modificar, solo consultar.
- **`private/`** en ambas carpetas es SOLO para ejecutar servidor local de desarrollo (ignorar).
- **SIEMPRE trabajar en `calidad [ Output ]/public/`** — ahí está index.html, css/, js/, modules/, icons/.
- Al migrar funcionalidades, tomar como referencia `migracion Input/public/` pero implementar en `calidad [ Output ]/public/`.

---

## 1. CONTEXTO DE LA APP

- App mobile-first tipo SPA que corre en un servidor local (Live Server, puerto 5501) o en Cloudflare Pages.
- Todo el código está en `calidad [ Output ]/public/`
- Shell principal: `index.html` + `js/app.js` (router).
- Autenticación: Supabase Auth (`js/auth.js`).
- Base de datos: Supabase (`js/api.js`).
- Módulos en `modules/<id>/index.html + style.css + script.js`.

---

## 2. REGLA CRÍTICA — PROHIBIDO USAR `fetch()` PARA CARGAR MÓDULOS LOCALES

### ❌ NUNCA hacer esto en un módulo:
```js
const res = await fetch('modules/personas/index.html');
const html = await res.text();
```

### ❌ NUNCA hacer esto en login.html:
```js
const res = await fetch('modules/login/index.html');
```

**Razón:** `fetch()` de archivos locales falla en `file://` y en algunos contextos de servidor. 
El router `app.js` ya maneja la carga de módulos mediante `fetch()` internamente — los módulos NO deben hacerlo entre sí.

---

## 3. ESTRATEGIA CORRECTA PARA MÓDULOS

### El router (app.js) carga el módulo así:
1. Busca `<template id="template-<id>">` en el DOM del `index.html`.
2. Si no existe, hace `fetch('modules/<id>/index.html')` automáticamente.
3. Inyecta el HTML en `#view-module`.
4. Carga `modules/<id>/style.css` como `<link>`.
5. Ejecuta `modules/<id>/script.js` como `<script>` dinámico.

### Lo que DEBE hacer cada módulo:

**`modules/<id>/index.html`** — Solo HTML puro, sin `<html>`, `<head>` ni `<body>`. Sin `<script>` ni `<link>` internos.

```html
<div class="mod-ejemplo">
    <div class="page-header">
        <h1 class="page-title">Nombre</h1>
    </div>
    <!-- contenido -->
</div>
```

**`modules/<id>/script.js`** — IIFE que espera que el DOM esté listo:

```js
(function () {
    'use strict';

    function init() {
        const root = document.getElementById('view-module') || document;
        // Usar root.querySelector() siempre, nunca document.querySelector()
        // para evitar colisiones con otros módulos
        const listEl = root.querySelector('#mi-lista');
        if (!listEl) return; // guard: DOM no listo todavía
        // ... lógica del módulo
    }

    // Esperar un tick para que el router haya inyectado el HTML
    setTimeout(init, 0);
})();
```

---

## 4. DATOS DESDE SUPABASE — ESTRATEGIA CORRECTA

### NO usar fetch() directo a Supabase en módulos:
```js
// ❌ MAL
const res = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, { ... });
```

### SÍ usar las funciones de api.js que ya están cargadas globalmente:
```js
// ✅ BIEN — estas funciones están en window porque api.js se carga en index.html
const usuarios = await fetchUsuariosData();
const plantas  = await fetchPlantasData();
```

### SÍ usar los datos ya cargados en memoria por auth.js:
```js
// ✅ MEJOR — datos ya disponibles sin llamada adicional
const usuarios = window.allUsers   || [];
const plantas  = window.allPlantas || [];
const usuario  = window.currentUser;
```

### Orden de disponibilidad de datos (de más rápido a más lento):
1. `window.currentUser` — disponible al instante (cargado por auth.js).
2. `window.allUsers` / `window.allPlantas` — disponible después de que `loadUsers()` termine.
3. `fetchUsuariosData()` / `fetchPlantasData()` — llamada nueva a Supabase.

### Patrón recomendado para módulos que necesitan listas:
```js
async function _cargar() {
    // 1. Intentar usar datos ya en memoria (sin llamada de red)
    if (window.allUsers && window.allUsers.length > 0) {
        _renderLista(window.allUsers);
        return;
    }
    // 2. Si no hay datos en memoria, cargar desde Supabase
    if (typeof fetchUsuariosData === 'function') {
        const data = await fetchUsuariosData();
        _renderLista(data);
    }
}
```

---

## 5. CLIENTE SUPABASE — USO CORRECTO

### Obtener el cliente singleton (NO crear uno nuevo):
```js
// ✅ BIEN — usa el singleton ya creado por auth.js / api.js
const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
```

### Las constantes `SUPABASE_URL` y `SUPABASE_KEY` ya están en `window` globalmente vía `config.js`. No redeclararlas con `const`.

---

## 6. HEADERS SIMETRÍA — TODOS LOS MÓDULOS IGUALES

Todos los módulos deben usar exactamente este header:
```html
<div class="page-header">
    <h1 class="page-title">Nombre del Módulo</h1>
    <!-- acciones opcionales a la derecha -->
    <div class="feed-actions">
        <button class="icon-btn" title="Acción">
            <svg viewBox="0 0 24 24">...</svg>
        </button>
    </div>
</div>
```

El CSS en `styles.css` unifica `.page-header`, `.feed-header` y `.profile-header` con:
- `height: 52px` fijo
- `padding: 0 1rem`
- `border-bottom: 1px solid var(--color-border)`
- `position: sticky; top: 0; z-index: 10`

---

## 7. VARIABLES CSS — TOKENS GLOBALES

Siempre usar los tokens de `styles.css`, nunca hardcodear colores:

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#3b82f6` | Azul principal, botones |
| `--color-text` | `#1e293b` | Texto principal |
| `--color-text-muted` | `#64748b` | Texto secundario |
| `--color-text-light` | `#94a3b8` | Texto deshabilitado |
| `--color-border` | `#e2e8f0` | Bordes y separadores |
| `--color-surface` | `#ffffff` | Fondo de cards |
| `--color-bg` | `#ffffff` | Fondo general |
| `--nav-height` | `64px` | Altura del bottom-nav |
| `--font` | `'Segoe UI', Roboto, system-ui` | Tipografía |
| `--radius-sm` | `8px` | Radio pequeño |
| `--radius-md` | `16px` | Radio medio |

---

## 8. NAVEGACIÓN ENTRE MÓDULOS

```js
// Dentro de un módulo, navegar a otro:
window.AppRouter?.navigate('nombre-modulo');

// Volver al grid de apps:
window.AppRouter?.navigate('apps');
```

---

## 9. LOGOUT — SOLO DESDE auth.js

```js
// ✅ BIEN
window.logout();

// ✅ Con fallback si auth.js no cargó (solo en casos extremos)
if (typeof window.logout === 'function') {
    window.logout();
} else {
    // limpiar tokens manualmente
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.includes('-auth-token') || k.startsWith('sb-'))) localStorage.removeItem(k);
    }
    window.location.replace('login.html');
}
```

---

## 10. ESTRUCTURA DE ARCHIVOS

```
calidad [ Output ]/public/      ← TODO EL CÓDIGO AQUÍ
├── index.html                  ← Shell SPA, guard de auth en <head>
├── login.html                  ← Standalone, CSS embebido, sin fetch local
├── manifest.json               ← PWA manifest
├── css/
│   ├── styles.css              ← Tokens + componentes globales
│   └── icons.css               ← Íconos SVG como clases CSS
├── js/
│   ├── config.js               ← SUPABASE_URL, SUPABASE_KEY, CONFIG
│   ├── api.js                  ← fetchUsuariosData, fetchPlantasData, getSupabaseClient
│   ├── auth.js                 ← Guard, currentUser, loadUsers, logout, updateAuthUI
│   ├── app.js                  ← Router SPA: navigate(), AppRouter
│   └── forms/                  ← Lógica de formularios reutilizables
│       └── gas.js
├── modules/
│   └── <id>/
│       ├── index.html          ← Fragmento HTML puro (sin doctype, head, body)
│       ├── style.css           ← CSS scoped al módulo
│       └── script.js           ← IIFE, usa setTimeout(init, 0)
└── icons/                      ← app.svg, favicon.ico, etc.
```

### Carpeta de Migración (solo lectura):
```
migracion Input/public/         ← Código legacy (referencia)
```

---

## 11. PROCESO DE MIGRACIÓN

### Flujo de trabajo para migrar funcionalidades:

1. **Analizar** — Leer código en `migracion Input/public/` para entender la funcionalidad legacy.
2. **Adaptar** — Traducir la lógica al patrón moderno definido en estas reglas.
3. **Implementar** — Escribir el código en `calidad [ Output ]/public/`.
4. **Verificar** — Probar la funcionalidad migrada.

### Reglas de migración:

- **NO copiar/pegar** código legacy directamente — adaptarlo al nuevo estándar.
- **NO usar `fetch()` local** en módulos — seguir estrategia de router.
- **SÍ usar `window.allUsers`** y datos globales antes que llamadas nuevas.
- **SÍ mantener** la estructura `modules/<id>/` con `index.html`, `style.css`, `script.js`.
- **SÍ usar** tokens CSS globales de `styles.css`.

### Patrón de migración de un módulo:

```
migracion Input/public/modules/ejemplo/
├── index.html              ← Leer y analizar
├── style.css               ← Extraer estilos relevantes
└── script.js               ← Entender lógica

         ⬇️ MIGRAR ⬇️

calidad [ Output ]/public/modules/ejemplo/
├── index.html              ← HTML puro adaptado
├── style.css               ← Estilos con tokens CSS
└── script.js               ← IIFE con patrón moderno
```

---

## 12. ERRORES COMUNES A EVITAR

| Error | Causa | Solución |
|---|---|---|
| `SUPABASE_KEY already declared` | `api.js` redeclara la constante | En `api.js` no redeclarar, ya viene de `config.js` |
| Módulo vacío / sin datos | `fetch()` de HTML local falla | El router lo maneja, el módulo usa `window.allUsers` |
| Pantalla en blanco en `index.html` | Guard no quita el `visibility:hidden` | `auth.js` lo quita al confirmar sesión en `_authGuard` |
| Login en bucle | Flags `_auth_redirecting` mal limpiados | `login.html` limpia `sessionStorage.removeItem('_auth_redirecting')` al cargar |
| `document.querySelector` en módulo afecta otros elementos | Busca en todo el DOM | Usar `root.querySelector()` donde `root = document.getElementById('view-module')` |
| Template cargado en vez del módulo | Existe `<template id="template-<id>">` en `index.html` | Eliminar el template del `index.html`, dejar que el router use `fetch` |
