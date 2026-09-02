/* ── Módulo: Perfil ── */
(function () {
    'use strict';

    function init() {
        const root = document.getElementById('view-module') || document;
        const u    = window.currentUser || {};

        /* ── Poblar datos del usuario ───────────────────────── */

        /* Nombre principal */
        const nameEl = root.querySelector('.profile-name');
        if (nameEl) {
            nameEl.textContent = u.USUARIO || u.PLANTA || u.EMAIL || 'Sin nombre';
        }

        /* Avatar: iniciales sobre gradiente */
        const avatarImg = root.querySelector('.profile-avatar');
        if (avatarImg) {
            /* Ocultar imagen placeholder, mostrar iniciales */
            const name   = u.USUARIO || u.PLANTA || '';
            const parts  = name.trim().split(' ').filter(Boolean);
            const inits  = parts.length >= 2
                ? (parts[0][0] + parts[1][0]).toUpperCase()
                : name.slice(0, 2).toUpperCase() || 'US';
            const grads  = {
                'ADMIN':     'linear-gradient(135deg,#6366f1,#8b5cf6)',
                'MODERATOR': 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                'USER-P':    'linear-gradient(135deg,#10b981,#059669)',
                'GUEST':     'linear-gradient(135deg,#f59e0b,#d97706)',
            };
            const grad = grads[u.ROL] || 'linear-gradient(135deg,#64748b,#475569)';
            avatarImg.style.display = 'none';
            const container = avatarImg.parentElement;
            if (container && !container.querySelector('.perfil-avatar-initials')) {
                const span = document.createElement('span');
                span.className = 'perfil-avatar-initials';
                span.style.cssText = `
                    width:80px;height:80px;border-radius:50%;
                    background:${grad};
                    display:flex;align-items:center;justify-content:center;
                    font-size:1.6rem;font-weight:700;color:#fff;
                    border:3px solid #fff;
                    box-shadow:0 6px 18px rgba(0,0,0,.08);`;
                span.textContent = inits;
                container.insertBefore(span, avatarImg);
            }
        }

        /* Campos del acordeón Datos */
        _setInfo(root, 'fecha-contratacion', u.FECHA_INGRESO || u.fecha_ingreso || '—');
        _setInfo(root, 'cargo',              u.CARGO        || u.cargo        || '—');
        _setInfo(root, 'area',               u.AREA         || u.area         || u.DEPARTAMENTO || '—');
        _setInfo(root, 'rol',                u.ROL          || '—');
        _setInfo(root, 'id-usuario',         u.ID_USUARIO   || u.ID_PLANTA    || '—');

        /* Campos del acordeón Segmentación */
        _setInfo(root, 'productora',         u.PRODUCTORA   || u.productora   || '—');
        _setInfo(root, 'ciudad',             u.CIUDAD       || u.ciudad       || '—');
        _setInfo(root, 'departamento',       u.DEPARTAMENTO || u.departamento || '—');
        _setInfo(root, 'pais',               u.PAIS         || u.pais         || 'Colombia');

        /* Campos del acordeón Contacto */
        _setInfo(root, 'email',              u.EMAIL || u.CORREO || u.email || '—');
        _setInfo(root, 'telefono',           u.TELEFONO || u.telefono || '—');
        _setInfo(root, 'direccion',          u.DIRECCION || u.direccion || '—');

        /* Meta visual bajo el nombre */
        const metaItems = root.querySelectorAll('.mod-perfil .meta-item span');
        if (metaItems[0]) metaItems[0].textContent = u.CIUDAD || u.ciudad || 'Grupo TDM';
        if (metaItems[1]) metaItems[1].textContent = u.PRODUCTORA || u.productora || 'Grupo TDM';

        /* ── Tabs ────────────────────────────────────────────── */
        const tabs = root.querySelectorAll('.mod-perfil .profile-tabs .tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        /* ── Acordeón ────────────────────────────────────────── */
        root.querySelectorAll('.mod-perfil .accordion').forEach(acc => {
            const header = acc.querySelector('.accordion-header');
            if (!header) return;
            header.addEventListener('click', () => {
                const isOpen = acc.classList.contains('open');
                root.querySelectorAll('.mod-perfil .accordion').forEach(a => a.classList.remove('open'));
                if (!isOpen) acc.classList.add('open');
            });
        });

        /* ── Scroll blur ─────────────────────────────────────── */
        const viewport      = document.getElementById('module-viewport');
        const profileHeader = root.querySelector('.mod-perfil .profile-header');
        if (viewport && profileHeader) {
            viewport.addEventListener('scroll', () => {
                profileHeader.classList.toggle('scrolled', viewport.scrollTop > 10);
            }, { passive: true });
        }

        /* ── Botón Organigrama ───────────────────────────────── */
        root.querySelector('.mod-perfil .btn-secondary')
            ?.addEventListener('click', () => window.AppRouter?.navigate('organigrama'));

        /* ── Botón Cerrar sesión ─────────────────────────────── */
        const btnSalir = root.querySelector('.mod-perfil [aria-label="Cerrar sesión"]');
        if (btnSalir) {
            btnSalir.onclick = function () {
                if (typeof window.logout === 'function') {
                    window.logout();
                    return;
                }
                try {
                    const keys = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (k.includes('-auth-token') || k.startsWith('sb-'))) keys.push(k);
                    }
                    keys.push('busint_user', 'busint_productora', 'busint_universal_plant');
                    keys.forEach(k => localStorage.removeItem(k));
                    sessionStorage.clear();
                } catch (_) {}
                window.location.replace('login.html');
            };
        }
    }

    /* Helper: actualiza el .info-value del item con data-field="X" */
    function _setInfo(root, field, value) {
        const el = root.querySelector(`.mod-perfil [data-field="${field}"] .info-value`);
        if (el) el.textContent = value;
    }

    setTimeout(init, 0);
})();
