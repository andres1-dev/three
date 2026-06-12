/**
 * Módulo dedicado de plantillas de redacción premium para el reporte de Calidad.
 * Proporciona normalización de nombres de prendas y múltiples estilos de redacción analítica de nivel sénior.
 */

/**
 * Normaliza nombres de prendas de la base de datos (e.g., plurales o errores comunes)
 * a su formato singular y elegante en español.
 * Si el texto ingresa en mayúsculas, se normaliza.
 * @param {string} prenda 
 * @returns {string} prenda normalizada
 */
function normalizarPrenda(prenda) {
    if (!prenda) return "prenda no especificada";
    let p = prenda.trim().toLowerCase();

    // Diccionario de normalización para asegurar singular y ortografía correcta
    const normas = {
        'bodys': 'body',
        'body': 'body',
        'pantalones': 'pantalón',
        'pantalon': 'pantalón',
        'pantalón': 'pantalón',
        'croptops': 'croptop',
        'croptop': 'croptop',
        'camisetas': 'camiseta',
        'camiseta': 'camiseta',
        'blusas': 'blusa',
        'blusa': 'blusa',
        'faldas': 'falda',
        'falda': 'falda',
        'chaquetas': 'chaqueta',
        'chaqueta': 'chaqueta',
        'shorts': 'short',
        'short': 'short',
        'pantalonetas': 'pantaloneta',
        'pantaloneta': 'pantaloneta',
        'jeans': 'jean',
        'jean': 'jean',
        'enterizos': 'enterizo',
        'enterizo': 'enterizo',
        'buzos': 'buzo',
        'buzo': 'buzo',
        'vestidos': 'vestido',
        'vestido': 'vestido',
        'sacos': 'saco',
        'saco': 'saco',
        'leggings': 'legging',
        'legging': 'legging',
        'tops': 'top',
        'top': 'top',
        'camisas': 'camisa',
        'camisa': 'camisa',
        'overoles': 'overol',
        'overol': 'overol',
        'pajamas': 'pijama',
        'pijama': 'pijama',
        'pijamas': 'pijama'
    };

    if (normas[p]) return normas[p];

    // Fallback dinámico de singularización si termina en 's'
    if (p.endsWith('s') && p.length > 3) {
        if (p.endsWith('es') && !p.endsWith('les')) {
            return p.slice(0, -2);
        }
        return p.slice(0, -1);
    }

    return p;
}

/**
 * Normaliza y limpia el género, traduciendo "caballero" a "hombre"
 * y damas a dama para lograr coherencia lingüística natural.
 * @param {string} genero 
 * @returns {string} género normalizado
 */
function normalizarGenero(genero) {
    if (!genero) return "";
    let g = genero.trim().toLowerCase();

    if (g === 'caballero' || g === 'caballeros' || g === 'caballero.') {
        return 'hombre';
    }
    if (g === 'dama' || g === 'damas' || g === 'dama.') {
        return 'dama';
    }
    return g;
}

/**
 * Convierte un texto que esté completamente en mayúsculas a minúsculas
 * para que encaje perfectamente dentro de las oraciones en prosa.
 * @param {string} str 
 * @returns {string} texto limpio
 */
function toCleanText(str) {
    if (!str) return "";
    let s = str.trim();
    if (s === s.toUpperCase()) {
        s = s.toLowerCase();
    }
    return s;
}

/**
 * Convierte un nombre propio (como una planta) a formato Título (Title Case).
 * Ej: FLOY ELIZABETH -> Floy Elizabeth. Mantendrá CDI como está si es CDI.
 * @param {string} str 
 * @returns {string} texto en Title Case
 */
