/* ============================================================
   modules/login/script.js — Lógica del módulo Login
   Funciona tanto cargado por el router SPA como desde login.html
   ============================================================ */

(function _loginModule() {
    'use strict';

    /* ── Referencias al DOM ─────────────────────────────────── */
    const form      = document.getElementById('lf-form');
    const emailEl   = document.getElementById('lf-email');
    const passEl    = document.getElementById('lf-pass');
    const btn       = document.getElementById('lf-btn');
    const btnTxt    = document.getElementById('lf-btn-txt');
    const btnIcon   = document.getElementById('lf-btn-icon');
    const errBox    = document.getElementById('lf-error');
    const errTxt    = document.getElementById('lf-error-txt');
    const pwToggle  = document.getElementById('lf-pw-toggle');
    const eyeIcon   = document.getElementById('lf-eye-icon');
    const forgotBtn = document.getElementById('lf-forgot');

    if (!form) return; /* el fragmento aún no está en el DOM */

    /* ── Toggle mostrar/ocultar contraseña ──────────────────── */
    let pwVisible = false;
    pwToggle.addEventListener('click', () => {
        pwVisible = !pwVisible;
        passEl.type = pwVisible ? 'text' : 'password';
        /* cambiar ícono: ojo cerrado / ojo abierto */
        eyeIcon.innerHTML = pwVisible
            ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>`
            : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>`;
    });

    /* ── Recuperar contraseña ───────────────────────────────── */
    forgotBtn.addEventListener('click', async () => {
        const email = emailEl.value.trim();
        if (!email || !email.includes('@')) {
            _showError('Ingresa tu correo primero para recuperar la contraseña.');
            emailEl.focus();
            return;
        }
        _hideError();
        _setLoading(true, 'Enviando...');
        try {
            const sb = _getSB();
            if (!sb) throw new Error('Cliente Supabase no disponible');
            const { error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/index.html`
            });
            if (error) throw error;
            _setSuccess('¡Revisa tu correo! Te enviamos el enlace de recuperación.');
        } catch (err) {
            _showError('No se pudo enviar el correo. Verifica la dirección e inténtalo de nuevo.');
        } finally {
            setTimeout(() => _setLoading(false), 1500);
        }
    });

    /* ── Submit: iniciar sesión ─────────────────────────────── */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        _hideError();

        const email = emailEl.value.trim();
        const pass  = passEl.value;

        /* Validación básica */
        if (!email || !pass) {
            _showError('Completa todos los campos para continuar.');
            return;
        }
        if (!email.includes('@')) {
            _showError('Ingresa un correo electrónico válido.');
            emailEl.focus();
            return;
        }

        _setLoading(true, 'Verificando...');

        try {
            const sb = _getSB();
            if (!sb) throw new Error('Cliente Supabase no disponible. Recarga la página.');

            /* Llamada al SDK de Supabase */
            const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

            if (error) throw error;
            if (!data.session) throw new Error('No se pudo establecer la sesión.');

            /* Éxito: feedback visual y redirección */
            _setSuccess('Acceso concedido');
            passEl.value = '';

            setTimeout(() => {
                /* Si estamos en login.html standalone → ir a index.html */
                const isStandalone = window.location.pathname.toLowerCase().includes('login.html') ||
                                     window.location.pathname === '/login.html';
                if (isStandalone) {
                    const redirect = sessionStorage.getItem('auth_redirect') || 'index.html';
                    sessionStorage.removeItem('auth_redirect');
                    window.location.replace(redirect);
                } else if (window.AppRouter) {
                    /* Si fue cargado por el router SPA, no debería llegar aquí
                       porque el guard habrá redirigido. Por seguridad: */
                    window.location.reload();
                }
            }, 700);

        } catch (err) {
            console.error('[LOGIN] Error:', err);
            _setLoading(false);
            passEl.value = '';
            passEl.focus();

            /* Mensajes de error amigables */
            const msg = err.message || '';
            if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
                _showError('Correo o contraseña incorrectos. Verifica tus datos.');
            } else if (msg.includes('Email not confirmed')) {
                _showError('Confirma tu correo electrónico antes de ingresar.');
            } else if (msg.includes('Too many requests') || msg.includes('rate limit')) {
                _showError('Demasiados intentos. Espera un momento e inténtalo de nuevo.');
            } else if (msg.includes('Network') || msg.includes('fetch')) {
                _showError('Sin conexión. Verifica tu red e inténtalo de nuevo.');
            } else {
                _showError(msg || 'Error al iniciar sesión. Inténtalo de nuevo.');
            }
        }
    });

    /* ── Helpers UI ─────────────────────────────────────────── */
    function _showError(msg) {
        errTxt.textContent = msg;
        errBox.classList.add('visible');
    }
    function _hideError() {
        errBox.classList.remove('visible');
    }
    function _setLoading(on, label = 'Iniciar sesión') {
        btn.disabled  = on;
        emailEl.disabled = on;
        passEl.disabled  = on;
        btn.classList.remove('success');
        if (on) {
            btn.innerHTML = `<div class="lf-spinner"></div><span>${label}</span>`;
        } else {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>Iniciar sesión</span>`;
        }
    }
    function _setSuccess(label = 'Acceso concedido') {
        btn.disabled = true;
        btn.classList.add('success');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${label}</span>`;
    }
    function _getSB() {
        if (typeof getSupabaseClient === 'function') return getSupabaseClient();
        if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY) {
            return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return null;
    }

})();
