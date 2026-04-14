/* ==========================================================================
   sounds.js — Sistema de sonidos para notificaciones SISPRO
   - Reproduce archivos MP3 sin abrir reproductor visible
   - Sistema de desbloqueo de audio por interacción del usuario
   - Toggle para activar/desactivar sonidos
   ========================================================================== */

const SOUND_PREFS_KEY = 'sispro_sound_prefs';

// Instancias de Audio (se crean una vez y se reutilizan)
let chatAudio = null;
let stateAudio = null;
let audioUnlocked = false;

// Preferencias de sonido
let soundEnabled = true;

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

  // Crear instancias de Audio
  chatAudio = new Audio('sounds/chat.mp3');
  stateAudio = new Audio('sounds/estado.mp3');

  // Precargar audios
  chatAudio.load();
  stateAudio.load();

  // Desbloquear audio en primera interacción
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   Desbloquear audio (requerido en iOS/Safari)
   ══════════════════════════════════════════════════════════════════════════ */
function unlockAudio() {
  if (audioUnlocked) return;
  
  try {
    // Reproducir y pausar inmediatamente para desbloquear
    chatAudio.play().then(() => {
      chatAudio.pause();
      chatAudio.currentTime = 0;
    }).catch(() => {});
    
    stateAudio.play().then(() => {
      stateAudio.pause();
      stateAudio.currentTime = 0;
    }).catch(() => {});
    
    audioUnlocked = true;
  } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════════════
   Reproducir sonidos
   ══════════════════════════════════════════════════════════════════════════ */
function playChatSound() {
  if (!soundEnabled || !chatAudio) return;
  
  try {
    chatAudio.currentTime = 0;
    chatAudio.play().catch(() => {});
  } catch (e) {}
}

function playStateSound() {
  if (!soundEnabled || !stateAudio) return;
  
  try {
    stateAudio.currentTime = 0;
    stateAudio.play().catch(() => {});
  } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════════════
   Toggle de sonidos
   ══════════════════════════════════════════════════════════════════════════ */
function toggleSound(enabled) {
  soundEnabled = enabled !== false;
  localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify({ enabled: soundEnabled }));
}

function isSoundEnabled() {
  return soundEnabled;
}

/* ══════════════════════════════════════════════════════════════════════════
   Exponer funciones globalmente
   ══════════════════════════════════════════════════════════════════════════ */
window.playChatSound = playChatSound;
window.playStateSound = playStateSound;
window.toggleSound = toggleSound;
window.isSoundEnabled = isSoundEnabled;

/* ══════════════════════════════════════════════════════════════════════════
   Auto-inicialización
   ══════════════════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSounds);
} else {
  initSounds();
}
