/* ==========================================================================
   chat.js — Chat interno entre USER-P/ADMIN y GUEST por novedad
   ========================================================================== */

/* ── Intervalos de polling adaptativos ── */
const CHAT_POLL_ACTIVE = 2_000;  // chat abierto: 2s
const CHAT_POLL_IDLE = 5_000;  // badges campana (pestaña visible): 5s
const CHAT_POLL_HIDDEN = 30_000; // pestaña oculta: 30s
const GUEST_POLL_ACTIVE = 2_000;
const GUEST_POLL_IDLE = 5_000;  // chat cerrado pero pestaña visible: 5s
const GUEST_POLL_HIDDEN = 30_000; // pestaña oculta: 30s

let _chatTimer = null;
let _chatChannel = null; // Supabase Realtime channel
let _chatNovedadId = null;
let _chatPlanta = null;
let _chatLastTs = null;
let _chatLote = null;
let _chatArchived = false;
let _chatReadReceipts = {};  // { GUEST: ts, OPERATOR: ts }
let _chatMetaLoaded = false; // si ya cargamos meta (archived + readReceipts) al abrir
let _markReadSent = false; // MARK_READ solo se envía una vez por apertura
let _chatPollCounter = 0;

/* ── Badge de mensajes no leídos (USER-P/ADMIN en resolucion.html) ── */
const CHAT_BADGE_KEY = 'sispro_chat_seen';
const OPERATOR_NOTIF_KEY = 'sispro_op_notifs'; // persistencia notificaciones operador
let _chatBadgeTimer = null;
let _chatSeenTs = {};
let _operatorChatNotifs = [];

/* ── Panel GUEST ── */
const GUEST_CHAT_KEY = 'sispro_guest_chat_seen';
let _guestChatSeen = {};
let _guestPollTimer = null;
let _guestNovedades = [];

/* ── Imagen pendiente en chat ── */
let _chatPendingImageData = null; // { base64, mimeType, fileName } para enviar a GAS
let _chatPendingImageB64 = null; // base64 local para preview inmediato

/* ══════════════════════════════════════════════════════════════════════════
   API HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

async function _chatFetch(body) {
    try {
        // Usar la función global sendToSupabase (alias sendToGAS)
        return await sendToSupabase(body);
    } catch (e) {
        console.error('[CHAT] Error en _chatFetch:', e);
        throw e;
    }
}

/**
 * Lee la hoja CHAT desde Supabase.
 * Si se pasa idNovedad (string o array), filtra por esas novedades.
 * Si no se pasa nada, devuelve TODOS los mensajes (para operadores).
 */
async function _readChatSheet(idNovedad = null) {
    try {
        console.log('[CHAT] _readChatSheet llamada con:', idNovedad);
        
        // Si no hay filtro, traer TODOS los mensajes (para operadores)
        if (!idNovedad) {
            console.log('[CHAT] Sin filtro, trayendo todos los mensajes');
            const options = { 
                order: { column: 'TS', ascending: true }
            };
            const data = await fetchSupabaseData('CHAT', options);
            console.log('[CHAT] Mensajes recibidos (sin filtro):', data?.length || 0);
            return (data || []).map(_mapMsg);
        }
        
        // Si es un array de IDs, traer mensajes de todas esas novedades
        if (Array.isArray(idNovedad)) {
            console.log('[CHAT] Filtrando por array de IDs:', idNovedad.length);
            const allMessages = [];
            for (const id of idNovedad) {
                const cleanId = String(id).trim();
                if (!cleanId) continue;
                
                const options = { 
                    order: { column: 'TS', ascending: true },
                    filters: [{ type: 'eq', column: 'ID_NOVEDAD', value: cleanId }]
                };
                const data = await fetchSupabaseData('CHAT', options);
                if (data && data.length > 0) {
                    allMessages.push(...data.map(_mapMsg));
                }
            }
            console.log('[CHAT] Mensajes recibidos (array):', allMessages.length);
            return allMessages;
        }
        
        // Si es un solo ID, filtrar por ese ID
        const cleanId = String(idNovedad).trim();
        console.log('[CHAT] Filtrando por ID único:', cleanId);
        
        const options = { 
            order: { column: 'TS', ascending: true },
            filters: [{ type: 'eq', column: 'ID_NOVEDAD', value: cleanId }]
        };

        const data = await fetchSupabaseData('CHAT', options);
        console.log('[CHAT] Mensajes recibidos (ID único):', data?.length || 0);
        
        if (!data || data.length === 0) {
            // Si falla la primera, probamos con la columna en minúsculas por si acaso
            const data2 = await fetchSupabaseData('CHAT', { 
                order: { column: 'ts', ascending: true },
                filters: [{ type: 'eq', column: 'id_novedad', value: cleanId }]
            });
            if (data2 && data2.length > 0) {
                console.log('[CHAT] Mensajes recibidos (minúsculas):', data2.length);
                return data2.map(_mapMsg);
            }
            return [];
        }

        return data.map(_mapMsg);
    } catch (e) {
        console.error('[CHAT] Error crítico en _readChatSheet:', e);
        return [];
    }
}

// Función auxiliar para no repetir código de mapeo
function _mapMsg(r) {
    return {
        id:      r.ID_MSG || r.id_msg || r.id || '',
        idNov:   String(r.ID_NOVEDAD || r.id_novedad || r.id_nov || '').trim(),
        autor:   String(r.AUTOR || r.autor || ''),     
        rol:     String(r.ROL || r.rol || ''),         
        mensaje: r.MENSAJE || r.mensaje || '',
        imagen_url: r.IMAGEN_URL || r.imagen_url || '',
        ts:      r.TIMESTAMP || r.TS || r.ts || new Date().toISOString()
    };
}

/**
 * Lee la columna CHAT de NOVEDADES para saber si un chat está archivado.
 * Devuelve { chatUrl, chatRead } para el idNovedad dado.
 */
async function _readNovedadChatMeta(idNovedad) {
    try {
        // En Supabase podemos consultar la tabla NOVEDADES directamente
        const novedades = await fetchSupabaseData('NOVEDADES');
        const nov = novedades.find(n => String(n.id_novedad || n.ID_NOVEDAD || '').trim() === String(idNovedad).trim());

        if (!nov) return { chatUrl: '', chatRead: {} };

        const chatUrl = String(nov.chat || nov.CHAT || '');
        const chatReadRaw = String(nov.chat_read || nov.CHAT_READ || '');
        let chatRead = {};
        try { chatRead = JSON.parse(chatReadRaw || '{}'); } catch (_) { }

        return { chatUrl, chatRead };
    } catch (e) {
        console.warn('[CHAT] Error leyendo meta desde Supabase:', e);
        return { chatUrl: '', chatRead: {} };
    }
}

