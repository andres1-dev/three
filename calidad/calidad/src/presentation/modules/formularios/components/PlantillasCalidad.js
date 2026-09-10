/**
 * PlantillasCalidad.js
 * FAB arrastrable con modal de plantillas para el formulario de Calidad.
 * Pestañas: UBICACION · PAQUETEO · MOTIVOS · COMPROMISO (calendar para RONDA)
 *
 * Uso:
 *   const fab = new PlantillasCalidad({ targetId: 'cal-observaciones-text' });
 *   fab.mount();           // inyecta FAB + modal en document.body
 *   fab.setTipo('RONDA');  // muestra/oculta pestaña COMPROMISO
 *   fab.unmount();         // limpia todo del DOM
 */

const PLANTILLAS = {
    UBICACION: [
        'UBICACIÓN DE ETIQUETA: Manga izquierda de la prenda puesta, ubicada entre costuras.',
        'UBICACIÓN DE ETIQUETA: Pasador delantero izquierdo de la prenda puesta.',
        'UBICACIÓN DE ETIQUETA: Marquilla de talla.',
        'UBICACIÓN DE ETIQUETA: Delantero izquierdo de la prenda puesta, ubicada entre costuras a 5 cm del costado.',
        'UBICACIÓN DE ETIQUETA: Sisa izquierda de la prenda puesta, ubicada entre costuras.',
        'UBICACIÓN DE ETIQUETA: En la tira libre izquierda de la prenda puesta.',
        'UBICACIÓN DE ETIQUETA: Lado izquierdo, prenda puesta. Ubicar las 2 etiquetas en el hombro, sujetando ambas prendas. Ubicar la etiqueta de precio en la manga, centrada sobre la costura. Ambas etiquetas deben quedar en la prenda principal.',
        'UBICACIÓN DE ETIQUETA: Ensamblar las prendas del DUO (posterior con posterior). Ubicar la etiqueta principal del dúo a la altura del cuello y asegurarla con dos plastiflechas, una a cada lado del cuello, garantizando que la etiqueta quede centrada y uniendo ambas prendas para su correcta presentación.',
    ],
    PAQUETEO: [
        'INSTRUCCIÓN DE PAQUETEO: Paquetear en grupos de 10 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.',
        'INSTRUCCIÓN DE PAQUETEO: Paquetear en grupos de 20 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.',
        'INSTRUCCIÓN DE PAQUETEO: Paquetear en grupos de 10 unidades, ensambladas espalda con espalda, dobladas individualmente y con las etiquetas aseguradas y amarradas.',
        'INSTRUCCIÓN DE PAQUETEO: Paquetear en grupos de 10 unidades, organizadas una sobre otra; doblar las piernas y posteriormente la prenda a la mitad, asegurando el paquete y amarrando las etiquetas correspondientes.',
        'INSTRUCCIÓN DE PAQUETEO: Paquetear blusa principal y combinaciones sin ensamblar, separadas por talla y color.',
    ],
    MOTIVOS: [
        'MOTIVO DE RECHAZO: Costuras abiertas en cuello y hombros superior al 3% del muestreo.',
        'MOTIVO DE RECHAZO: Puntada saltada recurrente en uniones laterales, supera límite AQL.',
        'MOTIVO DE RECHAZO: Diferencia de tono entre piezas del mismo lote (frente/espalda/manga).',
        'MOTIVO DE RECHAZO: Asimetría en largos de manga / pierna superior a tolerancia permitida (±0.5 cm).',
        'MOTIVO DE RECHAZO: Suciedad, manchas o defectos de tejido visibles en más del 2% de prendas.',
        'MOTIVO DE RECHAZO: Etiquetas mal ubicadas o ausentes en el muestreo inspeccionado.',
        'MOTIVO DE RECHAZO: Piquetes, roturas o quemaduras detectadas durante la inspección.',
        'MOTIVO DE RECHAZO: Cierre defectuoso o mal instalado en más del 4% del muestreo.',
        'MOTIVO DE RECHAZO: Mal paqueteo — prendas sin doblar correctamente o etiquetas desalineadas.',
        'MOTIVO DE RECHAZO: Bordado o estampado corrido, despegado o mal registrado.',
    ],
};

const DIAS_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

export class PlantillasCalidad {
    constructor({ targetId = 'cal-observaciones-text' } = {}) {
        this.targetId = targetId;
        this.currentTab = 'UBICACION';
        this.tipoVisita = '';
        this._fab = null;
        this._backdrop = null;
        this._open = false;
        this._calYear = new Date().getFullYear();
        this._calMonth = new Date().getMonth();
        this._calSelected = null;
        // Drag state
        this._dragging = false;
        this._dragOffX = 0;
        this._dragOffY = 0;
        this._hasDragged = false;
        // Bound handlers para limpieza
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
    }

    // ── API pública ──────────────────────────────────────────────────────────

    mount() {
        if (document.getElementById('cal-fab-plantillas')) return;
        this._injectFab();
        this._injectModal();
        this._bindFab();
    }

