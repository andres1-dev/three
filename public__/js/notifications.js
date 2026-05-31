/* ==========================================================================
   notifications.js — Sistema de notificaciones internas para usuarios GUEST
   Detecta cambios de estado en novedades y muestra seguimiento tipo courier.
   ========================================================================== */

const NOTIF_STORAGE_KEY       = 'sispro_notif_seen';
const NOTIF_LIST_KEY          = 'sispro_notif_list';
let _lastKnownStates = {};
let _initialLoadDone = false;
let _notifications = [];
let _storedNovedades = [];
let _notifChannel = null;
let _notifChatChannel = null; // Renombrado para evitar conflicto con chat.js
let _guestChatInitialized = false;
let _soundsReady = false; // Flag para verificar si los sonidos están listos

/* ── Inicialización ── */

/**
 * Arranca el sistema de notificaciones si el usuario es GUEST.
 * Llamado desde app.js después de loadUsers().
 */
function initNotifications(preloadedNovedades) {
    if (!currentUser || currentUser.ROL !== 'GUEST') return;

    // Cargar estados conocidos desde localStorage
    try {
        const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
        if (saved) {
            _lastKnownStates = JSON.parse(saved);
            _initialLoadDone = true;
        } else {
            _lastKnownStates = {};
            _initialLoadDone = false;
        }
    } catch (_) {
        _lastKnownStates = {};
        _initialLoadDone = false;
    }

    // Restaurar notificaciones persistidas (sobreviven recargas)
    try {
        const saved = localStorage.getItem(NOTIF_LIST_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Restaurar fechas (JSON serializa Date como string)
            _notifications = parsed.map(n => ({ ...n, ts: new Date(n.ts) }));
        }
    } catch (_) { _notifications = []; }

    _ensureNotifPanel();

    // Carga inicial de datos
    if (preloadedNovedades && preloadedNovedades.length) {
        _storedNovedades = preloadedNovedades;
        _processUpdates(preloadedNovedades);
        if (typeof initGuestChat === 'function') {
            _guestChatInitialized = true;
            initGuestChat(preloadedNovedades);
        }
    } else if (!window._notifsRealtimeActive) {
        _fetchNovedades();
    }

    if (window._notifsRealtimeActive) return;
    window._notifsRealtimeActive = true;

    // Iniciar Realtime (sin polling)
    _startRealtimeSubscriptions();
}

/**
 * Configura las suscripciones de Supabase Realtime.
 * Sistema 100% en tiempo real, sin polling.
 */
