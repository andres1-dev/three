/* ==========================================================================
   colombia-locations.js — Datos geográficos de Colombia
   ========================================================================== */

/**
 * Departamentos de Colombia
 */
const DEPARTAMENTOS_COLOMBIA = [
    'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
    'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
    'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
    'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
    'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
    'Vaupés', 'Vichada'
];

/**
 * Ciudades principales de Colombia organizadas por departamento
 */
const CIUDADES_COLOMBIA = {
    'Valle del Cauca': [
        'Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga', 'Jamundí',
        'Yumbo', 'Candelaria', 'Florida', 'Pradera', 'Sevilla', 'Dagua', 'La Cumbre',
        'Vijes', 'Ginebra', 'Guacarí', 'El Cerrito', 'Zarzal', 'Roldanillo'
    ],
    'Antioquia': [
        'Medellín', 'Bello', 'Itagüí', 'Envigado', 'Apartadó', 'Turbo', 'Rionegro',
        'Sabaneta', 'Caldas', 'La Estrella', 'Copacabana', 'Girardota'
    ],
    'Cundinamarca': [
        'Bogotá D.C.', 'Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Mosquera',
        'Fusagasugá', 'Madrid', 'Funza', 'Cajicá', 'Sibaté', 'Tocancipá'
    ],
    'Atlántico': [
        'Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Puerto Colombia',
        'Galapa', 'Baranoa'
    ],
    'Santander': [
        'Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja',
        'San Gil', 'Socorro'
    ],
    'Bolívar': [
        'Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar'
    ],
    'Norte de Santander': [
        'Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario', 'Los Patios'
    ],
    'Tolima': [
        'Ibagué', 'Espinal', 'Melgar', 'Honda', 'Chaparral'
    ],
    'Huila': [
        'Neiva', 'Pitalito', 'Garzón', 'La Plata'
    ],
    'Risaralda': [
        'Pereira', 'Dosquebradas', 'La Virginia', 'Santa Rosa de Cabal'
    ],
    'Quindío': [
        'Armenia', 'Calarcá', 'La Tebaida', 'Montenegro'
    ],
    'Caldas': [
        'Manizales', 'Villamaría', 'Chinchiná', 'La Dorada'
    ],
    'Cauca': [
        'Popayán', 'Santander de Quilichao', 'Puerto Tejada'
    ],
    'Nariño': [
        'Pasto', 'Tumaco', 'Ipiales'
    ],
    'Magdalena': [
        'Santa Marta', 'Ciénaga', 'Fundación'
    ],
    'Cesar': [
        'Valledupar', 'Aguachica', 'Bosconia'
    ],
    'Córdoba': [
        'Montería', 'Cereté', 'Lorica', 'Sahagún'
    ],
    'Sucre': [
        'Sincelejo', 'Corozal', 'San Marcos'
    ],
    'Meta': [
        'Villavicencio', 'Acacías', 'Granada'
    ],
    'Boyacá': [
        'Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá'
    ],
    'La Guajira': [
        'Riohacha', 'Maicao', 'Uribia'
    ],
    'Caquetá': [
        'Florencia', 'San Vicente del Caguán'
    ],
    'Casanare': [
        'Yopal', 'Aguazul', 'Villanueva'
    ],
    'Arauca': [
        'Arauca', 'Tame', 'Saravena'
    ],
    'Putumayo': [
        'Mocoa', 'Puerto Asís'
    ],
    'Chocó': [
        'Quibdó', 'Istmina'
    ],
    'San Andrés y Providencia': [
        'San Andrés'
    ],
    'Guaviare': [
        'San José del Guaviare'
    ],
    'Guainía': [
        'Inírida'
    ],
    'Vaupés': [
        'Mitú'
    ],
    'Vichada': [
        'Puerto Carreño'
    ],
    'Amazonas': [
        'Leticia'
    ]
};

/**
 * Barrios de Cali organizados por comuna
 */
