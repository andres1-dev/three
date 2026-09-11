/**
 * ReporteCalidadView
 * Vista SPA que renderiza el reporte de calidad completo dentro del viewport
 * usando el sistema de plantillas hexagonal (HtmlCalidadRenderer + entidades de dominio).
 * Se monta con los datos del reporte pasados vía Store.getState().reporteCalidadActivo.
 * Permite imprimir con window.print() sin necesidad de abrir otra página.
 */

import { Store }  from '../../../state/Store.js';
import { Toast }  from '../../../components/Toast.js';
import { ENV }    from '../../../../infrastructure/config/env.js';
import { generarReporteCalidadHtml } from '../utils/generarReporteCalidadHtml.js';
import { generarMensajeWhatsAppCalidad, generarUrlWhatsApp } from '../utils/generarMensajeWhatsAppCalidad.js';

// ── Imports de la capa de plantillas ─────────────────────────
import { HtmlCalidadRenderer }   from '../../../../plantillas/infrastructure/renderers/HtmlCalidadRenderer.js';
import { ReporteCalidadEntity }  from '../../../../plantillas/core/domain/calidad/ReporteCalidadEntity.js';
import { CurvaProduccionEntity } from '../../../../plantillas/core/domain/calidad/CurvaProduccionEntity.js';
import { HallazgoDefectoEntity } from '../../../../plantillas/core/domain/calidad/HallazgoDefectoEntity.js';

// ── Mapa tipo novedad → clase CSS badge ──────────────────────
const TIPO_CLASE = {
    'SIN CONFECCIONAR': 'sin-confeccionar',
    'PROMOCIONES':      'promociones',
    'COBROS':           'cobros',
    'LAVADO':           'lavado',
};

const COLOR_HEX_MAP = {
    negro:'#1e293b', blanco:'#f1f5f9', rojo:'#ef4444', azul:'#3b82f6',
    verde:'#22c55e', camel:'#c2944e', crema:'#f5e6c8', gris:'#64748b',
    rosado:'#f472b6', naranja:'#f97316', amarillo:'#eab308', morado:'#8b5cf6',
    fucsia:'#d946ef', café:'#92400e', vinotinto:'#881337',
};

function colorHex(nombre) {
    const k = (nombre || '').toLowerCase();
    for (const [n, h] of Object.entries(COLOR_HEX_MAP)) {
        if (k.includes(n)) return h;
    }
    return '#1e293b';
}

function parseNovedadesToHallazgos(raw) {
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch (_) { return []; }
    }
    if (!Array.isArray(arr) || !arr.length) return [];

    const grupos = new Map();
    for (const nov of arr) {
        const tipo    = (nov.tipo || 'SIN CONFECCIONAR').toUpperCase();
        const codigos = Array.isArray(nov.codigos) ? nov.codigos : [];
        for (const cod of codigos) {
            const color = (cod.color || 'SIN COLOR').toUpperCase();
            const talla = String(cod.talla || '').toUpperCase();
            const cant  = Number(cod.cantidad || 0);
            const key   = `${tipo}||${color}`;
            if (!grupos.has(key)) {
                grupos.set(key, {
                    tipo, tipoClase: TIPO_CLASE[tipo] || 'sin-confeccionar',
                    color, colorHex: colorHex(color),
                    causa: nov.proceso || tipo, cantidadesPorTalla: {}
                });
            }
            const g = grupos.get(key);
            g.cantidadesPorTalla[talla] = (g.cantidadesPorTalla[talla] || 0) + cant;
        }
    }
    return [...grupos.values()].map(g => new HallazgoDefectoEntity(g));
}

function tallasDesdeCodigos(raw) {
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch (_) { return []; }
    }
    if (!Array.isArray(arr)) return [];
    const set = new Set();
    for (const nov of arr) {
        for (const cod of (nov.codigos || [])) {
            if (cod.talla) set.add(String(cod.talla).toUpperCase());
        }
    }
    return [...set];
}

function normalizarCoords(loc) {
    if (!loc) return null;
    if (typeof loc === 'object' && loc.lat && loc.lng) return `${loc.lat},${loc.lng}`;
    if (typeof loc === 'string' && loc.includes(',')) return loc.trim();
    try { const p = JSON.parse(loc); if (p.lat && p.lng) return `${p.lat},${p.lng}`; } catch (_) {}
    return null;
}

