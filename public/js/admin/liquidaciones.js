/**
 * liquidaciones.js - Módulo de liquidaciones
 * Permite a admin/moderator ver y editar liquidaciones guardadas en Supabase
 */

let liquidacionesCache = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar permisos
    if (!window.currentUser || !['ADMIN', 'MODERATOR'].includes(window.currentUser.ROL)) {
        alert('No tienes permisos para acceder a este módulo.');
        window.location.href = 'index.html';
        return;
    }
    
    // Cargar lista de auditoras
    await cargarAuditoras();
    
    // Establecer rango de fechas predeterminado
    establecerRangoPredeterminado();
    
    // Cargar liquidaciones iniciales
    await buscarLiquidaciones();
});

/**
 * Carga la lista de auditoras desde los reportes
 */
async function cargarAuditoras() {
    try {
        const sb = getSupabaseClient();
        if (!sb) return;
        
        // Intentar obtener todas las columnas para ver qué existe
        const { data: reportes, error } = await sb
            .from('reportes')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error al cargar reportes:', error);
            return;
        }
        
        console.log('Estructura de reportes:', reportes);
        
        // Si hay datos, ver qué columnas existen
        if (reportes && reportes.length > 0) {
            const columnas = Object.keys(reportes[0]);
            console.log('Columnas disponibles:', columnas);
            
            // Buscar columna que pueda identificar al auditor
            const columnaAuditora = columnas.find(col => 
                col.toLowerCase() === 'email' || 
                col.toLowerCase() === 'correo' ||
                col.toLowerCase().includes('auditor')
            );
            
            console.log('Columna de auditora encontrada:', columnaAuditora);
            
            if (columnaAuditora) {
                // Cargar todos los reportes con esa columna
                const { data: todosReportes, error: error2 } = await sb
                    .from('reportes')
                    .select(columnaAuditora)
                    .not(columnaAuditora, 'is', null);
                
                if (error2) {
                    console.error('Error al cargar auditoras:', error2);
                    return;
                }
                
                // Obtener valores únicos
                const valoresUnicos = [...new Set(todosReportes.map(r => r[columnaAuditora]).filter(v => v))];
                
                // Llenar select
                const select = document.getElementById('auditoraFilter');
                valoresUnicos.forEach(valor => {
                    const option = document.createElement('option');
                    option.value = valor;
                    option.textContent = valor;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error al cargar auditoras:', error);
    }
}

/**
 * Establece el rango de fechas predeterminado según la fecha actual
 */
function establecerRangoPredeterminado() {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    
    // Establecer mes y año actual
    document.getElementById('mesFilter').value = mes;
    document.getElementById('anioFilter').value = anio;
}

/**
 * Busca liquidaciones guardadas en Supabase según los filtros seleccionados
 */
async function buscarLiquidaciones() {
    const correo = document.getElementById('auditoraFilter').value;
    const mes = parseInt(document.getElementById('mesFilter').value);
    const anio = parseInt(document.getElementById('anioFilter').value);
    const container = document.getElementById('liquidacionesList');
    
    console.log('Buscando liquidaciones con filtros:', { correo, mes, anio });
    console.log('Usuario actual:', window.currentUser);
    
    // Mostrar loading
    container.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Buscando liquidaciones...</p>
        </div>
    `;
    
    try {
        const sb = getSupabaseClient();
        if (!sb) {
            throw new Error('Supabase client no disponible');
        }
        
        // Intentar obtener todos los datos sin filtro primero para verificar permisos
        const { data: todosDatos, error: errorTodos } = await sb
            .from('liquidaciones_rodamiento')
            .select('*');
        
        if (errorTodos) {
            console.error('Error al obtener todos los datos de liquidaciones_rodamiento:', errorTodos);
            console.error('Detalles del error:', errorTodos.code, errorTodos.message, errorTodos.hint);
            throw new Error(`Error de permisos o RLS: ${errorTodos.message} (Código: ${errorTodos.code})`);
        }
        
        console.log('Todos los datos en liquidaciones_rodamiento:', todosDatos);
        
        if (!todosDatos || todosDatos.length === 0) {
            console.log('No hay datos en liquidaciones_rodamiento');
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>No hay liquidaciones guardadas en Supabase.</p>
                    <p style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;">
                        Si esperas ver datos, verifica las políticas RLS en Supabase.
                    </p>
                </div>
            `;
            return;
        }
        
        // Obtener estructura de la tabla
        const columnas = Object.keys(todosDatos[0]);
        console.log('Columnas disponibles en liquidaciones_rodamiento:', columnas);
        
        // Determinar qué columna usar para filtrar (correo o auditora)
        const columnaFiltro = columnas.find(col => 
            col.toLowerCase() === 'correo' || 
            col.toLowerCase() === 'email'
        ) || columnas.find(col => col.toLowerCase() === 'auditora');
        
        console.log('Columna de filtro encontrada:', columnaFiltro);
        
        // Filtrar datos client-side
        let liquidacionesFiltradas = todosDatos;
        
        if (correo && columnaFiltro) {
            liquidacionesFiltradas = todosDatos.filter(liq => 
                liq[columnaFiltro] === correo
            );
        }
        
        console.log('Liquidaciones filtradas:', liquidacionesFiltradas);
        
        // Renderizar resultados
        renderizarLiquidaciones(liquidacionesFiltradas, columnaFiltro || 'correo');
    } catch (error) {
        console.error('Error al buscar liquidaciones:', error);
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error al cargar liquidaciones: ${error.message}</p>
                <p style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;">
                    Verifica las políticas RLS en Supabase para la tabla liquidaciones_rodamiento.
                </p>
            </div>
        `;
    }
}

/**
 * Renderiza la lista de liquidaciones
 */
function renderizarLiquidaciones(liquidaciones, columnaFiltro = 'correo') {
    const container = document.getElementById('liquidacionesList');
    
    if (!liquidaciones || liquidaciones.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>No se encontraron liquidaciones guardadas para los filtros seleccionados.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = liquidaciones.map(liq => `
        <div class="liquidacion-card">
            <div class="card-header">
                <div>
                    <div class="card-title">${liq[columnaFiltro]}</div>
                    <div class="card-meta">
                        <div class="card-meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${liq.periodo}</span>
                        </div>
                        <div class="card-meta-item">
                            <i class="fas fa-id-card"></i>
                            <span>CC: ${liq.cc}</span>
                        </div>
                        ${liq.descuentos ? `
                        <div class="card-meta-item">
                            <i class="fas fa-minus-circle"></i>
                            <span>Descuentos: ${liq.descuentos}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-view" onclick="verLiquidacion('${liq.id}', '${liq[columnaFiltro]}', '${liq.periodo}', '${liq.descuentos || ''}')">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Redirige al módulo de liquidación con los datos pre-cargados
 */
function verLiquidacion(id, correo, periodo, descuentos) {
    // Pasar solo ID y admin=true por URL
    const params = new URLSearchParams();
    params.append('id', id);
    params.append('admin', 'true');
    
    // Redirigir al módulo de liquidación con parámetros en URL
    window.location.href = `liquidacion-rodamiento.html?${params.toString()}`;
}
