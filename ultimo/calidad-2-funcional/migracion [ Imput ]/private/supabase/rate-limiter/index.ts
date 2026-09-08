/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RATE LIMITER - Módulo Centralizado de Rate Limiting
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Sistema de rate limiting robusto para Edge Functions con:
 * - Múltiples ventanas de tiempo (segundo, minuto, hora, día)
 * - Diferentes perfiles según criticidad del endpoint
 * - Almacenamiento en memoria (suficiente para Edge Functions)
 * - Limpieza automática de registros expirados
 * - Headers informativos (X-RateLimit-*)
 * 
 * PERFILES DISPONIBLES:
 * - STRICT: Endpoints de escritura críticos (auth, operaciones sensibles)
 * - MODERATE: Endpoints de escritura normales (crear novedades, uploads)
 * - RELAXED: Endpoints de lectura (consultas, búsquedas)
 * - REALTIME: Endpoints de tiempo real (chat, notificaciones)
 * 
 * @version 1.0.0
 * @author Sistema de Auditoría Técnica
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
    maxRequestsPerSecond?: number;
    maxRequestsPerMinute?: number;
    maxRequestsPerHour?: number;
    maxRequestsPerDay?: number;
}

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    reset: number; // timestamp en milisegundos
    retryAfter?: number; // segundos hasta que pueda reintentar
}

