/* ==========================================================================
   sounds.js — Sistema de sonidos para notificaciones SISPRO
   - Sonidos MP3 para chat y cambio de estado
   - Sistema de desbloqueo de audio por interacción del usuario
   - Fallback a tonos sintetizados si los MP3 fallan
   - Toggle para activar/desactivar sonidos
   ========================================================================== */

const SOUND_PREFS_KEY = 'sispro_sound_prefs';

// Precarga de objetos de audio para mayor rapidez y resiliencia
const chatAudio = new Audio('sounds/chat.mp3');
const stateAudio = new Audio('sounds/estado.mp3');

// Configuración de precarga
chatAudio.load();
stateAudio.load();

// Estado del desbloqueo de audio (autoplay policy)
let _audioUnlocked = false;

/**
 * Intenta desbloquear el audio en la primera interacción del usuario.
 * Esto es necesario porque los navegadores bloquean audio automático.
 */
function _unlockAudio() {
    if (_audioUnlocked) return;
    
    // Intentar reproducir un silencio corto para validar el permiso
    const silentPlay = chatAudio.play();
    if (silentPlay !== undefined) {
        silentPlay.then(() => {
            chatAudio.pause();
            chatAudio.currentTime = 0;
            _audioUnlocked = true;
            console.log('[SOUND] Sistema de audio desbloqueado correctamente');
            
            // Limpiar listeners
            document.removeEventListener('click', _unlockAudio);
            document.removeEventListener('touchstart', _unlockAudio);
        }).catch(err => {
            console.info('[SOUND] Esperando interacción real para desbloqueo habitual:', err.name);
        });
    }
}

// Registrar listeners de desbloqueo
document.addEventListener('click', _unlockAudio, { once: false });
document.addEventListener('touchstart', _unlockAudio, { once: false });

/** Obtener preferencias de sonido */
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

/** Guardar preferencias de sonido */
function saveSoundPrefs(prefs) {
    localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
}

/** Sonido para notificaciones de chat */
function playChatSound() {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    
    try {
        chatAudio.volume = prefs.chatVolume;
        chatAudio.currentTime = 0;
        const playPromise = chatAudio.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => console.log('[SOUND] Chat sound played (MP3)'))
                .catch(e => {
                    console.warn('[SOUND] MP3 play failed, using fallback tone:', e.name);
                    _playSynthesizedTone(600, 800, 0.3, prefs.chatVolume);
                    _audioUnlocked = false;
                });
        }
    } catch (e) {
        console.warn('[SOUND] MP3 error, using fallback:', e);
        _playSynthesizedTone(600, 800, 0.3, prefs.chatVolume);
    }
}

/** Sonido para cambio de estado */
function playStateChangeSound() {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    
    try {
        stateAudio.volume = prefs.stateVolume;
        stateAudio.currentTime = 0;
        const playPromise = stateAudio.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => console.log('[SOUND] State sound played (MP3)'))
                .catch(e => {
                    console.warn('[SOUND] MP3 play failed, using fallback tone:', e.name);
                    _playSynthesizedTone(523, 659, 0.4, prefs.stateVolume, 'triangle');
                    _audioUnlocked = false;
                });
        }
    } catch (e) {
        console.warn('[SOUND] MP3 error, using fallback:', e);
        _playSynthesizedTone(523, 659, 0.4, prefs.stateVolume, 'triangle');
    }
}

/**
 * Generador de tonos sintéticos como fallback (basado en original/js/sounds.js)
 */
function _playSynthesizedTone(f1, f2, duration, volume, type = 'sine') {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(f1, ctx.currentTime);
        if (f2) osc.frequency.setValueAtTime(f2, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        console.error('[SOUND] Fallback tone failed:', e);
    }
}

/** Toggle de sonidos desde el sidebar */
function toggleSounds(enable) {
    const prefs = getSoundPrefs();
    prefs.enabled = enable;
    saveSoundPrefs(prefs);
    
    console.log('[SOUND] Sonidos', enable ? 'activados' : 'desactivados');
    
    // Intentar desbloquear forzosamente al hacer click en el toggle
    if (enable) {
        _unlockAudio();
        setTimeout(() => playChatSound(), 150);
    }
}
