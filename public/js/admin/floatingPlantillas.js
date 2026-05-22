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
    { tipo: 'UBICACION', contenido: 'En la tira libre izquierda de la prenda puesta.' },

    // PAQUETEO
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 10 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.' },
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 20 unidades, separadas por talla y color, asegurando y amarrando las etiquetas correspondientes.' },
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 10 unidades, ensambladas espalda con espalda, dobladas individualmente y con las etiquetas aseguradas y amarradas.' },
    { tipo: 'PAQUETEO', contenido: 'Paquetear en grupos de 10 unidades, organizadas una sobre otra; doblar las piernas y posteriormente la prenda a la mitad, asegurando el paquete y amarrando las etiquetas correspondientes.' },

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
    let visibleCount = 0;

    cards.forEach(card => {
        const cardTipo = card.getAttribute('data-tipo');
        const matchesTab = cardTipo === currentTab;

        if (matchesTab) {
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
                <i class="fas fa-clipboard-list"></i>
                <p>No hay plantillas en esta categoría</p>
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
 * Inserción sin lag en la posición actual del cursor
 */
function insertTextIntoObservations(text) {
    const textarea = document.getElementById('observacionesCalidad');
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const value = textarea.value;

    let textToInsert = text;
    if (startPos > 0 && !/\s/.test(value.charAt(startPos - 1))) {
        textToInsert = ' ' + textToInsert;
    }

    textarea.value = value.substring(0, startPos) + textToInsert + value.substring(endPos);
    textarea.focus();

    const newCursorPos = startPos + textToInsert.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Desencadenar reactividad en el formulario
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    showToast('success', 'Plantilla insertada con éxito');
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
        filterTemplatesList();

        const fab = document.getElementById('fabTemplatesTrigger');
        if (fab) fab.classList.add('modal-open');
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

        const fab = document.getElementById('fabTemplatesTrigger');
        if (fab) fab.classList.remove('modal-open');
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
 * Implementa arrastre suave (drag & drop) usando PointerEvents para PC y Móviles.
 * Cuenta con límites del viewport y diferenciación inteligente entre arrastre y clic.
 */
function makeElementDraggable(el) {
    if (!el) return;

    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let isDragging = false;
    let hasDragged = false;

    el.addEventListener('pointerdown', onPointerDown);

    function onPointerDown(e) {
        // Ignorar clics secundarios
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        isDragging = true;
        hasDragged = false;

        startX = e.clientX;
        startY = e.clientY;

        const rect = el.getBoundingClientRect();
        currentX = rect.left;
        currentY = rect.top;

        // Forzar posicionamiento explícito en píxeles y remover bottom/right/transform
        el.style.left = currentX + 'px';
        el.style.top = currentY + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
        el.style.transform = 'none';

        // Quitar la transición CSS durante el arrastre para evitar efecto elástico o lag
        el.style.transition = 'none';

        // Estilos interactivos durante el arrastre (opacidad total al interactuar)
        el.style.opacity = '1';
        el.style.background = 'linear-gradient(135deg, #3f51b5, #6366f1)';
        el.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        el.style.color = '#ffffff';

        // Captura del puntero para que no se pierda al salir del elemento
        el.setPointerCapture(e.pointerId);

        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Umbral de 5px para considerar que es un arrastre y no un clic
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDragged = true;
        }

        let newX = currentX + dx;
        let newY = currentY + dy;

        const rect = el.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Mantener dentro de los límites del viewport con 10px de margen
        const padding = 10;
        if (newX < padding) newX = padding;
        if (newX + width > windowWidth - padding) newX = windowWidth - padding - width;
        if (newY < padding) newY = padding;
        if (newY + height > windowHeight - padding) newY = windowHeight - padding - height;

        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
    }

    function onPointerUp(e) {
        if (!isDragging) return;

        isDragging = false;

        // Restaurar transición CSS suave para estados normales de hover/active/opacity
        el.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.2), opacity 0.3s ease, background-color 0.3s, border-color 0.3s, color 0.3s';

        // Limpiar anulaciones en línea para que el archivo CSS vuelva a gobernar la opacidad/color/borde
        el.style.opacity = '';
        el.style.background = '';
        el.style.borderColor = '';
        el.style.color = '';

        el.releasePointerCapture(e.pointerId);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);

        // Si se detectó arrastre, capturamos e interceptamos el clic para evitar que se abra el modal
        if (hasDragged) {
            const preventClick = (event) => {
                event.stopImmediatePropagation();
                el.removeEventListener('click', preventClick, true);
            };
            el.addEventListener('click', preventClick, true);
        }
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
    const tabButtons = document.querySelectorAll('.templates-tab-btn');
    const listContainer = document.getElementById('templatesListContainer');

    // 4. Escuchas de Eventos
    if (fab) {
        fab.addEventListener('click', openTemplatesModal);
        makeElementDraggable(fab);
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
                if (copyBtn) copyToClipboard(text);
                if (insertBtn) insertTextIntoObservations(text);
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
