// App principal - ULTRA OPTIMIZADO con Grid.js

let grid = null;
let flatpickrInstance = null;
let allData = [];
let filteredData = [];
let cardsVisible = 20;
let cardsObserver = null;


function getPrimerDiaMes() {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

function getHoy() {
    return new Date();
}

function formatearFecha(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calcularDiasNumero(fechaSiesa, entregas) {
    if (!fechaSiesa) return 0;
    const fechaSiesaDate = new Date(fechaSiesa + 'T00:00:00-05:00');
    let fechaComparacion;
    if (entregas.length > 0 && entregas[0].Registro) {
        fechaComparacion = new Date(entregas[0].Registro);
    } else {
        const ahora = new Date();
        const colombiaOffset = -5 * 60;
        const localOffset = ahora.getTimezoneOffset();
        const diffOffset = colombiaOffset - localOffset;
        fechaComparacion = new Date(ahora.getTime() + diffOffset * 60 * 1000);
    }
    return Math.floor((fechaComparacion - fechaSiesaDate) / (1000 * 60 * 60 * 24));
}

function calcularDias(fechaSiesa, entregas) {
    const dias = calcularDiasNumero(fechaSiesa, entregas);
    let className = '';
    if (dias <= 2) className = 'dias-ok';
    else if (dias <= 5) className = 'dias-warning';
    else className = 'dias-danger';
    return gridjs.html(`<span class="dias-badge ${className}">${dias} día${dias !== 1 ? 's' : ''}</span>`);
}

function poblarFiltros(data) {
    const clientes = [...new Set(data.map(f => f['Razón social cliente factura']).filter(v => v))].sort();
    const proveedores = [...new Set(data.map(f => f.proveedor).filter(v => v))].sort();
    const estados = [...new Set(data.map(f => f.Estado).filter(v => v))].sort();
    const tipos = [...new Set(data.map(f => f.tipo).filter(v => v))].sort();
    $('#filtroCliente').html('<option value="">Todos</option>' + clientes.map(c => `<option value="${c}">${c}</option>`).join(''));
    $('#filtroProveedor').html('<option value="">Todos</option>' + proveedores.map(p => `<option value="${p}">${p}</option>`).join(''));
    $('#filtroEstado').html('<option value="">Todos</option>' + estados.map(e => `<option value="${e}">${e}</option>`).join(''));
    $('#filtroTipo').html('<option value="">Todos</option>' + tipos.map(t => `<option value="${t}">${t}</option>`).join(''));
}

function aplicarFiltros() {
    cardsVisible = 20;
    const filtroCliente = $('#filtroCliente').val();

    const filtroProveedor = $('#filtroProveedor').val();
    const filtroEstado = $('#filtroEstado').val();
    const filtroTipo = $('#filtroTipo').val();
    const filtroConfirmacion = $('#filtroConfirmacion').val();
    const busca = $('#globalSearch').val().toLowerCase();
    
    filteredData = allData.filter(row => {
        if (busca) {
            const contenido = Object.values(row).join(' ').toLowerCase();
            if (!contenido.includes(busca)) return false;
        }

        if (filtroCliente && row['Razón social cliente factura'] !== filtroCliente) return false;
        if (filtroProveedor && row.proveedor !== filtroProveedor) return false;
        if (filtroEstado && row.Estado !== filtroEstado) return false;
        if (filtroTipo && row.tipo !== filtroTipo) return false;
        if (filtroConfirmacion && row.confirmacion !== filtroConfirmacion) return false;
        return true;
    });
    actualizarGrid();
    renderizarTarjetas();
    actualizarStats();
}

function actualizarStats() {
    const entregadas = filteredData.filter(f => f.confirmacion === 'ENTREGADO');
    const pendientes = filteredData.filter(f => f.confirmacion === 'PENDIENTE');
    
    const total = filteredData.length;
    
    // Entregadas
    const countEnt = entregadas.length;
    const valEnt = entregadas.reduce((acc, f) => acc + (parseFloat(f['Valor subtotal local']) || 0), 0);
    const unitsEnt = entregadas.reduce((acc, f) => acc + (parseFloat(f['Cantidad inv.']) || 0), 0);
    const percEnt = total > 0 ? Math.round((countEnt / total) * 100) : 0;
    
    // Pendientes
    const countPend = pendientes.length;
    const valPend = pendientes.reduce((acc, f) => acc + (parseFloat(f['Valor subtotal local']) || 0), 0);
    const unitsPend = pendientes.reduce((acc, f) => acc + (parseFloat(f['Cantidad inv.']) || 0), 0);
    const percPend = total > 0 ? Math.round((countPend / total) * 100) : 0;
    
    // Actualizar UI
    $('#countEntregadas').text(countEnt.toLocaleString('es-CO'));
    $('#valEntregadas').text('$' + Math.round(valEnt).toLocaleString('es-CO'));
    $('#unitsEntregadas').text(Math.round(unitsEnt).toLocaleString('es-CO'));
    $('#percentEntregadas').text(percEnt + '%');
    
    $('#countPendientes').text(countPend.toLocaleString('es-CO'));
    $('#valPendientes').text('$' + Math.round(valPend).toLocaleString('es-CO'));
    $('#unitsPendientes').text(Math.round(unitsPend).toLocaleString('es-CO'));
    $('#percentPendientes').text(percPend + '%');
    $('#percentPendientes').text(percPend + '%');
}

function descargarCSV() {
    if (filteredData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    const headers = [
        'Estado SIESA', 'Documento', 'Docto. referencia', 'OP', 'Fecha Factura', 
        'Cliente', 'Proveedor', 'Notas', 'Valor Subtotal', 'Referencia', 
        'Cantidad', 'Tipo Documento', 'Estado Entrega', 
        'Días Diferencia', 'Fecha Entrega'
    ];

    const rows = filteredData.map(f => {
        const entregas = f.entregas || [];
        const dias = calcularDiasNumero(f.Fecha, entregas);
        const fechaEntrega = entregas.length > 0 ? new Date(entregas[0].Registro).toLocaleString('es-CO') : '-';
        
        // Limpiamos los datos para que no rompan el CSV
        const limpiar = (val) => String(val || '-').replace(/(\r\n|\n|\r|;)/gm, " ");

        return [
            limpiar(f.Estado),
            limpiar(f['Nro documento']),
            limpiar(f['Docto. referencia']),
            limpiar(f.op),
            limpiar(f.Fecha),
            limpiar(f['Razón social cliente factura']),
            limpiar(f.proveedor),
            limpiar(f.Notas),
            Math.round(parseFloat(f['Valor subtotal local']) || 0),
            limpiar(f.Referencia),
            Math.round(f['Cantidad inv.'] || 0),
            limpiar(f.tipo),
            limpiar(f.confirmacion),
            dias,
            fechaEntrega
        ].join(';');
    });

    const csvContent = "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SIESA_Delivery_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}



function renderizarTarjetas() {
    const container = document.getElementById('deliveryCards');
    if (!container) return;
    container.innerHTML = filteredData.map((f, index) => {
        const entregas = f.entregas || [];
        const esEntregado = entregas.length > 0;
        const esAnulado = f.Estado && f.Estado.toLowerCase().includes('anulad');
        let cardClass = 'card-pendiente';
        if (esAnulado) cardClass = 'card-anulada';
        else if (esEntregado) cardClass = 'card-entregada';
        const dias = calcularDiasNumero(f.Fecha, entregas);
        let diasClass = 'dias-ok';
        if (dias > 5) diasClass = 'dias-danger';
        else if (dias > 2) diasClass = 'dias-warning';
        const collapseId = `collapse-${index}`;
        return `
            <div class="delivery-card ${cardClass} mb-3">
                <div class="card-header-custom">
                    <div class="d-flex justify-content-between align-items-start">
                        <div><h6 class="mb-1">${f['Nro documento']}</h6><small class="text-muted">${f.Fecha}</small></div>
                        <span class="badge ${esEntregado ? 'badge-entregado' : 'badge-pendiente'}">${esEntregado ? 'ENTREGADO' : 'PENDIENTE'}</span>
                    </div>
                </div>
                <div class="card-body-custom">
                    <div class="info-row"><span class="info-label">Cliente:</span><span class="info-value">${f['Razón social cliente factura'] || '-'}</span></div>
                    <div class="info-row"><span class="info-label">Proveedor:</span><span class="info-value">${f.proveedor || '-'}</span></div>
                    <div class="info-row"><span class="info-label">Valor:</span><span class="info-value">$${f['Valor subtotal local'] ? Math.round(parseFloat(f['Valor subtotal local'])).toLocaleString('es-CO') : '0'}</span></div>
                    <div class="info-row"><span class="info-label">Referencia:</span><span class="info-value">${f.Referencia || '-'}</span></div>
                    <div class="info-row"><span class="info-label">Cantidad:</span><span class="info-value">${f['Cantidad inv.'] ? Math.round(f['Cantidad inv.']).toLocaleString('es-CO') : '0'}</span></div>
                    <div class="info-row"><span class="info-label">Tipo:</span><span class="info-value">${f.tipo || '-'}</span></div>
                    <div class="info-row"><span class="info-label">Diferencia:</span><span class="dias-badge ${diasClass}">${dias} día${dias !== 1 ? 's' : ''}</span></div>
                    ${esEntregado && entregas[0].Registro ? `<div class="info-row"><span class="info-label">Fecha Entrega:</span><span class="info-value">${new Date(entregas[0].Registro).toLocaleString('es-CO', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</span></div>` : ''}
                    ${esEntregado && entregas[0].SoporteID ? `
                        <div class="soporte-collapse mt-3">
                            <button class="btn-collapse" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                                <i class="fas fa-image me-2"></i>Ver Soporte<i class="fas fa-chevron-down ms-auto"></i>
                            </button>
                            <div class="collapse" id="${collapseId}">
                                <div class="soporte-content">
                                    <a href="https://lh3.googleusercontent.com/d/${entregas[0].SoporteID}" target="_blank">
                                        <img src="https://lh3.googleusercontent.com/d/${entregas[0].SoporteID}" alt="Soporte" class="img-fluid rounded" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function actualizarGrid() {
    if (grid && filteredData && filteredData.length > 0) {
        grid.updateConfig({
            data: filteredData.map(f => [
                f.Estado, f['Nro documento'], f.Fecha, f['Razón social cliente factura'], f.Notas || '-', f.proveedor || '-',
                f['Valor subtotal local'] ? '$' + Math.round(parseFloat(f['Valor subtotal local'])).toLocaleString('es-CO') : '$0',
                f.Referencia || '-', f['Cantidad inv.'] ? Math.round(f['Cantidad inv.']).toLocaleString('es-CO') : '0',
                f.referencias_detalle ? gridjs.html((typeof f.referencias_detalle === 'string' ? JSON.parse(f.referencias_detalle) : f.referencias_detalle).map(ref => `<div class="ref-detalle">${ref.referencia} (${ref.cantidad}) - $${Math.round(ref.valor_subtotal).toLocaleString('es-CO')}</div>`).join('')) : '-',
                f.op || '-', f.tipo || '-',
                gridjs.html(f.entregas.length > 0 ? '<span class="badge badge-entregado">ENTREGADO</span>' : '<span class="badge badge-pendiente">PENDIENTE</span>'),
                calcularDias(f.Fecha, f.entregas),
                f.entregas.length > 0 ? gridjs.html(f.entregas.map(e => `<div class="entrega-fecha">${new Date(e.Registro).toLocaleString('es-CO', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>`).join('')) : '-',
                f.entregas.length > 0 && f.entregas[0].SoporteID ? gridjs.html(`<div class="soporte-img"><a href="https://lh3.googleusercontent.com/d/${f.entregas[0].SoporteID}" target="_blank"><img src="https://lh3.googleusercontent.com/d/${f.entregas[0].SoporteID}" alt="Soporte" /></a></div>`) : '-'
            ])
        }).forceRender();
        // Estilos removidos según solicitud del usuario

    }
}

async function cargarDatos(fechaInicio, fechaFin) {
    try {
        $('#loading').show();
        const fechaInicioStr = formatearFecha(fechaInicio);
        const fechaFinStr = formatearFecha(fechaFin);
        console.log(`📅 Cargando datos desde ${fechaInicioStr} hasta ${fechaFinStr}...`);
        const url = `${SiesaConfig.FUNCTIONS_URL}/delivery-operations?fechaInicio=${fechaInicioStr}&fechaFin=${fechaFinStr}`;
        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        console.log(`✅ ${result.data.length} facturas cargadas en ${result.stats.tiempoCarga}`);
        allData = result.data.map(f => ({...f, confirmacion: (f.entregas || []).length > 0 ? 'ENTREGADO' : 'PENDIENTE'}));
        filteredData = [...allData];
        poblarFiltros(allData);
        
        if (!grid) {
            grid = new gridjs.Grid({
                columns: [
                    'Estado', 
                    'Documento', 
                    'Fecha', 
                    'Cliente', 
                    'Notas', 
                    { name: 'Proveedor', hidden: true }, 
                    'Valor', 
                    'Referencia', 
                    'Cantidad', 
                    'Detalles', 
                    'OP', 
                    { name: 'Tipo', hidden: true }, 
                    'Confirmacion', 
                    'Diferencia', 
                    'Entrega', 
                    'Soporte'
                ],

                data: [],
                search: false, // Usamos el buscador global personalizado
                sort: {
                    multiColumn: false
                },
                pagination: {
                    enabled: true,
                    limit: 10,
                    summary: true
                },
                fixedHeader: true,
                height: 'auto',
                language: {
                    search: {placeholder: 'Buscar...'},
                    pagination: {previous: 'Anterior', next: 'Siguiente', showing: 'Mostrando', results: () => 'registros', of: 'de', to: 'a'}
                }
            }).render(document.getElementById('deliveryTable'));
        }
        
        // Renderizar en el siguiente tick para no bloquear
        $('#loading').hide();
        
        // Mostrar mensaje de procesamiento
        if (filteredData.length > 500) {
            $('#loading .spinner-border').after('<p class="mt-2 text-white">Procesando ' + filteredData.length + ' registros...</p>');
            $('#loading').show();
        }
        
        setTimeout(() => {
            actualizarGrid();
            renderizarTarjetas();
            actualizarStats();
            setupInfiniteScroll();
            $('#loading').hide();

            $('#loading p').remove();
        }, 0);
    } catch (error) {
        console.error('❌ Error:', error);
        $('#loading').hide();
        alert('Error cargando datos: ' + error.message);
    }
}

$(document).ready(function() {
    const primerDia = getPrimerDiaMes();
    const hoy = getHoy();
    flatpickrInstance = flatpickr("#dateRange", {
        mode: "range", dateFormat: "d/m/Y", locale: "es", maxDate: "today", altInput: false,
        onReady: function(selectedDates, dateStr, instance) {
            const fechas = [primerDia, hoy];
            instance.setDate(fechas, true);
            if (instance.selectedDates.length !== 2) {
                instance.selectedDates = [primerDia, hoy];
                instance.input.value = `${primerDia.toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'})} a ${hoy.toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'})}`;
            }
        },
        onClose: function(selectedDates) {
            if (selectedDates.length === 2) {
                const inicio = selectedDates[0].toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'});
                const fin = selectedDates[1].toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'});
                $('#dateRange').val(`${inicio} a ${fin}`);
                cargarDatos(selectedDates[0], selectedDates[1]);
            }
        }
    });
    cargarDatos(primerDia, hoy);
    $('#filtroCliente, #filtroProveedor, #filtroEstado, #filtroTipo, #filtroConfirmacion').on('change', aplicarFiltros);
    $('#globalSearch').on('keyup', aplicarFiltros);
    $('#btnLimpiarFiltros').on('click', function() {
        $('#filtroCliente, #filtroProveedor, #filtroEstado, #filtroTipo, #filtroConfirmacion').val('');
        filteredData = [...allData];
        actualizarGrid();
        renderizarTarjetas();
        actualizarStats();
    });
    $('#btnDescargarCSV').on('click', descargarCSV);
});



// Función para renderizar tarjetas móviles (optimizada)
function renderizarTarjetas() {
    const container = document.getElementById('deliveryCards');
    if (!container) return;
    
    const dataToRender = filteredData.slice(0, cardsVisible);
    const hasMore = filteredData.length > cardsVisible;
    
    container.innerHTML = dataToRender.map((f, index) => {

        const entregas = f.entregas || [];
        const esEntregado = entregas.length > 0;
        const esAnulado = f.Estado && f.Estado.toLowerCase().includes('anulad');
        
        let cardClass = 'card-pendiente';
        if (esAnulado) cardClass = 'card-anulada';
        else if (esEntregado) cardClass = 'card-entregada';
        
        const dias = calcularDiasNumero(f.Fecha, entregas);
        let diasClass = 'dias-ok';
        if (dias > 5) diasClass = 'dias-danger';
        else if (dias > 2) diasClass = 'dias-warning';
        
        const collapseSoporteId = `collapse-sop-${index}`;
        const collapseDetalleId = `collapse-det-${index}`;
        
        const detalles = f.referencias_detalle ? (typeof f.referencias_detalle === 'string' ? JSON.parse(f.referencias_detalle) : f.referencias_detalle) : [];

        return `
            <div class="delivery-card ${cardClass} mb-3">
                <div class="card-header-custom">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${f['Nro documento']}</h6>
                            <small class="text-muted"><i class="far fa-calendar-alt me-1"></i>${f.Fecha}</small>
                        </div>
                        <span class="badge ${esEntregado ? 'badge-entregado' : 'badge-pendiente'}">
                            ${esEntregado ? 'ENTREGADO' : 'PENDIENTE'}
                        </span>
                    </div>
                </div>
                <div class="card-body-custom">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value text-dark">${f['Razón social cliente factura'] || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Proveedor:</span>
                        <span class="info-value">${f.proveedor || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">OP:</span>
                        <span class="info-value fw-bold">${f.op || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Valor:</span>
                        <span class="info-value text-primary fw-bold">$${f['Valor subtotal local'] ? Math.round(parseFloat(f['Valor subtotal local'])).toLocaleString('es-CO') : '0'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Referencia:</span>
                        <span class="info-value">${f.Referencia || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Cantidad:</span>
                        <span class="info-value">${f['Cantidad inv.'] ? Math.round(f['Cantidad inv.']).toLocaleString('es-CO') : '0'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Tipo:</span>
                        <span class="info-value">${f.tipo || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Diferencia:</span>
                        <span class="dias-badge ${diasClass}">${dias} día${dias !== 1 ? 's' : ''}</span>
                    </div>
                    ${f.Notas ? `
                        <div class="info-row flex-column align-items-start">
                            <span class="info-label mb-1">Notas:</span>
                            <span class="info-value text-start w-100 small text-muted">${f.Notas}</span>
                        </div>
                    ` : ''}
                    ${esEntregado && entregas[0].Registro ? `
                        <div class="info-row">
                            <span class="info-label">Fecha Entrega:</span>
                            <span class="info-value text-success fw-bold">${new Date(entregas[0].Registro).toLocaleString('es-CO', {
                                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}</span>
                        </div>
                    ` : ''}

                    <!-- DETALLE DE PRODUCTOS (COLAPSABLE) -->
                    ${detalles.length > 0 ? `
                        <button class="btn-collapsible mt-3" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseDetalleId}">
                            <span><i class="fas fa-list-ul me-2"></i>Ver Detalles de Mercancía</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="collapse" id="${collapseDetalleId}">
                            <div class="collapsible-content">
                                ${detalles.map(ref => `
                                    <div class="product-item">
                                        <div class="product-name">${ref.referencia}</div>
                                        <div class="product-meta">
                                            <span class="badge bg-light text-dark border">Cant: ${ref.cantidad}</span>
                                            <span class="text-primary font-monospace">$${Math.round(ref.valor_subtotal).toLocaleString('es-CO')}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- SOPORTE DE ENTREGA (COLAPSABLE - SIEMPRE AL FINAL) -->
                    ${esEntregado && entregas[0].SoporteID ? `
                        <button class="btn-collapsible mt-2 btn-soporte-alt" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseSoporteId}">
                            <span><i class="fas fa-camera me-2"></i>Soporte de Entrega</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="collapse" id="${collapseSoporteId}">
                            <div class="collapsible-content p-0 overflow-hidden">
                                <a href="https://lh3.googleusercontent.com/d/${entregas[0].SoporteID}" target="_blank">
                                    <img src="https://lh3.googleusercontent.com/d/${entregas[0].SoporteID}" alt="Soporte" class="img-fluid w-100" />
                                </a>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('') + (hasMore ? '<div id="cardsSentinel" style="height: 20px;"></div>' : '');
    
    // Si hay centinela, observarlo
    if (hasMore) {
        setTimeout(observeSentinel, 100);
    }
}

function observeSentinel() {
    const sentinel = document.getElementById('cardsSentinel');
    if (!sentinel) return;
    
    if (cardsObserver) cardsObserver.disconnect();
    
    cardsObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            console.log('📸 Cargando más tarjetas...');
            cardsVisible += 20;
            renderizarTarjetas();
        }
    }, { threshold: 0.1 });
    
    cardsObserver.observe(sentinel);
}

function setupInfiniteScroll() {
    // Ya lo manejamos dentro de renderizarTarjetas con el centinela
}


// Event listener para botón flotante de filtros
$(document).ready(function() {
    $('#btnFiltrosMobile').on('click', function() {
        $('.filtros').toggleClass('filtros-visible');
    });
    
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.filtros, #btnFiltrosMobile').length) {
            $('.filtros').removeClass('filtros-visible');
        }
    });
});
