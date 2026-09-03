/* ============================================================
   APP.JS — Router y cargador de módulos · RRHH Mobile
   ============================================================

   ARQUITECTURA
   ─────────────
   • index.html es el shell: contiene #view-apps (siempre en DOM)
     y #view-module (vacío hasta que el router inyecta un módulo).
   • Cada módulo vive en  modules/<id>/index.html  (fragmento HTML)
                                       style.css
                                       script.js
   • El router carga el fragmento HTML vía fetch, adjunta el CSS
     con un <link> y ejecuta el script.js del módulo.
   • El 4.º botón de la nav es dinámico: refleja el ícono y nombre
     del último módulo de app-card visitado.

   API PÚBLICA  →  window.AppRouter
   ────────────────────────────────
   AppRouter.navigate(moduleId)   navega a un módulo o a 'apps'
   AppRouter.current()            devuelve el id activo
   ============================================================ */

'use strict';

/* ================================================================
   GUARD DE SESIÓN — app.js
   auth.js ya ejecutó la redirección sincrónica si no hay sesión.
   Esta verificación adicional es un respaldo para cuando el DOM
   ya está listo pero el guard no alcanzó a redirigir.
   ================================================================ */
(function _appGuard() {
    /* Si ya se redirigió desde auth.js, no hacer nada */
    if (sessionStorage.getItem('_auth_redirecting') === 'true') return;

    /* Verificar token en localStorage */
    let hasSession = false;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.includes('-auth-token')) continue;
            const raw = localStorage.getItem(key);
            if (!raw || raw === 'null') continue;
            const s = JSON.parse(raw);
            if (s && s.access_token) { hasSession = true; break; }
        }
    } catch (_) {}

    if (!hasSession) {
        console.log('[APP] Guard: sin sesión, redirigiendo a login.html');
        sessionStorage.setItem('auth_redirect', window.location.href);
        sessionStorage.setItem('_auth_redirecting', 'true');
        window.location.replace('login.html');
        return;
    }

    /* Mostrar la app — auth.js ya hizo el guard sincrónico */
    document.body.style.visibility = '';
})();

