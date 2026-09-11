import { Toast } from '../../../components/Toast.js';
import { generarReporteCalidadHtml } from '../utils/generarReporteCalidadHtml.js';
import { generarMensajeWhatsAppCalidad, generarUrlWhatsApp } from '../utils/generarMensajeWhatsAppCalidad.js';

const TIPO_CONFIG = {
    AUDITORIA:     { color: '#8b5cf6', bg: '#f5f3ff', label: 'Auditoría'      },
    RONDA:         { color: '#06b6d4', bg: '#ecfeff', label: 'Ronda'          },
    CONTRAMUESTRA: { color: '#f59e0b', bg: '#fffbeb', label: 'Contramuestra'  },
    SEGUIMIENTO:   { color: '#ec4899', bg: '#fdf2f8', label: 'Seguimiento'    },
    APROBACION:    { color: '#10b981', bg: '#f0fdf4', label: 'Aprobación'     },
    CALIDAD:       { color: '#3b82f6', bg: '#eff6ff', label: 'Calidad'        },
    NOVEDAD:       { color: '#f97316', bg: '#fff7ed', label: 'Novedad'        }
};

const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

export class MisReportesSubView {
    constructor({ container, currentUser, dataService, onBack }) {
        this.container   = container;
        this.currentUser = currentUser;
        this.dataService = dataService;
        this.onBack      = onBack;

        this._reportes  = [];
        this._filtrados = [];
        this._loading   = false;

        // Por defecto, buscar SIEMPRE por hoy (YYYY-MM-DD en hora local)
        const pad = (n) => String(n).padStart(2, '0');
        const hoy = new Date();
        this._filtroFecha = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

        this._render();
        this._cargarReportes();
    }