    unmount() {
        this._fab?.remove();
        this._backdrop?.remove();
        this._fab = null;
        this._backdrop = null;
        document.removeEventListener('pointermove', this._onPointerMove);
        document.removeEventListener('pointerup', this._onPointerUp);
    }

    /** Actualiza el tipo de visita para mostrar/ocultar la pestaña COMPROMISO */
    setTipo(tipo) {
        this.tipoVisita = (tipo || '').toUpperCase();
        this._updateTabVisibility();
        // Si la tab activa queda oculta, volver a UBICACION
        if (this.currentTab === 'COMPROMISO' && this.tipoVisita !== 'RONDA') {
            this._selectTab('UBICACION');
        }
    }

    // ── Inyección DOM ────────────────────────────────────────────────────────

    _injectFab() {
        const btn = document.createElement('button');
        btn.id = 'cal-fab-plantillas';
        btn.className = 'cal-fab';
        btn.title = 'Plantillas de calidad';
        btn.setAttribute('aria-label', 'Abrir plantillas de calidad');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
            </svg>`;
        document.body.appendChild(btn);
        this._fab = btn;
    }

    _injectModal() {
        const bd = document.createElement('div');
        bd.id = 'cal-fab-backdrop';
        bd.className = 'cal-fab-backdrop';
        bd.innerHTML = `
            <div class="cal-fab-modal" role="dialog" aria-label="Plantillas de calidad">
                <div class="cal-fab-modal-header">
                    <span class="cal-fab-modal-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        Plantillas
                    </span>
                    <button class="cal-fab-modal-close" id="cal-fab-close" aria-label="Cerrar">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="cal-fab-tabs" id="cal-fab-tabs">
                    <button class="cal-fab-tab active" data-tab="UBICACION">Ubicación</button>
                    <button class="cal-fab-tab" data-tab="PAQUETEO">Paqueteo</button>
                    <button class="cal-fab-tab" data-tab="MOTIVOS">Motivos</button>
                    <button class="cal-fab-tab cal-fab-tab-compromiso" data-tab="COMPROMISO" style="display:none;">Compromiso</button>
                </div>
                <div class="cal-fab-modal-body" id="cal-fab-body">
                    <!-- Contenido renderizado dinámicamente -->
                </div>
            </div>`;
        document.body.appendChild(bd);
        this._backdrop = bd;
        this._renderTab();
    }

    // ── Eventos ──────────────────────────────────────────────────────────────

    _bindFab() {
        // Abrir/cerrar con clic (si no fue arrastre)
        this._fab.addEventListener('pointerdown', this._onPointerDown);

        // Cerrar con botón X
        this._backdrop.querySelector('#cal-fab-close').addEventListener('click', () => this._close());

        // Cerrar al hacer clic en el backdrop (fuera del modal)
        this._backdrop.addEventListener('click', (e) => {
            if (e.target === this._backdrop) this._close();
        });

        // Pestañas
        this._backdrop.querySelector('#cal-fab-tabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (btn) this._selectTab(btn.dataset.tab);
        });
    }

    // ── Drag ─────────────────────────────────────────────────────────────────

    _onPointerDown(e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        this._dragging = true;
        this._hasDragged = false;
        const rect = this._fab.getBoundingClientRect();
        this._dragOffX = e.clientX - rect.left;
        this._dragOffY = e.clientY - rect.top;
        this._fab.style.transition = 'none';
        this._fab.setPointerCapture(e.pointerId);
        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);
    }

    _onPointerMove(e) {
        if (!this._dragging) return;
        const dx = Math.abs(e.clientX - (this._fab.getBoundingClientRect().left + this._dragOffX));
        const dy = Math.abs(e.clientY - (this._fab.getBoundingClientRect().top + this._dragOffY));
        if (dx > 4 || dy > 4) this._hasDragged = true;

        const x = Math.min(Math.max(0, e.clientX - this._dragOffX), window.innerWidth - this._fab.offsetWidth);
        const y = Math.min(Math.max(0, e.clientY - this._dragOffY), window.innerHeight - this._fab.offsetHeight);
        this._fab.style.left = x + 'px';
        this._fab.style.top  = y + 'px';
        this._fab.style.bottom = 'auto';
        this._fab.style.right  = 'auto';
    }

    _onPointerUp(e) {
        document.removeEventListener('pointermove', this._onPointerMove);
        document.removeEventListener('pointerup', this._onPointerUp);
        this._fab.style.transition = '';
        if (!this._hasDragged) {
            this._open ? this._close() : this._open_modal();
        }
        this._dragging = false;
    }

    // ── Abrir / Cerrar ────────────────────────────────────────────────────────

    _open_modal() {
        this._open = true;
        this._backdrop.classList.add('open');
        this._fab.classList.add('active');
    }

    _close() {
        this._open = false;
        this._backdrop.classList.remove('open');
        this._fab.classList.remove('active');
    }

    // ── Pestañas ──────────────────────────────────────────────────────────────

    _selectTab(tab) {
        this.currentTab = tab;
        this._backdrop.querySelectorAll('.cal-fab-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });
        this._renderTab();
    }

    _updateTabVisibility() {
        const tabCompromiso = this._backdrop?.querySelector('.cal-fab-tab-compromiso');
        if (tabCompromiso) {
            tabCompromiso.style.display = this.tipoVisita === 'RONDA' ? '' : 'none';
        }
    }

    // ── Renderizado de contenido ──────────────────────────────────────────────

    _renderTab() {
        const body = this._backdrop?.querySelector('#cal-fab-body');
        if (!body) return;

        if (this.currentTab === 'COMPROMISO') {
            body.innerHTML = this._buildCalendar();
            this._bindCalendar(body);
        } else {
            const items = PLANTILLAS[this.currentTab] || [];
            body.innerHTML = items.map((txt, i) => `
                <div class="cal-fab-card" data-index="${i}">
                    <p class="cal-fab-card-text">${this._esc(txt)}</p>
                    <div class="cal-fab-card-actions">
                        <button class="cal-fab-btn-copy" data-index="${i}" title="Copiar">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg> Copiar
                        </button>
                        <button class="cal-fab-btn-insert" data-index="${i}" title="Insertar en observaciones">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                            </svg> Insertar
                        </button>
                    </div>
                </div>`).join('');

            body.querySelectorAll('.cal-fab-btn-copy').forEach(btn => {
                btn.addEventListener('click', () => {
                    const txt = PLANTILLAS[this.currentTab][parseInt(btn.dataset.index)];
                    navigator.clipboard?.writeText(txt).catch(() => {});
                    btn.textContent = '✓ Copiado';
                    setTimeout(() => { btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar'; }, 1500);
                });
            });

            body.querySelectorAll('.cal-fab-btn-insert').forEach(btn => {
                btn.addEventListener('click', () => {
                    const txt = PLANTILLAS[this.currentTab][parseInt(btn.dataset.index)];
                    this._insertText(txt);
                    this._close();
                });
            });
        }
    }

    // ── Calendario de Compromiso ──────────────────────────────────────────────

    _buildCalendar() {
        const y = this._calYear;
        const m = this._calMonth;
        const label = `${MESES[m]} ${y}`;
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const today = new Date();

        let days = '';
        for (let i = 0; i < firstDay; i++) days += '<div></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m, d);
            const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isSelected = this._calSelected?.getDate() === d && this._calSelected?.getMonth() === m && this._calSelected?.getFullYear() === y;
            const isToday = today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;
            days += `<button class="cal-day${isPast ? ' past' : ''}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}" data-day="${d}" ${isPast ? 'disabled' : ''}>${d}</button>`;
        }

        const selLabel = this._calSelected
            ? `${DIAS_LARGO[this._calSelected.getDay()]}, ${this._calSelected.getDate()} de ${MESES[this._calSelected.getMonth()].toLowerCase()} del ${this._calSelected.getFullYear()}`
            : '— seleccione una fecha —';

        return `
            <div class="cal-fab-cal">
                <div class="cal-fab-cal-selected">${selLabel}</div>
                <div class="cal-fab-cal-nav">
                    <button id="cal-prev-month" class="cal-nav-btn">&#8249;</button>
                    <span class="cal-month-label">${label}</span>
                    <button id="cal-next-month" class="cal-nav-btn">&#8250;</button>
                </div>
                <div class="cal-fab-cal-dow">${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}</div>
                <div class="cal-fab-cal-grid" id="cal-days-grid">${days}</div>
                <button class="cal-fab-btn-compromiso" id="btn-insertar-compromiso" ${!this._calSelected ? 'disabled' : ''}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Insertar fecha de compromiso
                </button>
            </div>`;
    }

    _bindCalendar(body) {
        body.querySelector('#cal-prev-month').addEventListener('click', () => {
            if (this._calMonth === 0) { this._calMonth = 11; this._calYear--; }
            else this._calMonth--;
            this._renderTab();
        });
        body.querySelector('#cal-next-month').addEventListener('click', () => {
            if (this._calMonth === 11) { this._calMonth = 0; this._calYear++; }
            else this._calMonth++;
            this._renderTab();
        });
        body.querySelector('#cal-days-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.cal-day:not([disabled])');
            if (!btn) return;
            this._calSelected = new Date(this._calYear, this._calMonth, parseInt(btn.dataset.day));
            this._renderTab();
        });
        body.querySelector('#btn-insertar-compromiso')?.addEventListener('click', () => {
            if (!this._calSelected) return;
            const texto = `COMPROMISO DE ENTREGA: ${DIAS_LARGO[this._calSelected.getDay()]}, ${this._calSelected.getDate()} de ${MESES[this._calSelected.getMonth()].toLowerCase()} del ${this._calSelected.getFullYear()}.`;
            this._insertText(texto);
            this._close();
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _insertText(text) {
        const el = document.getElementById(this.targetId);
        if (!el) return;
        const start = el.selectionStart ?? el.value.length;
        const end   = el.selectionEnd   ?? el.value.length;
        const sep   = el.value && !el.value.endsWith('\n') ? '\n' : '';
        el.value = el.value.slice(0, start) + sep + text + '\n' + el.value.slice(end);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.focus();
    }

    _esc(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}
