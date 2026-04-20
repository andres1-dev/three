// Detección robusta de página de Login
const IS_LOGIN_PAGE = window.location.pathname.toLowerCase().includes('login.html');

// Función auxiliar para validar si existe una sesión real y válida
function hasValidSession() {
    const session = localStorage.getItem('sispro_user');
    if (!session || session === 'undefined' || session === 'null') return false;
    try {
        const parsed = JSON.parse(session);
        return !!parsed;
    } catch (e) {
        return false;
    }
}

// CHEQUEO SINCRÓNICO INMEDIATO (Escudo de Seguridad v3)
(function() {
    if (!hasValidSession() && !IS_LOGIN_PAGE) {
        window.location.replace('login.html');
    }
})();

let currentUser = (() => {
    try {
        const session = localStorage.getItem('sispro_user');
        if (session === 'undefined' || session === 'null') return null;
        return JSON.parse(session) || null;
    } catch (e) {
        return null;
    }
})();
let allUsers = [];
let allPlantas = [];

// ── Render inmediato del nav desde localStorage (sin esperar red) ──
(function _renderNavInstant() {
    if (IS_LOGIN_PAGE) return;
    if (!currentUser) return;

    let avatarStyle = '';
    let iconClass = 'fas fa-user-secret';
    let profileType = 'user-guest';
    try {
        const prefs = JSON.parse(localStorage.getItem('sispro_avatar_prefs') || '{}');
        if (prefs.image) avatarStyle = `background:url('${prefs.image}') center/cover no-repeat;width:28px;height:28px;`;
        else if (prefs.color) avatarStyle = `background:${prefs.color};`;
    } catch(_) {}

    const rol = currentUser.ROL || '';
    profileType = `role-${rol.toLowerCase()}`;
    if (rol === 'ADMIN')          iconClass = 'fas fa-user-shield';
    else if (rol === 'MODERATOR') iconClass = 'fas fa-user-tie';
    else if (rol === 'USER-C')    iconClass = 'fas fa-user-check';
    else if (rol === 'USER-P')    iconClass = 'fas fa-user';
    else if (rol === 'GUEST')     iconClass = 'fas fa-user-secret';

    // Obtener nombre del módulo actual desde el título de la página en mayúsculas
    const pageTitle = (document.title.split(' - ')[0] || 'SISPRO').toUpperCase();
    
    // Descripciones de módulos
    const moduleDescriptions = {
        'REPORTES': 'Registro de eventos',
        'SEGUIMIENTO': 'Estado de novedades',
        'RUTERO': 'Agenda de visitas',
        'USUARIOS': 'Gestión administrativa',
        'CALIDAD': 'Reportes técnicos',
        'NOVEDADES': 'Centro de soluciones',
        'GESTIÓN DE PLANTA': 'Datos de planta',
        'ACCESO': 'Inicio de sesión',
        'RESTABLECER CONTRASEÑA': 'Recuperar acceso',
        'CARGAR BARRAS': 'Carga de códigos de barras',
        'CARGAR CURVAS': 'Carga de curvas de producción',
        'EN PROCESO': 'Sincronización de lotes'
    };
    const moduleDesc = moduleDescriptions[pageTitle] || '';

    const html = `
        <div class="nav-brand-area">
            <img src="icons/app.svg" alt="Logo TMD" class="nav-logo">
            <span class="brand-tag">
                <span style="display:block;font-weight:800;font-size:0.9rem;">${pageTitle}</span>
                ${moduleDesc ? `<span style="display:block;font-size:0.65rem;color:#94a3b8;font-weight:500;margin-top:1px;">${moduleDesc}</span>` : ''}
            </span>
        </div>
        <div class="nav-user-area" style="display:flex;align-items:center;gap:6px;">
            <button class="btn-expand-view" id="btn-expand-view" onclick="toggleExpandView()" title="Contraer vista">
                <i class="fas fa-compress-alt"></i>
            </button>
            <div style="position:relative;display:inline-flex;align-items:center;">
                <button id="notif-bell-btn" onclick="if(typeof toggleNotifPanel==='function')toggleNotifPanel()" title="Notificaciones" style="
                    background:none;border:none;cursor:pointer;padding:6px 10px;border-radius:50%;
                    color:#64748b;font-size:1.1rem;transition:all 0.2s ease;position:relative;
                " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                    <i class="fas fa-bell"></i>
                    <span id="notif-badge" style="display:none;position:absolute;top:2px;right:2px;
                        background:#ef4444;color:white;font-size:0.6rem;font-weight:800;
                        min-width:16px;height:16px;border-radius:8px;padding:0 4px;line-height:16px;text-align:center;">0</span>
                </button>
            </div>
            <button onclick="if(typeof toggleSidebar==='function')toggleSidebar()" class="btn-profile-toggle ${profileType}" id="profileToggle">
                <span class="avatar-mini" style="${avatarStyle}"><i class="${iconClass}" style="color:white;"></i></span>
                <i class="fas fa-bars"></i>
            </button>
        </div>`;

    function _inject() {
        let nav = document.getElementById('app-top-nav');
        if (!nav) {
            nav = document.createElement('div');
            nav.id = 'app-top-nav';
            nav.className = 'app-header-bar';
            document.body.prepend(nav);
        }
        nav.innerHTML = html;
    }

    if (document.body) {
        _inject();
    } else {
        document.addEventListener('DOMContentLoaded', _inject);
    }
})();

/* ── Avatar helpers — todo en localStorage, sin GAS ── */
const AVATAR_PREFS_KEY = 'sispro_avatar_prefs';

function getAvatarPrefs() {
    try { return JSON.parse(localStorage.getItem(AVATAR_PREFS_KEY) || '{}'); } catch(_) { return {}; }
}

function saveAvatarPrefs(prefs) {
    localStorage.setItem(AVATAR_PREFS_KEY, JSON.stringify(prefs));
}

// Iconos creativos disponibles para el avatar
const AVATAR_ICONS = [
    { cls: 'fas fa-user-shield',    label: 'Escudo'      },
    { cls: 'fas fa-user-astronaut', label: 'Astronauta'  },
    { cls: 'fas fa-user-ninja',     label: 'Ninja'       },
    { cls: 'fas fa-user-tie',       label: 'Corbata'     },
    { cls: 'fas fa-ghost',          label: 'Fantasma'    },
    { cls: 'fas fa-robot',          label: 'Robot'       },
    { cls: 'fas fa-cat',            label: 'Gato'        },
    { cls: 'fas fa-dragon',         label: 'Dragón'      },
    { cls: 'fas fa-crown',          label: 'Corona'      },
    { cls: 'fas fa-star',           label: 'Estrella'    },
    { cls: 'fas fa-bolt',           label: 'Rayo'        },
    { cls: 'fas fa-fire',           label: 'Fuego'       },
    { cls: 'fas fa-leaf',           label: 'Hoja'        },
    { cls: 'fas fa-gem',            label: 'Gema'        },
    { cls: 'fas fa-rocket',         label: 'Cohete'      },
    { cls: 'fas fa-skull',          label: 'Calavera'    },
];

