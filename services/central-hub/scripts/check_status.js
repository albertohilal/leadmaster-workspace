const http = require('http');

const endpoints = [
  '/sender/status',
  '/sender/auth/status',
  '/sender/campanias/status',
  '/sender/envios/status',
  '/sender/usuarios/status',
  '/sender/sesiones/status',
  '/sender/lugares/status',
  '/sender/rubros/status'
];

function checkEndpoint(endpoint) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: 3010, path: endpoint, timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ endpoint, status: res.statusCode, body: data }));
    }).on('error', (err) => {
      resolve({ endpoint, status: 'ERROR', body: err.message });
    });
  });
}

(async () => {
  for (const endpoint of endpoints) {
    const result = await checkEndpoint(endpoint);
    console.log(`${endpoint}: [${result.status}] ${result.body}`);
  }
})();