/* ── SVG por módulo para el botón dinámico de la nav ─────── */
const MODULE_META = {
    personas:          { label: 'Personas',         svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    turnos:            { label: 'Turnos',            svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    marcajes:          { label: 'Marcajes',          svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    organigrama:       { label: 'Organigrama',       svg: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="6.5" y1="10" x2="6.5" y2="14"/><line x1="10" y1="6.5" x2="14" y2="6.5"/>' },
    desempeno:         { label: 'Desempeño',         svg: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    aprendizaje:       { label: 'Aprendizaje',       svg: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>' },
    'people-experience': { label: 'Experiencia',     svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    inicio:            { label: 'Inicio',            svg: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    chats:             { label: 'Chats',             svg: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
    reconocimientos:   { label: 'Reconocimie...',    svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    perfil:            { label: 'Perfil',            svg: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    notificaciones:    { label: 'Notificaciones',    svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    tareas:            { label: 'Tareas',            svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' },
    calendario:        { label: 'Calendario',        svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    informes:          { label: 'Informes',          svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' },
    ajustes:           { label: 'Ajustes',           svg: '<circle cx="12" cy="12" r="3"/><path d="M12 1v3"/><path d="M12 20v3"/><path d="M4.22 4.22l2.12 2.12"/><path d="M1 12h3"/><path d="M20 12h3"/>' },
    favoritos:         { label: 'Favoritos',         svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    equipo:            { label: 'Equipo',            svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' },
    estadisticas:      { label: 'Estadísticas',      svg: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>' },
    mensajes:          { label: 'Mensajes',          svg: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
    archivos:          { label: 'Archivos',          svg: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>' },
    nube:              { label: 'Nube',              svg: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>' },
    seguridad:         { label: 'Seguridad',         svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>' },
    guardados:         { label: 'Guardados',         svg: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' },
    reuniones:         { label: 'Reuniones',         svg: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>' },
    formularios:       { label: 'Formularios',       svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' },
    encuestas:         { label: 'Encuestas',         svg: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    feedback:          { label: 'Feedback',          svg: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
    objetivos:         { label: 'Objetivos',         svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    capacitacion:      { label: 'Capacitación',      svg: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
    bienestar:         { label: 'Bienestar',         svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    talento:           { label: 'Talento',           svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    contactos:         { label: 'Contactos',         svg: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>' },
    accesos:           { label: 'Accesos',           svg: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>' },
    camara:            { label: 'Cámara',            svg: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>' },
    actividad:         { label: 'Actividad',         svg: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    iconos:            { label: 'Íconos',            svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
};

/* Módulos que van en botones de nav fija (no generan entrada en nav-dynamic) */
const NAV_FIXED = new Set(['inicio', 'chats', 'apps', 'perfil']);

/* ─────────────────────────────────────────────────────────── */

const viewApps   = document.getElementById('view-apps');
const viewModule = document.getElementById('view-module');
const navBtns    = document.querySelectorAll('.nav-btn[data-nav]');
const navDynamic = document.getElementById('nav-dynamic');
const viewport   = document.getElementById('module-viewport');

/* CSS ya cargados — evita duplicar <link> */
const loadedCSS = new Set();
/* Scripts ya ejecutados — evita re-ejecutar */
const loadedScripts = new Set();

let currentModule = 'apps';
let lastAppModule = 'reconocimientos'; /* último módulo de app-card visitado */

/* ── Reloj en status-bar (si existiera) ─────────────────── */
(function clock() {
    const el = document.querySelector('.status-bar .time');
    if (!el) return;
    const tick = () => {
        const d  = new Date();
        el.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    tick();
    setInterval(tick, 30_000);
})();

/* ── Carga CSS de módulo ────────────────────────────────── */
function loadModuleCSS(id) {
    if (loadedCSS.has(id)) return;
    loadedCSS.add(id);
    const link  = document.createElement('link');
    link.rel    = 'stylesheet';
    link.href   = `modules/${id}/style.css`;
    document.head.appendChild(link);
}

/* ── Ejecuta el script.js del módulo (devuelve Promise) ─── */
function runModuleScript(id) {
    return new Promise((resolve) => {
        /* Elimina el script anterior del mismo módulo si existe */
        const old = document.querySelector(`script[data-module="${id}"]`);
        if (old) old.remove();

        const s = document.createElement('script');
        s.src = `modules/${id}/script.js?t=${Date.now()}`;
        s.dataset.module = id;
        s.onload  = resolve;
        s.onerror = resolve; /* si falla el script, seguimos igual */
        document.body.appendChild(s);
    });
}

/* ── Carga el fragmento HTML del módulo ─────────────────── */
async function loadModuleHTML(id) {
    /* Primero intentar cargar desde template (funciona sin servidor) */
    const template = document.getElementById(`template-${id}`);
    if (template) {
        console.log(`[Router] Cargando módulo "${id}" desde template`);
        return template.innerHTML;
    }

    /* Si no hay template, intentar fetch (requiere servidor) */
    try {
        const res  = await fetch(`modules/${id}/index.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log(`[Router] Cargando módulo "${id}" desde fetch`);
        return await res.text();
    } catch (e) {
        console.error(`[Router] No se pudo cargar el módulo "${id}":`, e);
        return `<div class="empty-state"><p>No se pudo cargar el módulo <strong>${id}</strong></p></div>`;
    }
}

/* ── Actualiza el botón dinámico de la nav ──────────────── */
function updateDynamicNav(id) {
    const meta = MODULE_META[id];
    if (!meta || !navDynamic) return;

    navDynamic.dataset.nav = id;
    navDynamic.innerHTML   = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${meta.svg}
        </svg>
        <span>${meta.label}</span>
    `;
}

/* ── Actualiza qué botón de nav está activo ─────────────── */
function updateNavActive(id) {
    navBtns.forEach(b => b.classList.remove('active'));

    /* Botones fijos: inicio, chats, apps, perfil */
    const fixed = document.querySelector(`.nav-btn[data-nav="${id}"]`);
    if (fixed) {
        fixed.classList.add('active');
    } else {
        /* Módulo de app-card → activa el botón dinámico */
        navDynamic?.classList.add('active');
    }
}

/* ── Scroll del viewport al top ────────────────────────── */
function scrollToTop() {
    if (viewport) viewport.scrollTop = 0;
}

/* ── Función principal de navegación ───────────────────── */
async function navigate(id) {
    if (id === currentModule) return;
    currentModule = id;

    scrollToTop();

    const shellHeader = document.querySelector('#module-viewport > .page-header');

    if (id === 'apps') {
        /* Volver al grid de apps */
        viewModule.innerHTML = '';
        viewModule.classList.remove('active');
        viewApps.classList.add('active');
        if (shellHeader) shellHeader.style.display = '';
        updateNavActive('apps');
        return;
    }

    /* Ocultar header del shell y grid de apps */
    if (shellHeader) shellHeader.style.display = 'none';
    viewApps.classList.remove('active');

    /* Mostrar viewport de módulo */
    viewModule.innerHTML = '<div class="module-loading"><span></span></div>';
    viewModule.classList.add('active');

    /* Cargar CSS antes del HTML para evitar flash sin estilos */
    loadModuleCSS(id);

    const html       = await loadModuleHTML(id);
    viewModule.innerHTML = html;

    /* Ejecutar script del módulo y esperar que cargue */
    await runModuleScript(id);

    /* Actualizar nav */
    if (!NAV_FIXED.has(id)) {
        lastAppModule = id;
        updateDynamicNav(id);
    }
    updateNavActive(id);

    /* Scroll-blur en page-header del módulo */
    const header = viewModule.querySelector('.page-header');
    if (header && viewport) {
        viewport.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', viewport.scrollTop > 10);
        }, { passive: true });
    }
}

/* ── Botones de navegación fija ─────────────────────────── */
navBtns.forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
});

/* ── App cards en el grid ────────────────────────────────── */
document.querySelectorAll('.app-card[data-module]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.module));
});

/* ── API pública ─────────────────────────────────────────── */
window.AppRouter = { navigate, current: () => currentModule };

/* ── Inicializar botón dinámico con el default ───────────── */
updateDynamicNav(lastAppModule);
