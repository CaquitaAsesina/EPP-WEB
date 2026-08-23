// ============================================================
// Configuración del sistema - carga de .env + env vars
// Conexión cloud (Aiven MySQL)
// ============================================================
const path = require('path');
const dotenv = require('dotenv');

// Cargar .env desde la raíz del proyecto
const envPath = path.join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

const defaults = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'inventario_epp',
  charset: 'utf8mb4',
  pool_size: 8,
  server_port: 3000,
  ssl: false
};

function loadConfig() {
  const cfg = { ...defaults };

  // Variables de entorno (Aiven / cloud)
  if (process.env.DB_HOST)     cfg.host     = process.env.DB_HOST;
  if (process.env.DB_PORT)     cfg.port     = parseInt(process.env.DB_PORT, 10);
  if (process.env.DB_USER)     cfg.user     = process.env.DB_USER;
  if (process.env.DB_PASSWORD) cfg.password = process.env.DB_PASSWORD;
  if (process.env.DB_NAME)     cfg.database = process.env.DB_NAME;
  if (process.env.DB_SSL)      cfg.ssl      = process.env.DB_SSL === 'true';

  // Puerto del servidor
  if (process.env.PORT) cfg.server_port = parseInt(process.env.PORT, 10);

  return cfg;
}

module.exports = loadConfig();
