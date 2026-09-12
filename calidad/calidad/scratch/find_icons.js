const fs = require('fs');
const content = fs.readFileSync('./plantillas/calidad-basica.html', 'utf8');
const matches = [...content.matchAll(/<i [^>]*class=["'][^"']*fa[^"']*["'][^>]*><\/i>/g)];
console.log('Total fa icons in calidad-basica.html:', matches.length);
matches.forEach(m => console.log('  ', m[0]));