const BARRIOS_CALI = {
  1: [
    'Terrón Colorado', 'Vista Hermosa', 'Aguacatal',
    'Alto Aguacatal', 'Ulpiano Lloreda'
  ],

  2: [
    'Granada', 'Versalles', 'Centenario',
    'Juanambú', 'Santa Mónica Residencial'
  ],

  3: [
    'San Antonio', 'El Peñón', 'San Cayetano',
    'La Merced', 'El Calvario'
  ],

  4: [
    'Salomia', 'Santander', 'Porvenir',
    'La Esmeralda', 'Jorge Isaacs'
  ], // confirmado por alcaldía :contentReference[oaicite:1]{index=1}

  5: [
    'Chiminangos I', 'Chiminangos II', 'Los Andes',
    'Metropolitano del Norte', 'Los Guayacanes'
  ], // :contentReference[oaicite:2]{index=2}

  6: [
    'Floralia', 'Petecuy I', 'Petecuy II',
    'Los Guaduales', 'San Luis'
  ], // :contentReference[oaicite:3]{index=3}

  7: [
    'Alfonso López I', 'Alfonso López II', 'Alfonso López III',
    'Puerto Mallarino', 'Fepicol'
  ], // :contentReference[oaicite:4]{index=4}

  8: [
    'La Base', 'Villacolombia', 'Municipal',
    'Simón Bolívar', 'Primitivo Crespo'
  ], // :contentReference[oaicite:5]{index=5}

  9: [
    'Bretaña', 'Champagnat', 'Tequendama',
    'Nueva Granada', 'Junín'
  ],

  10: [
    'Cristóbal Colón', 'El Dorado', 'Santa Elena',
    'Las Acacias', 'Colseguros'
  ], // :contentReference[oaicite:6]{index=6}

  11: [
    'Ciudad Modelo', 'El Jardín', 'La Fortaleza',
    'Los Sauces', 'Villa del Sur'
  ], // :contentReference[oaicite:7]{index=7}

  12: [
    'Nueva Floresta', 'Doce de Octubre',
    'El Rodeo', 'La Independencia'
  ],

  13: [
    'Calipso', 'El Diamante', 'El Poblado II',
    'Los Comuneros II', 'Charco Azul'
  ], // :contentReference[oaicite:8]{index=8}

  14: [
    'Alfonso Bonilla Aragón', 'Manuela Beltrán',
    'Las Orquídeas', 'Los Naranjos', 'Marroquín'
  ], // :contentReference[oaicite:9]{index=9}

  15: [
    'Ciudad Córdoba', 'El Retiro', 'El Vallado',
    'Mojica', 'Los Comuneros I'
  ], // :contentReference[oaicite:10]{index=10}

  16: [
    'Antonio Nariño', 'Ciudad 2000',
    'La Hacienda', 'Valle del Lili'
  ],

  17: [
    'Ciudad Jardín', 'El Caney',
    'Ciudadela Comfandi', 'Valle del Lili',
    'Cañaverales'
  ], // :contentReference[oaicite:11]{index=11}

  18: [
    'Meléndez', 'Buenos Aires', 'Nápoles',
    'Los Chorros', 'Alto Nápoles'
  ], // :contentReference[oaicite:12]{index=12}

  19: [
    'El Refugio', 'Pampalinda',
    'La Selva', 'Tequendama', 'Bellavista'
  ],

  20: [
    'Siloé', 'Belén', 'Pueblo Joven',
    'Lleras Camargo'
  ], // :contentReference[oaicite:13]{index=13}

  21: [
    'Desepaz', 'Potrero Grande',
    'Pizamos I', 'Pizamos II',
    'Valle Grande'
  ], // :contentReference[oaicite:14]{index=14}

  22: [
    'Pance', 'Ciudad Campestre',
    'Parcelaciones Pance', 'Bochalema'
  ]
};

/**
 * Barrios de otras ciudades principales
 */
