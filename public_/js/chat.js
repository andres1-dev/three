/* ==========================================================================
   chat.js — Chat interno entre USER-P/ADMIN y GUEST por novedad
   ========================================================================== */

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
        throw e;
    }
}

/**
 * Lee la hoja CHAT desde Supabase.
 * Si se pasa idNovedad (string o array), filtra por esas novedades.
 * Si no se pasa nada, devuelve TODOS los mensajes (para operadores).
 */
/**
 * Lee mensajes de chat desde Supabase usando la Edge Function /chat-realtime
 * @param {string|Array|null} idNovedad - ID de novedad, array de IDs, o null para todos
 * @returns {Promise<Array>} Array de mensajes mapeados
 */
async function _readChatSheet(idNovedad = null) {
    try {
        let url;
        
        if (idNovedad) {
            if (Array.isArray(idNovedad)) {
                idNovedad = idNovedad[0];
            }
            
            const trimmedId = String(idNovedad).trim();
            url = `${CONFIG.FUNCTIONS_URL}/chat-realtime?action=get_messages&id_novedad=${encodeURIComponent(trimmedId)}`;
        } else {
            url = `${CONFIG.FUNCTIONS_URL}/chat-realtime?action=get_all`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return [];
        }
        
        const result = await response.json();
        
        if (!result.success) {
            return [];
        }
        
        const data = result.messages || [];
        
        const mapped = data.map(_mapMsg);
        
        return mapped;
    } catch (e) {
        return [];
    }
}

/**
 * Mapea un registro de Supabase a formato interno
 */
function _mapMsg(r) {
    return {
        id: r.ID_MSG || r.id_msg || '',
        idNov: r.ID_NOVEDAD || r.id_novedad || '',
        lote: r.LOTE || r.lote || '',
        planta: r.PLANTA || r.planta || '',
        autor: r.AUTOR || r.autor || '',
        rol: r.ROL || r.rol || '',
        ROL: r.ROL || r.rol || '', // Mantener ambos formatos
        AUTOR: r.AUTOR || r.autor || '', // Mantener ambos formatos
        MENSAJE: r.MENSAJE || r.mensaje || '',
        mensaje: r.MENSAJE || r.mensaje || '',
        img: r.IMAGEN_URL || r.imagen_url || '',
        IMAGEN_URL: r.IMAGEN_URL || r.imagen_url || '',
        imagen_url: r.IMAGEN_URL || r.imagen_url || '',
        ts: r.TS || r.ts || r.TIMESTAMP || '',
        TS: r.TS || r.ts || r.TIMESTAMP || '', // Mantener ambos formatos
        isRead: r.IS_READ || r.is_read || false,
        IS_READ: r.IS_READ || r.is_read || false,
        READ_AT: r.READ_AT || r.read_at || null,
        read_at: r.READ_AT || r.read_at || null
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
        return { chatUrl: '', chatRead: {} };
    }
}

async function _sendMsg(mensaje, imagenData = null) {
    if ((!mensaje || !mensaje.trim()) && !imagenData) return;
    if (!_chatNovedadId) {
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

        return await _chatFetch(payload);
    } catch (e) {
        throw e;
    }
}

async function _archiveChat(idNovedad) {
    try {
        await _chatFetch({ accion: 'ARCHIVE_CHAT', idNovedad });
    } catch (e) { }
}

async function _reopenChat(idNovedad) {
    try {
        await _chatFetch({ accion: 'REOPEN_CHAT', idNovedad });
    } catch (e) { }
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
    _startChatPoll(); // Inicia Realtime para este chat
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
        // Error silencioso
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
        const res = await _sendMsg(texto, imagenData);

        if (!res || !res.success) {
            throw new Error(res ? res.message : 'El servidor no devolvió una respuesta válida.');
        }

        await _loadAndRender();

    } catch (e) {
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

    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!sb) { 
        return; 
    } 
    
    if (window._chatActiveChannel) { 
        sb.removeChannel(window._chatActiveChannel); 
        window._chatActiveChannel = null; 
    } 
    
    const idNov = _chatNovedadId;
    
    if (!idNov) {
        return;
    }
        
    window._chatActiveChannel = sb.channel('chat-global-realtime')
            .on('postgres_changes', { 
                event: '*',
                schema: 'public',
                table: 'CHAT'
            }, payload => {
                const msgNovedadId = payload.new?.ID_NOVEDAD || payload.old?.ID_NOVEDAD;
                
                if (msgNovedadId === idNov) {
                    if (typeof invalidateCache === 'function') {
                        invalidateCache('CHAT');
                    }
                    
                    _loadAndRender();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                } else if (status === 'CHANNEL_ERROR') {
                } else if (status === 'CLOSED') {
                } else if (status === 'TIMED_OUT') {
                }
            });
}

