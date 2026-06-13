/* ==========================================================================
   sw.js — Service Worker BUSINT v7
   - CACHE INTELIGENTE basado en latencia
   - ALMACENAMIENTO PERSISTENTE para offline
   - REINTENTOS AUTOMÁTICOS
   ========================================================================== */

const SW_VERSION = 'busint-v7-smart-cache-persistence';

/* ══════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN
   ══════════════════════════════════════════════════════════════════════════ */
const CONFIG = {
  // Umbrales de latencia en ms
  LATENCY: {
    FAST: 100,      // < 100ms: usar caché agresivamente
    MEDIUM: 500,    // 100-500ms: usar caché moderadamente
    SLOW: 2000,     // 500-2000ms: usar caché solo para recursos estáticos
    VERY_SLOW: 5000 // > 2000ms: no usar caché, priorizar red
  },
  // URLs que siempre se cachearán (recursos estáticos)
  ALWAYS_CACHE: [
    /\.css$/,
    /\.js$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.svg$/,
    /\.woff$/,
    /\.woff2$/,
    /\.ttf$/,
    /\.eot$/
  ],
  // URLs que nunca se cachearán (API, datos dinámicos)
  NEVER_CACHE: [
    /supabase\.co/,
    /functions\.supabase\.co/,
    /api\//,
    /operations/
  ],
  // Nombre de IndexedDB
  DB_NAME: 'BusintOfflineDB',
  DB_VERSION: 1,
  // Intervalo de reintentos en ms
  RETRY_INTERVAL: 30000, // 30 segundos
  MAX_RETRIES: 5
};

/* ══════════════════════════════════════════════════════════════════════════
   ESTADO DE CONEXIÓN
   ══════════════════════════════════════════════════════════════════════════ */
let connectionState = {
  latency: null,
  isOnline: navigator.onLine,
  lastCheck: null,
  history: [] // Últimas 5 mediciones
};

/* ══════════════════════════════════════════════════════════════════════════
   INDEXEDDB - ALMACENAMIENTO PERSISTENTE
   ══════════════════════════════════════════════════════════════════════════ */
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store para payloads fallidos
      if (!db.objectStoreNames.contains('failedPayloads')) {
        const store = db.createObjectStore('failedPayloads', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('endpoint', 'endpoint', { unique: false });
      }
      
      // Store para caché inteligente
      if (!db.objectStoreNames.contains('smartCache')) {
        const store = db.createObjectStore('smartCache', { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('latency', 'latency', { unique: false });
      }
    };
  });
}