function fmtFecha(raw) {
    if (!raw) return 'N/A';
    try {
        const d = new Date(raw);
        if (isNaN(d)) return String(raw);
        const pad = n => String(n).padStart(2, '0');
        let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())} ${ap}`;
    } catch (_) { return String(raw); }
}

function buildEntity(r) {
    const novedades = r.novedades_auditoria;
    const hallazgos = parseNovedadesToHallazgos(novedades);
    const tallas    = tallasDesdeCodigos(novedades);
    const curva     = new CurvaProduccionEntity({ tallas, filas: [] });

    return new ReporteCalidadEntity({
        idReporte:   r.id_reporte  || 'S/N',
        fecha:       fmtFecha(r.fecha),
        productora:  r.productora  || String(r.id_productora || '') || 'N/A',
        tipoVisita:  r.tipo_visita || 'AUDITORÍA DE CALIDAD',
        conclusion:  r.conclusion  || 'SIN CONCLUSIÓN',
        planta:      r.planta      || 'N/A',
        proceso:     r.proceso     || 'N/A',
        op:          r.op          || 'N/A',
        referencia:  r.referencia  || 'N/A',
        linea:       r.linea       || 'N/A',
        prenda:      r.prenda      || 'N/A',
        genero:      r.genero      || 'N/A',
        cantidadTotal:      Number(r.cantidad || 0),
        destinoProceso:     r.destino_proceso || '',
        destinoPlanta:      r.destino_planta  || '',
        fechaDespacho:      r.salida   || 'N/A',
        fechaEntrega:       r.entrada  || 'N/A',
        telefonoPlanta:     'N/A',
        correoNotificacion: r.correo   || 'N/A',
        avancePorcentaje:   Number(r.avance || 0),
        coordenadas:        normalizarCoords(r.localizacion),
        fotoUrl:            r.soporte  || '',
        curva,
        hallazgos,
        observaciones: r.observaciones || '',
        auditor: {
            nombre:          r.auditor_nombre || r.auditor || 'N/A',
            cedula:          r.auditor_cedula || 'N/A',
            cargo:           'Auditor de Calidad — Grupo TDM',
            registroDigital: r.id_reporte || 'AUTH-TDM-OK',
            firmaSvg:        r.auditor_firma  || null,
        },
        representantePlanta: {
            nombre:   r.planta   || 'N/A',
            cedula:   'N/A',
            cargo:    'Representante Planta / Taller Confección',
            firmaSvg: r.firma_svg || null,
        }
    });
}

export class ReporteCalidadView {
    constructor({ router, dataService }) {
        this.router       = router;
        this.dataService  = dataService;
        this.container    = null;
        this._renderer    = new HtmlCalidadRenderer();
        this._reporte     = null;
    }

    async mount(viewport) {
        // Leer datos del Store
        const raw = Store.getState().reporteCalidadActivo;
        if (!raw) {
            Toast.error('No hay datos de reporte. Vuelve a Mis Reportes.');
            this.router.navigate('archivo');
            return;
        }

        try {
            this._reporte = buildEntity(raw);
        } catch (err) {
            Toast.error('Error al construir el reporte: ' + err.message);
            this.router.navigate('archivo');
            return;
        }

        this.container = document.createElement('div');
        this.container.className = 'mod-reporte-calidad';

        // Barra de acciones fija (no se imprime)
        this.container.innerHTML = `
            <div class="rcv-toolbar no-print">
                <button class="icon-btn rcv-btn-back" id="rcv-back" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                         stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <span class="rcv-title">${raw.id_reporte || 'Reporte'}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="rcv-btn-print" id="rcv-soporte" style="background:#16a34a; border-color:#16a34a;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                             stroke="currentColor" stroke-width="2.2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        Enviar Soporte
                    </button>
                    <button class="rcv-btn-print" id="rcv-print">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                             stroke="currentColor" stroke-width="2.5">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        Imprimir / PDF
                    </button>
                </div>
            </div>
            <div id="rcv-sheet" class="rcv-sheet"></div>
        `;

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        // Renderizar el reporte
        this.container.querySelector('#rcv-sheet').innerHTML =
            this._renderer.render(this._reporte);

        // Eventos
        this.container.querySelector('#rcv-back')?.addEventListener('click', () => {
            this.router.navigate('archivo');
        });

        this.container.querySelector('#rcv-print')?.addEventListener('click', () => {
            window.print();
        });

        this.container.querySelector('#rcv-soporte')?.addEventListener('click', async () => {
            await this._mostrarModalSoporte(raw);
        });
    }

    async _mostrarModalSoporte(raw) {
        document.getElementById('rcv-modal-soporte')?.remove();

        const idReporte = raw.id_reporte || raw.ID || this._reporte?.idReporte || 'S/N';
        const op = raw.op || raw.lote || this._reporte?.op || 'N/A';
        const ref = raw.referencia || this._reporte?.referencia || 'N/A';
        const plantaReporte = String(raw.planta || this._reporte?.planta || '').trim().toUpperCase();
        
        // Buscar datos de la planta en tabla plantas por campo planta
        let idPlantaDefault = '';
        let plantaNombre = plantaReporte || 'TALLER';
        let telDefault = '';
        let correoDefault = '';
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
                    idPlantaDefault = String(match.id || match.nit || match.id_planta || '').trim();
                    plantaNombre = String(match.nombre || match.planta || '').trim().toUpperCase();
                    telDefault = String(match.telefono || match.tel || '').trim();
                    correoDefault = String(match.email || match.correo || '').trim();
                } else {
                    // Si no existe, crear el registro usando EF
                    try {
                        // Generar ID temporal si no existe: usar hash del nombre de planta
                        let idTemporal = String(raw.id_planta || raw.ID_PLANTA || raw.nit || '').trim();
                        if (!idTemporal) {
                            // Generar ID numérico simple basado en el nombre
                            const hash = plantaReporte.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            idTemporal = String(9000000000 + (hash % 999999999)); // Rango 9xxxxxxxx
                        }

                        const resultado = await this.dataService.guardarOActualizarPlanta({
                            id_planta: idTemporal,
                            planta: plantaReporte,
                            correo: String(raw.correo || raw.CORREO || raw.email || '').trim(),
                            telefono: String(raw.telefono || raw.TELEFONO || '').trim()
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
                                idPlantaDefault = String(matchNew.id || matchNew.nit || matchNew.id_planta || '').trim();
                                plantaNombre = String(matchNew.nombre || matchNew.planta || '').trim().toUpperCase();
                                telDefault = String(matchNew.telefono || matchNew.tel || '').trim();
                                correoDefault = String(matchNew.email || matchNew.correo || '').trim();
                            }
                        }
                    } catch (createErr) {
                        console.warn('[ReporteCalidadView] Error al crear planta:', createErr);
                    }
                }
            } catch (err) {
                console.warn('[ReporteCalidadView] Error al buscar planta:', err);
            }
        }

        const asuntoDefault = `Reporte de Calidad — OP ${op} / Ref. ${ref}`;

        const modal = document.createElement('div');
        modal.id = 'rcv-modal-soporte';
        modal.className = 'ar-email-modal-backdrop';

        modal.innerHTML = `
            <div class="ar-email-modal" role="dialog" aria-modal="true" style="max-width:540px;">
                <div class="ar-email-modal-header">
                    <h3 class="ar-email-modal-title">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        Enviar Soporte de Calidad
                    </h3>
                    <button class="ar-email-modal-close" id="rcv-modal-close" aria-label="Cerrar">&times;</button>
                </div>
                <div class="ar-email-modal-body">
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
                            <span>Taller / Planta:</span>
                            <strong>${plantaNombre}</strong>
                        </div>
                    </div>

                    <div class="ar-soporte-section-title">
                        <span>Datos del Taller en Supabase</span>
                    </div>

                    <div class="ar-soporte-grid">
                        <div class="ar-email-form-group">
                            <label class="ar-email-label">ID / NIT Planta *</label>
                            <input type="text" class="ar-email-input" id="rcv-input-id" value="${idPlantaDefault}" placeholder="Ej: 1144167164">
                        </div>
                        <div class="ar-email-form-group">
                            <label class="ar-email-label">Nombre del Taller *</label>
                            <input type="text" class="ar-email-input" id="rcv-input-nombre" value="${plantaNombre}" placeholder="Nombre taller">
                        </div>
                    </div>

                    <div class="ar-soporte-grid">
                        <div class="ar-email-form-group">
                            <label class="ar-email-label">Teléfono / WhatsApp *</label>
                            <input type="tel" class="ar-email-input" id="rcv-input-tel" value="${telDefault}" placeholder="Ej: 3168007979">
                        </div>
                        <div class="ar-email-form-group">
                            <label class="ar-email-label">Correo Electrónico</label>
                            <input type="email" class="ar-email-input" id="rcv-input-email" value="${correoDefault}" placeholder="taller@ejemplo.com">
                        </div>
                    </div>

                    <div class="ar-email-form-group">
                        <label class="ar-email-label">Asunto (Para Correo)</label>
                        <input type="text" class="ar-email-input" id="rcv-input-subj" value="${asuntoDefault}">
                    </div>

                    <div class="ar-email-badge-info">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span>
                            Al enviar o guardar, los datos del taller se confirmarán y guardarán directamente en Supabase (tabla plantas).
                        </span>
                    </div>

                    <div class="ar-soporte-actions" style="margin-top: 6px;">
                        <button type="button" class="ar-email-btn-cancel" id="rcv-modal-cancel">Cancelar</button>
                        
                        <button type="button" class="ar-btn-save-planta" id="rcv-btn-guardar">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            <span>Guardar Taller</span>
                        </button>

                        <button type="button" class="ar-btn-whatsapp" id="rcv-btn-wa">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span>Enviar por WhatsApp</span>
                        </button>

                        <button type="button" class="ar-btn-email" id="rcv-btn-correo">
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

        document.body.appendChild(modal);

        const cerrar = () => modal.remove();
        modal.querySelector('#rcv-modal-close')?.addEventListener('click', cerrar);
        modal.querySelector('#rcv-modal-cancel')?.addEventListener('click', cerrar);

        const sincronizar = async () => {
            const idVal = modal.querySelector('#rcv-input-id')?.value.trim();
            const nomVal = modal.querySelector('#rcv-input-nombre')?.value.trim().toUpperCase();
            const telVal = modal.querySelector('#rcv-input-tel')?.value.trim();
            const corVal = modal.querySelector('#rcv-input-email')?.value.trim();

            if (!idVal || !nomVal) {
                Toast.error('Por favor completa ID y nombre del taller');
                return null;
            }

            try {
                const payload = {
                    accion: 'ACTUALIZAR_PLANTA',
                    id: idVal,
                    id_planta: parseInt(idVal, 10),
                    planta: nomVal,
                    nombrePlanta: nomVal,
                    telefono: telVal,
                    correo: corVal,
                    email: corVal,
                    rol: 'GUEST'
                };

                const res = await fetch(`${ENV.FUNCTIONS_URL}/personas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': ENV.SUPABASE_KEY },
                    body: JSON.stringify(payload)
                });
                const resJson = await res.json().catch(() => ({}));
                if (!res.ok || resJson.success === false) {
                    await fetch(`${ENV.FUNCTIONS_URL}/personas`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': ENV.SUPABASE_KEY },
                        body: JSON.stringify({ ...payload, accion: 'CREAR_PLANTA' })
                    });
                }

                raw.planta = nomVal;
                raw.id_planta = idVal;
                raw.telefono = telVal;
                raw.correo = corVal;

                return { idVal, nomVal, telVal, corVal };
            } catch (err) {
                console.warn('Error sincronizando planta:', err);
                return { idVal, nomVal, telVal, corVal };
            }
        };

        modal.querySelector('#rcv-btn-guardar')?.addEventListener('click', async () => {
            const synced = await sincronizar();
            if (synced) Toast.success(`Taller "${synced.nomVal}" guardado en Supabase`);
        });

        modal.querySelector('#rcv-btn-wa')?.addEventListener('click', async () => {
            const telVal = modal.querySelector('#rcv-input-tel')?.value.trim();
            if (!telVal) {
                Toast.error('Ingresa el teléfono del taller para WhatsApp');
                return;
            }
            await sincronizar();
            const msg = generarMensajeWhatsAppCalidad(raw);
            const waUrl = generarUrlWhatsApp(telVal, msg);
            window.open(waUrl, '_blank');
        });

        modal.querySelector('#rcv-btn-correo')?.addEventListener('click', async () => {
            const corVal = modal.querySelector('#rcv-input-email')?.value.trim();
            const subVal = modal.querySelector('#rcv-input-subj')?.value.trim() || asuntoDefault;

            if (!corVal || !corVal.includes('@')) {
                Toast.error('Ingresa un correo destinatario válido');
                return;
            }

            const btn = modal.querySelector('#rcv-btn-correo');
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span>Enviando...</span>';

            try {
                const synced = await sincronizar();
                const plantillaHtml = generarReporteCalidadHtml(raw);

                const res = await fetch(ENV.EMAIL_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': ENV.SUPABASE_KEY },
                    body: JSON.stringify({
                        accion: 'REPORTE_CALIDAD',
                        email: corVal,
                        subject: subVal,
                        nombre: synced?.nomVal || plantaNombre,
                        reporte: raw,
                        attachmentHtml: plantillaHtml,
                        attachmentName: `reporte_${idReporte}.html`
                    })
                });

                const resJson = await res.json().catch(() => ({}));
                if (!res.ok || resJson.success === false) {
                    throw new Error(resJson.message || 'Error al enviar correo');
                }

                Toast.success(`Reporte enviado exitosamente a ${corVal}`);
                cerrar();
            } catch (err) {
                Toast.error('Error al enviar correo: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = orig;
            }
        });
    }
    }

    unmount() {
        this.container = null;
        this._reporte  = null;
        // Limpiar dato del Store
        Store.setState({ reporteCalidadActivo: null });
    }
}
