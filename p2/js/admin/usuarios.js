/* ==========================================================================
   admin/usuarios.js — Módulo Standalone de Gestión de Usuarios y Plantas
   ========================================================================== */

let gsUserList = [];
let gsPlantList = [];
let gsCurrentMode = 'USERS'; // 'USERS' o 'PLANTS'
let gsCurrentPage = 1;
const gsRecordsPerPage = 4;

window.onload = async function() {
    // 1. Validar sesión ADMIN antes de mostrar el panel
    await loadUsers();


    
    initTabs();
    cargarDatosLocales();
};

function initTabs() {
    // Los tabs ya están en el HTML, solo actualizamos el placeholder inicial
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) searchInput.placeholder = 'Filtrar empleados por nombre, ID o correo...';
}

function switchAdminMode(mode) {
    gsCurrentMode = mode;
    gsCurrentPage = 1;

    document.getElementById('tab-users').classList.toggle('active', mode === 'USERS');
    document.getElementById('tab-plants').classList.toggle('active', mode === 'PLANTS');

    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.placeholder = mode === 'USERS'
            ? 'Filtrar empleados por nombre, ID o correo...'
            : 'Filtrar plantas por nombre, NIT o ciudad...';
        searchInput.value = '';
    }

    cargarDatosLocales();
}

function cargarDatosLocales() {
    const loader = document.getElementById('loader');
    const dataSection = document.getElementById('dataSection');
    if (!loader || !dataSection) return;

    try {
        gsUserList = (typeof allUsers !== 'undefined') ? allUsers : [];
        gsPlantList = (typeof allPlantas !== 'undefined') ? allPlantas : [];

        updateStats();
        handleFilter();

        loader.style.display = 'none';
        dataSection.style.display = 'block';
    } catch (error) {
        // Error al cargar datos
    }
}

function updateStats() {
    const stats = { pending: 0, total: 0, completed: 0 };
    
    if (gsCurrentMode === 'USERS') {
        gsUserList.forEach(u => {
            if (u.ROL === 'PENDIENTE') stats.pending++;
            stats.total++;
        });
    } else {
        gsPlantList.forEach(p => {
            stats.total++;
            
            // VALIDACIÓN ESTRICTA (Basada en campos 'required' del formulario):
            const hasPlanta   = String(p.PLANTA || '').trim() !== '';
            const hasDir      = String(p.DIRECCION || '').trim() !== '';
            const hasTel      = String(p.TELEFONO || '').trim() !== '';
            const hasEmail    = String(p.EMAIL || p.CORREO || '').trim() !== '';
            const hasDept     = String(p.DEPARTAMENTO || '').trim() !== '';
            const hasCiudad   = String(p.CIUDAD || '').trim() !== '';
            const hasBarrio   = String(p.BARRIO || '').trim() !== '';
            
            // Una planta está diligenciada solo si tiene TODOS los obligatorios
            if (hasPlanta && hasDir && hasTel && hasEmail && hasDept && hasCiudad && hasBarrio) {
                stats.completed++;
            }
        });
    }

    const pendingEl = document.getElementById('stat-pending');
    const activeEl = document.getElementById('stat-active');
    
    if (pendingEl) pendingEl.textContent = gsCurrentMode === 'USERS' ? stats.pending : stats.completed;
    if (activeEl) activeEl.textContent = stats.total;

    const pendingLab = document.getElementById('stat-label-pending');
    const totalLab = document.getElementById('stat-label-active');
    if (pendingLab) pendingLab.textContent = gsCurrentMode === 'USERS' ? 'Pendientes' : 'Diligenciadas';
    if (totalLab) totalLab.textContent = gsCurrentMode === 'USERS' ? 'Total' : 'Total';
}