async function _sendMsg(mensaje, imagenData = null) {
    if ((!mensaje || !mensaje.trim()) && !imagenData) return;
    if (!_chatNovedadId) {
        console.error('[CHAT] No hay ID de novedad seleccionado.');
        return;
    }

    // IDENTIDAD (Ajustada: AUTOR = Nombre/Planta, ROL = Cargo)
    const userRol = currentUser.ROL || 'GUEST';
    const userName = (userRol === 'GUEST') 
        ? (currentUser.PLANTA || currentUser.USUARIO || 'GUEST')
        : (currentUser.USUARIO || currentUser.NOMBRE || 'ADMIN');
    
    const valorParaAutor = userName;  // Nombre o Planta
    const valorParaRol   = userRol;   // Cargo (ADMIN / GUEST)

    let cleanText = mensaje ? mensaje.trim() : '';
    let driveUrl = null;

    if (imagenData) {
        try {
            driveUrl = await _subirArchivoDrive(imagenData, _chatNovedadId, 'CHATS');
        } catch (e) {
            console.error('[CHAT] Error subiendo imagen:', e);
            throw new Error('No se pudo subir la imagen al servidor de Drive.');
        }
    }

    try {
        const now = new Date().toISOString();
        const payload = {
            accion: 'SEND_CHAT_MSG',

            // Campos exactos para tu Edge Function
            idNovedad: String(_chatNovedadId),
            mensaje: cleanText,       // SOLO TEXTO
            imagen_url: driveUrl,        // SOLO IMAGEN
            lote: String(_chatLote || 'S/L'),
            op: String(_chatLote || 'S/L'),
            autor: valorParaAutor,  // ADMIN / GUEST
            rol: valorParaRol,    // NOMBRE DEL USUARIO

            // Campos para la DB (Mayúsculas)
            ID_NOVEDAD: String(_chatNovedadId),
            LOTE: String(_chatLote || 'S/L'),
            OP: String(_chatLote || 'S/L'),
            AUTOR: valorParaAutor, // Nombre / Planta
            ROL: valorParaRol,     // Cargo
            MENSAJE: cleanText,
            IMAGEN_URL: driveUrl,
            TS: now,
            TIMESTAMP: now
        };

        console.log('[CHAT] Enviando mensaje corregido:', { autor: valorParaAutor, rol: valorParaRol });
        return await _chatFetch(payload);
    } catch (e) {
        console.error('[CHAT] Error enviando mensaje:', e);
        throw e;
    }
}

async function _archiveChat(idNovedad) {
    try {
        await _chatFetch({ accion: 'ARCHIVE_CHAT', idNovedad });
    } catch (e) { console.warn('[CHAT] No se pudo archivar:', e.message); }
}

async function _reopenChat(idNovedad) {
    try {
        await _chatFetch({ accion: 'REOPEN_CHAT', idNovedad });
    } catch (e) { console.warn('[CHAT] No se pudo reabrir:', e.message); }
}

/* ══════════════════════════════════════════════════════════════════════════
   ABRIR / CERRAR CHAT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Abre el chat para una novedad.
 * @param {string} idNovedad
 * @param {string} planta
 * @param {string} lote
 */
function openChat(idNovedad, planta, lote, isArchived) {
    _chatNovedadId = idNovedad;
    _chatPlanta = planta;
    _chatLote = lote;
    _chatLastTs = null;
    _chatArchived = !!isArchived;
    _chatMetaLoaded = true;  // ya tenemos el estado archivado — no re-leer NOVEDADES
    _markReadSent = false;
    _buildChatModal(lote, planta);
    _startChatPoll(CHAT_POLL_ACTIVE);
}

/**
/**
 * Cierra el modal de chat. NO archiva ni finaliza nada.
 * Archivar solo ocurre via botón ARCHIVAR o al FINALIZAR la novedad.
 */
function closeChat() {
    _stopChatPoll();
    const overlay = document.getElementById('chat-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0.97)';
        setTimeout(() => overlay.remove(), 200);
    }
    _chatNovedadId = null;
    _chatArchived = false;
    if (currentUser?.ROL !== 'GUEST') _startBadgePoll();
}

/**
 * Cierra el modal de chat si está abierto para esa novedad.
 * NO archiva — cerrar el modal no finaliza ni archiva nada.
 */
function closeChatIfOpen(idNovedad) {
    if (_chatNovedadId === idNovedad) closeChat();
}

/**
 * Llamado al FINALIZAR una novedad desde resolucion.js.
 * Cierra el modal si está abierto Y archiva el chat en Drive.
 */
function _finalizarChat(idNovedad) {
    if (_chatNovedadId === idNovedad) closeChat();
    _archiveChat(idNovedad);
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════════════════════ */

function _buildChatModal(lote, planta) {
    document.getElementById('chat-overlay')?.remove();

    const isOperator = currentUser?.ROL === 'ADMIN' || currentUser?.ROL === 'USER-P';

    const overlay = document.createElement('div');
    overlay.id = 'chat-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0;
        background:rgba(15,23,42,0.45); backdrop-filter:blur(6px);
        z-index:9000; display:flex; align-items:center; justify-content:center;
        opacity:0; transition:opacity 0.2s ease;
    `;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeChat(); });

    overlay.innerHTML = `
        <div id="chat-box" style="
            width:420px; max-width:calc(100vw - 32px);
            height:580px; max-height:calc(100vh - 80px);
            background:white; border-radius:20px;
            box-shadow:0 25px 60px rgba(0,0,0,0.2);
            display:flex; flex-direction:column; overflow:hidden;
            transform:scale(0.97); transition:transform 0.2s ease;
        ">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:14px 16px;display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-comments" style="color:white;font-size:0.95rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.88rem;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Chat — Lote ${lote || 'S/N'}</div>
                    <div style="font-size:0.65rem;color:rgba(255,255,255,0.65);margin-top:1px;">${planta}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                    ${isOperator ? `
                    <button id="chat-action-btn" onclick="_toggleChatArchive()" title="Finalizar y archivar chat"
                        style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);color:white;
                               height:30px;padding:0 12px;border-radius:20px;cursor:pointer;
                               font-size:0.65rem;font-weight:800;letter-spacing:0.5px;
                               display:flex;align-items:center;gap:5px;transition:all 0.2s;white-space:nowrap;">
                        <i class="fas fa-archive"></i> <span id="chat-action-label">ARCHIVAR</span>
                    </button>` : ''}
                    <button onclick="closeChat()"
                        style="background:rgba(255,255,255,0.15);border:none;color:white;
                               width:30px;height:30px;border-radius:50%;cursor:pointer;
                               font-size:0.9rem;display:flex;align-items:center;justify-content:center;transition:background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.28)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <!-- Messages -->
            <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;">
                <div id="chat-loading" style="text-align:center;padding:20px;color:#94a3b8;">
                    <i class="fas fa-circle-notch fa-spin" style="font-size:1.2rem;"></i>
                </div>
            </div>
            <!-- Input -->
            <div id="chat-input-area" style="padding:12px 16px;border-top:1px solid #f1f5f9;background:white;display:flex;flex-direction:column;gap:8px;">
                <!-- Preview de imagen pendiente -->
                <div id="chat-img-preview" style="display:none;position:relative;width:fit-content;">
                    <img id="chat-img-preview-img" src="" alt="preview" style="max-height:80px;max-width:180px;border-radius:8px;border:1.5px solid #e2e8f0;object-fit:cover;">
                    <button onclick="_chatClearImage()" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#ef4444;border:none;color:white;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;padding:0;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <!-- Fila de input -->
                <div style="display:flex;gap:8px;align-items:flex-end;">
                    <!-- Adjuntar imagen -->
                    <button type="button" onclick="document.getElementById('chat-img-input').click()" title="Adjuntar imagen"
                        style="width:38px;height:38px;border-radius:50%;border:1.5px solid #e2e8f0;
                               background:white;color:#94a3b8;cursor:pointer;flex-shrink:0;
                               display:flex;align-items:center;justify-content:center;
                               font-size:0.85rem;transition:all 0.2s;"
                        onmouseover="this.style.borderColor='#3b82f6';this.style.color='#3b82f6'"
                        onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#94a3b8'">
                        <i class="fas fa-image"></i>
                    </button>
                    <input type="file" id="chat-img-input" accept="image/*" style="display:none;" onchange="_chatImageSelected(this)">
                    <!-- Plantillas de cobro (solo operadores) -->
                    ${isOperator ? `
                    <div style="position:relative;flex-shrink:0;">
                        <button id="chat-tpl-btn" onclick="_toggleChatTemplates()" title="Plantillas de cobro"
                            style="width:38px;height:38px;border-radius:50%;border:1.5px solid #e2e8f0;
                                   background:white;color:#94a3b8;cursor:pointer;
                                   display:flex;align-items:center;justify-content:center;
                                   font-size:0.85rem;transition:all 0.2s;"
                            onmouseover="this.style.borderColor='#f59e0b';this.style.color='#f59e0b'"
                            onmouseout="if(!document.getElementById('chat-tpl-popover')?.style.display||document.getElementById('chat-tpl-popover').style.display==='none'){this.style.borderColor='#e2e8f0';this.style.color='#94a3b8';}">
                            <i class="fas fa-file-invoice-dollar"></i>
                        </button>
                        <div id="chat-tpl-popover" style="display:none;position:absolute;bottom:46px;left:0;
                            background:white;border:1.5px solid #e2e8f0;border-radius:14px;
                            box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;overflow:hidden;z-index:100;">
                            <div style="padding:8px 12px;font-size:0.62rem;font-weight:800;color:#94a3b8;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;">TIPO DE COBRO</div>
                            ${[
                ['MANO_A_MANO', 'fa-handshake', 'Mano a Mano'],
                ['TALLER', 'fa-industry', 'Taller'],
                ['LINEA', 'fa-route', 'Línea'],
                ['REFERENCIA', 'fa-tag', 'Referencia'],
                ['FICHA', 'fa-file-alt', 'Ficha Técnica'],
                ['ENTREGA', 'fa-truck', 'Entrega']
            ].map(([tipo, icon, label]) => `
                            <button onclick="_chatInsertarPlantilla('${tipo}')"
                                style="width:100%;padding:9px 14px;border:none;background:white;
                                       text-align:left;cursor:pointer;font-size:0.78rem;font-weight:600;
                                       color:#374151;display:flex;align-items:center;gap:9px;transition:background 0.15s;"
                                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                                <i class="fas ${icon}" style="color:#f59e0b;width:14px;text-align:center;"></i> ${label}
                            </button>`).join('')}
                        </div>
                    </div>` : ''}
                    <!-- Corregir con IA -->
                    <button id="chat-ai-btn" onclick="_chatCorregirIA()" title="Corregir con IA"
                        style="width:38px;height:38px;border-radius:50%;border:1.5px solid #e2e8f0;
                               background:white;color:#94a3b8;cursor:pointer;flex-shrink:0;
                               display:flex;align-items:center;justify-content:center;
                               font-size:0.85rem;transition:all 0.2s;"
                        onmouseover="this.style.borderColor='#8b5cf6';this.style.color='#8b5cf6'"
                        onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#94a3b8'">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                    <!-- Textarea -->
                    <textarea id="chat-input" placeholder="Escribe un mensaje..." rows="1"
                        style="flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:9px 13px;font-size:0.875rem;resize:none;font-family:inherit;color:#1e293b;outline:none;transition:border 0.2s;max-height:100px;overflow-y:auto;line-height:1.4;"
                        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_submitChatMsg();}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';"
                    ></textarea>
                    <!-- Enviar -->
                    <button onclick="_submitChatMsg()" id="chat-send-btn"
                        style="width:38px;height:38px;border-radius:50%;border:none;
                               background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;cursor:pointer;
                               flex-shrink:0;display:flex;align-items:center;justify-content:center;
                               font-size:0.85rem;transition:all 0.2s;box-shadow:0 4px 12px rgba(59,130,246,0.3);"
                        onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        document.getElementById('chat-box').style.transform = 'scale(1)';
    }));
    setTimeout(() => document.getElementById('chat-input')?.focus(), 250);
}

