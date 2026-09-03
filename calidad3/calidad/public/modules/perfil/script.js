/* ── Módulo: Perfil ── */
(function () {
    'use strict';

    /* ══════════════════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════════════════ */

    function _showReal(root) {
        const sk   = root.querySelector('#perfil-skeleton');
        const real = root.querySelector('#perfil-real');
        if (sk)   sk.style.display   = 'none';
        if (real) real.style.display = 'flex';
    }

    function _setInfo(root, field, value) {
        const els = root.querySelectorAll(`.mod-perfil [data-field="${field}"] .info-value`);
        els.forEach(el => {
            el.textContent = value || '—';
        });
    }

    const MESES_ES = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    /**
     * Formatea cumpleaños como "8 de febrero"
     */
    function _formatBirthdayText(dateStr) {
        if (!dateStr || dateStr === '—') return 'Sin cumpleaños';
        const clean = String(dateStr).trim().split('T')[0];
        const parts = clean.split('-');
        if (parts.length >= 3) {
            const dia = parseInt(parts[2], 10);
            const mesIdx = parseInt(parts[1], 10) - 1;
            if (!isNaN(dia) && mesIdx >= 0 && mesIdx < 12) {
                return `${dia} de ${MESES_ES[mesIdx]}`;
            }
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return `${d.getUTCDate()} de ${MESES_ES[d.getUTCMonth()]}`;
        }
        return dateStr;
    }

    /**
     * Formatea fecha completa como "15 de marzo de 2023"
     */
    function _formatDateText(dateStr) {
        if (!dateStr || dateStr === '—') return '—';
        const clean = String(dateStr).trim().split('T')[0];
        const parts = clean.split('-');
        if (parts.length >= 3) {
            const anio = parts[0];
            const dia = parseInt(parts[2], 10);
            const mesIdx = parseInt(parts[1], 10) - 1;
            if (!isNaN(dia) && mesIdx >= 0 && mesIdx < 12) {
                return `${dia} de ${MESES_ES[mesIdx]} de ${anio}`;
            }
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return `${d.getUTCDate()} de ${MESES_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
        }
        return dateStr;
    }

    function _renderAvatar(root, u) {
        const avatarImg = root.querySelector('.profile-avatar');
        if (!avatarImg) return;
        const container = avatarImg.parentElement;

        if (u.foto_url) {
            avatarImg.src = u.foto_url;
            avatarImg.style.display = 'block';
            container?.querySelector('.perfil-avatar-initials')?.remove();
            return;
        }

        avatarImg.style.display = 'none';
        if (container && !container.querySelector('.perfil-avatar-initials')) {
            const name  = u.USUARIO || u.PLANTA || '';
            const parts = name.trim().split(' ').filter(Boolean);
            const inits = parts.length >= 2
                ? (parts[0][0] + parts[1][0]).toUpperCase()
                : (name.slice(0, 2).toUpperCase() || 'US');
            const grads = {
                'ADMIN':     'linear-gradient(135deg,#6366f1,#8b5cf6)',
                'MODERATOR': 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                'USER-P':    'linear-gradient(135deg,#10b981,#059669)',
                'GUEST':     'linear-gradient(135deg,#f59e0b,#d97706)',
            };
            const grad = grads[u.ROL] || 'linear-gradient(135deg,#64748b,#475569)';
            const span = document.createElement('span');
            span.className = 'perfil-avatar-initials';
            span.style.background = grad;
            span.textContent = inits;
            container.insertBefore(span, avatarImg);
        }
    }

    function _renderPortada(root, u) {
        const coverBg  = root.querySelector('#profile-cover-bg');
        const coverImg = root.querySelector('.profile-cover img');
        if (!u.portada_url) return;

        if (coverImg) {
            coverImg.src = u.portada_url;
        } else if (coverBg) {
            const img = document.createElement('img');
            img.alt = 'Portada';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            img.src = u.portada_url;
            coverBg.replaceWith(img);
        }
    }

    function _populateFields(root, u) {
        const nameEl = root.querySelector('.profile-name');
        if (nameEl) nameEl.textContent = u.USUARIO || u.PLANTA || u.EMAIL || 'Sin nombre';

        const metaCumple = root.querySelector('.mod-perfil [data-meta="cumpleanos"] span');
        const metaProd   = root.querySelector('.mod-perfil [data-meta="cumpleanos"] ~ [data-meta="productora"] span')
                        || root.querySelector('.mod-perfil [data-meta="productora"] span');
        
        const fechaNac = u.fecha_nacimiento || u.FECHA_NACIMIENTO || '';
        const cumpleanosTexto = _formatBirthdayText(fechaNac);

        if (metaCumple) {
            metaCumple.textContent = cumpleanosTexto;
        }
        if (metaProd) {
            metaProd.textContent = u.PRODUCTORA || u.productora || 'Grupo TDM';
        }

        const fechaContrato = u.FECHA_CONTRATACION || u.fecha_contratacion || u.FECHA_INGRESO || u.fecha_ingreso || '';
        let antiguedadCalc = u.ANTIGUEDAD || u.antiguedad || '';
        if (!antiguedadCalc && fechaContrato) {
            const inicio = new Date(fechaContrato);
            if (!isNaN(inicio.getTime())) {
                const hoy = new Date();
                let anos = hoy.getFullYear() - inicio.getFullYear();
                let meses = hoy.getMonth() - inicio.getMonth();
                if (meses < 0) { anos--; meses += 12; }
                if (anos <= 0) {
                    antiguedadCalc = meses === 1 ? '1 mes' : `${meses} meses`;
                } else if (meses === 0) {
                    antiguedadCalc = anos === 1 ? '1 año' : `${anos} años`;
                } else {
                    antiguedadCalc = `${anos === 1 ? '1 año' : `${anos} años`}, ${meses === 1 ? '1 mes' : `${meses} meses`}`;
                }
            }
        }

        _setInfo(root, 'id-usuario',         u.cedula        || u.CEDULA        || u.ID_USUARIO   || u.ID_PLANTA || '—');
        _setInfo(root, 'cargo',              u.CARGO         || u.cargo         || '—');
        _setInfo(root, 'area',               u.AREA          || u.area          || u.DEPARTAMENTO  || '—');
        _setInfo(root, 'fecha-contratacion', _formatDateText(fechaContrato));
        _setInfo(root, 'fecha-nacimiento',   cumpleanosTexto);
        _setInfo(root, 'productora',         u.PRODUCTORA    || u.productora    || '—');
        _setInfo(root, 'departamento',       u.DEPARTAMENTO  || u.departamento  || '—');
        _setInfo(root, 'antiguedad',         antiguedadCalc  || '—');
        _setInfo(root, 'ciudad',             u.CIUDAD        || u.ciudad        || '—');
        _setInfo(root, 'pais',               u.PAIS          || u.pais          || 'Colombia');
        _setInfo(root, 'sede',               u.SEDE          || u.sede          || u.CIUDAD || u.ciudad || 'Medellín');
        const emailVal = u.EMAIL || u.CORREO || u.email || '';
        const telVal   = u.TELEFONO || u.telefono || u.phone || '';
        _setInfo(root, 'email',              emailVal        || '—');
        _setInfo(root, 'telefono',           telVal          || '—');
        _setInfo(root, 'direccion',          u.DIRECCION     || u.direccion     || '—');
        _setInfo(root, 'barrio',             u.BARRIO        || u.barrio        || '—');

        /* Acciones interactivas de contacto */
        const linkEmail = root.querySelector('#link-email-action');
        if (linkEmail) {
            if (emailVal && emailVal !== '—') {
                linkEmail.href = `mailto:${emailVal}`;
                linkEmail.style.display = 'inline-flex';
            } else {
                linkEmail.style.display = 'none';
            }
        }

        const linkTel = root.querySelector('#link-tel-action');
        if (linkTel) {
            if (telVal && telVal !== '—') {
                // Limpiar caracteres no numéricos para el href tel:
                const cleanPhone = telVal.replace(/[^0-9+]/g, '');
                linkTel.href = `tel:${cleanPhone}`;
                linkTel.style.display = 'inline-flex';
            } else {
                linkTel.style.display = 'none';
            }
        }
    }

    /* ══════════════════════════════════════════════════════════
       CROP MODAL — pan + zoom profesional
       tipo: 'foto' (círculo 400×400) | 'portada' (rect 800×350)
    ══════════════════════════════════════════════════════════ */
    function _openCropper(file, tipo, onConfirmed) {
        const isCircle = tipo === 'foto';

        /* Dimensiones del visor dentro del modal */
        const FRAME_W = isCircle ? 240 : 320;
        const FRAME_H = isCircle ? 240 : Math.round(320 * 7 / 16); /* ~140 */

        /* Dimensiones de exportación (mayor calidad) */
        const EXP_W = isCircle ? 400 : 800;
        const EXP_H = isCircle ? 400 : Math.round(800 * 7 / 16); /* 350 */

        /* ── Crear overlay ── */
        const overlay = document.createElement('div');
        overlay.id = 'crop-overlay';

        overlay.innerHTML = `
            <div id="crop-panel">
                <p id="crop-title">Ajustar imagen</p>
                <p id="crop-hint">Arrastra · Pellizca · Desliza el zoom</p>

                <div id="crop-stage-wrap"
                     style="width:${FRAME_W}px;height:${FRAME_H}px;
                            border-radius:${isCircle ? '50%' : '12px'};
                            box-shadow: 0 0 0 3px #3b82f6, 0 8px 28px rgba(59,130,246,.25);">
                    <img id="crop-img-el" draggable="false" alt="">
                </div>

                <div id="crop-zoom-row">
                    <button class="crop-zoom-btn" id="crop-zm">−</button>
                    <input  type="range" id="crop-zoom-slider" step="0.001">
                    <button class="crop-zoom-btn" id="crop-zp">+</button>
                </div>

                <div id="crop-btns">
                    <button id="crop-cancel-btn">Cancelar</button>
                    <button id="crop-confirm-btn">Confirmar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const stage  = overlay.querySelector('#crop-stage-wrap');
        const img    = overlay.querySelector('#crop-img-el');
        const slider = overlay.querySelector('#crop-zoom-slider');

        let scale = 1, minScale = 0.1, maxScale = 10;
        let tx = 0, ty = 0;

        /* ── Cargar imagen ── */
        const blobUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(blobUrl);
            /* Escala mínima que cubre el frame completamente */
            minScale = Math.max(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight);
            maxScale = minScale * 6;
            scale    = minScale;
            /* Centrar */
            tx = (FRAME_W - img.naturalWidth  * scale) / 2;
            ty = (FRAME_H - img.naturalHeight * scale) / 2;
            slider.min   = String(minScale);
            slider.max   = String(maxScale);
            slider.value = String(scale);
            _apply();
        };
        img.src = blobUrl;

        /* ── Clamp para que la imagen siempre cubra el frame ── */
        function _clamp() {
            const iw = img.naturalWidth  * scale;
            const ih = img.naturalHeight * scale;
            if (iw >= FRAME_W) { tx = Math.min(tx, 0); tx = Math.max(tx, FRAME_W - iw); }
            else                { tx = (FRAME_W - iw) / 2; }
            if (ih >= FRAME_H) { ty = Math.min(ty, 0); ty = Math.max(ty, FRAME_H - ih); }
            else                { ty = (FRAME_H - ih) / 2; }
        }

        function _apply() {
            _clamp();
            img.style.left   = tx + 'px';
            img.style.top    = ty + 'px';
            img.style.width  = (img.naturalWidth  * scale) + 'px';
            img.style.height = (img.naturalHeight * scale) + 'px';
            /* Actualizar gradiente del slider */
            const pct = ((scale - minScale) / (maxScale - minScale) * 100).toFixed(1) + '%';
            slider.style.setProperty('--pct', pct);
        }

        /* ── Zoom centrado en el frame ── */
        function _zoom(newScale, cx, cy) {
            newScale = Math.max(minScale, Math.min(maxScale, newScale));
            cx = cx ?? FRAME_W / 2;
            cy = cy ?? FRAME_H / 2;
            tx = cx - (cx - tx) * newScale / scale;
            ty = cy - (cy - ty) * newScale / scale;
            scale = newScale;
            slider.value = String(scale);
            _apply();
        }

        /* ── Arrastrar (mouse) ── */
        let dragging = false, lx = 0, ly = 0;
        stage.addEventListener('mousedown', e => {
            dragging = true; lx = e.clientX; ly = e.clientY;
            e.preventDefault();
        });
        const onMove = e => {
            if (!dragging) return;
            tx += e.clientX - lx; ty += e.clientY - ly;
            lx = e.clientX; ly = e.clientY;
            _apply();
        };
        const onUp = () => { dragging = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        /* ── Arrastrar + pellizcar (touch) ── */
        let lt = { x:0, y:0 }, pinchDist0 = 0;
        stage.addEventListener('touchstart', e => {
            if (e.touches.length === 1) {
                lt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                pinchDist0 = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
            e.preventDefault();
        }, { passive: false });

        stage.addEventListener('touchmove', e => {
            if (e.touches.length === 1) {
                tx += e.touches[0].clientX - lt.x;
                ty += e.touches[0].clientY - lt.y;
                lt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                _apply();
            } else if (e.touches.length === 2) {
                const d = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
                           - stage.getBoundingClientRect().left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
                           - stage.getBoundingClientRect().top;
                _zoom(scale * d / pinchDist0, cx, cy);
                pinchDist0 = d;
            }
            e.preventDefault();
        }, { passive: false });

        /* ── Scroll zoom ── */
        stage.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = stage.getBoundingClientRect();
            _zoom(scale * (e.deltaY < 0 ? 1.08 : 0.93),
                  e.clientX - rect.left, e.clientY - rect.top);
        }, { passive: false });

        /* ── Slider ── */
        slider.addEventListener('input', () => _zoom(parseFloat(slider.value)));
        overlay.querySelector('#crop-zm').addEventListener('click', () => _zoom(scale / 1.12));
        overlay.querySelector('#crop-zp').addEventListener('click', () => _zoom(scale * 1.12));

        /* ── Cancelar ── */
        overlay.querySelector('#crop-cancel-btn').addEventListener('click', _destroy);

        /* ── Confirmar → exportar canvas ── */
        overlay.querySelector('#crop-confirm-btn').addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            canvas.width  = EXP_W;
            canvas.height = EXP_H;
            const ctx = canvas.getContext('2d');

            /* Escalar coordenadas de frame → canvas de exportación */
            const ratio  = EXP_W / FRAME_W;
            const srcX   = -tx / scale;
            const srcY   = -ty / scale;
            const srcW   = FRAME_W / scale;
            const srcH   = FRAME_H / scale;

            if (isCircle) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(EXP_W / 2, EXP_H / 2, EXP_W / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
            }

            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, EXP_W, EXP_H);
            if (isCircle) ctx.restore();

            canvas.toBlob(blob => {
                _destroy();
                if (blob) {
                    console.log(`[Perfil] Imagen procesada y comprimida: ${(blob.size / 1024).toFixed(1)} KB`);
                    onConfirmed(blob);
                }
            }, 'image/jpeg', 0.88);
        });

        function _destroy() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            overlay.remove();
        }

        /* Cerrar al hacer click fuera del panel */
        overlay.addEventListener('click', e => {
            if (e.target === overlay) _destroy();
        });
    }

    /* ══════════════════════════════════════════════════════════
       SUBIR BLOB (resultado del crop)
    ══════════════════════════════════════════════════════════ */
    async function _subirBlob(root, blob, tipo, inputEl) {
        /* Limpiar el input file para que pueda re-elegir el mismo archivo */
        if (inputEl) inputEl.value = '';

        try {
            const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (!sb) throw new Error('Cliente Supabase no disponible');

            const { data: sessionData } = await sb.auth.getSession();
            const session = sessionData?.session;
            if (!session) throw new Error('No hay sesión activa');

            /* 1. URL firmada de subida */
            const r1 = await fetch(`${SUPABASE_URL}/functions/v1/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ accion: 'SUBIR_FOTO', tipo })
            });
            const j1 = await r1.json();
            if (!j1.success) throw new Error(j1.message);

            const { uploadUrl, publicUrl } = j1.data;

            /* 2. Subir el blob */
            const r2 = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }
            });
            if (!r2.ok) throw new Error(`Error al subir: ${await r2.text()}`);

            /* 3. Actualizar vista previa */
            const urlBusted = publicUrl + '?t=' + Date.now();
            if (tipo === 'foto') {
                const avatarImg = root.querySelector('.profile-avatar');
                const initials  = root.querySelector('.perfil-avatar-initials');
                if (avatarImg) { avatarImg.src = urlBusted; avatarImg.style.display = 'block'; }
                initials?.remove();
            } else {
                const existing = root.querySelector('.profile-cover img');
                if (existing) {
                    existing.src = urlBusted;
                } else {
                    const bg  = root.querySelector('#profile-cover-bg');
                    const img = document.createElement('img');
                    img.alt = 'Portada';
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                    img.src = urlBusted;
                    bg?.replaceWith(img);
                }
            }

            /* 4. Guardar URL en Supabase */
            const r3 = await fetch(`${SUPABASE_URL}/functions/v1/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({
                    accion: 'ACTUALIZAR_PERFIL',
                    [tipo === 'foto' ? 'foto_url' : 'portada_url']: publicUrl
                })
            });
            const j3 = await r3.json();
            if (!j3.success) throw new Error(j3.message);

            if (window.currentUser) {
                window.currentUser[tipo === 'foto' ? 'foto_url' : 'portada_url'] = publicUrl;
            }

        } catch (err) {
            console.error('[Perfil] Error al subir imagen:', err);
            alert('Error al subir la imagen: ' + err.message);
        }
    }

    /* ══════════════════════════════════════════════════════════
       CARGAR foto_url y portada_url desde Supabase
    ══════════════════════════════════════════════════════════ */
    async function _fetchPerfilExtra() {
        try {
            const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (!sb) return null;
            const { data: sessionData } = await sb.auth.getSession();
            const session = sessionData?.session;
            if (!session) return null;

            const resp = await fetch(`${SUPABASE_URL}/functions/v1/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ accion: 'OBTENER_PERFIL' })
            });
            if (!resp.ok) return null;
            const result = await resp.json();
            return result.success ? result.data : null;
        } catch (e) {
            console.warn('[Perfil] No se pudo obtener perfil extra:', e.message);
            return null;
        }
    }

    /* ══════════════════════════════════════════════════════════
       ESPERAR A QUE currentUser ESTÉ ENRIQUECIDO
    ══════════════════════════════════════════════════════════ */
    function _waitForUser(maxMs) {
        return new Promise(resolve => {
            const u0 = window.currentUser;
            if (u0 && (u0.USUARIO || u0.PLANTA || u0.EMAIL)) return resolve(u0);
            const start = Date.now();
            const tick  = setInterval(() => {
                const u = window.currentUser;
                const ok = u && (u.USUARIO || u.PLANTA || u.EMAIL);
                if (ok || Date.now() - start >= maxMs) {
                    clearInterval(tick);
                    resolve(u || {});
                }
            }, 80);
        });
    }

    /* ══════════════════════════════════════════════════════════
       CONECTAR EVENTOS DE UI
    ══════════════════════════════════════════════════════════ */
    function _bindEvents(root) {

        /* Tabs con funcionalidad real de cambio de panel */
        const tabs   = root.querySelectorAll('.mod-perfil .profile-tabs .tab-btn');
        const panels = root.querySelectorAll('.mod-perfil .tab-panel');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                const activePanel = root.querySelector(`#tab-${target}`);
                if (activePanel) activePanel.classList.add('active');
            });
        });

        /* Acordeón */
        root.querySelectorAll('.mod-perfil .accordion').forEach(acc => {
            const header = acc.querySelector('.accordion-header');
            if (!header) return;
            header.addEventListener('click', () => {
                const isOpen = acc.classList.contains('open');
                root.querySelectorAll('.mod-perfil .accordion').forEach(a => a.classList.remove('open'));
                if (!isOpen) acc.classList.add('open');
            });
        });

        /* Scroll blur del header */
        const viewport      = document.getElementById('module-viewport');
        const profileHeader = root.querySelector('.mod-perfil .profile-header');
        if (viewport && profileHeader) {
            viewport.addEventListener('scroll', () => {
                profileHeader.classList.toggle('scrolled', viewport.scrollTop > 10);
            }, { passive: true });
        }

        /* Botón Organigrama */
        root.querySelector('.mod-perfil .btn-secondary')
            ?.addEventListener('click', () => window.AppRouter?.navigate('organigrama'));

        /* Botón Editar perfil */
        root.querySelector('.mod-perfil .btn-primary')
            ?.addEventListener('click', () => {
                if (typeof window.PerfilEditor !== 'undefined') window.PerfilEditor.abrirEditor();
            });

        /* ── Cambiar foto → abrir cropper circular ── */
        const btnFoto  = root.querySelector('#btn-cambiar-foto');
        const inpFoto  = root.querySelector('#input-foto-perfil');
        if (btnFoto && inpFoto) {
            btnFoto.addEventListener('click', () => inpFoto.click());
            inpFoto.addEventListener('change', e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return; }
                if (file.size > 50 * 1024 * 1024) { alert('La imagen original no puede superar 50 MB'); return; }
                _openCropper(file, 'foto', blob => _subirBlob(root, blob, 'foto', inpFoto));
            });
        }

        /* ── Cambiar portada → abrir cropper rectangular ── */
        const btnPortada = root.querySelector('#btn-cambiar-portada');
        const inpPortada = root.querySelector('#input-portada');
        if (btnPortada && inpPortada) {
            btnPortada.addEventListener('click', () => inpPortada.click());
            inpPortada.addEventListener('change', e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return; }
                if (file.size > 50 * 1024 * 1024) { alert('La imagen original no puede superar 50 MB'); return; }
                _openCropper(file, 'portada', blob => _subirBlob(root, blob, 'portada', inpPortada));
            });
        }

        /* Cerrar sesión */
        const btnSalir = root.querySelector('.mod-perfil [aria-label="Cerrar sesión"]');
        if (btnSalir) {
            btnSalir.onclick = () => {
                if (typeof window.logout === 'function') { window.logout(); return; }
                try {
                    const keys = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (k.includes('-auth-token') || k.startsWith('sb-'))) keys.push(k);
                    }
                    [...keys, 'busint_user', 'busint_productora', 'busint_universal_plant']
                        .forEach(k => localStorage.removeItem(k));
                    sessionStorage.clear();
                } catch (_) {}
                window.location.replace('login.html');
            };
        }
    }

    /* ══════════════════════════════════════════════════════════
       INIT PRINCIPAL
    ══════════════════════════════════════════════════════════ */
    async function init() {
        const root = document.getElementById('view-module') || document;

        /* 1. Conectar eventos (no dependen de datos) */
        _bindEvents(root);

        /* 2. Esperar currentUser enriquecido (máx 5 s) */
        const u = await _waitForUser(5000);

        /* 3. Obtener foto_url / portada_url de Supabase */
        const extra = await _fetchPerfilExtra();
        if (extra) {
            if (extra.foto_url)             u.foto_url             = extra.foto_url;
            if (extra.portada_url)          u.portada_url          = extra.portada_url;
            if (extra.estado_personalizado) u.estado_personalizado = extra.estado_personalizado;
            if (window.currentUser) Object.assign(window.currentUser, extra);
        }

        /* 4. Renderizar */
        _renderPortada(root, u);
        _renderAvatar(root, u);
        _populateFields(root, u);

        /* 5. Mostrar contenido real */
        _showReal(root);
    }

    init();

})();