/** Calcula si un color hex es oscuro (para decidir color del icono) */
function _isColorDark(hex) {
    const c = hex.replace('#','');
    const r = parseInt(c.substr(0,2),16);
    const g = parseInt(c.substr(2,2),16);
    const b = parseInt(c.substr(4,2),16);
    return (r*299 + g*587 + b*114) / 1000 < 128;
}

/** Returns inline style string for an avatar element based on saved prefs */
function _avatarStyle(size = 'large') {
    const prefs = getAvatarPrefs();
    if (prefs.image) {
        const dim = size === 'mini' ? '28px' : '64px';
        return `background:url('${prefs.image}') center/cover no-repeat; width:${dim}; height:${dim};`;
    }
    if (prefs.color) return `background:${prefs.color};`;
    return '';
}

/** Returns inner HTML for avatar — uses custom icon if set, hides if image */
function _avatarInner(defaultIconClass) {
    const prefs = getAvatarPrefs();
    if (prefs.image) return '';
    const iconCls = prefs.icon || defaultIconClass;
    const color = prefs.color || null;
    const iconColor = color ? (_isColorDark(color) ? 'white' : '#1e293b') : 'white';
    return `<i class="${iconCls}" style="color:${iconColor};"></i>`;
}

/**
 * Redirige al portal de acceso profesional.
 */
function showLoginPrompt() {
    window.location.href = 'login.html';
}

/** Devuelve true si el GUEST tiene perfil incompleto (faltan EMAIL, TELEFONO o DIRECCION). */
function _guestPerfilIncompleto() {
    if (!currentUser || currentUser.ROL !== 'GUEST') return false;
    
    try {
        const fresh = JSON.parse(localStorage.getItem('sispro_user') || '{}');
        
        const tieneEmail     = String(fresh.EMAIL     || '').trim() !== '';
        const tieneTelefono  = String(fresh.TELEFONO  || '').trim() !== '';
        const tieneDireccion = String(fresh.DIRECCION || '').trim() !== '';

        // Verificar ubicación: primero en el propio objeto del usuario (guardado tras actualizar),
        // luego como fallback en currentPlantas (sincronización desde DB)
        let tieneDepartamento = String(fresh.DEPARTAMENTO || '').trim() !== '';
        let tieneCiudad       = String(fresh.CIUDAD       || '').trim() !== '';
        let tieneBarrio       = String(fresh.BARRIO       || '').trim() !== '';

        // Fallback: buscar en currentPlantas si los campos no están en el localStorage
        if ((!tieneDepartamento || !tieneCiudad || !tieneBarrio)
            && typeof currentPlantas !== 'undefined' && currentPlantas && fresh.PLANTA) {
            const plantaData = currentPlantas.find(p =>
                (p.PLANTA || '').trim().toLowerCase() === String(fresh.PLANTA || '').trim().toLowerCase()
            );
            if (plantaData) {
                if (!tieneDepartamento) tieneDepartamento = String(plantaData.DEPARTAMENTO || '').trim() !== '';
                if (!tieneCiudad)       tieneCiudad       = String(plantaData.CIUDAD       || '').trim() !== '';
                if (!tieneBarrio)       tieneBarrio       = String(plantaData.BARRIO        || '').trim() !== '';
            }
        }

        // El barrio es opcional si la ciudad no tiene barrios predefinidos en el sistema
        const ciudadActual = String(fresh.CIUDAD || '').trim();
        const barrioEsOpcional = ciudadActual !== '' &&
            typeof getBarriosPorCiudad === 'function' &&
            getBarriosPorCiudad(ciudadActual).length === 0;

        const tieneUbicacion = tieneDepartamento && tieneCiudad && (tieneBarrio || barrioEsOpcional);
        return !(tieneEmail && tieneTelefono && tieneDireccion && tieneUbicacion);

    } catch(e) {
        return !(String(currentUser.EMAIL     || '').trim() &&
                 String(currentUser.TELEFONO  || '').trim() &&
                 String(currentUser.DIRECCION || '').trim());
    }
}

/** Si el GUEST tiene perfil incompleto, redirige a index.html para forzar el formulario. */
function checkProfileComplete() {
    if (!currentUser || IS_LOGIN_PAGE) return;
    if (!_guestPerfilIncompleto()) return;
    // No redirigir si ya estamos en la página de gestión de planta (evitar loop infinito)
    if (window.location.pathname.includes('gestion-planta.html')) return;
    if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
        sessionStorage.setItem('completar_perfil', '1');
        return;
    }
    window.location.replace('index.html');
}

/**
 * Carga los usuarios y verifica sesión activa.
 */