const BARRIOS_OTRAS_CIUDADES = {
    // BOGOTÁ D.C. - Organizado por Localidades (20 localidades)
    'Bogotá D.C.': [
        // Localidad 1 - Usaquén
        'Usaquén', 'Verbenal', 'La Uribe', 'San Cristóbal Norte', 'Toberín', 'Los Cedros', 'Cedritos', 'Country Club', 'Santa Bárbara', 'Caobos Salazar',
        // Localidad 2 - Chapinero
        'Chapinero', 'Chicó', 'El Refugio', 'San Isidro', 'Quinta Camacho', 'Chapinero Alto', 'Pardo Rubio', 'Los Rosales', 'El Nogal',
        // Localidad 3 - Santa Fe
        'Santa Fe', 'La Candelaria', 'Las Aguas', 'Egipto', 'Belén', 'Lourdes', 'Las Cruces', 'La Peña',
        // Localidad 4 - San Cristóbal
        'San Cristóbal', 'Veinte de Julio', 'La Gloria', 'Los Libertadores', 'Ramajal', 'San Blas', 'Guacamayas',
        // Localidad 5 - Usme
        'Usme', 'Alfonso López', 'Danubio', 'Gran Yomasa', 'Comuneros', 'La Flora', 'Bolonia',
        // Localidad 6 - Tunjuelito
        'Tunjuelito', 'Venecia', 'Abraham Lincoln', 'Tunal', 'San Benito',
        // Localidad 7 - Bosa
        'Bosa', 'Bosa Occidental', 'Bosa Central', 'Apogeo', 'Laureles', 'El Recreo', 'San Bernardino',
        // Localidad 8 - Kennedy
        'Kennedy', 'Carvajal', 'Américas', 'Bavaria', 'Castilla', 'Timiza', 'Tintal', 'Patio Bonito', 'Las Margaritas', 'Corabastos',
        // Localidad 9 - Fontibón
        'Fontibón', 'Modelia', 'Capellanía', 'Aeropuerto El Dorado', 'Zona Franca', 'Ciudad Salitre', 'Granjas de Techo',
        // Localidad 10 - Engativá
        'Engativá', 'Minuto de Dios', 'Boyacá Real', 'Santa Cecilia', 'Álamos', 'Villa Luz', 'Garcés Navas', 'Las Ferias', 'Bolivia',
        // Localidad 11 - Suba
        'Suba', 'Suba Centro', 'Rincón', 'Tibabuyes', 'Niza', 'La Alhambra', 'Prado', 'Bilbao', 'Casablanca', 'Lisboa', 'San José de Bavaria',
        // Localidad 12 - Barrios Unidos
        'Barrios Unidos', 'Los Andes', 'Doce de Octubre', 'Polo Club', 'Simón Bolívar', 'Alcázares',
        // Localidad 13 - Teusaquillo
        'Teusaquillo', 'La Esmeralda', 'Galerías', 'Campín', 'Parque Simón Bolívar', 'Ciudad Salitre Oriental', 'Santa Teresita',
        // Localidad 14 - Los Mártires
        'Los Mártires', 'Santa Isabel', 'Voto Nacional', 'La Sabana', 'Eduardo Santos', 'Ricaurte',
        // Localidad 15 - Antonio Nariño
        'Antonio Nariño', 'Restrepo', 'Ciudad Jardín Sur', 'Santander',
        // Localidad 16 - Puente Aranda
        'Puente Aranda', 'San Rafael', 'Zona Industrial', 'Muzu', 'Cundinamarca', 'Ciudad Montes',
        // Localidad 17 - La Candelaria
        'La Candelaria Centro', 'Belén', 'Las Aguas Centro', 'Santa Bárbara Centro',
        // Localidad 18 - Rafael Uribe Uribe
        'Rafael Uribe Uribe', 'Diana Turbay', 'Quiroga', 'San Jorge', 'Marruecos', 'Marco Fidel Suárez',
        // Localidad 19 - Ciudad Bolívar
        'Ciudad Bolívar', 'Lucero', 'El Tesoro', 'Arborizadora', 'San Francisco', 'Jerusalén', 'Ismael Perdomo', 'Potosí'
    ],
    
    // MEDELLÍN - Organizado por Comunas (16 comunas)
    'Medellín': [
        // Comuna 1 - Popular
        'Popular', 'Santo Domingo Savio', 'Granizal', 'Moscú', 'Villa Guadalupe', 'San Pablo', 'Aldea Pablo VI', 'La Avanzada', 'Carpinelo',
        // Comuna 2 - Santa Cruz
        'Santa Cruz', 'La Isla', 'El Playón de los Comuneros', 'Manrique Central', 'Manrique Oriental', 'Villa Hermosa',
        // Comuna 3 - Manrique
        'Manrique', 'La Salle', 'Las Granjas', 'Campo Valdés', 'Versalles', 'La Cruz', 'Oriente',
        // Comuna 4 - Aranjuez
        'Aranjuez', 'Berlín', 'San Isidro', 'Palermo', 'Sevilla', 'San Joaquín', 'Miranda',
        // Comuna 5 - Castilla
        'Castilla', 'Toscana', 'Las Brisas', 'Florencia', 'Tejelo', 'Boyacá', 'Héctor Abad Gómez',
        // Comuna 6 - Doce de Octubre
        'Doce de Octubre', 'Pedregal', 'La Esperanza', 'San Martín de Porres', 'Kennedy', 'Picacho', 'Mirador del Doce',
        // Comuna 7 - Robledo
        'Robledo', 'Córdoba', 'López de Mesa', 'El Diamante', 'Aures', 'Villa Flora', 'Pajarito', 'Monteclaro', 'Santa Margarita',
        // Comuna 8 - Villa Hermosa
        'Villa Hermosa', 'La Mansión', 'San Miguel', 'La Ladera', 'Batallón Girardot', 'Llanaditas', 'Los Mangos',
        // Comuna 9 - Buenos Aires
        'Buenos Aires', 'Juan Pablo II', 'Barrio Triste', 'Loreto', 'Alejandro Echavarría', 'Barrio Caicedo', 'Buenos Aires Centro',
        // Comuna 10 - La Candelaria
        'La Candelaria', 'Boston', 'Los Ángeles', 'Villa Nueva', 'Jesús Nazareno', 'El Chagualo', 'Estación Villa', 'San Benito',
        // Comuna 11 - Laureles-Estadio
        'Laureles', 'Estadio', 'Bolivariana', 'Los Conquistadores', 'Floresta', 'Santa Teresita', 'San Joaquín Laureles', 'Carlos E. Restrepo',
        // Comuna 12 - La América
        'La América', 'Ferrini', 'Calasanz', 'Los Pinos', 'La Floresta', 'Santa Lucía', 'El Danubio',
        // Comuna 13 - San Javier
        'San Javier', 'El Salado', 'Las Independencias', 'Nuevos Conquistadores', 'El Corazón', 'Betania', 'Eduardo Santos', 'La Pradera', 'Juan XXIII - La Quiebra',
        // Comuna 14 - El Poblado
        'El Poblado', 'Castropol', 'Lalinde', 'Los Balsos', 'San Lucas', 'El Tesoro', 'Los Naranjos', 'El Diamante II', 'Alejandría', 'Patio Bonito', 'Manila',
        // Comuna 15 - Guayabal
        'Guayabal', 'Trinidad', 'Santa Fe', 'Campo Amor', 'Cristo Rey', 'Tenche',
        // Comuna 16 - Belén
        'Belén', 'Fátima', 'Rosales', 'Granada', 'San Bernardo', 'Las Playas', 'Diego Echavarría', 'La Mota', 'Altavista', 'La Palma'
    ],
    
    // BARRANQUILLA - Organizado por Localidades (5 localidades)
    'Barranquilla': [
        // Localidad Norte Centro Histórico
        'El Prado', 'El Golf', 'Altos del Prado', 'Granadillo', 'Betania', 'El Limón', 'San Salvador', 'El Rosario', 'Bellavista',
        // Localidad Riomar
        'Riomar', 'El Country', 'Alto Prado', 'Villa Country', 'Villa Carolina', 'Los Nogales', 'Paraíso', 'El Castillo',
        // Localidad Suroccidente
        'Boston', 'Recreo', 'Las Américas', 'La Concórdia', 'Simón Bolívar', 'Montes', 'Cevillar', 'La Paz', 'Las Malvinas', 'El Ferry',
        // Localidad Suroriente
        'San Roque', 'Rebolo', 'Montecristo', 'La Chinita', 'Las Nieves', 'Barlovento', 'Ciudadela 20 de Julio', 'Los Olivos',
        // Localidad Metropolitana
        'Villa San Pedro', 'La Luz', 'La Victoria', 'El Silencio', 'Las Flores', 'Los Andes', 'Lipaya', 'Santo Domingo'
    ],
    
    // CARTAGENA - Organizado por Localidades (3 localidades)
    'Cartagena': [
        // Localidad Histórica y del Caribe Norte
        'Bocagrande', 'Castillogrande', 'El Laguito', 'Manga', 'Getsemaní', 'Centro', 'San Diego', 'Pie de la Popa', 'Cabrero', 'Crespo', 'Marbella',
        // Localidad de la Virgen y Turística
        'El Bosque', 'Torices', 'Espinal', 'San Fernando', 'Amberes', 'Ternera', 'Olaya Herrera', 'Daniel Lemaitre', 'La María', 'Fredonia',
        // Localidad Industrial y de la Bahía
        'Mamonal', 'Pasacaballos', 'Bayunca', 'Ararca', 'Pontezuela', 'Policarpa', 'El Pozón', 'Nelson Mandela', 'Nuevo Bosque'
    ],
    
    // BUCARAMANGA - Organizado por Comunas (17 comunas)
    'Bucaramanga': [
        // Comuna 1 - Norte
        'Cabecera del Llano', 'Altos de Cabecera', 'San Miguel', 'Álvarez', 'Sotomayor',
        // Comuna 2 - Nororiental
        'Provenza', 'Lagos del Cacique', 'Terrazas', 'Fontana', 'Campestre',
        // Comuna 3 - San Francisco
        'San Francisco', 'Girardot', 'Antonia Santos', 'Mutis', 'Bolívar',
        // Comuna 4 - Occidental
        'Granada', 'La Juventud', 'Santander', 'Mejoras Públicas', 'Sotomayor Centro',
        // Comuna 5 - García Rovira
        'García Rovira', 'La Concordia', 'San Mateo', 'Regaderos', 'Chorreras de Don Juan',
        // Comuna 6 - La Concordia
        'La Concordia', 'Bucaramanga', 'Antonia Santos Baja', 'Chapinero', 'Ricaurte',
        // Comuna 7 - Ciudadela Real de Minas
        'Ciudadela Real de Minas', 'Miraflores', 'Bolarqui', 'Café Madrid', 'Villa Rosa',
        // Comuna 8 - Sur Occidente
        'Campo Hermoso', 'Nariño', 'Comuneros', 'Pablo VI', 'Kennedy',
        // Comuna 9 - La Pedregosa
        'La Pedregosa', 'Colorados', 'Bucaramanga Sur', 'Villa Helena',
        // Comuna 10 - Provenza
        'Provenza', 'Altos de Provenza', 'Diamante', 'Estoraques',
        // Comuna 11 - Sur
        'Morrorico', 'Cañaveral', 'Porvenir', 'Limoncito', 'Rosario',
        // Comuna 12 - Cabecera
        'Cabecera', 'Álamos', 'Sotomayor Norte', 'La Aurora',
        // Comuna 13 - Oriental
        'Oriental', 'Alarcón', 'Bucarica', 'Betania',
        // Comuna 14 - Morrorico
        'Morrorico Alto', 'Morrorico Bajo', 'La Joya', 'Villabel',
        // Comuna 15 - Centro
        'Centro', 'San Alonso', 'Puerta del Sol', 'Conucos',
        // Comuna 16 - Lagos del Cacique
        'Lagos del Cacique', 'Altos del Cacique', 'Cacique',
        // Comuna 17 - Mutis
        'Mutis', 'La Floresta', 'Palonegro', 'Cristal Alto'
    ],
    
    // PEREIRA
    'Pereira': [
        'Cuba', 'El Poblado', 'Centro', 'Álamos', 'San Joaquín', 'Villa Santana', 'Boston', 'Olímpica', 'Ferrocarril', 'Río Otún',
        'Ciudadela del Café', 'Consota', 'El Jardín', 'Perla del Otún', 'Villavicencio', 'San Fernando', 'El Rocío', 'Belmonte',
        'Nacederos', 'Samaria', 'Tokio', 'Málaga', 'Galicia', 'Berlín', 'Providencia', 'El Plumón', 'Oriente', 'Nuevo Horizonte'
    ],
    
    // IBAGUÉ
    'Ibagué': [
        'Jordán', 'Picaleña', 'Ambalá', 'Centro', 'Salado', 'Topacio', 'Galerías', 'Tolima', 'Restrepo', 'Belén',
        'Cádiz', 'La Pola', 'Martinica', 'Calambeo', 'Chapetón', 'Boquerón', 'Nuevo Milenio', 'Ciudadela Simón Bolívar',
        'Villa Restrepo', 'Ricaurte', 'Limonar', 'Interlaken', 'Altos de Calambeo', 'Mirador del Jordán'
    ],
    
    // PALMIRA
    'Palmira': [
        'Centro', 'La Emilia', 'Zamorano', 'Belalcázar', 'La Torre', 'Sembrador', 'Palmaseca', 'Tienda Nueva', 'Boyacá',
        'Prado', 'Urbanización Palmira', 'Villa Luz', 'Barrancas', 'La Dolores', 'San Nicolás', 'Aguablanca'
    ],
    
    // BUENAVENTURA
    'Buenaventura': [
        'Centro', 'Bellavista', 'San José', 'Viento Libre', 'La Playita', 'Lleras', 'Cristal', 'Muro Yusti', 'Piñal',
        'Cascajal', 'Pueblo Nuevo', 'Brisas del Mar', 'Alfonso López', 'Comuneros', 'Punta del Este', 'Zacarías'
    ],
    
    // TULUÁ
    'Tuluá': [
        'Centro', 'San Rafael', 'Versalles', 'La Rivera', 'Brisas del Cauca', 'Boyacá', 'Jardín', 'Alvernia', 'Camilo Torres',
        'Santa Helena', 'Guacarí', 'Morales', 'La Herradura', 'Los Samanes', 'Villa Natalia'
    ],
    
    // PASTO
    'Pasto': [
        'Centro', 'Pandiaco', 'San Juan de Pasto', 'La Carolina', 'Aranda', 'Torobajo', 'Jongovito', 'Tamasagra', 'Mijitayo',
        'Fátima', 'San Vicente', 'Chapalito', 'Obonuco', 'Catambuco', 'Jamondino', 'La Rosa', 'Mapachico', 'Buesaquillo'
    ],
    
    // NEIVA
    'Neiva': [
        'Centro', 'Cándido', 'Altico', 'Granjas', 'Calixto Leiva', 'Sevilla', 'Álamos', 'Quirinal', 'Timanco', 'Canaima',
        'Coldeportes', 'Mipanorama', 'Palermo', 'Siete de Agosto', 'Chapinero', 'Limonar', 'Cándido Sur', 'Guacirco'
    ],
    
    // ARMENIA
    'Armenia': [
        'Centro', 'Quimbaya', 'Ciudadela del Café', 'Bosques de Pinares', 'La Fachada', 'Fundadores', 'Modelo', 'Uribe',
        'Brasilia', 'Santander', 'Galán', 'Belalcázar', 'Zuldemayda', 'Génesis', 'Portal del Edén', 'Mirador del Café'
    ],
    
    // MANIZALES
    'Manizales': [
        'Centro', 'Chipre', 'Palermo', 'Versalles', 'La Enea', 'Milán', 'Fátima', 'Aranjuez', 'Estrada', 'Palogrande',
        'Campestre', 'Rosales', 'Sultana', 'Cervantes', 'Maltería', 'Ciudadela del Norte', 'Olivares', 'Colón'
    ],
    
    // POPAYÁN
    'Popayán': [
        'Centro', 'El Empedrado', 'La Esmeralda', 'Alfonso López', 'Bolívar', 'Caldas', 'Pandiguando', 'Loma de la Virgen',
        'Bello Horizonte', 'La Paz', 'Tulcán', 'Santa Inés', 'Los Hoyos', 'Modelo', 'Junín', 'Pomona'
    ],
    
    // VILLAVICENCIO
    'Villavicencio': [
        'Centro', 'Barzal', 'La Grama', 'Maizaro', 'Comuneros', 'Porfía', 'Buenavista', 'Restrepo', 'Caudal', 'Kirpas',
        'Montecarlo', 'Llano Lindo', 'Guatiquía', 'Alborada', 'Morichal', 'Catumare', 'Vanguardia', 'Hacaritama'
    ],
    
    // CÚCUTA
    'Cúcuta': [
        'Centro', 'Caobos', 'La Playa', 'Colsag', 'Atalaya', 'San Luis', 'Quinta Oriental', 'Quinta Bosch', 'Claret',
        'Callejón', 'Chapinero', 'Barrio Blanco', 'Sevilla', 'Guaimaral', 'Prados del Este', 'Virgilio Barco', 'Aniversario'
    ],
    
    // SANTA MARTA
    'Santa Marta': [
        'Centro', 'Rodadero', 'El Prado', 'Mamatoco', 'Gaira', 'Bello Horizonte', 'Bastidas', 'Taganga', 'Pozos Colorados',
        'Bureche', 'Pescaíto', 'Minca', 'Don Jaca', 'Jardín', 'Chimila', 'Nacho Vives', 'Ondas del Caribe'
    ],
    
    // VALLEDUPAR
    'Valledupar': [
        'Centro', 'La Nevada', 'Sicarare', 'Dangond', 'Garupal', 'Sabanas del Valle', 'Villa Magaly', 'Primero de Mayo',
        'Los Ángeles', 'Nuevo Horizonte', 'Altos de Bellavista', 'Cinco de Enero', 'Simón Bolívar', 'Mareigua'
    ],
    
    // MONTERÍA
    'Montería': [
        'Centro', 'Cantaclaro', 'Mogambo', 'La Granja', 'Pastrana Borrero', 'Buenavista', 'Colina Real', 'Mocarí',
        'Furatena', 'Rancho Grande', 'Edmundo López', 'Policarpa', 'Santafé', 'Villa Cielo', 'Minuto de Dios'
    ],
    
    // SINCELEJO
    'Sincelejo': [
        'Centro', 'Majagual', 'Buenavista', 'Berlín', 'Colina Real', 'Chochó', 'Mochila', 'Bruselas', 'Nuevo Bosque',
        'Villa Luz', 'Primero de Mayo', 'Santander', 'Minuto de Dios', 'Calle Larga'
    ]
};