function _startRealtimeSubscriptions() {
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    
    if (!sb) {
        return;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Canal 1: NOVEDADES (cambios de estado via Broadcast)
    // ═══════════════════════════════════════════════════════════════
    _notifChannel = sb
        .channel('novedades-broadcast')
        .on('broadcast', { event: 'estado_changed' }, (payload) => {
            const data = payload.payload;
            if (!data || !data.ID_NOVEDAD) return;
            
            // Verificar si es para mi planta (GUEST) o soy ADMIN/USER-P
            const miPlanta = currentUser?.PLANTA || '';
            const miRol = currentUser?.ROL || 'GUEST';
            
            if (miRol === 'GUEST' && data.PLANTA !== miPlanta) {
                return;
            }
            
            // Actualizar en el array en memoria
            const idx = _storedNovedades.findIndex(n => n.ID_NOVEDAD === data.ID_NOVEDAD);
            if (idx >= 0) {
                _storedNovedades[idx].ESTADO = data.ESTADO;
                
                // Actualizar UI inmediatamente
                if (typeof renderTracking === 'function') {
                    renderTracking(_storedNovedades);
                }
                
                // Procesar notificación
                _processUpdates(_storedNovedades);
            } else {
                // Si no está en memoria, hacer fetch completo
                if (typeof invalidateCache === 'function') {
                    invalidateCache('NOVEDADES');
                }
                _fetchNovedades();
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
            } else if (status === 'CHANNEL_ERROR') {
            } else if (status === 'TIMED_OUT') {
            } else if (status === 'CLOSED') {
                setTimeout(_startRealtimeSubscriptions, 2000);
            }
        });
    
    // ═══════════════════════════════════════════════════════════════
    // Canal 2: CHAT (mensajes nuevos)
    // ═══════════════════════════════════════════════════════════════
    _notifChatChannel = sb
        .channel('chat-realtime-notif')
        .on(
            'postgres_changes',
            { 
                event: 'INSERT',
                schema: 'public',
                table: 'CHAT'
            },
            (payload) => {
                // Invalidar caché de chat
                if (typeof invalidateCache === 'function') {
                    invalidateCache('CHAT');
                }
                
                // Reproducir sonido de chat
                if (typeof playChatSound === 'function') {
                    playChatSound();
                }
                
                // Actualizar UI de chat si está abierto
                if (typeof _onNewChatMessage === 'function') {
                    _onNewChatMessage(payload.new);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
            } else if (status === 'CHANNEL_ERROR') {
            } else if (status === 'CLOSED') {
                setTimeout(_startRealtimeSubscriptions, 2000);
            }
        });
}

/**
 * Obtiene las novedades desde Supabase.
 * Reemplaza el antiguo polling.
 */
async function _fetchNovedades() {
    try {
        const novedades = await fetchNovedadesData();
        _storedNovedades = novedades;
        _processUpdates(novedades);
        
        // Pasar novedades al módulo de chat GUEST
        if (currentUser?.ROL === 'GUEST' && typeof initGuestChat === 'function') {
            if (!_guestChatInitialized) {
                _guestChatInitialized = true;
                initGuestChat(novedades);
            } else if (typeof _guestNovedades !== 'undefined') {
                _guestNovedades = novedades;
            }
        }
        
        // Actualizar vista de seguimiento si está activa
        if (typeof renderTracking === 'function') {
            renderTracking(novedades);
        }
    } catch (e) {
    }
}

/**
 * Crea o recrea el panel dropdown de notificaciones.
 * Se llama también desde updateAuthUI() cada vez que se reconstruye el header.
 */
function _ensureNotifPanel() {
    // Eliminar panel anterior si existe
    const old = document.getElementById('notif-panel');
    if (old) old.remove();

    const isGuest = currentUser && currentUser.ROL === 'GUEST';
    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.style.cssText = `
        display: none;
        position: fixed;
        top: 68px;
        right: 16px;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
        border: 1px solid #e2e8f0;
        z-index: 3000;
        overflow: hidden;
    `;

    if (isGuest) {
        panel.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #3b82f6, #6366f1);
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display:flex; align-items:center; gap:10px; color:white;">
                    <i class="fas fa-bell" style="font-size:1rem;"></i>
                    <span style="font-weight:800; font-size:0.9rem; letter-spacing:0.5px;">NOTIFICACIONES</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="clearAllNotifications()" style="
                        background:rgba(255,255,255,0.2); border:none; color:white;
                        font-size:0.7rem; font-weight:700;
                        padding:4px 10px; border-radius:20px; cursor:pointer;
                        display:flex; align-items:center; gap:5px;
                    "><i class="fas fa-trash-can"></i> Limpiar</button>
                    <button onclick="toggleNotifPanel()" style="
                        background:none; border:none; color:rgba(255,255,255,0.8);
                        cursor:pointer; font-size:1rem; padding:2px 6px;
                    "><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div style="max-height:420px; overflow-y:auto;">
                <div id="notif-list" style="padding:8px 0;"></div>
            </div>
        `;
    } else {
        // Panel para USER-P/ADMIN: muestra mensajes de chat no leídos
        panel.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #3b82f6, #6366f1);
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display:flex; align-items:center; gap:10px; color:white;">
                    <i class="fas fa-comments" style="font-size:1rem;"></i>
                    <span style="font-weight:800; font-size:0.9rem; letter-spacing:0.5px;">MENSAJES</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button onclick="clearAllNotifications()" style="
                        background:rgba(255,255,255,0.2); border:none; color:white;
                        font-size:0.7rem; font-weight:700;
                        padding:4px 10px; border-radius:20px; cursor:pointer;
                        display:flex; align-items:center; gap:5px;
                    "><i class="fas fa-trash-can"></i> Limpiar</button>
                    <button onclick="toggleNotifPanel()" style="
                        background:none; border:none; color:rgba(255,255,255,0.8);
                        cursor:pointer; font-size:1rem; padding:2px 6px;
                    "><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div style="max-height:420px; overflow-y:auto;">
                <div id="notif-list" style="padding:8px 0;"></div>
            </div>
        `;
    }

    document.body.appendChild(panel);

    // Re-renderizar con datos en memoria si ya hay algo
    if (isGuest) _renderNotifList();

    // Cerrar al hacer click fuera
    document.addEventListener('click', _handleOutsideClick);
}

function _handleOutsideClick(e) {
    const panel = document.getElementById('notif-panel');
    const bell = document.getElementById('notif-bell-btn');
    if (
        panel && panel.style.display !== 'none' &&
        !panel.contains(e.target) &&
        bell && !bell.contains(e.target)
    ) {
        panel.style.display = 'none';
    }
}

/* ── Obtención de datos ── */

async function _fetchNovedades() {
    try {
        // No necesitamos fetchSecureConfig()
        const novedades = await fetchNovedadesData();
        _storedNovedades = novedades;
        _processUpdates(novedades);
        // Pasar novedades al módulo de chat GUEST
        if (currentUser?.ROL === 'GUEST' && typeof initGuestChat === 'function') {
            if (!_guestChatInitialized) {
                _guestChatInitialized = true;
                initGuestChat(novedades);
            } else if (typeof _guestNovedades !== 'undefined') {
                _guestNovedades = novedades;
            }
        }
        // Actualizar vista de seguimiento si está activa
        if (typeof renderTracking === 'function') {
            renderTracking(novedades);
        }
    } catch (e) {
        console.error('[NOTIF] Error al consultar novedades:', e);
    }
}

function _processUpdates(novedades) {
    const newNotifs = [];
    const isFirstLoad = !_initialLoadDone;

    novedades.forEach(nov => {
        const id = nov.ID_NOVEDAD;
        if (!id) return;
        const estadoActual = nov.ESTADO || 'PENDIENTE';
        const estadoAnterior = _lastKnownStates[id];

        if (estadoAnterior === undefined) {
            // ID nunca visto antes
            if (!isFirstLoad) {
                // Novedad nueva que apareció después del baseline → notificar si no es PENDIENTE
                if (estadoActual === 'ELABORACION' || estadoActual === 'FINALIZADO') {
                    newNotifs.push({ nov, estadoAnterior: 'PENDIENTE', estadoActual });
                }
            }
            _lastKnownStates[id] = estadoActual;
            return;
        }

        // ID conocido — detectar cambio
        if (estadoAnterior !== estadoActual) {
            if (
                (estadoAnterior === 'PENDIENTE'   && estadoActual === 'ELABORACION') ||
                (estadoAnterior === 'ELABORACION' && estadoActual === 'FINALIZADO')  ||
                (estadoAnterior === 'PENDIENTE'   && estadoActual === 'FINALIZADO')
            ) {
                newNotifs.push({ nov, estadoAnterior, estadoActual });
            }
            _lastKnownStates[id] = estadoActual;
        }
    });

    // Marcar que ya pasó la primera carga
    _initialLoadDone = true;

    try {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(_lastKnownStates));
    } catch (_) {}

    if (newNotifs.length > 0) {
        _addNotifications(newNotifs);
    }

    _updateBellBadge();
}

