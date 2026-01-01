// Analizador de mensajes por cliente_id
// Devuelve la clave de respuesta si hay coincidencia, o null si debe ir a IA

const reglasPorCliente = {
  52: [ // marketing
    {
      match: (texto) => texto.toLowerCase().includes('soy artista') || texto.toLowerCase().includes('artista visual'),
      respuesta: 'bienvenida.artista'
    },
    {
      match: (texto) => ['tengo un comercio', 'vendo productos', 'soy emprendedor'].some(f => texto.toLowerCase().includes(f)),
      respuesta: 'bienvenida.comercio'
    },
    {
      match: (texto) => ['qué tecnología usan', 'p5.js', 'processing'].some(f => texto.toLowerCase().includes(f)),
      respuesta: 'tecnologias_creativas'
    }
    // ...agregar más reglas según respuestas.js
  ]
  // Otros clientes: agregar aquí
};

function analizarMensaje(cliente_id, texto) {
  const reglas = reglasPorCliente[cliente_id] || [];
  for (const regla of reglas) {
    if (regla.match(texto)) return regla.respuesta;
  }
  return null;
}

module.exports = { analizarMensaje };