/**
 * Comunas de Cali (1-22)
 */
const COMUNAS_CALI = Array.from({ length: 22 }, (_, i) => i + 1);

/**
 * Localidades de Bogotá (20 localidades)
 */
const LOCALIDADES_BOGOTA = [
    { numero: 1, nombre: 'Usaquén' },
    { numero: 2, nombre: 'Chapinero' },
    { numero: 3, nombre: 'Santa Fe' },
    { numero: 4, nombre: 'San Cristóbal' },
    { numero: 5, nombre: 'Usme' },
    { numero: 6, nombre: 'Tunjuelito' },
    { numero: 7, nombre: 'Bosa' },
    { numero: 8, nombre: 'Kennedy' },
    { numero: 9, nombre: 'Fontibón' },
    { numero: 10, nombre: 'Engativá' },
    { numero: 11, nombre: 'Suba' },
    { numero: 12, nombre: 'Barrios Unidos' },
    { numero: 13, nombre: 'Teusaquillo' },
    { numero: 14, nombre: 'Los Mártires' },
    { numero: 15, nombre: 'Antonio Nariño' },
    { numero: 16, nombre: 'Puente Aranda' },
    { numero: 17, nombre: 'La Candelaria' },
    { numero: 18, nombre: 'Rafael Uribe Uribe' },
    { numero: 19, nombre: 'Ciudad Bolívar' },
    { numero: 20, nombre: 'Sumapaz' }
];