/* ── Almacén ── */

function _addNotifications(items) {
    let hasNewNotifs = false;
    
    items.forEach(item => {
        const id = `${item.nov.ID_NOVEDAD}_${item.estadoActual}`;
        // Evitar duplicados exactos (misma novedad + mismo estado)
        if (_notifications.some(n => n.id === id)) {
            return;
        }
        
        _notifications.unshift({
            id,
            nov: item.nov,
            estadoAnterior: item.estadoAnterior,
            estadoActual: item.estadoActual,
            ts: new Date(),
            read: false
        });
        hasNewNotifs = true;
        
        // Mostrar toast visual
        _showToastNotification(item);
    });

    if (_notifications.length > 30) _notifications = _notifications.slice(0, 30);

    _persistNotifications();
    _updateBellBadge();

    // Animar campana
    const bellBtn = document.getElementById('notif-bell-btn');
    if (bellBtn) {
        bellBtn.classList.add('has-unread');
        bellBtn.addEventListener('animationend', () => bellBtn.classList.remove('has-unread'), { once: true });
    }
    
    // Reproducir sonido de cambio de estado si hay notificaciones nuevas
    if (hasNewNotifs) {
        _playNotificationSound();
    }
}

/** Persiste las notificaciones en localStorage para sobrevivir recargas. */
function _persistNotifications() {
    try {
        localStorage.setItem(NOTIF_LIST_KEY, JSON.stringify(_notifications));
    } catch (_) {}
}