async function loadUsers() {
    // 1. Escudo de seguridad inmediato: Redirigir si no hay sesión y NO estamos en login
    if (!hasValidSession() && !IS_LOGIN_PAGE) {
        window.location.replace('login.html');
        return;
    }

    try {
        // OPTIMIZACIÓN: Si ya tenemos datos en memoria, no volver a descargarlos 
        // a menos que sea estrictamente necesario. 
        // IMPORTANTE: NO intentar descargar datos si estamos en LOGIN para evitar errores de permisos.
        if (!IS_LOGIN_PAGE && (allUsers.length === 0 || allPlantas.length === 0)) {
            // Saltar descarga en páginas que no la necesitan (carga masiva, etc.)
            if (window._SKIP_AUTH_FETCH) {
                const saved = localStorage.getItem('sispro_user');
                if (saved) {
                    currentUser = JSON.parse(saved);
                    document.body.classList.add('auth-shield-pass');
                    applyAccessControl();
                } else if (!IS_LOGIN_PAGE) {
                    window.location.replace('login.html');
                }
                return;
            }
            const [usersData, plantasData] = await Promise.all([
                fetchUsuariosData(),
                fetchPlantasData()
            ]);
            allUsers = usersData;
            allPlantas = plantasData;
        } else {
        }

        const savedUser = localStorage.getItem('sispro_user');
        if (savedUser) {
            let parsedUser = JSON.parse(savedUser);
            // Sincronizar en caliente los datos almacenados con el último listado descargado de DB
            let realUser = allUsers.find(u => {
                const dbId = String(u.ID_USUARIO || u.ID || u.cedula || '').trim();
                const savedId = String(parsedUser.ID_USUARIO || parsedUser.ID_PLANTA || parsedUser.ID || parsedUser.cedula || '').trim();
                return dbId === savedId;
            });
            
            if (!realUser && allPlantas.length > 0) {
                realUser = allPlantas.find(u => {
                    const dbId = String(u.ID_PLANTA || u.ID || u.cedula || '').trim();
                    const savedId = String(parsedUser.ID_USUARIO || parsedUser.ID_PLANTA || parsedUser.ID || parsedUser.cedula || '').trim();
                    return dbId === savedId;
                });
            }
            
            if (realUser) {
                currentUser = realUser;

                // Bloquear sesión si la cuenta fue deshabilitada mientras estaba activa
                if (realUser.ROL === 'DESHABILITADO') {
                    localStorage.removeItem('sispro_user');
                    Swal.fire({
                        icon: 'error',
                        title: 'Cuenta Deshabilitada',
                        text: 'Su cuenta ha sido deshabilitada. Contacte al administrador.',
                        confirmButtonColor: '#3F51B5',
                    }).then(() => window.location.replace('login.html'));
                    return;
                }

                // Si el localStorage tiene datos de perfil más recientes (recién guardados),
                // preservarlos para no perderlos por latencia de la DB
                try {
                    const stored = JSON.parse(localStorage.getItem('sispro_user') || '{}');
                    if (String(stored.EMAIL        || '').trim()) realUser.EMAIL        = stored.EMAIL;
                    if (String(stored.TELEFONO     || '').trim()) realUser.TELEFONO     = stored.TELEFONO;
                    if (String(stored.DIRECCION    || '').trim()) realUser.DIRECCION    = stored.DIRECCION;
                    if (String(stored.DEPARTAMENTO || '').trim()) realUser.DEPARTAMENTO = stored.DEPARTAMENTO;
                    if (String(stored.CIUDAD       || '').trim()) realUser.CIUDAD       = stored.CIUDAD;
                    if (String(stored.BARRIO       || '').trim()) realUser.BARRIO       = stored.BARRIO;
                    currentUser = realUser;
                } catch(e) {}

                localStorage.setItem('sispro_user', JSON.stringify(currentUser));
                
                // Sincronizar config (avatar, prefs) desde servidor en background
                // (desactivado — todo en localStorage)

                // SI TODO BIEN, QUITAR EL ESCUDO Y APLICAR PERMISOS
                document.body.classList.add('auth-shield-pass');
                applyAccessControl();
                checkProfileComplete();

                // ── Inicialización universal de notificaciones (todas las páginas) ──
                if (typeof _ensureNotifPanel === 'function') _ensureNotifPanel();
                if (currentUser.ROL === 'GUEST') {
                    // app.js llama initNotifications() con datos precargados en index.html;
                    // en otras páginas lo iniciamos aquí si aún no está corriendo.
                    if (typeof initNotifications === 'function' && !window._notifsInitializedGuest) {
                        window._notifsInitializedGuest = true;
                        initNotifications();
                    }
                } else if (currentUser.ROL === 'ADMIN' || currentUser.ROL === 'USER-P') {
                    // resolucion.js llama initChatBadges() con datos ya cargados;
                    // en otras páginas lo iniciamos aquí si aún no está corriendo.
                    if (typeof initChatBadges === 'function' && !window._chatBadgesInitializedAdmin) {
                        window._chatBadgesInitializedAdmin = true;
                        initChatBadges();
                    }
                }
            } else {
                // Si el usuario ya no existe en la DB, cerrar sesión (solo si no estamos en login)
                localStorage.removeItem('sispro_user');
                if (!IS_LOGIN_PAGE) window.location.replace('login.html');
            }
        }
    } catch (error) {
        if (currentUser) {
            document.body.classList.add('auth-shield-pass');
            applyAccessControl();
        } else if (!IS_LOGIN_PAGE) {
            window.location.replace('login.html');
        }
    }
}


/**
 * Valida si un usuario GUEST tiene todos los datos obligatorios completos.
 * @param {Object} user - Objeto de usuario/planta
 * @returns {boolean} - true si tiene todos los datos, false si falta alguno
 */
function validarDatosCompletos(user) {
    // Campos obligatorios para GUEST
    const camposObligatorios = [
        'ID_PLANTA',
        'PLANTA',
        'DIRECCION',
        'TELEFONO',
        'EMAIL',
        'DEPARTAMENTO',
        'CIUDAD',
        'BARRIO'
    ];
    
    for (const campo of camposObligatorios) {
        const valor = user[campo];
        if (!valor || String(valor).trim() === '') {
            return false;
        }
    }
    
    return true;
}

/**
 * Valida las credenciales.
 */
async function handleLogin(userId, password, isLoginPage = false, tipoAcceso = 'interno') {
    let targetArray = tipoAcceso === 'interno' ? allUsers : allPlantas;
    
    // Buscar en el array cargado
    let userFound = targetArray.find(u => {
        const dbId = String(u.ID_USUARIO || u.ID_PLANTA || u.ID || u.USUARIO || u.CEDULA || '').trim();
        const dbPass = String(u.PASSWORD || u.CONTRASEÑA || u.PASS || u.CLAVE || '').trim();
        const inputId = String(userId).trim();
        const inputPass = String(password).trim();
        
        const idMatch = dbId.toLowerCase() === inputId.toLowerCase();
        const passMatch = dbPass === inputPass;
        
        return idMatch && passMatch;
    });
    
    // Si no se encontró y es una planta, buscar directamente en Supabase
    if (!userFound && tipoAcceso === 'planta') {
        try {
            const directSearch = await fetchSupabaseData('PLANTAS', {
                filters: [{ type: 'eq', column: 'ID_PLANTA', value: userId }]
            });
            
            if (directSearch && directSearch.length > 0) {
                const plantaDirecta = directSearch[0];
                
                // Verificar contraseña
                const dbPass = String(plantaDirecta.PASSWORD || plantaDirecta.CONTRASEÑA || '').trim();
                const inputPass = String(password).trim();
                
                if (dbPass === inputPass) {
                    userFound = plantaDirecta;
                    
                    // Agregar al array para futuras búsquedas en esta sesión
                    allPlantas.push(plantaDirecta);
                }
            }
        } catch (err) {
            console.error('[handleLogin] Error en búsqueda directa:', err);
        }
    }

    if (userFound) {
        // Bloquear acceso a cuentas no aprobadas o deshabilitadas
        if (userFound.ROL === 'PENDIENTE') {
            Swal.fire({
                icon: 'warning',
                title: 'Acceso Restringido',
                text: 'Su solicitud de acceso aún se encuentra PENDIENTE de aprobación por el Administrador.',
                confirmButtonColor: '#3F51B5'
            });
            return;
        }
        if (userFound.ROL === 'DESHABILITADO') {
            Swal.fire({
                icon: 'error',
                title: 'Cuenta Deshabilitada',
                text: 'Su cuenta ha sido deshabilitada. Contacte al administrador.',
                confirmButtonColor: '#3F51B5'
            });
            return;
        }

        currentUser = userFound;
        localStorage.setItem('sispro_user', JSON.stringify(currentUser));

        if (isLoginPage) {
            // Validar si es GUEST y si tiene datos completos
            if (userFound.ROL === 'GUEST') {
                const datosCompletos = validarDatosCompletos(userFound);
                if (!datosCompletos) {
                    // Redirigir a gestion-planta.html para completar datos
                    window.location.href = 'gestion-planta.html?id=' + (userFound.ID_PLANTA || userFound.ID);
                    return;
                }
            }
            // Si tiene datos completos o no es GUEST, ir a index
            window.location.href = 'index.html';
        } else {
            // Reproducir sonido de bienvenida al entrar a index.html
            if (typeof window.playInicioSound === 'function') {
                window.playInicioSound();
            }
            
            Swal.fire({
                icon: 'success',
                title: '¡BIENVENIDO!',
                text: `Sesión iniciada como ${userFound.ROL}`,
                timer: 2000,
                showConfirmButton: false
            });
            applyAccessControl();
        }
    } else {
        Swal.fire({
            icon: 'error',
            title: 'ACCESO DENEGADO',
            text: 'ID o contraseña incorrectos.',
            confirmButtonColor: '#3F51B5'
        });
    }
}

