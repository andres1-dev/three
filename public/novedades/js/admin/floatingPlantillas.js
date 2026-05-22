/**
 * floatingPlantillas.js — Control de Botón Flotante y Modal Premium de Plantillas de Calidad
 * 
 * CONTROL OPTIMIZADO DE ALTO RENDIMIENTO (0ms Lag / GPU Accelerated):
 * - Carga no bloqueante: la interfaz se inicializa instantáneamente con las 18 plantillas locales de fallback.
 * - Sincronización en segundo plano: Supabase se consulta asíncronamente en background para actualizar si es necesario.
 * - Renderizado en un solo paso (DOM Recycling): las tarjetas se generan una sola vez al cargar la página; 
 *   la búsqueda y el filtrado por pestañas se realizan ocultando/mostrando elementos existentes.
 * - Aceleración por hardware: el backdrop de Glassmorphism se desconecta del árbol de renderizado del navegador
 *   cuando está cerrado (`visibility: hidden`), liberando memoria y CPU del móvil.
 */

// 18 Plantillas predeterminadas de calidad listas para renderizado inmediato
const LOCAL_TEMPLATES = [
    // UBICACION
    { tipo: 'UBICACION', contenido: 'Manga izquierda de la prenda puesta, ubicada entre costuras.' },
    { tipo: 'UBICACION', contenido: 'Pasador delantero izquierdo de la prenda puesta.' },
    { tipo: 'UBICACION', contenido: 'Marquilla de talla.' },
    { tipo: 'UBICACION', contenido: 'Delantero izquierdo de la prenda puesta, ubicada entre costuras a 5 cm del costado.' },
    { tipo: 'UBICACION', contenido: 'Sisa izquierda de la prenda puesta, ubicada entre costuras.' },
    { tipo: 'UBICACION', contenido: 'En la unión de los sesgos de la tira izquierda de la prenda puesta.' },
    
    // PAQUETEO
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 10 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.' },
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 20 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.' },
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 10 unidades, ensambladas espalda con espalda, dobladas individualmente y con las etiquetas aseguradas y amarradas.' },
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 12 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.' },
    
    // OPERACION
    { tipo: 'OPERACION', contenido: 'Costura con puntada floja.' },
    { tipo: 'OPERACION', contenido: 'Piezas con hilos sueltos.' },
    { tipo: 'OPERACION', contenido: 'Costuras torcidas o arrugadas.' },
    { tipo: 'OPERACION', contenido: 'Piezas con orificios o rotas.' },
    { tipo: 'OPERACION', contenido: 'Medidas fuera de tolerancia (muy grandes o pequeñas).' },
    { tipo: 'OPERACION', contenido: 'Costuras reventadas o abiertas.' },
    { tipo: 'OPERACION', contenido: 'Piezas con saltos de puntada o puntadas sueltas.' },
    { tipo: 'OPERACION', contenido: 'Piezas con manchas, suciedad u otras imperfecciones.' }
];

let plantillasData = [];
let currentTab = 'UBICACION';
let searchQuery = '';

/**
 * Consulta asíncrona no bloqueante a Supabase.
 * Actualiza los datos y re-renderiza cuando la red responde.
 */
async function loadTemplates() {
    try {
        if (typeof fetchSupabaseData === 'function') {
            console.log('[Plantillas] Consultando base de datos Supabase en segundo plano...');
            const data = await fetchSupabaseData('plantillas');
            if (data && data.length > 0) {
                // Normalizar estructura
                const loaded = data.map(item => ({
                    tipo: (item.tipo || item.TIPO || '').toUpperCase(),
                    contenido: item.contenido || item.CONTENIDO || ''
                })).filter(item => item.tipo && item.contenido);
                
                if (loaded.length > 0) {
                    plantillasData = loaded;
                    console.log(`[Plantillas] Base de datos Supabase sincronizada con ${plantillasData.length} registros.`);
                    return;
                }
            }
        }
    } catch (error) {
        console.warn('[Plantillas] Sincronización en background omitida. Usando caché local segura.', error);
    }
    // Mantener la carga inicial en caso de error
    if (plantillasData.length === 0) {
        plantillasData = [...LOCAL_TEMPLATES];
    }
}

/**
 * Inyecta dinámicamente el botón flotante y el modal interactivo
 */