/**
 * Reproduce el sonido de cambio de estado con reintentos
 */
function _playNotificationSound() {
    if (typeof playStateSound === 'function') {
        playStateSound();
    }
}

/* ── Badge ── */

function _updateBellBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const unread = _notifications.filter(n => !n.read).length;
    badge.style.display = unread > 0 ? 'block' : 'none';
    badge.textContent = unread > 9 ? '9+' : String(unread);
    _renderNotifList();
}

function _showToastNotification(item) {
    const { nov, estadoActual } = item;
    const colors = {
        ELABORACION: { bg: '#fffbeb', border: '#f59e0b', icon: 'fa-sync-alt',    iconColor: '#f59e0b', label: 'En Elaboración' },
        FINALIZADO:  { bg: '#f0fdf4', border: '#22c55e', icon: 'fa-check-circle', iconColor: '#22c55e', label: 'Solucionado'    }
    };
    const cfg = colors[estadoActual] || colors.ELABORACION;

    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed; bottom:24px; left:50%;
        transform:translateX(-50%) translateY(80px);
        background:${cfg.bg}; border:1.5px solid ${cfg.border};
        border-radius:14px; padding:14px 20px;
        display:flex; align-items:center; gap:14px;
        box-shadow:0 8px 30px rgba(0,0,0,0.12);
        z-index:9999; min-width:300px; max-width:90vw;
        transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
        opacity:0;
    `;
    toast.innerHTML = `
        <div style="width:38px;height:38px;border-radius:50%;background:white;
            border:1.5px solid ${cfg.border};display:flex;align-items:center;
            justify-content:center;flex-shrink:0;">
            <i class="fas ${cfg.icon}" style="color:${cfg.iconColor};font-size:1rem;"></i>
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:0.8rem;color:#1e293b;margin-bottom:2px;">
                Lote ${nov.LOTE || 'S/N'} — ${cfg.label}
            </div>
            <div style="font-size:0.72rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${nov.DESCRIPCION ? nov.DESCRIPCION.substring(0, 55) + (nov.DESCRIPCION.length > 55 ? '...' : '') : 'Sin descripción'}
            </div>
        </div>
        <button onclick="this.parentElement.remove()" style="
            background:none;border:none;color:#94a3b8;
            cursor:pointer;font-size:1rem;padding:0 4px;flex-shrink:0;
        "><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    }));

    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(80px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, 5000);
}

/* ── Lista de alertas ── */