/**
 * Comunas de Medellín (16 comunas)
 */
const COMUNAS_MEDELLIN = [
    { numero: 1, nombre: 'Popular' },
    { numero: 2, nombre: 'Santa Cruz' },
    { numero: 3, nombre: 'Manrique' },
    { numero: 4, nombre: 'Aranjuez' },
    { numero: 5, nombre: 'Castilla' },
    { numero: 6, nombre: 'Doce de Octubre' },
    { numero: 7, nombre: 'Robledo' },
    { numero: 8, nombre: 'Villa Hermosa' },
    { numero: 9, nombre: 'Buenos Aires' },
    { numero: 10, nombre: 'La Candelaria' },
    { numero: 11, nombre: 'Laureles-Estadio' },
    { numero: 12, nombre: 'La América' },
    { numero: 13, nombre: 'San Javier' },
    { numero: 14, nombre: 'El Poblado' },
    { numero: 15, nombre: 'Guayabal' },
    { numero: 16, nombre: 'Belén' }
];

/**
 * Localidades de Barranquilla (5 localidades)
 */
const LOCALIDADES_BARRANQUILLA = [
    { numero: 1, nombre: 'Norte Centro Histórico' },
    { numero: 2, nombre: 'Riomar' },
    { numero: 3, nombre: 'Suroccidente' },
    { numero: 4, nombre: 'Suroriente' },
    { numero: 5, nombre: 'Metropolitana' }
];

