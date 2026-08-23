// ============================================================
// Configuración del sistema - carga de .env + config.json + env vars
// Soporta dual mode: cloud (Aiven) y local (MySQL)
// ============================================================
const fs = require('fs');
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
  let cfg = { ...defaults };

  // 1. config/config.json (legacy)
  const configPath1 = path.join(__dirname, '..', 'config', 'config.json');
  if (fs.existsSync(configPath1)) {
    try {
      const fileCfg = JSON.parse(fs.readFileSync(configPath1, 'utf8'));
      cfg = { ...cfg, ...fileCfg };
    } catch (e) {
      console.warn('Error leyendo config/config.json:', e.message);
    }
  }

  // 2. config.json junto al .exe / proyecto raíz
  const configPath2 = path.join(__dirname, '..', '..', 'config.json');
  if (fs.existsSync(configPath2)) {
    try {
      const fileCfg = JSON.parse(fs.readFileSync(configPath2, 'utf8'));
      cfg = { ...cfg, ...fileCfg };
    } catch (e) {
      console.warn('Error leyendo config.json raíz:', e.message);
    }
  }

  // 3. DB_MODE: cloud (Aiven) o local (MySQL)
  const dbMode = (process.env.DB_MODE || 'local').toLowerCase();

  if (dbMode === 'cloud') {
    // Usar variables DB_* (Aiven / cloud)
    if (process.env.DB_HOST)     cfg.host     = process.env.DB_HOST;
    if (process.env.DB_PORT)     cfg.port     = parseInt(process.env.DB_PORT, 10);
    if (process.env.DB_USER)     cfg.user     = process.env.DB_USER;
    if (process.env.DB_PASSWORD) cfg.password = process.env.DB_PASSWORD;
    if (process.env.DB_NAME)     cfg.database = process.env.DB_NAME;
    if (process.env.DB_SSL)      cfg.ssl      = process.env.DB_SSL === 'true';
    cfg.dbMode = 'cloud';
  } else {
    // Usar variables LOCAL_DB_* (MySQL local)
    if (process.env.LOCAL_DB_HOST)     cfg.host     = process.env.LOCAL_DB_HOST;
    if (process.env.LOCAL_DB_PORT)     cfg.port     = parseInt(process.env.LOCAL_DB_PORT, 10);
    if (process.env.LOCAL_DB_USER)     cfg.user     = process.env.LOCAL_DB_USER;
    if (process.env.LOCAL_DB_PASSWORD) cfg.password = process.env.LOCAL_DB_PASSWORD;
    if (process.env.LOCAL_DB_NAME)     cfg.database = process.env.LOCAL_DB_NAME;
    if (process.env.LOCAL_DB_SSL)      cfg.ssl      = process.env.LOCAL_DB_SSL === 'true';
    cfg.dbMode = 'local';
  }

  // Puerto del servidor
  if (process.env.PORT) cfg.server_port = parseInt(process.env.PORT, 10);

  return cfg;
}

module.exports = loadConfig();
