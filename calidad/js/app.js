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
    personas:          { label: 'Personas',         icon: 'user-multiple-accounts-flat' },
    turnos:            { label: 'Turnos',            icon: 'calendar-mark-flat' },
    marcajes:          { label: 'Marcajes',          icon: 'fingerprint-2-flat' },
    organigrama:       { label: 'Organigrama',       icon: 'hierarchy-1-flat' },
    desempeno:         { label: 'Desempeño',         icon: 'graph-bar-increase-flat' },
    aprendizaje:       { label: 'Aprendizaje',       icon: 'global-learning-flat' },
    'people-experience': { label: 'Experiencia',     icon: 'user-feedback-heart-flat' },
    inicio:            { label: 'Inicio',            icon: 'home-1-flat' },
    chats:             { label: 'Chats',             icon: 'chat-bubble-text-square-flat' },
    reconocimientos:   { label: 'Reconocimientos',    icon: 'star-medal-flat' },
    perfil:            { label: 'Perfil',            icon: 'user-sticker-square-flat' },
    notificaciones:    { label: 'Notificaciones',    icon: 'ringing-bell-notification-flat' },
    tareas:            { label: 'Tareas',            icon: 'task-list-edit-flat' },
    calendario:        { label: 'Calendario',        icon: 'calendar-check-flat' },
    informes:          { label: 'Informes',          icon: 'file-report-flat' },
    ajustes:           { label: 'Ajustes',           icon: 'cog-flat' },
    favoritos:         { label: 'Favoritos',         icon: 'bookmark-flat' },
    equipo:            { label: 'Equipo',            icon: 'hierarchy-15-flat' },
    estadisticas:      { label: 'Estadísticas',      icon: 'content-statistic-flat' },
    mensajes:          { label: 'Mensajes',          icon: 'mail-send-email-message-flat' },
    archivos:          { label: 'Archivos',          icon: 'file-folder-flat' },
    nube:              { label: 'Nube',              icon: 'cloud-data-transfer-flat' },
    seguridad:         { label: 'Seguridad',         icon: 'shield-1-flat' },
    guardados:         { label: 'Guardados',         icon: 'archive-box-flat' },
    reuniones:         { label: 'Reuniones',         icon: 'presentation-flat' },
    formularios:       { label: 'Formularios',       icon: 'description-flat' },
    encuestas:         { label: 'Encuestas',         icon: 'notepad-text-flat' },
    feedback:          { label: 'Feedback',          icon: 'help-chat-1-flat' },
    objetivos:         { label: 'Objetivos',         icon: 'target-3-flat' },
    capacitacion:      { label: 'Capacitación',      icon: 'graduation-cap-flat' },
    bienestar:         { label: 'Bienestar',         icon: 'like-1-flat' },
    talento:           { label: 'Talento',           icon: 'multiple-stars-flat' },
    contactos:         { label: 'Contactos',         icon: 'contact-phonebook-flat' },
    accesos:           { label: 'Accesos',           icon: 'padlock-key-flat' },
    camara:            { label: 'Cámara',            icon: 'camera-1-flat' },
    actividad:         { label: 'Actividad',         icon: 'heart-rate-pulse-graph-flat' },
    iconos:            { label: 'Íconos',            icon: 'magic-wand-1-flat' }
};



/* Módulos que van en botones de nav fija (no generan entrada en nav-dynamic) */
const NAV_FIXED = new Set(['inicio', 'chats', 'apps', 'notificaciones', 'perfil']);

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
let lastAppModule = 'people-experience'; /* último módulo de app-card visitado */

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
/* ── Actualiza el botón nav dinámico (DESACTIVADO - nav queda fijo) ── */
function updateDynamicNav(id) {
    // Función desactivada - el nav ya no cambia dinámicamente
    return;
    
    /* Código original comentado:
    const meta = MODULE_META[id];
    if (!meta || !navDynamic) return;

    navDynamic.dataset.nav = id;
    navDynamic.innerHTML = `
        <iconify-icon icon="streamline-plump-color:${meta.icon}" class="nav-icon-mono"></iconify-icon>
        <span>${meta.label}</span>
    `;
    */
}

/* ── Actualiza qué botón de nav está activo ─────────────── */
function updateNavActive(id) {
    navBtns.forEach(b => b.classList.remove('active'));

    /* Si el módulo tiene botón fijo en nav (inicio, chats, notificaciones, perfil) */
    const fixed = document.querySelector(`.nav-btn[data-nav="${id}"]`);
    if (fixed) {
        fixed.classList.add('active');
    } else {
        /* Módulo de app-card sin botón en nav → mantiene "apps" activo */
        const appsBtn = document.querySelector('.nav-btn[data-nav="apps"]');
        appsBtn?.classList.add('active');
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

    /* ── Actualizar nav INMEDIATAMENTE (antes de cualquier await) ── */
    if (!NAV_FIXED.has(id)) {
        lastAppModule = id;
        updateDynamicNav(id);
    }
    updateNavActive(id);

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
