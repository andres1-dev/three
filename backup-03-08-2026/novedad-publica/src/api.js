/* ==========================================================================
   api.js — Comunicación con Supabase (Novedad Pública)
   Depende de: config.js
   ========================================================================== */

/**
 * Busca una OP en la tabla CURVA.
 * Usa el token seguro si está configurado, si no usa Basic Auth de la anon key.
 */
async function np_buscarOP(op) {
    const token = NP_CONFIG.QUERY_TOKEN;
    const base  = NP_CONFIG.MAP_FUNCTIONS_URL;

    const url = token
        ? `${base}/query?table=CURVA&eq_op=${encodeURIComponent(op)}&token=${token}`
        : `${base}/query?table=CURVA&eq_op=${encodeURIComponent(op)}`;

    const headers = token ? {} : {
        'Authorization': `Bearer ${NP_CONFIG.MAP_ANON_KEY}`,
        'apikey':        NP_CONFIG.MAP_ANON_KEY,
    };

    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Error ${resp.status} al buscar OP`);
    return await resp.json();
}

/**
 * Obtiene datos de la planta (email) asociada a la OP.
 */
async function np_obtenerDatosPlanta(planta) {
    const token = NP_CONFIG.QUERY_TOKEN;
    const base  = NP_CONFIG.MAP_FUNCTIONS_URL;

    const url = token
        ? `${base}/query?table=PLANTAS&eq_PLANTA=${encodeURIComponent(planta)}&token=${token}`
        : `${base}/query?table=PLANTAS&eq_PLANTA=${encodeURIComponent(planta)}`;

    const headers = token ? {} : {
        'Authorization': `Bearer ${NP_CONFIG.MAP_ANON_KEY}`,
        'apikey':        NP_CONFIG.MAP_ANON_KEY,
    };

    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.[0] || null;
}

/**
 * Envía la novedad a la Edge Function operations del proyecto MAP.
 */
async function np_enviarNovedad(payload) {
    const resp = await fetch(`${NP_CONFIG.MAP_FUNCTIONS_URL}/operations`, {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey':       NP_CONFIG.MAP_ANON_KEY,
            'Authorization':`Bearer ${NP_CONFIG.MAP_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error ${resp.status}: ${txt}`);
    }
    return await resp.json();
}

/**
 * Sube imagen a Supabase Storage mediante la Edge Function upload-public-image.
 * Esta función es local a este módulo.
 */
async function np_uploadImagen(file) {
    const blob     = await np_compressImage(file);
    const base64   = await np_blobToBase64(blob);
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 40);

    const resp = await fetch(`${NP_CONFIG.MAP_FUNCTIONS_URL}/upload-public-image`, {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey':        NP_CONFIG.MAP_ANON_KEY,
            'Authorization': `Bearer ${NP_CONFIG.MAP_ANON_KEY}`,
        },
        body: JSON.stringify({ base64, mimeType: 'image/jpeg', fileName }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `Error ${resp.status}`);
    }

    const result = await resp.json();
    if (!result.success || !result.url) throw new Error(result.message || 'Error al subir imagen');
    return result.url;
}