function injectTemplatesUI() {
    if (document.getElementById('fabTemplatesTrigger')) return;

    // 1. Botón Flotante (FAB)
    const fab = document.createElement('button');
    fab.id = 'fabTemplatesTrigger';
    fab.className = 'fab-templates-trigger';
    fab.setAttribute('title', 'Ver Plantillas');
    fab.innerHTML = '<i class="fas fa-clipboard-list"></i>';
    document.body.appendChild(fab);

    // 2. Backdrop con visibilidad desconectada por defecto para alto rendimiento
    const backdrop = document.createElement('div');
    backdrop.id = 'templatesModalBackdrop';
    backdrop.className = 'templates-modal-backdrop';
    backdrop.style.visibility = 'hidden'; // Evita el repintado inútil y optimiza la GPU
    backdrop.style.display = 'flex';
    
    backdrop.innerHTML = `
        <div class="templates-modal-box" style="will-change: transform, opacity;">
            <div class="templates-modal-header">
                <h3 class="templates-modal-title">
                    <i class="fas fa-clipboard-list"></i> Plantillas de Calidad
                </h3>
                <button type="button" class="templates-modal-close" id="templatesModalCloseBtn" aria-label="Cerrar modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="templates-search-wrapper" style="position: relative;">
                <i class="fas fa-search templates-search-icon"></i>
                <input type="text" id="templatesSearchInput" class="templates-search-input" placeholder="Buscar plantilla..." autocomplete="off">
            </div>
            
            <div class="templates-tabs">
                <button type="button" class="templates-tab-btn active" data-tab="UBICACION">Ubicación</button>
                <button type="button" class="templates-tab-btn" data-tab="PAQUETEO">Paqueteo</button>
                <button type="button" class="templates-tab-btn" data-tab="OPERACION">Operación</button>
            </div>
            
            <div class="templates-modal-body">
                <div class="templates-list" id="templatesListContainer">
                    <!-- Las tarjetas se inyectan solo una vez -->
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(backdrop);
}

/**
 * Escapado de caracteres rápido
 */
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Renderiza todas las plantillas en el DOM una sola vez (DOM Recycling)
 */
function renderTemplates() {
    const container = document.getElementById('templatesListContainer');
    if (!container) return;

    const hasTextarea = !!document.getElementById('observacionesCalidad');

    // Generar todas las tarjetas en memoria
    container.innerHTML = plantillasData.map((item, index) => {
        const insertButtonHtml = hasTextarea 
            ? `<button type="button" class="btn-template-action btn-insert">
                <i class="fas fa-arrow-right"></i> Insertar
               </button>`
            : '';

        return `
            <div class="template-card" data-index="${index}" data-tipo="${item.tipo}" data-contenido="${escapeHtml(item.contenido.toLowerCase())}">
                <p class="template-text">${escapeHtml(item.contenido)}</p>
                <div class="template-actions">
                    <button type="button" class="btn-template-action btn-copy">
                        <i class="far fa-copy"></i> Copiar
                    </button>
                    ${insertButtonHtml}
                </div>
            </div>
        `;
    }).join('');

    // Filtrar visualmente
    filterTemplatesList();
}

/**
 * Filtrado ultrarrápido modificando estilos en lugar de regenerar el DOM (0ms Lag)
 */
function filterTemplatesList() {
    const cards = document.querySelectorAll('.template-card');
    const query = searchQuery.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
        const cardTipo = card.getAttribute('data-tipo');
        const cardContenido = card.getAttribute('data-contenido');

        const matchesTab = cardTipo === currentTab;
        const matchesSearch = !query || cardContenido.includes(query);

        if (matchesTab && matchesSearch) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Controlar el mensaje de búsqueda vacía de forma ultra-limpia
    let emptyState = document.getElementById('templatesEmptyState');
    if (visibleCount === 0) {
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.id = 'templatesEmptyState';
            emptyState.className = 'templates-empty-state';
            emptyState.innerHTML = `
                <i class="fas fa-search-minus"></i>
                <p>No se encontraron plantillas</p>
                <span style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">Pruebe con otra búsqueda o categoría</span>
            `;
            const container = document.getElementById('templatesListContainer');
            if (container) container.appendChild(emptyState);
        } else {
            emptyState.style.display = 'flex';
        }
    } else {
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
}

/**
 * Copia el texto al portapapeles de forma asíncrona
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('success', 'Plantilla copiada al portapapeles');
    } catch (err) {
        console.error('[Plantillas] Fallo al copiar:', err);
        showToast('error', 'Error al copiar al portapapeles');
    }
}

/**
 * Obtiene el texto formateado con su prefijo oficial correspondiente
 * @param {string} tipo - 'UBICACION' | 'PAQUETEO' | 'OPERACION'
 * @param {string} text - Contenido original de la plantilla
 * @returns {string} Texto con el prefijo en mayúscula agregado
 */
function getFormattedTemplateText(tipo, text) {
    const PREFIXES = {
        'UBICACION': 'UBICACIÓN DE ETIQUETA: ',
        'PAQUETEO': 'INSTRUCCIONES DE PAQUETEO: ',
        'OPERACION': 'RECOMENDACIONES: '
    };
    const prefix = PREFIXES[tipo] || '';
    return prefix + text;
}

/**
 * Inserción sin lag en la posición actual del cursor con salto de línea inteligente
 */
function insertTextIntoObservations(text) {
    const textarea = document.getElementById('observacionesCalidad');
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const value = textarea.value;

    let textToInsert = text;
    
    // Salto de línea inteligente si ya hay texto previo
    if (startPos > 0) {
        const prevChar = value.charAt(startPos - 1);
        if (prevChar !== '\n') {
            textToInsert = '\n' + textToInsert;
        }
    }

    textarea.value = value.substring(0, startPos) + textToInsert + value.substring(endPos);
    textarea.focus();
    
    const newCursorPos = startPos + textToInsert.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Desencadenar reactividad en el formulario
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    showToast('success', 'Plantilla insertada con prefijo');
    closeTemplatesModal();
}

/**
 * Abre el modal de forma instantánea
 */
function openTemplatesModal() {
    const backdrop = document.getElementById('templatesModalBackdrop');
    if (backdrop) {
        backdrop.style.visibility = 'visible';
        backdrop.classList.add('open');
        
        const searchInput = document.getElementById('templatesSearchInput');
        if (searchInput) {
            searchInput.value = '';
            searchQuery = '';
        }
        filterTemplatesList();
        
        // Foco inmediato sin retardo
        if (searchInput) searchInput.focus();
    }
}

/**
 * Cierra el modal de forma instantánea
 */
function closeTemplatesModal() {
    const backdrop = document.getElementById('templatesModalBackdrop');
    if (backdrop) {
        backdrop.classList.remove('open');
        backdrop.style.visibility = 'hidden';
    }
}

/**
 * Alertas Toast no bloqueantes
 */
function showToast(icon, title) {
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        Toast.fire({
            icon: icon,
            title: title
        });
    } else {
        const toastEl = document.createElement('div');
        toastEl.style.position = 'fixed';
        toastEl.style.top = '24px';
        toastEl.style.right = '24px';
        toastEl.style.padding = '12px 20px';
        toastEl.style.background = icon === 'success' ? '#10b981' : '#ef4444';
        toastEl.style.color = '#ffffff';
        toastEl.style.borderRadius = '12px';
        toastEl.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
        toastEl.style.zIndex = '999999';
        toastEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        toastEl.style.fontSize = '0.85rem';
        toastEl.style.fontWeight = '600';
        toastEl.textContent = title;
        document.body.appendChild(toastEl);
        setTimeout(() => {
            toastEl.style.transition = 'opacity 0.4s ease';
            toastEl.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toastEl), 400);
        }, 2000);
    }
}

/**
 * Inicializador asíncrono no bloqueante
 */
function initFloatingTemplates() {
    // 1. Inyectar maquetación en el DOM
    injectTemplatesUI();

    // 2. Población local inmediata de plantillas (0ms de latencia de red)
    plantillasData = [...LOCAL_TEMPLATES];

    // 3. Referencias DOM
    const fab = document.getElementById('fabTemplatesTrigger');
    const backdrop = document.getElementById('templatesModalBackdrop');
    const closeBtn = document.getElementById('templatesModalCloseBtn');
    const searchInput = document.getElementById('templatesSearchInput');
    const tabButtons = document.querySelectorAll('.templates-tab-btn');
    const listContainer = document.getElementById('templatesListContainer');

    // 4. Escuchas de Eventos
    if (fab) {
        fab.addEventListener('click', openTemplatesModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeTemplatesModal);
    }

    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeTemplatesModal();
            }
        });
    }

    // Filtrado en tiempo real reactivo sin lag
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            filterTemplatesList();
        });
    }

    // Pestañas
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            filterTemplatesList();
        });
    });

    // Delegación de eventos eficiente en tarjetas
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.btn-copy');
            const insertBtn = e.target.closest('.btn-insert');
            const card = e.target.closest('.template-card');
            
            if (card) {
                const text = card.querySelector('.template-text').textContent;
                const tipo = card.getAttribute('data-tipo') || '';
                
                // Formatear texto con prefijo dinámico oficial
                const formattedText = getFormattedTemplateText(tipo, text);
                
                if (copyBtn) copyToClipboard(formattedText);
                if (insertBtn) insertTextIntoObservations(formattedText);
            }
        });
    }

    // 5. Control inteligente de visibilidad del botón flotante en index.html
    const calidadSection = document.getElementById('calidadSection');
    if (calidadSection && fab) {
        const observer = new MutationObserver(() => {
            const isHidden = calidadSection.classList.contains('hidden');
            fab.style.display = isHidden ? 'none' : 'flex';
        });
        observer.observe(calidadSection, { attributes: true, attributeFilter: ['class'] });
        
        fab.style.display = calidadSection.classList.contains('hidden') ? 'none' : 'flex';
    } else if (fab) {
        fab.style.display = 'flex';
    }

    // 6. Primer renderizado local instantáneo
    renderTemplates();

    // 7. Cargar desde Supabase en background sin interrumpir ni bloquear la UI del usuario
    loadTemplates().then(() => {
        renderTemplates();
    });
}

// Inicialización segura del módulo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingTemplates);
} else {
    initFloatingTemplates();
}
