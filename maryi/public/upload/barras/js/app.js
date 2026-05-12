// Inicialización del administrador

document.addEventListener('DOMContentLoaded', () => {
  console.log('Administrador de Base de Datos iniciado');
  
  // Prevenir drag & drop accidental
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
});