/**
 * Aplica las restricciones de UI según el rol.
 */
function applyAccessControl() {
    const role = currentUser ? currentUser.ROL : 'GUEST';
    const resolutionLink = document.querySelector('a[href="resolucion.html"]');
    const resolutionBtn = resolutionLink ? resolutionLink.parentElement : null;
    const calidadOption = document.querySelector('#acciones option[value="CALIDAD"]');

    // 1. Módulo de Resolución (Botón estático si existe)
    if (resolutionBtn) {
        if (role === 'ADMIN' || role === 'MODERATOR' || role === 'USER-P') {
            resolutionBtn.classList.remove('hidden');
        } else {
            resolutionBtn.classList.add('hidden');
        }
    }

    // 2. Ocultar botones de AI para usuarios GUEST
    if (role === 'GUEST') {
        const aiButtonsNovedad = document.getElementById('aiButtonsNovedad');
        const aiButtonsCalidad = document.getElementById('aiButtonsCalidad');
        if (aiButtonsNovedad) aiButtonsNovedad.style.display = 'none';
        if (aiButtonsCalidad) aiButtonsCalidad.style.display = 'none';
    }

    // 3. Acciones de Calidad: ADMIN, MODERATOR y USER-C tienen acceso. USER-P y GUEST no.
    const accionesSelect = document.getElementById('acciones');
    if (accionesSelect) {
        let calidadOption = accionesSelect.querySelector('option[value="CALIDAD"]');
        const hasCalidadPermission = (role === 'ADMIN' || role === 'MODERATOR' || role === 'USER-C');

        if (hasCalidadPermission) {
            // Si el usuario tiene permiso pero la opción no existe (fue borrada), volver a crearla
            if (!calidadOption) {
                calidadOption = document.createElement('option');
                calidadOption.value = 'CALIDAD';
                calidadOption.textContent = 'CALIDAD';
                // Insertar después de NOVEDADES o al final
                const novedadesOpt = accionesSelect.querySelector('option[value="NOVEDADES"]');
                if (novedadesOpt) {
                    novedadesOpt.after(calidadOption);
                } else {
                    accionesSelect.appendChild(calidadOption);
                }
            }
            calidadOption.style.display = 'block';
            calidadOption.removeAttribute('disabled');
            calidadOption.removeAttribute('hidden');
        } else {
            // Si el usuario NO tiene permiso, eliminar la opción física del DOM
            if (calidadOption) {
                calidadOption.remove();
            }
            
            // Seguridad: Si por alguna razón estaba seleccionada, resetear a vacío
            if (accionesSelect.value === 'CALIDAD') {
                accionesSelect.value = '';
                if (typeof hideSections === 'function') hideSections();
            }
        }
    }

    // Actualizar indicador de login/logout en el nav
    updateAuthUI();

    // 3. Opción RUTERO: solo ADMIN, MODERATOR, USER-C
    if (accionesSelect) {
        let ruteroOption = accionesSelect.querySelector('option[value="RUTERO"]');
        const hasRuteroPermission = (role === 'ADMIN' || role === 'MODERATOR' || role === 'USER-C');
        if (!hasRuteroPermission && ruteroOption) {
            ruteroOption.remove();
            if (accionesSelect.value === 'RUTERO') {
                accionesSelect.value = '';
                if (typeof hideSections === 'function') hideSections();
            }
        }
    }

    // 4. Protección de acceso directo (URL)
    checkRouteAccess(role);
}

/**
 * Valida si el usuario puede estar en la página actual.
 * @param {string} role 
 */
function checkRouteAccess(role) {
    const path = window.location.pathname;

    // 1. Bloqueo total si no hay sesión
    if (!currentUser && !path.includes('login.html')) {
        window.location.replace('login.html');
        return;
    }

    // 2. Bloqueo por Rol Arreglado (Agresivo)
    let isAuthorized = true;

    if (path.includes('resolucion.html')) {
        if (role !== 'ADMIN' && role !== 'MODERATOR' && role !== 'USER-P') isAuthorized = false;
    } else if (path.includes('calidad.html')) {
        if (role !== 'ADMIN' && role !== 'MODERATOR') isAuthorized = false;
    } else if (path.includes('usuarios.html')) {
        if (role !== 'ADMIN') isAuthorized = false;
    } else if (path.includes('seguimiento.html')) {
        if (role !== 'GUEST') isAuthorized = false;
    }

    if (!isAuthorized) {
        // Si no está autorizado, FORZAR ocultamiento y redirigir YA (sin esperar a SweetAlert)
        document.body.classList.remove('auth-shield-pass'); 
        window.location.replace('index.html');
        return;
    }
}

/**
 * Cierra la sesión.
 */
function logout() {
    currentUser = null;
    localStorage.removeItem('sispro_user');
    applyAccessControl();
    window.location.reload(); // Recargar para limpiar estados
}

/**
 * Actualiza el indicador de usuario en la interfaz.
 */
