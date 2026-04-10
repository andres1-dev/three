/* ==========================================================================
   sounds.js — Sistema de sonidos para notificaciones SISPRO
   - Sonidos diferentes para chat y cambio de estado
   - Toggle para activar/desactivar sonidos
   - Usa archivos MP3 de la carpeta sounds
   ========================================================================== */

const SOUND_PREFS_KEY = 'sispro_sound_prefs';

// Obtener preferencias de sonido
function getSoundPrefs() {
    try {
        const prefs = JSON.parse(localStorage.getItem(SOUND_PREFS_KEY) || '{}');
        return {
            enabled: prefs.enabled !== false, // Por defecto activado
            chatVolume: prefs.chatVolume || 0.6,
            stateVolume: prefs.stateVolume || 0.5
        };
    } catch (e) {
        return { enabled: true, chatVolume: 0.6, stateVolume: 0.5 };
    }
}

// Guardar preferencias de sonido
function saveSoundPrefs(prefs) {
    localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
}

// Sonido para notificaciones de chat
function playChatSound() {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    
    try {
        const audio = new Audio('sounds/chat.mp3');
        audio.volume = prefs.chatVolume;
        audio.play().catch(e => console.warn('[SOUND] Audio play failed (interact first?):', e));
        console.log('[SOUND] Chat sound played');
    } catch (e) {
        console.warn('[SOUND] Error reproduciendo sonido de chat:', e);
    }
}

// Sonido para cambio de estado
function playStateChangeSound() {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    
    try {
        const audio = new Audio('sounds/estado.mp3');
        audio.volume = prefs.stateVolume;
        audio.play().catch(e => console.warn('[SOUND] Audio play failed (interact first?):', e));
        console.log('[SOUND] State change sound played');
    } catch (e) {
        console.warn('[SOUND] Error reproduciendo sonido de estado:', e);
    }
}

// Toggle de sonidos desde el sidebar
function toggleSounds(enable) {
    const prefs = getSoundPrefs();
    prefs.enabled = enable;
    saveSoundPrefs(prefs);
    
    console.log('[SOUND] Sonidos', enable ? 'activados' : 'desactivados');
    
    // Reproducir sonido de prueba si se activa
    if (enable) {
        setTimeout(() => playChatSound(), 100);
    }
}
