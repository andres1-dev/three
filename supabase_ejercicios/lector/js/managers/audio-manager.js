// Gestión de audio

const AudioManager = {
  context: null,

  init() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
  },

  playBeep(frequency = 800, duration = 100) {
    if (!this.context) this.init();

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration / 1000);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration / 1000);
  }
};