/**
 * Localidades de Cartagena (3 localidades)
 */
const LOCALIDADES_CARTAGENA = [
    { numero: 1, nombre: 'Histórica y del Caribe Norte' },
    { numero: 2, nombre: 'De la Virgen y Turística' },
    { numero: 3, nombre: 'Industrial y de la Bahía' }
];

/**
 * Comunas de Bucaramanga (17 comunas)
 */
const COMUNAS_BUCARAMANGA = [
    { numero: 1, nombre: 'Norte' },
    { numero: 2, nombre: 'Nororiental' },
    { numero: 3, nombre: 'San Francisco' },
    { numero: 4, nombre: 'Occidental' },
    { numero: 5, nombre: 'García Rovira' },
    { numero: 6, nombre: 'La Concordia' },
    { numero: 7, nombre: 'Ciudadela Real de Minas' },
    { numero: 8, nombre: 'Sur Occidente' },
    { numero: 9, nombre: 'La Pedregosa' },
    { numero: 10, nombre: 'Provenza' },
    { numero: 11, nombre: 'Sur' },
    { numero: 12, nombre: 'Cabecera' },
    { numero: 13, nombre: 'Oriental' },
    { numero: 14, nombre: 'Morrorico' },
    { numero: 15, nombre: 'Centro' },
    { numero: 16, nombre: 'Lagos del Cacique' },
    { numero: 17, nombre: 'Mutis' }
];

