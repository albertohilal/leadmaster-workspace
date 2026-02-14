const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Ruta esperada del archivo de entorno de test
const envTestPath = path.join(__dirname, ".env.test");

// 1️⃣ Verificar existencia de .env.test
if (!fs.existsSync(envTestPath)) {
  console.error("❌ ERROR: No existe .env.test");
  console.error("Crea el archivo antes de ejecutar tests.");
  process.exit(1);
}

// 2️⃣ Cargar variables desde .env.test
dotenv.config({
  path: envTestPath
});

// 3️⃣ Forzar entorno de testing
process.env.NODE_ENV = "test";
process.env.AUTO_CAMPAIGNS_ENABLED = "false";

// 4️⃣ Validación crítica: impedir uso de base productiva
const productionDatabases = [
  "iunaorg_dyd",
  "leadmaster_prod",
  "leadmaster_production"
];

if (!process.env.DB_NAME) {
  console.error("❌ ERROR: DB_NAME no definido en .env.test");
  process.exit(1);
}

if (productionDatabases.includes(process.env.DB_NAME)) {
  console.error("🚨 ABORTADO: Intento de ejecutar tests contra base de datos PRODUCTIVA");
  console.error("Base detectada:", process.env.DB_NAME);
  process.exit(1);
}

// 5️⃣ Log informativo
console.log("🧪 Tests ejecutándose contra:", process.env.DB_NAME);
console.log("🔒 Entorno:", process.env.NODE_ENV);
