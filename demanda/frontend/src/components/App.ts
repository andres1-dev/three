import { SupabaseAuthService } from '../services/SupabaseAuthService';
import { ProductoService } from '../services/ProductoService';
import { Producto, ImportMode } from '../types';
import { ProductTable } from './ProductTable';
import { ImportForm } from './ImportForm';

// Motor de análisis de demanda cargado como script global en index.html
declare const window: Window & {
  App: { switchView: (v: string) => void };
  ejecutarAnalisisDemanda?: (items: Producto[]) => void;
};

type View = 'upload' | 'consulta';

export class App {
  private user: { email: string } | null = null;
  private productTable: ProductTable;
  private importForm: ImportForm;
  private currentView: View = 'consulta';

  constructor() {
    this.productTable = new ProductTable('productos');
    this.importForm   = new ImportForm('importContainer', (rows, mode) => this.handleImport(rows, mode));
    this.initialize();
    (window as any).App = { switchView: (v: View) => this.switchView(v) };
  }

  // ─── Token siempre fresco ────────────────────────────────────────────────────
  // El SDK de Supabase renueva el access_token automáticamente con el refresh_token.
  // Llamar getSession() antes de cada petición garantiza que nunca usemos un JWT vencido.
  private async getToken(): Promise<string> {
    const session = await SupabaseAuthService.getSession();
    if (!session) {
      // Sesión expirada sin refresh posible → volver al login
      location.reload();
      throw new Error('Sesión expirada');
    }
    return session.access_token;
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  private async initialize() {
    try {
      const session = await SupabaseAuthService.getSession();
      if (session) {
        this.user = { email: session.user.email };
        this.showApp();
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
    this.attachGlobalEvents();
  }

  private attachGlobalEvents() {
    document.getElementById('btnLogout')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('btnBuscarRefp')?.addEventListener('click', () => this.loadProductos());
    document.getElementById('btnReload')?.addEventListener('click', () => this.clearSearch());

    const refpInput   = document.getElementById('refp') as HTMLInputElement | null;
    const searchInput = document.getElementById('q')    as HTMLInputElement | null;
    refpInput?.addEventListener('keydown',   (e) => { if (e.key === 'Enter') this.loadProductos(); });
    searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadProductos(); });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  switchView(view: View) {
    this.currentView = view;
    document.querySelectorAll<HTMLElement>('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(view === 'upload' ? 'navUpload' : 'navConsulta')?.classList.add('active');
    document.querySelectorAll<HTMLElement>('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(view === 'upload' ? 'viewUpload' : 'viewConsulta')?.classList.add('active');
    const titles: Record<View, string> = { upload: 'Importar', consulta: 'Consulta de demanda' };
    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle) topbarTitle.textContent = titles[view];
  }

  // ─── Session ─────────────────────────────────────────────────────────────────

  private showApp() {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('shell')?.classList.remove('hidden');
    if (this.user) {
      const email = this.user.email;
      const userEmail  = document.getElementById('userEmail');
      const userAvatar = document.getElementById('userAvatar');
      if (userEmail)  userEmail.textContent  = email;
      if (userAvatar) userAvatar.textContent = email.charAt(0).toUpperCase();
    }
  }

  private async handleLogout() {
    try {
      await SupabaseAuthService.signOut();
      location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // ─── Filtro: un registro por empresa (el de mayor total_ventas) ───────────────

  private pickBestPerEmpresa(data: Producto[]): Producto[] {
    const map = new Map<string, Producto>();
    for (const p of data) {
      const current = map.get(p.empresa);
      if (!current || Number(p.total_ventas ?? 0) > Number(current.total_ventas ?? 0)) {
        map.set(p.empresa, p);
      }
    }
    return Array.from(map.values());
  }

  // ─── Consulta ─────────────────────────────────────────────────────────────────

  private clearSearch() {
    (document.getElementById('refp')  as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('refp') as HTMLInputElement).value = '');
    (document.getElementById('q') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('q') as HTMLInputElement).value = '');

    const totalInfo = document.getElementById('totalInfo');
    if (totalInfo) { totalInfo.textContent = ''; totalInfo.classList.add('hidden'); }

    const analisis = document.getElementById('analisisContenedor');
    if (analisis) { analisis.classList.add('hidden'); analisis.innerHTML = ''; }

    this.productTable.clear();
  }

  private async loadProductos() {
    const refProveedor = (document.getElementById('refp') as HTMLInputElement | null)?.value.trim() ?? '';
    const q            = (document.getElementById('q')    as HTMLInputElement | null)?.value.trim() ?? '';
    const totalInfo    = document.getElementById('totalInfo');

    if (!refProveedor && !q) {
      if (totalInfo) { totalInfo.textContent = ''; totalInfo.classList.add('hidden'); }
      const analisis = document.getElementById('analisisContenedor');
      if (analisis) { analisis.classList.add('hidden'); analisis.innerHTML = ''; }
      this.productTable.clear();
      return;
    }

    const btnBuscar = document.getElementById('btnBuscarRefp') as HTMLButtonElement | null;
    if (btnBuscar) {
      btnBuscar.disabled = true;
      btnBuscar.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             style="width:14px;height:14px;animation:spin .8s linear infinite">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Buscando…`;
    }

    try {
      // Token siempre fresco — el SDK renueva automáticamente si el JWT venció
      const token = await this.getToken();

      const filters: { q?: string; ref_proveedor?: string } = {};
      if (refProveedor) filters.ref_proveedor = refProveedor;
      if (q)            filters.q             = q;

      const result = await ProductoService.listProductos(token, 1, 50, filters);

      const dataFinal = refProveedor ? this.pickBestPerEmpresa(result.data) : result.data;

      if (totalInfo) {
        const label      = refProveedor ? `ref. proveedor "${refProveedor}"` : `"${q}"`;
        const totalRaw   = result.count;
        const totalFilt  = dataFinal.length;
        const sufijo     = refProveedor && totalFilt < totalRaw
          ? ` · ${totalFilt} empresa${totalFilt !== 1 ? 's' : ''} (${totalRaw} registros totales)`
          : '';
        totalInfo.textContent = `${totalRaw.toLocaleString('es-CO')} resultado${totalRaw !== 1 ? 's' : ''} · ${label}${sufijo}`;
        totalInfo.classList.remove('hidden');
      }

      if (typeof window.ejecutarAnalisisDemanda === 'function') {
        window.ejecutarAnalisisDemanda(dataFinal);
      }

      this.productTable.render(dataFinal, dataFinal.length);

    } catch (error) {
      console.error('Error listando:', error);
      if (totalInfo) { totalInfo.textContent = 'Error al consultar'; totalInfo.classList.remove('hidden'); }
      const analisis = document.getElementById('analisisContenedor');
      if (analisis) { analisis.classList.add('hidden'); analisis.innerHTML = ''; }
      this.productTable.render([], 0);
    } finally {
      if (btnBuscar) {
        btnBuscar.disabled = false;
        btnBuscar.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Buscar`;
      }
    }
  }

  // ─── Import ───────────────────────────────────────────────────────────────────

  private async handleImport(rows: Producto[], mode: ImportMode) {
    const hora = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      // Token fresco también para importaciones
      const token  = await this.getToken();
      const result = await ProductoService.importProductos(token, rows, mode);

      if (!result.ok || result.errores?.length) {
        const errs = result.errores?.length ? ` · ${result.errores.length} error(es)` : '';
        this.importForm.setEstadoHtml(
          `${result.error || 'Error al importar'}${errs} <span style="margin-left:8px;color:var(--ink-3);font-size:11px;font-family:var(--mono)">${hora()}</span>`,
          'err'
        );
        console.error('Import error:', result);
      } else {
        const cant = result.insertados?.toLocaleString('es-CO') ?? '0';
        this.importForm.setEstadoHtml(
          `<b>${cant}</b> filas importadas en modo <b>${mode}</b> <span style="margin-left:8px;color:var(--success);font-size:11px;font-family:var(--mono)">${hora()}</span>`,
          'ok'
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.importForm.setEstadoHtml(
        `${msg} <span style="margin-left:8px;color:var(--ink-3);font-size:11px;font-family:var(--mono)">${hora()}</span>`,
        'err'
      );
    }
  }
}