/**
 * Obtiene todas las ciudades de un departamento
 */
function getCiudadesPorDepartamento(departamento) {
    return CIUDADES_COLOMBIA[departamento] || [];
}

/**
 * Obtiene todos los barrios de una comuna en Cali
 */
function getBarriosPorComuna(comuna) {
    return BARRIOS_CALI[parseInt(comuna)] || [];
}

/**
 * Obtiene todos los barrios de Cali (sin filtro de comuna)
 */
function getTodosBarriosCali() {
    const barrios = [];
    Object.values(BARRIOS_CALI).forEach(comunaBarrios => {
        barrios.push(...comunaBarrios);
    });
    return [...new Set(barrios)].sort();
}

/**
 * Obtiene los barrios de una ciudad específica
 */
function getBarriosPorCiudad(ciudad) {
    if (ciudad === 'Cali') {
        return getTodosBarriosCali();
    }
    return BARRIOS_OTRAS_CIUDADES[ciudad] || [];
}

/**
 * Obtiene las comunas/localidades de una ciudad
 */
function getComunasLocalidadesPorCiudad(ciudad) {
    switch(ciudad) {
        case 'Cali':
            return COMUNAS_CALI.map(num => ({ numero: num, nombre: `Comuna ${num}` }));
        case 'Bogotá D.C.':
            return LOCALIDADES_BOGOTA;
        case 'Medellín':
            return COMUNAS_MEDELLIN;
        case 'Barranquilla':
            return LOCALIDADES_BARRANQUILLA;
        case 'Cartagena':
            return LOCALIDADES_CARTAGENA;
        case 'Bucaramanga':
            return COMUNAS_BUCARAMANGA;
        default:
            return [];
    }
}

/**
 * Verifica si una ciudad maneja comunas/localidades
 */
function ciudadTieneComunas(ciudad) {
    // Solo Cali maneja comunas
    return ciudad === 'Cali';
}

/**
 * Obtiene el nombre del campo (Comuna o Localidad) según la ciudad
 */
function getNombreCampoComuna(ciudad) {
    if (ciudad === 'Bogotá D.C.' || ciudad === 'Barranquilla' || ciudad === 'Cartagena') {
        return 'Localidad';
    }
    return 'Comuna';
}

/**
 * Obtiene la comuna de un barrio en Cali
 */
function getComunaPorBarrio(barrio) {
    for (const [comuna, barrios] of Object.entries(BARRIOS_CALI)) {
        if (barrios.includes(barrio)) {
            return parseInt(comuna);
        }
    }
    return null;
}
