/**
 * Módulo de Persistencia de Formularios
 * Guarda automáticamente los datos de los formularios en localStorage
 * para evitar pérdida de datos al cambiar de página, cerrar el navegador o fallar la captura de fotos
 */

const PersistenciaFormularios = (function() {
  // Claves de localStorage para cada formulario
  const STORAGE_KEYS = {
    mainForm: 'index_mainForm_data',
    novedadesForm: 'index_novedadesForm_data',
    calidadForm: 'index_calidadForm_data',
    ruteroForm: 'index_ruteroForm_data',
    actualizarDatosForm: 'index_actualizarDatosForm_data'
  };

  // Campos que NO deben persistirse (campos de solo lectura, calculados, etc.)
  const EXCLUDE_FIELDS = [
    'fecha', // Se genera automáticamente
    'lote', // Se carga del lote seleccionado
    'referencia', // Se carga del lote seleccionado
    'prenda', // Se carga del lote seleccionado
    'genero', // Se carga del lote seleccionado
    'tejido', // Se carga del lote seleccionado
    'cantidad', // Se carga del lote seleccionado
    'entrada', // Se carga del lote seleccionado
    'salida', // Se carga del lote seleccionado
    'proceso', // Se carga del lote seleccionado
    'duracionEstimada', // Se carga del lote seleccionado
    'linea', // Se carga del lote seleccionado
    'ruteroCantidad', // Se carga del lote seleccionado
    'cedulaPlanta', // Se carga automáticamente
    'nombrePlanta', // Se carga automáticamente
    'localizacion', // Se genera automáticamente
    'localizacionPlanta', // Se genera automáticamente
    'firmaValidada', // Se genera automáticamente
    'codigosCantidadTotal' // Se calcula automáticamente
  ];

  /**
   * Convierte un archivo a base64 (promesa)
   * @param {File} file - Archivo a convertir
   * @returns {Promise<string>} - Base64 del archivo
   */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Guarda los datos de un formulario en localStorage
   * @param {string} formId - ID del formulario
   */
  async function guardarFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const formData = {};
    const elements = form.elements;
    const filePromises = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      // Ignorar campos excluidos
      if (EXCLUDE_FIELDS.includes(element.id)) continue;
      
      // Ignorar campos sin ID
      if (!element.id) continue;
      
      // Ignorar botones
      if (element.type === 'submit' || element.type === 'button') continue;
      
      // Guardar valor según tipo de elemento
      if (element.type === 'checkbox' || element.type === 'radio') {
        formData[element.id] = element.checked;
      } else if (element.type === 'file') {
        // Para archivos, guardamos el nombre y el contenido en base64
        if (element.files && element.files.length > 0) {
          formData[element.id + '_name'] = element.files[0].name;
          console.log('[Persistencia] Convirtiendo archivo a base64:', element.id, element.files[0].name);
          // Convertir imagen a base64 de forma asíncrona
          const promise = fileToBase64(element.files[0]).then(base64 => {
            formData[element.id + '_base64'] = base64;
            console.log('[Persistencia] Archivo convertido a base64:', element.id, base64.length, 'bytes');
          }).catch(error => {
            console.error('[Persistencia] Error al convertir archivo a base64:', error);
          });
          filePromises.push(promise);
        }
      } else {
        formData[element.id] = element.value;
      }
    }

    // Guardar también el estado de las listas dinámicas
    guardarListasDinamicas(formId, formData);

    // Esperar a que todas las conversiones a base64 terminen
    await Promise.all(filePromises);

    // Guardar en localStorage
    const storageKey = STORAGE_KEYS[formId];
    if (storageKey) {
      const jsonString = JSON.stringify(formData);
      console.log('[Persistencia] Guardando en localStorage:', formId, 'Tamaño:', jsonString.length, 'bytes');
      localStorage.setItem(storageKey, jsonString);
      console.log('[Persistencia] Guardado exitoso en localStorage:', storageKey);
    }
  }

  /**
   * Guarda el estado de listas dinámicas (insumos, telas, corte, códigos, etc.)
   * @param {string} formId - ID del formulario
   * @param {object} formData - Objeto donde se guardarán los datos
   */
  function guardarListasDinamicas(formId, formData) {
    if (formId === 'novedadesForm') {
      // Guardar lista de insumos
      const insumosList = document.getElementById('insumosList');
      if (insumosList) {
        formData.insumosList = insumosList.innerHTML;
      }
      
      // Guardar lista de telas
      const telasList = document.getElementById('telasList');
      if (telasList) {
        formData.telassList = telasList.innerHTML;
      }
      
      // Guardar lista de corte
      const corteList = document.getElementById('corteList');
      if (corteList) {
        formData.corteList = corteList.innerHTML;
      }
      
      // Guardar lista de códigos
      const codigosList = document.getElementById('codigosList');
      if (codigosList) {
        formData.codigosList = codigosList.innerHTML;
      }
    } else if (formId === 'calidadForm') {
      // Guardar lista de novedades de calidad (estado global)
      if (window._novedadesCalidadState && Array.isArray(window._novedadesCalidadState)) {
        formData._novedadesCalidadState = window._novedadesCalidadState;
      }
      
      // Guardar lista de novedades de calidad (HTML)
      const calidadNovedadesList = document.getElementById('calidadNovedadesList');
      if (calidadNovedadesList) {
        formData.calidadNovedadesList = calidadNovedadesList.innerHTML;
      }
      
      // Guardar slider de avance
      const avanceSlider = document.getElementById('avanceSlider');
      if (avanceSlider) {
        formData.avanceSlider = avanceSlider.value;
      }
      
      const avancePorcentaje = document.getElementById('avancePorcentaje');
      if (avancePorcentaje) {
        formData.avancePorcentaje = avancePorcentaje.value;
      }
      
      const avanceValor = document.getElementById('avanceValor');
      if (avanceValor) {
        formData.avanceValor = avanceValor.textContent;
      }
      
      // Guardar firma digital (trazos SVG)
      if (window.FirmaTaller && !FirmaTaller.isEmpty()) {
        formData.firmaStrokes = FirmaTaller._strokes;
        formData.firmaRawStrokes = FirmaTaller._rawStrokes;
        formData.firmaOriginalWidth = FirmaTaller.originalWidth;
        formData.firmaOriginalHeight = FirmaTaller.originalHeight;
      }
      
      // Guardar rotación de imágenes
      if (window.imagenRotacion) {
        formData.imagenRotacion = window.imagenRotacion;
      }
    } else if (formId === 'actualizarDatosForm') {
      // Guardar todos los campos del constructor de dirección
      const camposDireccion = [
        'tipoVia', 'numPrincipal', 'letraVia', 'bisVia', 'sectorVia',
        'numCruce', 'letraCruce', 'bisCruce', 'sectorCruce',
        'numPlaca', 'sectorPlaca',
        'tipoComplemento', 'complementoDireccion'
      ];
      
      camposDireccion.forEach(campo => {
        const elemento = document.getElementById(campo);
        if (elemento) {
          formData[campo] = elemento.value;
        }
      });
      
      // Guardar checkboxes
      const checkPolitica = document.getElementById('checkPoliticaDatos');
      if (checkPolitica) {
        formData.checkPoliticaDatos = checkPolitica.checked;
      }
      
      const checkNotif = document.getElementById('checkNotificaciones');
      if (checkNotif) {
        formData.checkNotificaciones = checkNotif.checked;
      }
    }
  }

  /**
   * Carga los datos de un formulario desde localStorage
   * @param {string} formId - ID del formulario
   */
  function cargarFormulario(formId) {
    const storageKey = STORAGE_KEYS[formId];
    if (!storageKey) return;

    const savedData = localStorage.getItem(storageKey);
    if (!savedData) return;

    try {
      const formData = JSON.parse(savedData);
      const form = document.getElementById(formId);
      if (!form) return;

      // Cargar valores de los campos
      for (const fieldId in formData) {
        // Ignorar listas dinámicas (se cargan después)
        if (fieldId.includes('List')) continue;
        
        const element = document.getElementById(fieldId);
        if (!element) continue;

        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = formData[fieldId];
        } else if (element.type === 'file') {
          // Para archivos, restaurar el nombre y la imagen base64
          const nameElement = document.getElementById(fieldId + '_name') ||
                             document.getElementById(fieldId.replace('imagen', 'imagenName')) ||
                             document.getElementById(fieldId.replace('soporte', 'soporteName'));
          if (nameElement && formData[fieldId + '_name']) {
            nameElement.textContent = formData[fieldId + '_name'];
          }
          
          // Restaurar la imagen base64 si existe
          if (formData[fieldId + '_base64']) {
            // Mostrar el preview y ocultar icono y texto
            const preview = document.getElementById(fieldId + 'Preview');
            const icon = document.getElementById(fieldId + 'Icon');
            const text = document.getElementById(fieldId + 'Text');
            const rotationControls = document.getElementById(fieldId + 'RotationControls');
            
            if (preview) {
              preview.src = formData[fieldId + '_base64'];
              preview.style.display = 'block';
            }
            
            if (icon) icon.style.display = 'none';
            if (text) text.style.display = 'none';
            if (rotationControls) rotationControls.style.display = 'flex';
          }
        } else {
          element.value = formData[fieldId];
        }
      }

      // Cargar listas dinámicas
      cargarListasDinamicas(formId, formData);

      // Auto-resize de textareas después de cargar datos
      if (formId === 'calidadForm') {
        const observacionesCalidad = document.getElementById('observacionesCalidad');
        if (observacionesCalidad && typeof _autoResizeTextarea === 'function') {
          _autoResizeTextarea(observacionesCalidad);
        }
      } else if (formId === 'novedadesForm') {
        const observacionesNovedad = document.getElementById('observacionesNovedad');
        if (observacionesNovedad && typeof _autoResizeTextarea === 'function') {
          _autoResizeTextarea(observacionesNovedad);
        }
      }

    } catch (e) {
      console.error('Error al cargar datos del formulario:', e);
    }
  }

  /**
   * Carga el estado de listas dinámicas
   * @param {string} formId - ID del formulario
   * @param {object} formData - Objeto con los datos guardados
   */
  function cargarListasDinamicas(formId, formData) {
    if (formId === 'novedadesForm') {
      if (formData.insumosList) {
        const insumosList = document.getElementById('insumosList');
        if (insumosList) insumosList.innerHTML = formData.insumosList;
      }
      
      if (formData.telassList) {
        const telasList = document.getElementById('telasList');
        if (telasList) telasList.innerHTML = formData.telassList;
      }
      
      if (formData.corteList) {
        const corteList = document.getElementById('corteList');
        if (corteList) corteList.innerHTML = formData.corteList;
      }
      
      if (formData.codigosList) {
        const codigosList = document.getElementById('codigosList');
        if (codigosList) codigosList.innerHTML = formData.codigosList;
      }
    } else if (formId === 'calidadForm') {
      // Cargar estado global de novedades de calidad
      if (formData._novedadesCalidadState && Array.isArray(formData._novedadesCalidadState)) {
        window._novedadesCalidadState = formData._novedadesCalidadState;
        // Renderizar las tarjetas de novedades
        if (typeof renderTarjetasNovedadesCalidad === 'function') {
          renderTarjetasNovedadesCalidad();
        }
      }
      
      // Cargar lista de novedades de calidad (HTML)
      if (formData.calidadNovedadesList) {
        const calidadNovedadesList = document.getElementById('calidadNovedadesList');
        if (calidadNovedadesList) calidadNovedadesList.innerHTML = formData.calidadNovedadesList;
      }
      
      // Cargar slider de avance
      if (formData.avanceSlider) {
        const avanceSlider = document.getElementById('avanceSlider');
        if (avanceSlider) avanceSlider.value = formData.avanceSlider;
      }
      
      if (formData.avancePorcentaje) {
        const avancePorcentaje = document.getElementById('avancePorcentaje');
        if (avancePorcentaje) avancePorcentaje.value = formData.avancePorcentaje;
      }
      
      if (formData.avanceValor) {
        const avanceValor = document.getElementById('avanceValor');
        if (avanceValor) avanceValor.textContent = formData.avanceValor;
      }
      
      // Restaurar firma digital desde trazos SVG
      if (formData.firmaStrokes && window.FirmaTaller) {
        FirmaTaller._strokes = formData.firmaStrokes;
        FirmaTaller._rawStrokes = formData.firmaRawStrokes;
        FirmaTaller.originalWidth = formData.firmaOriginalWidth;
        FirmaTaller.originalHeight = formData.firmaOriginalHeight;
        
        // Redibujar la firma
        setTimeout(() => {
          FirmaTaller.redrawInline();
        }, 100);
      }
      
      // Restaurar rotación de imágenes
      if (formData.imagenRotacion) {
        window.imagenRotacion = formData.imagenRotacion;
        
        // Aplicar rotación al preview de imagen
        if (formData.imagenRotacion.imagen !== undefined) {
          const imagenPreview = document.getElementById('imagenPreview');
          if (imagenPreview) {
            imagenPreview.style.transform = 'rotate(' + formData.imagenRotacion.imagen + 'deg)';
          }
        }
        
        if (formData.imagenRotacion.soporte !== undefined) {
          const soportePreview = document.getElementById('soportePreview');
          if (soportePreview) {
            soportePreview.style.transform = 'rotate(' + formData.imagenRotacion.soporte + 'deg)';
          }
        }
      }
    } else if (formId === 'actualizarDatosForm') {
      // Cargar todos los campos del constructor de dirección
      const camposDireccion = [
        'tipoVia', 'numPrincipal', 'letraVia', 'bisVia', 'sectorVia',
        'numCruce', 'letraCruce', 'bisCruce', 'sectorCruce',
        'numPlaca', 'sectorPlaca',
        'tipoComplemento', 'complementoDireccion'
      ];
      
      camposDireccion.forEach(campo => {
        if (formData[campo] !== undefined) {
          const elemento = document.getElementById(campo);
          if (elemento) {
            elemento.value = formData[campo];
          }
        }
      });
      
      // Cargar checkboxes
      if (formData.checkPoliticaDatos !== undefined) {
        const checkPolitica = document.getElementById('checkPoliticaDatos');
        if (checkPolitica) {
          checkPolitica.checked = formData.checkPoliticaDatos;
        }
      }
      
      if (formData.checkNotificaciones !== undefined) {
        const checkNotif = document.getElementById('checkNotificaciones');
        if (checkNotif) {
          checkNotif.checked = formData.checkNotificaciones;
        }
      }
    }
  }

  /**
   * Limpia los datos de un formulario de localStorage
   * @param {string} formId - ID del formulario
   */
  function limpiarFormulario(formId) {
    const storageKey = STORAGE_KEYS[formId];
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }

  /**
   * Limpia todos los datos de formularios de localStorage
   */
  function limpiarTodos() {
    for (const key in STORAGE_KEYS) {
      localStorage.removeItem(STORAGE_KEYS[key]);
    }
  }

  /**
   * Inicializa la persistencia para un formulario
   * @param {string} formId - ID del formulario
   */
  function inicializarPersistencia(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    // Cargar datos guardados al iniciar
    cargarFormulario(formId);

    // Guardar datos cuando cambian los campos
    form.addEventListener('input', function() {
      guardarFormulario(formId).catch(error => {
        console.error('[Persistencia] Error al guardar en input:', error);
      });
    });

    form.addEventListener('change', function() {
      guardarFormulario(formId).catch(error => {
        console.error('[Persistencia] Error al guardar en change:', error);
      });
    });

    // Guardar datos cuando se hace click en el formulario (para sliders y elementos interactivos)
    form.addEventListener('click', function(e) {
      // Pequeño delay para permitir que el valor se actualice
      setTimeout(() => {
        guardarFormulario(formId).catch(error => {
          console.error('[Persistencia] Error al guardar en click:', error);
        });
      }, 100);
    });

    // Guardar datos periódicamente cada 5 segundos (backup adicional)
    setInterval(() => {
      guardarFormulario(formId).catch(error => {
        console.error('[Persistencia] Error al guardar periódicamente:', error);
      });
    }, 5000);

    // Guardar antes de salir de la página
    window.addEventListener('beforeunload', function() {
      guardarFormulario(formId).catch(error => {
        console.error('[Persistencia] Error al guardar en beforeunload:', error);
      });
    });
  }

  /**
   * Inicializa la persistencia para todos los formularios
   */
  function inicializarTodos() {
    inicializarPersistencia('mainForm');
    inicializarPersistencia('novedadesForm');
    inicializarPersistencia('calidadForm');
    inicializarPersistencia('ruteroForm');
    inicializarPersistencia('actualizarDatosForm');
  }

  /**
   * Limpia un formulario específico (campos y localStorage)
   * @param {string} formId - ID del formulario
   */
  function limpiarFormularioCompleto(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    // Limpiar todos los campos del formulario
    form.reset();

    // Limpiar listas dinámicas
    if (formId === 'novedadesForm') {
      const insumosList = document.getElementById('insumosList');
      if (insumosList) insumosList.innerHTML = '';
      
      const telasList = document.getElementById('telasList');
      if (telasList) telasList.innerHTML = '';
      
      const corteList = document.getElementById('corteList');
      if (corteList) corteList.innerHTML = '';
      
      const codigosList = document.getElementById('codigosList');
      if (codigosList) codigosList.innerHTML = '';
      
      // Limpiar nombres de archivos
      const imagenName = document.getElementById('imagenName');
      if (imagenName) imagenName.textContent = '';
      
      // Limpiar preview de imagen dentro del dropzone
      const imagenPreview = document.getElementById('imagenPreview');
      if (imagenPreview) {
        imagenPreview.src = '';
        imagenPreview.style.display = 'none';
        imagenPreview.style.transform = 'rotate(0deg)';
      }
      
      // Mostrar icono y texto
      const imagenIcon = document.getElementById('imagenIcon');
      if (imagenIcon) imagenIcon.style.display = 'block';
      
      const imagenText = document.getElementById('imagenText');
      if (imagenText) imagenText.style.display = 'block';
      
      // Ocultar controles de rotación (ahora están fuera del dropzone)
      const imagenRotationControls = document.getElementById('imagenRotationControls');
      if (imagenRotationControls) imagenRotationControls.style.display = 'none';
      
      // Limpiar rotación
      if (window.imagenRotacion) {
        window.imagenRotacion.imagen = 0;
      }
    } else if (formId === 'calidadForm') {
      const calidadNovedadesList = document.getElementById('calidadNovedadesList');
      if (calidadNovedadesList) calidadNovedadesList.innerHTML = '';
      
      // Limpiar nombres de archivos
      const soporteName = document.getElementById('soporteName');
      if (soporteName) soporteName.textContent = '';
      
      // Limpiar preview de soporte dentro del dropzone
      const soportePreview = document.getElementById('soportePreview');
      if (soportePreview) {
        soportePreview.src = '';
        soportePreview.style.display = 'none';
        soportePreview.style.transform = 'rotate(0deg)';
      }
      
      // Mostrar icono y texto
      const soporteIcon = document.getElementById('soporteIcon');
      if (soporteIcon) soporteIcon.style.display = 'block';
      
      const soporteText = document.getElementById('soporteText');
      if (soporteText) soporteText.style.display = 'block';
      
      // Ocultar controles de rotación
      const soporteRotationControls = document.getElementById('soporteRotationControls');
      if (soporteRotationControls) soporteRotationControls.style.display = 'none';
      
      // Limpiar rotación
      if (window.imagenRotacion) {
        window.imagenRotacion.soporte = 0;
      }
      
      // Limpiar firma
      const signatureContainer = document.getElementById('signature-container');
      if (signatureContainer) {
        const canvas = signatureContainer.querySelector('canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      // Limpiar estado global de novedades de calidad
      if (window._novedadesCalidadState) {
        window._novedadesCalidadState = [];
        if (typeof renderTarjetasNovedadesCalidad === 'function') {
          renderTarjetasNovedadesCalidad();
        }
      }
      
      // Limpiar firma digital
      if (window.FirmaTaller) {
        FirmaTaller.clear();
      }
      
      // Limpiar slider de avance
      const avanceSlider = document.getElementById('avanceSlider');
      if (avanceSlider) avanceSlider.value = 0;
      
      const avancePorcentaje = document.getElementById('avancePorcentaje');
      if (avancePorcentaje) avancePorcentaje.value = 0;
      
      const avanceValor = document.getElementById('avanceValor');
      if (avanceValor) avanceValor.textContent = '0%';
    } else if (formId === 'actualizarDatosForm') {
      // Limpiar campos del constructor de dirección
      const camposDireccion = [
        'tipoVia', 'numPrincipal', 'letraVia', 'bisVia', 'sectorVia',
        'numCruce', 'letraCruce', 'bisCruce', 'sectorCruce',
        'numPlaca', 'sectorPlaca',
        'tipoComplemento', 'complementoDireccion'
      ];
      
      camposDireccion.forEach(campo => {
        const elemento = document.getElementById(campo);
        if (elemento) {
          elemento.value = '';
        }
      });
      
      // Limpiar checkboxes
      const checkPolitica = document.getElementById('checkPoliticaDatos');
      if (checkPolitica) {
        checkPolitica.checked = false;
      }
      
      const checkNotif = document.getElementById('checkNotificaciones');
      if (checkNotif) {
        checkNotif.checked = false;
      }
    }

    // Limpiar localStorage
    limpiarFormulario(formId);
  }

  // API pública
  return {
    inicializarTodos,
    inicializarPersistencia,
    guardarFormulario,
    cargarFormulario,
    limpiarFormulario,
    limpiarTodos,
    limpiarFormularioCompleto
  };
})();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  PersistenciaFormularios.inicializarTodos();
});