function _renderNotifList() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    if (_notifications.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:32px 16px;color:#94a3b8;">
                <i class="fas fa-bell-slash" style="font-size:2rem;margin-bottom:10px;display:block;"></i>
                <span style="font-size:0.8rem;font-weight:600;">Sin notificaciones</span>
                <p style="font-size:0.72rem;margin-top:6px;color:#cbd5e1;">
                    Te avisaremos cuando cambien los estados de tus novedades.
                </p>
            </div>
        `;
        return;
    }

    const stateConfig = {
        ELABORACION: { icon: 'fa-sync-alt',    color: '#f59e0b', bg: '#fffbeb', label: 'En Elaboración' },
        FINALIZADO:  { icon: 'fa-check-circle', color: '#22c55e', bg: '#f0fdf4', label: 'Solucionado'    }
    };

    list.innerHTML = _notifications.map(n => {
        const timeAgo = _timeAgo(n.ts);

        // Notificación de chat
        if (n.type === 'chat') {
            const bg = n.read ? 'white' : '#eff6ff';
            const border = n.read ? 'transparent' : '#3b82f6';
            const preview = String(n.msg?.mensaje || '').substring(0, 60) + ((n.msg?.mensaje?.length || 0) > 60 ? '...' : '');
            return `
                <div onclick="_openGuestChatFromNotif('${n.nov.ID_NOVEDAD}','${(n.nov.PLANTA||'').replace(/'/g,"\\'")}','${(n.nov.LOTE||'').replace(/'/g,"\\'")}','${n.id}')"
                    style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
                           background:${bg};border-left:3px solid ${border};
                           cursor:pointer;transition:background 0.15s;">
                    <div style="width:32px;height:32px;border-radius:50%;
                        background:${n.read ? '#f1f5f9' : '#dbeafe'};border:1.5px solid ${n.read ? '#e2e8f0' : '#3b82f6'};
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                        <i class="fas fa-comments" style="color:${n.read ? '#94a3b8' : '#3b82f6'};font-size:0.75rem;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.78rem;color:#1e293b;margin-bottom:2px;">
                            Nuevo mensaje — Lote ${n.nov.LOTE || 'S/N'}
                        </div>
                        <div style="font-size:0.72rem;color:#64748b;line-height:1.4;margin-bottom:3px;">${preview}</div>
                        <div style="font-size:0.65rem;color:#94a3b8;">${timeAgo}</div>
                    </div>
                    ${!n.read ? `<div style="width:7px;height:7px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:6px;"></div>` : ''}
                </div>`;
        }

        // Notificación de cambio de estado
        const cfg = stateConfig[n.estadoActual] || stateConfig.ELABORACION;
        const bg = n.read ? 'white' : cfg.bg;
        const borderLeft = n.read ? 'transparent' : cfg.color;
        return `
            <div onclick="_openStateNotif('${n.id}','${n.nov.ID_NOVEDAD}')" style="
                display:flex; align-items:flex-start; gap:12px;
                padding:12px 16px;
                background:${bg};
                border-left:3px solid ${borderLeft};
                cursor:pointer; transition:background 0.2s;
            ">
                <div style="width:32px;height:32px;border-radius:50%;
                    background:white;border:1.5px solid ${cfg.color};
                    display:flex;align-items:center;justify-content:center;
                    flex-shrink:0;margin-top:2px;">
                    <i class="fas ${cfg.icon}" style="color:${cfg.color};font-size:0.75rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.78rem;color:#1e293b;margin-bottom:2px;">
                        Lote ${n.nov.LOTE || 'S/N'} —
                        <span style="color:${cfg.color};">${cfg.label}</span>
                    </div>
                    <div style="font-size:0.72rem;color:#64748b;line-height:1.4;margin-bottom:4px;">
                        ${n.nov.DESCRIPCION ? n.nov.DESCRIPCION.substring(0, 60) + (n.nov.DESCRIPCION.length > 60 ? '...' : '') : 'Sin descripción'}
                    </div>
                    <div style="font-size:0.65rem;color:#94a3b8;">${timeAgo}</div>
                </div>
                ${!n.read ? `<div style="width:7px;height:7px;border-radius:50%;background:${cfg.color};flex-shrink:0;margin-top:6px;"></div>` : ''}
            </div>
        `;
    }).join('');
}

function _openGuestChatFromNotif(idNovedad, planta, lote, notifId) {
    const n = _notifications.find(x => x.id === notifId);
    if (n) n.read = true;
    _persistNotifications();
    _updateBellBadge();
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
    if (typeof openChat === 'function') openChat(idNovedad, planta, lote);
}

/**
 * Abre la notificación de cambio de estado.
 * Si estamos en seguimiento.html: expande y hace scroll a la tarjeta.
 * Si estamos en otra página: navega a seguimiento.html#idNovedad.
 */
function _openStateNotif(notifId, idNovedad) {
    markRead(notifId);
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
    const onSeguimiento = window.location.pathname.includes('seguimiento.html');
    if (onSeguimiento) {
        if (typeof expandAndScroll === 'function') expandAndScroll(idNovedad);
    } else {
        window.location.href = 'seguimiento.html#' + idNovedad;
    }
}

/* ── Seguimiento tipo courier ── */

function _renderTrackingPanel(novedades) {
    const container = document.getElementById('notif-tracking-list');
    if (!container) return;

    if (!novedades || novedades.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:32px 0;color:#94a3b8;">
                <i class="fas fa-box-open" style="font-size:2rem;margin-bottom:10px;display:block;"></i>
                <span style="font-size:0.8rem;font-weight:600;">Sin novedades registradas</span>
            </div>
        `;
        return;
    }

    const sorted = [...novedades].sort((a, b) => {
        const order = { PENDIENTE: 0, ELABORACION: 1, FINALIZADO: 2 };
        return (order[a.ESTADO] ?? 0) - (order[b.ESTADO] ?? 0);
    });

    container.innerHTML = sorted.map(nov => _buildTrackingCard(nov)).join('');
}

