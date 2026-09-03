/**
 * modal-helper.js — Helper para modales consistentes
 * ═══════════════════════════════════════════════════
 * Crea modales tipo "sheet" con el mismo diseño que personas
 */

'use strict';

window.ModalHelper = (function() {
    
    /**
     * Abre un modal tipo sheet desde abajo
     * @param {Object} options - Configuración del modal
     * @param {string} options.title - Título del modal
     * @param {string} options.subtitle - Subtítulo opcional
     * @param {string} options.avatar - HTML del avatar (opcional)
     * @param {string} options.content - Contenido HTML del modal
     * @param {Function} options.onClose - Callback al cerrar
     */
    function openSheet(options) {
        const { title, subtitle, avatar, content, onClose } = options;
        
        // Cerrar sheet existente si hay
        closeSheet();
        
        // Inyectar estilos si no existen
        if (!document.getElementById('modal-sheet-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-sheet-styles';
            style.textContent = `
                .p-backdrop {
                    position: fixed; inset: 0;
                    background: rgba(15,23,42,.4);
                    backdrop-filter: blur(2px);
                    z-index: 200;
                    opacity: 0; visibility: hidden;
                    transition: opacity .25s, visibility .25s;
                }
                .p-backdrop.open { opacity: 1; visibility: visible; }
                
                .p-sheet {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    background: #fff;
                    border-radius: 20px 20px 0 0;
                    z-index: 201;
                    max-height: 92vh;
                    overflow-y: auto;
                    transform: translateY(100%);
                    transition: transform .3s cubic-bezier(.4,0,.2,1);
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
                .p-sheet.open { transform: translateY(0); }
                
                .p-sheet-drag {
                    width: 36px; height: 4px;
                    background: #e2e8f0; border-radius: 2px;
                    margin: 10px auto 0;
                    cursor: pointer;
                }
                
                .p-sheet-content {
                    /* Contenedor principal del contenido */
                }
                
                .p-sheet-head {
                    display: flex; align-items: center; gap: 14px;
                    padding: 16px 20px 12px;
                    border-bottom: 1px solid #f1f5f9;
                }
                
                .p-sheet-avatar {
                    width: 52px; height: 52px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.1rem; font-weight: 700; color: #fff;
                    flex-shrink: 0;
                }
                
                .p-sheet-name {
                    font-size: .95rem; font-weight: 700;
                    color: var(--color-text, #1e293b); margin: 0 0 2px;
                }
                
                .p-sheet-email {
                    font-size: .72rem; color: var(--color-text-muted, #64748b);
                }
                
                .p-section-title {
                    font-size: .62rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: .07em;
                    color: var(--color-text-light, #94a3b8);
                    padding: 8px 14px 4px;
                }
                
                .p-field { margin: 0 20px 10px; }
                
                .p-field-label {
                    font-size: .63rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: .06em;
                    color: var(--color-text-muted, #64748b);
                    margin-bottom: 4px; display: flex; align-items: center; gap: 4px;
                }
                
                .p-field-input, .p-field-select {
                    width: 100%; padding: 9px 12px;
                    border: 1px solid var(--color-border, #e2e8f0);
                    border-radius: 8px; background: #fff;
                    font-size: .875rem; color: var(--color-text, #1e293b);
                    font-family: var(--font, sans-serif); outline: none;
                    transition: border-color .15s;
                    box-sizing: border-box;
                }
                
                .p-field-input:focus, .p-field-select:focus {
                    border-color: var(--color-primary, #3b82f6);
                    box-shadow: 0 0 0 3px rgba(59,130,246,.1);
                }
                
                .p-sheet-actions {
                    display: flex; gap: 8px;
                    padding: 16px 20px 24px;
                    margin-top: 8px;
                }
                
                .p-btn-primary {
                    flex: 1; padding: 11px;
                    background: var(--color-primary, #3b82f6);
                    color: #fff; border: none; border-radius: 8px;
                    font-size: .82rem; font-weight: 700;
                    font-family: var(--font, sans-serif);
                    cursor: pointer; transition: opacity .15s;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                }
                .p-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
                .p-btn-primary svg {
                    width: 14px; height: 14px;
                    stroke: currentColor; fill: none;
                    stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;
                }
                
                .p-btn-secondary {
                    padding: 11px 16px;
                    background: #f1f5f9; color: var(--color-text-muted, #64748b);
                    border: none; border-radius: 8px;
                    font-size: .82rem; font-weight: 600;
                    font-family: var(--font, sans-serif);
                    cursor: pointer; transition: background .15s;
                }
                .p-btn-secondary:hover { background: #e2e8f0; }
                
                .p-toast {
                    position: fixed; top: 64px; right: 16px; left: 16px;
                    background: #22c55e; color: #fff;
                    padding: 10px 16px; border-radius: 10px;
                    font-size: .82rem; font-weight: 700;
                    box-shadow: 0 4px 14px rgba(0,0,0,.15);
                    z-index: 9999;
                    display: flex; align-items: center; gap: 8px;
                    opacity: 0;
                    transform: translateY(-10px);
                    transition: opacity .3s, transform .3s;
                }
                .p-toast.show { opacity: 1; transform: translateY(0); }
                .p-toast.error { background: #dc2626; }
            `;
            document.head.appendChild(style);
        }
        
        // Crear backdrop (overlay)
        const backdrop = document.createElement('div');
        backdrop.id = 'modal-sheet-overlay';
        backdrop.className = 'p-backdrop';
        
        // Crear sheet
        const sheet = document.createElement('div');
        sheet.id = 'modal-sheet';
        sheet.className = 'p-sheet';
        
        sheet.innerHTML = `
            <div class="p-sheet-drag"></div>
            <div class="p-sheet-content" id="modal-sheet-body">
                ${avatar ? `
                    <div class="p-sheet-head">
                        ${avatar}
                        <div>
                            <p class="p-sheet-name">${title}</p>
                            ${subtitle ? `<p class="p-sheet-email">${subtitle}</p>` : ''}
                        </div>
                    </div>
                ` : `
                    <div style="padding: 20px 20px 12px">
                        <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0 0 4px;">${title}</h3>
                        ${subtitle ? `<p style="font-size: 0.875rem; color: #64748b; margin: 0;">${subtitle}</p>` : ''}
                    </div>
                `}
                ${content}
            </div>
        `;
        
        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);
        
        // Animar entrada
        requestAnimationFrame(() => {
            backdrop.classList.add('open');
            sheet.classList.add('open');
        });
        
        // Eventos de cierre
        backdrop.addEventListener('click', () => {
            closeSheet();
            if (onClose) onClose();
        });
        
        const drag = sheet.querySelector('.p-sheet-drag');
        if (drag) {
            drag.addEventListener('click', () => {
                closeSheet();
                if (onClose) onClose();
            });
        }
        
        return sheet;
    }
    
    /**
     * Cierra el sheet activo
     */
    function closeSheet() {
        const backdrop = document.getElementById('modal-sheet-overlay');
        const sheet = document.getElementById('modal-sheet');
        
        if (backdrop) {
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 300);
        }
        
        if (sheet) {
            sheet.classList.remove('open');
            setTimeout(() => sheet.remove(), 300);
        }
    }
    
    /**
     * Genera HTML de avatar con iniciales
     */
    function avatarInitials(name, gradient) {
        const parts = (name || '').trim().split(' ').filter(Boolean);
        const inits = parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : (name || 'US').slice(0, 2).toUpperCase();
        
        return `<div class="p-sheet-avatar" style="background:${gradient}">${inits}</div>`;
    }
    
    /**
     * Genera HTML de avatar con icono SVG
     */
    function avatarIcon(svgPath, gradient) {
        return `<div class="p-sheet-avatar" style="background:${gradient}">
            <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
                ${svgPath}
            </svg>
        </div>`;
    }
    
    /**
     * Crea un toast notification
     */
    function toast(message, isError = false) {
        const existing = document.getElementById('toast-notification');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'p-toast' + (isError ? ' error' : '');
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('show'));
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * SVG helper
     */
    function svg(paths, size = 24) {
        return `<svg viewBox="0 0 24 24" style="width:${size}px;height:${size}px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${paths}</svg>`;
    }
    
    // API pública
    return {
        openSheet,
        closeSheet,
        avatarInitials,
        avatarIcon,
        toast,
        svg
    };
})();
