import { ExcelParserService, ParseResult } from '../services/ExcelParserService';
import { Producto, ImportMode } from '../types';

const ICON_FILE = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="16" y1="13" x2="8" y2="13"/>
  <line x1="16" y1="17" x2="8" y2="17"/>
  <polyline points="10 9 9 9 8 9"/>
</svg>`;

const ICON_UPLOAD = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="17 8 12 3 7 8"/>
  <line x1="12" y1="3" x2="12" y2="15"/>
</svg>`;

export class ImportForm {
  private container: HTMLElement;
  private onImport: (rows: Producto[], mode: ImportMode) => Promise<void>;
  private parsedRows: Producto[] = [];

  constructor(containerId: string, onImport: (rows: Producto[], mode: ImportMode) => Promise<void>) {
    this.container = document.getElementById(containerId)!;
    this.onImport = onImport;
    this.render();
    this.attachEvents();
  }

  private render() {
    this.container.innerHTML = `
      <!-- Drop zone -->
      <div class="drop-zone" id="dropZone">
        <input type="file" id="fileInput" accept=".xlsx,.xls" />
        <div class="drop-icon">${ICON_UPLOAD}</div>
        <span class="drop-title">Arrastra tu archivo aquí</span>
        <span class="drop-sub">o haz clic para seleccionar · .xlsx, .xls</span>
      </div>

      <!-- Selected file indicator -->
      <div id="fileChosen" class="hidden" style="margin-top:12px">
        <div class="file-chosen">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="fileChosenName"></span>
          <span id="fileChosenRows" style="margin-left:auto;font-size:11px;color:var(--ink-3)"></span>
        </div>
      </div>

      <!-- Options row -->
      <div class="form-row" style="margin-top:16px">
        <div class="form-group">
          <label>Modo de importación</label>
          <select class="select" id="modo">
            <option value="merge" selected>Merge — agregar / actualizar meses</option>
            <option value="replace">Replace — sobrescribir meses existentes</option>
          </select>
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn btn-primary" id="btnImport" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Importar
          </button>
        </div>
      </div>

      <!-- Status -->
      <div id="importEstado"></div>
    `;
  }

  private attachEvents() {
    const dropZone  = document.getElementById('dropZone')!;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;

    fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag and drop visual feedback
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Reasignar el file al input
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });

    const btnImport = document.getElementById('btnImport')!;
    btnImport.addEventListener('click', () => this.handleImport());
  }

  private async handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    this.setEstado('');

    const dropZone    = document.getElementById('dropZone')!;
    const fileChosen  = document.getElementById('fileChosen')!;
    const chosenName  = document.getElementById('fileChosenName')!;
    const chosenRows  = document.getElementById('fileChosenRows')!;
    const btnImport   = document.getElementById('btnImport') as HTMLButtonElement;

    // Loading state on drop zone
    dropZone.style.opacity = '.5';

    try {
      const result: ParseResult = await ExcelParserService.parseFile(file);
      this.parsedRows = result.rows;

      dropZone.style.opacity = '1';
      fileChosen.classList.remove('hidden');
      chosenName.textContent = file.name;
      chosenRows.textContent = `${result.validRows.toLocaleString('es-CO')} filas válidas`;

      if (result.validRows === 0) {
        fileChosen.classList.add('hidden');
        this.setEstado('El archivo no contiene filas válidas', 'err');
        btnImport.disabled = true;
      } else {
        btnImport.disabled = false;
      }
    } catch (error) {
      dropZone.style.opacity = '1';
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.setEstado(`Error leyendo archivo: ${msg}`, 'err');
      btnImport.disabled = true;
    }
  }

  private async handleImport() {
    if (this.parsedRows.length === 0) return;

    const btnImport  = document.getElementById('btnImport')  as HTMLButtonElement;
    const modoSelect = document.getElementById('modo')       as HTMLSelectElement;
    const mode       = (modoSelect?.value || 'merge') as ImportMode;

    btnImport.disabled = true;
    btnImport.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .8s linear infinite;width:14px;height:14px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Importando…`;

    this.setEstado('Procesando archivo…', 'info');

    try {
      await this.onImport(this.parsedRows, mode);
    } finally {
      btnImport.disabled = false;
      btnImport.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Importar`;
    }
  }

  public setEstado(msg: string, tipo: '' | 'ok' | 'err' | 'info' = '') {
    const el = document.getElementById('importEstado');
    if (!el) return;

    if (!msg) { el.innerHTML = ''; return; }

    const icons: Record<string, string> = {
      ok: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      err: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    el.innerHTML = `
      <div class="status-banner ${tipo || 'info'}">
        ${icons[tipo] || icons.info}
        <span>${msg}</span>
      </div>`;
  }

  public setEstadoHtml(html: string, tipo: '' | 'ok' | 'err' | 'info' = '') {
    const el = document.getElementById('importEstado');
    if (!el) return;

    if (!html) { el.innerHTML = ''; return; }

    const icons: Record<string, string> = {
      ok: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      err: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    el.innerHTML = `
      <div class="status-banner ${tipo || 'info'}">
        ${icons[tipo] || icons.info}
        <span>${html}</span>
      </div>`;
  }
}