function saveFailedPayload(endpoint, payload, options = {}) {
  return new Promise((resolve, reject) => {
    if (!db) {
      openDB().then(() => saveFailedPayload(endpoint, payload, options).then(resolve).catch(reject));
      return;
    }
    
    const transaction = db.transaction(['failedPayloads'], 'readwrite');
    const store = transaction.objectStore('failedPayloads');
    
    const record = {
      endpoint,
      payload,
      options,
      timestamp: Date.now(),
      retries: 0
    };
    
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFailedPayloads() {
  return new Promise((resolve, reject) => {
    if (!db) {
      openDB().then(() => getFailedPayloads().then(resolve).catch(reject));
      return;
    }
    
    const transaction = db.transaction(['failedPayloads'], 'readonly');
    const store = transaction.objectStore('failedPayloads');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteFailedPayload(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      openDB().then(() => deleteFailedPayload(id).then(resolve).catch(reject));
      return;
    }
    
    const transaction = db.transaction(['failedPayloads'], 'readwrite');
    const store = transaction.objectStore('failedPayloads');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function saveToSmartCache(url, response, latency) {
  return new Promise((resolve, reject) => {
    if (!db) {
      openDB().then(() => saveToSmartCache(url, response, latency).then(resolve).catch(reject));
      return;
    }
    
    const transaction = db.transaction(['smartCache'], 'readwrite');
    const store = transaction.objectStore('smartCache');
    
    const record = {
      url,
      response: response,
      timestamp: Date.now(),
      latency
    };
    
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getFromSmartCache(url) {
  return new Promise((resolve, reject) => {
    if (!db) {
      openDB().then(() => getFromSmartCache(url).then(resolve).catch(reject));
      return;
    }
    
    const transaction = db.transaction(['smartCache'], 'readonly');
    const store = transaction.objectStore('smartCache');
    const request = store.get(url);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   MEDICIÓN DE LATENCIA
   ══════════════════════════════════════════════════════════════════════════ */
async function measureLatency() {
  const start = performance.now();
  
  try {
    // Usar una petición HEAD a un recurso pequeño y confiable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    await fetch(window.location.href, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const latency = performance.now() - start;
    
    // Actualizar historial
    connectionState.history.push(latency);
    if (connectionState.history.length > 5) {
      connectionState.history.shift();
    }
    
    // Calcular promedio
    const avgLatency = connectionState.history.reduce((a, b) => a + b, 0) / connectionState.history.length;
    connectionState.latency = avgLatency;
    connectionState.lastCheck = Date.now();
    
    return avgLatency;
  } catch (error) {
    connectionState.latency = Infinity;
    return Infinity;
  }
}

function shouldUseCache(url) {
  // Verificar si está en la lista de nunca cachear
  for (const pattern of CONFIG.NEVER_CACHE) {
    if (pattern.test(url)) return false;
  }
  
  // Verificar si está en la lista de siempre cachear
  for (const pattern of CONFIG.ALWAYS_CACHE) {
    if (pattern.test(url)) return true;
  }
  
  // Si no hay medición de latencia, no usar caché
  if (!connectionState.latency) return false;
  
  // Decidir basado en latencia
  if (connectionState.latency < CONFIG.LATENCY.FAST) {
    return true; // Conexión rápida, usar caché
  } else if (connectionState.latency < CONFIG.LATENCY.MEDIUM) {
    return true; // Conexión media, usar caché
  } else if (connectionState.latency < CONFIG.LATENCY.SLOW) {
    return false; // Conexión lenta, no usar caché
  } else {
    return false; // Conexión muy lenta, no usar caché
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RETRY DE PAYLOADS FALLIDOS
   ══════════════════════════════════════════════════════════════════════════ */
async function retryFailedPayloads() {
  if (!connectionState.isOnline || connectionState.latency === Infinity) {
    return;
  }
  
  try {
    const payloads = await getFailedPayloads();
    
    for (const record of payloads) {
      if (record.retries >= CONFIG.MAX_RETRIES) {
        continue;
      }
      
      try {
        const response = await fetch(record.endpoint, {
          ...record.options,
          body: JSON.stringify(record.payload)
        });
        
        if (response.ok) {
          await deleteFailedPayload(record.id);
        } else {
          record.retries++;
          await saveFailedPayload(record.endpoint, record.payload, record.options);
        }
      } catch (error) {
        record.retries++;
        await saveFailedPayload(record.endpoint, record.payload, record.options);
      }
    }
  } catch (error) {
    // Error al reintentar payloads
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      openDB(),
      self.skipWaiting()
    ])
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   ACTIVATE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Medir latencia inicial
      measureLatency(),
      // Reintentar payloads fallidos
      retryFailedPayloads(),
      // Limpiar cachés antiguos
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      // Tomar control inmediato
      self.clients.claim()
    ])
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   FETCH - CACHE INTELIGENTE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Si es una petición POST/PUT/DELETE (payloads)
  if (event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (!response.ok) {
            // Si falla, guardar el payload
            event.request.clone().json().then(payload => {
              saveFailedPayload(url, payload, {
                method: event.request.method,
                headers: Object.fromEntries(event.request.headers)
              });
            });
          }
          return response;
        })
        .catch(error => {
          // Guardar el payload para reintentar después
          event.request.clone().json().then(payload => {
            saveFailedPayload(url, payload, {
              method: event.request.method,
              headers: Object.fromEntries(event.request.headers)
            });
          });
          throw error;
        })
    );
    return;
  }
  
  // Para peticiones GET, usar caché inteligente
  if (shouldUseCache(url)) {
    event.respondWith(
      caches.open('smart-cache-v1').then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Si hay respuesta en caché y la conexión es lenta, usar caché
          if (cachedResponse && connectionState.latency > CONFIG.LATENCY.MEDIUM) {
            return cachedResponse;
          }
          
          // Si no hay caché o conexión es rápida, ir a la red
          return fetch(event.request).then(response => {
            // Si la respuesta es exitosa, guardar en caché
            if (response.ok) {
              cache.put(event.request, response.clone());
              saveToSmartCache(url, response.clone(), connectionState.latency);
            }
            return response;
          }).catch(async error => {
            // Si falla la red, intentar usar caché
            if (cachedResponse) {
              return cachedResponse;
            }
            throw error;
          });
        });
      })
    );
  } else {
    // No usar caché, ir directamente a la red
    event.respondWith(fetch(event.request));
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ONLINE/OFFLINE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('online', () => {
  connectionState.isOnline = true;
  measureLatency();
  retryFailedPayloads();
});

self.addEventListener('offline', () => {
  connectionState.isOnline = false;
  connectionState.latency = Infinity;
});

/* ══════════════════════════════════════════════════════════════════════════
   MENSAJES DESDE EL CLIENTE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
  const data = event.data;
  
  if (data.type === 'MEASURE_LATENCY') {
    measureLatency().then(latency => {
      event.ports[0].postMessage({ type: 'LATENCY_RESULT', latency });
    });
  }
  
  if (data.type === 'GET_FAILED_PAYLOADS') {
    getFailedPayloads().then(payloads => {
      event.ports[0].postMessage({ type: 'FAILED_PAYLOADS', payloads });
    });
  }
  
  if (data.type === 'RETRY_PAYLOADS') {
    retryFailedPayloads().then(() => {
      event.ports[0].postMessage({ type: 'RETRY_COMPLETE' });
    });
  }
  
  if (data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
      event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
self.addEventListener('message', async event => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
});