function _buildTrackingCard(nov) {
    const estado = nov.ESTADO || 'PENDIENTE';
    const stateOrder = { PENDIENTE: 0, ELABORACION: 1, FINALIZADO: 2 };
    const currentIdx = stateOrder[estado] ?? 0;

    const steps = [
        { icon: 'fa-file-alt',     label: 'Reporte Recibido', desc: 'Tu novedad fue registrada en el sistema'    },
        { icon: 'fa-tools',        label: 'En Elaboración',   desc: 'El equipo está trabajando en la solución'   },
        { icon: 'fa-check-circle', label: 'Solucionado',      desc: 'La novedad ha sido resuelta'                }
    ];

    const stepsHtml = steps.map((step, idx) => {
        const isDone   = idx < currentIdx;
        const isActive = idx === currentIdx;

        let dotBg = '#f1f5f9', dotBorder = '#e2e8f0', labelColor = '#94a3b8', iconColor = '#cbd5e1';

        if (isDone) {
            dotBg = '#22c55e'; dotBorder = '#22c55e'; labelColor = '#16a34a'; iconColor = 'white';
        } else if (isActive) {
            if (estado === 'FINALIZADO') {
                dotBg = '#dcfce7'; dotBorder = '#22c55e'; labelColor = '#16a34a'; iconColor = '#22c55e';
            } else {
                dotBg = '#fef3c7'; dotBorder = '#f59e0b'; labelColor = '#d97706'; iconColor = '#f59e0b';
            }
        }

        const lineColor = isDone ? '#22c55e' : '#e2e8f0';
        const showLine  = idx < steps.length - 1;
        const glow      = isActive && estado !== 'FINALIZADO' ? `box-shadow:0 0 0 4px ${dotBorder}33;` : '';

        return `
            <div style="display:flex;gap:12px;align-items:flex-start;">
                <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div style="width:32px;height:32px;border-radius:50%;
                        background:${dotBg};border:2px solid ${dotBorder};
                        display:flex;align-items:center;justify-content:center;${glow}">
                        <i class="fas ${step.icon}" style="font-size:0.75rem;color:${iconColor};"></i>
                    </div>
                    ${showLine ? `<div style="width:2px;height:28px;background:${lineColor};margin-top:2px;"></div>` : ''}
                </div>
                <div style="padding-top:4px;flex:1;">
                    <div style="font-weight:700;font-size:0.75rem;color:${labelColor};">
                        ${step.label}
                        ${isActive && estado !== 'FINALIZADO' ? `
                            <span style="display:inline-block;margin-left:6px;
                                background:#fef3c7;color:#d97706;
                                font-size:0.6rem;font-weight:800;
                                padding:1px 6px;border-radius:10px;">ACTUAL</span>
                        ` : ''}
                        ${isDone ? `<i class="fas fa-check" style="margin-left:6px;color:#22c55e;font-size:0.65rem;"></i>` : ''}
                    </div>
                    <div style="font-size:0.68rem;color:#94a3b8;margin-top:1px;">${step.desc}</div>
                </div>
            </div>
        `;
    }).join('');

    const badgeColor = estado === 'FINALIZADO' ? '#22c55e' : estado === 'ELABORACION' ? '#f59e0b' : '#94a3b8';
    const badgeLabel = estado === 'FINALIZADO' ? 'Solucionado' : estado === 'ELABORACION' ? 'En proceso' : 'Pendiente';

    return `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;
            padding:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                    <div style="font-weight:800;font-size:0.82rem;color:#1e293b;">
                        <i class="fas fa-barcode" style="color:#94a3b8;margin-right:4px;"></i>
                        Lote ${nov.LOTE || 'S/N'}
                    </div>
                    <div style="font-size:0.68rem;color:#94a3b8;margin-top:2px;">
                        ${nov.AREA || 'General'} · ${nov.CANTIDAD_SOLICITADA || '0'} UND
                    </div>
                </div>
                <span style="background:${badgeColor}18;color:${badgeColor};
                    font-size:0.62rem;font-weight:800;padding:3px 8px;
                    border-radius:20px;border:1px solid ${badgeColor}44;
                    text-transform:uppercase;">${badgeLabel}</span>
            </div>
            <div style="padding-left:4px;">${stepsHtml}</div>
            ${nov.DESCRIPCION ? `
            <div style="margin-top:10px;padding:8px 10px;background:#f8fafc;
                border-radius:8px;font-size:0.7rem;color:#64748b;line-height:1.5;
                border-left:3px solid #e2e8f0;">
                ${nov.DESCRIPCION.substring(0, 100)}${nov.DESCRIPCION.length > 100 ? '...' : ''}
            </div>` : ''}
        </div>
    `;
}

