/**
 * upload.js — Sincronización masiva de Lotes (master) y Plantas
 * El tipo se detecta automáticamente por los headers pegados.
 */

/* ── Modo activo — se detecta automáticamente ── */
let _uploadMode = 'master';
let _syncing    = false;   // evita ejecuciones simultáneas
let _debounceTimer = null; // debounce para onchange

/* ── Headers de referencia ── */
const HEADER_SETS = {
    CONFECCION: [
        'Ubicacion', 'Nombre', 'Numlote', 'Marca', 'Ref', 'desclarga', 'Col', 'RefExt', 'Total',
        'FechaSalda', 'FechaEntrada', 'Nombre2', 'Telefono', 'Celular', 'Direccion', 'Ciudad',
        'Encargado', 'NumPed', 'FechaDespacho', 'Cuento', 'Obs Salida', 'Costo Conf+Term',
        'Valor a Pagar', 'Inv Muestras', 'Linea', 'Categoria de Producto'
    ],
    PROCESOS: [
        'Coleccion', 'Ref', 'RefExt', 'NumLote', 'emp', 'Total', 'Vt', 'Planta', 'Proceso',
        'doc', 'Obs', 'FechaSal', 'FechaEntrega', 'Cuento', 'Categoria', 'Linea', 'Cant Minutos'
    ],
    GENERAL_TDM: [
        'OP', 'InvPlanta', 'NombrePlanta', 'FSalidaConf', 'FEntregaConf', 'Proceso', 'Descripcion',
        'Cuento', 'Genero', 'OS', 'TS', 'Costo', 'Ref', 'Tipo Tejido', 'pvp'
    ]
};

/* ── DataParser ── */
class DataParser {
    parse(rawText) {
        if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
        const lines = rawText.split(/\r?\n/);
        const matrix = lines.map(line => line.split('\t').map(cell => cell.trim()));
        const nonEmpty = matrix.filter(row => row.some(cell => cell && cell.length > 0));
        if (nonEmpty.length === 0) return { headers: [], rows: [] };
        const headers = nonEmpty[0].map(h => String(h || '').trim());
        const rows = nonEmpty.slice(1).map(row => {
            if (row.length < headers.length) return [...row, ...Array(headers.length - row.length).fill('')];
            if (row.length > headers.length) return row.slice(0, headers.length);
            return row;
        });
        return { headers, rows };
    }
}

/* ── HeaderDetector ── */
class HeaderDetector {
    detect(headers) {
        const h = headers.map(x => x.toLowerCase());
        // Detectar columna NIT — puede ser Nitocc, NitoCCProc, NitoCC, etc.
        const hasNit = h.some(x => x.startsWith('nitocc'));
        // Detectar columna nombre — Tercero, Nombre, Nombre2
        const hasNombre = h.includes('tercero') || h.includes('nombre') || h.includes('nombre2');
        if (hasNit && hasNombre) return 'PLANTAS';
        if (this._hasAll(headers, HEADER_SETS.CONFECCION)) return 'CONFECCION';
        if (this._hasAll(headers, HEADER_SETS.PROCESOS, ['Cant Minutos'])) return 'PROCESOS';
        if (this._hasAll(headers, HEADER_SETS.GENERAL_TDM)) return 'GENERAL_TDM';
        return 'UNKNOWN';
    }
    _hasAll(headers, required, optional = []) {
        return required.every(r => optional.includes(r) || headers.includes(r));
    }
}

/* ── DataMapper ── */
class DataMapper {
    map(headers, rows, type) {
        if (type === 'PLANTAS') {
            const idxMap = {};
            headers.forEach((h, i) => { idxMap[h.toLowerCase()] = i; });
            return rows.map(row => this._mapPlanta(row, idxMap)).filter(r => this._validPlanta(r));
        }
        const idxMap = {};
        headers.forEach((h, i) => { idxMap[h] = i; });
        
        let fn;
        if (type === 'CONFECCION') fn = this._mapConfeccion.bind(this);
        else if (type === 'PROCESOS') fn = this._mapProcesos.bind(this);
        else if (type === 'GENERAL_TDM') fn = this._mapGeneralTDM.bind(this);
        else return [];

        return rows.map(row => fn(row, idxMap)).filter(r => this._validMaster(r));
    }

