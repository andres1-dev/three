/**
 * Utilidad para generar el mensaje formateado de WhatsApp
 * para los reportes de calidad con toda la información operativa útil.
 */

/**
 * Parsea una fecha en múltiples formatos (ISO, DD/MM/YYYY, Timestamp)
 */
function parsearFecha(fechaStr) {
    if (!fechaStr) return null;
    if (fechaStr instanceof Date && !isNaN(fechaStr.getTime())) return fechaStr;

    const s = String(fechaStr).trim();
    if (!s) return null;

    // DD/MM/YYYY o DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        const dia = parseInt(dmy[1], 10);
        const mes = parseInt(dmy[2], 10) - 1;
        const anio = parseInt(dmy[3], 10);
        const d = new Date(anio, mes, dia);
        if (!isNaN(d.getTime())) return d;
    }

    // YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
        const anio = parseInt(ymd[1], 10);
        const mes = parseInt(ymd[2], 10) - 1;
        const dia = parseInt(ymd[3], 10);
        const d = new Date(anio, mes, dia);
        if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formatea fecha en formato largo legible en español
 * Ejemplo: "Viernes, 11 de septiembre de 2026"
 */
function formatearFechaLarga(fechaStr) {
    const d = parsearFecha(fechaStr);
    if (!d) return String(fechaStr || 'N/A');

    try {
        const formatted = d.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (_) {
        return String(fechaStr);
    }
}

/**
 * Limpia y normaliza el número de teléfono para Colombia (prefijo 57)
 */
export function normalizarTelefonoColombia(telefono) {
    if (!telefono) return '';
    let clean = String(telefono).replace(/[\s\-\(\)\+\.]/g, '');
    if (!clean) return '';
    // Si tiene 10 dígitos y empieza por 3 (ej: 3168007979), agregar prefijo 57
    if (clean.length === 10 && clean.startsWith('3')) {
        clean = '57' + clean;
    }
    return clean;
}

/**
 * Genera el enlace wa.me para abrir en navegador o app
 */
export function generarUrlWhatsApp(telefono, mensaje) {
    const cleanPhone = normalizarTelefonoColombia(telefono);
    const encoded = encodeURIComponent(mensaje);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Construye el mensaje completo enriquecido para WhatsApp
 */
export function generarMensajeWhatsAppCalidad(reporte) {
    if (!reporte) return '';

    // Normalizar objeto tolerando mayúsculas/minúsculas
    const r = {};
    for (const k in reporte) {
        if (Object.prototype.hasOwnProperty.call(reporte, k)) {
            r[k.toLowerCase()] = reporte[k];
        }
    }

    const radicado = r.id_reporte || r.id || r.id_lote || 'S/N';
    const tallerNombre = (r.planta || r.nombre_planta || r.productora || 'TALLER DE CONFECCIÓN').trim().toUpperCase();
    const fechaLarga = formatearFechaLarga(r.fecha);

    const conclusion = (r.conclusion || 'PENDIENTE').trim().toUpperCase();
    const proceso = (r.proceso || 'N/A').trim().toUpperCase();
    const referencia = r.referencia || 'N/A';
    const lote = r.op || r.lote || r.id || 'N/A';
    const cantidad = r.cantidad || r.cant || r.qty || '0';

    // Línea / Prenda / Género
    const lineaPrendaPartes = [];
    if (r.linea && r.linea !== 'N/A') lineaPrendaPartes.push(r.linea);
    if (r.prenda && r.prenda !== 'N/A') lineaPrendaPartes.push(r.prenda);
    if (r.genero && r.genero !== 'N/A') lineaPrendaPartes.push(r.genero);
    const lineaPrenda = lineaPrendaPartes.join(' • ');

    // Avance
    const avance = r.avance || r.etapa;

    // Destino y Lugar
    const destino = r.destino_proceso && r.destino_proceso !== 'N/A' ? r.destino_proceso.toUpperCase() : null;
    let lugar = r.destino_planta && r.destino_planta !== 'N/A' ? r.destino_planta.toUpperCase() : null;
    if (lugar === 'CDI') lugar = 'CDI (CENTRO DE DISTRIBUCIÓN)';

    // Fechas de despacho y entrega
    const fechaSalida = r.fecha_salida || r.fecha_despacho;
    const fechaEntrega = r.fecha_entrega;

    // Encabezado
    let msg = '*REPORTE DE AUDITORÍA DE CALIDAD*\n';
    msg += `*\`${tallerNombre}\`*\n`;
    msg += `*${fechaLarga}*\n\n`;

    // Conclusión
    msg += '*Conclusión:*\n';
    msg += `> *${conclusion}*\n\n`;

    // Información Operativa Completa
    msg += `*Radicado:* #${radicado}\n`;
    msg += `*OP / Lote:* ${lote}\n`;
    msg += `*Referencia:* ${referencia}\n`;
    msg += `*Proceso:* ${proceso}\n`;
    msg += `*Cantidad Auditada:* ${cantidad} unds.\n`;

    if (lineaPrenda) {
        msg += `*Prenda / Línea:* ${lineaPrenda}\n`;
    }
    if (avance && avance !== 'N/A') {
        msg += `*Avance:* ${avance}%\n`;
    }
    if (destino) {
        msg += `*Destino:* ${destino}\n`;
    }
    if (lugar) {
        msg += `*Lugar:* ${lugar}\n`;
    }
    if (fechaSalida && fechaSalida !== 'N/A') {
        msg += `*Fecha Salida / Despacho:* ${fechaSalida}\n`;
    }
    if (fechaEntrega && fechaEntrega !== 'N/A') {
        msg += `*Fecha de Entrega:* ${fechaEntrega}\n`;
    }

    msg += '\n';

    // Hallazgos Cuantitativos Tabulados
    const novedadesRaw = r.novedades_auditoria || r.novedades;
    if (novedadesRaw) {
        try {
            let novedades = novedadesRaw;
            if (typeof novedades === 'string') {
                try { novedades = JSON.parse(novedades); } catch (_) {}
            }
            if (typeof novedades === 'string') {
                try { novedades = JSON.parse(novedades); } catch (_) {}
            }

            if (Array.isArray(novedades) && novedades.length > 0) {
                msg += '*HALLAZGOS CUANTITATIVOS:*\n\n';

                novedades.forEach((nov, idx) => {
                    const codigos = Array.isArray(nov.codigos) ? nov.codigos : [];
                    const totalUnds = codigos.reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);
                    const tipoTitulo = (nov.tipo || 'DEFECTO').toUpperCase();

                    msg += `*${idx + 1}. ${tipoTitulo}* *(${totalUnds} unds.)*\n`;

                    if (codigos.length > 0) {
                        const maxTalla = Math.max(5, ...codigos.map(c => String(c.talla || '-').length));
                        const maxColor = Math.max(5, ...codigos.map(c => String(c.color || '-').length));

                        // Cabecera de la tabla monospace
                        const hTalla = 'TALLA'.padEnd(maxTalla, ' ');
                        const hColor = 'COLOR'.padEnd(maxColor, ' ');
                        msg += `\`${hTalla} | ${hColor} | CANT\`\n`;

                        codigos.forEach(c => {
                            const talla = String(c.talla || '-').padEnd(maxTalla, ' ');
                            const color = String(c.color || '-').padEnd(maxColor, ' ');
                            const cant  = String(c.cantidad || '0');
                            msg += `\`${talla} | ${color} | ${cant}\`\n`;
                        });
                    }
                    msg += '\n';
                });
            }
        } catch (e) {
            console.error('[generarMensajeWhatsAppCalidad] Error parseando novedades:', e);
        }
    }

    // Observaciones Generales
    const observaciones = (r.observaciones || r.comentarios || '').trim();
    msg += '*OBSERVACIONES GENERALES:*\n';
    if (observaciones) {
        msg += `_${observaciones}_\n\n`;
    } else {
        msg += '_Sin observaciones adicionales registradas._\n\n';
    }

    // Auditor
    const auditorNombre = r.auditor || r.auditor_nombre || r.auditor_nombre_completo;
    const auditorCedula = r.auditor_cedula || r.cedula_auditor;
    if (auditorNombre) {
        msg += `*Auditor:* ${auditorNombre}${auditorCedula ? ` (${auditorCedula})` : ''}\n`;
    }

    return msg;
}
