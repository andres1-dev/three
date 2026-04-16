/* ==========================================================================
   sounds.js — Sistema de sonidos para notificaciones SISPRO (iOS FIX)
   - Usa Web Audio API (NO HTMLAudioElement)
   - Evita reproductor nativo de iOS / Dynamic Island
   - Desbloqueo por interacción del usuario
   ========================================================================== */

const SOUND_PREFS_KEY = 'sispro_sound_prefs';

// Contexto de audio
let audioContext = null;

// Buffers de sonido
let inicioBuffer = null;
let chatBuffer = null;
let stateBuffer = null;

// Estados
let audioUnlocked = false;
let soundEnabled = true;
let inicioPlayed = false; // Para reproducir inicio solo una vez

/* ══════════════════════════════════════════════════════════════════════════
   Inicialización
   ══════════════════════════════════════════════════════════════════════════ */
async function initSounds() {
  // Cargar preferencias
  const prefs = localStorage.getItem(SOUND_PREFS_KEY);
  if (prefs) {
    try {
      const parsed = JSON.parse(prefs);
      soundEnabled = parsed.enabled !== false;
    } catch (e) {}
  }

  // NO crear AudioContext aquí - se creará en unlockAudio
  // audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Desbloqueo requerido - crear AudioContext en primera interacción
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   Cargar sonido como buffer
   ══════════════════════════════════════════════════════════════════════════ */
async function loadSound(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

/* ══════════════════════════════════════════════════════════════════════════
   Desbloquear audio (iOS)
   ══════════════════════════════════════════════════════════════════════════ */
async function unlockAudio() {
  if (audioUnlocked) return;

  // Crear AudioContext en primera interacción del usuario
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Cargar audios como buffers
    try {
      inicioBuffer = await loadSound('sounds/inicio.mp3');
      chatBuffer = await loadSound('sounds/chat.mp3');
      stateBuffer = await loadSound('sounds/estado.mp3');
    } catch (e) {
      console.warn('Error cargando sonidos:', e);
    }
  }

  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  audioUnlocked = true;
}

/* ══════════════════════════════════════════════════════════════════════════
   Reproducir sonido
   ══════════════════════════════════════════════════════════════════════════ */
function playSound(buffer) {
  if (!soundEnabled || !buffer) return;

  try {
    // Intentar reanudar el contexto si está suspendido
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(0);

  } catch (e) {
    console.warn('Error reproduciendo sonido:', e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Sonidos específicos
   ══════════════════════════════════════════════════════════════════════════ */
function playInicioSound() {
  if (!inicioPlayed) {
    playSound(inicioBuffer);
    inicioPlayed = true;
  }
}

function playChatSound() {
  playSound(chatBuffer);
}

function playStateSound() {
  playSound(stateBuffer);
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