function _stopChatPoll() {
    if (_chatTimer) { 
        clearInterval(_chatTimer); 
        _chatTimer = null; 
    }
    
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (sb && window._chatActiveChannel) {
        sb.removeChannel(window._chatActiveChannel);
        window._chatActiveChannel = null;
    }
}

async function _loadAndRender() {
    try {
        const id = _chatNovedadId;
        if (!id) {
            return;
        }

        // Cargar meta solo si no está cargada
        if (!_chatMetaLoaded) {
            const meta = await _readNovedadChatMeta(id);
            _chatMetaLoaded = true;
            _chatArchived = meta.chatUrl.startsWith('https://') || meta.chatUrl.startsWith('[');
            _chatReadReceipts = meta.chatRead || {};
            _updateChatActionBtn();
            if (_chatArchived) _updateArchivedBanner(true);
        }

        let msgs = [];
        if (_chatArchived) {
            _stopChatPoll();
            const data = await _chatFetch({ accion: 'GET_CHAT_MSGS', idNovedad: id });
            msgs = data.msgs || [];
            if (data.readReceipts) _chatReadReceipts = data.readReceipts;
            _renderMessages(msgs);
            if (msgs.length) _markChatSeen(id, _lastSeenTs(msgs));
        } else {
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
    }
}

function _renderMessages(msgs) {
    const container = document.getElementById('chat-messages');
    if (!container) {
        return;
    }
    
    document.getElementById('chat-loading')?.remove();

    if (msgs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;"><i class="fas fa-comments" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.4;"></i><div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">Sin mensajes aún</div><div style="font-size:0.75rem;">Sé el primero en escribir.</div></div>`;
        return;
    }

    const lastTs = msgs[msgs.length - 1]?.ts;
    
    _chatLastTs = lastTs;

    const wasAtBottom = _isScrolledToBottom(container);
    container.innerHTML = '';

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
    if (!c) {
        return;
    }

    const myName = currentUser?.USUARIO || currentUser?.NOMBRE || '';
    const myRol = currentUser?.ROL || 'GUEST';

    // msg.rol contiene el ROL (mapeado de r.AUTOR)
    const isGuestMsg = (msg.rol === 'GUEST' || msg.ROL === 'GUEST');

    // Identificar si el mensaje es MÍO
    // Primero intentar por nombre (para ADMIN/USER-P que pueden tener múltiples usuarios con mismo rol)
    // Si no coincide el nombre, usar ROL (para GUEST donde cada planta tiene un solo usuario)
    const msgAutor = String(msg.autor || msg.AUTOR || '').trim();
    const msgRol = msg.rol || msg.ROL || '';
    
    let isMine = false;
    if (myName && msgAutor) {
        // Si ambos tienen nombre, comparar por nombre
        isMine = msgAutor.toLowerCase() === myName.toLowerCase();
    }
    // Si no coincidió por nombre O no hay nombre, usar ROL
    if (!isMine) {
        isMine = (msgRol === myRol);
    }

    // Bubble Styles - Color basado en ROL del mensaje
    const bubbleBg = isGuestMsg ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'white';
    const textColor = isGuestMsg ? 'white' : '#1e293b';
    const metaColor = isGuestMsg ? 'rgba(255,255,255,0.7)' : '#94a3b8';
    
    // Alineación basada en si es MÍO o no (mis mensajes a la derecha)
    const align = isMine ? 'flex-end' : 'flex-start';
    const borderRadius = isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
    
    let receiptHtml = '';

    const isTemp = String(msg.id).startsWith('temp_');
    const isRead = msg.isRead || msg.IS_READ || false;
    const readAt = msg.READ_AT || msg.read_at || null;

    if (isMine) {
        let statusHtml = '';
        // El texto del estado siempre es gris oscuro porque está fuera de la burbuja
        const statusTextColor = '#64748b';
        const iconColorGray = '#94a3b8';
        
        if (isTemp) {
            // Enviando - un solo check
            statusHtml = `
                <div style="display:flex;align-items:center;gap:4px;">
                    <i class="fas fa-check" style="font-size:0.7rem;color:${iconColorGray};"></i>
                    <span style="font-size:0.6rem;color:${statusTextColor};">Enviando...</span>
                </div>`;
        } else if (isRead && readAt) {
            // Leído - check doble azul con hora
            const readTime = _formatTime(readAt);
            statusHtml = `
                <div style="display:flex;align-items:center;gap:4px;">
                    <i class="fas fa-check-double" style="font-size:0.7rem;color:#3b82f6;"></i>
                    <span style="font-size:0.6rem;color:${statusTextColor};">Leído ${readTime}</span>
                </div>`;
        } else if (!isTemp) {
            // Entregado - check doble gris
            statusHtml = `
                <div style="display:flex;align-items:center;gap:4px;">
                    <i class="fas fa-check-double" style="font-size:0.7rem;color:${iconColorGray};"></i>
                    <span style="font-size:0.6rem;color:${statusTextColor};">Entregado</span>
                </div>`;
        }
        
        receiptHtml = `<div style="margin-top:3px;text-align:right;display:flex;align-items:center;justify-content:flex-end;font-weight:500;">
            ${statusHtml}
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
    if (window._chatBadgesRealtimeActive) return;
    window._chatBadgesRealtimeActive = true;

    const role = currentUser?.ROL;
    if (role !== 'ADMIN' && role !== 'USER-P') {
        return;
    }
    try { const s = localStorage.getItem(CHAT_BADGE_KEY); if (s) _chatSeenTs = JSON.parse(s); } catch (_) { }
    // Restaurar notificaciones persistidas
    try {
        const s = localStorage.getItem(OPERATOR_NOTIF_KEY);
        if (s) {
            const parsed = JSON.parse(s);
            _operatorChatNotifs = parsed.map(n => ({ ...n, ts: new Date(n.ts) }));
        }
    } catch (_) { _operatorChatNotifs = []; }
    _startBadgePoll();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !_chatNovedadId) {
            _pollChatBadges(); // Refrescar si hubo cambios mientras estaba minimizado
        }
    });
}

/**
 * Inicia suscripción Realtime para badges de chat (100% tiempo real)
 */
function _startBadgePoll() {
    if (_chatBadgeTimer) {
        clearInterval(_chatBadgeTimer);
        _chatBadgeTimer = null;
    }
    
    _pollChatBadges(); // Carga inicial
    
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!sb) return;
    
    if (window._chatBadgeChannel) {
        window._chatBadgeChannel.unsubscribe();
        window._chatBadgeChannel = null;
    }
    
    window._chatBadgeChannel = sb
        .channel('chat-badges-realtime')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public',
            table: 'CHAT'
        }, payload => {
            _pollChatBadges();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
            } else if (status === 'CHANNEL_ERROR') {
            }
        });
}

async function _pollChatBadges() {
    try {
        const url = `${CONFIG.FUNCTIONS_URL}/chat-realtime?action=get_latest_by_novedad&rol=GUEST`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            }
        });
        
        if (!response.ok) {
            return;
        }
        
        const result = await response.json();
        const allMessages = result.messages || [];

        const latestGuestByNov = {};
        
        (allMessages || []).forEach(r => {
            const novId = String(r.ID_NOVEDAD || '').trim();
            if (!novId) return;
            
            // Guardar siempre el más reciente (sobrescribe)
            latestGuestByNov[novId] = {
                id: r.ID_MSG,
                rol: r.ROL,    // ROL contiene el rol (GUEST/ADMIN)
                autor: r.AUTOR, // AUTOR contiene el nombre real
                mensaje: r.MENSAJE,
                ts: r.TS,
                lote: r.LOTE || ''
            };
        });

        for (const [id, lastMsg] of Object.entries(latestGuestByNov)) {
            if (lastMsg.ts !== _chatSeenTs[id]) {
                _markCardUnread(id);
                
                const card = document.querySelector(`[data-novedad-id="${id}"]`);
                const lote = card?.dataset.lote || lastMsg.lote || id;
                const planta = card?.dataset.planta || '';
                
                _addOperatorChatNotif(id, lastMsg, lote, planta);
            } else {
                _markCardRead(id);
            }
        }

        _updateOperatorBellBadge();
    } catch (e) {
    }
}

function _addOperatorChatNotif(idNovedad, msg, lote, planta) {
    if (typeof _operatorChatNotifs === 'undefined') {
        return;
    }
    const dedupKey = `${idNovedad}_${msg.ts}`;
    if (_operatorChatNotifs.some(n => n.id === dedupKey)) {
        return;
    }
    if (!lote || !planta) {
        const card = document.querySelector(`[data-novedad-id="${idNovedad}"]`);
        lote = lote || card?.dataset.lote || idNovedad;
        planta = planta || card?.dataset.planta || '';
    }
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
    if (typeof playChatSound === 'function') {
        playChatSound();
    }
    if (typeof _showChatToast === 'function') {
        _showChatToast(lote, msg);
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
    if (!currentUser || currentUser.ROL !== 'GUEST') {
        return;
    }
    _guestNovedades = novedades || [];
    try { const s = localStorage.getItem(GUEST_CHAT_KEY); if (s) _guestChatSeen = JSON.parse(s); } catch (_) { }
    _startGuestPoll();
    // Eliminado: listener de visibilitychange (ya no es necesario con Realtime)
}

/**
 * Inicia suscripción Realtime para chat de GUEST (100% tiempo real)
 */
function _startGuestPoll() {
    if (_guestPollTimer) {
        clearInterval(_guestPollTimer);
        _guestPollTimer = null;
    }

    _pollGuestChats(); // Carga inicial
    
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!sb) return;
    
    if (window._guestBadgeChannel) {
        window._guestBadgeChannel.unsubscribe();
        window._guestBadgeChannel = null;
    }
    
    window._guestBadgeChannel = sb
        .channel('chat-guest-realtime')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public',
            table: 'CHAT'
        }, payload => {
            _pollGuestChats();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
            } else if (status === 'CHANNEL_ERROR') {
            }
        });
}

async function _pollGuestChats() {
    // Si no tenemos novedades en memoria, intentar cargarlas
    if (!_guestNovedades.length) {
        try {
            const novedades = await fetchNovedadesData();
            if (novedades && novedades.length) _guestNovedades = novedades;
        } catch (_) { }
    }
    
    if (!_guestNovedades.length) {
        console.log('[CHAT-GUEST] No hay novedades para consultar');
        return;
    }

    const ids = Array.from(new Set(_guestNovedades.map(n => n.ID_NOVEDAD).filter(Boolean)));
    if (!ids.length) return;

    try {
        // Obtener todos los mensajes y filtrar en memoria (más rápido que múltiples queries)
        const url = `${CONFIG.FUNCTIONS_URL}/chat-realtime?action=get_all`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            }
        });
        
        if (!response.ok) {
            return;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            return;
        }
        
        const allMessages = result.messages || [];
        
        // Filtrar solo mensajes de las novedades del GUEST
        const filteredMessages = allMessages.filter(r => ids.includes(r.ID_NOVEDAD));

        // Construir mapa: último mensaje por novedad
        const latestByNov = {};
        filteredMessages.forEach(r => {
            const novId = String(r.ID_NOVEDAD || '').trim();
            if (!novId) return;
            
            // Guardar siempre el más reciente (sobrescribe)
            latestByNov[novId] = {
                id: r.ID_MSG,
                rol: r.ROL,    // ROL contiene el rol (GUEST/ADMIN)
                autor: r.AUTOR, // AUTOR contiene el nombre real
                mensaje: r.MENSAJE,
                ts: r.TS
            };
        });

        for (const id of ids) {
            const lastMsg = latestByNov[id];
            if (!lastMsg) continue;
            
            // Si el último mensaje NO es del GUEST y no lo hemos visto
            if (lastMsg.rol !== 'GUEST' && lastMsg.ts !== _guestChatSeen[id]) {
                // Notificar solo si no es el chat actualmente abierto
                if (_chatNovedadId !== id) {
                    const nov = _guestNovedades.find(n => n.ID_NOVEDAD === id);
                    if (nov) {
                        _addChatNotification(nov, lastMsg);
                    }
                }
            }
        }
    } catch (e) {
    }
}

/**
 * Agrega una notificación de chat nuevo a la campana de notificaciones.
 * Evita duplicados por (idNovedad + ts del mensaje).
 */
function _addChatNotification(nov, msg) {
    if (typeof _notifications === 'undefined') {
        return;
    }
    const dedupKey = `chat_${nov.ID_NOVEDAD}_${msg.ts}`;
    if (_notifications.some(n => n.id === dedupKey)) {
        return;
    }
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
    _showChatToast(nov.LOTE || 'S/N', msg);
    if (typeof playChatSound === 'function') {
        playChatSound();
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

