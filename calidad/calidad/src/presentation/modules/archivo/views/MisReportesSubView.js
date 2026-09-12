import { Toast } from '../../../components/Toast.js';
import { generarReporteCalidadHtml } from '../utils/generarReporteCalidadHtml.js';
import { generarReporteCalidadHtmlStatico } from '../utils/generarReporteCalidadHtmlStatico.js';
import { generarMensajeWhatsAppCalidad, generarConsolidadoDiarioWhatsApp, generarUrlWhatsApp } from '../utils/generarMensajeWhatsAppCalidad.js';
import { compartirODescargarPdf } from '../utils/generarPdfCliente.js';

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
                    <button class="icon-btn" id="ar-btn-wa-consolidado" aria-label="Consolidado WhatsApp" title="Enviar consolidado diario por WhatsApp">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                    </button>
                    <label for="ar-fecha" class="icon-btn" id="ar-btn-cal" aria-label="Seleccionar fecha" title="Cambiar fecha" role="button" tabindex="0">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                             stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    </label>
                    <input type="date" id="ar-fecha" value="${this._filtroFecha}"
                           aria-label="Fecha de reportes"
                           style="position:absolute;width:0;height:0;opacity:0;border:none;padding:0;margin:0;">
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
        const btnWaConsolidado = this.container.querySelector('#ar-btn-wa-consolidado');

        // Consolidado de WhatsApp del día (o fecha filtrada)
        btnWaConsolidado?.addEventListener('click', () => {
            if (!this._reportes || !this._reportes.length) {
                Toast.info('No hay reportes registrados para la fecha seleccionada');
                return;
            }

            try {
                const mensaje = generarConsolidadoDiarioWhatsApp({
                    reportes: this._reportes,
                    currentUser: this.currentUser,
                    fecha: this._filtroFecha
                });

                if (!mensaje) {
                    Toast.error('No se pudo generar el consolidado de WhatsApp');
                    return;
                }

                const telefono = this.currentUser?.telefono || this.currentUser?.TELEFONO || '';
                const url = generarUrlWhatsApp(telefono, mensaje);
                window.open(url, '_blank');
                Toast.success('Consolidado de WhatsApp preparado');
            } catch (err) {
                console.error('[MisReportesSubView.consolidadoWA]', err);
                Toast.error('Error al generar consolidado de WhatsApp: ' + err.message);
            }
        });

        // El label[for="ar-fecha"] activa el date picker nativamente en todos los
        // navegadores incluyendo iOS Safari (no necesita JS — el label lo hace solo).
        // En teclado: Enter/Space sobre el label también lo abre.
        btnCal?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputFecha?.click();
            }
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
                        <div class="ar-card-actions-left">
                            <span class="ar-card-hint" title="Ver reporte en plantilla interactiva completa">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                                     stroke="currentColor" stroke-width="2.5">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                                Ver
                            </span>
                            <button class="ar-card-btn-basica" data-idx="${idx}" data-id="${r.ID}" title="Abrir plantilla básica tipo factura con recuadros">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                                <span>Básica</span>
                            </button>
                        </div>
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

        // Bind click en botón de plantilla básica
        listEl.querySelectorAll('.ar-card-btn-basica').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                const id  = btn.dataset.id;
                const card = btn.closest('.ar-report-card');
                this._abrirReporte(idx, id, card, 'calidad-basica.html');
            });
        });

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
                if (e.target.closest('.ar-card-btn-soporte') || e.target.closest('.ar-card-btn-basica')) return;
                const idx = parseInt(card.dataset.idx);
                const id  = card.dataset.id;
                this._abrirReporte(idx, id, card, 'calidad.html');
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    //  Abrir reporte: obtener datos completos bajo demanda
    //  y pasar a la plantilla de impresión
    // ─────────────────────────────────────────────────────────
    async _abrirReporte(idx, idReporte, cardEl, plantilla = 'calidad.html') {
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

            // Construir URL absoluta a plantillas/${plantilla} relativa al index.html de la SPA
            // window.location.pathname puede ser "/index.html" o "/" — quitamos el archivo final
            const pathname = window.location.pathname.replace(/\/[^/]*\.html$/, '/').replace(/\/$/, '');
            const url = `${window.location.origin}${pathname}/plantillas/${plantilla}`;
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
                        // Si no existe en tabla plantas, inicializar con los datos disponibles del reporte
                        idPlanta = String(reporte.id_planta || reporte.ID_PLANTA || reporte.nit || '').trim();
                        nombrePlanta = String(plantaReporte || reporte.planta || '').trim().toUpperCase();
                        telefono = String(reporte.telefono || reporte.TELEFONO || '').trim();
                        correo = String(reporte.correo || reporte.CORREO || reporte.email || '').trim();
                        isCreated = false;
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
        // Limpiar backdrops/sheets anteriores si existieran
        document.getElementById('ar-modal-soporte-backdrop')?.remove();
        document.getElementById('ar-modal-soporte-sheet')?.remove();
        document.getElementById('ar-modal-soporte-dialog')?.remove();

        const idReporte = reporte.id_reporte || reporte.ID || 'S/N';
        const op = reporte.op || reporte.lote || 'N/A';
        const ref = reporte.referencia || 'N/A';
        const asuntoDefault = `Reporte de Calidad — OP ${op} / Ref. ${ref}`;

        const backdropEl = document.createElement('div');
        backdropEl.id = 'ar-modal-soporte-backdrop';
        backdropEl.className = 'p-backdrop';

        const sheetEl = document.createElement('div');
        sheetEl.id = 'ar-modal-soporte-sheet';
        sheetEl.className = 'p-sheet';
        sheetEl.innerHTML = `
            <div class="p-sheet-handle"></div>
            <div id="ar-soporte-sheet-body"></div>
        `;

        document.body.appendChild(backdropEl);
        document.body.appendChild(sheetEl);

        // Animar apertura desde abajo (idéntico a Personas)
        requestAnimationFrame(() => {
            backdropEl.classList.add('open');
            sheetEl.classList.add('open');
        });

        const cerrar = () => {
            backdropEl.classList.remove('open');
            sheetEl.classList.remove('open');
            document.removeEventListener('keydown', onEscape);
            setTimeout(() => {
                backdropEl.remove();
                sheetEl.remove();
            }, 280);
        };

        const onEscape = (e) => {
            if (e.key === 'Escape') {
                cerrar();
            }
        };
        document.addEventListener('keydown', onEscape);
        backdropEl.addEventListener('click', cerrar);
        sheetEl.querySelector('.p-sheet-handle')?.addEventListener('click', cerrar);

        // SVGs reutilizables (estilo Personas)
        const SVG_WA    = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;
        const SVG_MAIL  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>`;
        const SVG_EDIT  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        const SVG_CHECK = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        const SVG_CLOSE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        const getPlantInits = (nombre) => {
            return (nombre || 'Taller').trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'P';
        };

        // Función para guardar en Supabase
        const sincronizarPlanta = async (idVal, nomVal, telVal, corVal, validarContacto = false) => {
            idVal  = (idVal || '').trim();
            nomVal = (nomVal || '').trim().toUpperCase();
            telVal = (telVal || '').trim();
            corVal = (corVal || '').trim();

            if (!idVal) {
                Toast.error('Por favor ingresa la cédula o NIT del taller');
                return null;
            }
            if (!nomVal) {
                Toast.error('Por favor ingresa el nombre de la planta/taller');
                return null;
            }
            if (validarContacto && !telVal && !corVal) {
                Toast.error('Se requiere registrar al menos teléfono o correo para el taller');
                return null;
            }

            if (this.dataService && typeof this.dataService.guardarOActualizarPlanta === 'function') {
                try {
                    const res = await this.dataService.guardarOActualizarPlanta({
                        id_planta: idVal,
                        planta: nomVal,
                        correo: corVal,
                        telefono: telVal,
                        rol: 'GUEST',
                        originalId: plantaInfo.idPlanta,
                        originalPlanta: plantaInfo.nombrePlanta
                    });

                    if (res && res.error) {
                        throw new Error(res.error || 'Error al guardar');
                    }

                    // Actualizar datos locales
                    plantaInfo.idPlanta = idVal;
                    plantaInfo.nombrePlanta = nomVal;
                    plantaInfo.telefono = telVal;
                    plantaInfo.correo = corVal;
                    plantaInfo.isCreated = true;

                    reporte.planta = nomVal;
                    reporte.id_planta = idVal;
                    reporte.telefono = telVal;
                    reporte.correo = corVal;

                    return { idVal, nomVal, telVal, corVal };
                } catch (err) {
                    console.error('[MisReportesSubView.guardarPlanta]', err);
                    Toast.error('Error al guardar taller en Supabase: ' + err.message);
                    return null;
                }
            }

            return { idVal, nomVal, telVal, corVal };
        };

        // ── Vista de Detalle (Modo Lectura / Acciones) ──
        const renderVistaDetalle = () => {
            const body = sheetEl.querySelector('#ar-soporte-sheet-body');
            if (!body) return;
            const inits = getPlantInits(plantaInfo.nombrePlanta);

            body.innerHTML = `
                <div class="p-sheet-head">
                    <div class="p-sheet-avatar" style="background:linear-gradient(135deg,#0284c7,#2563eb);border-radius:50%;font-size:1.15rem;font-weight:800;color:#fff;width:52px;height:52px;min-width:52px;min-height:52px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.12);">
                        ${inits}
                    </div>
                    <div style="min-width:0; overflow:hidden;">
                        <p class="p-sheet-name" style="margin:0 0 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${plantaInfo.nombrePlanta || 'Taller Sin Registrar'}</p>
                        <p class="p-sheet-email" style="margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${plantaInfo.correo || 'Sin correo registrado'}</p>
                    </div>
                </div>

                <div class="p-section">
                    <div class="p-section-title">Identificación</div>
                    <div class="p-row">
                        <span class="p-row-label">Cédula o Nit</span>
                        <span class="p-row-value" style="max-width:none; word-break:break-word; white-space:normal;">${plantaInfo.idPlanta || '—'}</span>
                    </div>
                    <div class="p-row">
                        <span class="p-row-label">Nombre de la Planta</span>
                        <span class="p-row-value" style="max-width:none; word-break:break-word; white-space:normal; text-align:right;">${plantaInfo.nombrePlanta || '—'}</span>
                    </div>
                </div>

                <div class="p-section">
                    <div class="p-section-title">Contacto</div>
                    <div class="ar-contact-row">
                        ${plantaInfo.telefono ? `
                        <button type="button" class="ar-contact-btn" id="ar-row-btn-wa" title="Enviar soporte por WhatsApp" aria-label="WhatsApp">
                            ${SVG_WA}
                        </button>
                        ` : '<span class="ar-contact-btn-placeholder"></span>'}
                        <div class="ar-contact-text">
                            <span class="ar-contact-lbl">Teléfono</span>
                            <span class="ar-contact-val">${plantaInfo.telefono || '—'}</span>
                        </div>
                    </div>
                    <div class="ar-contact-row">
                        ${plantaInfo.correo ? `
                        <button type="button" class="ar-contact-btn" id="ar-row-btn-mail" title="Enviar soporte por correo" aria-label="Correo">
                            ${SVG_MAIL}
                        </button>
                        ` : '<span class="ar-contact-btn-placeholder"></span>'}
                        <div class="ar-contact-text">
                            <span class="ar-contact-lbl">Correo</span>
                            <span class="ar-contact-val">${plantaInfo.correo || '—'}</span>
                        </div>
                    </div>
                    <div class="ar-contact-row">
                        <button type="button" class="ar-contact-btn" id="ar-row-btn-pdf" title="Generar PDF y compartir a WhatsApp o descargar" aria-label="Compartir PDF" style="color:#0284c7;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="12" y1="18" x2="12" y2="12"></line>
                                <line x1="9" y1="15" x2="15" y2="15"></line>
                            </svg>
                        </button>
                        <div class="ar-contact-text">
                            <span class="ar-contact-lbl">Documento PDF</span>
                            <span class="ar-contact-val">Compartir a WhatsApp / Descargar</span>
                        </div>
                    </div>
                </div>

                <div class="p-sheet-actions">
                    <button type="button" class="p-btn-primary" id="ar-btn-switch-edit" title="Editar taller">
                        ${SVG_EDIT} <span>Editar</span>
                    </button>
                    <button type="button" class="p-btn-secondary" id="ar-btn-sheet-close" title="Cerrar">
                        Cerrar
                    </button>
                </div>
            `;

            body.querySelector('#ar-btn-switch-edit')?.addEventListener('click', () => renderVistaEdicion());
            body.querySelector('#ar-btn-sheet-close')?.addEventListener('click', cerrar);

            // Generar y compartir / descargar PDF directamente en JS
            const btnPdf = body.querySelector('#ar-row-btn-pdf');
            btnPdf?.addEventListener('click', async () => {
                const origHtml = btnPdf.innerHTML;
                btnPdf.disabled = true;
                btnPdf.innerHTML = `<div class="ar-spinner" style="width:12px;height:12px;border-width:2px;border-top-color:#0284c7;"></div>`;

                try {
                    Toast.info('Generando PDF en el dispositivo...');
                    const plantillaHtml = generarReporteCalidadHtmlStatico(reporte);
                    const filename = `${idReporte}.pdf`;
                    const result = await compartirODescargarPdf({
                        html: plantillaHtml,
                        filename,
                        title: `Reporte de Calidad #${idReporte}`,
                        text: `Adjunto reporte de calidad OP ${op} / Ref. ${ref}`
                    });

                    if (result.shared) {
                        Toast.success('¡PDF compartido exitosamente!');
                    } else if (result.downloaded) {
                        Toast.success(`PDF descargado como ${filename}`);
                    }
                } catch (err) {
                    console.error('[MisReportesSubView.compartirPdf]', err);
                    Toast.error('Error al generar PDF: ' + err.message);
                } finally {
                    btnPdf.disabled = false;
                    btnPdf.innerHTML = origHtml;
                }
            });

            // Enviar por WhatsApp desde el icono en fila de Teléfono
            const btnWA = body.querySelector('#ar-row-btn-wa');
            btnWA?.addEventListener('click', async () => {
                if (!plantaInfo.telefono) {
                    Toast.error('El taller no tiene teléfono registrado. Haz clic en Editar para agregarlo.');
                    renderVistaEdicion();
                    return;
                }
                const origHtml = btnWA.innerHTML;
                btnWA.disabled = true;
                btnWA.innerHTML = '<span style="font-size:10px;">...</span>';
                const mensaje = generarMensajeWhatsAppCalidad(reporte);
                const waUrl   = generarUrlWhatsApp(plantaInfo.telefono, mensaje);
                window.open(waUrl, '_blank');
                Toast.success('Mensaje preparado para WhatsApp');
                btnWA.disabled = false;
                btnWA.innerHTML = origHtml;
            });

            // Enviar por Correo desde el icono en fila de Correo (.html adjunto)
            const btnMail = body.querySelector('#ar-row-btn-mail');
            btnMail?.addEventListener('click', async () => {
                if (!plantaInfo.correo || !plantaInfo.correo.includes('@')) {
                    Toast.error('El taller no tiene correo válido registrado. Haz clic en Editar para agregarlo.');
                    renderVistaEdicion();
                    return;
                }
                const origHtml = btnMail.innerHTML;
                btnMail.disabled = true;
                btnMail.innerHTML = `<div class="ar-spinner" style="width:12px;height:12px;border-width:2px;border-top-color:#fff;"></div>`;

                try {
                    const plantillaHtml = generarReporteCalidadHtmlStatico(reporte);
                    if (!this.dataService || typeof this.dataService.enviarEmailReporte !== 'function') {
                        throw new Error('Servicio de envío de correo no disponible');
                    }
                    await this.dataService.enviarEmailReporte({
                        idReporte,
                        email: plantaInfo.correo,
                        subject: asuntoDefault,
                        nombre: plantaInfo.nombrePlanta,
                        reporte,
                        attachmentHtml: plantillaHtml,
                        attachmentName: `${idReporte}.pdf`
                    });
                    Toast.success(`Reporte ${idReporte} enviado a ${plantaInfo.correo}`);
                    cerrar();
                } catch (err) {
                    console.error('[MisReportesSubView.enviarEmail]', err);
                    Toast.error('Error al enviar correo: ' + err.message);
                    btnMail.disabled = false;
                    btnMail.innerHTML = origHtml;
                }
            });
        };

        // ── Vista de Edición (Formulario editable estilo Personas) ──
        const renderVistaEdicion = () => {
            const body = sheetEl.querySelector('#ar-soporte-sheet-body');
            if (!body) return;
            const inits = getPlantInits(plantaInfo.nombrePlanta);

            body.innerHTML = `
                <div class="p-sheet-head">
                    <div class="p-sheet-avatar" style="background:linear-gradient(135deg,#0284c7,#2563eb);border-radius:50%;font-size:1.15rem;font-weight:800;color:#fff;width:52px;height:52px;min-width:52px;min-height:52px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.12);">
                        ${inits}
                    </div>
                    <div style="min-width:0; overflow:hidden;">
                        <p class="p-sheet-name" style="margin:0 0 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Editar Datos del Taller</p>
                        <p class="p-sheet-email" style="margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Actualizar información en Supabase</p>
                    </div>
                </div>

                <div style="padding:14px 20px 0;">
                    <div class="p-field">
                        <div class="p-field-label">Cédula o Nit</div>
                        <input class="p-field-input" id="ar-soporte-id" value="${plantaInfo.idPlanta || ''}" placeholder="Ej: 1144167164">
                    </div>

                    <div class="p-field">
                        <div class="p-field-label">Nombre de la Planta</div>
                        <input class="p-field-input" id="ar-soporte-nombre" value="${plantaInfo.nombrePlanta || ''}" placeholder="Ej: TALLER MENDOZA">
                    </div>

                    <div class="p-field">
                        <div class="p-field-label">Teléfono</div>
                        <input class="p-field-input" id="ar-soporte-tel" type="tel" maxlength="10" inputmode="numeric" value="${plantaInfo.telefono ? String(plantaInfo.telefono).replace(/\D/g, '').slice(0, 10) : ''}" placeholder="Ej: 3168007979">
                    </div>

                    <div class="p-field">
                        <div class="p-field-label">Correo</div>
                        <input class="p-field-input" id="ar-soporte-email" type="email" value="${plantaInfo.correo || ''}" placeholder="taller@ejemplo.com">
                    </div>
                </div>

                <div class="p-sheet-actions">
                    <button type="button" class="p-btn-primary" id="ar-soporte-save-btn">
                        ${SVG_CHECK} <span>Guardar</span>
                    </button>
                    <button type="button" class="p-btn-secondary" id="ar-soporte-cancel-btn">
                        Cancelar
                    </button>
                </div>
            `;

            // Restricción numérica de 10 dígitos (idéntico a PersonasModule)
            const peTel = body.querySelector('#ar-soporte-tel');
            if (peTel) {
                peTel.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
                });
                peTel.addEventListener('keydown', (e) => {
                    if (e.key === '+' || e.key === 'e' || e.key === '.' || e.key === '-') {
                        e.preventDefault();
                    }
                });
            }

            body.querySelector('#ar-soporte-cancel-btn')?.addEventListener('click', () => {
                if (plantaInfo.idPlanta || plantaInfo.nombrePlanta) {
                    renderVistaDetalle();
                } else {
                    cerrar();
                }
            });

            const saveBtn = body.querySelector('#ar-soporte-save-btn');
            saveBtn?.addEventListener('click', async () => {
                const idVal = body.querySelector('#ar-soporte-id')?.value;
                const nomVal = body.querySelector('#ar-soporte-nombre')?.value;
                const telVal = body.querySelector('#ar-soporte-tel')?.value;
                const corVal = body.querySelector('#ar-soporte-email')?.value;

                saveBtn.disabled = true;
                const origHtml = saveBtn.innerHTML;
                saveBtn.innerHTML = '<span>Guardando...</span>';

                const res = await sincronizarPlanta(idVal, nomVal, telVal, corVal, false);
                if (res) {
                    Toast.success(`Taller "${res.nomVal}" actualizado`);
                    renderVistaDetalle();
                } else {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = origHtml;
                }
            });
        };

        // Si ya está registrada en Supabase muestra Detalle; de lo contrario abre directamente Edición
        if (plantaInfo.isCreated && (plantaInfo.idPlanta || plantaInfo.nombrePlanta)) {
            renderVistaDetalle();
        } else {
            renderVistaEdicion();
        }
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
        document.getElementById('ar-modal-soporte-backdrop')?.remove();
        document.getElementById('ar-modal-soporte-sheet')?.remove();
        this.container = null;
    }
}
