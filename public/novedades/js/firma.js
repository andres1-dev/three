/* ==========================================================================
   js/firma.js — Módulo Dinámico de Firma de Conformidad
   Bugs corregidos:
   - Canvas inline: resize lazy vía IntersectionObserver para evitar rect 0x0
     cuando la sección del formulario está oculta al momento del init().
   - Fullscreen → Inline: drawImage corregido para copiar correctamente
     la firma al canvas del formulario con dimensiones CSS, no del buffer.
   ========================================================================== */

const FirmaTaller = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    _strokes: [],          // Registra los trazos para exportar como SVG
    _currentStroke: null,
    _inlineReady: false,

    // Canvas e interfaz de Pantalla Completa
    fsCanvas: null,
    fsCtx: null,
    fsIsDrawing: false,
    fsLastX: 0,
    fsLastY: 0,
    _fsStrokes: [],
    _fsCurrent: null,

    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[FirmaTaller] No se encontró el contenedor: ${containerId}`);
            return;
        }

        // 1. Inyectar HTML del control inline en el contenedor
        container.innerHTML = `
            <div class="mb-4">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label mb-0">Conformidad:</label>
                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn-action-muted" id="fullscreenFormSignatureBtn" style="font-size: 0.72rem; display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-expand"></i> Pantalla Completa
                  </button>
                  <button type="button" class="btn-action-muted" id="clearFormSignatureBtn" style="font-size: 0.72rem; display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-eraser"></i> Limpiar
                  </button>
                </div>
              </div>
              <div id="signatureCanvasWrapper" class="position-relative overflow-hidden" style="border: 1px solid var(--color-border); border-radius: var(--radius-input); background: #ffffff; height: 130px; cursor: crosshair;">
                <canvas id="formSignatureCanvas" style="position: absolute; top:0; left:0; width: 100%; height: 100%; touch-action: none; display: block;"></canvas>
                <div class="position-absolute bottom-0 start-0 w-100 p-2 pointer-events-none" style="background: linear-gradient(transparent, rgba(0,0,0,0.02)); display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.65rem; color: #94a3b8; font-style: italic;"><i class="fas fa-signature"></i> Firma aquí con tu dedo o mouse</span>
                </div>
              </div>
            </div>
        `;

        // 2. Inyectar modal de pantalla completa si no existe
        // 2. Inyectar modal de pantalla completa si no existe
        if (!document.getElementById('fullscreenSigModalStyles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'fullscreenSigModalStyles';
            styleEl.textContent = `
                #fullscreenSigModal {
                    transition: transform 0.2s ease, width 0.2s ease, height 0.2s ease;
                }
                @media (orientation: portrait) {
                    #fullscreenSigModal {
                        width: 100vh !important;
                        height: 100vw !important;
                        position: fixed !important;
                        top: 50% !important;
                        left: 50% !important;
                        transform: translate(-50%, -50%) rotate(90deg) !important;
                        transform-origin: center center !important;
                    }
                }
            `;
            document.head.appendChild(styleEl);
        }

        if (!document.getElementById('fullscreenSigModal')) {
            const modalDiv = document.createElement('div');
            modalDiv.id = 'fullscreenSigModal';
            modalDiv.style.cssText = [
                'position: fixed', 'top: 0', 'left: 0',
                'width: 100vw', 'height: 100vh',
                'background: #ffffff', 'z-index: 9999',
                'display: none',               // ← usamos display:none en lugar de class hidden
                'flex-direction: column',
                'justify-content: space-between',
                'padding: 20px', 'box-sizing: border-box'
            ].join('; ');
            modalDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                  <h2 style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0;">Firma de Conformidad</h2>
                  <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn-action-muted" id="clearFullscreenSigBtn" style="font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                      <i class="fas fa-eraser"></i> Limpiar
                    </button>
                    <button type="button" class="btn-action-muted" id="closeFullscreenSigBtn" style="font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                      <i class="fas fa-times"></i> Cerrar
                    </button>
                  </div>
                </div>

                <div id="fsCanvasWrapper" style="flex: 1; position: relative; margin: 20px 0; border: 2px dashed #cbd5e1; border-radius: 12px; background: #ffffff; overflow: hidden; cursor: crosshair;">
                  <canvas id="fullscreenSigCanvas" style="position: absolute; top:0; left:0; width: 100%; height: 100%; touch-action: none; display: block;"></canvas>
                  <div class="position-absolute bottom-0 start-0 w-100 p-3" style="background: linear-gradient(transparent, rgba(0,0,0,0.02)); display: flex; justify-content: center; align-items: center; text-align: center; pointer-events: none;">
                    <span style="font-size: 0.75rem; color: #94a3b8; font-style: italic;"><i class="fas fa-mobile-alt"></i> Firma fija en horizontal (Landscape)</span>
                  </div>
                </div>

                <div style="display: flex; justify-content: center; align-items: center;">
                  <button type="button" class="btn btn-primary" id="saveFullscreenSigBtn" style="width: 100%; max-width: 400px; padding: 12px 24px; font-weight: 700; font-size: 0.9rem;">
                    <i class="fas fa-check"></i> Aplicar Firma
                  </button>
                </div>
            `;
            document.body.appendChild(modalDiv);
        }

        this.canvas   = document.getElementById('formSignatureCanvas');
        this.ctx      = this.canvas.getContext('2d');
        this.fsCanvas = document.getElementById('fullscreenSigCanvas');
        this.fsCtx    = this.fsCanvas.getContext('2d');
        this._inlineReady = false;
        
        const self = this;

        // ── Resize helpers ──────────────────────────────────────────────
        function setupCtx(ctx) {
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth   = 2.5;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
        }

        /**
         * Redimensiona el canvas inline según su wrapper visible.
         * Devuelve true si tuvo dimensiones válidas (> 0).
         */
        function resizeInlineCanvas() {
            const wrapper = document.getElementById('signatureCanvasWrapper');
            const rect    = wrapper ? wrapper.getBoundingClientRect() : self.canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;

            self.canvas.width  = Math.round(rect.width  * window.devicePixelRatio);
            self.canvas.height = Math.round(rect.height * window.devicePixelRatio);
            self.ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset
            self.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            setupCtx(self.ctx);
            self._inlineReady = true;
            return true;
        }

        function resizeFsCanvas() {
            const wrapper = document.getElementById('fsCanvasWrapper');
            const rect    = wrapper ? wrapper.getBoundingClientRect() : self.fsCanvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const isPortrait = window.innerHeight > window.innerWidth;
            const w = isPortrait ? rect.height : rect.width;
            const h = isPortrait ? rect.width : rect.height;

            self.fsCanvas.width  = Math.round(w  * window.devicePixelRatio);
            self.fsCanvas.height = Math.round(h * window.devicePixelRatio);
            self.fsCtx.setTransform(1, 0, 0, 1, 0, 0);
            self.fsCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
            self.fsCtx.strokeStyle = '#1e293b';
            self.fsCtx.lineWidth   = 3.2;
            self.fsCtx.lineCap     = 'round';
            self.fsCtx.lineJoin    = 'round';

            // Restaurar los trazos si la pantalla giró o se redimensionó
            if (self._fsStrokes && self._fsStrokes.length > 0) {
                self.fsCtx.beginPath();
                self._fsStrokes.forEach(stroke => {
                    if (stroke.length < 2) return;
                    self.fsCtx.moveTo(stroke[0].x, stroke[0].y);
                    for (let i = 1; i < stroke.length; i++) {
                        self.fsCtx.lineTo(stroke[i].x, stroke[i].y);
                    }
                });
                self.fsCtx.stroke();
            }
        }

        // Intentar resize inmediato; si el wrapper no es visible usar IntersectionObserver
        if (!resizeInlineCanvas()) {
            const observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        resizeInlineCanvas();
                        observer.disconnect();
                    }
                }
            }, { threshold: 0.01 });
            observer.observe(self.canvas);
        }

        window.addEventListener('resize', resizeInlineCanvas);

        // ── Dibujo Inline ───────────────────────────────────────────────
        function getPos(e, canvas) {
            const rect    = canvas.getBoundingClientRect();
            const touch   = e.touches ? e.touches[0] : e;
            const clientX = touch.clientX;
            const clientY = touch.clientY;
            
            const isPortrait = window.innerHeight > window.innerWidth;
            const isFullscreenCanvas = canvas.id === 'fullscreenSigCanvas';
            
            if (isPortrait && isFullscreenCanvas) {
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const canvasX = (clientY - centerY) + (rect.height / 2);
                const canvasY = -(clientX - centerX) + (rect.width / 2);
                return { x: canvasX, y: canvasY };
            }
            
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        function ensureInlineReady() {
            if (!self._inlineReady) resizeInlineCanvas();
        }

        this.canvas.addEventListener('mousedown', (e) => {
            ensureInlineReady();
            self.isDrawing = true;
            const p = getPos(e, self.canvas);
            self.lastX = p.x; self.lastY = p.y;
            self._currentStroke = [p];
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!self.isDrawing) return;
            const p = getPos(e, self.canvas);
            self.ctx.beginPath();
            self.ctx.moveTo(self.lastX, self.lastY);
            self.ctx.lineTo(p.x, p.y);
            self.ctx.stroke();
            self.lastX = p.x; self.lastY = p.y;
            if (self._currentStroke) self._currentStroke.push(p);
        });

        const stopInline = () => {
            if (self.isDrawing && self._currentStroke && self._currentStroke.length > 1) {
                self._strokes.push(self._currentStroke);
            }
            self._currentStroke = null;
            self.isDrawing = false;
        };
        this.canvas.addEventListener('mouseup',    stopInline);
        this.canvas.addEventListener('mouseleave', stopInline);

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            ensureInlineReady();
            self.isDrawing = true;
            const p = getPos(e, self.canvas);
            self.lastX = p.x; self.lastY = p.y;
            self._currentStroke = [p];
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!self.isDrawing) return;
            const p = getPos(e, self.canvas);
            self.ctx.beginPath();
            self.ctx.moveTo(self.lastX, self.lastY);
            self.ctx.lineTo(p.x, p.y);
            self.ctx.stroke();
            self.lastX = p.x; self.lastY = p.y;
            if (self._currentStroke) self._currentStroke.push(p);
        }, { passive: false });

        this.canvas.addEventListener('touchend', stopInline);

        document.getElementById('clearFormSignatureBtn').addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            self.clear();
        });

        // ── Dibujo Pantalla Completa ─────────────────────────────────────
        this.fsCanvas.addEventListener('mousedown', (e) => {
            self.fsIsDrawing = true;
            const p = getPos(e, self.fsCanvas);
            self.fsLastX = p.x; self.fsLastY = p.y;
            self._fsCurrent = [p];
        });

        this.fsCanvas.addEventListener('mousemove', (e) => {
            if (!self.fsIsDrawing) return;
            const p = getPos(e, self.fsCanvas);
            self.fsCtx.beginPath();
            self.fsCtx.moveTo(self.fsLastX, self.fsLastY);
            self.fsCtx.lineTo(p.x, p.y);
            self.fsCtx.stroke();
            self.fsLastX = p.x; self.fsLastY = p.y;
            if (self._fsCurrent) self._fsCurrent.push(p);
        });

        const stopFs = () => {
            if (self.fsIsDrawing && self._fsCurrent && self._fsCurrent.length > 1) {
                self._fsStrokes.push(self._fsCurrent);
            }
            self._fsCurrent = null;
            self.fsIsDrawing = false;
        };
        this.fsCanvas.addEventListener('mouseup',    stopFs);
        this.fsCanvas.addEventListener('mouseleave', stopFs);

        this.fsCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            self.fsIsDrawing = true;
            const p = getPos(e, self.fsCanvas);
            self.fsLastX = p.x; self.fsLastY = p.y;
            self._fsCurrent = [p];
        }, { passive: false });

        this.fsCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!self.fsIsDrawing) return;
            const p = getPos(e, self.fsCanvas);
            self.fsCtx.beginPath();
            self.fsCtx.moveTo(self.fsLastX, self.fsLastY);
            self.fsCtx.lineTo(p.x, p.y);
            self.fsCtx.stroke();
            self.fsLastX = p.x; self.fsLastY = p.y;
            if (self._fsCurrent) self._fsCurrent.push(p);
        }, { passive: false });

        this.fsCanvas.addEventListener('touchend', stopFs);

        // ── Controladores Modal ──────────────────────────────────────────
        const fsModal = document.getElementById('fullscreenSigModal');

        document.getElementById('fullscreenFormSignatureBtn').addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            
            // Intento de Bloqueo Nativo de Orientación (Screen Orientation API)
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock('landscape');
                }
            } catch (err) {
                console.warn("[Firma] Bloqueo nativo de orientación no soportado por este navegador.");
            }

            fsModal.style.display = 'flex';
            // Esperar a que el modal sea visible para medir dimensiones reales
            requestAnimationFrame(() => {
                setTimeout(() => {
                    resizeFsCanvas();
                }, 80);
            });
        });

        document.getElementById('closeFullscreenSigBtn').addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            fsModal.style.display = 'none';
            try {
                if (document.exitFullscreen) document.exitFullscreen();
                if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            } catch (err) {}
        });

        document.getElementById('clearFullscreenSigBtn').addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            self.fsCtx.clearRect(0, 0, self.fsCanvas.width, self.fsCanvas.height);
            self._fsStrokes = [];
            resizeFsCanvas();
        });

        // ── Aplicar Firma al Canvas Inline ───────────────────────────────
        document.getElementById('saveFullscreenSigBtn').addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();

            // Copiar trazos del fullscreen al inline
            self._strokes = [...self._fsStrokes];

            // Asegurar que el canvas inline está correctamente dimensionado
            resizeInlineCanvas();

            // Dimensiones lógicas (CSS) del inline canvas
            const inlineRect = self.canvas.getBoundingClientRect();

            // Limpiar el inline canvas y copiar la firma del fullscreen
            self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);

            // Dibujar el fullscreen canvas escalado al tamaño del inline canvas
            self.ctx.drawImage(
                self.fsCanvas,
                0, 0,
                self.fsCanvas.width, self.fsCanvas.height,
                0, 0,
                inlineRect.width, inlineRect.height
            );

            fsModal.style.display = 'none';
            try {
                if (document.exitFullscreen) document.exitFullscreen();
                if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            } catch (err) {}

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Firma aplicada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1800
                });
            }
        });

        window.addEventListener('resize', () => {
            if (fsModal.style.display === 'flex') resizeFsCanvas();
        });
    },

    clear() {
        if (this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this._strokes  = [];
        this._fsStrokes = [];
    },

    isEmpty() {
        return this._strokes.length === 0;
    },

    /**
     * Exporta la firma como SVG texto (muy liviano, ~1-8KB).
     * No requiere upload a Storage — se guarda directo en la columna firma_svg de la BD.
     * Dimensiones: 600×180 (proporción del canvas inline a 130px de alto en pantalla típica)
     */
    getSVG() {
        if (this.isEmpty()) return null;

        const W = 600;
        const H = 150;

        // 1. Encontrar bounding box de los trazos actuales
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        this._strokes.forEach(stroke => {
            stroke.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
        });

        // Si no hay puntos válidos
        if (minX === Infinity || minY === Infinity) {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"></svg>`;
        }

        const sigW = maxX - minX;
        const sigH = maxY - minY;

        // Determinar escala para ajustar a un área útil de (W-40) x (H-30)
        const maxUsefulW = W - 40;
        const maxUsefulH = H - 30;

        let scale = 1;
        if (sigW > 0 || sigH > 0) {
            const scaleX = maxUsefulW / (sigW || 1);
            const scaleY = maxUsefulH / (sigH || 1);
            // Cap scale at 1.5x so it doesn't get pixelated/gigantic if they drew a tiny dot
            scale = Math.min(scaleX, scaleY, 1.5);
        }

        // Centrar la firma ajustada en el viewBox
        const finalSigW = sigW * scale;
        const finalSigH = sigH * scale;
        const offsetX = (W - finalSigW) / 2;
        const offsetY = (H - finalSigH) / 2;

        const paths = this._strokes.map(stroke => {
            if (stroke.length < 2) return '';
            const d = stroke.map((p, i) => {
                // Normalizar punto rel al minX/minY, aplicar escala y desplazar al centro
                const x = ((p.x - minX) * scale + offsetX).toFixed(1);
                const y = ((p.y - minY) * scale + offsetY).toFixed(1);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
            return `<path d="${d}" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
        }).join('');

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${paths}</svg>`;
    },

    getDataURL() {
        if (this.isEmpty()) return null;
        return this.canvas ? this.canvas.toDataURL('image/png') : null;
    }
};

window.FirmaTaller = FirmaTaller;
