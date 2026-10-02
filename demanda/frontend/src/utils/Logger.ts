export class Logger {
  private static logElement: HTMLElement | null = null;

  static initialize(elementId: string) {
    this.logElement = document.getElementById(elementId);
  }

  static log(message: string, className: string = '') {
    if (!this.logElement) return;

    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.logElement.innerHTML += `\n<span class="${className}">${line}</span>`;
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  static error(message: string) {
    this.log(message, 'err');
  }

  static success(message: string) {
    this.log(message, 'ok');
  }

  static clear() {
    if (this.logElement) {
      this.logElement.innerHTML = 'Listo.';
    }
  }
}