    _get(row, idxMap, key) {
        const idx = idxMap[key];
        if (idx === undefined || idx >= row.length) return '';
        const s = String(row[idx] ?? '').trim();
        return (s === '' || s.toLowerCase() === 'null' || s === 'n/a' || s === '-') ? '' : s;
    }

    _validMaster(r) { const id = parseInt(r.id_master); return !isNaN(id) && id > 0; }
    _validPlanta(r) { const id = parseInt(r.id_planta); return !isNaN(id) && id > 0; }

    _normProceso(v) {
        if (!v) return '';
        const u = v.toUpperCase().trim();
        if (u.startsWith('SERVICIODE')) return v.substring(10).trim();
        if (u.startsWith('SERVICIO '))  return v.substring(9).trim();
        return u === 'SERVICIO' ? '' : v.trim();
    }
    _normCuento(v) {
        if (!v) return '';
        return v.toUpperCase().trim().replace(/\s*S2\s*$/i, '').replace(/\s+/g, ' ').trim();
    }
    _normGenero(v) {
        if (!v) return '';
        const u = v.toUpperCase().trim();
        if (u.includes('FEMENINA') || u.includes('MUJER') || u.includes('DAMA')) return 'DAMA';
        if (u.includes('MASCULINA') || u.includes('HOMBRE') || u.includes('CABALLERO')) return 'CABALLERO';
        if (u.includes('NIÑA') || u.includes('NINA')) return 'NIÑA';
        if (u.includes('NIÑO') || u.includes('NINO')) return 'NIÑO';
        return (u.includes('UNISEX') || u.includes('MIXTO')) ? 'UNISEX' : v.trim();
    }
    _normFecha(v) {
        if (!v) return null;
        const m = { ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12' };
        const match = v.trim().match(/^(\d{1,2})-([a-zA-Z]+)-(\d{2})$/);
        if (match) {
            const mes = m[match[2].toLowerCase().substring(0, 3)];
            if (mes) return `20${match[3]}-${mes}-${match[1].padStart(2, '0')}`;
        }
        return v.trim() || null;
    }

    _mapConfeccion(row, idx) {
        const g = (h) => this._get(row, idx, h);
        const prod = parseInt(window.currentUser?.ID_PRODUCTORA) || null;
        return {
            id_master:    parseInt(g('Numlote')) || null,
            referencia:   g('Ref'),
            cantidad:     parseInt(g('Total')) || 0,
            nombre_planta:g('Nombre'),
            fecha_salida: this._normFecha(g('FechaSalda')),
            fecha_entrega:this._normFecha(g('FechaEntrada')),
            proceso:      g('Proceso') || 'CONFECCION',
            descripcion:  g('Categoria de Producto'),
            cuento:       this._normCuento(g('Cuento')),
            genero:       this._normGenero(g('Linea')),
            observaciones:g('Obs Salida'),
            costo:        g('Costo Conf+Term'),
            productora:   prod
        };
    }

    _mapProcesos(row, idx) {
        const g = (h) => this._get(row, idx, h);
        const prod = parseInt(window.currentUser?.ID_PRODUCTORA) || null;
        return {
            id_master:    parseInt(g('NumLote')) || null,
            referencia:   g('Ref'),
            cantidad:     parseInt(g('Total')) || 0,
            nombre_planta:g('Planta'),
            fecha_salida: this._normFecha(g('FechaSal')),
            fecha_entrega:this._normFecha(g('FechaEntrega')),
            proceso:      this._normProceso(g('Proceso')),
            descripcion:  g('Categoria'),
            cuento:       this._normCuento(g('Cuento')),
            genero:       this._normGenero(g('Linea')),
            observaciones:g('Obs'),
            costo:        g('Cant Minutos'),
            productora:   prod
        };
    }

    _mapGeneralTDM(row, idx) {
        const g = (h) => this._get(row, idx, h);
        const prod = parseInt(window.currentUser?.ID_PRODUCTORA) || null;
        return {
            id_master:    parseInt(g('OP')) || null,
            referencia:   g('Ref'),
            cantidad:     parseInt(g('InvPlanta')) || 0,
            nombre_planta:g('NombrePlanta'),
            fecha_salida: this._normFecha(g('FSalidaConf')),
            fecha_entrega:this._normFecha(g('FEntregaConf')),
            proceso:      g('Proceso') || 'CONFECCION',
            descripcion:  g('Descripcion'),
            cuento:       this._normCuento(g('Cuento')),
            genero:       this._normGenero(g('Genero')),
            observaciones:g('OS') ? `OS: ${g('OS')}` : '',
            costo:        g('Costo'),
            productora:   prod
        };
    }

    _mapPlanta(row, idx) {
        const g = (h) => this._get(row, idx, h);
        const prod = parseInt(window.currentUser?.ID_PRODUCTORA) || null;
        const nitRaw = g('nitocc') || g('nitoccproc');
        const idPlanta = parseInt(nitRaw);
        return {
            id_planta:  isNaN(idPlanta) ? null : idPlanta,
            planta:     g('tercero') || g('nombre') || g('nombre2'),
            correo:     g('email'),
            rol:        'GUEST',
            telefono:   parseInt(g('celular')) || null,
            productora: prod
        };
    }
}

/* ── Application Controller ── */
class Application {
    constructor() {
        this.parser   = new DataParser();
        this.detector = new HeaderDetector();
        this.mapper   = new DataMapper();
        this.spreadsheet = null;
        this.jsonData    = [];
        this.detectedType = '';
    }