function updateAuthUI() {
    // Si estamos en la página de login, abortamos para no destruir su diseño puro
    if (window.location.pathname.includes('login.html')) return;

    let navContainer = document.getElementById('app-top-nav');
    if (!navContainer) {
        navContainer = document.createElement('div');
        navContainer.id = 'app-top-nav';
        navContainer.className = 'app-header-bar';
        document.body.prepend(navContainer);
    }

    // Determinar icono y clase según rol
    let iconClass = 'fas fa-user-secret'; // Default guest
    let profileType = 'user-guest';

    if (currentUser) {
        profileType = `role-${currentUser.ROL.toLowerCase()}`;
        if (currentUser.ROL === 'ADMIN') iconClass = 'fas fa-user-shield';
        else if (currentUser.ROL === 'MODERATOR') iconClass = 'fas fa-user-tie';
        else if (currentUser.ROL === 'USER-C') iconClass = 'fas fa-user-check';
        else if (currentUser.ROL === 'USER-P') iconClass = 'fas fa-user';
        else if (currentUser.ROL === 'GUEST') iconClass = 'fas fa-user-secret';
    }

    // Obtener nombre del módulo actual desde el título de la página en mayúsculas
    const pageTitle = (document.title.split(' - ')[0] || 'SISPRO').toUpperCase();
    
    // Descripciones de módulos
    const moduleDescriptions = {
        'REPORTES': 'Registro de eventos',
        'SEGUIMIENTO': 'Estado de novedades',
        'RUTERO': 'Agenda de visitas',
        'USUARIOS': 'Gestión administrativa',
        'CALIDAD': 'Reportes técnicos',
        'NOVEDADES': 'Centro de soluciones',
        'GESTIÓN DE PLANTA': 'Datos de planta',
        'ACCESO': 'Inicio de sesión',
        'RESTABLECER CONTRASEÑA': 'Recuperar acceso',
        'CARGAR BARRAS': 'Carga de códigos de barras',
        'CARGAR CURVAS': 'Carga de curvas de producción',
        'EN PROCESO': 'Sincronización de lotes'
    };
    const moduleDesc = moduleDescriptions[pageTitle] || '';

    // Renderizar Header HTML
    const isGuest = currentUser && currentUser.ROL === 'GUEST';
    const showBell = !!currentUser; // campana en TODAS las páginas para cualquier usuario autenticado
    const showCSVUpload = currentUser && currentUser.ROL === 'ADMIN'; // botón CSV solo para ADMIN
    const avatarStyle = currentUser ? _avatarStyle('mini') : '';
    navContainer.innerHTML = `
        <div class="nav-brand-area">
            <img src="icons/app.svg" alt="Logo TMD" class="nav-logo">
            <span class="brand-tag">
                <span style="display:block;font-weight:800;font-size:0.9rem;">${pageTitle}</span>
                ${moduleDesc ? `<span style="display:block;font-size:0.65rem;color:#94a3b8;font-weight:500;margin-top:1px;">${moduleDesc}</span>` : ''}
            </span>
        </div>
        <div class="nav-user-area" style="display:flex;align-items:center;gap:6px;">
            <button class="btn-expand-view" id="btn-expand-view" onclick="toggleExpandView()" title="Contraer vista">
                <i class="fas fa-compress-alt"></i>
            </button>
            ${showBell ? `
            <div style="position:relative;display:inline-flex;align-items:center;">
                <button id="notif-bell-btn" onclick="toggleNotifPanel()" title="Notificaciones" style="
                    background:none; border:none; cursor:pointer;
                    padding:6px 10px; border-radius:50%;
                    color:#64748b; font-size:1.1rem;
                    transition:all 0.2s ease; position:relative;
                " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                    <i class="fas fa-bell"></i>
                    <span id="notif-badge" style="
                        display:none; position:absolute;
                        top:2px; right:2px;
                        background:#ef4444; color:white;
                        font-size:0.6rem; font-weight:800;
                        min-width:16px; height:16px;
                        border-radius:8px; padding:0 4px;
                        line-height:16px; text-align:center;
                    ">0</span>
                </button>
            </div>
            ` : ''}
            <button onclick="toggleSidebar()" class="btn-profile-toggle ${profileType}" id="profileToggle">
                <span class="avatar-mini" style="${avatarStyle}">${_avatarInner(iconClass)}</span>
                <i class="fas fa-bars"></i>
            </button>
        </div>
    `;

    // Re-inicializar el panel de notificaciones si corresponde
    if (showBell && typeof _ensureNotifPanel === 'function') {
        _ensureNotifPanel();
    }

    // Crear o actualizar el Sidebar (Drawer)
    createSidebar();
}

/**
 * Crea la estructura del sidebar si no existe.
 */