    // ─────────────────────────────────────────────────────────
    _render() {
        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn" id="ar-btn-back" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                         stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Mis Reportes</h1>
                <div class="header-actions">
                    <button class="icon-btn" id="ar-btn-cal" aria-label="Seleccionar fecha" title="Cambiar fecha">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                             stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    </button>
                    <input type="date" id="ar-fecha" value="${this._filtroFecha}"
                           aria-label="Fecha de reportes"
                           style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;">
                </div>
            </div>

            <div class="ar-content">
                <div class="ar-loader" id="ar-loader">
                    <div class="ar-spinner"></div>
                    <span>Cargando reportes…</span>
                </div>
                <div id="ar-list" class="ar-list" style="display:none;"></div>
                <div id="ar-empty" class="ar-empty-state" style="display:none;">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none"
                         stroke="#94a3b8" stroke-width="1.5"
                         style="margin:0 auto 12px;display:block;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <p class="ar-empty-title">Sin reportes</p>
                    <p class="ar-empty-sub" id="ar-empty-sub">No hay reportes registrados para la fecha seleccionada</p>
                </div>
            </div>
        `;

        this._bindEvents();
        this._actualizarSubtituloFecha();
    }

    _bindEvents() {
        this.container.querySelector('#ar-btn-back')
            ?.addEventListener('click', () => this.onBack?.());

        const inputFecha = this.container.querySelector('#ar-fecha');
        const btnCal     = this.container.querySelector('#ar-btn-cal');

        // El botón de calendario abre el date picker nativo del navegador
        btnCal?.addEventListener('click', () => {
            try {
                if (typeof inputFecha?.showPicker === 'function') {
                    inputFecha.showPicker();
                } else {
                    inputFecha?.click();
                }
            } catch (_) {}
        });

        // Búsqueda instantánea en cuanto el usuario selecciona cualquier fecha
        inputFecha?.addEventListener('change', () => {
            const v = inputFecha.value;
            if (!v) return;
            this._filtroFecha = v;
            this._actualizarSubtituloFecha();
            this._cargarReportes();
        });
    }

    _actualizarSubtituloFecha() {
        const sub = this.container?.querySelector('#ar-subtitulo-fecha');
        if (!sub) return;
        const pad = (n) => String(n).padStart(2, '0');
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

        if (this._filtroFecha === hoyStr) {
            sub.textContent = 'Mostrando reportes de Hoy';
        } else if (this._filtroFecha) {
            const parts = this._filtroFecha.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                const fechaTxt = d.toLocaleDateString('es-CO', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                });
                sub.textContent = `Reportes del ${fechaTxt}`;
            } else {
                sub.textContent = `Reportes del ${this._filtroFecha}`;
            }
        } else {
            sub.textContent = 'Reportes filtrados por fecha';
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Carga de la lista por fecha específica (HOY por defecto)
    // ─────────────────────────────────────────────────────────
    async _cargarReportes() {
        if (this._loading) return;
        this._loading = true;
        this._showLoader(true);

        try {
            const res = await this.dataService.listarReportes({
                fecha:      this._filtroFecha,
                rol:        this.currentUser?.rol   || this.currentUser?.ROL   || '',
                productora: this.currentUser?.idProductora || ''
            });

            this._reportes = Array.isArray(res) ? res : (res?.data || []);
            this._aplicarFiltros();
        } catch (err) {
            console.error('[MisReportesSubView]', err);
            Toast.error('Error al cargar reportes: ' + err.message);
            this._showEmpty();
        } finally {
            this._loading = false;
            this._showLoader(false);
        }
    }

    _aplicarFiltros() {
        this._filtrados = [...this._reportes];
        // Sort por fecha y hora (más recientes primero)
        this._filtrados.sort((a, b) => {
            const fechaA = new Date(a.FECHA || 0).getTime();
            const fechaB = new Date(b.FECHA || 0).getTime();
            return fechaB - fechaA;
        });
        this._renderLista();
    }

    // ─────────────────────────────────────────────────────────
    //  Lista de cards — cada una abre el reporte al tocarla
    // ─────────────────────────────────────────────────────────
    _renderLista() {
        const listEl  = this.container?.querySelector('#ar-list');
        const emptyEl = this.container?.querySelector('#ar-empty');
        if (!listEl || !emptyEl) return;

        if (!this._filtrados.length) {
            listEl.style.display  = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.style.display  = 'flex';

        listEl.innerHTML = this._filtrados.map((r, idx) => {
            const tipo  = (r.TIPO_VISITA || 'AUDITORIA').toUpperCase();
            const cfg   = TIPO_CONFIG[tipo] || TIPO_CONFIG.AUDITORIA;
            const fecha = this._formatFecha(r.FECHA || '');
            const lote  = r.LOTE || r.ID || '—';
            const ref   = r.REFERENCIA || '—';
            const planta = r.PLANTA || '—';
            const concl = r.CONCLUSION || '—';
            const clower = concl.toLowerCase();
            const conclColor = clower.includes('aprobado') || clower.includes('satisfactorio') || clower.includes('cumple')
                ? '#10b981'
                : clower.includes('rechazado') || clower.includes('no cumple') ? '#f43f5e' : '#64748b';

            return `
                <div class="ar-report-card ar-card-clickable" data-idx="${idx}" data-id="${r.ID}" role="button" tabindex="0">
                    <div class="ar-card-top">
                        <span class="ar-tipo-badge" style="background:${cfg.bg};color:${cfg.color};">
                            ${cfg.label}
                        </span>
                        <span class="ar-card-fecha">${fecha}</span>
                    </div>
                    <div class="ar-card-body">
                        <p class="ar-card-lote">OP: <strong>${lote}</strong></p>
                        <p class="ar-card-ref">Ref: ${ref}</p>
                        <p class="ar-card-planta">Planta: <strong>${planta}</strong></p>
                        <p class="ar-card-concl">
                            <span class="ar-concl-label">Conclusión:</span>
                            <span class="ar-concl-val" style="color:${conclColor};font-weight:600;">${concl}</span>
                        </p>
                    </div>
                    <div class="ar-card-footer">
                        <span class="ar-card-hint">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                                 stroke="currentColor" stroke-width="2.5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            Ver / Imprimir
                        </span>
                        <button class="ar-card-btn-soporte" data-idx="${idx}" data-id="${r.ID}" title="Enviar soporte de calidad por WhatsApp o Correo oficial">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                                 stroke="currentColor" stroke-width="2.2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            <span>Enviar Soporte</span>
                        </button>
                    </div>
                    <div class="ar-card-overlay" id="ar-overlay-${idx}" style="display:none;">
                        <div class="ar-spinner" style="width:20px;height:20px;border-width:2px;"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click en botón de envío explícito de soporte
        listEl.querySelectorAll('.ar-card-btn-soporte').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                const id  = btn.dataset.id;
                const card = btn.closest('.ar-report-card');
                this._abrirModalSoporte(idx, id, card);
            });
        });

        // Bind click en cada card para ver / imprimir
        listEl.querySelectorAll('.ar-card-clickable').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.ar-card-btn-soporte')) return;
                const idx = parseInt(card.dataset.idx);
                const id  = card.dataset.id;
                this._abrirReporte(idx, id, card);
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    //  Abrir reporte: obtener datos completos bajo demanda
    //  y pasar a la plantilla de impresión
    // ─────────────────────────────────────────────────────────
    async _abrirReporte(idx, idReporte, cardEl) {
        // Mostrar spinner en la propia card
        const overlay = cardEl.querySelector(`#ar-overlay-${idx}`);
        if (overlay) overlay.style.display = 'flex';
        cardEl.style.pointerEvents = 'none';

        try {
            const res = await this.dataService.obtenerReporte(idReporte);
            const reporte = res?.data || res;

            if (!reporte) throw new Error('No se recibieron datos del reporte');

            // Pasar datos completos a la plantilla vía localStorage
            // (la plantilla los lee y los borra al cargar)
            localStorage.setItem('printReporteCalidad', JSON.stringify(reporte));

            // Construir URL absoluta a plantillas/calidad.html relativa al index.html de la SPA
            // window.location.pathname puede ser "/index.html" o "/" — quitamos el archivo final
            const pathname = window.location.pathname.replace(/\/[^/]*\.html$/, '/').replace(/\/$/, '');
            const url = `${window.location.origin}${pathname}/plantillas/calidad.html`;
            window.open(url, '_blank');

        } catch (err) {
            console.error('[MisReportesSubView._abrirReporte]', err);
            Toast.error('Error al cargar el reporte: ' + err.message);
        } finally {
            if (overlay) overlay.style.display = 'none';
            cardEl.style.pointerEvents = '';
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Envío explícito de soporte (WhatsApp / Correo con .html)
    // ─────────────────────────────────────────────────────────
    async _abrirModalSoporte(idx, idReporte, cardEl) {
        const overlay = cardEl.querySelector(`#ar-overlay-${idx}`);
        if (overlay) overlay.style.display = 'flex';
        cardEl.style.pointerEvents = 'none';

        try {
            const res = await this.dataService.obtenerReporte(idReporte);
            const reporte = res?.data || res;
            if (!reporte) throw new Error('No se pudo obtener la información completa del reporte');

            // Buscar datos actuales del taller/planta en Supabase (tabla plantas) usando el campo planta
            const plantaReporte = String(reporte.planta || reporte.PLANTA || '').trim().toUpperCase();
            let idPlanta = '';
            let nombrePlanta = plantaReporte;
            let telefono = '';
            let correo = '';
            let isCreated = false;

            if (this.dataService && typeof this.dataService.getPlants === 'function' && plantaReporte) {
                try {
                    const plants = await this.dataService.getPlants();
                    
                    // Match EXACTO por campo planta en tabla plantas
                    const match = (plants || []).find(p => {
                        const pPlanta = String(p.planta || p.nombre || '').trim().toUpperCase();
                        return pPlanta === plantaReporte;
                    });

                    if (match) {
                        isCreated = true;
                        idPlanta = String(match.id || match.nit || match.id_planta || '').trim();
                        nombrePlanta = String(match.nombre || match.planta || '').trim().toUpperCase();
                        telefono = String(match.telefono || match.tel || '').trim();
                        correo = String(match.email || match.correo || '').trim();
                    } else {
                        // Si no existe, crear el registro usando EF
                        try {
                            // Generar ID temporal si no existe: usar hash del nombre de planta
                            let idTemporal = String(reporte.id_planta || reporte.ID_PLANTA || reporte.nit || '').trim();
                            if (!idTemporal) {
                                // Generar ID numérico simple basado en el nombre
                                const hash = plantaReporte.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                idTemporal = String(9000000000 + (hash % 999999999)); // Rango 9xxxxxxxx
                            }

                            const resultado = await this.dataService.guardarOActualizarPlanta({
                                id_planta: idTemporal,
                                planta: plantaReporte,
                                correo: String(reporte.correo || reporte.CORREO || reporte.email || '').trim(),
                                telefono: String(reporte.telefono || reporte.TELEFONO || '').trim()
                            });
                            if (resultado?.success) {
                                isCreated = true;
                                // Recargar para obtener los datos creados
                                const plantsUpdated = await this.dataService.getPlants();
                                const matchNew = (plantsUpdated || []).find(p => {
                                    const pPlanta = String(p.planta || p.nombre || '').trim().toUpperCase();
                                    return pPlanta === plantaReporte;
                                });
                                if (matchNew) {
                                    idPlanta = String(matchNew.id || matchNew.nit || matchNew.id_planta || '').trim();
                                    nombrePlanta = String(matchNew.nombre || matchNew.planta || '').trim().toUpperCase();
                                    telefono = String(matchNew.telefono || matchNew.tel || '').trim();
                                    correo = String(matchNew.email || matchNew.correo || '').trim();
                                }
                            }
                        } catch (createErr) {
                            console.warn('[MisReportesSubView] Error al crear planta:', createErr);
                        }
                    }
                } catch (err) {
                    console.warn('[MisReportesSubView] Error al buscar planta:', err);
                }
            }

            this._mostrarModalSoporte(reporte, {
                idPlanta,
                nombrePlanta,
                telefono,
                correo,
                isCreated
            });

        } catch (err) {
            console.error('[MisReportesSubView._abrirModalSoporte]', err);
            Toast.error('Error al preparar soporte: ' + err.message);
        } finally {
            if (overlay) overlay.style.display = 'none';
            cardEl.style.pointerEvents = '';
        }
    }

    _mostrarModalSoporte(reporte, plantaInfo) {
        document.getElementById('ar-modal-soporte-dialog')?.remove();

        const idReporte = reporte.id_reporte || reporte.ID || 'S/N';
        const op = reporte.op || reporte.lote || 'N/A';
        const ref = reporte.referencia || 'N/A';
        const conclusion = reporte.conclusion || 'N/A';
        const proceso = reporte.proceso || 'N/A';
        const cantidad = reporte.cantidad || reporte.cant || '0';
        const asuntoDefault = `Reporte de Calidad — OP ${op} / Ref. ${ref}`;

        const isAprob = conclusion.toLowerCase().includes('aprob') || conclusion.toLowerCase().includes('satis');
        const badgeColor = isAprob ? '#166534' : '#991B1B';
        const badgeBg = isAprob ? '#f0fdf4' : '#fef2f2';

        const modalBackdrop = document.createElement('div');
        modalBackdrop.id = 'ar-modal-soporte-dialog';
        modalBackdrop.className = 'ar-email-modal-backdrop';

        modalBackdrop.innerHTML = `
            <div class="ar-email-modal" role="dialog" aria-modal="true" style="max-width:580px;">
                <div class="ar-email-modal-header">
                    <h3 class="ar-email-modal-title">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        Enviar Soporte de Calidad
                    </h3>
                    <button class="ar-email-modal-close" id="ar-modal-soporte-close" aria-label="Cerrar">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="ar-email-modal-body">
                    <!-- Resumen del Reporte -->
                    <div class="ar-email-info-box">
                        <div class="ar-email-info-row">
                            <span>Radicado:</span>
                            <strong>#${idReporte}</strong>
                        </div>
                        <div class="ar-email-info-row">
                            <span>OP / Referencia:</span>
                            <strong>OP ${op} &bull; ${ref}</strong>
                        </div>
                        <div class="ar-email-info-row">
                            <span>Proceso / Cantidad:</span>
                            <strong>${proceso} &bull; ${cantidad} unds.</strong>
                        </div>
                        <div class="ar-email-info-row">
                            <span>Conclusión:</span>
                            <span style="font-weight:700; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:6px; font-size:11px;">
                                ${conclusion}
                            </span>
                        </div>
                    </div>

                    <!-- Datos del Taller / Planta en Supabase -->
                    <div class="ar-soporte-section-title">
                        <span>Datos del Taller / Planta</span>
                        <span class="ar-badge-planta ${plantaInfo.isCreated ? 'success' : 'warning'}" id="ar-planta-badge">
                            ${plantaInfo.isCreated 
                                ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Registrado en Supabase' 
                                : '⚠ Taller no registrado'}
                        </span>
                    </div>

                    <div class="ar-soporte-grid">
                        <div class="ar-email-form-group">
                            <label class="ar-email-label" for="ar-soporte-id">ID / NIT Planta *</label>
                            <input type="text" class="ar-email-input" id="ar-soporte-id"
                                   value="${plantaInfo.idPlanta}" placeholder="Ej: 1144167164" required>
                        </div>
                        <div class="ar-email-form-group">
                            <label class="ar-email-label" for="ar-soporte-nombre">Nombre de la Planta / Taller *</label>
                            <input type="text" class="ar-email-input" id="ar-soporte-nombre"
                                   value="${plantaInfo.nombrePlanta}" placeholder="Ej: TALLER CARLOS MENDOZA" required>
                        </div>
                    </div>

                    <div class="ar-soporte-grid">
                        <div class="ar-email-form-group">
                            <label class="ar-email-label" for="ar-soporte-tel">Teléfono / WhatsApp *</label>
                            <input type="tel" class="ar-email-input" id="ar-soporte-tel"
                                   value="${plantaInfo.telefono}" placeholder="Ej: 3168007979">
                        </div>
                        <div class="ar-email-form-group">
                            <label class="ar-email-label" for="ar-soporte-email">Correo Electrónico</label>
                            <input type="email" class="ar-email-input" id="ar-soporte-email"
                                   value="${plantaInfo.correo}" placeholder="taller@ejemplo.com">
                        </div>
                    </div>

                    <!-- Configuración Adicional de Correo -->
                    <div class="ar-soporte-grid" style="display: none;">
                        <div class="ar-email-form-group">
                            <label class="ar-email-label" for="ar-soporte-cc">Con Copia (CC - Opcional)</label>
                            <input type="text" class="ar-email-input" id="ar-soporte-cc"
                                   placeholder="correo1@tdm.com, correo2@tdm.com">
                        </div>
                        <div class="ar-email-form-group">
                            <label class="ar-email-label" for="ar-soporte-subj">Asunto (Para Correo)</label>
                            <input type="text" class="ar-email-input" id="ar-soporte-subj"
                                   value="${asuntoDefault}">
                        </div>
                    </div>

                    <div class="ar-email-badge-info">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span>
                            Al enviar por <strong>WhatsApp</strong> o <strong>Correo (.html)</strong>, o pulsar <strong>Guardar Taller</strong>, la información se confirmará y guardará directamente en Supabase (tabla plantas).
                        </span>
                    </div>

                    <!-- Acciones del Modal -->
                    <div class="ar-soporte-actions" style="margin-top: 6px;">
                        <button type="button" class="ar-email-btn-cancel" id="ar-modal-soporte-cancel">Cancelar</button>
                        
                        <button type="button" class="ar-btn-save-planta" id="ar-btn-guardar-planta" title="Guardar o actualizar datos de la planta en Supabase">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            <span>Guardar Taller</span>
                        </button>

                        <button type="button" class="ar-btn-whatsapp" id="ar-btn-send-whatsapp" title="Enviar soporte completo por WhatsApp">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span>Enviar por WhatsApp</span>
                        </button>

                        <button type="button" class="ar-btn-email" id="ar-btn-send-email" title="Enviar plantilla oficial .html adjunta por correo">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            <span>Enviar por Correo (.html)</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalBackdrop);

        const cerrar = () => modalBackdrop.remove();
        modalBackdrop.querySelector('#ar-modal-soporte-close')?.addEventListener('click', cerrar);
        modalBackdrop.querySelector('#ar-modal-soporte-cancel')?.addEventListener('click', cerrar);
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) cerrar();
        });

        // Función reutilizable para sincronizar datos del taller en Supabase
        const sincronizarPlanta = async (validarContacto = true) => {
            const idVal  = (modalBackdrop.querySelector('#ar-soporte-id')?.value || '').trim();
            const nomVal = (modalBackdrop.querySelector('#ar-soporte-nombre')?.value || '').trim().toUpperCase();
            const telVal = (modalBackdrop.querySelector('#ar-soporte-tel')?.value || '').trim();
            const corVal = (modalBackdrop.querySelector('#ar-soporte-email')?.value || '').trim();

            if (!idVal) {
                Toast.error('Por favor ingresa el ID o NIT numérico del taller');
                modalBackdrop.querySelector('#ar-soporte-id')?.focus();
                return null;
            }
            if (!nomVal) {
                Toast.error('Por favor ingresa el nombre de la planta/taller');
                modalBackdrop.querySelector('#ar-soporte-nombre')?.focus();
                return null;
            }
            if (validarContacto && !telVal && !corVal) {
                Toast.error('Se requiere registrar al menos teléfono o correo para el taller');
                return null;
            }

            if (this.dataService && typeof this.dataService.guardarOActualizarPlanta === 'function') {
                try {
                    await this.dataService.guardarOActualizarPlanta({
                        id_planta: idVal,
                        planta: nomVal,
                        correo: corVal,
                        telefono: telVal,
                        rol: 'GUEST'
                    });

                    // Actualizar estado en UI
                    const badgeEl = modalBackdrop.querySelector('#ar-planta-badge');
                    if (badgeEl) {
                        badgeEl.className = 'ar-badge-planta success';
                        badgeEl.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Registrado en Supabase';
                    }

                    // Actualizar datos locales en el reporte
                    reporte.planta = nomVal;
                    reporte.id_planta = idVal;
                    reporte.telefono = telVal;
                    reporte.correo = corVal;

                } catch (err) {
                    console.error('[MisReportesSubView.guardarPlanta]', err);
                    Toast.error('Advertencia al guardar taller en Supabase: ' + err.message);
                }
            }

            return { idVal, nomVal, telVal, corVal };
        };

        // 1. Guardar Taller en Supabase explícitamente
        const btnSavePlanta = modalBackdrop.querySelector('#ar-btn-guardar-planta');
        btnSavePlanta?.addEventListener('click', async () => {
            const origHtml = btnSavePlanta.innerHTML;
            btnSavePlanta.disabled = true;
            btnSavePlanta.innerHTML = '<div class="ar-spinner" style="width:12px;height:12px;border-width:2px;"></div> Guardando...';

            const res = await sincronizarPlanta(false);
            if (res) {
                Toast.success(`Taller "${res.nomVal}" sincronizado exitosamente en Supabase`);
            }
            btnSavePlanta.disabled = false;
            btnSavePlanta.innerHTML = origHtml;
        });

        // 2. Enviar por WhatsApp
        const btnWhatsApp = modalBackdrop.querySelector('#ar-btn-send-whatsapp');
        btnWhatsApp?.addEventListener('click', async () => {
            const telVal = (modalBackdrop.querySelector('#ar-soporte-tel')?.value || '').trim();
            if (!telVal) {
                Toast.error('Por favor ingresa el número de teléfono o WhatsApp del taller');
                modalBackdrop.querySelector('#ar-soporte-tel')?.focus();
                return;
            }

            const origHtml = btnWhatsApp.innerHTML;
            btnWhatsApp.disabled = true;
            btnWhatsApp.innerHTML = '<span>Procesando...</span>';

            const synced = await sincronizarPlanta(true);
            if (!synced) {
                btnWhatsApp.disabled = false;
                btnWhatsApp.innerHTML = origHtml;
                return;
            }

            // Construir mensaje enriquecido con toda la información útil
            const mensaje = generarMensajeWhatsAppCalidad(reporte);
            const waUrl = generarUrlWhatsApp(synced.telVal, mensaje);

            window.open(waUrl, '_blank');
            Toast.success('Mensaje de soporte preparado para WhatsApp y taller sincronizado');

            btnWhatsApp.disabled = false;
            btnWhatsApp.innerHTML = origHtml;
        });

        // 3. Enviar por Correo (.html)
        const btnEmail = modalBackdrop.querySelector('#ar-btn-send-email');
        btnEmail?.addEventListener('click', async () => {
            const corVal = (modalBackdrop.querySelector('#ar-soporte-email')?.value || '').trim();
            const subVal = (modalBackdrop.querySelector('#ar-soporte-subj')?.value || asuntoDefault).trim();
            const ccRaw  = (modalBackdrop.querySelector('#ar-soporte-cc')?.value || '').trim();
            const ccList = ccRaw ? ccRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

            if (!corVal || !corVal.includes('@')) {
                Toast.error('Por favor ingresa un correo de destinatario válido');
                modalBackdrop.querySelector('#ar-soporte-email')?.focus();
                return;
            }

            const origHtml = btnEmail.innerHTML;
            btnEmail.disabled = true;
            btnEmail.innerHTML = `
                <div class="ar-spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#fff;"></div>
                <span>Enviando...</span>
            `;

            const synced = await sincronizarPlanta(true);
            if (!synced) {
                btnEmail.disabled = false;
                btnEmail.innerHTML = origHtml;
                return;
            }

            try {
                // Generar plantilla completa en .html oficial autocontenido
                const plantillaHtml = generarReporteCalidadHtml(reporte);

                if (!this.dataService || typeof this.dataService.enviarEmailReporte !== 'function') {
                    throw new Error('Servicio de envío de correo no disponible');
                }

                await this.dataService.enviarEmailReporte({
                    idReporte: idReporte,
                    email: corVal,
                    cc: ccList.length ? ccList : undefined,
                    subject: subVal,
                    nombre: synced.nomVal,
                    reporte: reporte,
                    attachmentHtml: plantillaHtml,
                    attachmentName: `reporte_${idReporte}.html`
                });

                Toast.success(`Reporte ${idReporte} enviado exitosamente a ${corVal}`);
                cerrar();
            } catch (err) {
                console.error('[MisReportesSubView.enviarEmail]', err);
                Toast.error('Error al enviar correo: ' + err.message);
                btnEmail.disabled = false;
                btnEmail.innerHTML = origHtml;
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    //  Helpers UI
    // ─────────────────────────────────────────────────────────
    _showLoader(show) {
        const loader = this.container?.querySelector('#ar-loader');
        const list   = this.container?.querySelector('#ar-list');
        const empty  = this.container?.querySelector('#ar-empty');
        if (!loader) return;
        loader.style.display = show ? 'flex' : 'none';
        if (show) {
            if (list)  list.style.display  = 'none';
            if (empty) empty.style.display = 'none';
        }
    }

    _showEmpty() {
        const listEl  = this.container?.querySelector('#ar-list');
        const emptyEl = this.container?.querySelector('#ar-empty');
        if (listEl)  listEl.style.display  = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
    }

    _formatFecha(raw) {
        if (!raw) return '—';
        try {
            const d = new Date(raw);
            if (isNaN(d)) return raw;
            return d.toLocaleDateString('es-CO', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (_) { return raw; }
    }

    unmount() {
        this.container = null;
    }
}