    init() {
        this.initSpreadsheet();
        this.updateStats();
        const last = localStorage.getItem('busint_last_sync');
        if (last) document.getElementById('stat-last-sync').textContent = last;
    }

    initSpreadsheet() {
        if (typeof jspreadsheet === 'undefined') {
            setTimeout(() => this.initSpreadsheet(), 500);
            return;
        }
        try {
            this.spreadsheet = jspreadsheet(document.getElementById('spreadsheet'), {
                minDimensions: [26, 15],
                columnSorting: false,
                onpaste: () => {
                    // Debounce largo: jspreadsheet dispara onpaste + múltiples onchange
                    clearTimeout(_debounceTimer);
                    _debounceTimer = setTimeout(() => this.processData(), 800);
                },
                onchange: () => {
                    // Solo procesar si no hay un sync en curso
                    if (_syncing) return;
                    clearTimeout(_debounceTimer);
                    _debounceTimer = setTimeout(() => this.processData(), 800);
                }
            });
        } catch (err) {
            console.error('Error al inicializar jspreadsheet:', err);
        }
    }

    processData() {
        const rawData  = this.spreadsheet.getData();
        const textData = rawData.map(row => row.join('\t')).join('\n');

        const { headers, rows } = this.parser.parse(textData);
        if (headers.length === 0) return this.resetState();

        this.detectedType = this.detector.detect(headers);
        if (this.detectedType === 'UNKNOWN') {
            this.setStatus('Formato de cabeceras no reconocido', 'error');
            this.toggleActionTools(false);
            return;
        }

        _uploadMode = this.detectedType === 'PLANTAS' ? 'plantas' : 'master';

        this.jsonData = this.mapper.map(headers, rows, this.detectedType);
        this.updateStats(this.jsonData.length, this.detectedType);
        this.updateJSONPreview(this.jsonData);
        this.setStatus(`${this.jsonData.length} registros detectados (${this.detectedType})`, 'ready');
        this.toggleActionTools(true);

        setTimeout(() => this.syncWithSupabase(), 300);
    }

    updateJSONPreview(data) {
        const el    = document.getElementById('jsonContent');
        const count = document.getElementById('jsonCount');
        if (el)    el.textContent    = JSON.stringify(data, null, 2);
        if (count) count.textContent = `${data.length} registros`;
    }

    toggleActionTools(show) {
        const tools = document.getElementById('action-tools');
        if (tools) {
            tools.style.opacity      = show ? '1' : '0';
            tools.style.pointerEvents = show ? 'auto' : 'none';
        }
    }