/**
 * Alterna entre ARCHIVAR (finalizar) y REABRIR el chat.
 * Disponible para USER-P/ADMIN (header) y GUEST (banner).
 */
async function _toggleChatArchive() {
    const id = _chatNovedadId;
    const btn = document.getElementById('chat-action-btn');
    if (!id) return;

    // Deshabilitar ambos posibles botones (header + banner)
    const bannerBtn = document.querySelector('#chat-archived-banner button');
    if (btn) btn.disabled = true;
    if (bannerBtn) bannerBtn.disabled = true;
    const prevBtnHTML = btn ? btn.innerHTML : null;
    if (btn) btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';

    try {
        if (_chatArchived) {
            // REABRIR
            await _reopenChat(id);
            _chatArchived = false;
            _chatLastTs = null;
            _chatMetaLoaded = false; // forzar re-lectura de meta
            _updateArchivedBanner(false);
            _updateChatActionBtn();
            await _loadAndRender();
        } else {
            // ARCHIVAR
            const res = await _chatFetch({ accion: 'ARCHIVE_CHAT', idNovedad: id });
            if (res.success) {
                _chatArchived = true;
                _chatMetaLoaded = false; // forzar re-lectura de meta
                _updateChatActionBtn();
                _updateArchivedBanner(true);
            }
        }
    } catch (e) {
        console.error('[CHAT] Error toggle archive:', e);
    } finally {
        if (btn) {
            btn.disabled = false;
            if (btn.innerHTML.includes('fa-spin') && prevBtnHTML) btn.innerHTML = prevBtnHTML;
        }
        if (bannerBtn) bannerBtn.disabled = false;
    }
}

function _updateChatActionBtn() {
    const btn = document.getElementById('chat-action-btn');
    const lbl = document.getElementById('chat-action-label');
    if (!btn || !lbl) return;
    if (_chatArchived) {
        btn.title = 'Reabrir chat';
        btn.querySelector('i').className = 'fas fa-folder-open';
        lbl.textContent = 'REABRIR';
        btn.style.background = 'rgba(34,197,94,0.2)';
        btn.style.borderColor = 'rgba(34,197,94,0.5)';
    } else {
        btn.title = 'Finalizar y archivar chat';
        btn.querySelector('i').className = 'fas fa-archive';
        lbl.textContent = 'ARCHIVAR';
        btn.style.background = 'rgba(255,255,255,0.15)';
        btn.style.borderColor = 'rgba(255,255,255,0.3)';
    }
}