function createSidebar() {
    let sidebar = document.getElementById('user-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'user-sidebar';
        sidebar.className = 'app-sidebar-drawer';
        document.body.appendChild(sidebar);

        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-backdrop';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    if (currentUser) {
        let roleIcon = 'fas fa-user';
        let roleClass = currentUser.ROL.toLowerCase();
        const path = window.location.pathname;
        const isResolutionPage = path.includes('resolucion.html');
        const isUsersPage = path.includes('usuarios.html');

        if (currentUser.ROL === 'ADMIN') roleIcon = 'fas fa-user-shield';
        else if (currentUser.ROL === 'MODERATOR') roleIcon = 'fas fa-user-tie';
        else if (currentUser.ROL === 'USER-C') roleIcon = 'fas fa-user-check';
        else if (currentUser.ROL === 'USER-P') roleIcon = 'fas fa-user';
        else if (currentUser.ROL === 'GUEST') roleIcon = 'fas fa-user-secret';

        const prefs = getAvatarPrefs();
        const avatarLargeStyle = _avatarStyle('large');
        const avatarLargeInner = _avatarInner(roleIcon);

        // Icon picker HTML
        const iconsHtml = AVATAR_ICONS.map(ic =>
            `<button class="avatar-icon-btn${(prefs.icon === ic.cls && !prefs.image) ? ' active' : ''}"
                onclick="setAvatarIcon('${ic.cls}')" title="${ic.label}" type="button">
                <i class="${ic.cls}"></i>
            </button>`
        ).join('');

        // Current color for picker
        const currentColor = prefs.color || '#3f51b5';

        // Notification toggle state
        let notifPermission = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
        const hasActiveSub = localStorage.getItem('sispro_push_subscribed') === '1';
        
        // Fallback para localhost: si hay suscripción activa pero permission=default, asumir granted
        if (hasActiveSub && notifPermission === 'default') {
            notifPermission = 'granted';
        }
        
        const notifEnabled = notifPermission === 'granted';
        const notifDenied  = notifPermission === 'denied';
        // Internal soft-disable (user turned off but browser still granted)
        const notifSoftOff = localStorage.getItem('sispro_notif_soft_off') === '1';
        const notifChecked = notifEnabled && !notifSoftOff;

        // Location toggle — relevant for calidad roles
        const hasCalidad = ['ADMIN','MODERATOR','USER-C'].includes(currentUser.ROL);
        const gpsKey = `gps_calidad_${currentUser.ID || currentUser.ID_USUARIO || 'u'}`;
        const gpsEnabled = localStorage.getItem(gpsKey) !== 'disabled';

        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-user-card">
                    <div class="avatar-edit-btn" onclick="toggleAvatarCustomizer()" title="Personalizar avatar">
                        <div class="user-avatar-large ${roleClass}" id="sidebar-avatar-large" style="${avatarLargeStyle}">${avatarLargeInner}</div>
                        <div class="avatar-overlay"><i class="fas fa-pen"></i></div>
                    </div>
                    <div class="user-meta">
                        <span class="u-name">${currentUser.USUARIO || currentUser.PLANTA || 'Usuario'}</span>
                        <span class="u-role">${currentUser.ROL}</span>
                        ${prefs.image ? `<button onclick="clearAvatarImage()" type="button" style="margin-top:4px;font-size:0.68rem;color:#94a3b8;background:none;border:none;cursor:pointer;padding:0;text-align:left;"><i class="fas fa-times me-1"></i>Quitar foto</button>` : ''}
                    </div>
                </div>

                <!-- Avatar customizer — oculto por defecto -->
                <div class="avatar-customizer" id="avatar-customizer-panel" style="display:none;">
                    <div class="avatar-customizer-actions">
                        <label class="avatar-upload-btn" title="Subir foto">
                            <i class="fas fa-camera"></i> Subir foto
                            <input type="file" accept="image/*" style="display:none;" onchange="handleAvatarUpload(event)">
                        </label>
                    </div>
                    <div class="avatar-customizer-row">
                        <span class="avatar-customizer-label">Color</span>
                        <div class="avatar-color-picker-wrap">
                            <input type="color" id="avatar-color-input" value="${currentColor}"
                                oninput="setAvatarColor(this.value)"
                                title="Elige un color">
                            <span class="avatar-color-preview" style="background:${currentColor};" onclick="document.getElementById('avatar-color-input').click()"></span>
                            <span class="avatar-color-hex" id="avatar-color-hex">${currentColor}</span>
                        </div>
                    </div>
                    <div class="avatar-customizer-row" style="align-items:flex-start;">
                        <span class="avatar-customizer-label" style="padding-top:6px;">Icono</span>
                        <div class="avatar-icon-grid">${iconsHtml}</div>
                    </div>
                </div>
            </div>
            <div class="sidebar-body" style="overflow-y:auto;">
                <div class="sidebar-label">MENÚ DE ACCESO</div>
                ${currentUser.ROL === 'GUEST' ? (() => {
                    const incompleto = _guestPerfilIncompleto();
                    const isIndex = path.includes('index.html') || path.endsWith('/');
                    return incompleto
                        ? `<span class="sidebar-link sidebar-link--disabled" onclick="toggleSidebar()" title="Completa tu perfil primero">
                               <i class="fas fa-home"></i> Reportes
                               <i class="fas fa-lock" style="margin-left:auto;font-size:0.75rem;color:#94a3b8;"></i>
                           </span>`
                        : `<a href="index.html" class="sidebar-link ${isIndex ? 'active' : ''}">
                               <i class="fas fa-home"></i> Reportes
                           </a>`;
                })() : `<a href="index.html" class="sidebar-link ${(path.includes('index.html') || path.endsWith('/')) ? 'active' : ''}">
                    <i class="fas fa-home"></i> Reportes
                </a>`}
                ${(currentUser.ROL === 'ADMIN' || currentUser.ROL === 'MODERATOR' || currentUser.ROL === 'USER-P') ? `
                    <a href="resolucion.html" class="sidebar-link ${isResolutionPage ? 'active' : ''}">
                        <i class="fas fa-desktop"></i> Novedades
                    </a>
                ` : ''}
                ${currentUser.ROL === 'GUEST' ? (() => {
                    const incompleto = _guestPerfilIncompleto();
                    return incompleto
                        ? `<span class="sidebar-link sidebar-link--disabled" onclick="toggleSidebar()" title="Completa tu perfil primero">
                               <i class="fas fa-shipping-fast"></i> Seguimiento
                               <i class="fas fa-lock" style="margin-left:auto;font-size:0.75rem;color:#94a3b8;"></i>
                           </span>`
                        : `<a href="seguimiento.html" class="sidebar-link ${path.includes('seguimiento.html') ? 'active' : ''}">
                               <i class="fas fa-shipping-fast"></i> Seguimiento
                           </a>`;
                })() : ''}
                ${currentUser.ROL === 'GUEST' ? (() => {
                    const incompleto = _guestPerfilIncompleto();
                    const plantaId = currentUser.ID_PLANTA || currentUser.ID_USUARIO || currentUser.ID || '';
                    const plantaHref = `gestion-planta.html?id=${plantaId}`;
                    const isPlantaPage = path.includes('gestion-planta.html');
                    return `<a href="${plantaHref}" class="sidebar-link ${isPlantaPage ? 'active' : ''}">
                               <i class="fas fa-industry"></i> Actualizar
                               ${incompleto ? '<i class="fas fa-lock-open" style="margin-left:auto;font-size:0.75rem;color:#94a3b8;"></i>' : ''}
                           </a>`;
                })() : ''}
                ${(currentUser.ROL === 'ADMIN' || currentUser.ROL === 'MODERATOR') ? `
                    <a href="calidad.html" class="sidebar-link ${path.includes('calidad.html') ? 'active' : ''}">
                        <i class="fas fa-microscope"></i> Calidad
                    </a>
                ` : ''}
                ${(currentUser.ROL === 'ADMIN' || currentUser.ROL === 'USER-C' || currentUser.ROL === 'MODERATOR') ? `
                    <a href="rutero.html" class="sidebar-link ${path.includes('rutero.html') ? 'active' : ''}">
                        <i class="fas fa-route"></i> Rutero
                    </a>
                ` : ''}
                ${currentUser.ROL === 'ADMIN' ? `
                    <a href="usuarios.html" class="sidebar-link ${isUsersPage ? 'active' : ''}">
                        <i class="fas fa-users-cog"></i> Usuarios
                    </a>
                ` : ''}

                <div class="sidebar-settings-section">
                    <div class="sidebar-settings-header" onclick="toggleSettingsPanel()">
                        <span class="sidebar-label" style="margin-bottom:0;">CONFIGURACIÓN</span>
                    </div>

                    <div class="sidebar-settings-content" id="settings-content">
                        <div class="settings-toggle-row">
                            <div class="settings-toggle-info">
                                <span class="settings-toggle-title"><i class="fas fa-bell"></i> Notificaciones</span>
                                <span class="settings-toggle-sub">${notifDenied ? 'Bloqueadas en el navegador' : notifChecked ? 'Push activadas' : 'Toca para activar'}</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="toggle-notif" ${notifChecked ? 'checked' : ''} ${notifDenied ? 'disabled' : ''} onchange="togglePushNotifications(this.checked)">
                                <span class="toggle-track ${notifChecked ? 'is-on' : ''} ${notifDenied ? 'is-disabled' : ''}"></span>
                            </label>
                        </div>

                        <div class="settings-toggle-row">
                            <div class="settings-toggle-info">
                                <span class="settings-toggle-title"><i class="fas fa-volume-high"></i> Sonidos</span>
                                <span class="settings-toggle-sub">Audio para notificaciones</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="toggle-sounds" ${(typeof getSoundPrefs === 'function' && getSoundPrefs().enabled) ? 'checked' : ''} onchange="toggleSounds(this.checked)">
                                <span class="toggle-track ${(typeof getSoundPrefs === 'function' && getSoundPrefs().enabled) ? 'is-on' : ''}"></span>
                            </label>
                        </div>

                        ${hasCalidad ? `
                        <div class="settings-toggle-row">
                            <div class="settings-toggle-info">
                                <span class="settings-toggle-title"><i class="fas fa-location-dot"></i> Ubicación</span>
                                <span class="settings-toggle-sub">Requerida para reportes</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="toggle-gps" ${gpsEnabled ? 'checked' : ''} onchange="toggleGpsFromSidebar(this.checked)">
                                <span class="toggle-track ${gpsEnabled ? 'is-on' : ''}"></span>
                            </label>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="sidebar-footer">
                <button onclick="logout()" class="btn-logout-full mb-3">
                    <i class="fas fa-power-off me-2"></i> Cerrar Sesión
                </button>
                <div class="sidebar-credits">
                    <p>Developed by Andrés Mendoza © 2026</p>
                    <div class="social-links-sidebar">
                        <a href="https://wa.me/573176418529" target="_blank"><i class="fab fa-whatsapp"></i></a>
                        <a href="https://www.instagram.com/eltemplodelamoda/?hl=es" target="_blank"><i class="fab fa-instagram"></i></a>
                        <a href="https://www.facebook.com/templodelamoda/?locale=es_LA" target="_blank"><i class="fab fa-facebook"></i></a>
                    </div>
                </div>
            </div>
        `;
    } else {
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-user-card">
                    <div class="user-avatar-large guest"><i class="fas fa-user-secret"></i></div>
                    <div class="user-meta">
                        <span class="u-name">Invitado</span>
                        <span class="u-role">Acceso Limitado</span>
                    </div>
                </div>
            </div>
            <div class="sidebar-body">
                <button onclick="showLoginPrompt(); toggleSidebar();" class="btn-login-sidebar">
                    <i class="fas fa-shield-halved me-2"></i> INICIAR SESIÓN
                </button>
            </div>
            <div class="sidebar-footer">
                <div class="sidebar-credits">
                    <p>Developed by Andrés Mendoza © 2026</p>
                    <div class="social-links-sidebar">
                        <a href="https://wa.me/573176418529" target="_blank"><i class="fab fa-whatsapp"></i></a>
                        <a href="https://www.instagram.com/eltemplodelamoda/?hl=es" target="_blank"><i class="fab fa-instagram"></i></a>
                        <a href="https://www.facebook.com/templodelamoda/?locale=es_LA" target="_blank"><i class="fab fa-facebook"></i></a>
                    </div>
                    <span class="text-muted d-block mt-2" style="font-size: 10px;">Versión 2.0 - Grupo TMD</span>
                </div>
            </div>
        `;
    }
}

/** Abre/cierra el panel de personalización del avatar */
function toggleAvatarCustomizer() {
    const panel = document.getElementById('avatar-customizer-panel');
    const avatarBtn = document.querySelector('.avatar-edit-btn');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (avatarBtn) avatarBtn.classList.toggle('customizer-open', !isOpen);
}

/** Cambia el color de fondo del avatar y lo persiste */
function setAvatarColor(color) {
    const prefs = getAvatarPrefs();
    prefs.color = color;
    delete prefs.image;
    saveAvatarPrefs(prefs);
    // Actualizar preview en vivo sin reconstruir todo el sidebar
    const hex = document.getElementById('avatar-color-hex');
    const preview = document.querySelector('.avatar-color-preview');
    const avatarEl = document.getElementById('sidebar-avatar-large');
    if (hex) hex.textContent = color;
    if (preview) preview.style.background = color;
    if (avatarEl) {
        avatarEl.style.background = color;
        const icon = avatarEl.querySelector('i');
        if (icon) icon.style.color = _isColorDark(color) ? 'white' : '#1e293b';
    }
    const miniAvatar = document.querySelector('.avatar-mini');
    if (miniAvatar && !prefs.image) miniAvatar.style.background = color;
}

/** Cambia el icono del avatar */
function setAvatarIcon(iconCls) {
    const prefs = getAvatarPrefs();
    prefs.icon = iconCls;
    delete prefs.image;
    saveAvatarPrefs(prefs);
    // Actualizar botones activos
    document.querySelectorAll('.avatar-icon-btn').forEach(btn => {
        btn.classList.toggle('active', btn.querySelector('i')?.className === iconCls);
    });
    // Actualizar avatar en vivo
    const avatarEl = document.getElementById('sidebar-avatar-large');
    if (avatarEl) {
        const color = prefs.color || null;
        const iconColor = color ? (_isColorDark(color) ? 'white' : '#1e293b') : 'white';
        avatarEl.innerHTML = `<i class="${iconCls}" style="color:${iconColor};"></i>`;
    }
    const miniAvatar = document.querySelector('.avatar-mini');
    if (miniAvatar) {
        const color = prefs.color || null;
        const iconColor = color ? (_isColorDark(color) ? 'white' : '#1e293b') : 'white';
        miniAvatar.innerHTML = `<i class="${iconCls}" style="color:${iconColor};"></i>`;
    }
}

/** Sube una imagen como avatar — solo localStorage (base64) */
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const prefs = getAvatarPrefs();
        prefs.image = e.target.result;
        saveAvatarPrefs(prefs);
        updateAuthUI();
    };
    reader.readAsDataURL(file);
}

/** Quita la imagen del avatar */
function clearAvatarImage() {
    const prefs = getAvatarPrefs();
    delete prefs.image;
    saveAvatarPrefs(prefs);
    updateAuthUI();
}

/** Sincroniza visualmente el toggle de notificaciones con el estado real.
 *  @param {string|null} knownPerm - permiso conocido (evita depender de Notification.permission buggy en localhost)
 */
function _syncNotifToggleUI(knownPerm = null) {
    const softOff = localStorage.getItem('sispro_notif_soft_off') === '1';

    let permission = knownPerm;
    if (!permission) {
        permission = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
        // Fallback: suscripción activa guardada → asumir granted (bug de localhost)
        if (permission === 'default' && localStorage.getItem('sispro_push_subscribed') === '1') {
            permission = 'granted';
        }
    }

    const isGranted = permission === 'granted';
    const isDenied  = permission === 'denied';
    const isActive  = isGranted && !softOff;

    const input = document.getElementById('toggle-notif');
    const track = input ? input.nextElementSibling : null;
    const subEl = input?.closest('.settings-toggle-row')?.querySelector('.settings-toggle-sub');

    if (input) {
        input.checked  = isActive;
        input.disabled = isDenied;
    }
    if (track) {
        track.classList.toggle('is-on',       isActive);
        track.classList.toggle('is-disabled', isDenied);
    }
    if (subEl) {
        subEl.textContent = isDenied ? 'Bloqueadas en el navegador'
            : isActive ? 'Push activadas'
            : 'Toca para activar';
    }
}

/** Toggle de notificaciones push desde el sidebar */
async function togglePushNotifications(enable) {
    const permission = (typeof Notification !== 'undefined') ? Notification.permission : 'default';

    if (enable) {
        if (permission === 'denied') {
            Swal.fire({
                icon: 'info',
                title: 'Notificaciones bloqueadas',
                text: 'El navegador bloqueó los permisos. Ve a Configuración del sitio y permite las notificaciones manualmente.',
                confirmButtonColor: '#3f51b5'
            });
            return;
        }

        localStorage.removeItem('sispro_notif_soft_off');

        // Sistema de notificaciones push eliminado
        let finalPerm = permission;

        // Sincronizar con el permiso real que obtuvimos (no Notification.permission que puede ser buggy)
        _syncNotifToggleUI(finalPerm === 'granted' ? 'granted' : null);
        // Re-sync tardío por si el navegador actualiza Notification.permission con delay
        setTimeout(() => _syncNotifToggleUI(), 800);

    } else {
        localStorage.setItem('sispro_notif_soft_off', '1');
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            if (reg) {
                const sub = await reg.pushManager.getSubscription().catch(() => null);
                if (sub) await sub.unsubscribe().catch(() => {});
            }
        }
        localStorage.removeItem('sispro_push_subscribed');
        _syncNotifToggleUI();
    }
}

/** Toggle de GPS desde el sidebar (no afecta la validación del formulario de calidad) */
function toggleGpsFromSidebar(enable) {
    const gpsKey = `gps_calidad_${currentUser?.ID || currentUser?.ID_USUARIO || 'u'}`;
    localStorage.setItem(gpsKey, enable ? 'enabled' : 'disabled');
    if (typeof applyGpsToggleUI === 'function') {
        applyGpsToggleUI(enable);
        if (!enable && typeof showGpsBlockedOverlay === 'function') showGpsBlockedOverlay();
        if (enable && typeof requestCalidadLocation === 'function') requestCalidadLocation();
    }
}

/** Construye el objeto notifPrefs actual (solo para referencia interna) */
function _buildNotifPrefs() {
    const softOff = localStorage.getItem('sispro_notif_soft_off') === '1';
    const pushOn  = (typeof Notification !== 'undefined') && Notification.permission === 'granted' && !softOff;
    const gpsKey  = `gps_calidad_${currentUser?.ID || currentUser?.ID_USUARIO || 'u'}`;
    const gpsOn   = localStorage.getItem(gpsKey) !== 'disabled';
    return { push: pushOn, gps: gpsOn };
}

/**
 * Abre/Cierra el sidebar — regenera el contenido al abrir para reflejar estado actual.
 */
function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    // Si no existe el sidebar, forzar creación inmediata
    if (!sidebar) {
        createSidebar();
        // Intentar de nuevo tras un pequeño delay para que el DOM se actualice
        return setTimeout(toggleSidebar, 10);
    }

    const isOpen = sidebar.classList.contains('open');
    if (!isOpen) {
        // Regenerar contenido antes de abrir para que refleje estado real
        createSidebar();
    }
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

/**
 * Toggle del panel de configuraciones colapsable
 */
function toggleSettingsPanel() {
    const content = document.getElementById('settings-content');
    if (!content) return;
    content.classList.toggle('open');
}

// ══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN INMEDIATA DEL ECOSISTEMA
// ══════════════════════════════════════════════════════════════════════════
(function() {
    const startAuth = async () => {
        // 1. Validar estado de sesión y cargar datos mínimos (sin bloquear login)
        await loadUsers();

        // 2. Si es LOGIN, activar el formulario de inmediato
        if (typeof IS_LOGIN_PAGE !== 'undefined' && IS_LOGIN_PAGE) {
            if (typeof initLoginPage === 'function') initLoginPage();
            return; // Detener aquí (no inyectar Header/Sidebar)
        }

        // 3. Si NO es login, inyectar el ecosistema de la app (Header/Sidebar)
        if (typeof updateAuthUI === 'function') updateAuthUI();
        if (typeof createSidebar === 'function') createSidebar();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAuth);
    } else {
        startAuth();
    }
})();

/* ── Expand View — cicla entre 3 tamaños: default(1400) → medio(900) → full(100%) ── */
function toggleExpandView() {
    const body = document.body;
    const btn = document.getElementById('btn-expand-view');
    const icon = btn?.querySelector('i');

    const isMedium   = body.classList.contains('view-medium');
    const isExpanded = body.classList.contains('view-expanded');

    // Ciclar: default → medio → full → default
    if (!isMedium && !isExpanded) {
        // default (1400) → medio (900)
        body.classList.add('view-medium');
        if (icon) icon.className = 'fas fa-expand-alt';
        if (btn)  { btn.title = 'Expandir vista'; btn.style.color = 'var(--color-primary)'; }
        localStorage.setItem('sispro_view_state', 'medium');
        localStorage.setItem('sispro_view_page', window.location.pathname.split('/').pop() || 'index.html');
    } else if (isMedium) {
        // medio (900) → full (100%)
        body.classList.remove('view-medium');
        body.classList.add('view-expanded');
        if (icon) icon.className = 'fas fa-expand';
        if (btn)  { btn.title = 'Vista completa'; btn.style.color = 'var(--color-primary)'; }
        localStorage.setItem('sispro_view_state', 'expanded');
        localStorage.setItem('sispro_view_page', window.location.pathname.split('/').pop() || 'index.html');
    } else {
        // full (100%) → default (1400)
        body.classList.remove('view-expanded');
        if (icon) icon.className = 'fas fa-compress-alt';
        if (btn)  { btn.title = 'Contraer vista'; btn.style.color = ''; }
        localStorage.setItem('sispro_view_state', 'default');
        localStorage.setItem('sispro_view_page', window.location.pathname.split('/').pop() || 'index.html');
    }
}

// Restaurar preferencia al cargar — siempre inicia en default (no persiste entre páginas)
(function _restoreExpandState() {
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('btn-expand-view');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fas fa-compress-alt';
        btn.title = 'Contraer vista';
    });
})();
