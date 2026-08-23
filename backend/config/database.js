// ============================================================
// Conexión a MySQL - Pool con double-checked locking
// ============================================================
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let pool = null;
let poolInitializing = false;

async function getPool() {
  if (pool) return pool;
  if (poolInitializing) {
    // Esperar a que termine la inicialización
    await new Promise(resolve => setTimeout(resolve, 100));
    return pool;
  }    poolInitializing = true;
  try {
    const poolConfig = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset || 'utf8mb4',
      waitForConnections: true,
      connectionLimit: config.pool_size || 8,
      queueLimit: 0,
      dateStrings: true
    };
    // SSL para Aiven u otros proveedores cloud
    if (config.ssl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    pool = mysql.createPool(poolConfig);

    // Verificar conexión
    const conn = await pool.getConnection();
    conn.release();
    const mode = config.dbMode === 'cloud' ? '☁️ Cloud (Aiven)' : '🏠 Local';
    console.log(`✅ Conectado a MySQL [${mode}]: ${config.database}@${config.host}:${config.port}`);
    return pool;
  } catch (err) {
    console.error('❌ Error conectando a MySQL:', err.message);
    // Fallback: crear conexión directa
    try {
      pool = null;
      const connConfig = {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        charset: config.charset || 'utf8mb4',
        dateStrings: true
      };
      if (config.ssl) {
        connConfig.ssl = { rejectUnauthorized: false };
      }
      const conn = await mysql.createConnection(connConfig);
      // Wrap como pool-like
      pool = {
        query: (...args) => conn.query(...args),
        execute: (...args) => conn.execute(...args),
        getConnection: async () => conn,
        _directConn: conn
      };
      console.log(`✅ Conexión directa a MySQL: ${config.database}`);
      return pool;
    } catch (err2) {
      console.error('❌ Error conexión directa:', err2.message);
      throw err2;
    } finally {
      poolInitializing = false;
    }
  } finally {
    poolInitializing = false;
  }
}

// Context manager para transacciones
async function transaction(fn) {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Helper: ejecutar query
async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}

// Helper: fetchone
async function fetchone(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: execute (prepared statement)
async function execute(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

// Auto-inicializar BD
async function ensureDatabase() {
  try {
    const p = await getPool();
    await p.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Base de datos ${config.database} verificada`);
    return true;
  } catch (err) {
    console.error('❌ Error verificando BD:', err.message);
    return false;
  }
}

// Ejecutar SQL desde archivo
async function runSqlFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql.split(';').filter(s => s.trim());
    const p = await getPool();
    for (const stmt of statements) {
      if (stmt.trim()) {
        await p.query(stmt);
      }
    }
    console.log(`✅ Ejecutado: ${path.basename(filePath)}`);
  } catch (err) {
    console.warn(`⚠️ Error ejecutando ${path.basename(filePath)}:`, err.message);
  }
}

// Asegurar índices de rendimiento (idempotente)
async function ensureIndexes() {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`,
    `CREATE INDEX IF NOT EXISTS idx_tallas_orden ON tallas(orden)`,
    `CREATE INDEX IF NOT EXISTS idx_trabajadores_nombre ON trabajadores(nombre)`,
    `CREATE INDEX IF NOT EXISTS idx_stock_epp_talla ON stock_inicial(epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_ingresos_epp_talla ON ingresos(epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ingresos_estado ON ingresos(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_ingresos_estado_periodo ON ingresos(estado, periodo, epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_entregas_fecha ON entregas(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_entregas_epp_talla ON entregas(epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_entregas_trabajador ON entregas(trabajador_id)`,
    `CREATE INDEX IF NOT EXISTS idx_entregas_estado ON entregas(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_entregas_estado_periodo ON entregas(estado, periodo, epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_devoluciones_epp_talla ON devoluciones(epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_devoluciones_trabajador ON devoluciones(trabajador_id)`,
    `CREATE INDEX IF NOT EXISTS idx_devoluciones_registro ON devoluciones(estado_registro)`,
    `CREATE INDEX IF NOT EXISTS idx_devoluciones_estado_periodo ON devoluciones(estado_registro, estado, periodo, epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_dev_estados_devolucion ON devolucion_estados(devolucion_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_fisico_fecha ON inventarios_fisicos(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_fisico_epp_talla ON inventarios_fisicos(epp_id, talla_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_fisico_tipo ON inventarios_fisicos(tipo)`,
    `CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla)`,
    `CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria(tabla, registro_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id)`
  ];

  for (const idx of indexes) {
    try {
      await query(idx);
    } catch (e) {
      // Ignorar si no hay permisos
    }
  }
}

module.exports = {
  getPool,
  transaction,
  query,
  fetchone,
  execute,
  ensureDatabase,
  runSqlFile,
  ensureIndexes
};
