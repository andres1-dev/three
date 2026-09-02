/* ================================================================
   módulo personas — estrategia: window.allUsers / window.allPlantas
   SIN fetch() local. Datos desde memoria (auth.js ya los cargó).
   ================================================================ */
(function () {
    'use strict';

    const PER_PAGE = 6;

    let _mode  = 'USERS';
    let _users = [];
    let _plants= [];
    let _query = '';
    let _page  = 1;
    let _prods = [];

    const GRAD = {
        'ADMIN':        'linear-gradient(135deg,#6366f1,#8b5cf6)',
        'MODERATOR':    'linear-gradient(135deg,#3b82f6,#06b6d4)',
        'USER-P':       'linear-gradient(135deg,#10b981,#059669)',
        'USER-C':       'linear-gradient(135deg,#06b6d4,#0284c7)',
        'USER-I':       'linear-gradient(135deg,#22c55e,#16a34a)',
        'GUEST':        'linear-gradient(135deg,#f59e0b,#d97706)',
        'PENDIENTE':    'linear-gradient(135deg,#f97316,#ea580c)',
        'DESHABILITADO':'linear-gradient(135deg,#94a3b8,#64748b)',
    };
    const ROL_META = {
        'ADMIN':        { badge:'pb-admin',     label:'Admin' },
        'MODERATOR':    { badge:'pb-moderator', label:'Moderador' },
        'USER-P':       { badge:'pb-user-p',    label:'Producción' },
        'USER-C':       { badge:'pb-user-c',    label:'Calidad' },
        'USER-I':       { badge:'pb-user-i',    label:'Ingreso' },
        'GUEST':        { badge:'pb-guest',      label:'Taller' },
        'PENDIENTE':    { badge:'pb-pendiente',  label:'Pendiente' },
        'DESHABILITADO':{ badge:'pb-disabled',   label:'Inactivo' },
    };

    function _grad(r){ return GRAD[r]||'linear-gradient(135deg,#64748b,#475569)'; }
    function _meta(r){ return ROL_META[r]||{badge:'pb-default',label:r||'—'}; }
    function _inits(n){ const p=(n||'').trim().split(' ').filter(Boolean); return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():(n||'US').slice(0,2).toUpperCase(); }
    function _svg(d,s=14){ return `<svg viewBox="0 0 24 24" style="width:${s}px;height:${s}px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${d}</svg>`; }

    /* ── ROOT siempre desde view-module (agents.md §2) ── */
    function root(){ return document.getElementById('view-module')||document; }
    function el(id){ return root().querySelector('#'+id); }
    function qsa(s){ return root().querySelectorAll(s); }

    /* ── Init ── */
    function init() {
        const r = root();
        if (!r.querySelector('#p-list')) {
            setTimeout(init, 100);
            return;
        }

        /* Productoras del caché */
        try { _prods = JSON.parse(localStorage.getItem('busint_productoras_cache')||'[]'); } catch(_){}
        if (!_prods.length) _prods = [
            {id_productora:1, productora:'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.'},
            {id_productora:2, productora:'TEXTILES Y CREACIONES LOS ANGELES S.A.S.'},
            {id_productora:3, productora:'HACEMOS MODA S.A.S.'},
            {id_productora:4, productora:'INVERSIONES URBANA S.A.S.'}
        ];

        /* Tabs */
        qsa('.p-tab').forEach(t => t.addEventListener('click', () => {
            qsa('.p-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            _mode = t.dataset.tab;
            _page = 1;
            const s = el('p-search');
            if(s) s.placeholder = _mode==='USERS' ? 'Buscar por nombre, ID o correo...' : 'Buscar taller por nombre o NIT...';
            _render();
        }));

        /* Búsqueda */
        el('p-search')?.addEventListener('input', () => {
            _query = el('p-search').value.trim().toLowerCase();
            _page = 1;
            _render();
        });

        el('p-btn-refresh')?.addEventListener('click', _cargar);
        el('p-fab')?.addEventListener('click', () => _openCreate());
        el('p-backdrop')?.addEventListener('click', _closeSheet);

        _cargar();
    }

    /* ── Cargar datos (estrategia agents.md §4) ── */
    async function _cargar() {
        _showSkeleton(true);
        try {
            /* 1. Datos ya en memoria por loadUsers() de auth.js */
            let u = window.allUsers   || [];
            let p = window.allPlantas || [];

            /* 2. Si memoria vacía, llamar a api.js */
            if (!u.length || !p.length) {
                console.log('[Personas] Cargando desde Supabase...');
                const [ru, rp] = await Promise.all([
                    typeof fetchUsuariosData==='function' ? fetchUsuariosData() : Promise.resolve([]),
                    typeof fetchPlantasData ==='function' ? fetchPlantasData()  : Promise.resolve([])
                ]);
                u = ru || [];
                p = rp || [];
                console.log('[Personas] usuarios:', u.length, '| plantas:', p.length);
                window.allUsers   = u;
                window.allPlantas = p;
            } else {
                console.log('[Personas] Usando memoria: usuarios:', u.length, '| plantas:', p.length);
            }

            _users  = u.map(_normUser);
            _plants = p.map(_normPlant);

        } catch(e) {
            console.error('[Personas] Error cargando:', e);
        }

        _showSkeleton(false);
        _render();
    }

    function _normUser(u){
        return {
            _type:'USER',
            id:    String(u.ID_USUARIO||u.ID||u.id||''),
            nombre:u.USUARIO||u.usuario||u.email||'—',
            correo:u.CORREO||u.EMAIL||u.email||'—',
            tel:   u.TELEFONO||u.telefono||'—',
            rol:   u.ROL||'GUEST',
            prod:  u.PRODUCTORA||u.productora||'—',
            id_prod:u.ID_PRODUCTORA||u.id_productora||'',
            pass:  u.PASSWORD||u.CONTRASEÑA||'',
            firma: u.FIRMA_SVG||null,
            email_copia: u.EMAIL_COPIA||false,
        };
    }

    function _normPlant(p){
        return {
            _type:'PLANT',
            id:    String(p.ID_PLANTA||p.id||''),
            nombre:p.PLANTA||p.planta||'—',
            correo:p.EMAIL||p.CORREO||p.email||'—',
            tel:   p.TELEFONO||p.telefono||'—',
            rol:   p.ROL==='DESHABILITADO'?'DESHABILITADO':'GUEST',
            dir:   p.DIRECCION||p.direccion||'—',
            ciudad:p.CIUDAD||p.ciudad||'—',
            pass:  p.PASSWORD||p.CONTRASEÑA||'',
            email_copia: p.EMAIL_COPIA||false,
        };
    }

    /* ── Render ── */
    function _render() {
        const list = _mode==='USERS' ? _users : _plants;
        const filtered = list.filter(i => !_query ||
            i.nombre.toLowerCase().includes(_query) ||
            i.correo.toLowerCase().includes(_query) ||
            i.id.toLowerCase().includes(_query)
        );

        _renderKPIs(list);

        const start = (_page-1)*PER_PAGE;
        const slice = filtered.slice(start, start+PER_PAGE);
        const listEl = el('p-list');
        if (!listEl) return;

        if (filtered.length===0) {
            listEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
                ${_svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',36)}
                <p style="margin-top:10px;font-size:.85rem">Sin resultados</p></div>`;
        } else {
            listEl.innerHTML = slice.map((item,i) => {
                const m = _meta(item.rol);
                return `<div class="p-card" data-idx="${start+i}">
                    <div class="p-avatar" style="background:${_grad(item.rol)}">${_inits(item.nombre)}</div>
                    <div class="p-info">
                        <div class="p-name">${item.nombre}</div>
                        <div class="p-sub">${item.correo}</div>
                    </div>
                    <span class="p-badge ${m.badge}">${m.label}</span>
                    <span class="p-chevron">${_svg('<polyline points="9 18 15 12 9 6"/>')}</span>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.p-card').forEach(card => {
                card.addEventListener('click', () => _openDetail(filtered[parseInt(card.dataset.idx)]));
            });
        }

        _renderPag(filtered.length);
    }

    function _renderKPIs(list) {
        const a=el('p-kpi-a'), b=el('p-kpi-b'), al=el('p-kpi-a-lbl'), bl=el('p-kpi-b-lbl');
        if (!b) return;
        b.textContent = list.length;
        if (_mode==='USERS') {
            if(a) a.textContent = list.filter(u=>u.rol==='PENDIENTE').length;
            if(al) al.textContent='Pendientes';
            if(bl) bl.textContent='Total';
        } else {
            const comp = list.filter(p=>p.nombre!=='—'&&p.dir!=='—'&&p.tel!=='—'&&p.correo!=='—').length;
            if(a) a.textContent = comp;
            if(al) al.textContent='Diligenciadas';
            if(bl) bl.textContent='Total';
        }
    }

    function _renderPag(total) {
        const pag=el('p-pagination');
        if(!pag) return;
        const pages=Math.ceil(total/PER_PAGE);
        if(pages<=1){ pag.innerHTML=''; return; }
        pag.innerHTML=`
            <button class="p-page-btn" id="p-prev" ${_page===1?'disabled':''}>
                ${_svg('<polyline points="15 18 9 12 15 6"/>')} Anterior
            </button>
            <span class="p-page-info">Pág. ${_page} / ${pages}</span>
            <button class="p-page-btn" id="p-next" ${_page===pages?'disabled':''}>
                Siguiente ${_svg('<polyline points="9 18 15 12 9 6"/>')}
            </button>`;
        el('p-prev')?.addEventListener('click',()=>{ _page--; _render(); });
        el('p-next')?.addEventListener('click',()=>{ _page++; _render(); });
    }

    /* ── Sheet detalle ── */
    function _openDetail(item) {
        const m = _meta(item.rol);
        const canEdit = ['ADMIN','MODERATOR'].includes(window.currentUser?.ROL);
        el('p-sheet-body').innerHTML = `
            <div class="p-sheet-head">
                <div class="p-sheet-avatar" style="background:${_grad(item.rol)}">${_inits(item.nombre)}</div>
                <div>
                    <p class="p-sheet-name">${item.nombre}</p>
                    <p class="p-sheet-email">${item.correo}</p>
                    <span class="p-badge ${m.badge}" style="margin-top:4px;display:inline-block">${m.label}</span>
                </div>
            </div>
            <div class="p-section">
                <div class="p-section-title">Identificación</div>
                <div class="p-row"><span class="p-row-label">ID</span><span class="p-row-value">${item.id}</span></div>
                <div class="p-row"><span class="p-row-label">Rol</span><span class="p-row-value">${m.label}</span></div>
            </div>
            <div class="p-section">
                <div class="p-section-title">Contacto</div>
                <div class="p-row"><span class="p-row-label">Correo</span><span class="p-row-value">${item.correo}</span></div>
                <div class="p-row"><span class="p-row-label">Teléfono</span><span class="p-row-value">${item.tel}</span></div>
                ${item._type==='PLANT'?`<div class="p-row"><span class="p-row-label">Dirección</span><span class="p-row-value">${item.dir}</span></div>`:''}
            </div>
            ${item._type==='USER'&&item.prod&&item.prod!=='—'?`
            <div class="p-section">
                <div class="p-section-title">Organización</div>
                <div class="p-row"><span class="p-row-label">Productora</span><span class="p-row-value">${item.prod}</span></div>
            </div>`:''}
            <div class="p-sheet-actions">
                ${canEdit?`<button class="p-btn-primary" id="p-btn-edit">${_svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')} Editar</button>`:''}
                <button class="p-btn-secondary" id="p-close-det">Cerrar</button>
            </div>`;
        el('p-close-det')?.addEventListener('click', _closeSheet);
        if(canEdit) el('p-btn-edit')?.addEventListener('click', ()=>{ _closeSheet(); setTimeout(()=>_openEdit(item),300); });
        _openSheet();
    }

    /* ── Sheet edición ── */
    function _openEdit(item) {
        const isPlant = item._type==='PLANT';
        const prodOpts = _prods.map(p=>`<option value="${p.id_productora}" ${String(item.id_prod)===String(p.id_productora)?'selected':''}>${p.productora}</option>`).join('');
        const roles = isPlant
            ? ['GUEST','DESHABILITADO']
            : ['ADMIN','MODERATOR','USER-P','USER-C','USER-I','GUEST','PENDIENTE','DESHABILITADO'];

        el('p-sheet-body').innerHTML = `
            <div class="p-sheet-head">
                <div class="p-sheet-avatar" style="background:${_grad(item.rol)}">${_inits(item.nombre)}</div>
                <div>
                    <p class="p-sheet-name">Editar ${isPlant?'Taller':'Usuario'}</p>
                    <p class="p-sheet-email">${item.id}</p>
                </div>
            </div>
            <div style="padding:12px 20px 0">
                <div class="p-field"><div class="p-field-label">ID</div>
                    <div class="p-field-wrap">
                        <input class="p-field-input" id="pe-id" value="${item.id}" disabled style="padding-right:36px">
                        <button class="p-field-lock" id="pe-lock-id" title="Desbloquear">${_svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}</button>
                    </div></div>
                <div class="p-field"><div class="p-field-label">${isPlant?'Nombre Taller':'Nombre'}</div>
                    <div class="p-field-wrap">
                        <input class="p-field-input" id="pe-nombre" value="${item.nombre}" ${isPlant?'disabled style="padding-right:36px"':''}>
                        ${isPlant?`<button class="p-field-lock" id="pe-lock-n">${_svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}</button>`:''}
                    </div></div>
                <div class="p-field"><div class="p-field-label">Correo</div>
                    <input class="p-field-input" id="pe-correo" type="email" value="${item.correo}"></div>
                <div class="p-field"><div class="p-field-label">Teléfono</div>
                    <input class="p-field-input" id="pe-tel" type="tel" value="${item.tel!=='—'?item.tel:''}"></div>
                ${isPlant?`<div class="p-field"><div class="p-field-label">Dirección</div>
                    <input class="p-field-input" id="pe-dir" value="${item.dir!=='—'?item.dir:''}"></div>`:''}
                <div class="p-field"><div class="p-field-label">Rol</div>
                    <select class="p-field-select" id="pe-rol">
                        ${roles.map(r=>`<option value="${r}" ${item.rol===r?'selected':''}>${r}</option>`).join('')}
                    </select></div>
                ${!isPlant?`<div class="p-field"><div class="p-field-label">Productora</div>
                    <select class="p-field-select" id="pe-prod">
                        <option value="">-- Sin asignar --</option>${prodOpts}
                    </select></div>`:''}
                <div class="p-field"><div class="p-field-label">Contraseña</div>
                    <div class="p-field-wrap">
                        <input class="p-field-input" id="pe-pass" type="password" value="${item.pass}" style="padding-right:36px" placeholder="Dejar vacío para no cambiar">
                        <button class="p-field-lock" id="pe-eye">${_svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')}</button>
                    </div></div>
            </div>
            <div class="p-sheet-actions">
                <button class="p-btn-primary" id="pe-save">${_svg('<polyline points="20 6 9 17 4 12"/>')} Guardar</button>
                <button class="p-btn-secondary" id="pe-cancel">Cancelar</button>
            </div>`;

        el('pe-lock-id')?.addEventListener('click', ()=>{ const i=el('pe-id'); i.disabled=!i.disabled; });
        el('pe-lock-n')?.addEventListener('click',  ()=>{ const i=el('pe-nombre'); if(i) i.disabled=!i.disabled; });
        el('pe-eye')?.addEventListener('click', ()=>{ const i=el('pe-pass'); i.type=i.type==='password'?'text':'password'; });
        el('pe-cancel')?.addEventListener('click', _closeSheet);
        el('pe-save')?.addEventListener('click', ()=>_saveEdit(item));
        _openSheet();
    }

    async function _saveEdit(item) {
        const btn = el('pe-save');
        if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
        const isPlant = item._type==='PLANT';
        const payload = {
            accion:      isPlant?'ACTUALIZAR_PLANTA':'UPDATE_USER',
            id:          item.id, cedula: item.id,
            nuevoId:     (el('pe-id')?.value||'').trim()!==item.id?(el('pe-id')?.value||'').trim():null,
            usuario:     !isPlant?(el('pe-nombre')?.value||'').trim():null,
            nombrePlanta: isPlant?(el('pe-nombre')?.value||'').trim():null,
            correo:      (el('pe-correo')?.value||'').trim(),
            email:       isPlant?(el('pe-correo')?.value||'').trim():null,
            telefono:    (el('pe-tel')?.value||'').replace(/\D/g,''),
            direccion:   isPlant?(el('pe-dir')?.value||'').trim():null,
            rol:         el('pe-rol')?.value||item.rol,
            password:    (el('pe-pass')?.value||'').trim(),
            id_productora: el('pe-prod')?.value?parseInt(el('pe-prod').value):null,
            productora:  el('pe-prod')?.value?(_prods.find(p=>String(p.id_productora)===el('pe-prod').value)?.productora||null):null,
        };
        try {
            if (typeof sendToGAS !== 'function') throw new Error('sendToGAS no disponible');
            const r = await sendToGAS(payload);
            if(r&&r.success){ _toast('Actualizado correctamente'); _closeSheet(); window.allUsers=[]; await _cargar(); }
            else { _toast(r?.message||'Error al guardar',true); if(btn){ btn.disabled=false; btn.innerHTML=`${_svg('<polyline points="20 6 9 17 4 12"/>')} Guardar`; } }
        } catch(e){ _toast('No se pudo guardar: '+e.message,true); if(btn){ btn.disabled=false; btn.innerHTML=`${_svg('<polyline points="20 6 9 17 4 12"/>')} Guardar`; } }
    }

    /* ── Crear ── */
    function _openCreate() {
        const isPlant = _mode==='PLANTS';
        const prodOpts = _prods.map(p=>`<option value="${p.id_productora}">${p.productora}</option>`).join('');
        const roles = isPlant ? ['GUEST','DESHABILITADO']
            : ['USER-P','USER-C','USER-I','MODERATOR','ADMIN','GUEST'];

        el('p-sheet-body').innerHTML = `
            <div class="p-sheet-head">
                <div class="p-sheet-avatar" style="background:linear-gradient(135deg,#3b82f6,#6366f1)">${_svg('<path d="M12 5v14M5 12h14"/>',22)}</div>
                <div><p class="p-sheet-name">Nuevo ${isPlant?'Taller':'Usuario'}</p>
                     <p class="p-sheet-email">Completar todos los campos</p></div>
            </div>
            <div style="padding:12px 20px 0">
                <div class="p-field"><div class="p-field-label">ID / Cédula</div>
                    <input class="p-field-input" id="pc-id" placeholder="Ej: 1234567890"></div>
                <div class="p-field"><div class="p-field-label">${isPlant?'Nombre Taller':'Nombre Completo'}</div>
                    <input class="p-field-input" id="pc-nombre" placeholder="Nombre real"></div>
                <div class="p-field"><div class="p-field-label">Correo</div>
                    <input class="p-field-input" id="pc-correo" type="email" placeholder="correo@ejemplo.com"></div>
                <div class="p-field"><div class="p-field-label">Teléfono</div>
                    <input class="p-field-input" id="pc-tel" type="tel" placeholder="300 123 4567"></div>
                ${isPlant?`<div class="p-field"><div class="p-field-label">Dirección</div>
                    <input class="p-field-input" id="pc-dir" placeholder="Calle, Ciudad"></div>`:''}
                <div class="p-field"><div class="p-field-label">Rol</div>
                    <select class="p-field-select" id="pc-rol">
                        ${roles.map((r,i)=>`<option value="${r}" ${i===0?'selected':''}>${r}</option>`).join('')}
                    </select></div>
                ${!isPlant?`<div class="p-field"><div class="p-field-label">Productora</div>
                    <select class="p-field-select" id="pc-prod">
                        <option value="">-- Sin asignar --</option>${prodOpts}
                    </select></div>`:''}
                <div class="p-field"><div class="p-field-label">Contraseña</div>
                    <input class="p-field-input" id="pc-pass" type="password" placeholder="Defina una clave"></div>
            </div>
            <div class="p-sheet-actions">
                <button class="p-btn-primary" id="pc-save">${_svg('<polyline points="20 6 9 17 4 12"/>')} Crear</button>
                <button class="p-btn-secondary" id="pc-cancel">Cancelar</button>
            </div>`;

        el('pc-cancel')?.addEventListener('click', _closeSheet);
        el('pc-save')?.addEventListener('click', ()=>_saveCreate(isPlant));
        _openSheet();
    }

    async function _saveCreate(isPlant) {
        const btn=el('pc-save');
        const id=    (el('pc-id')?.value||'').trim();
        const nombre=(el('pc-nombre')?.value||'').trim();
        const correo=(el('pc-correo')?.value||'').trim();
        const tel=   (el('pc-tel')?.value||'').replace(/\D/g,'');
        const pass=  (el('pc-pass')?.value||'').trim();
        const rol=   el('pc-rol')?.value||'GUEST';
        const dir=   (el('pc-dir')?.value||'').trim();
        const prodId=el('pc-prod')?.value||'';
        if(!id||!nombre||!correo||!tel||!pass){ _toast('Todos los campos son obligatorios',true); return; }
        if(btn){ btn.disabled=true; btn.textContent='Procesando...'; }
        try {
            if(typeof sendToGAS!=='function') throw new Error('sendToGAS no disponible');
            const payload={
                accion:   isPlant?'CREAR_PLANTA':'CREAR_USUARIO',
                id, cedula:id,
                usuario:  !isPlant?nombre:null, planta:isPlant?nombre:null,
                correo, email:isPlant?correo:null,
                telefono:tel, direccion:isPlant?dir:null,
                rol, password:pass,
                id_productora:prodId?parseInt(prodId):null,
                productora:prodId?(_prods.find(p=>String(p.id_productora)===prodId)?.productora||null):null,
            };
            const r=await sendToGAS(payload);
            if(r&&r.success){ _toast('Creado exitosamente'); _closeSheet(); window.allUsers=[]; await _cargar(); }
            else{ _toast(r?.message||'Error al crear',true); if(btn){btn.disabled=false;btn.innerHTML=`${_svg('<polyline points="20 6 9 17 4 12"/>')} Crear`;} }
        } catch(e){ _toast('No se pudo crear: '+e.message,true); if(btn){btn.disabled=false;btn.innerHTML=`${_svg('<polyline points="20 6 9 17 4 12"/>')} Crear`;} }
    }

    /* ── Helpers ── */
    function _openSheet(){ el('p-backdrop')?.classList.add('open'); el('p-sheet')?.classList.add('open'); }
    function _closeSheet(){ el('p-backdrop')?.classList.remove('open'); el('p-sheet')?.classList.remove('open'); }
    function _showSkeleton(on){ const sk=el('p-skeleton'),ls=el('p-list'); if(sk)sk.style.display=on?'block':'none'; if(ls)ls.style.display=on?'none':'block'; }
    function _toast(msg,err=false){
        const t=document.createElement('div');
        t.className='p-toast'+(err?' error':'');
        t.innerHTML=(err?_svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',15):_svg('<polyline points="20 6 9 17 4 12"/>',15))+`<span>${msg}</span>`;
        document.body.appendChild(t);
        setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .4s';},2200);
        setTimeout(()=>t.remove(),2700);
    }

    setTimeout(init, 0);
})();
