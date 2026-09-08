/**
 * Central Estética y Transparente de Éxito / Feedback (Dynamic HUD Pill)
 * Muestra confirmaciones compactas, translúcidas y no intrusivas.
 */
class ToastManager {
    constructor() {
        this.container = null;
        this.activeToast = null;
        this.dismissTimer = null;
    }

    _ensureContainer() {
        if (!this.container || !document.body.contains(this.container)) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        return this.container;
    }

    show(message, type = 'success', durationMs = 1600) {
        const container = this._ensureContainer();

        // Si ya hay uno visible, removerlo suavemente de inmediato sin acumular
        if (this.activeToast) {
            clearTimeout(this.dismissTimer);
            this.activeToast.remove();
            this.activeToast = null;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSvg = type === 'success'
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34d399" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
            : type === 'error'
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f87171" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            : type === 'warning'
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fbbf24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60a5fa" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

        toast.innerHTML = `
            <div class="toast-hud-icon">${iconSvg}</div>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        this.activeToast = toast;

        this.dismissTimer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px) scale(0.95)';
            toast.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
            setTimeout(() => {
                if (toast === this.activeToast) {
                    this.activeToast = null;
                }
                toast.remove();
            }, 220);
        }, durationMs);
    }

    success(msg, duration) { this.show(msg, 'success', duration); }
    error(msg, duration) { this.show(msg, 'error', duration); }
    info(msg, duration) { this.show(msg, 'info', duration); }
    warning(msg, duration) { this.show(msg, 'warning', duration); }
}

export const Toast = new ToastManager();
