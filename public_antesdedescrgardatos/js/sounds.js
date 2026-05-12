/* ==========================================================================
   sounds.js — Sistema de sonidos para notificaciones SISPRO
   - Usa HTMLAudioElement con configuración para evitar reproductores nativos
   - Compatible con iOS y Android
   - Desbloqueo por interacción del usuario
   ========================================================================== */

const SOUND_PREFS_KEY = 'sispro_sound_prefs';

// Objetos de audio
let inicioAudio = null;
let chatAudio = null;
let stateAudio = null;

// Estados
let audioUnlocked = false;
let soundEnabled = true;
let inicioPlayed = false;

/* ══════════════════════════════════════════════════════════════════════════
   Inicialización
   ══════════════════════════════════════════════════════════════════════════ */
function initSounds() {
  // Cargar preferencias
  const prefs = localStorage.getItem(SOUND_PREFS_KEY);
  if (prefs) {
    try {
      const parsed = JSON.parse(prefs);
      soundEnabled = parsed.enabled !== false;
    } catch (e) {}
  }

  // Crear objetos de audio (sin cargar aún)
  inicioAudio = createAudio('sounds/inicio.mp3');
  chatAudio = createAudio('sounds/chat.mp3');
  stateAudio = createAudio('sounds/estado.mp3');

  // Desbloqueo requerido - cargar en primera interacción
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   Crear objeto de audio configurado
   ══════════════════════════════════════════════════════════════════════════ */
function createAudio(src) {
  const audio = new Audio();
  audio.src = src;
  audio.preload = 'auto';
  
  // Configuración para evitar reproductores nativos en iOS
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  
  // Volumen
  audio.volume = 1.0;
  
  return audio;
}

/* ══════════════════════════════════════════════════════════════════════════
   Desbloquear audio (iOS/Android)
   ══════════════════════════════════════════════════════════════════════════ */
function unlockAudio() {
  if (audioUnlocked) return;

  // Precargar todos los audios en la primera interacción
  try {
    if (inicioAudio) inicioAudio.load();
    if (chatAudio) chatAudio.load();
    if (stateAudio) stateAudio.load();
  } catch (e) {
    console.warn('Error precargando sonidos:', e);
  }

  audioUnlocked = true;
}

/* ══════════════════════════════════════════════════════════════════════════
   Reproducir sonido
   ══════════════════════════════════════════════════════════════════════════ */
function playSound(audio) {
  if (!soundEnabled || !audio) return;

  try {
    // Reiniciar el audio si ya se estaba reproduciendo
    audio.currentTime = 0;
    
    // Reproducir
    const playPromise = audio.play();
    
    // Manejar promesa (requerido en navegadores modernos)
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn('Error reproduciendo sonido:', error);
      });
    }
  } catch (e) {
    console.warn('Error reproduciendo sonido:', e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Sonidos específicos
   ══════════════════════════════════════════════════════════════════════════ */
function playInicioSound() {
  if (!inicioPlayed) {
    playSound(inicioAudio);
    inicioPlayed = true;
  }
}

function playChatSound() {
  playSound(chatAudio);
}

function playStateSound() {
  playSound(stateAudio);
}

/* ══════════════════════════════════════════════════════════════════════════
   Preferencias
   ══════════════════════════════════════════════════════════════════════════ */
function toggleSound(enabled) {
  soundEnabled = enabled !== false;
  localStorage.setItem(
    SOUND_PREFS_KEY,
    JSON.stringify({ enabled: soundEnabled })
  );
}

function isSoundEnabled() {
  return soundEnabled;
}

/* ══════════════════════════════════════════════════════════════════════════
   Exponer globalmente
   ══════════════════════════════════════════════════════════════════════════ */
window.playInicioSound = playInicioSound;
window.playChatSound = playChatSound;
window.playStateSound = playStateSound;
window.toggleSound = toggleSound;
window.isSoundEnabled = isSoundEnabled;

/* ══════════════════════════════════════════════════════════════════════════
   Auto-init
   ══════════════════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSounds);
} else {
  initSounds();
}
