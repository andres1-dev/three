/**
 * Script de emergencia para desregistrar Service Worker
 * Usar solo si el bucle persiste después de las correcciones
 * 
 * INSTRUCCIONES:
 * 1. Agregar <script src="js/unregister-sw.js"></script> al inicio de login.html
 * 2. Después de que usuarios actualicen una vez, puedes removerlo
 */

(async function unregisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                const success = await registration.unregister();
                console.log('[UNREGISTER] Service Worker eliminado:', success);
            }
            
            // Limpiar cachés del SW
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
                console.log('[UNREGISTER] Cachés limpiados:', cacheNames.length);
            }
        } catch (error) {
            console.error('[UNREGISTER] Error:', error);
        }
    }
})();
