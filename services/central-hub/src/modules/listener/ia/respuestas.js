// Respuestas automáticas por cliente_id y clave

const respuestasPorCliente = {
  52: {
    'bienvenida.artista': 'Hola, gracias por tu consulta. En Desarrollo y Diseño creamos soluciones digitales personalizadas. Podemos ayudarte a presentar y vender tu trabajo en línea.',
    'bienvenida.comercio': 'Hola. Ofrecemos soluciones digitales para negocios que quieran captar clientes o vender online. ¿En qué rubro trabajás?',
    'tecnologias_creativas': 'Desarrollamos sitios interactivos con tecnologías como p5.js o Processing. Son útiles para animaciones generativas, visualizaciones interactivas o galerías dinámicas.'
    // ...agregar más respuestas según reglas
  }
  // Otros clientes: agregar aquí
};

function obtenerRespuesta(cliente_id, clave) {
  return (respuestasPorCliente[cliente_id] && respuestasPorCliente[cliente_id][clave]) || null;
}

module.exports = { obtenerRespuesta };
