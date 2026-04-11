# 🎨 Iconos de la PWA

## Iconos Activos

### icon-any.svg
- **Propósito:** Uso general (favicon, navegador, tabs)
- **Fondo:** Transparente
- **Tamaño:** 640x640px
- **Formato:** SVG
- **Uso en:**
  - Favicon del navegador
  - Pestañas del navegador
  - Marcadores
  - Búsquedas

### icon-maskable.svg
- **Propósito:** Instalación PWA (iOS, Android)
- **Fondo:** Blanco sólido (#FFFFFF)
- **Tamaño:** 640x640px con safe area de 80px
- **Formato:** SVG
- **Uso en:**
  - Pantalla de inicio iOS
  - Pantalla de inicio Android
  - App drawer
  - Splash screen

## Especificaciones Técnicas

### Safe Area (icon-maskable.svg)
```
Total: 640x640px
Safe area: 80px padding (12.5%)
Contenido: 480x480px (75%)
```

### ViewBox
```xml
<svg viewBox="0 0 640 640">
```

### Gradiente
```xml
<linearGradient id="gradient_0">
  <stop offset="0" stop-color="#2652DB"/>
  <stop offset="1" stop-color="#3B6DFF"/>
</linearGradient>
```

## Uso en Código

### HTML
```html
<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="./icons/icon-any.svg">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="./icons/icon-maskable.svg">
```

### Manifest.json
```json
{
  "icons": [
    {
      "src": "./icons/icon-maskable.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "maskable"
    },
    {
      "src": "./icons/icon-any.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

## Generar Versiones PNG (Opcional)

Si necesitas versiones PNG para compatibilidad adicional:

### Usando Inkscape
```bash
inkscape icon-maskable.svg -w 512 -h 512 -o icon-512.png
inkscape icon-maskable.svg -w 192 -h 192 -o icon-192.png
```

### Usando ImageMagick
```bash
convert -background white -density 300 icon-maskable.svg -resize 512x512 icon-512.png
convert -background white -density 300 icon-maskable.svg -resize 192x192 icon-192.png
```

## Pruebas

### Maskable.app
Verifica que el icono maskable funcione correctamente:
https://maskable.app/editor

### Chrome DevTools
1. F12 → Application → Manifest
2. Verificar preview de iconos

### Lighthouse
1. F12 → Lighthouse
2. Auditoría PWA
3. Verificar "Maskable icon"

## Archivos Obsoletos

Los siguientes archivos ya no se usan y pueden eliminarse:
- ❌ `icon.svg` (reemplazado por icon-any.svg)
- ❌ `apple-touch-icon.svg` (reemplazado por icon-maskable.svg)
- ❌ `alfa.svg` (no se usa)

Ver `LIMPIEZA_ICONOS.md` en la raíz del proyecto para más detalles.

## Compatibilidad

| Plataforma | Icono Usado | Estado |
|------------|-------------|--------|
| iOS Safari | icon-maskable.svg | ✅ |
| Android Chrome | icon-maskable.svg | ✅ |
| Desktop Chrome | icon-any.svg | ✅ |
| Desktop Firefox | icon-any.svg | ✅ |
| Desktop Safari | icon-any.svg | ✅ |
| Edge | icon-any.svg | ✅ |

## Modificar Iconos

Si necesitas actualizar el diseño:

1. Edita el SVG manteniendo el viewBox `0 0 640 640`
2. Para `icon-maskable.svg`: mantén el contenido dentro del área segura (80px padding)
3. Para `icon-any.svg`: puedes usar todo el espacio
4. Mantén el gradiente y colores consistentes
5. Prueba en https://maskable.app/editor

## Recursos

- [Maskable Icons Spec](https://w3c.github.io/manifest/#icon-masks)
- [Web.dev - Adaptive Icons](https://web.dev/maskable-icon/)
- [Apple Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)

---

**Última actualización:** 2026-02-27  
**Versión:** 7.3.14
