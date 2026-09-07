// ============================================================================
// 🚀 CONFIGURACIÓN SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://zpikjjcbievfpzegupmw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Cliente solo para realtime y chat (no para leer novedades directamente)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================================
// 📋 VARIABLES GLOBALES
// ============================================================================
let currentNovedad = null;
let realtimeChannel = null;
let _expandedIds = new Set();

// Chat variables
let chatChannel = null;
let chatNovedadId = null;
let chatPlanta = null;
let chatLote = null;
let chatArchived = false;

// ============================================================================
// 🔍 OBTENER ID_NOVEDAD DE URL
// ============================================================================
function getIdNovedadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// ============================================================================
// 📅 PARSEAR FECHA
// ============================================================================
function parseDate(val) {
    if (!val) return null;
    if (typeof val === 'number') return new Date(val);
    const s = String(val).trim();
    if (!s) return null;
    
    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct;
    
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
        const [, d, mo, y, h = '0', mi = '0', sec = '0'] = m;
        return new Date(+y, +mo - 1, +d, +h, +mi, +sec);
    }
    return null;
}

// ============================================================================
// 📊 CARGAR NOVEDAD
// ============================================================================
async function loadNovedad() {
    const idNovedad = getIdNovedadFromUrl();
    
    console.log('[SEGUIMIENTO] ID de novedad desde URL:', idNovedad);
    
    if (!idNovedad) {
        console.error('[SEGUIMIENTO] No se proporcionó ID de novedad');
        showError('No se proporcionó ID de novedad');
        return;
    }

    try {
        console.log('[SEGUIMIENTO] Consultando Edge Function para id_novedad:', idNovedad);

        const resp = await fetch(`${FUNCTIONS_URL}/novedad-seguimiento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
            },
            body: JSON.stringify({ id_novedad: idNovedad }),
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Error ${resp.status}: ${txt}`);
        }

        const result = await resp.json();
        console.log('[SEGUIMIENTO] Resultado:', result);

        if (!result.success || !result.novedad) {
            console.error('[SEGUIMIENTO] Novedad no encontrada para id:', idNovedad);
            showError('Novedad no encontrada. Verifica que el enlace sea correcto.');
            return;
        }

        const data = result.novedad;
        console.log('[SEGUIMIENTO] Novedad cargada:', data);
        currentNovedad = data;
        renderNovedad(data);
        setupRealtime(idNovedad);
        setupChatNotifRealtime(idNovedad);
        
    } catch (e) {
        console.error('[SEGUIMIENTO] Error:', e);
        showError('Error al cargar la novedad: ' + e.message);
    }
}

// ============================================================================
// 🎨 RENDERIZAR NOVEDAD
// ============================================================================
function renderNovedad(nov) {
    const container = document.getElementById('tracking-container');
    const countEl = document.getElementById('seg-count');
    const subtitleEl = document.getElementById('headerSubtitle');
    
    if (subtitleEl) {
        subtitleEl.textContent = nov.id_novedad || 'SIN ID';
    }
    
    countEl.style.display = 'none';
    container.innerHTML = buildCard(nov);
    
    // Auto-expandir
    const card = container.querySelector('.seg-card');
    if (card) {
        card.classList.add('open');
        _expandedIds.add(nov.id_novedad);
    }
}