/* ── Funciones públicas ── */

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        panel.style.animation = 'slideDownPanel 0.2s ease-out';
        const isGuest = currentUser && currentUser.ROL === 'GUEST';
        if (isGuest) {
            _renderNotifList();
        } else if (typeof _renderOperatorNotifPanel === 'function') {
            _renderOperatorNotifPanel();
        }
    }
}

function _markAllOperatorRead() {
    if (typeof _operatorChatNotifs !== 'undefined') {
        _operatorChatNotifs.forEach(n => n.read = true);
        if (typeof _updateOperatorBellBadge === 'function') _updateOperatorBellBadge();
    }
}

function markRead(notifId) {
    const n = _notifications.find(n => n.id === notifId);
    if (n) n.read = true;
    _persistNotifications();
    _updateBellBadge();
}

function markAllRead() {
    _notifications.forEach(n => n.read = true);
    _persistNotifications();
    _updateBellBadge();
}

/* ── Utilidades ── */

function _timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60)    return 'Hace un momento';
    if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} días`;
}

/** Limpia todas las notificaciones del panel y resetea el badge. */
function clearAllNotifications() {
    _notifications = [];
    if (typeof _operatorChatNotifs !== 'undefined') _operatorChatNotifs = [];
    _persistNotifications();
    if (typeof _persistOperatorNotifs === 'function') _persistOperatorNotifs();
    _updateBellBadge();
    _renderNotifList();
    toggleNotifPanel();
}
