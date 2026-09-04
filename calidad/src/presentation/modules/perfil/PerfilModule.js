import { Store } from '../../state/Store.js';
import { Toast } from '../../components/Toast.js';
import { ENV } from '../../../infrastructure/config/env.js';

const MESES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatBirthdayText(dateStr) {
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

function formatDateText(dateStr) {
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

function calcularAntiguedad(fechaStr) {
    if (!fechaStr) return '—';
    const inicio = new Date(fechaStr);
    if (isNaN(inicio.getTime())) return '—';
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

const SEDES_DISPONIBLES = ['CDI', 'RETAIL'];

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

function formatDateForInput(fecha) {
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

export class PerfilModule {
    constructor({ router, getProfileUseCase, updateProfileUseCase, logoutUseCase }) {
        this.router = router;
        this.getProfileUseCase = getProfileUseCase;
        this.updateProfileUseCase = updateProfileUseCase;
        this.logoutUseCase = logoutUseCase;
        this.currentUser = null;
        this.container = null;
        this.isEditing = false;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.className = 'mod-perfil';

        this.container.innerHTML = `
            <!-- ════ SKELETON LOADER ORIGINAL ════ -->
            <div class="perfil-skeleton" id="perfil-skeleton" aria-hidden="true">
                <div class="sk-header">
                    <div class="sk-circle sk-sm"></div>
                    <div class="sk-bar sk-bar--title"></div>
                    <div class="sk-bar sk-bar--short"></div>
                </div>
                <div class="sk-cover"></div>
                <div class="sk-info-block">
                    <div class="sk-avatar-wrap">
                        <div class="sk-circle sk-circle--avatar"></div>
                    </div>
                    <div class="sk-bar sk-bar--name"></div>
                    <div class="sk-meta">
                        <div class="sk-bar sk-bar--meta"></div>
                        <div class="sk-bar sk-bar--meta"></div>
                    </div>
                    <div class="sk-actions">
                        <div class="sk-btn"></div>
                        <div class="sk-btn sk-btn--primary"></div>
                    </div>
                </div>
                <div class="sk-tabs">
                    <div class="sk-bar sk-bar--tab"></div>
                    <div class="sk-bar sk-bar--tab"></div>
                    <div class="sk-bar sk-bar--tab"></div>
                </div>
                <div class="sk-accordion-group">
                    <div class="sk-accordion-row"></div>
                    <div class="sk-accordion-row"></div>
                    <div class="sk-accordion-row"></div>
                    <div class="sk-accordion-row"></div>
                </div>
            </div>

            <!-- ════ CONTENIDO REAL (VISTA Y EDICIÓN IN-PLACE) ════ -->
            <div class="perfil-real" id="perfil-real" style="display:none; flex-direction:column; flex:1;">
                <!-- Header -->
                <div class="profile-header">
                    <button class="icon-btn" id="btn-header-back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h2 class="profile-title" id="header-profile-title">Mi perfil</h2>
                        <span class="pe-edit-badge" id="header-edit-badge" style="display:none;">MODO EDICIÓN</span>
                    </div>
                    <div class="feed-actions">
                        <button class="icon-btn" id="btn-perfil-logout" aria-label="Cerrar sesión" title="Cerrar sesión">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                        </button>
                        <button class="icon-btn" id="btn-header-save" aria-label="Guardar cambios" title="Guardar cambios" style="display:none; color:var(--color-primary); background:rgba(37,99,235,0.1); border-radius:10px;">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Portada -->
                <div class="profile-cover" style="position: relative; margin-top: 0;">
                    <div class="profile-cover-bg" id="profile-cover-bg"></div>
                    <button class="cover-cam-btn" id="btn-cambiar-portada" aria-label="Cambiar portada">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                    </button>
                    <input type="file" id="input-portada" accept="image/*" style="display:none;">
                </div>

                <!-- Info Principal -->
                <div class="profile-info">
                    <div class="profile-avatar-container">
                        <img src="" alt="Foto de perfil" class="profile-avatar" style="display:none;">
                        <button class="avatar-cam-btn" id="btn-cambiar-foto" aria-label="Cambiar foto de perfil">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                            </svg>
                        </button>
                        <input type="file" id="input-foto-perfil" accept="image/*" style="display:none;">
                    </div>

                    <!-- Nombre en vista -->
                    <h2 class="profile-name" id="perfil-nombre">—</h2>

                    <!-- Nombre en edición in-place -->
                    <div id="pe-name-edit-wrap" style="display:none; flex-direction:column; align-items:center; gap:4px; width:100%;">
                        <label class="pe-label" style="font-size:0.7rem; color:var(--color-primary); font-weight:700;">NOMBRE COMPLETO</label>
                        <input type="text" class="pe-name-input" id="pe-edit-nombre" placeholder="Nombre completo" required />
                    </div>

                    <div class="profile-meta" id="perfil-meta-wrap">
                        <div class="meta-item" data-meta="cumpleanos">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
                                <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
                                <path d="M2 21h20"/>
                                <line x1="12" y1="7" x2="12" y2="11"/>
                                <line x1="8" y1="7" x2="8" y2="11"/>
                                <line x1="16" y1="7" x2="16" y2="11"/>
                                <circle cx="12" cy="4" r="1" fill="currentColor"/>
                                <circle cx="8" cy="4" r="1" fill="currentColor"/>
                                <circle cx="16" cy="4" r="1" fill="currentColor"/>
                            </svg>
                            <span id="perfil-meta-cumple">—</span>
                        </div>
                        <div class="meta-item" data-meta="productora">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                            <span id="perfil-meta-prod">Grupo TDM</span>
                        </div>
                    </div>

                    <!-- Acciones en modo vista -->
                    <div class="profile-actions" id="view-profile-actions">
                        <button class="btn-secondary" id="btn-ver-apps">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                            Apps
                        </button>
                        <button class="btn-primary" id="btn-editar-perfil">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar perfil
                        </button>
                    </div>

                    <!-- Acciones en modo edición -->
                    <div class="profile-actions" id="edit-profile-actions" style="display:none;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-edicion" style="flex:1;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Cancelar
                        </button>
                        <button type="button" class="btn-primary" id="btn-guardar-edicion" style="flex:1;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Guardar cambios
                        </button>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="profile-tabs">
                    <button class="tab-btn active" data-tab="informacion">Información</button>
                    <button class="tab-btn" data-tab="contacto">Contacto</button>
                    <button class="tab-btn" data-tab="ubicacion">Ubicación</button>
                </div>

                <!-- Contenedor de Paneles -->
                <div class="profile-content">
                    <!-- PANEL 1: INFORMACIÓN -->
                    <div class="tab-panel active" id="tab-informacion">
                        <!-- Vista de sólo lectura -->
                        <div class="panel-view">
                            <div class="accordion open">
                                <button class="accordion-header">
                                    <span>Datos</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                                <div class="accordion-body" style="display:flex;">
                                    <div class="info-item" data-field="id-usuario">
                                        <span class="info-label">Cédula</span>
                                        <span class="info-value" id="val-cedula">—</span>
                                    </div>
                                    <div class="info-item" data-field="cargo">
                                        <span class="info-label">Cargo</span>
                                        <span class="info-value" id="val-cargo">—</span>
                                    </div>
                                    <div class="info-item" data-field="area">
                                        <span class="info-label">Área</span>
                                        <span class="info-value" id="val-area">—</span>
                                    </div>
                                    <div class="info-item" data-field="fecha-contratacion">
                                        <span class="info-label">Fecha ingreso</span>
                                        <span class="info-value" id="val-ingreso">—</span>
                                    </div>
                                    <div class="info-item" data-field="fecha-nacimiento">
                                        <span class="info-label">Cumpleaños</span>
                                        <span class="info-value" id="val-cumple">—</span>
                                    </div>
                                </div>
                            </div>

                            <div class="accordion open">
                                <button class="accordion-header">
                                    <span>Organización</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                                <div class="accordion-body" style="display:flex;">
                                    <div class="info-item" data-field="productora">
                                        <span class="info-label">Productora</span>
                                        <span class="info-value" id="val-productora">—</span>
                                    </div>
                                    <div class="info-item" data-field="departamento">
                                        <span class="info-label">Departamento</span>
                                        <span class="info-value" id="val-departamento">—</span>
                                    </div>
                                    <div class="info-item" data-field="antiguedad">
                                        <span class="info-label">Antigüedad</span>
                                        <span class="info-value" id="val-antiguedad">—</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Edición In-Place (oculta en modo vista) -->
                        <div class="panel-edit pe-edit-container" id="pe-edit-panel-informacion" style="display:none;">
                            <div class="pe-edit-card">
                                <div class="pe-card-title">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    <span>Identidad & Cargo</span>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Cédula</label>
                                    <input class="pe-input" id="pe-edit-cedula" readonly />
                                </div>
                                <div class="pe-grid-2">
                                    <div class="pe-field">
                                        <label class="pe-label">Cargo</label>
                                        <input class="pe-input" id="pe-edit-cargo" placeholder="Ej: Analista de Calidad" />
                                    </div>
                                    <div class="pe-field">
                                        <label class="pe-label">Área</label>
                                        <input class="pe-input" id="pe-edit-area" placeholder="Ej: Calidad" />
                                    </div>
                                </div>
                                <div class="pe-grid-2">
                                    <div class="pe-field">
                                        <label class="pe-label">Fecha ingreso</label>
                                        <input class="pe-input" type="date" id="pe-edit-fecha-ingreso" />
                                    </div>
                                    <div class="pe-field">
                                        <label class="pe-label">Antigüedad</label>
                                        <input class="pe-input" id="pe-edit-antiguedad" readonly placeholder="Calculada..." />
                                    </div>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Cumpleaños</label>
                                    <input class="pe-input" type="date" id="pe-edit-fecha-nacimiento" />
                                </div>
                            </div>

                            <div class="pe-edit-card">
                                <div class="pe-card-title">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                                    <span>Organización & Empresa</span>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Productora disponible</label>
                                    <select class="pe-select" id="pe-edit-productora"></select>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Sede</label>
                                    <select class="pe-select" id="pe-edit-sede">
                                        <option value="CDI">CDI</option>
                                        <option value="RETAIL">RETAIL</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- PANEL 2: CONTACTO -->
                    <div class="tab-panel" id="tab-contacto" style="display:none;">
                        <!-- Vista de sólo lectura -->
                        <div class="panel-view">
                            <div class="accordion open">
                                <button class="accordion-header">
                                    <span>Contacto</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                                <div class="accordion-body" style="display:flex;">
                                    <div class="info-item" data-field="email">
                                        <span class="info-label">Email</span>
                                        <div class="info-action-wrap" style="display:flex; align-items:center; gap:8px;">
                                            <span class="info-value" id="val-email">—</span>
                                            <a href="#" id="link-email-action" class="contact-action-btn" title="Enviar correo" target="_blank" rel="noopener" style="display:none; color:var(--color-primary);">
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                                    <polyline points="22,6 12,13 2,6"/>
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                    <div class="info-item" data-field="telefono">
                                        <span class="info-label">Teléfono</span>
                                        <div class="info-action-wrap" style="display:flex; align-items:center; gap:8px;">
                                            <span class="info-value" id="val-telefono">—</span>
                                            <a href="#" id="link-tel-action" class="contact-action-btn" title="Llamar ahora" style="display:none; color:var(--color-primary);">
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Edición In-Place (oculta en modo vista) -->
                        <div class="panel-edit pe-edit-container" id="pe-edit-panel-contacto" style="display:none;">
                            <div class="pe-edit-card">
                                <div class="pe-card-title">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    <span>Contacto Directo</span>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Correo electrónico</label>
                                    <input class="pe-input" type="email" id="pe-edit-email" placeholder="correo@empresa.com" />
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Teléfono / Celular (10 dígitos sin +)</label>
                                    <input class="pe-input" type="tel" id="pe-edit-telefono" maxlength="10" inputmode="numeric" placeholder="Ej: 3001234567" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- PANEL 3: UBICACIÓN -->
                    <div class="tab-panel" id="tab-ubicacion" style="display:none;">
                        <!-- Vista de sólo lectura -->
                        <div class="panel-view">
                            <div class="accordion open">
                                <button class="accordion-header">
                                    <span>Ubicación</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                                <div class="accordion-body" style="display:flex;">
                                    <div class="info-item" data-field="pais">
                                        <span class="info-label">País</span>
                                        <span class="info-value" id="val-pais">Colombia</span>
                                    </div>
                                    <div class="info-item" data-field="departamento">
                                        <span class="info-label">Departamento</span>
                                        <span class="info-value" id="val-dep-ubi">—</span>
                                    </div>
                                    <div class="info-item" data-field="ciudad">
                                        <span class="info-label">Ciudad</span>
                                        <span class="info-value" id="val-ciudad">—</span>
                                    </div>
                                    <div class="info-item" data-field="sede">
                                        <span class="info-label">Sede</span>
                                        <span class="info-value" id="val-sede">—</span>
                                    </div>
                                    <div class="info-item" data-field="direccion">
                                        <span class="info-label">Dirección</span>
                                        <span class="info-value" id="val-direccion">—</span>
                                    </div>
                                    <div class="info-item" data-field="barrio">
                                        <span class="info-label">Barrio</span>
                                        <span class="info-value" id="val-barrio">—</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Edición In-Place (oculta en modo vista) -->
                        <div class="panel-edit pe-edit-container" id="pe-edit-panel-ubicacion" style="display:none;">
                            <div class="pe-edit-card">
                                <div class="pe-card-title">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <span>Ubicación en Colombia</span>
                                </div>
                                <div class="pe-grid-2">
                                    <div class="pe-field">
                                        <label class="pe-label">País</label>
                                        <input class="pe-input" id="pe-edit-pais" value="Colombia" readonly />
                                    </div>
                                    <div class="pe-field">
                                        <label class="pe-label">Departamento</label>
                                        <select class="pe-select" id="pe-edit-departamento"></select>
                                    </div>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Ciudad / Municipio</label>
                                    <select class="pe-select" id="pe-edit-ciudad"></select>
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Dirección exacta</label>
                                    <input class="pe-input" id="pe-edit-direccion" placeholder="Calle, Carrera, No." />
                                </div>
                                <div class="pe-field">
                                    <label class="pe-label">Barrio</label>
                                    <input class="pe-input" id="pe-edit-barrio" placeholder="Barrio" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Barra de guardado flotante inferior (solo visible al editar) -->
                <div class="pe-floating-bar" id="pe-floating-save-bar" style="display:none;">
                    <button type="button" class="btn-secondary" id="btn-float-cancel" style="flex:1;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Cancelar
                    </button>
                    <button type="button" class="btn-primary" id="btn-float-save" style="flex:1;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Guardar cambios
                    </button>
                </div>
            </div>
        `;

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        this._bindUIEvents();
        await this._loadData();
    }

    _bindUIEvents() {
        const root = this.container;

        // Botón volver
        root.querySelector('#btn-header-back')?.addEventListener('click', () => {
            if (this.isEditing) {
                this._exitEditMode();
            } else {
                this.router.navigate('apps');
            }
        });

        // Botón cerrar sesión
        root.querySelector('#btn-perfil-logout')?.addEventListener('click', async () => {
            if (confirm('¿Deseas cerrar tu sesión?')) {
                await this.logoutUseCase.execute();
                window.location.replace('login.html');
            }
        });

        // Botón Apps
        root.querySelector('#btn-ver-apps')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });

        // Botón Editar perfil (activa el modo de edición en la misma pantalla)
        root.querySelector('#btn-editar-perfil')?.addEventListener('click', () => {
            this._enterEditMode();
        });

        // Botones para cancelar edición
        root.querySelector('#btn-cancelar-edicion')?.addEventListener('click', () => {
            this._exitEditMode();
        });
        root.querySelector('#btn-float-cancel')?.addEventListener('click', () => {
            this._exitEditMode();
        });

        // Botones para guardar edición
        root.querySelector('#btn-guardar-edicion')?.addEventListener('click', () => {
            this._saveProfile();
        });
        root.querySelector('#btn-header-save')?.addEventListener('click', () => {
            this._saveProfile();
        });
        root.querySelector('#btn-float-save')?.addEventListener('click', () => {
            this._saveProfile();
        });

        // Eventos reactivos de edición
        const inputFecha = root.querySelector('#pe-edit-fecha-ingreso');
        const inputAntiguedad = root.querySelector('#pe-edit-antiguedad');
        if (inputFecha && inputAntiguedad) {
            inputFecha.addEventListener('input', () => {
                const calculada = calcularAntiguedad(inputFecha.value);
                inputAntiguedad.value = calculada || '—';
            });
        }

        const selectDpto = root.querySelector('#pe-edit-departamento');
        if (selectDpto) {
            selectDpto.addEventListener('change', () => {
                this._updateCiudadesDropdown(selectDpto.value, '');
            });
        }

        // Restricción estricta de teléfono: máximo 10 dígitos, prohibir signo +
        const inputTel = root.querySelector('#pe-edit-telefono');
        if (inputTel) {
            inputTel.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });
            inputTel.addEventListener('keydown', (e) => {
                if (e.key === '+' || e.key === 'e' || e.key === '.' || e.key === '-') {
                    e.preventDefault();
                }
            });
        }

        // Tabs del perfil
        const tabBtns = root.querySelectorAll('.profile-tabs .tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.tab;
                root.querySelectorAll('.tab-panel').forEach(p => {
                    const isTarget = p.id === `tab-${target}`;
                    p.style.display = isTarget ? 'block' : 'none';
                    p.classList.toggle('active', isTarget);
                });
            });
        });

        // Acordeones colapsables
        const accordions = root.querySelectorAll('.accordion');
        accordions.forEach(acc => {
            const header = acc.querySelector('.accordion-header');
            const body = acc.querySelector('.accordion-body');
            header?.addEventListener('click', () => {
                const isOpen = acc.classList.contains('open');
                acc.classList.toggle('open', !isOpen);
                if (body) body.style.display = isOpen ? 'none' : 'flex';
            });
        });

        // Cambio de foto → abrir cropper circular
        const btnFoto = root.querySelector('#btn-cambiar-foto');
        const inpFoto = root.querySelector('#input-foto-perfil');
        if (btnFoto && inpFoto) {
            btnFoto.addEventListener('click', () => inpFoto.click());
            inpFoto.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) { Toast.error('Solo se permiten imágenes'); return; }
                this._openCropper(file, 'foto', (blob) => this._subirBlob(blob, 'foto', inpFoto));
            });
        }

        // Cambio de portada → abrir cropper rectangular
        const btnPortada = root.querySelector('#btn-cambiar-portada');
        const inpPortada = root.querySelector('#input-portada');
        if (btnPortada && inpPortada) {
            btnPortada.addEventListener('click', () => inpPortada.click());
            inpPortada.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) { Toast.error('Solo se permiten imágenes'); return; }
                this._openCropper(file, 'portada', (blob) => this._subirBlob(blob, 'portada', inpPortada));
            });
        }
    }

    /* ── CROPPER PROFESIONAL (pan + zoom) ── */
    _openCropper(file, tipo, onConfirmed) {
        const isCircle = tipo === 'foto';
        const FRAME_W = isCircle ? 240 : 320;
        const FRAME_H = isCircle ? 240 : Math.round(320 * 7 / 16);
        const EXP_W = isCircle ? 400 : 800;
        const EXP_H = isCircle ? 400 : Math.round(800 * 7 / 16);

        const overlay = document.createElement('div');
        overlay.id = 'crop-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:9999;
            background:rgba(0,0,0,.82);
            display:flex;align-items:center;justify-content:center;
        `;
        overlay.innerHTML = `
            <div id="crop-panel" style="background:#1e1e2e;border-radius:18px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 24px 64px rgba(0,0,0,.5);">
                <p style="margin:0;color:#fff;font-size:15px;font-weight:700;">Ajustar imagen</p>
                <p style="margin:0;color:#94a3b8;font-size:12px;">Arrastra · Pellizca · Desliza el zoom</p>
                <div id="crop-stage-wrap"
                     style="width:${FRAME_W}px;height:${FRAME_H}px;
                            border-radius:${isCircle ? '50%' : '12px'};
                            overflow:hidden;position:relative;cursor:grab;
                            box-shadow:0 0 0 3px #6366f1,0 8px 28px rgba(99,102,241,.3);">
                    <img id="crop-img-el" draggable="false" alt="" style="position:absolute;transform-origin:0 0;">
                </div>
                <div style="display:flex;align-items:center;gap:10px;width:100%;">
                    <button id="crop-zm" style="background:#334155;color:#fff;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;">−</button>
                    <input type="range" id="crop-zoom-slider" style="flex:1;" step="0.001">
                    <button id="crop-zp" style="background:#334155;color:#fff;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;">+</button>
                </div>
                <div style="display:flex;gap:10px;width:100%;">
                    <button id="crop-cancel-btn" style="flex:1;padding:10px;background:#334155;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:600;">Cancelar</button>
                    <button id="crop-confirm-btn" style="flex:1;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:600;">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const stage = overlay.querySelector('#crop-stage-wrap');
        const img = overlay.querySelector('#crop-img-el');
        const slider = overlay.querySelector('#crop-zoom-slider');

        let scale = 1, minScale = 0.1, maxScale = 10;
        let tx = 0, ty = 0;

        const blobUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(blobUrl);
            minScale = Math.max(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight);
            maxScale = minScale * 6;
            scale = minScale;
            tx = (FRAME_W - img.naturalWidth * scale) / 2;
            ty = (FRAME_H - img.naturalHeight * scale) / 2;
            slider.min = String(minScale); slider.max = String(maxScale); slider.value = String(scale);
            _apply();
        };
        img.src = blobUrl;

        function _clamp() {
            const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
            if (iw >= FRAME_W) { tx = Math.min(tx, 0); tx = Math.max(tx, FRAME_W - iw); } else { tx = (FRAME_W - iw) / 2; }
            if (ih >= FRAME_H) { ty = Math.min(ty, 0); ty = Math.max(ty, FRAME_H - ih); } else { ty = (FRAME_H - ih) / 2; }
        }
        function _apply() {
            _clamp();
            img.style.left = tx + 'px';
            img.style.top = ty + 'px';
            img.style.width = (img.naturalWidth * scale) + 'px';
            img.style.height = (img.naturalHeight * scale) + 'px';
        }
        function _zoom(ns, cx, cy) {
            ns = Math.max(minScale, Math.min(maxScale, ns));
            cx = cx ?? FRAME_W / 2; cy = cy ?? FRAME_H / 2;
            tx = cx - (cx - tx) * ns / scale;
            ty = cy - (cy - ty) * ns / scale;
            scale = ns; slider.value = String(scale); _apply();
        }

        let dragging = false, lx = 0, ly = 0;
        stage.addEventListener('mousedown', e => { dragging = true; lx = e.clientX; ly = e.clientY; e.preventDefault(); });
        const onMove = e => { if (!dragging) return; tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; _apply(); };
        const onUp = () => { dragging = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        let lt = { x: 0, y: 0 }, pd0 = 0;
        stage.addEventListener('touchstart', e => {
            if (e.touches.length === 1) { lt = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
            else if (e.touches.length === 2) { pd0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
            e.preventDefault();
        }, { passive: false });
        stage.addEventListener('touchmove', e => {
            if (e.touches.length === 1) {
                tx += e.touches[0].clientX - lt.x; ty += e.touches[0].clientY - lt.y;
                lt = { x: e.touches[0].clientX, y: e.touches[0].clientY }; _apply();
            } else if (e.touches.length === 2) {
                const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - stage.getBoundingClientRect().left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - stage.getBoundingClientRect().top;
                _zoom(scale * d / pd0, cx, cy); pd0 = d;
            }
            e.preventDefault();
        }, { passive: false });
        stage.addEventListener('wheel', e => {
            e.preventDefault();
            const r = stage.getBoundingClientRect();
            _zoom(scale * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top);
        }, { passive: false });
        slider.addEventListener('input', () => _zoom(parseFloat(slider.value)));
        overlay.querySelector('#crop-zm').addEventListener('click', () => _zoom(scale / 1.12));
        overlay.querySelector('#crop-zp').addEventListener('click', () => _zoom(scale * 1.12));

        const _destroy = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            overlay.remove();
        };
        overlay.querySelector('#crop-cancel-btn').addEventListener('click', _destroy);
        overlay.addEventListener('click', e => { if (e.target === overlay) _destroy(); });

        overlay.querySelector('#crop-confirm-btn').addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            canvas.width = EXP_W; canvas.height = EXP_H;
            const ctx = canvas.getContext('2d');
            const ratio = EXP_W / FRAME_W;
            const srcX = -tx / scale, srcY = -ty / scale;
            const srcW = FRAME_W / scale, srcH = FRAME_H / scale;
            if (isCircle) {
                ctx.save(); ctx.beginPath();
                ctx.arc(EXP_W / 2, EXP_H / 2, EXP_W / 2, 0, Math.PI * 2);
                ctx.closePath(); ctx.clip();
            }
            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, EXP_W, EXP_H);
            if (isCircle) ctx.restore();
            canvas.toBlob(blob => {
                _destroy();
                if (blob) onConfirmed(blob);
            }, 'image/jpeg', 0.88);
        });
    }

    /* ── SUBIR BLOB via Edge Function /perfiles (igual que el original) ── */
    async _subirBlob(blob, tipo, inputEl) {
        if (inputEl) inputEl.value = '';


        try {
            // Obtener sesión activa
            let accessToken = null;
            try {
                const session = await this.getProfileUseCase.authService?.getSession?.();
                if (session?.accessToken) accessToken = session.accessToken;
            } catch (_) { }

            // Fallback: leer token del localStorage
            if (!accessToken) {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.includes('-auth-token')) {
                        const s = JSON.parse(localStorage.getItem(k) || 'null');
                        if (s?.access_token) { accessToken = s.access_token; break; }
                    }
                }
            }

            if (!accessToken) throw new Error('No hay sesión activa');

            // Feedback visual sutil directamente en el elemento (sin banners molestos)
            const targetEl = tipo === 'foto' ? this.container?.querySelector('.profile-avatar-wrap') : this.container?.querySelector('.profile-cover');
            if (targetEl) targetEl.style.opacity = '0.7';

            // 1. Obtener URL firmada de subida
            const r1 = await fetch(`${ENV.FUNCTIONS_URL}/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': ENV.SUPABASE_KEY
                },
                body: JSON.stringify({ accion: 'SUBIR_FOTO', tipo })
            });
            const j1 = await r1.json();
            if (!j1.success) throw new Error(j1.message);

            const { uploadUrl, publicUrl } = j1.data;

            // 2. Subir el blob
            const r2 = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }
            });
            if (!r2.ok) throw new Error(`Error al subir: ${await r2.text()}`);

            // 3. Actualizar vista previa inmediatamente
            const urlBusted = publicUrl + '?t=' + Date.now();
            const root = this.container;
            if (tipo === 'foto') {
                const avatarImg = root?.querySelector('.profile-avatar');
                const initials = root?.querySelector('.perfil-avatar-initials');
                if (avatarImg) { avatarImg.src = urlBusted; avatarImg.style.display = 'block'; }
                initials?.remove();
                if (this.currentUser) this.currentUser.fotoUrl = publicUrl;
            } else {
                const existing = root?.querySelector('.profile-cover img');
                if (existing) {
                    existing.src = urlBusted;
                } else {
                    const bg = root?.querySelector('#profile-cover-bg');
                    if (bg) {
                        const img = document.createElement('img');
                        img.alt = 'Portada';
                        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                        img.src = urlBusted;
                        bg.replaceWith(img);
                    }
                }
                if (this.currentUser) {
                    this.currentUser.portadaUrl = publicUrl;
                    Store.setState({ currentUser: this.currentUser });
                }
            }

            // 4. Guardar URL en el perfil via Edge Function
            const r3 = await fetch(`${ENV.FUNCTIONS_URL}/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': ENV.SUPABASE_KEY
                },
                body: JSON.stringify({
                    accion: 'ACTUALIZAR_PERFIL',
                    [tipo === 'foto' ? 'foto_url' : 'portada_url']: publicUrl
                })
            });
            const j3 = await r3.json();
            if (!j3.success) console.warn('[PerfilModule] Aviso al guardar URL:', j3.message);

            if (this.currentUser) {
                Store.setState({ currentUser: this.currentUser });
            }

            if (targetEl) targetEl.style.opacity = '1';
            Toast.success(tipo === 'foto' ? 'Foto actualizada' : 'Portada actualizada');
        } catch (err) {
            if (targetEl) targetEl.style.opacity = '1';
            console.error('[PerfilModule] Error al subir imagen:', err);
            Toast.error('Error al subir la imagen: ' + err.message);
        }
    }

    async _loadData() {
        try {
            // Obtener el perfil mediante el caso de uso
            this.currentUser = await this.getProfileUseCase.execute();
            if (this.currentUser) {
                Store.setState({ currentUser: this.currentUser });
            }
            this._renderProfile();
        } catch (err) {
            console.error('[PerfilModule] Error al cargar perfil:', err);
            // Si hay fallo, intentar usar el usuario del Store
            this.currentUser = Store.getState().currentUser;
            if (this.currentUser) {
                this._renderProfile();
            } else {
                this._renderProfileFallback();
            }
        }
    }

    _renderProfile() {
        const root = this.container;
        if (!root || !this.currentUser) return;
        const u = this.currentUser;

        // Ocultar skeleton y mostrar contenido real
        const sk = root.querySelector('#perfil-skeleton');
        const real = root.querySelector('#perfil-real');
        if (sk) sk.style.display = 'none';
        if (real) real.style.display = 'flex';

        // 1. Portada
        const coverBg = root.querySelector('#profile-cover-bg');
        if (coverBg) {
            if (u.portadaUrl) {
                coverBg.innerHTML = `<img src="${u.portadaUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="Portada" />`;
            } else {
                coverBg.innerHTML = '';
            }
        }

        // 2. Avatar o Iniciales
        const avatarImg = root.querySelector('.profile-avatar');
        const container = root.querySelector('.profile-avatar-container');
        if (avatarImg && container) {
            if (u.fotoUrl) {
                avatarImg.src = u.fotoUrl;
                avatarImg.style.display = 'block';
                container.querySelector('.perfil-avatar-initials')?.remove();
            } else {
                avatarImg.style.display = 'none';
                container.querySelector('.perfil-avatar-initials')?.remove();
                const span = document.createElement('span');
                span.className = 'perfil-avatar-initials';
                span.style.background = u.roleMetadata?.gradient || 'linear-gradient(135deg,#6366f1,#8b5cf6)';
                span.textContent = u.initials;
                container.insertBefore(span, avatarImg);
            }
        }

        // 3. Nombre y metadatos
        const nameEl = root.querySelector('#perfil-nombre');
        if (nameEl) nameEl.textContent = u.displayName || 'Sin nombre';

        const cumpleTexto = formatBirthdayText(u.cumpleanos);
        const metaCumple = root.querySelector('#perfil-meta-cumple');
        if (metaCumple) metaCumple.textContent = cumpleTexto;

        const metaProd = root.querySelector('#perfil-meta-prod');
        if (metaProd) metaProd.textContent = u.productora || u.planta || 'Grupo TDM';

        // 4. Panel Información
        this._setVal('#val-cedula', u.cedula);
        this._setVal('#val-cargo', u.cargo);
        this._setVal('#val-area', u.area);
        this._setVal('#val-ingreso', formatDateText(u.fechaIngreso));
        // Mostrar cumpleaños solo si tiene valor real
        const cumpleValDisplay = u.cumpleanos ? cumpleTexto : null;
        this._setVal('#val-cumple', cumpleValDisplay);
        // Ocultar badge de cumpleaños en el header si no hay fecha
        if (metaCumple) {
            const metaCumpleWrap = metaCumple.closest('.meta-item');
            if (metaCumpleWrap) metaCumpleWrap.style.display = u.cumpleanos ? '' : 'none';
        }
        this._setVal('#val-productora', u.productora || u.planta);
        this._setVal('#val-departamento', u.departamento);
        const antiguedad = u.antiguedad || calcularAntiguedad(u.fechaIngreso);
        this._setVal('#val-antiguedad', antiguedad === '—' ? null : antiguedad);

        // 5. Panel Contacto
        this._setVal('#val-email', u.email);
        this._setVal('#val-telefono', u.telefono);
        const linkEmail = root.querySelector('#link-email-action');
        if (linkEmail) {
            if (u.email && u.email !== '—') {
                linkEmail.href = `mailto:${u.email}`;
                linkEmail.style.display = 'inline-flex';
            } else {
                linkEmail.style.display = 'none';
            }
        }
        const linkTel = root.querySelector('#link-tel-action');
        if (linkTel) {
            if (u.telefono && u.telefono !== '—') {
                const cleanPhone = u.telefono.replace(/[^0-9+]/g, '');
                linkTel.href = `tel:${cleanPhone}`;
                linkTel.style.display = 'inline-flex';
            } else {
                linkTel.style.display = 'none';
            }
        }

        // 6. Panel Ubicación
        this._setVal('#val-pais', u.pais || 'Colombia');
        this._setVal('#val-dep-ubi', u.departamento);
        this._setVal('#val-ciudad', u.ciudad);
        this._setVal('#val-sede', u.sede);
        this._setVal('#val-direccion', u.direccion);
        this._setVal('#val-barrio', u.barrio);

        // 7. Ocultar acordeones sin campos visibles
        this._hideEmptyAccordions();
    }

    _setVal(selector, val) {
        const el = this.container?.querySelector(selector);
        if (!el) return;
        const isEmpty = !val || val === '—';
        el.textContent = isEmpty ? '—' : val;
        // Ocultar o mostrar el contenedor info-item padre
        const item = el.closest('.info-item');
        if (item) item.style.display = isEmpty ? 'none' : '';
    }

    /** Oculta los acordeones cuyo cuerpo no tenga ningún info-item visible */
    _hideEmptyAccordions() {
        const root = this.container;
        if (!root) return;
        root.querySelectorAll('.panel-view .accordion').forEach(acc => {
            const body = acc.querySelector('.accordion-body');
            if (!body) return;
            const visibleItems = Array.from(body.querySelectorAll('.info-item'))
                .filter(it => it.style.display !== 'none');
            acc.style.display = visibleItems.length === 0 ? 'none' : '';
        });
    }

    _renderProfileFallback() {
        const sk = this.container?.querySelector('#perfil-skeleton');
        const real = this.container?.querySelector('#perfil-real');
        if (sk) sk.style.display = 'none';
        if (real) real.style.display = 'flex';
    }

    _enterEditMode() {
        const u = this.currentUser || Store.getState().currentUser;
        if (!u) return;

        this.isEditing = true;
        const root = this.container;
        if (!root) return;

        // 1. Header en modo edición
        const headerTitle = root.querySelector('#header-profile-title');
        const headerBadge = root.querySelector('#header-edit-badge');
        const btnLogout = root.querySelector('#btn-perfil-logout');
        const btnHeaderSave = root.querySelector('#btn-header-save');
        if (headerTitle) headerTitle.textContent = 'Editar perfil';
        if (headerBadge) headerBadge.style.display = 'inline-block';
        if (btnLogout) btnLogout.style.display = 'none';
        if (btnHeaderSave) btnHeaderSave.style.display = 'flex';

        // 2. Info principal: nombre en input
        const nameEl = root.querySelector('#perfil-nombre');
        const nameEditWrap = root.querySelector('#pe-name-edit-wrap');
        const editNombreInput = root.querySelector('#pe-edit-nombre');
        if (nameEl) nameEl.style.display = 'none';
        if (nameEditWrap) nameEditWrap.style.display = 'flex';
        if (editNombreInput) editNombreInput.value = u.displayName || u.nombre || '';

        // 3. Botones de acción principales
        const viewActions = root.querySelector('#view-profile-actions');
        const editActions = root.querySelector('#edit-profile-actions');
        if (viewActions) viewActions.style.display = 'none';
        if (editActions) editActions.style.display = 'flex';

        // 4. Conmutar paneles: ocultar view, mostrar edit
        root.querySelectorAll('.tab-panel .panel-view').forEach(p => p.style.display = 'none');
        root.querySelectorAll('.tab-panel .panel-edit').forEach(p => p.style.display = 'flex');

        // 5. Barra flotante inferior
        const floatBar = root.querySelector('#pe-floating-save-bar');
        if (floatBar) floatBar.style.display = 'flex';

        // 6. Cargar datos en los campos de edición (enriqueciendo con Auth metadata si faltan en BD)
        let authMeta = {};
        let authEmail = '';
        let authPhone = '';
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k) || 'null');
                    if (s?.user) {
                        authMeta = s.user.user_metadata || {};
                        authEmail = s.user.email || '';
                        authPhone = s.user.phone || authMeta.phone || '';
                        break;
                    }
                }
            }
        } catch (_) { }

        const setVal = (id, val) => {
            const inp = root.querySelector(id);
            if (inp) inp.value = val || '';
        };

        const fechaIngresoVal = formatDateForInput(u.fechaIngreso || u.fecha_contratacion || authMeta.fecha_contratacion || '');
        const fechaNacVal = formatDateForInput(u.cumpleanos || u.fecha_nacimiento || authMeta.fecha_nacimiento || '');
        const antiguedadVal = u.antiguedad || calcularAntiguedad(fechaIngresoVal) || '';

        setVal('#pe-edit-cedula', u.cedula || authMeta.cedula || authMeta.ID_USUARIO || '');
        setVal('#pe-edit-cargo', u.cargo || authMeta.cargo || '');
        setVal('#pe-edit-area', u.area || authMeta.area || '');
        setVal('#pe-edit-fecha-ingreso', fechaIngresoVal);
        setVal('#pe-edit-antiguedad', antiguedadVal);
        setVal('#pe-edit-fecha-nacimiento', fechaNacVal);

        // Productoras
        let productorasList = [];
        try {
            productorasList = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
        } catch (_) { }
        if (!productorasList.length) {
            productorasList = [
                { id_productora: 1, productora: 'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.' },
                { id_productora: 2, productora: 'TEXTILES Y CREACIONES LOS ANGELES S.A.S.' },
                { id_productora: 3, productora: 'HACEMOS MODA S.A.S.' },
                { id_productora: 4, productora: 'INVERSIONES URBANA S.A.S.' }
            ];
        }

        const selProd = root.querySelector('#pe-edit-productora');
        if (selProd) {
            const prodActual = (u.productora || authMeta.productora || '').trim().toUpperCase();
            selProd.innerHTML = '<option value="">Seleccione productora...</option>' + productorasList.map(p => {
                const nom = p.productora || p.nombre || '';
                const isSel = nom.toUpperCase() === prodActual;
                return `<option value="${nom}" ${isSel ? 'selected' : ''}>${nom}</option>`;
            }).join('');
        }

        const selSede = root.querySelector('#pe-edit-sede');
        if (selSede) {
            const sedeActual = (u.sede || authMeta.sede || 'CDI').trim().toUpperCase();
            selSede.value = SEDES_DISPONIBLES.includes(sedeActual) ? sedeActual : 'CDI';
        }

        // Contacto
        setVal('#pe-edit-email', u.email || authEmail || '');
        const rawTel = u.telefono || authPhone || authMeta.phone || authMeta.telefono || '';
        setVal('#pe-edit-telefono', String(rawTel).replace(/\D/g, '').slice(0, 10));

        // Ubicación
        setVal('#pe-edit-pais', 'Colombia');
        const selDpto = root.querySelector('#pe-edit-departamento');
        const dptoActual = (u.departamento || 'Antioquia').trim();
        const ciudadActual = (u.ciudad || 'Medellín').trim();

        if (selDpto) {
            selDpto.innerHTML = Object.keys(COLOMBIA_MAP).map(dep => `
                <option value="${dep}" ${dep.toLowerCase() === dptoActual.toLowerCase() ? 'selected' : ''}>${dep}</option>
            `).join('');
            this._updateCiudadesDropdown(selDpto.value, ciudadActual);
        }

        setVal('#pe-edit-direccion', u.direccion || '');
        setVal('#pe-edit-barrio', u.barrio || '');

        // 7. Guardar snapshot de valores iniciales para enviar SOLO los campos que cambien
        this._initialEditValues = {
            nombre: (root.querySelector('#pe-name-input')?.value || root.querySelector('#pe-edit-nombre')?.value || u.displayName || u.nombre || '').trim(),
            cedula: (root.querySelector('#pe-edit-cedula')?.value || '').trim(),
            cargo: (root.querySelector('#pe-edit-cargo')?.value || '').trim(),
            area: (root.querySelector('#pe-edit-area')?.value || '').trim(),
            fecha_contratacion: root.querySelector('#pe-edit-fecha-ingreso')?.value || '',
            fecha_nacimiento: root.querySelector('#pe-edit-fecha-nacimiento')?.value || '',
            productora: root.querySelector('#pe-edit-productora')?.value || '',
            sede: root.querySelector('#pe-edit-sede')?.value || 'CDI',
            email: (root.querySelector('#pe-edit-email')?.value || '').trim(),
            telefono: (root.querySelector('#pe-edit-telefono')?.value || '').replace(/\D/g, '').slice(0, 10),
            departamento: root.querySelector('#pe-edit-departamento')?.value || '',
            ciudad: root.querySelector('#pe-edit-ciudad')?.value || '',
            direccion: (root.querySelector('#pe-edit-direccion')?.value || '').trim(),
            barrio: (root.querySelector('#pe-edit-barrio')?.value || '').trim(),
        };
    }

    _updateCiudadesDropdown(dpto, ciudadActual = '') {
        const selectCiudad = this.container?.querySelector('#pe-edit-ciudad');
        if (!selectCiudad) return;
        const ciudades = COLOMBIA_MAP[dpto] || ['Otra'];
        selectCiudad.innerHTML = ciudades.map(c => `
            <option value="${c}" ${c.toLowerCase() === ciudadActual.toLowerCase() ? 'selected' : ''}>${c}</option>
        `).join('');
        if (!ciudades.includes('Otra')) {
            selectCiudad.innerHTML += `<option value="Otra">Otra ciudad...</option>`;
        }
    }

    _exitEditMode() {
        this.isEditing = false;
        const root = this.container;
        if (!root) return;

        // 1. Header
        const headerTitle = root.querySelector('#header-profile-title');
        const headerBadge = root.querySelector('#header-edit-badge');
        const btnLogout = root.querySelector('#btn-perfil-logout');
        const btnHeaderSave = root.querySelector('#btn-header-save');
        if (headerTitle) headerTitle.textContent = 'Mi perfil';
        if (headerBadge) headerBadge.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'flex';
        if (btnHeaderSave) btnHeaderSave.style.display = 'none';

        // 2. Info principal: volver a texto normal
        const nameEl = root.querySelector('#perfil-nombre');
        const nameEditWrap = root.querySelector('#pe-name-edit-wrap');
        if (nameEl) nameEl.style.display = 'block';
        if (nameEditWrap) nameEditWrap.style.display = 'none';

        // 3. Botones de acción
        const viewActions = root.querySelector('#view-profile-actions');
        const editActions = root.querySelector('#edit-profile-actions');
        if (viewActions) viewActions.style.display = 'flex';
        if (editActions) editActions.style.display = 'none';

        // 4. Conmutar paneles: mostrar view, ocultar edit
        root.querySelectorAll('.tab-panel .panel-view').forEach(p => p.style.display = 'block');
        root.querySelectorAll('.tab-panel .panel-edit').forEach(p => p.style.display = 'none');

        // 5. Barra flotante
        const floatBar = root.querySelector('#pe-floating-save-bar');
        if (floatBar) floatBar.style.display = 'none';

        // 6. Volver a aplicar reglas de visibilidad de campos vacíos
        this._renderProfile();
    }

    async _saveProfile() {
        const u = this.currentUser;
        if (!u) return;

        const root = this.container;
        if (!root) return;

        // 1. Extraer valores actuales
        const currentValues = {
            nombre: (root.querySelector('#pe-name-input')?.value || root.querySelector('#pe-edit-nombre')?.value || u.displayName || u.nombre || '').trim(),
            cedula: (root.querySelector('#pe-edit-cedula')?.value || '').trim(),
            cargo: (root.querySelector('#pe-edit-cargo')?.value || '').trim(),
            area: (root.querySelector('#pe-edit-area')?.value || '').trim(),
            fecha_contratacion: root.querySelector('#pe-edit-fecha-ingreso')?.value || '',
            fecha_nacimiento: root.querySelector('#pe-edit-fecha-nacimiento')?.value || '',
            productora: root.querySelector('#pe-edit-productora')?.value || '',
            sede: root.querySelector('#pe-edit-sede')?.value || 'CDI',
            email: (root.querySelector('#pe-edit-email')?.value || '').trim(),
            telefono: (root.querySelector('#pe-edit-telefono')?.value || '').replace(/\D/g, '').slice(0, 10),
            departamento: root.querySelector('#pe-edit-departamento')?.value || '',
            ciudad: root.querySelector('#pe-edit-ciudad')?.value || '',
            direccion: (root.querySelector('#pe-edit-direccion')?.value || '').trim(),
            barrio: (root.querySelector('#pe-edit-barrio')?.value || '').trim(),
        };

        // 2. Comparar contra el snapshot inicial: ENVIAR SOLO LO QUE CAMBIÓ
        const initial = this._initialEditValues || {};
        const updates = {};

        if (currentValues.nombre !== initial.nombre) {
            updates.nombre = currentValues.nombre;
            updates.full_name = currentValues.nombre;
        }
        if (currentValues.cedula !== initial.cedula) {
            updates.cedula = currentValues.cedula;
        }
        if (currentValues.cargo !== initial.cargo) {
            updates.cargo = currentValues.cargo;
        }
        if (currentValues.area !== initial.area) {
            updates.area = currentValues.area;
        }
        if (currentValues.fecha_contratacion !== initial.fecha_contratacion) {
            updates.fecha_contratacion = currentValues.fecha_contratacion ? currentValues.fecha_contratacion : null;
            updates.fechaIngreso = updates.fecha_contratacion;
            updates.antiguedad = currentValues.fecha_contratacion ? calcularAntiguedad(currentValues.fecha_contratacion) : null;
        }
        if (currentValues.fecha_nacimiento !== initial.fecha_nacimiento) {
            updates.fecha_nacimiento = currentValues.fecha_nacimiento ? currentValues.fecha_nacimiento : null;
            updates.cumpleanos = updates.fecha_nacimiento;
        }
        if (currentValues.productora !== initial.productora) {
            updates.productora = currentValues.productora;
            const prodCatalog = [
                { id_productora: 1, productora: 'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.' },
                { id_productora: 2, productora: 'TEXTILES Y CREACIONES LOS ANGELES S.A.S.' },
                { id_productora: 3, productora: 'HACEMOS MODA S.A.S.' },
                { id_productora: 4, productora: 'INVERSIONES URBANA S.A.S.' }
            ];
            const foundP = prodCatalog.find(p => p.productora.toUpperCase() === currentValues.productora.toUpperCase());
            updates.id_productora = foundP ? foundP.id_productora : null;
        }
        if (currentValues.sede !== initial.sede) {
            updates.sede = currentValues.sede;
        }
        if (currentValues.email !== initial.email) {
            updates.email = currentValues.email;
        }
        if (currentValues.telefono !== initial.telefono) {
            updates.telefono = currentValues.telefono;
        }
        if (currentValues.departamento !== initial.departamento) {
            updates.departamento = currentValues.departamento;
        }
        if (currentValues.ciudad !== initial.ciudad) {
            updates.ciudad = currentValues.ciudad;
        }
        if (currentValues.direccion !== initial.direccion) {
            updates.direccion = currentValues.direccion;
        }
        if (currentValues.barrio !== initial.barrio) {
            updates.barrio = currentValues.barrio;
        }

        // Si el usuario no modificó nada, salir sin peticiones innecesarias
        if (Object.keys(updates).length === 0) {
            Toast.info('Sin cambios para guardar');
            this._exitEditMode();
            return;
        }

        const saveBtns = [
            root.querySelector('#btn-guardar-edicion'),
            root.querySelector('#btn-header-save'),
            root.querySelector('#btn-float-save')
        ].filter(Boolean);

        saveBtns.forEach(btn => {
            btn.disabled = true;
            if (btn.querySelector('span') || btn.textContent) {
                btn.dataset.prevText = btn.textContent;
                btn.textContent = 'Guardando...';
            }
        });

        try {
            const targetId = currentValues.cedula || u.cedula || u.id || u.auth_user_id;
            await this.updateProfileUseCase.execute(targetId, updates);
            Toast.success('Cambios guardados');
            await this._loadData();
            this._exitEditMode();
        } catch (err) {
            console.error('[PerfilModule] Error al guardar perfil:', err);
            Toast.error('No se pudo guardar los cambios: ' + err.message);
        } finally {
            saveBtns.forEach(btn => {
                btn.disabled = false;
                if (btn.dataset.prevText) {
                    btn.textContent = btn.dataset.prevText;
                } else if (btn.id === 'btn-guardar-edicion' || btn.id === 'btn-float-save') {
                    btn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Guardar cambios
                    `;
                }
            });
        }
    }

    unmount() {
        this.container = null;
    }
}