function _updateArchivedBanner(show) {
    const area = document.getElementById('chat-input-area');
    if (!area) return;
    const existing = document.getElementById('chat-archived-banner');
    const isGuest = currentUser?.ROL === 'GUEST';
    if (show && !existing) {
        const banner = document.createElement('div');
        banner.id = 'chat-archived-banner';
        banner.style.cssText = `
            padding:10px 16px;background:#f0fdf4;border-top:1px solid #bbf7d0;
            display:flex;align-items:center;gap:8px;font-size:0.72rem;font-weight:700;color:#15803d;
            flex-wrap:wrap;
        `;
        const msg = isGuest
            ? 'Esta consulta ha sido atendida y cerrada.'
            : 'Chat finalizado y archivado. Presiona REABRIR para continuar.';
        banner.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span style="flex:1;">${msg}</span>
            <button onclick="_toggleChatArchive()"
                style="background:#15803d;border:none;color:white;padding:4px 10px;border-radius:10px;
                       cursor:pointer;font-size:0.65rem;font-weight:800;letter-spacing:0.4px;
                       display:flex;align-items:center;gap:4px;white-space:nowrap;">
                <i class="fas fa-folder-open"></i> REABRIR
            </button>`;
        area.parentNode.insertBefore(banner, area);
        area.style.display = 'none';
    } else if (!show && existing) {
        existing.remove();
        area.style.display = 'flex';
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   ENVIAR / POLLING / RENDER
   ══════════════════════════════════════════════════════════════════════════ */

async function _submitChatMsg() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const texto = input.value.trim();

    if (!texto && !_chatPendingImageB64) return;

    const btn = document.getElementById('chat-send-btn');
    if (btn) btn.disabled = true;

    const imagenData = _chatPendingImageData; // { base64, mimeType, fileName }
    const localPreviewUrl = imagenData ? `data:${imagenData.mimeType};base64,${imagenData.base64}` : null;

    input.value = '';
    input.style.height = 'auto';
    _chatClearImage();

    // Preview optimista
    _appendBubble({
        id: 'temp_' + Date.now(),
        autor: currentUser.USUARIO || currentUser.PLANTA || 'Tú',
        rol: currentUser.ROL,
        mensaje: texto,
        ts: new Date().toISOString(),
        _localImg: localPreviewUrl
    }, true);

    try {
        console.log('[DEBUG] Iniciando proceso de envío...');
        const res = await _sendMsg(texto, imagenData);

        if (!res || !res.success) {
            throw new Error(res ? res.message : 'El servidor no devolvió una respuesta válida.');
        }

        console.log('[DEBUG] Mensaje enviado con éxito');
        await _loadAndRender();

    } catch (e) {
        console.error('[CHAT] Fallo en el envío:', e);

        let errorMsg = 'No se pudo enviar el mensaje.';
        if (e.message.includes('Drive')) {
            errorMsg = 'Error al subir la imagen a Drive. Intente de nuevo.';
        } else if (e.message.includes('Supabase') || e.message.includes('404') || e.message.includes('500')) {
            errorMsg = 'Error en el servidor de base de datos (Supabase).';
        }

        Swal.fire({
            title: 'Error de Envío',
            text: errorMsg + '\n\nDetalle: ' + e.message,
            icon: 'error',
            confirmButtonColor: '#3b82f6'
        });
    } finally {
        if (btn) btn.disabled = false;
        input.focus();
    }
}

function _startChatPoll() {
    _loadAndRender();
    if (_chatTimer) clearInterval(_chatTimer);
    _chatTimer = setInterval(_loadAndRender, CHAT_POLL_ACTIVE || 3000); // Polling ultrarrápido de respaldo de 3 segundos

    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (sb && !window._chatActiveChannel) {
        window._chatActiveChannel = sb.channel('public:CHAT_active')
            .on('postgres_changes', { event: 'INSERT', schema: 'public' }, payload => {
                if (payload.table.toLowerCase() === 'chat') {
                    if (payload.new && String(payload.new.ID_NOVEDAD || payload.new.id_novedad || payload.new.ID_NOV || payload.new.id_nov) === String(_chatNovedadId)) {
                        setTimeout(() => _loadAndRender(), 300);
                    }
                }
            })
            .subscribe();
    }
}

function _stopChatPoll() {
    if (_chatTimer) { clearInterval(_chatTimer); _chatTimer = null; }
    // Si queremos destruir la suscripción al cerrar:
    /* if (window._chatActiveChannel) {
        getSupabaseClient().removeChannel(window._chatActiveChannel);
        window._chatActiveChannel = null;
    } */
}

async function _loadAndRender() {
    try {
        const id = _chatNovedadId;
        if (!id) return;

        if (!_chatMetaLoaded || (_chatPollCounter % 3 === 0)) {
            // Cargar meta (incluye recibos de lectura) inicialmente y luego cada 3 ciclos de poll (~9s)
            const meta = await _readNovedadChatMeta(id);
            _chatMetaLoaded = true;
            _chatArchived = meta.chatUrl.startsWith('https://') || meta.chatUrl.startsWith('[');
            _chatReadReceipts = meta.chatRead || {};
            _updateChatActionBtn();
            if (_chatArchived) _updateArchivedBanner(true);
        }

        let msgs = [];
        if (_chatArchived) {
            // Archivado: leer desde Drive via GAS (solo una vez — no hay polling)
            _stopChatPoll();
            const data = await _chatFetch({ accion: 'GET_CHAT_MSGS', idNovedad: id });
            msgs = data.msgs || [];
            if (data.readReceipts) _chatReadReceipts = data.readReceipts;
            _renderMessages(msgs);
            if (msgs.length) _markChatSeen(id, _lastSeenTs(msgs));
        } else {
            // Activo: lectura directa desde Supabase — rápido y filtrado
            msgs = await _readChatSheet(id);
            _renderMessages(msgs);
            if (msgs.length) _markChatSeen(id, _lastSeenTs(msgs));
        }

        // MARK_READ: al abrir o cuando llegan mensajes nuevos de la contraparte
        const lastMsg = msgs[msgs.length - 1];
        const lastTsValue = lastMsg ? (lastMsg.TS || lastMsg.ts) : null;
        const lastRolValue = lastMsg ? (lastMsg.ROL || lastMsg.rol) : '';
        const hasNewOtherMsg = lastMsg && lastTsValue !== _chatLastTs && lastRolValue !== (currentUser?.ROL || 'GUEST');

        if (!_markReadSent || hasNewOtherMsg) {
            _markReadSent = true;
            const rol = currentUser?.ROL || 'GUEST';
            _chatFetch({ accion: 'MARK_READ', idNovedad: id, rol }).catch(() => { });
        }
    } catch (e) { 
        console.warn('[CHAT] Error al cargar mensajes:', e); 
    }
}

function _renderMessages(msgs) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    document.getElementById('chat-loading')?.remove();

    if (msgs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;"><i class="fas fa-comments" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.4;"></i><div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">Sin mensajes aún</div><div style="font-size:0.75rem;">Sé el primero en escribir.</div></div>`;
        return;
    }

    const lastTs = msgs[msgs.length - 1]?.ts;
    if (lastTs === _chatLastTs && container.children.length > 0) return;
    _chatLastTs = lastTs;

    const wasAtBottom = _isScrolledToBottom(container);
    container.innerHTML = '';

    // Find the last message sent by the current user (for read receipt)
    const myRol = currentUser?.ROL || 'GUEST';
    let lastMyMsgIndex = -1;
    msgs.forEach((msg, i) => { if (msg.rol === myRol && !String(msg.id).startsWith('temp_')) lastMyMsgIndex = i; });

    let lastDate = null;
    msgs.forEach((msg, i) => {
        const msgDate = _formatDateLabel(msg.ts);
        if (msgDate !== lastDate) {
            lastDate = msgDate;
            const sep = document.createElement('div');
            sep.style.cssText = 'text-align:center;font-size:0.65rem;font-weight:700;color:#94a3b8;margin:8px 0;position:relative;';
            sep.innerHTML = `<span style="background:#f8fafc;padding:0 10px;position:relative;z-index:1;">${msgDate}</span><div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#e2e8f0;z-index:0;"></div>`;
            container.appendChild(sep);
        }
        const isLastMine = (i === lastMyMsgIndex);
        _appendBubble(msg, false, container, isLastMine);
    });

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

function _appendBubble(msg, scrollDown = true, container = null, isLastMine = false) {
    const c = container || document.getElementById('chat-messages');
    if (!c) return;

    // --- LÓGICA DE IDENTIDAD Y SEGURIDAD ---
    const myName = currentUser?.USUARIO || currentUser?.NOMBRE || '';
    const myRol = currentUser?.ROL || 'GUEST';

    // msg.rol contiene el ROL (mapeado de r.AUTOR)
    const isGuestMsg = (msg.rol === 'GUEST');

    // Bubble Styles
    const bubbleBg = isGuestMsg ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'white';
    const textColor = isGuestMsg ? 'white' : '#1e293b';
    const metaColor = isGuestMsg ? 'rgba(255,255,255,0.7)' : '#94a3b8';
    const align = isGuestMsg ? 'flex-end' : 'flex-start';
    const borderRadius = isGuestMsg ? '18px 18px 4px 18px' : '18px 18px 18px 4px';

    // Identificar si el mensaje es MÍO (para mostrar checks y alineación)
    // msg.autor contiene el Nombre Real (mapeado de r.AUTOR)
    const isMine = String(msg.autor).trim().toLowerCase() === String(myName).trim().toLowerCase();
    let receiptHtml = '';

    const isTemp = String(msg.id).startsWith('temp_');

    if (isMine) {
        // Reloj si está subiendo al servidor, doble check (oculto) si ya llegó.
        receiptHtml = `<div style="font-size:0.55rem;color:${metaColor};margin-top:2px;text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:3px;font-weight:600;">
            <i class="fas ${isTemp ? 'fa-clock' : 'fa-check-double'}" style="font-size:0.68rem;color:${isGuestMsg ? 'rgba(255,255,255,0.4)' : '#cbd5e1'};"></i>
        </div>`;
    }

    // --- PROCESAMIENTO DE CONTENIDO ---
    // Priorizamos el campo IMAGEN_URL dedicado, luego buscamos en el mensaje, o usamos imagen local temp.
    const msgText = String(msg.MENSAJE || msg.mensaje || '');
    const imgUrlMatch = msgText.match(/(https?:\/\/lh3\.googleusercontent\.com\/d\/[^\s]+)/i);
    const imgUrl = msg.IMAGEN_URL || msg.imagen_url || (imgUrlMatch ? imgUrlMatch[0] : null) || msg._localImg;
    const cleanText = imgUrlMatch ? msgText.replace(imgUrlMatch[0], '').trim() : msgText;

    let contenidoHtml = '';
    if (imgUrl) {
        // Se muestra exactamente igual esté subiendo o ya subido. Solo inhabilitamos el clic mientras es temp.
        contenidoHtml += `
            <div style="margin-bottom:${cleanText ? '8px' : '0'};">
                <a href="${!isTemp ? imgUrl : '#'}" target="${!isTemp ? '_blank' : '_self'}" style="pointer-events:${isTemp ? 'none' : 'auto'}; cursor:${isTemp ? 'default' : 'pointer'};">
                    <img src="${imgUrl}" alt="adjunto" loading="lazy"
                        style="max-width:220px;max-height:200px;border-radius:10px;display:block;object-fit:cover;border:1.5px solid rgba(0,0,0,0.05);">
                </a>
            </div>`;
    }
    if (cleanText) {
        contenidoHtml += `<div style="font-size:0.875rem;color:${textColor};line-height:1.5;word-break:break-word;">${_escapeHtml(cleanText)}</div>`;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;flex-direction:column;align-items:${align};margin-bottom:12px;`;
    wrap.innerHTML = `
        ${!isMine ? `<div style="font-size:0.65rem;font-weight:700;color:#64748b;margin-bottom:3px;padding:0 4px;">${msg.AUTOR || msg.autor}</div>` : ''}
        <div style="max-width:82%;padding:10px 14px;background:${bubbleBg};border-radius:${borderRadius};box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            ${contenidoHtml}
            <div style="font-size:0.6rem;color:${metaColor};margin-top:4px;text-align:right;">${_formatTime(msg.TS || msg.ts)}</div>
        </div>
        ${receiptHtml}`;

    c.appendChild(wrap);
    if (scrollDown) c.scrollTop = c.scrollHeight;
}

/* ══════════════════════════════════════════════════════════════════════════
   BADGES USER-P/ADMIN (resolucion.html)
   ══════════════════════════════════════════════════════════════════════════ */

function initChatBadges() {
    console.log('[CHAT-OPERATOR] Inicializando sistema de badges de chat');
    const role = currentUser?.ROL;
    if (role !== 'ADMIN' && role !== 'USER-P') {
        console.log('[CHAT-OPERATOR] Usuario no es operador, abortando');
        return;
    }
    try { const s = localStorage.getItem(CHAT_BADGE_KEY); if (s) _chatSeenTs = JSON.parse(s); } catch (_) { }
    console.log('[CHAT-OPERATOR] Mensajes vistos:', _chatSeenTs);
    // Restaurar notificaciones persistidas
    try {
        const s = localStorage.getItem(OPERATOR_NOTIF_KEY);
        if (s) {
            const parsed = JSON.parse(s);
            _operatorChatNotifs = parsed.map(n => ({ ...n, ts: new Date(n.ts) }));
        }
    } catch (_) { _operatorChatNotifs = []; }
    console.log('[CHAT-OPERATOR] Notificaciones restauradas:', _operatorChatNotifs.length);
    _startBadgePoll();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !_chatNovedadId) {
            console.log('[CHAT-OPERATOR] Pestaña visible, refrescando badges');
            _pollChatBadges(); // Refrescar si hubo cambios mientras estaba minimizado
        }
    });
}

function _startBadgePoll() {
    console.log('[CHAT-OPERATOR] Iniciando polling de badges');
    if (_chatBadgeTimer) clearInterval(_chatBadgeTimer);
    const interval = document.hidden ? CHAT_POLL_HIDDEN : CHAT_POLL_IDLE;
    console.log('[CHAT-OPERATOR] Intervalo de polling:', interval, 'ms');
    _chatBadgeTimer = setInterval(_pollChatBadges, interval);
    _pollChatBadges();
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (sb && !window._chatBadgeChannel) {
        console.log('[CHAT-OPERATOR] Suscribiendo a canal Realtime de Supabase');
        window._chatBadgeChannel = sb.channel('public:CHAT_badges')
            .on('postgres_changes', { event: 'INSERT', schema: 'public' }, payload => {
                if (payload.table.toLowerCase() === 'chat') {
                    console.log('[CHAT-OPERATOR] Realtime: Nuevo mensaje detectado');
                    setTimeout(() => _pollChatBadges(), 500);
                }
            })
            .subscribe();
    }
}

async function _pollChatBadges() {
    console.log('[CHAT-OPERATOR] Polling badges...');
    try {
        // Leer hoja CHAT directamente via Sheets API v4
        const allRows = await _readChatSheet();
        console.log('[CHAT-OPERATOR] Mensajes recibidos:', allRows.length);

        // Construir mapa: último mensaje de GUEST por novedad (cualquier novedad, no solo las del DOM)
        const latestGuestByNov = {};
        allRows.forEach(r => {
            const novId = String(r.idNov || '').trim();
            const rol = String(r.rol || '').trim();
            if (!novId) return;
            if (rol === 'GUEST') {
                // Guardar el más reciente (las filas vienen en orden cronológico)
                latestGuestByNov[novId] = {
                    id: r.id,
                    rol,
                    autor: r.autor,
                    mensaje: r.mensaje,
                    ts: r.ts
                };
            }
        });

        console.log('[CHAT-OPERATOR] Últimos mensajes de GUEST por novedad:', latestGuestByNov);

        // También construir mapa de metadatos (lote, planta) desde las filas de chat
        const metaByNov = {};
        allRows.forEach(r => {
            const novId = String(r.idNov || '').trim();
            if (novId && !metaByNov[novId]) {
                metaByNov[novId] = { planta: String(r.planta || '').trim() };
            }
        });

        for (const [id, lastMsg] of Object.entries(latestGuestByNov)) {
            console.log(`[CHAT-OPERATOR] Novedad ${id}: ts=${lastMsg.ts}, visto=${_chatSeenTs[id]}`);
            if (lastMsg.ts !== _chatSeenTs[id]) {
                console.log(`[CHAT-OPERATOR] ✅ Nuevo mensaje de GUEST detectado para novedad ${id}`);
                // Mensaje nuevo de GUEST no visto aún
                _markCardUnread(id); // no-op si no hay card en el DOM
                // Obtener lote/planta: primero del DOM, luego del mapa de chat
                const card = document.querySelector(`[data-novedad-id="${id}"]`);
                const lote = card?.dataset.lote || id;
                const planta = card?.dataset.planta || metaByNov[id]?.planta || '';
                console.log('[CHAT-OPERATOR] Agregando notificación de chat a la campana');
                _addOperatorChatNotif(id, lastMsg, lote, planta);
            } else {
                _markCardRead(id); // no-op si no hay card en el DOM
            }
        }

        _updateOperatorBellBadge();
    } catch (e) {
        console.error('[CHAT-OPERATOR] Error en polling:', e);
    }
}

/**
 * Agrega una notificación de mensaje GUEST al panel de campana del operador.
 * lote y planta son opcionales — si no se pasan se intenta leer del DOM.
 */
function _addOperatorChatNotif(idNovedad, msg, lote, planta) {
    console.log('[CHAT-OPERATOR] _addOperatorChatNotif llamada:', { idNovedad, msg, lote, planta });
    if (typeof _operatorChatNotifs === 'undefined') {
        console.error('[CHAT-OPERATOR] ❌ _operatorChatNotifs no está definido');
        return;
    }
    const dedupKey = `${idNovedad}_${msg.ts}`;
    if (_operatorChatNotifs.some(n => n.id === dedupKey)) {
        console.log('[CHAT-OPERATOR] Notificación duplicada, ignorando');
        return;
    }
    // Fallback al DOM si no se pasaron
    if (!lote || !planta) {
        const card = document.querySelector(`[data-novedad-id="${idNovedad}"]`);
        lote = lote || card?.dataset.lote || idNovedad;
        planta = planta || card?.dataset.planta || '';
    }
    console.log('[CHAT-OPERATOR] ✅ Agregando notificación de chat del operador');
    _operatorChatNotifs.unshift({ id: dedupKey, idNovedad, lote, planta, msg, ts: new Date(), read: false });
    if (_operatorChatNotifs.length > 30) _operatorChatNotifs = _operatorChatNotifs.slice(0, 30);
    _persistOperatorNotifs();
    _updateOperatorBellBadge();
    const bellBtn = document.getElementById('notif-bell-btn');
    if (bellBtn) {
        bellBtn.classList.add('has-unread');
        bellBtn.addEventListener('animationend', () => bellBtn.classList.remove('has-unread'), { once: true });
    }

    // Reproducir sonido y mostrar toast
    console.log('[CHAT-OPERATOR] Reproduciendo sonido de chat...');
    if (typeof playChatSound === 'function') {
        playChatSound();
    } else {
        console.error('[CHAT-OPERATOR] ❌ playChatSound no está disponible');
    }
    if (typeof _showChatToast === 'function') {
        _showChatToast(lote, msg);
    } else {
        console.error('[CHAT-OPERATOR] ❌ _showChatToast no está disponible');
    }

    // Si el operador está en background, empujar alerta PWA nativa
    if (document.hidden && typeof window.triggerPwaNotification === 'function') {
        window.triggerPwaNotification(
            `💬 Nuevo mensaje: Lote ${lote || idNovedad}`,
            `${msg.autor || 'GUEST'}: ${msg.mensaje || 'Envió un archivo adjunto'}`,
            `chat_${idNovedad}`,
            `./seguimiento.html` // Operador abre en seguimiento.html o index.
        );
    }
}

function _persistOperatorNotifs() {
    try { localStorage.setItem(OPERATOR_NOTIF_KEY, JSON.stringify(_operatorChatNotifs)); } catch (_) { }
}

function _markCardUnread(idNovedad) {
    const btn = document.querySelector(`[data-chat-btn="${idNovedad}"]`);
    if (!btn) return;
    btn.classList.add('has-unread-chat');
    if (!btn.querySelector('.chat-unread-dot')) {
        const dot = document.createElement('span');
        dot.className = 'chat-unread-dot';
        btn.appendChild(dot);
    }
    _updateOperatorBellBadge();
}

function _markCardRead(idNovedad) {
    const btn = document.querySelector(`[data-chat-btn="${idNovedad}"]`);
    if (!btn) return;
    btn.classList.remove('has-unread-chat');
    btn.querySelector('.chat-unread-dot')?.remove();
    _updateOperatorBellBadge();
}

function _updateOperatorBellBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const unread = _operatorChatNotifs.filter(n => !n.read).length;
    badge.style.display = unread > 0 ? 'block' : 'none';
    badge.textContent = unread > 9 ? '9+' : String(unread);
    _renderOperatorNotifPanel();
}

/**
 * Devuelve el ts relevante para marcar como "visto":
 * - GUEST: ts del último mensaje del operador (para no suprimir notifs de sus propios mensajes)
 * - ADMIN/USER-P: ts del último mensaje del GUEST
 * - Fallback: ts del último mensaje de cualquier rol
 */
function _lastSeenTs(msgs) {
    if (!msgs.length) return null;
    const myRol = currentUser?.ROL || 'GUEST';
    const otherRol = myRol === 'GUEST' ? null : 'GUEST'; // GUEST busca mensajes de operador; operador busca de GUEST
    if (otherRol) {
        // Operador: buscar último mensaje de GUEST
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].rol === otherRol) return msgs[i].ts;
        }
    } else {
        // GUEST: buscar último mensaje que NO sea del GUEST (del operador)
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].rol !== 'GUEST') return msgs[i].ts;
        }
    }
    return msgs[msgs.length - 1].ts; // fallback
}

function _markChatSeen(idNovedad, lastTs) {
    if (!idNovedad || !lastTs) return;
    const rol = currentUser?.ROL || '';
    if (rol === 'GUEST') {
        // Para GUEST: marcar el último mensaje del operador como visto
        _guestChatSeen[idNovedad] = lastTs;
        try { localStorage.setItem(GUEST_CHAT_KEY, JSON.stringify(_guestChatSeen)); } catch (_) { }
        // Marcar notificaciones de chat de esta novedad como leídas
        if (typeof _notifications !== 'undefined') {
            _notifications.forEach(n => { if (n.type === 'chat' && n.nov?.ID_NOVEDAD === idNovedad) n.read = true; });
            if (typeof _persistNotifications === 'function') _persistNotifications();
            if (typeof _updateBellBadge === 'function') _updateBellBadge();
        }
    } else {
        // Para ADMIN/USER-P: marcar el último mensaje del GUEST como visto
        _chatSeenTs[idNovedad] = lastTs;
        try { localStorage.setItem(CHAT_BADGE_KEY, JSON.stringify(_chatSeenTs)); } catch (_) { }
        _markCardRead(idNovedad);
        _operatorChatNotifs.forEach(n => { if (n.idNovedad === idNovedad) n.read = true; });
        _persistOperatorNotifs();
        _updateOperatorBellBadge();
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL DE NOTIFICACIONES OPERADOR (resolucion.html)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Renderiza el panel de campana del operador con mensajes de chat no leídos.
 * El panel ya existe en el DOM (creado por notifications.js/_ensureNotifPanel).
 */
function _renderOperatorNotifPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return; // panel no existe o es GUEST

    if (_operatorChatNotifs.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:32px 16px;color:#94a3b8;">
                <i class="fas fa-comments" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.35;"></i>
                <span style="font-size:0.8rem;font-weight:600;">Sin mensajes nuevos</span>
                <p style="font-size:0.72rem;margin-top:6px;color:#cbd5e1;">Los mensajes de las plantas aparecerán aquí.</p>
            </div>`;
        return;
    }

    list.innerHTML = _operatorChatNotifs.map(n => {
        const bg = n.read ? 'white' : '#eff6ff';
        const border = n.read ? 'transparent' : '#3b82f6';
        const timeAgo = _timeAgoChat(n.ts);
        const preview = String(n.msg.mensaje || '').substring(0, 60) + (n.msg.mensaje?.length > 60 ? '...' : '');
        return `
            <div onclick="_openChatFromNotif('${n.idNovedad}','${(n.planta || '').replace(/'/g, "\\'")}','${(n.lote || '').replace(/'/g, "\\'")}','${n.id}')"
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
                        Lote ${n.lote || 'S/N'}
                        ${n.planta ? `<span style="font-weight:500;color:#64748b;"> · ${n.planta}</span>` : ''}
                    </div>
                    <div style="font-size:0.72rem;color:#64748b;line-height:1.4;margin-bottom:3px;">${_escapeHtml(preview)}</div>
                    <div style="font-size:0.65rem;color:#94a3b8;">${timeAgo}</div>
                </div>
                ${!n.read ? `<div style="width:7px;height:7px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:6px;"></div>` : ''}
            </div>`;
    }).join('');
}

function _openChatFromNotif(idNovedad, planta, lote, notifId) {
    const n = _operatorChatNotifs.find(x => x.id === notifId);
    if (n) n.read = true;
    _persistOperatorNotifs();
    _updateOperatorBellBadge();
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
    openChat(idNovedad, planta, lote);
}

function _timeAgoChat(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} días`;
}

/* ══════════════════════════════════════════════════════════════════════════
   MÓDULO EXCLUSIVO GUEST — Panel de chats + polling
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inicializa el sistema de chat para GUEST.
 * Llamado desde app.js después de loadUsers().
 * @param {Array} novedades — lista de novedades del GUEST
 */
function initGuestChat(novedades) {
    console.log('[CHAT-GUEST] Inicializando sistema de chat para GUEST');
    if (!currentUser || currentUser.ROL !== 'GUEST') {
        console.log('[CHAT-GUEST] Usuario no es GUEST, abortando');
        return;
    }
    _guestNovedades = novedades || [];
    console.log('[CHAT-GUEST] Novedades cargadas:', _guestNovedades.length);
    try { const s = localStorage.getItem(GUEST_CHAT_KEY); if (s) _guestChatSeen = JSON.parse(s); } catch (_) { }
    console.log('[CHAT-GUEST] Mensajes vistos:', _guestChatSeen);
    _startGuestPoll();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('[CHAT-GUEST] Pestaña visible, refrescando chats');
            _pollGuestChats(); // Refrescar al volver a enfocar
        }
    });
}

function _startGuestPoll() {
    console.log('[CHAT-GUEST] Iniciando polling de chats');
    if (_guestPollTimer) clearInterval(_guestPollTimer);
    const interval = _chatNovedadId ? GUEST_POLL_ACTIVE : (document.hidden ? GUEST_POLL_HIDDEN : GUEST_POLL_IDLE);
    console.log('[CHAT-GUEST] Intervalo de polling:', interval, 'ms');
    _guestPollTimer = setInterval(_pollGuestChats, interval);

    _pollGuestChats();
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (sb && !window._guestBadgeChannel) {
        console.log('[CHAT-GUEST] Suscribiendo a canal Realtime de Supabase');
        window._guestBadgeChannel = sb.channel('public:CHAT_guest')
            .on('postgres_changes', { event: 'INSERT', schema: 'public' }, payload => {
                if (payload.table.toLowerCase() === 'chat') {
                    console.log('[CHAT-GUEST] Realtime: Nuevo mensaje detectado');
                    setTimeout(() => _pollGuestChats(), 500);
                }
            })
            .subscribe();
    }
}

async function _pollGuestChats() {
    console.log('[CHAT-GUEST] Polling chats...');
    // Si no tenemos novedades en memoria, intentar cargarlas (páginas sin app.js)
    if (!_guestNovedades.length) {
        try {
            const novedades = await fetchNovedadesData();
            if (novedades && novedades.length) _guestNovedades = novedades;
        } catch (_) { }
    }
    if (!_guestNovedades.length) {
        console.log('[CHAT-GUEST] No hay novedades en memoria');
        return;
    }

    const ids = Array.from(new Set(_guestNovedades.map(n => n.ID_NOVEDAD).filter(Boolean)));
    console.log('[CHAT-GUEST] IDs de novedades:', ids);
    if (!ids.length) return;

    try {
        // OPTIMIZADO: Solo pide los mensajes de tus novedades, NO de toda la DB
        const allRows = await _readChatSheet(ids);
        console.log('[CHAT-GUEST] Mensajes recibidos:', allRows.length);
        const latestByNov = {};
        allRows.forEach(r => {
            const novId = String(r.idNov || '').trim();
            latestByNov[novId] = {
                id: r.id,
                rol: r.rol,
                autor: r.autor,
                mensaje: r.mensaje,
                ts: r.ts
            };
        });
        console.log('[CHAT-GUEST] Últimos mensajes por novedad:', latestByNov);
        for (const id of ids) {
            const lastMsg = latestByNov[id];
            if (!lastMsg) {
                console.log(`[CHAT-GUEST] No hay mensajes para novedad ${id}`);
                continue;
            }
            console.log(`[CHAT-GUEST] Novedad ${id}: rol=${lastMsg.rol}, ts=${lastMsg.ts}, visto=${_guestChatSeen[id]}`);
            if (lastMsg.rol !== 'GUEST' && lastMsg.ts !== _guestChatSeen[id]) {
                console.log(`[CHAT-GUEST] ✅ Nuevo mensaje del operador detectado para novedad ${id}`);
                // Notificar via campana en lugar de toast flotante
                if (_chatNovedadId !== id) {
                    const nov = _guestNovedades.find(n => n.ID_NOVEDAD === id);
                    if (nov) {
                        console.log('[CHAT-GUEST] Agregando notificación de chat a la campana');
                        _addChatNotification(nov, lastMsg);
                    } else {
                        console.log('[CHAT-GUEST] ❌ No se encontró la novedad en memoria');
                    }
                } else {
                    console.log('[CHAT-GUEST] Chat abierto, no notificar');
                }
            }
        }
    } catch (e) {
        console.error('[CHAT-GUEST] Error en polling:', e);
    }
}

/**
 * Agrega una notificación de chat nuevo a la campana de notificaciones.
 * Evita duplicados por (idNovedad + ts del mensaje).
 */
function _addChatNotification(nov, msg) {
    console.log('[CHAT-GUEST] _addChatNotification llamada:', { nov: nov.ID_NOVEDAD, msg });
    if (typeof _notifications === 'undefined') {
        console.error('[CHAT-GUEST] ❌ _notifications no está definido');
        return;
    }
    const dedupKey = `chat_${nov.ID_NOVEDAD}_${msg.ts}`;
    if (_notifications.some(n => n.id === dedupKey)) {
        console.log('[CHAT-GUEST] Notificación duplicada, ignorando');
        return;
    }
    console.log('[CHAT-GUEST] ✅ Agregando notificación de chat');
    _notifications.unshift({
        id: dedupKey,
        type: 'chat',
        nov,
        msg,
        ts: new Date(),
        read: false
    });
    if (_notifications.length > 30) _notifications = _notifications.slice(0, 30);
    if (typeof _persistNotifications === 'function') _persistNotifications();
    if (typeof _updateBellBadge === 'function') _updateBellBadge();
    const bellBtn = document.getElementById('notif-bell-btn');
    if (bellBtn) {
        bellBtn.classList.add('has-unread');
        bellBtn.addEventListener('animationend', () => bellBtn.classList.remove('has-unread'), { once: true });
    }

    // Toast y Sonido
    console.log('[CHAT-GUEST] Mostrando toast y reproduciendo sonido');
    _showChatToast(nov.LOTE || 'S/N', msg);
    if (typeof playChatSound === 'function') {
        console.log('[CHAT-GUEST] Reproduciendo sonido de chat...');
        playChatSound();
    } else {
        console.error('[CHAT-GUEST] ❌ playChatSound no está disponible');
    }

    // Alerta PWA si la app está minimizada
    if (document.hidden && typeof window.triggerPwaNotification === 'function') {
        const title = `💬 Mensaje — Lote ${nov.LOTE || 'S/N'}`;
        const body = `${msg.autor || 'Planta'}: ${(msg.mensaje || 'Adjunto').substring(0, 80)}`;
        window.triggerPwaNotification(title, body, `chat_${nov.ID_NOVEDAD}`, `./index.html`);
    }
}

function _showChatToast(loteStr, msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed; bottom:24px; left:50%;
        transform:translateX(-50%) translateY(80px);
        background:#eff6ff; border:1.5px solid #3b82f6;
        border-radius:14px; padding:14px 20px;
        display:flex; align-items:center; gap:14px;
        box-shadow:0 8px 30px rgba(0,0,0,0.12);
        z-index:9999; min-width:300px; max-width:90vw;
        transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
        opacity:0;
    `;

    const preview = String(msg.mensaje || '').substring(0, 55) + ((msg.mensaje?.length || 0) > 55 ? '...' : '');

    toast.innerHTML = `
        <div style="width:38px;height:38px;border-radius:50%;background:white;
            border:1.5px solid #3b82f6;display:flex;align-items:center;
            justify-content:center;flex-shrink:0;">
            <i class="fas fa-comments" style="color:#3b82f6;font-size:1rem;"></i>
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:0.8rem;color:#1e293b;margin-bottom:2px;">
                Nuevo mensaje — Lote ${loteStr}
            </div>
            <div style="font-size:0.72rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${preview || 'Imagen recibida'}
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

/* ══════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════════════════════ */

function _isScrolledToBottom(el) { return el.scrollHeight - el.scrollTop - el.clientHeight < 60; }

function _formatTime(isoStr) {
    if (!isoStr) return '';
    try { return new Date(isoStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
}

function _formatDateLabel(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Hoy';
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return ''; }
}

function _escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

/* ══════════════════════════════════════════════════════════════════════════
   MANEJO DE IMÁGENES EN CHAT (Drive vía GAS)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Llamado cuando el usuario selecciona una imagen.
 * Muestra preview inmediato (base64 local) y prepara los datos para enviar a GAS.
 */
async function _chatImageSelected(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;

    // Feedback visual de carga
    const preview = document.getElementById('chat-img-preview');
    const previewImg = document.getElementById('chat-img-preview-img');
    if (preview && previewImg) {
        previewImg.src = 'https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif'; // Spinner amigable
        preview.style.display = 'block';
    }

    try {
        // Usar compresor global definido en forms/gas.js (1280px, 72% calidad)
        const compressed = await fileToBase64(file);

        _chatPendingImageData = compressed; // { base64, mimeType, fileName }
        _chatPendingImageB64 = compressed.base64;

        if (previewImg) {
            previewImg.src = `data:${compressed.mimeType};base64,${compressed.base64}`;
        }
    } catch (e) {
        console.error('[CHAT] Error procesando imagen:', e);
        Swal.fire('Error', 'No se pudo procesar la imagen seleccionada.', 'error');
        _chatClearImage();
    } finally {
        input.value = '';
    }
}

/**
 * Corrige el texto del input del chat usando Gemini IA.
 * Mismo modelo y prompt que el corrector de resoluciones.
 */
async function _chatCorregirIA() {
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('chat-ai-btn');
    if (!input || !btn) return;

    const texto = input.value.trim();
    if (!texto) {
        input.placeholder = 'Escribe algo primero...';
        setTimeout(() => { input.placeholder = 'Escribe un mensaje...'; }, 1500);
        return;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    btn.disabled = true;
    btn.style.borderColor = '#8b5cf6';
    btn.style.color = '#8b5cf6';

    try {
        const data = await callSupabaseAI(texto, 'CHAT_CORRECTION');

        if (data.success && data.improvedText) {
            input.value = data.improvedText;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';

            // Feedback visual: borde verde momentáneo
            btn.style.borderColor = '#22c55e';
            btn.style.color = '#22c55e';
            setTimeout(() => {
                btn.style.borderColor = '#e2e8f0';
                btn.style.color = '#94a3b8';
            }, 1500);
        } else {
            throw new Error(data.error || 'Sin respuesta de IA');
        }

    } catch (err) {
        console.error('[CHAT IA]', err);
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
        setTimeout(() => {
            btn.style.borderColor = '#e2e8f0';
            btn.style.color = '#94a3b8';
        }, 2000);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

/**
 * Limpia la imagen pendiente y oculta el preview.
 */
function _chatClearImage() {
    _chatPendingImageData = null;
    _chatPendingImageB64 = null;
    const preview = document.getElementById('chat-img-preview');
    const previewImg = document.getElementById('chat-img-preview-img');
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
}

/* ══════════════════════════════════════════════════════════════════════════
   PLANTILLAS DE COBRO (solo ADMIN / USER-P)
   ══════════════════════════════════════════════════════════════════════════ */

const _CHAT_PLANTILLAS = {
    MANO_A_MANO: 'Esta resolución es mano a mano sin cobro. Puede recoger el material en nuestras instalaciones en el horario de atención: 7:10 a.m. - 4:43 p.m.',
    TALLER: 'Agradecemos su colaboración y le recordamos que el reporte oportuno de novedades (dentro de las 24 horas o 2 días hábiles) nos permite gestionar de manera más eficiente las soluciones y mantener la calidad de nuestros procesos conjuntos.',
    LINEA: 'Hemos identificado que la situación se originó en nuestra línea de producción, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.',
    REFERENCIA: 'Hemos identificado que la situación está relacionada con especificaciones de la referencia, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.',
    FICHA: 'Hemos identificado que la situación está relacionada con la ficha técnica, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.',
    ENTREGA: 'Hemos identificado que la situación se originó en el proceso de entrega, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.'
};

function _toggleChatTemplates() {
    const pop = document.getElementById('chat-tpl-popover');
    const btn = document.getElementById('chat-tpl-btn');
    if (!pop) return;
    const isOpen = pop.style.display !== 'none';
    pop.style.display = isOpen ? 'none' : 'block';
    if (btn) {
        btn.style.borderColor = isOpen ? '#e2e8f0' : '#f59e0b';
        btn.style.color = isOpen ? '#94a3b8' : '#f59e0b';
    }
}

function _chatInsertarPlantilla(tipo) {
    const texto = _CHAT_PLANTILLAS[tipo];
    if (!texto) return;
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = texto;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        input.focus();
    }
    // Cerrar popover
    const pop = document.getElementById('chat-tpl-popover');
    const btn = document.getElementById('chat-tpl-btn');
    if (pop) pop.style.display = 'none';
    if (btn) { btn.style.borderColor = '#e2e8f0'; btn.style.color = '#94a3b8'; }
}

// Cerrar popover al hacer clic fuera
document.addEventListener('click', function (e) {
    const pop = document.getElementById('chat-tpl-popover');
    const btn = document.getElementById('chat-tpl-btn');
    if (!pop || pop.style.display === 'none') return;
    if (!pop.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        pop.style.display = 'none';
        if (btn) { btn.style.borderColor = '#e2e8f0'; btn.style.color = '#94a3b8'; }
    }
});