    handleToggleJSONView() {
        const preview = document.getElementById('jsonPreview');
        const btn     = document.getElementById('viewJsonBtn');
        const visible = preview.style.display === 'block';
        preview.style.display = visible ? 'none' : 'block';
        if (btn) btn.innerHTML = visible
            ? '<i class="fas fa-eye"></i> Ver JSON'
            : '<i class="fas fa-eye-slash"></i> Ocultar JSON';
        if (!visible) preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    handleDownloadJSON() {
        if (!this.jsonData.length) return;
        const blob = new Blob([JSON.stringify(this.jsonData, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `datos_${new Date().toISOString().slice(0,19)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    handleCopyJSON() {
        if (!this.jsonData.length) return;
        navigator.clipboard.writeText(JSON.stringify(this.jsonData, null, 2)).then(() => {
            const btn = document.getElementById('copyJsonBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
        });
    }

    async handleDownloadFullTable() {
        const btn  = document.getElementById('downloadFullCsvBtn');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>...';
        btn.disabled  = true;
        try {
            const result = await fetchSupabaseData('master');
            if (!result || result.length === 0) { Swal.fire('Info', 'La tabla master está vacía.', 'info'); return; }
            const headers = Object.keys(result[0]);
            let csv = headers.join(';') + '\n';
            result.forEach(row => {
                csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\n';
            });
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `master_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            btn.innerHTML = orig;
            btn.disabled  = false;
        }
    }

    setStatus(msg, type) {
        const el   = document.getElementById('upload-status');
        const icon = el.querySelector('i');
        const span = el.querySelector('span');
        el.className = `status-indicator ${type || ''}`;
        if (span) span.textContent = msg;
        if (icon) {
            if (type === 'ready')      icon.className = 'fas fa-check-circle';
            else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
            else if (type === 'processing') icon.className = 'fas fa-spinner fa-spin';
            else                       icon.className = 'fas fa-info-circle';
        }
    }

    updateStats(total = 0, type = '-') {
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-type').textContent  = type;
    }

    resetState() {
        this.jsonData     = [];
        this.detectedType = '';
        _syncing = false;
        clearTimeout(_debounceTimer);
        this.updateStats();
        this.setStatus('Esperando datos de Excel...', '');
        this.toggleActionTools(false);
        document.getElementById('jsonPreview').style.display      = 'none';
        document.getElementById('results-view').style.display     = 'none';
        document.getElementById('duplicates-section').style.display = 'none';
        document.getElementById('duplicates-list').innerHTML    = '';
        document.getElementById('spreadsheet-wrapper').style.display = 'block';
    }

    async syncWithSupabase() {
        if (this.jsonData.length === 0) return;
        if (_syncing) return; // ya hay un sync en curso
        _syncing = true;

        // Limpiar duplicados de sincronizaciones anteriores
        const dupSection = document.getElementById('duplicates-section');
        const dupList = document.getElementById('duplicates-list');
        if (dupSection) dupSection.style.display = 'none';
        if (dupList) dupList.innerHTML = '';

        // Resolver productora
        let idProductora = parseInt(window.currentUser?.ID_PRODUCTORA);
        if (!idProductora) {
            try {
                const saved = JSON.parse(localStorage.getItem('busint_productora') || 'null');
                if (saved?.ID_PRODUCTORA) {
                    idProductora = parseInt(saved.ID_PRODUCTORA);
                    if (window.currentUser) {
                        window.currentUser.ID_PRODUCTORA = idProductora;
                        window.currentUser.PRODUCTORA    = saved.PRODUCTORA;
                    }
                }
            } catch(e) {}
        }

        if (!idProductora) {
            const prods = await _fetchProductorasForSelector();
            if (!prods.length) {
                Swal.fire('Sin productora', 'No hay productoras disponibles.', 'error');
                return;
            }
            const options = prods.reduce((acc, p) => { acc[p.id_productora] = p.productora; return acc; }, {});
            const { value: selected } = await Swal.fire({
                title: 'Seleccione su productora',
                input: 'select', inputOptions: options, inputPlaceholder: 'Seleccione...',
                showCancelButton: false, confirmButtonText: 'Continuar',
                confirmButtonColor: '#3f51b5', allowOutsideClick: false
            });
            if (!selected) return;
            const prodData = prods.find(p => String(p.id_productora) === String(selected));
            idProductora = parseInt(selected);
            if (window.currentUser) {
                window.currentUser.ID_PRODUCTORA = idProductora;
                window.currentUser.PRODUCTORA    = prodData?.productora || selected;
            }
            try {
                localStorage.setItem('busint_productora', JSON.stringify({
                    ID_PRODUCTORA: idProductora, PRODUCTORA: prodData?.productora || selected
                }));
            } catch(e) {}
        }

        this.setStatus(_uploadMode === 'plantas' ? 'Sincronizando plantas...' : 'Sincronizando lotes...', 'processing');
        this.toggleActionTools(false);

        try {
            const sb = getSupabaseClient();
            let token = SUPABASE_KEY;
            if (sb) {
                const { data: { session } } = await sb.auth.getSession();
                if (session) token = session.access_token;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_KEY
            };

            const accion  = _uploadMode === 'plantas' ? 'SYNC_PLANTAS' : 'SYNC_BUSINT';
            const bodyKey = _uploadMode === 'plantas' ? 'plantas'      : 'records';

            // Limpiar campos vacíos
            const cleanData = this.jsonData.map(row => {
                const clean = {};
                for (const [k, v] of Object.entries(row)) {
                    if (v !== null && v !== undefined && v !== '') clean[k] = v;
                }
                return clean;
            });

            // PASO 1: Enviar primer chunk con accion=SYNC (hace el DELETE + inserta el primer lote)
            const CHUNK = 150;
            const firstChunk = cleanData.slice(0, CHUNK);
            const rest       = cleanData.slice(CHUNK);

            this.setStatus(`Enviando lote 1 de ${Math.ceil(cleanData.length / CHUNK)}...`, 'processing');

            const r1 = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
                method: 'POST', headers,
                body: JSON.stringify({ accion, tipo: this.detectedType, [bodyKey]: firstChunk })
            });
            const res1 = await r1.json();
            if (!r1.ok) throw new Error(res1.message || res1.error || 'Error en lote 1');

            let totalInserted = res1.inserted || 0;
            let allDuplicates = res1.duplicates || [];
            let allErrors = res1.errors?.filter(e => !e.includes('Registros duplicados omitidos')) || [];

            // PASO 2: Chunks adicionales con accion=APPEND (solo inserta, sin borrar)
            const appendAccion = _uploadMode === 'plantas' ? 'APPEND_PLANTAS' : 'APPEND_MASTER';
            for (let i = 0; i < rest.length; i += CHUNK) {
                const chunk = rest.slice(i, i + CHUNK);
                const lote  = Math.floor(i / CHUNK) + 2;
                this.setStatus(`Enviando lote ${lote} de ${Math.ceil(cleanData.length / CHUNK)}...`, 'processing');

                const rN = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ accion: appendAccion, [bodyKey]: chunk })
                });
                const resN = await rN.json();
                if (!rN.ok) throw new Error(resN.message || resN.error || `Error en lote ${lote}`);