function toTitleCase(str) {
    if (!str) return "";
    const text = str.trim();
    if (text.toUpperCase() === 'CDI') return 'CDI';

    return text.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

/**
 * Normaliza nombres de procesos para que tengan tildes correctas y estén en minúscula.
 * @param {string} str 
 * @returns {string} texto normalizado
 */
function normalizarProcesoDestino(str) {
    if (!str) return "";
    const lower = str.trim().toLowerCase();
    const map = {
        'confeccion': 'confección',
        'ojal y boton': 'ojal y botón',
        'botonado': 'botonado',
        'transfer': 'transfer',
        'ojalete': 'ojalete',
        'aplique': 'aplique',
        'resortado': 'resortado',
        'fusionado': 'fusionado',
        'estampado': 'estampado'
    };
    return map[lower] || lower;
}

/**
 * Diccionario de plantillas de redacción premium organizadas por estilo técnico, visita y conclusión.
 * Todas las plantillas finalizan con un punto y una resolución completa para no requerir comentarios adicionales.
 * Son todas variaciones técnicas serias de la industria de la confección de prendas de vestir.
 */
const PLANTILLAS_CALIDAD = {
    ESTANDAR: {
        AUDITORIA: {
            APROBADO: {
                obs: "Se realiza auditoría de {proceso} aprobada para {prenda_genero}{tejido}, constatando plena conformidad con los estándares de calidad establecidos. Se aprueba la liberación del lote{destino}.",
                rec: "Con el fin de asegurar la mejora continua del lote, se recomienda que "
            },
            RECHAZADO: {
                obs: "Se realiza auditoría de {proceso} rechazada para {prenda_genero}{tejido}, identificándose desviaciones críticas frente a la ficha técnica que comprometen la calidad final del lote. Se exige suspender el proceso e intervenir de inmediato.",
                rec: "Para subsanar las desviaciones detectadas, se exige que "
            },
            DEFAULT: {
                obs: "Se realiza auditoría de {proceso} para {prenda_genero}{tejido}, revisando el cumplimiento de las especificaciones técnicas.",
                rec: "Se recomienda que "
            }
        },
        RONDA: {
            APROBADO: {
                obs: "Se realiza ronda de calidad para {prenda_genero}{tejido}{avance}, confirmando un desempeño conforme al estándar técnico establecido en la planta y garantizando la estabilidad operativa del lote{destino}.",
                rec: "Se sugiere que "
            },
            RECHAZADO: {
                obs: "Se realiza ronda de calidad para {prenda_genero}{tejido}{avance}, detectándose no conformidades repetitivas en la operación. Se requiere intervenir con carácter prioritario.",
                rec: "Se recomienda que "
            },
            DEFAULT: {
                obs: "Se realiza ronda de calidad para {prenda_genero}{tejido}{avance}, evaluando el flujo general de producción.",
                rec: "Se sugiere que "
            }
        },
        CONTRAMUESTRA: {
            APROBADO: {
                obs: "Se realiza aprobación de contramuestra para {prenda_genero}{tejido}{avance}, validando la simetría y el cumplimiento estricto de las especificaciones de la ficha técnica para dar inicio a la producción masiva{destino}.",
                rec: "Se recomienda que "
            },
            RECHAZADO: {
                obs: "Se realiza revisión de contramuestra para {prenda_genero}{tejido}{avance}, identificándose no conformidades técnicas que impiden la aprobación del lote piloto. Se solicita presentar un nuevo desarrollo.",
                rec: "Se sugiere que "
            },
            DEFAULT: {
                obs: "Se realiza revisión de contramuestra para {prenda_genero}{tejido}{avance}, evaluando parámetros dimensionales y de confección.",
                rec: "Se sugiere que "
            }
        },
        SEGUIMIENTO: {
            DEFAULT: {
                obs: "Se realiza visita de seguimiento para {prenda_genero}{tejido}, evaluando el estado de la línea y el cumplimiento de compromisos previos para asegurar el correcto flujo productivo.",
                rec: "Se sugiere que "
            }
        }
    },
    DETALLISTA: {
        AUDITORIA: {
            APROBADO: {
                obs: "Tras efectuar una minuciosa inspección física por muestreo en la línea de {proceso}, se aprueba el lote de {prenda_genero}{tejido}. La evaluación sensorial y dimensional demuestra alta regularidad en las operaciones, autorizando su posterior distribución{destino}.",
                rec: "A fin de prevenir variabilidades en la producción, se sugiere que "
            },
            RECHAZADO: {
                obs: "Luego de realizar un riguroso análisis técnico de la muestra representativa de {prenda_genero}{tejido} en el proceso de {proceso}, se dictamina el rechazo del lote al identificarse defectos que exceden la tolerancia admitida, requiriendo su retención preventiva.",
                rec: "Con el objeto de corregir el defecto físico reportado, se requiere que "
            },
            DEFAULT: {
                obs: "Llevado a cabo el peritaje técnico sobre el lote de {prenda_genero}{tejido} en el área de {proceso}, se efectúa el levantamiento de observaciones detalladas del producto.",
                rec: "Se sugiere que "
            }
        },
        RONDA: {
            APROBADO: {
                obs: "Se completa ronda de inspección visual sobre la producción en proceso de {prenda_genero}{tejido}{avance}. Los niveles de tensión de costura, simetría de piezas y alineación operativa demuestran pleno apego al estándar{destino}.",
                rec: "Se sugiere que "
            },
            RECHAZADO: {
                obs: "Se detectan fallas sistemáticas en la ronda de calidad realizada sobre el lote de {prenda_genero}{tejido}{avance}. La variabilidad observada en costuras y dimensiones compromete la homogeneidad del producto y exige corrección inmediata.",
                rec: "Se sugiere que "
            },
            DEFAULT: {
                obs: "Durante la ronda técnica en la línea de producción para {prenda_genero}{tejido}{avance}, se inspeccionan puntos críticos de control operativo.",
                rec: "Se sugiere que "
            }
        },
        CONTRAMUESTRA: {
            APROBADO: {
                obs: "Evaluada la contramuestra física de {prenda_genero}{tejido}{avance}, se determina su viabilidad técnica al cumplir satisfactoriamente con la caída del tejido, costuras de ensamble y dimensiones del diseño piloto{destino}.",
                rec: "Se sugiere que "
            },
            RECHAZADO: {
                obs: "Se rechaza la contramuestra de {prenda_genero}{tejido}{avance} tras evidenciar desviaciones críticas en moldes y tensiones clave. El espécimen no cumple con el estándar comercial exigido para producción.",
                rec: "Se sugiere que "
            },
            DEFAULT: {
                obs: "Realizado el examen microscópico y dimensional de la contramuestra piloto de {prenda_genero}{tejido}{avance}, se exponen las notas de desarrollo técnico.",
                rec: "Se sugiere que "
            }
        },
        SEGUIMIENTO: {
            DEFAULT: {
                obs: "En el desarrollo del seguimiento técnico al lote de {prenda_genero}{tejido}, se examina la evolución de los estándares y la implementación de las acciones correctivas reportadas, registrando conformidad en los avances.",
                rec: "Se sugiere que "
            }
        }
    },
    EJECUTIVO: {
        AUDITORIA: {
            APROBADO: {
                obs: "Se verifica conformidad en la auditoría de {proceso} para el lote de {prenda_genero}{tejido}. La inspección técnica confirma el estricto cumplimiento de tolerancias dimensionales y simetría de ensambles, autorizando su liberación{destino}.",
                rec: "Se recomienda que "
            },
            RECHAZADO: {
                obs: "Se reporta no conformidad en la auditoría de {proceso} para el lote de {prenda_genero}{tejido}. Las desviaciones técnicas detectadas comprometen la estabilidad estructural de la prenda y su salida al mercado.",
                rec: "Se solicita con carácter prioritario que "
            },
            DEFAULT: {
                obs: "Se ejecuta la auditoría de {proceso} en {prenda_genero}{tejido}, validando parámetros operacionales básicos frente a la ficha técnica.",
                rec: "Se recomienda que "
            }
        },
        RONDA: {
            APROBADO: {
                obs: "Se constata normalidad operativa en la ronda de calidad efectuada sobre {prenda_genero}{tejido}{avance}. Los parámetros de confección y calibración de maquinaria se mantienen dentro del rango técnico exigido para su liberación{destino}.",
                rec: "Se sugiere que "
            },
            RECHAZADO: {
                obs: "Se detecta desviación en los parámetros de calidad en la ronda realizada sobre {prenda_genero}{tejido}{avance}. Se requiere corrección técnica inmediata para evitar la generación de segundas en costuras críticas.",
                rec: "Se recomienda que "
            },
            DEFAULT: {
                obs: "Se realiza ronda de control de calidad sobre la línea de producción de {prenda_genero}{tejido}{avance}.",
                rec: "Se sugiere que "
            }
        },
        CONTRAMUESTRA: {
            APROBADO: {
                obs: "Se otorga viabilidad a la contramuestra de {prenda_genero}{tejido}{avance} tras verificar el perfecto ensamble y correspondencia de patrones y moldes según la ficha técnica, autorizando el inicio del lote masivo{destino}.",
                rec: "Se recomienda que "
            },
            RECHAZADO: {
                obs: "Se niega la viabilidad de la contramuestra de {prenda_genero}{tejido}{avance} por no superar las pruebas físicas de tensión y caída de tejido, requiriéndose un nuevo ensamble de muestra.",
                rec: "Se recomienda que "
            },
            DEFAULT: {
                obs: "Se somete a evaluación técnica la contramuestra piloto de {prenda_genero}{tejido}{avance}.",
                rec: "Se sugiere que "
            }
        },
        SEGUIMIENTO: {
            DEFAULT: {
                obs: "Se ejecuta la revisión técnica de seguimiento al lote de {prenda_genero}{tejido}, verificando el control de calidad aplicado y garantizando la homogeneidad física del producto.",
                rec: "Se recomienda que "
            }
        }
    },
    MEJORA: {
        AUDITORIA: {
            APROBADO: {
                obs: "Se aprueba la auditoría de {proceso} para {prenda_genero}{tejido} bajo parámetros de control preventivo, confirmando que las operaciones mantienen un nivel estable y libre de defectos críticos, dando vía libre al lote{destino}.",
                rec: "Con un enfoque preventivo de calidad total, se aconseja que "
            },
            RECHAZADO: {
                obs: "Se suspende la liberación de {prenda_genero}{tejido} en el proceso de {proceso} de forma preventiva. Se requiere corregir desviaciones operativas para asegurar el cumplimiento del estándar de calidad técnica.",
                rec: "Con el fin de blindar el proceso ante futuras no conformidades, se solicita que "
            },
            DEFAULT: {
                obs: "Se realiza auditoría preventiva de {proceso} sobre el lote de {prenda_genero}{tejido} para blindar el flujo de confección.",
                rec: "Se aconseja que "
            }
        },
        RONDA: {
            APROBADO: {
                obs: "La ronda de monitoreo preventivo en {prenda_genero}{tejido}{avance} ratifica la uniformidad del lote y la correcta aplicación del estándar operacional establecido para su liberación{destino}.",
                rec: "Se sugiere que "
            },
            RECHAZADO: {
                obs: "Se identifican puntos de riesgo operacional durante la ronda en {prenda_genero}{tejido}{avance}. Se solicita un reajuste inmediato en la maquinaria de confección para mitigar defectos repetitivos.",
                rec: "Se recomienda que "
            },
            DEFAULT: {
                obs: "Se ejecuta ronda de inspección técnica en {prenda_genero}{tejido}{avance} para control preventivo de fallas de aguja y costura.",
                rec: "Se sugiere que "
            }
        },
        CONTRAMUESTRA: {
            APROBADO: {
                obs: "Aprobación técnica de contramuestra para {prenda_genero}{tejido}{avance} emitida con éxito, validando preventivamente los márgenes de costura y la caída de tejido antes del tendido para su liberación{destino}.",
                rec: "Se recomienda que "
            },
            RECHAZADO: {
                obs: "Se retiene la aprobación de contramuestra para {prenda_genero}{tejido}{avance} para prevenir desviaciones en producción masiva. Se requiere ajustar tensiones y márgenes de armado.",
                rec: "Se recomienda que "
            },
            DEFAULT: {
                obs: "Se analiza preventivamente el armado físico de la contramuestra de {prenda_genero}{tejido}{avance}.",
                rec: "Se sugiere que "
            }
        },
        SEGUIMIENTO: {
            DEFAULT: {
                obs: "Se realiza el seguimiento preventivo al lote de {prenda_genero}{tejido}, auditando los puntos de control clave para blindar el flujo de confección contra no conformidades.",
                rec: "Se recomienda que "
            }
        }
    }
};

/**
 * Genera el texto premium de introducción estructurada basado en los datos del formulario y el estilo de redacción elegido.
 * @param {Object} datos 
 * @param {string} datos.tipo - tipo de visita (AUDITORIA, RONDA, CONTRAMUESTRA, SEGUIMIENTO)
 * @param {string} datos.conclusion - APROBADO, RECHAZADO o vacío
 * @param {string} datos.prenda - prenda original
 * @param {string} datos.genero - género original
 * @param {string} datos.tejido - tejido original
 * @param {string} datos.proceso - proceso actual (confección, terminación, corte)
 * @param {number|string} datos.avance - avance en producción (0-100)
 * @param {string} datos.destino - destino final del lote (si es APROBADO)
 * @param {string} estilo - estilo de redacción (ESTANDAR, DETALLISTA, EJECUTIVO, MEJORA)
 * @param {string} conectorTexto - texto literal a anexar al final (ej. "Se sugiere que ")
 * @returns {string} texto base estructurado listo
 */
function generarRedaccionPlantilla(datos, estilo = 'ESTANDAR', conectorTexto = '') {
    const estiloElegido = PLANTILLAS_CALIDAD[estilo] ? estilo : 'ESTANDAR';
    const plantillasEstilo = PLANTILLAS_CALIDAD[estiloElegido];

    const tipo = (datos.tipo || 'AUDITORIA').toUpperCase();
    const conclusion = (datos.conclusion || '').toUpperCase();

    // Normalizar forzosamente a minúsculas para coherencia sintáctica dentro de la prosa
    const procesoRaw = (datos.proceso || 'confección').trim().toLowerCase();
    const prendaRaw = (datos.prenda || '').trim().toLowerCase();
    const generoRaw = (datos.genero || '').trim().toLowerCase();
    const tejidoRaw = (datos.tejido || '').trim().toLowerCase();

    // Normalizar prenda y género
    const prendaNorm = normalizarPrenda(prendaRaw);
    const generoNorm = normalizarGenero(generoRaw);

    let prendaGeneroText = prendaNorm;
    if (generoNorm && generoNorm !== 'no especificado' && generoNorm !== 'no especificada') {
        prendaGeneroText += ` ${generoNorm}`;
    }

    // Formatear tejido
    let tejidoText = "";
    const hasTejido = tejidoRaw && !['--', 'n/a', 'na', 'no especificado', 'no especificada', 'no', 'no especificado.', 'no especificada.'].includes(tejidoRaw);
    if (hasTejido) {
        if (tejidoRaw.startsWith('tejido')) {
            tejidoText = ` en ${tejidoRaw}`;
        } else {
            tejidoText = ` en tejido ${tejidoRaw}`;
        }
    }

    // Formatear avance
    const avanceVal = parseInt(datos.avance) || 0;
    let avanceText = "";
    if ((tipo === 'RONDA' || tipo === 'CONTRAMUESTRA') && avanceVal > 0) {
        if (estiloElegido === 'DETALLISTA') {
            avanceText = `, evidenciando un avance técnico del ${avanceVal}%`;
        } else if (estiloElegido === 'EJECUTIVO') {
            avanceText = ` (avance: ${avanceVal}%)`;
        } else {
            avanceText = `, evidenciando un avance del ${avanceVal}% en la producción`;
        }
    }

    // Formatear destino de liberación
    let destinoText = "";
    if (tipo === 'AUDITORIA' && conclusion === 'APROBADO' && datos.destinoTipo) {
        if (datos.destinoTipo === 'CDI') {
            destinoText = ` con destino a CDI`;
        } else if (datos.destinoTipo === 'PROCESO' && datos.destinoProceso) {
            const destProc = normalizarProcesoDestino(datos.destinoProceso);
            let destStr = ` con destino al proceso de ${destProc}`;

            if (datos.destinoPlanta) {
                const destPlan = toTitleCase(datos.destinoPlanta);
                destStr += ` en ${destPlan}`;
            }

            destinoText = destStr;
        }
    }

    // Buscar la plantilla específica
    let plantillaObj = null;
    const tipoObj = plantillasEstilo[tipo];

    if (tipoObj) {
        if (tipo === 'SEGUIMIENTO') {
            plantillaObj = tipoObj.DEFAULT;
        } else {
            plantillaObj = tipoObj[conclusion] || tipoObj.DEFAULT;
        }
    }

    if (!plantillaObj) {
        return "Se realiza reporte de calidad.";
    }

    let plantillaStr = "";
    if (conectorTexto && conectorTexto.trim() !== '') {
        plantillaStr = plantillaObj.obs + " " + conectorTexto;
    } else {
        plantillaStr = plantillaObj.obs;
    }

    // Reemplazar los marcadores de posición
    let resultado = plantillaStr
        .replace('{proceso}', procesoRaw)
        .replace('{prenda_genero}', prendaGeneroText)
        .replace('{tejido}', tejidoText)
        .replace('{avance}', avanceText)
        .replace('{destino}', destinoText);

    // Forzar que el texto comience formalmente con mayúscula
    if (resultado) {
        resultado = resultado.trim();
        resultado = resultado.charAt(0).toUpperCase() + resultado.slice(1);
    }

    return resultado;
}