interface RateLimitRecord {
    second: { count: number; resetTime: number };
    minute: { count: number; resetTime: number };
    hour: { count: number; resetTime: number };
    day: { count: number; resetTime: number };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFILES PREDEFINIDOS
// ═══════════════════════════════════════════════════════════════════════════

export const RATE_LIMIT_PROFILES = {
    // Endpoints de autenticación y operaciones críticas de escritura
    STRICT: {
        maxRequestsPerSecond: 2,
        maxRequestsPerMinute: 10,
        maxRequestsPerHour: 50,
        maxRequestsPerDay: 200
    },
    
    // Endpoints de escritura normales (crear novedades, uploads)
    MODERATE: {
        maxRequestsPerSecond: 5,
        maxRequestsPerMinute: 30,
        maxRequestsPerHour: 100,
        maxRequestsPerDay: 500
    },
    
    // Endpoints de lectura y consultas
    RELAXED: {
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 100,
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 5000
    },
    
    // Endpoints de tiempo real (chat, realtime features)
    REALTIME: {
        maxRequestsPerSecond: 20,
        maxRequestsPerMinute: 200,
        maxRequestsPerHour: 2000,
        maxRequestsPerDay: 10000
    }
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ALMACENAMIENTO EN MEMORIA
// ═══════════════════════════════════════════════════════════════════════════

// Map para almacenar contadores por IP
const rateLimitStore = new Map<string, RateLimitRecord>();

// Intervalo de limpieza automática (cada 5 minutos)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Última limpieza
let lastCleanup = Date.now();

/**
 * Limpia registros expirados del store
 */
function cleanupExpiredRecords() {
    const now = Date.now();
    
    // Solo limpiar cada CLEANUP_INTERVAL
    if (now - lastCleanup < CLEANUP_INTERVAL) {
        return;
    }
    
    let cleaned = 0;
    
    for (const [ip, record] of rateLimitStore.entries()) {
        // Si todos los contadores están expirados, eliminar el registro
        if (
            now > record.second.resetTime &&
            now > record.minute.resetTime &&
            now > record.hour.resetTime &&
            now > record.day.resetTime
        ) {
            rateLimitStore.delete(ip);
            cleaned++;
        }
    }
    
    lastCleanup = now;
    
    if (cleaned > 0) {
        console.log(`[RATE_LIMIT] Limpiados ${cleaned} registros expirados`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae la IP del cliente desde los headers del request
 */
export function getClientIP(req: Request): string {
    // Prioridad de headers para obtener IP real
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip'); // Cloudflare
    
    if (cfConnectingIp) return cfConnectingIp;
    if (forwardedFor) return forwardedFor.split(',')[0].trim();
    if (realIp) return realIp;
    
    return 'unknown';
}

/**
 * Inicializa un nuevo registro de rate limit
 */
function initializeRecord(now: number): RateLimitRecord {
    return {
        second: { count: 0, resetTime: now + 1000 },
        minute: { count: 0, resetTime: now + 60000 },
        hour: { count: 0, resetTime: now + 3600000 },
        day: { count: 0, resetTime: now + 86400000 }
    };
}

/**
 * Verifica y aplica rate limiting
 * 
 * @param ip - IP del cliente
 * @param config - Configuración de límites
 * @returns Resultado del rate limit
 */
export function checkRateLimit(
    ip: string,
    config: RateLimitConfig = RATE_LIMIT_PROFILES.MODERATE
): RateLimitResult {
    // Limpieza periódica
    cleanupExpiredRecords();
    
    const now = Date.now();
    
    // Obtener o crear registro
    let record = rateLimitStore.get(ip);
    if (!record) {
        record = initializeRecord(now);
        rateLimitStore.set(ip, record);
    }
    
    // Resetear contadores expirados
    if (now > record.second.resetTime) {
        record.second = { count: 0, resetTime: now + 1000 };
    }
    if (now > record.minute.resetTime) {
        record.minute = { count: 0, resetTime: now + 60000 };
    }
    if (now > record.hour.resetTime) {
        record.hour = { count: 0, resetTime: now + 3600000 };
    }
    if (now > record.day.resetTime) {
        record.day = { count: 0, resetTime: now + 86400000 };
    }
    
    // Verificar límites en orden de menor a mayor ventana
    // (el más restrictivo gana)
    
    // Verificar límite por segundo
    if (config.maxRequestsPerSecond && record.second.count >= config.maxRequestsPerSecond) {
        return {
            allowed: false,
            limit: config.maxRequestsPerSecond,
            remaining: 0,
            reset: record.second.resetTime,
            retryAfter: Math.ceil((record.second.resetTime - now) / 1000)
        };
    }
    
    // Verificar límite por minuto
    if (config.maxRequestsPerMinute && record.minute.count >= config.maxRequestsPerMinute) {
        return {
            allowed: false,
            limit: config.maxRequestsPerMinute,
            remaining: 0,
            reset: record.minute.resetTime,
            retryAfter: Math.ceil((record.minute.resetTime - now) / 1000)
        };
    }
    
    // Verificar límite por hora
    if (config.maxRequestsPerHour && record.hour.count >= config.maxRequestsPerHour) {
        return {
            allowed: false,
            limit: config.maxRequestsPerHour,
            remaining: 0,
            reset: record.hour.resetTime,
            retryAfter: Math.ceil((record.hour.resetTime - now) / 1000)
        };
    }
    
    // Verificar límite por día
    if (config.maxRequestsPerDay && record.day.count >= config.maxRequestsPerDay) {
        return {
            allowed: false,
            limit: config.maxRequestsPerDay,
            remaining: 0,
            reset: record.day.resetTime,
            retryAfter: Math.ceil((record.day.resetTime - now) / 1000)
        };
    }
    
    // Incrementar contadores
    record.second.count++;
    record.minute.count++;
    record.hour.count++;
    record.day.count++;
    
    // Calcular remaining basado en el límite más restrictivo activo
    const limits = [
        config.maxRequestsPerSecond ? { max: config.maxRequestsPerSecond, current: record.second.count, reset: record.second.resetTime } : null,
        config.maxRequestsPerMinute ? { max: config.maxRequestsPerMinute, current: record.minute.count, reset: record.minute.resetTime } : null,
        config.maxRequestsPerHour ? { max: config.maxRequestsPerHour, current: record.hour.count, reset: record.hour.resetTime } : null,
        config.maxRequestsPerDay ? { max: config.maxRequestsPerDay, current: record.day.count, reset: record.day.resetTime } : null,
    ].filter(Boolean);
    
    // Usar el minuto como referencia principal (más común)
    const referenceLimit = limits.find(l => l && config.maxRequestsPerMinute) || limits[0];
    
    return {
        allowed: true,
        limit: referenceLimit?.max || 0,
        remaining: Math.max(0, (referenceLimit?.max || 0) - (referenceLimit?.current || 0)),
        reset: referenceLimit?.reset || now + 60000
    };
}

/**
 * Genera headers HTTP de rate limiting para incluir en las respuestas
 * 
 * @param result - Resultado del rate limit
 * @returns Headers para agregar a la Response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.reset / 1000)) // Unix timestamp
    };
    
    if (!result.allowed && result.retryAfter) {
        headers['Retry-After'] = String(result.retryAfter);
    }
    
    return headers;
}

/**
 * Crea una respuesta 429 Too Many Requests con información útil
 * 
 * @param result - Resultado del rate limit
 * @param corsHeaders - Headers CORS a incluir
 * @returns Response 429
 */
export function createRateLimitResponse(
    result: RateLimitResult,
    corsHeaders: Record<string, string> = {}
): Response {
    const rateLimitHeaders = getRateLimitHeaders(result);
    
    return new Response(
        JSON.stringify({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: `Límite de solicitudes excedido. Intente nuevamente en ${result.retryAfter} segundos.`,
            limit: result.limit,
            remaining: result.remaining,
            resetAt: new Date(result.reset).toISOString(),
            retryAfter: result.retryAfter
        }),
        {
            status: 429,
            headers: {
                ...corsHeaders,
                ...rateLimitHeaders,
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Middleware helper para aplicar rate limiting fácilmente
 * 
 * @example
 * const rateLimitResult = applyRateLimit(req, RATE_LIMIT_PROFILES.MODERATE);
 * if (!rateLimitResult.allowed) {
 *     return createRateLimitResponse(rateLimitResult, corsHeaders);
 * }
 */
export function applyRateLimit(
    req: Request,
    config: RateLimitConfig = RATE_LIMIT_PROFILES.MODERATE
): RateLimitResult {
    const ip = getClientIP(req);
    return checkRateLimit(ip, config);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES DE DEBUGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene estadísticas del rate limiter (útil para debugging)
 */
export function getRateLimitStats() {
    return {
        totalIPs: rateLimitStore.size,
        lastCleanup: new Date(lastCleanup).toISOString(),
        memoryUsage: rateLimitStore.size * 200 // aproximado en bytes
    };
}

/**
 * Resetea el rate limit para una IP específica (útil para testing)
 * ⚠️ Solo usar en desarrollo/testing
 */
export function resetRateLimitForIP(ip: string): boolean {
    return rateLimitStore.delete(ip);
}

/**
 * Limpia todo el store de rate limiting (útil para testing)
 * ⚠️ Solo usar en desarrollo/testing
 */
export function clearAllRateLimits(): void {
    rateLimitStore.clear();
    console.log('[RATE_LIMIT] Store limpiado completamente');
}