// ============================================================================
// 🏗️ CONSTRUIR TARJETA
// ============================================================================
function buildCard(nov) {
    const id = nov.id_novedad || '';
    const estado = nov.estado || 'PENDIENTE';
    
    const stateLabel = { 
        PENDIENTE: 'Pendiente', 
        ELABORACION: 'En proceso', 
        FINALIZADO: 'Solucionado',
        RESUELTA: 'Solucionado'
    };
    const label = stateLabel[estado] || estado;
    
    let fechaStr = '';
    if (nov.fecha) {
        const d = parseDate(nov.fecha);
        if (d) fechaStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        else fechaStr = nov.fecha;
    }
    
    const descHtml = nov.descripcion ? `
        <div class="seg-desc">${String(nov.descripcion).substring(0, 200)}${nov.descripcion.length > 200 ? '...' : ''}</div>` : '';
    
    const safeId = id.replace(/'/g, "\\'");
    const safePlanta = (nov.planta || '').replace(/'/g, "\\'");
    const safeLote = String(nov.id || '').replace(/'/g, "\\'");
    const isArchived = String(nov.chat || '').startsWith('https://');
    const isFinalizado = estado === 'FINALIZADO' || estado === 'RESUELTA';
    const solucion = nov.comentarios || '';
    
    return `
        <div class="seg-card st-${estado} open" id="card-${id}">
            <div class="seg-card-header" onclick="toggleCard('${safeId}')">
                <div class="seg-state-dot"></div>
                <div class="seg-header-main">
                    <div class="seg-lote">
                        <i class="fas fa-barcode" style="color:#94a3b8;margin-right:5px;font-size:0.7rem;"></i>
                        OP ${nov.id || 'S/N'}
                        <span class="seg-area-badge">${nov.area || ''}</span>
                    </div>
                    <div class="seg-meta">${fechaStr}${nov.cantidad_solicitada ? ` · ${nov.cantidad_solicitada} UND` : ''}</div>
                </div>
                <i class="fas fa-chevron-down seg-chevron"></i>
            </div>
            <div class="seg-card-body">
                <div class="seg-card-body-inner">
                    <div class="seg-stepper">${buildStepperHtml(estado, nov.historial_estados, nov.fecha, safeId, safePlanta, safeLote, isArchived, solucion)}</div>
                    ${descHtml}
                    <div class="seg-card-footer">
                        <div class="seg-date-info">
                            <i class="fas fa-hashtag" style="margin-right:3px;"></i>${id || 'S/ID'}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

// ============================================================================
// 📈 CONSTRUIR STEPPER
// ============================================================================
function buildStepperHtml(estado, historialRaw, fechaCreacion, safeId, safePlanta, safeLote, isArchived, solucion) {
    const stateOrder = { PENDIENTE: 0, ELABORACION: 1, FINALIZADO: 2, RESUELTA: 2 };
    const currentIdx = stateOrder[estado] ?? 0;
    const historial = parseHistorial(historialRaw);
    const isFinalizado = estado === 'FINALIZADO' || estado === 'RESUELTA';
    
    const tsCreacion = fechaCreacion ? parseDate(fechaCreacion) : null;
    const tsElaboracion = historial['ELABORACION'] || null;
    const tsFinalizado = historial['FINALIZADO'] || historial['RESUELTA'] || null;
    
    const steps = [
        { icon: 'fa-file-alt', label: 'Reporte Recibido', desc: 'Tu novedad fue registrada en el sistema', ts: tsCreacion },
        { icon: 'fa-tools', label: 'En Elaboración', desc: 'El equipo está trabajando en la solución', ts: tsElaboracion },
        { icon: 'fa-check-circle', label: 'Solucionado', desc: 'La novedad ha sido resuelta', ts: tsFinalizado },
        { icon: 'fa-comments', label: 'Consultar', desc: '¿Tienes dudas? Escríbenos', ts: null, isChat: true }
    ];
    
    return steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const isFinal = (estado === 'FINALIZADO' || estado === 'RESUELTA') && idx === 2;
        const isChat = !!step.isChat;
        
        let dotClass = '';
        if (isDone) dotClass = 'done';
        else if (isFinal) dotClass = 'done-final';
        else if (isActive) dotClass = 'active';
        
        let labelClass = '';
        if (isDone || isFinal) labelClass = 'done';
        else if (isActive) labelClass = 'active';
        
        const showLine = idx < steps.length - 1;
        const lineClass = isDone ? 'done' : '';
        
        let durChipHtml = '';
        if (showLine && isDone && !isChat && !steps[idx + 1]?.isChat) {
            const tsNext = steps[idx + 1].ts;
            if (step.ts && tsNext) {
                const dur = formatDuracion(tsNext - step.ts);
                if (dur) durChipHtml = `<div class="seg-step-dur"><i class="fas fa-clock" style="font-size:0.48rem;"></i>${dur}</div>`;
            }
        }
        
        let totalChipHtml = '';
        if (isFinal && fechaCreacion) {
            const tsIni = parseDate(fechaCreacion);
            if (tsFinalizado && !isNaN(tsIni)) {
                const dur = formatDuracion(tsFinalizado - tsIni);
                if (dur) totalChipHtml = `
                    <div class="seg-step-connector-wrap" style="min-height:40px;">
                        <div class="seg-step-connector done" style="opacity:0.25;"></div>
                        <div class="seg-step-dur"><i class="fas fa-stopwatch" style="font-size:0.48rem;"></i>${dur}</div>
                    </div>`;
            }
        }
        
        let tsHtml = '';
        if (step.ts && (isDone || isFinal || isActive)) {
            tsHtml = `<div style="font-size:0.62rem;color:#80868b;margin-top:0;">
                ${step.ts.toLocaleDateString('es-CO', { day:'2-digit', month:'short' })}
                ${step.ts.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}
            </div>`;
        }
        
        let lineColContent = '';
        if (!isChat && showLine) {
            const chipEnConector = isFinal ? totalChipHtml : durChipHtml;
            lineColContent = `
                <div class="seg-step-connector-wrap">
                    <div class="seg-step-connector ${lineClass}"></div>
                    ${chipEnConector}
                </div>`;
        }
        
        return `
            <div class="seg-step">
                <div class="seg-step-line-col">
                    <div class="seg-step-dot ${dotClass}" ${isChat ? (isFinalizado
                        ? `style="background:#10b981;border-color:#10b981;color:white;box-shadow:0 4px 10px rgba(16,185,129,0.2);"`
                        : `id="chat-notify-dot" style="background:linear-gradient(135deg,#667eea,#764ba2);border-color:#667eea;color:white;cursor:pointer;" onclick="openChat('${safeId||''}','${safePlanta||''}','${safeLote||''}',${isArchived ? 'true' : 'false'})"`)
                        : ''}>
                        <i class="fas ${isFinalizado && isChat ? 'fa-lightbulb' : step.icon}"></i>
                    </div>
                    ${lineColContent}
                </div>
                <div class="seg-step-text" style="${isChat ? `display:flex;align-items:${isFinalizado ? 'flex-start' : 'center'};` : ''}">
                    ${isChat ? (isFinalizado ? `
                        <div style="flex:1;">
                            ${solucion
                                ? `<div style="
                                    margin-top:2px;
                                    font-size:0.8rem;
                                    color:#047857;
                                    background:#ecfdf5;
                                    border:1px solid #a7f3d0;
                                    border-left:4px solid #10b981;
                                    border-radius:10px;
                                    padding:10px 14px;
                                    line-height:1.55;
                                  ">${escapeHtml(solucion)}</div>`
                                : `<div class="seg-step-desc">La novedad fue resuelta por el equipo.</div>`
                            }
                        </div>
                    ` : `
                        <div>
                            <div id="chat-notify-label" class="seg-step-label" style="color:#667eea;cursor:pointer;" onclick="openChat('${safeId||''}','${safePlanta||''}','${safeLote||''}',${isArchived ? 'true' : 'false'})">Consultar</div>
                            <div class="seg-step-desc">¿Tienes dudas? Escríbenos</div>
                        </div>
                    `) : `
                    <div class="seg-step-label ${labelClass}">
                        ${step.label}
                        ${isActive && estado !== 'FINALIZADO' && estado !== 'RESUELTA' ? `<span style="margin-left:6px;background:#fef3c7;color:#d97706;font-size:0.58rem;font-weight:800;padding:1px 6px;border-radius:10px;">ACTUAL</span>` : ''}
                        ${isDone || isFinal ? `<i class="fas fa-check" style="margin-left:5px;font-size:0.6rem;color:#10b981;"></i>` : ''}
                    </div>
                    <div class="seg-step-desc">${step.desc}</div>
                    ${tsHtml}
                    `}
                </div>
            </div>`;
    }).join('');
}

// ============================================================================
// 📜 PARSEAR HISTORIAL
// ============================================================================
function parseHistorial(raw) {
    const map = {};
    if (!raw) return map;
    String(raw).split('|').forEach(entry => {
        const m = entry.match(/->(\w+)@(.+)/);
        if (m) {
            const d = new Date(m[2]);
            if (!isNaN(d)) map[m[1]] = d;
        }
    });
    return map;
}

// ============================================================================
// ⏱️ FORMATEAR DURACIÓN
// ============================================================================
function formatDuracion(ms) {
    if (!ms || ms <= 0) return null;
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
}

// ============================================================================
// 🔄 TOGGLE CARD
// ============================================================================
function toggleCard(id) {
    const card = document.getElementById('card-' + id);
    if (!card) return;
    const isOpen = card.classList.contains('open');
    if (isOpen) {
        card.classList.remove('open');
        _expandedIds.delete(id);
    } else {
        card.classList.add('open');
        _expandedIds.add(id);
    }
}

// ============================================================================
// 💬 ABRIR CHAT
// ============================================================================
function openChat(idNovedad, planta, lote, isArchived) {
    if (isArchived) {
        Swal.fire({
            icon: 'info',
            title: 'Chat Archivado',
            text: 'El chat de esta novedad ha sido archivado. Para consultas adicionales, por favor contacta directamente con el equipo.',
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    chatNovedadId = idNovedad;
    chatPlanta = planta;
    chatLote = lote;
    chatArchived = false;
    
    clearChatNotification();
    buildChatModal(lote, planta);
    startChatRealtime();
    loadChatMessages();
}

// ============================================================================
// 💬 CERRAR CHAT
// ============================================================================
function closeChat() {
    stopChatRealtime();
    const overlay = document.getElementById('chat-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0.97)';
        setTimeout(() => overlay.remove(), 200);
    }
    chatNovedadId = null;
    chatPlanta = null;
    chatLote = null;
}

// ============================================================================
// 💬 CONSTRUIR MODAL DE CHAT
// ============================================================================
function buildChatModal(lote, planta) {
    document.getElementById('chat-overlay')?.remove();

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
            <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:14px 16px;display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-comments" style="color:white;font-size:0.95rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.88rem;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Chat — Novedad ${chatNovedadId || 'S/N'}</div>
                    <div style="font-size:0.65rem;color:rgba(255,255,255,0.65);margin-top:1px;">${planta}</div>
                </div>
                <button onclick="closeChat()"
                    style="background:rgba(255,255,255,0.15);border:none;color:white;
                           width:30px;height:30px;border-radius:50%;cursor:pointer;
                           font-size:0.9rem;display:flex;align-items:center;justify-content:center;transition:background 0.2s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.28)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                    <i class="fas fa-times"></i>
                </button>
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
                    <button onclick="clearChatImage()" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#ef4444;border:none;color:white;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;padding:0;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="display:flex;gap:8px;align-items:flex-end;">
                    <button type="button" onclick="document.getElementById('chat-img-input').click()" title="Adjuntar imagen"
                        style="width:38px;height:38px;border-radius:50%;border:1.5px solid #e2e8f0;
                               background:white;color:#94a3b8;cursor:pointer;flex-shrink:0;
                               display:flex;align-items:center;justify-content:center;
                               font-size:0.85rem;transition:all 0.2s;"
                        onmouseover="this.style.borderColor='#667eea';this.style.color='#667eea'"
                        onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#94a3b8'">
                        <i class="fas fa-image"></i>
                    </button>
                    <input type="file" id="chat-img-input" accept="image/*" style="display:none;" onchange="chatImageSelected(this)">
                    <textarea id="chat-input" placeholder="Escribe un mensaje..." rows="1"
                        style="flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:9px 13px;font-size:0.875rem;resize:none;font-family:inherit;color:#1e293b;outline:none;transition:border 0.2s;max-height:100px;overflow-y:auto;line-height:1.4;"
                        onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitChatMsg();}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';"
                    ></textarea>
                    <button onclick="submitChatMsg()" id="chat-send-btn"
                        style="width:38px;height:38px;border-radius:50%;border:none;
                               background:linear-gradient(135deg,#667eea,#764ba2);color:white;cursor:pointer;
                               flex-shrink:0;display:flex;align-items:center;justify-content:center;
                               font-size:0.85rem;transition:all 0.2s;box-shadow:0 4px 12px rgba(102, 126, 234, 0.3);"
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

// ============================================================================
// 💬 REALTIME CHAT
// ============================================================================
function startChatRealtime() {
    if (chatChannel) {
        supabaseClient.removeChannel(chatChannel);
    }
    
    if (!chatNovedadId) return;
    
    chatChannel = supabaseClient
        .channel(`chat-room-${chatNovedadId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'chat',
            filter: `id_novedad=eq.${chatNovedadId}`
        }, payload => {
            console.log('[CHAT REALTIME] Cambio detectado:', payload);
            if (payload.eventType === 'INSERT') {
                const newMsg = payload.new;
                appendChatBubble(newMsg);
                scrollToBottom();
            }
        })
        .subscribe((status) => {
            console.log('[CHAT REALTIME] Status:', status);
            if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                setTimeout(startChatRealtime, 2000);
            }
        });
}

function stopChatRealtime() {
    if (chatChannel) {
        supabaseClient.removeChannel(chatChannel);
        chatChannel = null;
    }
}

// ============================================================================
// 💬 CARGAR MENSAJES
// ============================================================================
async function loadChatMessages() {
    if (!chatNovedadId) return;
    
    try {
        const resp = await fetch(`${FUNCTIONS_URL}/novedad-seguimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: JSON.stringify({ accion: 'GET_CHAT_MSGS', id_novedad: chatNovedadId }),
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);
        renderChatMessages(result.msgs || [], result.archived);
    } catch (e) {
        console.error('[CHAT] Error al cargar mensajes:', e);
    }
}

// ============================================================================
// 💬 RENDERIZAR MENSAJES
// ============================================================================
function renderChatMessages(msgs, archived = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    document.getElementById('chat-loading')?.remove();
    
    if (msgs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;"><i class="fas fa-comments" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.4;"></i><div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">Sin mensajes aún</div><div style="font-size:0.75rem;">Sé el primero en escribir.</div></div>`;
        return;
    }
    
    container.innerHTML = '';
    
    let lastDate = null;
    msgs.forEach(msg => {
        const msgDate = formatDateLabel(msg.ts);
        if (msgDate !== lastDate) {
            lastDate = msgDate;
            const sep = document.createElement('div');
            sep.style.cssText = 'text-align:center;font-size:0.65rem;font-weight:700;color:#94a3b8;margin:8px 0;position:relative;';
            sep.innerHTML = `<span style="background:#f8fafc;padding:0 10px;position:relative;z-index:1;">${msgDate}</span><div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#e2e8f0;z-index:0;"></div>`;
            container.appendChild(sep);
        }
        appendChatBubble(msg, false, container);
    });
    scrollToBottom();
}

// ============================================================================
// 💬 APPEND BUBBLE
// ============================================================================
function appendChatBubble(msg, scrollDown = true, container = null) {
    const c = container || document.getElementById('chat-messages');
    if (!c) return;
    
    const isGuest = msg.rol === 'GUEST';
    const bubbleBg = isGuest ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'white';
    const textColor = isGuest ? 'white' : '#1e293b';
    const metaColor = isGuest ? 'rgba(255,255,255,0.7)' : '#94a3b8';
    const align = isGuest ? 'flex-end' : 'flex-start';
    const borderRadius = isGuest ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
    
    const msgText = msg.mensaje || '';
    const imgUrl = msg.imagen_url;
    
    let contenidoHtml = '';
    if (imgUrl) {
        contenidoHtml += `
            <div style="margin-bottom:${msgText ? '8px' : '0'};">
                <a href="${imgUrl}" target="_blank">
                    <img src="${imgUrl}" alt="adjunto" loading="lazy"
                        style="max-width:220px;max-height:200px;border-radius:10px;display:block;object-fit:cover;border:1.5px solid rgba(0,0,0,0.05);">
                </a>
            </div>`;
    }
    if (msgText) {
        contenidoHtml += `<div style="font-size:0.875rem;color:${textColor};line-height:1.5;word-break:break-word;">${escapeHtml(msgText)}</div>`;
    }
    
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;flex-direction:column;align-items:${align};margin-bottom:12px;`;
    wrap.innerHTML = `
        ${!isGuest ? `<div style="font-size:0.65rem;font-weight:700;color:#64748b;margin-bottom:3px;padding:0 4px;">${msg.autor || 'Operador'}</div>` : ''}
        <div style="max-width:82%;padding:10px 14px;background:${bubbleBg};border-radius:${borderRadius};box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            ${contenidoHtml}
            <div style="font-size:0.6rem;color:${metaColor};margin-top:4px;text-align:right;">${formatTime(msg.ts)}</div>
        </div>`;
    
    c.appendChild(wrap);
    if (scrollDown) scrollToBottom();
}

// ============================================================================
// 💬 ENVIAR MENSAJE
// ============================================================================
async function submitChatMsg() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const texto = input.value.trim();
    
    if (!texto && !chatPendingImage) return;
    
    const btn = document.getElementById('chat-send-btn');
    if (btn) btn.disabled = true;
    
    const imagenData = chatPendingImage;
    const localPreviewUrl = imagenData ? `data:${imagenData.mimeType};base64,${imagenData.base64}` : null;
    
    input.value = '';
    input.style.height = 'auto';
    clearChatImage();
    
    // Preview optimista
    if (texto || localPreviewUrl) {
        appendChatBubble({
            id: 'temp_' + Date.now(),
            autor: chatPlanta || 'Tú',
            rol: 'GUEST',
            mensaje: texto,
            imagen_url: localPreviewUrl,
            ts: new Date().toISOString(),
            _localImg: localPreviewUrl
        }, true);
    }
    
    try {
        // Enviar a través de la Edge Function — nunca directo a Supabase
        const resp = await fetch(`${FUNCTIONS_URL}/novedad-seguimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: JSON.stringify({
                accion: 'SEND_CHAT_MSG',
                id_novedad: chatNovedadId,
                mensaje: texto,
                autor: chatPlanta || 'GUEST',
                imagen: imagenData || null,
            }),
        });

        const result = await resp.json();
        if (!result.success) throw new Error(result.message);
        
        await loadChatMessages();
        
    } catch (e) {
        console.error('[CHAT] Error al enviar:', e);
        Swal.fire({
            icon: 'error',
            title: 'Error de Envío',
            text: 'No se pudo enviar el mensaje. Intenta de nuevo.',
            confirmButtonColor: '#3b82f6'
        });
    } finally {
        if (btn) btn.disabled = false;
        input.focus();
    }
}

// ============================================================================
// 💬 SELECCIÓN DE IMAGEN
// ============================================================================
let chatPendingImage = null;

function chatImageSelected(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        chatPendingImage = {
            base64: e.target.result.split(',')[1],
            mimeType: file.type,
            fileName: file.name
        };
        showImagePreview();
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function showImagePreview() {
    const previewDiv = document.getElementById('chat-img-preview');
    if (!previewDiv) return;
    
    const img = document.getElementById('chat-img-preview-img');
    if (img && chatPendingImage) {
        img.src = `data:${chatPendingImage.mimeType};base64,${chatPendingImage.base64}`;
        previewDiv.style.display = 'block';
    }
}

function clearChatImage() {
    chatPendingImage = null;
    const previewDiv = document.getElementById('chat-img-preview');
    if (previewDiv) previewDiv.style.display = 'none';
}

// ============================================================================
// 💬 UTILIDADES
// ============================================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) {
        return 'Hoy';
    } else if (d.toDateString() === yesterday.toDateString()) {
        return 'Ayer';
    } else {
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

// ============================================================================
// 🔄 ACTUALIZAR NOVEDAD
// ============================================================================
function refreshNovedad() {
    const btn = document.getElementById('refresh-btn');
    if (btn) {
        btn.disabled = true;
        const icon = btn.querySelector('i');
        if (icon) icon.style.animation = 'spin 0.8s linear infinite';
    }
    loadNovedad().finally(() => {
        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                const icon = btn.querySelector('i');
                if (icon) icon.style.animation = '';
            }
        }, 500);
    });
}



