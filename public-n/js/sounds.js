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
let chatBuffer = null;
let stateBuffer = null;

// Estados
let audioUnlocked = false;
let soundEnabled = true;

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

  // Crear AudioContext (compatible con iOS)
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    // Cargar audios como buffers
    chatBuffer = await loadSound('sounds/chat.mp3');
    stateBuffer = await loadSound('sounds/estado.mp3');
  } catch (e) {
    console.warn('Error cargando sonidos:', e);
  }

  // Desbloqueo requerido en iOS
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
function unlockAudio() {
  if (audioUnlocked) return;

  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  audioUnlocked = true;
}

/* ══════════════════════════════════════════════════════════════════════════
   Reproducir sonido
   ══════════════════════════════════════════════════════════════════════════ */
function playSound(buffer) {
  if (!soundEnabled || !audioUnlocked || !buffer) return;

  try {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Nodo de volumen (opcional)
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(0);

    // Opcional: cortar sonido corto tipo notificación
    // source.stop(audioContext.currentTime + 1);

  } catch (e) {
    console.warn('Error reproduciendo sonido:', e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Sonidos específicos
   ══════════════════════════════════════════════════════════════════════════ */
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