                totalInserted += resN.inserted || 0;
                if (resN.duplicates) allDuplicates = allDuplicates.concat(resN.duplicates);
                if (resN.errors) {
                    const chunkErrors = resN.errors.filter(e => !e.includes('Registros duplicados omitidos'));
                    allErrors = allErrors.concat(chunkErrors);
                }
            }

            const result = { inserted: totalInserted, errors: allErrors, duplicates: allDuplicates };

            const now = new Date().toLocaleString();
            localStorage.setItem(_uploadMode === 'plantas' ? 'plantas_last_sync' : 'busint_last_sync', now);
            document.getElementById('stat-last-sync').textContent = now;

            document.getElementById('spreadsheet-wrapper').style.display = 'none';
            document.getElementById('jsonPreview').style.display          = 'none';
            document.getElementById('results-view').style.display         = 'block';
            document.getElementById('res-updated').textContent  = 0;
            document.getElementById('res-inserted').textContent = result.inserted || 0;
            document.getElementById('res-duplicates').textContent = result.duplicates?.length || 0;
            document.getElementById('res-errors').textContent   = result.errors?.length || 0;

            this.setStatus('Sincronización completada', 'ready');

            // Mostrar duplicados detallados en la sección de resultados
            if (result.duplicates && result.duplicates.length > 0) {
                const dupSection = document.getElementById('duplicates-section');
                const dupList = document.getElementById('duplicates-list');
                dupSection.style.display = 'block';

                let html = '';
                result.duplicates.forEach((dup, idx) => {
                    const existing = dup.existing;
                    const duplicate = dup.duplicate;

                    html += `
                        <div style="background: white; border-radius: 10px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid #fcd34d; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-weight: 700; color: #92400e; margin-bottom: 0.75rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.3px;">
                                <i class="fas fa-copy"></i> Duplicado #${idx + 1}: id_master: ${dup.key.split('_')[0]} | proceso: ${dup.key.split('_')[1]} | productora: ${dup.key.split('_')[2]}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <div style="font-weight: 700; color: #16a34a; margin-bottom: 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px;">
                                        <i class="fas fa-check-circle"></i> Registro Mantenido
                                    </div>
                                    <div style="background: #f0fdf4; padding: 0.75rem; border-radius: 8px; border: 1px solid #bbf7d0;">
                                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-size: 0.75rem; color: #374151;">
                                            <span style="font-weight: 600; color: #64748b;">Planta:</span>
                                            <span>${existing.nombre_planta || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Cantidad:</span>
                                            <span>${existing.cantidad || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Referencia:</span>
                                            <span>${existing.referencia || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Fecha Salida:</span>
                                            <span>${existing.fecha_salida || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Fecha Entrega:</span>
                                            <span>${existing.fecha_entrega || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div style="font-weight: 700; color: #ef4444; margin-bottom: 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px;">
                                        <i class="fas fa-times-circle"></i> Registro Omitido
                                    </div>
                                    <div style="background: #fef2f2; padding: 0.75rem; border-radius: 8px; border: 1px solid #fecaca;">
                                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-size: 0.75rem; color: #374151;">
                                            <span style="font-weight: 600; color: #64748b;">Planta:</span>
                                            <span>${duplicate.nombre_planta || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Cantidad:</span>
                                            <span>${duplicate.cantidad || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Referencia:</span>
                                            <span>${duplicate.referencia || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Fecha Salida:</span>
                                            <span>${duplicate.fecha_salida || '-'}</span>
                                            <span style="font-weight: 600; color: #64748b;">Fecha Entrega:</span>
                                            <span>${duplicate.fecha_entrega || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });

                dupList.innerHTML = html;
            }

        } catch (error) {
            Swal.fire('Error', error.message, 'error');
            this.setStatus('Error en la sincronización', 'error');
            this.toggleActionTools(true);
        } finally {
            _syncing = false;
        }
    }
}

/* ── Helper: productoras para selector inline ── */
async function _fetchProductorasForSelector() {
    try {
        const res = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: JSON.stringify({ accion: 'LISTAR_PRODUCTORAS' })
        });
        if (!res.ok) return [];
        const r = await res.json();
        return r.productoras || [];
    } catch(e) { return []; }
}

/* ── Init ── */
const app = new Application();

window.resetUpload          = () => { if (app.spreadsheet) app.spreadsheet.setData([[]]); app.resetState(); };
window.handleToggleJSONView = () => app.handleToggleJSONView();
window.handleDownloadJSON   = () => app.handleDownloadJSON();
window.handleCopyJSON       = () => app.handleCopyJSON();
window.handleDownloadFullTable = () => app.handleDownloadFullTable();

window.triggerCSVImport = () => {
    const el = document.getElementById('csvImportFileInput');
    if (el) {
        el.value = '';
        el.click();
    }
};

window.handleCSVImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) {
            Swal.fire('Archivo vacío', 'El archivo CSV seleccionado está vacío.', 'warning');
            return;
        }
        
        // Detectar delimitador (punto y coma, coma o tabulación)
        const firstLine = lines[0];
        let sep = ';';
        if (firstLine.includes('\t')) sep = '\t';
        else if (firstLine.includes(';')) sep = ';';
        else if (firstLine.includes(',')) sep = ',';
        
        // Convertir en matriz
        const matrix = lines.map(line => {
            return line.split(sep).map(cell => {
                let clean = cell.trim();
                if (clean.startsWith('"') && clean.endsWith('"')) {
                    clean = clean.substring(1, clean.length - 1).replace(/""/g, '"').trim();
                }
                return clean;
            });
        });
        
        if (app.spreadsheet) {
            // Cargar datos en la hoja
            app.spreadsheet.setData(matrix);
            // Procesar automáticamente para disparar detección, mapeo y confirmación
            app.processData();
        } else {
            Swal.fire('Error', 'La hoja de cálculo no está inicializada.', 'error');
        }
    };
    reader.readAsText(file);
};

window.addEventListener('DOMContentLoaded', () => { app.init(); });