// ============================================================================
// 🔔 NOTIFICACIÓN DE CHAT — Animar botón "Consultar" al recibir mensaje nuevo
// ============================================================================
let _chatNotifChannel = null;
let _unreadChatCount  = 0;

function activateChatNotification() {
    _unreadChatCount++;

    const dot   = document.getElementById('chat-notify-dot');
    const label = document.getElementById('chat-notify-label');
    if (!dot || !label) return;

    // Dot: cambiar a rojo pulsante
    dot.classList.add('has-new-msg');

    // Label: animación de color + badge con contador
    label.classList.add('has-new-msg');
    label.innerHTML = `Consultar <span class="chat-notify-badge">${_unreadChatCount}</span>`;
}

function clearChatNotification() {
    _unreadChatCount = 0;

    const dot   = document.getElementById('chat-notify-dot');
    const label = document.getElementById('chat-notify-label');
    if (!dot || !label) return;

    dot.classList.remove('has-new-msg');
    label.classList.remove('has-new-msg');
    label.textContent = 'Consultar';
}

function setupChatNotifRealtime(idNovedad) {
    if (_chatNotifChannel) {
        supabaseClient.removeChannel(_chatNotifChannel);
    }

    // Escucha inserts en chat para esta novedad.
    // Solo activa la notificación si el mensaje NO es del propio GUEST
    // (es decir, viene del operador/admin).
    _chatNotifChannel = supabaseClient
        .channel(`chat-notif-${idNovedad}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat',
            filter: `id_novedad=eq.${idNovedad}`,
        }, (payload) => {
            const msg = payload.new;
            // Ignorar mensajes propios del GUEST
            if (msg?.rol === 'GUEST') return;

            console.log('[CHAT NOTIF] Nuevo mensaje del operador:', msg);

            // Si el chat está abierto, solo recargar mensajes sin animar
            const chatOverlay = document.getElementById('chat-overlay');
            if (chatOverlay) {
                appendChatBubble(msg);
                scrollToBottom();
            } else {
                activateChatNotification();
            }
        })
        .subscribe((status) => {
            console.log('[CHAT NOTIF] Realtime status:', status);
        });
}

// ============================================================================
// 📡 SETUP REALTIME
// ============================================================================
function setupRealtime(idNovedad) {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }
    
    realtimeChannel = supabaseClient
        .channel('novedad-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'novedades',
                filter: `id_novedad=eq.${idNovedad}`
            },
            (payload) => {
                console.log('[REALTIME] Cambio detectado:', payload);
                if (payload.new) {
                    currentNovedad = payload.new;
                    renderNovedad(payload.new);
                }
            }
        )
        .subscribe();
}

// ============================================================================
// ❌ MOSTRAR ERROR
// ============================================================================
function showError(message) {
    const container = document.getElementById('tracking-container');
    container.innerHTML = `
        <div class="seg-state-box">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="title">Error</div>
            <div class="sub">${message}</div>
        </div>`;
}

// ============================================================================
// 🚀 INICIALIZACIÓN
// ============================================================================
window.onload = async function() {
    await loadNovedad();
    
    // Cleanup al cerrar página
    window.addEventListener('beforeunload', () => {
        if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
        if (_chatNotifChannel) supabaseClient.removeChannel(_chatNotifChannel);
    });
};
