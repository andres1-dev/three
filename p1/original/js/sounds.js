/* ==========================================================================
   sounds.js — Sistema de sonidos para notificaciones SISPRO
   - Sonidos diferentes para chat y cambio de estado
   - Toggle para activar/desactivar sonidos
   - Usa Web Audio API para generar tonos
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

// Sonido para notificaciones de chat (tono amigable y suave)
function playChatSound() {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        // Tono suave y amigable (dos notas ascendentes)
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(prefs.chatVolume, ctx.currentTime + 0.02);
        gainNode.gain.setValueAtTime(prefs.chatVolume, ctx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        
        console.log('[SOUND] Chat sound played');
    } catch (e) {
        console.warn('[SOUND] Error reproduciendo sonido de chat:', e);
    }
}

// Sonido para cambio de estado (tono más formal y distintivo)
function playStateChangeSound() {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Crear dos osciladores para un sonido más rico
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        // Tono distintivo (acorde)
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(523, ctx.currentTime); // C5
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659, ctx.currentTime); // E5
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(prefs.stateVolume, ctx.currentTime + 0.03);
        gainNode.gain.setValueAtTime(prefs.stateVolume, ctx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.4);
        osc2.stop(ctx.currentTime + 0.4);
        
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
