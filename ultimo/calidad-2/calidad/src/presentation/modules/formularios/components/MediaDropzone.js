/**
 * Componente Reutilizable: MediaDropzone
 * Subida, compresión en el cliente y previsualización de imágenes y videos.
 */
export class MediaDropzone {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {number} options.maxFiles
     * @param {Function} options.onChange
     */
    constructor({ container, maxFiles = 6, onChange = null }) {
        this.container = container;
        this.maxFiles = maxFiles;
        this.onChange = onChange;
        this.files = []; // [{ file, base64, mimeType, fileName, previewUrl }]
        this._init();
    }

    _init() {
        this.container.innerHTML = `
            <div class="f-dropzone-box" id="dropzone-area">
                <input type="file" id="f-file-input" accept="image/*,video/*" multiple style="display:none;" />
                <div class="f-dropzone-content">
                    <div class="f-dropzone-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8">
                            <rect x="3" y="3" width="18" height="18" rx="4" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                    </div>
                    <p class="f-dropzone-title">Toca o arrastra fotos y evidencias aquí</p>
                    <span class="f-dropzone-sub">Imágenes JPG, PNG o videos cortos (hasta ${this.maxFiles} archivos)</span>
                </div>
            </div>
            <div class="f-previews-grid" id="f-previews-grid"></div>
        `;

        this.dropArea = this.container.querySelector('#dropzone-area');
        this.fileInput = this.container.querySelector('#f-file-input');
        this.grid = this.container.querySelector('#f-previews-grid');

        this._bindEvents();
    }

    _bindEvents() {
        this.dropArea.addEventListener('click', () => this.fileInput.click());

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length) {
                this.handleFiles(Array.from(e.target.files));
            }
        });

        this.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropArea.classList.add('drag-over');
        });

        this.dropArea.addEventListener('dragleave', () => {
            this.dropArea.classList.remove('drag-over');
        });

        this.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropArea.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                this.handleFiles(Array.from(e.dataTransfer.files));
            }
        });
    }

    async handleFiles(fileList) {
        const remaining = this.maxFiles - this.files.length;
        if (remaining <= 0) return;

        const toProcess = fileList.slice(0, remaining);

        for (const file of toProcess) {
            try {
                const processed = await this._compressAndEncode(file);
                this.files.push(processed);
            } catch (err) {
                console.error('[MediaDropzone] Error procesando archivo:', err);
            }
        }

        this._renderPreviews();
        if (typeof this.onChange === 'function') {
            this.onChange(this.getFiles());
        }
    }

    _compressAndEncode(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = (reader.result || '').split(',')[1] || '';
                    resolve({
                        file,
                        base64,
                        mimeType: file.type,
                        fileName: file.name,
                        previewUrl: URL.createObjectURL(file),
                        isVideo: true
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
                return;
            }

            const img = new Image();
            const previewUrl = URL.createObjectURL(file);
            img.onload = () => {
                try {
                    const MAX_W = 1200;
                    let w = img.width;
                    let h = img.height;
                    if (w > MAX_W) {
                        h = Math.round((h * MAX_W) / w);
                        w = MAX_W;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const base64 = dataUrl.split(',')[1] || '';

                    resolve({
                        file,
                        base64,
                        mimeType: 'image/jpeg',
                        fileName: file.name.replace(/\.[^.]+$/, '.jpg'),
                        previewUrl: dataUrl,
                        isVideo: false
                    });
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = reject;
            img.src = previewUrl;
        });
    }

    _renderPreviews() {
        this.grid.innerHTML = this.files.map((item, index) => `
            <div class="f-preview-item" data-index="${index}">
                ${item.isVideo 
                    ? `<video src="${item.previewUrl}" muted playsinline></video>` 
                    : `<img src="${item.previewUrl}" alt="preview" />`
                }
                <button type="button" class="f-remove-file-btn" data-index="${index}" aria-label="Eliminar imagen">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `).join('');

        this.grid.querySelectorAll('.f-remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                this.removeFile(idx);
            });
        });
    }

    removeFile(index) {
        if (index >= 0 && index < this.files.length) {
            this.files.splice(index, 1);
            this._renderPreviews();
            if (typeof this.onChange === 'function') {
                this.onChange(this.getFiles());
            }
        }
    }

    getFiles() {
        return this.files.map(f => ({
            base64: f.base64,
            mimeType: f.mimeType,
            fileName: f.fileName
        }));
    }

    clear() {
        this.files = [];
        this._renderPreviews();
        if (this.fileInput) this.fileInput.value = '';
    }
}
