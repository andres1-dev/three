// Funciones para sonidos de feedback
function playSuccessSound() {
    if (typeof USER_SETTINGS !== 'undefined' && !USER_SETTINGS.audioFeedback) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 800;
        gainNode.gain.value = 1;
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        console.log("Error al reproducir sonido de éxito:", e);
    }
}

function playErrorSound() {
    if (typeof USER_SETTINGS !== 'undefined' && !USER_SETTINGS.audioFeedback) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
        gainNode.gain.value = 0.8;
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.log("Error al reproducir sonido de error:", e);
    }
}
