import { SupabaseAuthService } from '../services/SupabaseAuthService';

export class LoginForm {
  private container: HTMLElement;
  private onSuccess: () => void;

  constructor(containerId: string, onSuccess: () => void) {
    this.container = document.getElementById(containerId)!;
    this.onSuccess = onSuccess;
    this.render();
    this.attachEvents();
  }

  private render() {
    this.container.innerHTML = `
      <div class="login-field">
        <label for="email">Correo electrónico</label>
        <div class="login-input-wrap">
          <svg class="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <input class="input" id="email" type="email" placeholder="usuario@empresa.com" autocomplete="username" />
        </div>
      </div>

      <div class="login-field">
        <label for="password">Contraseña</label>
        <div class="login-input-wrap">
          <svg class="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input class="input" id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>
      </div>

      <button class="btn btn-primary login-btn" id="btnLogin">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Ingresar
      </button>

      <div id="loginMsg"></div>
    `;
  }

  private attachEvents() {
    const btnLogin = document.getElementById('btnLogin') as HTMLButtonElement;
    btnLogin.addEventListener('click', () => this.handleLogin());

    // Enter en cualquier input dispara login
    const emailInput   = document.getElementById('email')    as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    [emailInput, passwordInput].forEach(el => {
      el?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    });
  }

  private async handleLogin() {
    const loginMsg      = document.getElementById('loginMsg')!;
    const emailInput    = document.getElementById('email')    as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const btnLogin      = document.getElementById('btnLogin') as HTMLButtonElement;

    loginMsg.innerHTML = '';
    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      loginMsg.innerHTML = `
        <div class="status-banner err">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Completa todos los campos</span>
        </div>`;
      return;
    }

    btnLogin.disabled = true;
    btnLogin.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .8s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Verificando…`;

    try {
      await SupabaseAuthService.signIn(email, password);
      this.onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error de autenticación';
      loginMsg.innerHTML = `
        <div class="status-banner err">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>${msg}</span>
        </div>`;
      btnLogin.disabled = false;
      btnLogin.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Ingresar`;
    }
  }

  hide() {
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.add('hidden');
  }
}
