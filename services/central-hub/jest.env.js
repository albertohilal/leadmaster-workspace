const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Ruta esperada del archivo de entorno de test
const envTestPath = path.join(__dirname, ".env.test");

// 1️⃣ Cargar .env.test SOLO si existe (en CI puede no existir)
if (fs.existsSync(envTestPath)) {
  dotenv.config({
    path: envTestPath
  });
  console.log("📄 .env.test cargado correctamente");
} else {
  console.log("⚙️ .env.test no encontrado, usando variables del entorno (CI)");
}

// 2️⃣ Forzar entorno de testing
process.env.NODE_ENV = "test";
process.env.AUTO_CAMPAIGNS_ENABLED = "false";

// 3️⃣ Validación crítica: impedir uso de base productiva
const productionDatabases = [
  "iunaorg_dyd",
  "leadmaster_prod",
  "leadmaster_production"
];

if (!process.env.DB_NAME) {
  console.error("❌ ERROR: DB_NAME no definido en entorno de test");
  process.exit(1);
}

if (productionDatabases.includes(process.env.DB_NAME)) {
  console.error("🚨 ABORTADO: Intento de ejecutar tests contra base de datos PRODUCTIVA");
  console.error("Base detectada:", process.env.DB_NAME);
  process.exit(1);
}

// 4️⃣ Log informativo
console.log("🧪 Tests ejecutándose contra:", process.env.DB_NAME);
console.log("🔒 Entorno:", process.env.NODE_ENV);
