/**
 * perfil-editor.js — Editor de perfil de usuario
 * ═══════════════════════════════════════════════════
 * Modal de edición de perfil con subida de imágenes
 */

'use strict';

window.PerfilEditor = (function () {

    const MH = window.ModalHelper;
    const PERFILES_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/perfiles`;

    const COLOMBIA_MAP = {
        'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Apartadó', 'Rionegro', 'Sabaneta', 'Caldas', 'Copacabana', 'La Estrella', 'Girardota', 'Marinilla', 'Guarne', 'Turbo', 'Caucasia'],
        'Bogotá D.C.': ['Bogotá D.C.'],
        'Valle del Cauca': ['Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Yumbo', 'Cartago', 'Buga', 'Jamundí', 'Candelaria', 'Florida'],
        'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Puerto Colombia', 'Galapa'],
        'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro'],
        'Bolívar': ['Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar'],
        'Cundinamarca': ['Soacha', 'Facatativá', 'Fusagasugá', 'Zipaquirá', 'Chía', 'Mosquera', 'Madrid', 'Funza', 'Cajicá', 'Girardot'],
        'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
        'Caldas': ['Manizales', 'Villamaría', 'Chinchiná', 'La Dorada'],
        'Quindío': ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro', 'Quimbaya'],
        'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Chaparral', 'Líbano'],
        'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata'],
        'Norte de Santander': ['Cúcuta', 'Ocaña', 'Villa del Rosario', 'Los Patios', 'Pamplona'],
        'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López'],
        'Córdoba': ['Montería', 'Cereté', 'Sahagún', 'Lorica', 'Montelíbano'],
        'Cesar': ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia'],
        'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco'],
        'Nariño': ['Pasto', 'Tumaco', 'Ipiales', 'Túquerres'],
        'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía'],
        'Boyacá': ['Tunja', 'Sogamoso', 'Duitama', 'Chiquinquirá', 'Puerto Boyacá'],
        'Sucre': ['Sincelejo', 'Corozal', 'San Marcos', 'Tolú'],
        'Casanare': ['Yopal', 'Aguazul', 'Villanueva'],
        'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'Fonseca', 'San Juan del Cesar'],
        'Chocó': ['Quibdó', 'Istmina', 'Condoto'],
        'Caquetá': ['Florencia', 'San Vicente del Caguán'],
        'Putumayo': ['Mocoa', 'Puerto Asís', 'Orito'],
        'Arauca': ['Arauca', 'Tame', 'Saravena'],
        'Amazonas': ['Leticia'],
        'San Andrés y Providencia': ['San Andrés'],
        'Guaviare': ['San José del Guaviare'],
        'Vaupés': ['Mitú'],
        'Vichada': ['Puerto Carreño'],
        'Guainía': ['Inírida']
    };

    /** Calcula la antigüedad en años y meses */
    function _calcularAntiguedad(fechaStr) {
        if (!fechaStr) return '';
        const inicio = new Date(fechaStr);
        if (isNaN(inicio.getTime())) return '';
        const hoy = new Date();
        if (inicio > hoy) return '0 meses';

        let anos = hoy.getFullYear() - inicio.getFullYear();
        let meses = hoy.getMonth() - inicio.getMonth();
        if (meses < 0) {
            anos--;
            meses += 12;
        }
        if (anos <= 0) {
            return meses === 1 ? '1 mes' : `${meses} meses`;
        }
        if (meses === 0) {
            return anos === 1 ? '1 año' : `${anos} años`;
        }
        const strAnos = anos === 1 ? '1 año' : `${anos} años`;
        const strMeses = meses === 1 ? '1 mes' : `${meses} meses`;
        return `${strAnos}, ${strMeses}`;
    }

    /** Formatea fechas DD/MM/YYYY a YYYY-MM-DD para input type=date */
    function _formatDateForInput(fecha) {
        if (!fecha) return '';
        const str = String(fecha).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const partes = str.split(/[\/\-]/);
        if (partes.length === 3) {
            if (partes[0].length === 4) return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
            if (partes[2].length === 4) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return '';
    }

    const DIVISIONES_DISPONIBLES = [
        'INGRESOS',
        'DESPACHOS',
        'PRODUCCION',
        'INSUMOS',
        'CORTE',
        'TELAS',
        'ADMINISTRACION'
    ];

    const SEDES_DISPONIBLES = [
        'CDI',
        'RETAIL'
    ];

    /** Obtiene lista de productoras desde Supabase o caché */
    async function _obtenerProductoras() {
        try {
            const cached = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
            if (cached && cached.length) return cached;
        } catch (_) { }

        try {
            const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (sb) {
                const { data, error } = await sb.from('productoras').select('*').order('productora', { ascending: true });
                if (!error && data && data.length) {
                    try { localStorage.setItem('busint_productoras_cache', JSON.stringify(data)); } catch (_) { }
                    return data;
                }
            }
        } catch (e) {
            console.warn('[PerfilEditor] Error obteniendo productoras:', e);
        }

        return [
            { id_productora: 1, productora: 'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.' },
            { id_productora: 2, productora: 'TEXTILES Y CREACIONES LOS ANGELES S.A.S.' },
            { id_productora: 3, productora: 'HACEMOS MODA S.A.S.' },
            { id_productora: 4, productora: 'INVERSIONES URBANA S.A.S.' }
        ];
    }

    /**
     * Abre el modal de edición de perfil
     */
    async function abrirEditor() {
        const user = window.currentUser || {};
        console.log('[PerfilEditor] Abriendo editor para usuario:', user);

        const productorasList = await _obtenerProductoras();

        const gradient = _getGradient(user.ROL);
        const avatar = user.foto_url
            ? `<div class="p-sheet-avatar" style="background:url(${user.foto_url}) center/cover">&nbsp;</div>`
            : MH.avatarInitials(user.USUARIO || 'Usuario', gradient);

        const fechaRaw = user.FECHA_CONTRATACION || user.fecha_contratacion || user.FECHA_INGRESO || user.fecha_ingreso || '';
        const fechaInputVal = _formatDateForInput(fechaRaw);
        const fechaNacInputVal = _formatDateForInput(user.fecha_nacimiento || user.FECHA_NACIMIENTO || '');
        const antiguedadCalculada = user.ANTIGUEDAD || user.antiguedad || _calcularAntiguedad(fechaInputVal) || '';

        const dptoActual = user.DEPARTAMENTO || user.departamento || 'Antioquia';
        const ciudadActual = user.CIUDAD || user.ciudad || 'Medellín';
        const prodActual = String(user.PRODUCTORA || user.productora || '').trim().toUpperCase();
        const divActual = String(user.DIVISION || user.division || 'ADMINISTRACION').trim().toUpperCase();
        const sedeActual = String(user.SEDE || user.sede || 'CDI').trim().toUpperCase();

        const content = `
            <style>
                .pe-form-container {
                    padding: 10px 18px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    background: #ffffff;
                }
                .pe-card {
                    background: #ffffff;
                    border: 1px solid #eef2f6;
                    border-radius: 12px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                }
                .pe-card-title {
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #2563eb;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 2px;
                }
                .pe-grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .pe-field {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .pe-label {
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: #475569;
                }
                .pe-input, .pe-select {
                    width: 100%;
                    padding: 6px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 7px;
                    background: #ffffff;
                    font-size: 0.8rem;
                    color: #0f172a;
                    font-family: inherit;
                    outline: none;
                    box-sizing: border-box;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    height: 32px;
                }
                .pe-input:focus, .pe-select:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2.5px rgba(59, 130, 246, 0.15);
                }
                .pe-input[readonly] {
                    background: #f8fafc;
                    color: #64748b;
                    cursor: default;
                    border-color: #e2e8f0;
                }
            </style>

            <div class="pe-form-container">
                <!-- 1. Datos Personales & Laborales -->
                <div class="pe-card">
                    <div class="pe-card-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>Identidad & Cargo</span>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Nombre completo</label>
                        <input class="pe-input" id="pe-nombre" value="${user.USUARIO || user.full_name || ''}" placeholder="Tu nombre">
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Cédula</label>
                        <input class="pe-input" id="pe-cedula" value="${user.cedula || user.CEDULA || user.ID_USUARIO || ''}" placeholder="Número de cédula">
                    </div>

                    <div class="pe-grid-2">
                        <div class="pe-field">
                            <label class="pe-label">Cargo</label>
                            <input class="pe-input" id="pe-cargo" value="${user.CARGO || user.cargo || ''}" placeholder="Ej: Analista Senior">
                        </div>
                        <div class="pe-field">
                            <label class="pe-label">Área</label>
                            <input class="pe-input" id="pe-area" value="${user.AREA || user.area || ''}" placeholder="Ej: Calidad">
                        </div>
                    </div>

                    <div class="pe-grid-2">
                        <div class="pe-field">
                            <label class="pe-label">Fecha de ingreso</label>
                            <input class="pe-input" type="date" id="pe-fecha-ingreso" value="${fechaInputVal}">
                        </div>
                        <div class="pe-field">
                            <label class="pe-label">Antigüedad (calculada)</label>
                            <input class="pe-input" id="pe-antiguedad" value="${antiguedadCalculada}" readonly placeholder="Calculando...">
                        </div>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Fecha de cumpleaños</label>
                        <input class="pe-input" type="date" id="pe-fecha-nacimiento" value="${fechaNacInputVal}">
                    </div>
                </div>

                <!-- 2. Organización & Empresa -->
                <div class="pe-card">
                    <div class="pe-card-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        <span>Organización & Empresa</span>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Productora disponible</label>
                        <select class="pe-select" id="pe-productora">
                            <option value="">Seleccione productora...</option>
                            ${productorasList.map(p => {
            const nom = p.productora || p.nombre || '';
            const isSel = nom.toUpperCase() === prodActual;
            return `<option value="${nom}" ${isSel ? 'selected' : ''}>${nom}</option>`;
        }).join('')}
                        </select>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Sede</label>
                        <select class="pe-select" id="pe-sede">
                            ${SEDES_DISPONIBLES.map(s => `
                                <option value="${s}" ${s === sedeActual ? 'selected' : ''}>${s}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <!-- 3. Contacto -->
                <div class="pe-card">
                    <div class="pe-card-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span>Contacto Directo</span>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Correo electrónico</label>
                        <input class="pe-input" id="pe-email" type="email" value="${user.EMAIL || user.CORREO || user.email || ''}" placeholder="correo@empresa.com">
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Teléfono / Celular</label>
                        <input class="pe-input" id="pe-telefono" type="tel" value="${user.TELEFONO || user.telefono || user.phone || ''}" placeholder="Ej: 3001234567">
                    </div>
                </div>

                <!-- 4. Ubicación en Colombia -->
                <div class="pe-card">
                    <div class="pe-card-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>Ubicación en Colombia</span>
                    </div>

                    <div class="pe-grid-2">
                        <div class="pe-field">
                            <label class="pe-label">País</label>
                            <input class="pe-input" id="pe-pais" value="Colombia" readonly>
                        </div>
                        <div class="pe-field">
                            <label class="pe-label">Departamento</label>
                            <select class="pe-select" id="pe-departamento">
                                ${Object.keys(COLOMBIA_MAP).map(dep => `
                                    <option value="${dep}" ${dep.toLowerCase() === dptoActual.toLowerCase() ? 'selected' : ''}>${dep}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Ciudad / Municipio</label>
                        <select class="pe-select" id="pe-ciudad">
                            <!-- Se puebla dinámicamente según departamento -->
                        </select>
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Dirección exacta</label>
                        <input class="pe-input" id="pe-direccion" value="${user.DIRECCION || user.direccion || ''}" placeholder="Calle, Carrera, No.">
                    </div>

                    <div class="pe-field">
                        <label class="pe-label">Barrio</label>
                        <input class="pe-input" id="pe-barrio" value="${user.BARRIO || user.barrio || ''}" placeholder="Barrio">
                    </div>
                </div>
            </div>
            
            <div class="p-sheet-actions">
                <button class="p-btn-primary" id="pe-guardar">
                    ${MH.svg('<polyline points="20 6 9 17 4 12"/>')} Guardar cambios
                </button>
                <button class="p-btn-secondary" id="pe-cancelar">Cancelar</button>
            </div>
        `;

        const sheet = MH.openSheet({
            title: 'Editar perfil',
            subtitle: user.CORREO || user.EMAIL || user.email || '',
            avatar: avatar,
            content: content
        });

        // Eventos interactivos
        _setupEventHandlers(sheet, user, ciudadActual);
    }

    /**
     * Configura los event handlers del modal y selects interactivos
     */
    function _setupEventHandlers(sheet, user, ciudadInicial) {
        // 1. Manejo dinámico de Ciudades según Departamento de Colombia
        const selectDpto = sheet.querySelector('#pe-departamento');
        const selectCiudad = sheet.querySelector('#pe-ciudad');

        function actualizarCiudades(ciudadSelec = '') {
            const dpto = selectDpto?.value;
            const ciudades = COLOMBIA_MAP[dpto] || ['Otra'];
            if (selectCiudad) {
                selectCiudad.innerHTML = ciudades.map(c => `
                    <option value="${c}" ${c.toLowerCase() === ciudadSelec.toLowerCase() ? 'selected' : ''}>${c}</option>
                `).join('');
                if (!ciudades.includes('Otra')) {
                    selectCiudad.innerHTML += `<option value="Otra">Otra ciudad...</option>`;
                }
            }
        }

        if (selectDpto) {
            actualizarCiudades(ciudadInicial);
            selectDpto.addEventListener('change', () => actualizarCiudades(''));
        }

        // 2. Cálculo automático de antigüedad con datepicker
        const inputFecha = sheet.querySelector('#pe-fecha-ingreso');
        const inputAntiguedad = sheet.querySelector('#pe-antiguedad');
        if (inputFecha && inputAntiguedad) {
            inputFecha.addEventListener('input', () => {
                const calculada = _calcularAntiguedad(inputFecha.value);
                inputAntiguedad.value = calculada || '—';
            });
        }

        // Botón guardar
        const btnGuardar = sheet.querySelector('#pe-guardar');
        btnGuardar?.addEventListener('click', () => _guardarCambios(sheet, user));

        // Botón cancelar
        const btnCancelar = sheet.querySelector('#pe-cancelar');
        btnCancelar?.addEventListener('click', () => MH.closeSheet());
    }

    /**
     * Comprime una imagen a JPEG ligero usando Canvas
     */
    function _comprimirImagen(file, maxDim = 1200, calidad = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.naturalWidth;
                    let h = img.naturalHeight;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else resolve(file);
                    }, 'image/jpeg', calidad);
                };
                img.onerror = () => resolve(file);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Maneja la subida de imágenes
     */
    async function _handleImageUpload(event, tipo, sheet) {
        const rawFile = event.target.files?.[0];
        if (!rawFile) return;

        // Validar tipo
        if (!rawFile.type.startsWith('image/')) {
            MH.toast('Solo se permiten imágenes', true);
            return;
        }

        console.log(`[PerfilEditor] Procesando y comprimiendo ${tipo}:`, rawFile.name);
        const file = await _comprimirImagen(rawFile, tipo === 'foto' ? 800 : 1600, 0.85);
        console.log(`[PerfilEditor] Tamaño optimizado: ${(file.size / 1024).toFixed(1)} KB`);

        try {
            // 1. Obtener URL firmada para subir
            const session = await _getSession();
            const response = await fetch(PERFILES_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({
                    accion: 'SUBIR_FOTO',
                    tipo: tipo
                })
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const { uploadUrl, publicUrl } = result.data;

            // 2. Subir archivo a Storage
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            if (!uploadResponse.ok) throw new Error('Error al subir archivo');

            // 3. Actualizar vista previa
            const preview = sheet.querySelector(`#preview-${tipo}`);
            if (preview) {
                if (tipo === 'foto') {
                    preview.innerHTML = `<img src="${publicUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
                } else {
                    preview.src = publicUrl;
                }
            }

            // 4. Guardar URL en el perfil inmediatamente
            await _actualizarCampo(tipo === 'foto' ? 'foto_url' : 'portada_url', publicUrl);

            MH.toast('Imagen subida correctamente');

        } catch (error) {
            console.error('[PerfilEditor] Error al subir imagen:', error);
            MH.toast('Error al subir la imagen: ' + error.message, true);
        }
    }

    /**
     * Maneja la eliminación de imágenes
     */
    async function _handleImageDelete(tipo, sheet) {
        if (!confirm('¿Eliminar la foto de perfil?')) return;

        try {
            await _actualizarCampo('foto_url', null);

            const preview = sheet.querySelector('#preview-foto');
            const gradient = _getGradient(window.currentUser?.ROL);
            if (preview) {
                preview.innerHTML = _getInitials(window.currentUser?.USUARIO || 'US');
                preview.style.background = gradient;
            }

            MH.toast('Foto eliminada correctamente');

        } catch (error) {
            console.error('[PerfilEditor] Error al eliminar foto:', error);
            MH.toast('Error al eliminar la foto', true);
        }
    }

    /**
     * Guarda los cambios del perfil
     */
    async function _guardarCambios(sheet, user) {
        const btn = sheet.querySelector('#pe-guardar');
        if (!btn) return;

        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const payload = {
                accion: 'ACTUALIZAR_PERFIL',
                full_name: sheet.querySelector('#pe-nombre')?.value.trim(),
                USUARIO: sheet.querySelector('#pe-nombre')?.value.trim(),
                cedula: sheet.querySelector('#pe-cedula')?.value.trim(),
                CEDULA: sheet.querySelector('#pe-cedula')?.value.trim(),
                email: sheet.querySelector('#pe-email')?.value.trim(),
                EMAIL: sheet.querySelector('#pe-email')?.value.trim(),
                CORREO: sheet.querySelector('#pe-email')?.value.trim(),
                telefono: sheet.querySelector('#pe-telefono')?.value.trim(),
                TELEFONO: sheet.querySelector('#pe-telefono')?.value.trim(),
                cargo: sheet.querySelector('#pe-cargo')?.value.trim(),
                CARGO: sheet.querySelector('#pe-cargo')?.value.trim(),
                area: sheet.querySelector('#pe-area')?.value.trim(),
                AREA: sheet.querySelector('#pe-area')?.value.trim(),
                fecha_contratacion: sheet.querySelector('#pe-fecha-ingreso')?.value.trim(),
                FECHA_CONTRATACION: sheet.querySelector('#pe-fecha-ingreso')?.value.trim(),
                fecha_nacimiento: sheet.querySelector('#pe-fecha-nacimiento')?.value.trim(),
                FECHA_NACIMIENTO: sheet.querySelector('#pe-fecha-nacimiento')?.value.trim(),
                antiguedad: sheet.querySelector('#pe-antiguedad')?.value.trim(),
                ANTIGUEDAD: sheet.querySelector('#pe-antiguedad')?.value.trim(),
                productora: sheet.querySelector('#pe-productora')?.value.trim(),
                PRODUCTORA: sheet.querySelector('#pe-productora')?.value.trim(),
                sede: sheet.querySelector('#pe-sede')?.value.trim(),
                SEDE: sheet.querySelector('#pe-sede')?.value.trim(),
                pais: sheet.querySelector('#pe-pais')?.value.trim(),
                PAIS: sheet.querySelector('#pe-pais')?.value.trim(),
                departamento: sheet.querySelector('#pe-departamento')?.value.trim(),
                DEPARTAMENTO: sheet.querySelector('#pe-departamento')?.value.trim(),
                ciudad: sheet.querySelector('#pe-ciudad')?.value.trim(),
                CIUDAD: sheet.querySelector('#pe-ciudad')?.value.trim(),
                direccion: sheet.querySelector('#pe-direccion')?.value.trim(),
                DIRECCION: sheet.querySelector('#pe-direccion')?.value.trim(),
                barrio: sheet.querySelector('#pe-barrio')?.value.trim(),
                BARRIO: sheet.querySelector('#pe-barrio')?.value.trim(),
            };

            const session = await _getSession();
            const response = await fetch(PERFILES_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            // Actualizar currentUser en memoria
            Object.assign(window.currentUser, payload);

            MH.toast('Perfil actualizado correctamente');
            MH.closeSheet();

            // Recargar el módulo de perfil
            setTimeout(() => {
                if (window.AppRouter?.navigate) {
                    window.AppRouter.navigate('perfil');
                }
            }, 300);

        } catch (error) {
            console.error('[PerfilEditor] Error al guardar:', error);
            MH.toast('Error al guardar los cambios: ' + error.message, true);
            btn.disabled = false;
            btn.innerHTML = `${MH.svg('<polyline points="20 6 9 17 4 12"/>')} Guardar cambios`;
        }
    }

    /**
     * Actualiza un campo específico del perfil
     */
    async function _actualizarCampo(campo, valor) {
        const session = await _getSession();
        const payload = {
            accion: 'ACTUALIZAR_PERFIL',
            [campo]: valor
        };

        const response = await fetch(PERFILES_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        // Actualizar currentUser
        if (window.currentUser) {
            window.currentUser[campo] = valor;
        }
    }

    /**
     * Obtiene la sesión actual
     */
    async function _getSession() {
        const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!sb) throw new Error('Cliente Supabase no disponible');

        const { data: session, error } = await sb.auth.getSession();
        if (error || !session?.session) throw new Error('No hay sesión activa');

        return session.session;
    }

    /**
     * Obtiene el gradiente según el rol
     */
    function _getGradient(rol) {
        const gradients = {
            'ADMIN': 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            'MODERATOR': 'linear-gradient(135deg,#3b82f6,#06b6d4)',
            'USER-P': 'linear-gradient(135deg,#10b981,#059669)',
            'GUEST': 'linear-gradient(135deg,#f59e0b,#d97706)',
        };
        return gradients[rol] || 'linear-gradient(135deg,#64748b,#475569)';
    }

    /**
     * Obtiene las iniciales de un nombre
     */
    function _getInitials(name) {
        const parts = (name || '').trim().split(' ').filter(Boolean);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : (name || 'US').slice(0, 2).toUpperCase();
    }

    // API pública
    return {
        abrirEditor
    };
})();