function renderTable(dataToRender) {
    const tbody = document.getElementById('userTableBody');
    const pagContainer = document.getElementById('paginationUsers');
    if (!tbody) return;

    if (pagContainer) pagContainer.innerHTML = '';

    if (!dataToRender || dataToRender.length === 0) {
        tbody.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem; color:#94a3b8; font-weight:600;">
                <div style="font-size:2rem; margin-bottom:12px;">🔍</div>
                No se encontraron registros.
            </div>`;
        return;
    }

    const totalRecords = dataToRender.length;
    const sliceStart = (gsCurrentPage - 1) * gsRecordsPerPage;
    const sliceEnd = sliceStart + gsRecordsPerPage;
    const paginatedData = dataToRender.slice(sliceStart, sliceEnd);

    if (totalRecords > gsRecordsPerPage) {
        renderPaginacion(totalRecords, dataToRender);
    }

    const ROL_META = {
        'ADMIN':          { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'fa-user-shield'     },
        'MODERATOR':      { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'fa-user-tie'       },
        'USER-P':         { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: 'fa-industry'       },
        'USER-C':         { color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', icon: 'fa-magnifying-glass' },
        'GUEST':          { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'fa-user-secret'    },
        'PENDIENTE':      { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'fa-user-clock'      },
        'DESHABILITADO':  { color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1', icon: 'fa-user-slash'      },
    };

    const currentId = (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser.ID_USUARIO || currentUser.ID_PLANTA || currentUser.ID || '').trim() : null;

    tbody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        ${paginatedData.map(item => {
            const isPlant = gsCurrentMode === 'PLANTS';
            const id = isPlant ? (item.ID_PLANTA || item.ID) : (item.ID_USUARIO || item.ID);
            const name = isPlant ? item.PLANTA : item.USUARIO;
            const email = item.EMAIL || item.CORREO;
            const rol = item.ROL || 'GUEST';
            const meta = ROL_META[rol] || ROL_META['GUEST'];
            const initial = String(name || '?').charAt(0).toUpperCase();
            const isSelf = currentId === String(id).trim();
            const canEdit = !isPlant ? (rol !== 'ADMIN' || isSelf) : true;

            return `
            <div class="admin-card-lux" style="background:#fff; border:1px solid ${rol === 'DESHABILITADO' ? '#fecaca' : '#f1f5f9'}; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); overflow:hidden; display:flex; flex-direction:column;">
                <div style="background:${rol === 'DESHABILITADO' ? 'linear-gradient(135deg,#fff5f5 0%,#fee2e2 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'}; padding:16px; display:flex; align-items:center; gap:12px; border-bottom:1px solid ${rol === 'DESHABILITADO' ? '#fecaca' : '#f1f5f9'};">
                    <div style="width:44px; height:44px; border-radius:50%; background:${meta.bg}; border:2px solid ${meta.border}; display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:${meta.color}; flex-shrink:0;">
                        <i class="fas ${isPlant ? 'fa-user-secret' : meta.icon}"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:800; font-size:0.88rem; color:#0f172a; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                        <div style="font-family:'JetBrains Mono', monospace; font-size:0.65rem; color:#94a3b8; font-weight:600;"># ${id}</div>
                    </div>
                    <span style="background:${meta.bg}; color:${meta.color}; border:1px solid ${meta.border}; padding:3px 9px; border-radius:20px; font-size:0.6rem; font-weight:800; text-transform:uppercase;">
                        ${rol}
                    </span>
                </div>
                <div style="padding:16px; flex:1; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        ${email ? `<a href="mailto:${email}" title="Enviar correo" style="color:#94a3b8;flex-shrink:0;"><i class="fas fa-envelope"></i></a>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${email}</span>` : `<i class="fas fa-envelope" style="width:16px; color:#e2e8f0;"></i><span style="color:#cbd5e1;">—</span>`}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        ${item.TELEFONO ? `<a href="tel:+57${item.TELEFONO.replace(/\D/g,'')}" title="Llamar" style="color:#94a3b8;flex-shrink:0;"><i class="fas fa-phone"></i></a>
                        <span>${item.TELEFONO}</span>` : `<i class="fas fa-phone" style="width:16px; color:#e2e8f0;"></i><span style="color:#cbd5e1;">—</span>`}
                    </div>
                    ${isPlant ? `
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        <i class="fas fa-location-dot" style="width:16px; color:#94a3b8;"></i>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${item.DIRECCION || '—'}</span>
                    </div>` : ''}
                </div>
                <div style="padding:12px 16px; border-top:1px solid #f8fafc; background:#fafbfc; display:flex; gap:8px;">
                    ${canEdit ? `
                    <button onclick="openEditModal('${id}')" style="flex:1; padding:8px; background:linear-gradient(135deg, #3b82f6, #6366f1); color:#fff; border:none; border-radius:10px; font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fas ${isPlant ? 'fa-building-user' : 'fa-user-pen'}"></i> Editar
                    </button>
                    ` : '<div style="text-align:center; font-size:0.7rem; color:#94a3b8; font-weight:700; width:100%;"><i class="fas fa-lock"></i> Protegido</div>'}
                </div>
            </div>`;
        }).join('')}
        </div>
    `;
}

function renderPaginacion(totalRecords, dataRef) {
    const pagContainer = document.getElementById('paginationUsers');
    if (!pagContainer) return;

    const totalPages = Math.ceil(totalRecords / gsRecordsPerPage);
    if (totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.className = 'pagination-container-lux';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'page-btn-lux';
    btnPrev.disabled = gsCurrentPage === 1;
    btnPrev.innerHTML = `<i class="fas fa-chevron-left"></i> Anterior`;
    btnPrev.onclick = () => { gsCurrentPage--; renderTable(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnPrev);

    const info = document.createElement('span');
    info.className = 'page-info-lux';
    info.textContent = `Página ${gsCurrentPage} de ${totalPages}`;
    nav.appendChild(info);

    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn-lux';
    btnNext.disabled = gsCurrentPage === totalPages;
    btnNext.innerHTML = `Siguiente <i class="fas fa-chevron-right"></i>`;
    btnNext.onclick = () => { gsCurrentPage++; renderTable(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnNext);

    pagContainer.appendChild(nav);
}

function handleFilter() {
    gsCurrentPage = 1;
    const term = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    const dataList = gsCurrentMode === 'USERS' ? gsUserList : gsPlantList;
    
    const filtered = dataList.filter(item => {
        if (!term) return true;
        const name = (gsCurrentMode === 'USERS' ? item.USUARIO : item.PLANTA) || '';
        const id = (gsCurrentMode === 'USERS' ? (item.ID_USUARIO || item.ID) : (item.ID_PLANTA || item.ID)) || '';
        const email = (gsCurrentMode === 'USERS' ? item.CORREO : item.EMAIL) || '';
        return name.toLowerCase().includes(term) || 
               id.toString().toLowerCase().includes(term) || 
               email.toLowerCase().includes(term);
    });

    renderTable(filtered);
}

// Compatibilidad con llamadas desde HTML
const handleUserFilter = handleFilter;

async function openEditModal(targetId) {
    const isPlant = gsCurrentMode === 'PLANTS';
    
    // Si es una planta, abrir en nueva ventana
    if (isPlant) {
        window.location.href = `gestion-planta.html?id=${targetId}`;
        return;
    }
    
    // Para usuarios, continuar con el modal actual
    const dataList = gsUserList;
    
    const entry = dataList.find(item => {
        const dbId = item.ID_USUARIO || item.ID;
        return String(dbId).trim() === String(targetId).trim();
    });
    
    if (!entry) return;

    const name = isPlant ? entry.PLANTA : entry.USUARIO;
    const email = isPlant ? entry.EMAIL : entry.CORREO;

    const html = `
        <style>
            /* Override SweetAlert2 para bordes y padding */
            .swal2-popup { border-radius: 16px !important; padding: 0 !important; overflow: hidden !important; }
            .swal2-html-container { margin: 0 !important; padding: 0 !important; overflow: visible !important; width: 100% !important; max-width: 100% !important; }
            .swal2-actions { padding: 12px 20px 20px !important; gap: 8px !important; margin: 0 !important; }
            .swal2-confirm { border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 700 !important; letter-spacing: 0.04em !important; padding: 10px 22px !important; box-shadow: none !important; }
            .swal2-cancel { border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 600 !important; padding: 10px 22px !important; background: #f1f5f9 !important; color: #64748b !important; box-shadow: none !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; }
            .swal2-cancel:hover { background: #e2e8f0 !important; }
            .edit-modal-lux { font-family: 'Inter', sans-serif; text-align: left; }
            .modal-header-lux { display: flex; align-items: center; gap: 12px; background: white; padding: 18px 20px 14px; margin: 0; width: 100%; box-sizing: border-box; border-bottom: 1.5px solid #f1f5f9; border-radius: 16px 16px 0 0; }
            .modal-header-lux .header-icon { width: 40px; height: 40px; background: #eef0fb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3f51b5; font-size: 1rem; flex-shrink: 0; }
            .modal-header-lux .header-text { color: #3f51b5; font-weight: 800; font-size: 1rem; line-height: 1.2; }
            .modal-header-lux .header-sub { color: #94a3b8; font-size: 0.72rem; font-weight: 500; margin-top: 2px; }
            .modal-body-lux { padding: 16px 20px 4px; }
            .fields-section { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
            .fields-section-title { font-size: 0.63rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
            .field-container-lux { margin-bottom: 10px; }
            .label-lux { display: flex; align-items: center; gap: 5px; font-size: 0.67rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .label-lux i { font-size: 0.63rem; }
            .input-lux { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #e2e8f0 !important; background: white !important; font-size: 0.875rem; font-weight: 500; color: #1e293b !important; box-sizing: border-box; box-shadow: none !important; transition: border-color 0.15s; }
            .input-lux:focus { outline: none !important; border-color: #3b82f6 !important; background: white !important; box-shadow: none !important; }
            .input-lux:disabled { background: #f1f5f9 !important; color: #94a3b8 !important; cursor: not-allowed; }
            select.input-lux { background: white !important; color: #1e293b !important; cursor: pointer; appearance: none; -webkit-appearance: none; }
            input[type="email"].input-lux { text-transform: lowercase; }
            .input-icon-wrap { position: relative; }
            .input-icon-wrap .input-lux { padding-right: 38px; }
            .input-icon-wrap select.input-lux { appearance: none; -webkit-appearance: none; }
            .input-icon-btn { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #cbd5e1; font-size: 0.88rem; padding: 2px 4px; transition: color 0.2s; }
            .input-icon-btn:hover { color: #3b82f6; }
            .input-icon-btn.unlocked { color: #3b82f6; }
        </style>

        <div class="edit-modal-lux">
            <div class="modal-header-lux">
                <div class="header-icon"><i class="fas ${isPlant ? 'fa-industry' : 'fa-user-gear'}"></i></div>
                <div>
                    <div class="header-text">${isPlant ? 'Gestión de Planta' : 'Gestión de Perfil'}</div>
                    <div class="header-sub">${isPlant ? 'Editar datos de la planta' : 'Editar datos del usuario'}</div>
                </div>
            </div>
            <div class="modal-body-lux">
            <div class="fields-section">
                <div class="fields-section-title"><i class="fas fa-circle-info"></i> Identificación</div>

                <div class="field-container-lux">
                    <label class="label-lux"><i class="fas fa-id-card"></i> ${isPlant ? 'NIT / ID Planta' : 'Cédula / ID'}</label>
                    <div class="input-icon-wrap">
                        <input type="text" id="edit-id" class="input-lux" value="${targetId}" disabled>
                        <button type="button" class="input-icon-btn" id="btn-lock-id" title="Desbloquear edición de ID" onclick="
                            const inp = document.getElementById('edit-id');
                            const btn = document.getElementById('btn-lock-id');
                            const locked = inp.disabled;
                            inp.disabled = !locked;
                            btn.innerHTML = locked ? '<i class=\\'fas fa-lock-open\\'></i>' : '<i class=\\'fas fa-lock\\'></i>';
                            btn.classList.toggle('unlocked', locked);
                            if (!locked) inp.focus();
                        "><i class="fas fa-lock"></i></button>
                    </div>
                </div>

                <div class="field-container-lux" style="margin-bottom:0">
                    <label class="label-lux"><i class="fas fa-signature"></i> ${isPlant ? 'Nombre Planta' : 'Nombre Completo'}</label>
                    ${isPlant ? `
                    <div class="input-icon-wrap">
                        <input type="text" id="edit-nombre" class="input-lux" value="${name || ''}" disabled>
                        <button type="button" class="input-icon-btn" id="btn-lock-nombre" title="Desbloquear edición de nombre" onclick="
                            const inp = document.getElementById('edit-nombre');
                            const btn = document.getElementById('btn-lock-nombre');
                            const locked = inp.disabled;
                            inp.disabled = !locked;
                            btn.innerHTML = locked ? '<i class=\\'fas fa-lock-open\\'></i>' : '<i class=\\'fas fa-lock\\'></i>';
                            btn.classList.toggle('unlocked', locked);
                            if (!locked) inp.focus();
                        "><i class="fas fa-lock"></i></button>
                    </div>
                    ` : `<input type="text" id="edit-nombre" class="input-lux" value="${name || ''}">`}
                </div>
            </div>

            <div class="fields-section">
                <div class="fields-section-title"><i class="fas fa-address-book"></i> Contacto</div>

                <div class="field-container-lux">
                    <label class="label-lux"><i class="fas fa-envelope"></i> Correo</label>
                    <input type="email" id="edit-correo" class="input-lux" value="${email || ''}">
                </div>

                <div class="field-container-lux" style="margin-bottom:0">
                    <label class="label-lux"><i class="fas fa-phone"></i> Teléfono</label>
                    <div class="phone-input-integrated" id="phone-wrap" style="border-radius:8px; border:1.5px solid #e2e8f0; background:#f8fafc; transition: border-color 0.15s;">
                        <div class="phone-prefix-area" style="height:38px; background:transparent;">
                            <img src="https://flagcdn.com/w20/co.png" width="20" style="border-radius:2px;">
                            <span class="phone-prefix-text">+57</span>
                        </div>
                        <input type="tel" id="edit-telefono" class="input-lux"
                            value="${(() => { const d=String(entry.TELEFONO||'').replace(/\D/g,'').slice(0,10); if(d.length===10) return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6); if(d.length>6) return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6); if(d.length>3) return '('+d.slice(0,3)+') '+d.slice(3); return d; })()}"
                            style="border:none !important; outline:none !important; box-shadow:none !important; height:38px !important; flex:1; background:transparent !important;"
                            placeholder="">
                    </div>
                </div>

                ${isPlant ? `
                <div class="field-container-lux" style="margin-top:14px; margin-bottom:0">
                    <label class="label-lux"><i class="fas fa-location-dot"></i> Dirección</label>
                    <input type="text" id="edit-direccion" class="input-lux" value="${entry.DIRECCION || ''}">
                </div>` : ''}
            </div>

            <div class="fields-section" style="margin-bottom:0">
                <div class="fields-section-title"><i class="fas fa-shield-halved"></i> Acceso</div>

                <div class="field-container-lux">
                    <label class="label-lux"><i class="fas fa-shield-halved"></i> Rol</label>
                    ${isPlant ? `
                    <div class="input-icon-wrap">
                        <input type="text" class="input-lux" value="${entry.ROL === 'DESHABILITADO' ? 'DESHABILITADO' : 'GUEST'}" disabled id="edit-rol-display">
                        <input type="hidden" id="edit-rol" value="${entry.ROL === 'DESHABILITADO' ? 'DESHABILITADO' : 'GUEST'}">
                        <button type="button" class="input-icon-btn" id="btn-toggle-status" title="${entry.ROL === 'DESHABILITADO' ? 'Habilitar cuenta' : 'Deshabilitar cuenta'}" onclick="
                            const hidden = document.getElementById('edit-rol');
                            const display = document.getElementById('edit-rol-display');
                            const btn = document.getElementById('btn-toggle-status');
                            const isDisabled = hidden.value === 'DESHABILITADO';
                            hidden.value = isDisabled ? 'GUEST' : 'DESHABILITADO';
                            display.value = isDisabled ? 'GUEST' : 'DESHABILITADO';
                            btn.innerHTML = isDisabled ? '<i class=\\'fas fa-user-slash\\'></i>' : '<i class=\\'fas fa-user-check\\'></i>';
                            btn.classList.toggle('unlocked', !isDisabled);
                        "><i class="fas ${entry.ROL === 'DESHABILITADO' ? 'fa-user-check' : 'fa-user-slash'}"></i></button>
                    </div>
                    ` : `
                    <div class="input-icon-wrap">
                        <select id="edit-rol" class="input-lux">
                            <option value="ADMIN" ${entry.ROL === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                            <option value="MODERATOR" ${entry.ROL === 'MODERATOR' ? 'selected' : ''}>MODERATOR</option>
                            <option value="USER-P" ${entry.ROL === 'USER-P' ? 'selected' : ''}>USER-P</option>
                            <option value="USER-C" ${entry.ROL === 'USER-C' ? 'selected' : ''}>USER-C</option>
                            <option value="GUEST" ${entry.ROL === 'GUEST' ? 'selected' : ''}>GUEST</option>
                            <option value="PENDIENTE" ${entry.ROL === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                            <option value="DESHABILITADO" ${entry.ROL === 'DESHABILITADO' ? 'selected' : ''}>DESHABILITADO</option>
                        </select>
                        <button type="button" class="input-icon-btn" id="btn-toggle-status-user"
                            title="${entry.ROL === 'DESHABILITADO' ? 'Habilitar cuenta' : 'Deshabilitar cuenta'}"
                            data-prev-rol="${entry.ROL !== 'DESHABILITADO' ? entry.ROL : 'GUEST'}"
                            onclick="
                                const sel = document.getElementById('edit-rol');
                                const btn = document.getElementById('btn-toggle-status-user');
                                const isDisabled = sel.value === 'DESHABILITADO';
                                if (isDisabled) {
                                    sel.value = btn.dataset.prevRol || 'GUEST';
                                } else {
                                    btn.dataset.prevRol = sel.value;
                                    sel.value = 'DESHABILITADO';
                                }
                                btn.innerHTML = sel.value === 'DESHABILITADO'
                                    ? '<i class=\\'fas fa-user-check\\'></i>'
                                    : '<i class=\\'fas fa-user-slash\\'></i>';
                                btn.classList.toggle('unlocked', sel.value === 'DESHABILITADO');
                            "><i class="fas ${entry.ROL === 'DESHABILITADO' ? 'fa-user-check' : 'fa-user-slash'}"></i></button>
                    </div>
                    `}
                </div>

                <div class="field-container-lux" style="margin-bottom:0">
                    <label class="label-lux"><i class="fas fa-key"></i> Contraseña</label>
                    <div class="input-icon-wrap">
                        <input type="password" id="edit-password" class="input-lux" value="${entry.PASSWORD || entry.CONTRASEÑA || ''}" placeholder="Contraseña actual">
                        <button type="button" class="input-icon-btn" id="btn-eye-pass" title="Mostrar/ocultar contraseña" onclick="
                            const inp = document.getElementById('edit-password');
                            const btn = document.getElementById('btn-eye-pass');
                            const show = inp.type === 'password';
                            inp.type = show ? 'text' : 'password';
                            btn.innerHTML = show ? '<i class=\\'fas fa-eye-slash\\'></i>' : '<i class=\\'fas fa-eye\\'></i>';
                            btn.classList.toggle('unlocked', show);
                        "><i class="fas fa-eye"></i></button>
                    </div>
                </div>
            </div>
            </div><!-- /modal-body-lux -->
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: 'GUARDAR CAMBIOS',
        confirmButtonColor: '#3F51B5',
        width: '380px',
        customClass: {
            popup: 'edit-modal-popup'
        },
        didOpen: () => {
            // Quitar padding del container de SweetAlert2
            const container = document.querySelector('.swal2-container');
            if (container) container.style.padding = '0';
            const popup = document.querySelector('.edit-modal-popup');
            if (popup) { popup.style.margin = '0'; }

            const tel = document.getElementById('edit-telefono');
            const wrap = document.getElementById('phone-wrap');
            const idInp = document.getElementById('edit-id');

            // Máscara visual de miles para el ID (solo visual, guarda dígitos limpios)
            if (idInp) {
                function formatMiles(val) {
                    const digits = val.replace(/\D/g, '');
                    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                }
                // Aplicar al valor inicial
                idInp.value = formatMiles(idInp.value);

                idInp.addEventListener('keydown', (e) => {
                    if (e.ctrlKey || e.metaKey) return;
                    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
                    if (allowed.includes(e.key)) return;
                    if (!/^\d$/.test(e.key)) e.preventDefault();
                });
                idInp.addEventListener('input', () => {
                    const pos = idInp.selectionStart;
                    const prev = idInp.value;
                    const formatted = formatMiles(idInp.value);
                    idInp.value = formatted;
                    // Ajustar cursor: compensar puntos añadidos
                    const diff = formatted.length - prev.length;
                    idInp.setSelectionRange(pos + diff, pos + diff);
                });
            }

            if (!tel) return;

            // Forzar minúsculas en correo
            const correoInp = document.getElementById('edit-correo');
            if (correoInp) {
                correoInp.addEventListener('input', () => {
                    const pos = correoInp.selectionStart;
                    correoInp.value = correoInp.value.toLowerCase();
                    correoInp.setSelectionRange(pos, pos);
                });
            }

            // Focus azul en el contenedor
            tel.addEventListener('focus', () => {
                if (wrap) wrap.style.borderColor = '#3b82f6';
            });
            tel.addEventListener('blur', () => {
                if (wrap) wrap.style.borderColor = '#e2e8f0';
            });

            function applyMask(digits) {
                digits = digits.replace(/\D/g, '').slice(0, 10);
                if (digits.length === 0) return '';
                if (digits.length <= 3) return '(' + digits;
                if (digits.length <= 6) return '(' + digits.slice(0,3) + ') ' + digits.slice(3);
                return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6);
            }

            // Aplicar máscara al valor inicial
            const initial = tel.value.replace(/\D/g, '').slice(0, 10);
            tel.value = applyMask(initial);

            tel.addEventListener('keydown', (e) => {
                // Permitir teclas de control
                if (e.ctrlKey || e.metaKey) return;
                const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
                if (allowed.includes(e.key)) return;
                // Bloquear cualquier tecla que no sea dígito
                if (!/^\d$/.test(e.key)) e.preventDefault();
            });

            tel.addEventListener('input', () => {
                const digits = tel.value.replace(/\D/g, '').slice(0, 10);
                const masked = applyMask(digits);
                // Preservar posición del cursor
                const selStart = tel.selectionStart;
                tel.value = masked;
                // Reposicionar cursor al final de los dígitos ingresados
                const newPos = masked.length;
                tel.setSelectionRange(newPos, newPos);
            });
        },
        preConfirm: () => {
            return {
                nuevoId: document.getElementById('edit-id').value.replace(/\./g, '').trim(),
                nombre: document.getElementById('edit-nombre').value.trim(),
                correo: document.getElementById('edit-correo').value.trim(),
                telefono: document.getElementById('edit-telefono').value.replace(/\D/g,'').slice(0,10),
                direccion: isPlant ? document.getElementById('edit-direccion').value.trim() : null,
                rol: document.getElementById('edit-rol').value,
                password: document.getElementById('edit-password').value.trim()
            };
        }
    });

    if (formValues) {
        try {
            Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
            
            const payload = {
                accion: isPlant ? 'ACTUALIZAR_PLANTA' : 'UPDATE_USER',
                id: targetId,
                cedula: targetId,
                nuevoId: formValues.nuevoId !== String(targetId) ? formValues.nuevoId : null,
                nombrePlanta: isPlant ? formValues.nombre : null,
                usuario: !isPlant ? formValues.nombre : null,
                correo: formValues.correo,
                email: isPlant ? formValues.correo : null,
                telefono: formValues.telefono,
                direccion: formValues.direccion,
                rol: formValues.rol,
                password: formValues.password
            };

            const response = await sendToGAS(payload);

            if (response.success) {
                Swal.fire('✔ ¡Hecho!', 'Datos actualizados correctamente.', 'success');
                await loadUsers(); 
                cargarDatosLocales();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
        }
    }
}

/**
 * Habilita o deshabilita un usuario/planta.
 * Si está DESHABILITADO → restaura al rol anterior guardado, o GUEST para plantas.
 * Si está activo → cambia a DESHABILITADO.
 */
async function openCreateModal() {
    const isPlant = gsCurrentMode === 'PLANTS';
    
    // Si es una planta, abrir en nueva ventana
    if (isPlant) {
        window.location.href = 'gestion-planta.html';
        return;
    }
    
    // Para usuarios, continuar con el modal actual
    const html = `
        <style>
            .swal2-popup { border-radius: 16px !important; padding: 0 !important; overflow: hidden !important; }
            .swal2-html-container { margin: 0 !important; padding: 0 !important; overflow: visible !important; width: 100% !important; max-width: 100% !important; }
            .swal2-actions { padding: 12px 20px 20px !important; gap: 8px !important; margin: 0 !important; }
            .swal2-confirm { border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 700 !important; letter-spacing: 0.04em !important; padding: 10px 22px !important; box-shadow: none !important; }
            .swal2-cancel { border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 600 !important; padding: 10px 22px !important; background: #f1f5f9 !important; color: #64748b !important; box-shadow: none !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; }
            .edit-modal-lux { font-family: 'Inter', sans-serif; text-align: left; }
            .modal-header-lux { display: flex; align-items: center; gap: 12px; background: white; padding: 18px 20px 14px; margin: 0; width: 100%; box-sizing: border-box; border-bottom: 1.5px solid #f1f5f9; border-radius: 16px 16px 0 0; }
            .modal-header-lux .header-icon { width: 40px; height: 40px; background: #eef0fb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3f51b5; font-size: 1rem; flex-shrink: 0; }
            .modal-header-lux .header-text { color: #3f51b5; font-weight: 800; font-size: 1rem; line-height: 1.2; }
            .modal-header-lux .header-sub { color: #94a3b8; font-size: 0.72rem; font-weight: 500; margin-top: 2px; }
            .modal-body-lux { padding: 16px 20px 4px; }
            .fields-section { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
            .fields-section-title { font-size: 0.63rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
            .field-container-lux { margin-bottom: 10px; }
            .label-lux { display: flex; align-items: center; gap: 5px; font-size: 0.67rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .input-lux { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #e2e8f0 !important; background: white !important; font-size: 0.875rem; font-weight: 500; color: #1e293b !important; box-sizing: border-box; }
            .input-lux:focus { outline: none !important; border-color: #3b82f6 !important; }
            .phone-input-integrated { display: flex; align-items: center; padding-left: 12px; background: white; }
            .phone-prefix-area { display: flex; align-items: center; gap: 4px; padding-right: 8px; border-right: 1px solid #e2e8f0; margin-right: 8px; font-size: 0.8rem; font-weight: 600; color: #64748b; }
        </style>

        <div class="edit-modal-lux">
            <div class="modal-header-lux">
                <div class="header-icon"><i class="fas ${isPlant ? 'fa-industry' : 'fa-user-plus'}"></i></div>
                <div>
                    <div class="header-text">Nuevo ${isPlant ? 'Taller' : 'Usuario'}</div>
                    <div class="header-sub">Complete los datos para el registro</div>
                </div>
            </div>
            <div class="modal-body-lux">
                <div class="fields-section">
                    <div class="fields-section-title"><i class="fas fa-circle-info"></i> Identificación</div>
                    <div class="field-container-lux">
                        <label class="label-lux"><i class="fas fa-id-card"></i> ${isPlant ? 'NIT / ID Planta' : 'Cédula / ID'}</label>
                        <input type="text" id="create-id" class="input-lux" placeholder="Ej: 10203040">
                    </div>
                    <div class="field-container-lux" style="margin-bottom:0">
                        <label class="label-lux"><i class="fas fa-signature"></i> ${isPlant ? 'Nombre Planta' : 'Nombre Completo'}</label>
                        <input type="text" id="create-nombre" class="input-lux" placeholder="Nombre real">
                    </div>
                </div>

                <div class="fields-section">
                    <div class="fields-section-title"><i class="fas fa-address-book"></i> Contacto</div>
                    <div class="field-container-lux">
                        <label class="label-lux"><i class="fas fa-envelope"></i> Correo</label>
                        <input type="email" id="create-correo" class="input-lux" placeholder="correo@ejemplo.com">
                    </div>
                    <div class="field-container-lux" style="margin-bottom:0">
                        <label class="label-lux"><i class="fas fa-phone"></i> Teléfono</label>
                        <div class="phone-input-integrated" id="phone-wrap-create" style="border-radius:8px; border:1.5px solid #e2e8f0;">
                            <div class="phone-prefix-area" style="height:38px;">
                                <img src="https://flagcdn.com/w20/co.png" width="20">
                                <span>+57</span>
                            </div>
                            <input type="tel" id="create-telefono" class="input-lux" style="border:none !important; height:38px !important; flex:1;" placeholder="300 123 4567">
                        </div>
                    </div>
                    ${isPlant ? `
                    <div class="field-container-lux" style="margin-top:14px; margin-bottom:0">
                        <label class="label-lux"><i class="fas fa-location-dot"></i> Dirección</label>
                        <input type="text" id="create-direccion" class="input-lux" placeholder="Calle, Carrera, Ciudad">
                    </div>` : ''}
                </div>

                <div class="fields-section" style="margin-bottom:0">
                    <div class="fields-section-title"><i class="fas fa-shield-halved"></i> Seguridad</div>
                    <div class="field-container-lux">
                        <label class="label-lux"><i class="fas fa-shield-halved"></i> Rol Inicial</label>
                        <select id="create-rol" class="input-lux">
                            ${isPlant ? `
                                <option value="GUEST" selected>GUEST (Taller)</option>
                            ` : `
                                <option value="GUEST">GUEST (Invitado)</option>
                                <option value="USER-P" selected>USER-P (Producción)</option>
                                <option value="USER-C">USER-C (Calidad)</option>
                                <option value="MODERATOR">MODERATOR</option>
                                <option value="ADMIN">ADMIN</option>
                            `}
                        </select>
                    </div>
                    <div class="field-container-lux" style="margin-bottom:0">
                        <label class="label-lux"><i class="fas fa-lock"></i> Contraseña</label>
                        <input type="password" id="create-password" class="input-lux" placeholder="Defina una clave">
                    </div>
                </div>
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: 'CREAR REGISTRO',
        confirmButtonColor: '#3F51B5',
        width: '380px',
        customClass: { popup: 'edit-modal-popup' },
        didOpen: () => {
            const tel = document.getElementById('create-telefono');
            if (tel) {
                tel.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    if (val.length > 6) e.target.value = `(${val.slice(0,3)}) ${val.slice(3,6)}-${val.slice(6)}`;
                    else if (val.length > 3) e.target.value = `(${val.slice(0,3)}) ${val.slice(3)}`;
                    else e.target.value = val;
                });
            }
        },
        preConfirm: () => {
            const id = document.getElementById('create-id').value.trim();
            const name = document.getElementById('create-nombre').value.trim();
            const email = document.getElementById('create-correo').value.trim();
            const phone = document.getElementById('create-telefono').value.replace(/\D/g, '');
            const pass = document.getElementById('create-password').value.trim();
            const rol = document.getElementById('create-rol').value;

            if (!id || !name || !email || !phone || !pass) {
                Swal.showValidationMessage('Todos los campos son obligatorios');
                return false;
            }
            return {
                id, name, email, phone, pass, rol,
                direccion: isPlant ? document.getElementById('create-direccion').value.trim() : null
            };
        }
    });

    if (formValues) {
        try {
            Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
            
            const payload = {
                accion: isPlant ? 'CREAR_PLANTA' : 'CREAR_USUARIO',
                id: formValues.id,
                usuario: !isPlant ? formValues.name : null,
                planta: isPlant ? formValues.name : null,
                correo: formValues.email,
                email: isPlant ? formValues.email : null,
                telefono: formValues.phone,
                direccion: formValues.direccion,
                rol: formValues.rol,
                password: formValues.pass
            };

            const response = await sendToGAS(payload);

            if (response.success) {
                Swal.fire('✔ Creado', 'Registro creado exitosamente.', 'success');
                await loadUsers(); 
                cargarDatosLocales();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
        }
    }
}

/* ── Toggle KPIs usuarios ── */
function toggleUsuariosKPIs() {
    const container = document.getElementById('usuariosKpiContainer');
    const chevron = document.getElementById('usuariosKpiChevron');
    if (!container) return;
    const open = container.style.display === 'none' || container.style.display === '';
    container.style.display = open ? 'grid' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}
