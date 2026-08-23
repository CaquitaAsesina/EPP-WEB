const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

// Configuración cloud (Aiven)
const CLOUD = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  dateStrings: true,
  connectTimeout: 15000
};

// Configuración local
const LOCAL = {
  host: process.env.LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT || '3306', 10),
  user: process.env.LOCAL_DB_USER || 'root',
  password: process.env.LOCAL_DB_PASSWORD || '',
  database: process.env.LOCAL_DB_NAME || 'inventario_epp',
  dateStrings: true
};

// Tablas en orden de dependencias (se limpian en reversa, se insertan en orden)
const TABLES = [
  'usuarios',
  'epp',
  'tallas',
  'epp_tallas',
  'trabajadores',
  'periodos',
  'stock_inicial',
  'ingresos',
  'entregas',
  'devoluciones',
  'devolucion_estados',
  'inventarios_fisicos',
  'auditoria'
];

async function sync() {
  console.log('🔄 Sincronizando Cloud → Local...\n');

  // Conectar a ambos
  console.log('☁️  Conectando a Cloud (Aiven)...');
  const cloud = await mysql.createConnection(CLOUD);
  console.log('   ✅ Cloud conectado\n');

  console.log('🏠 Conectando a Local MySQL...');
  const local = await mysql.createConnection(LOCAL);
  console.log('   ✅ Local conectado\n');

  // Desactivar foreign keys en local
  await local.query('SET FOREIGN_KEY_CHECKS=0');
  await local.query('SET UNIQUE_CHECKS=0');

  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`📋 ${table}... `);

    try {
      // Obtener columnas de la tabla local (esquema de referencia)
      const [localCols] = await local.query(`SHOW COLUMNS FROM \`${table}\``);
      const localColNames = localCols.map(c => c.Field);

      // Leer datos del cloud, filtrando solo columnas que existen en local
      const [cloudCols] = await cloud.query(`SHOW COLUMNS FROM \`${table}\``);
      const cloudColNames = cloudCols.map(c => c.Field);
      const sharedCols = localColNames.filter(c => cloudColNames.includes(c));

      if (sharedCols.length === 0) {
        await local.query(`DELETE FROM \`${table}\``);
        console.log('0 columnas compartidas');
        continue;
      }

      const colList = sharedCols.map(c => '`' + c + '`').join(', ');
      const [rows] = await cloud.query(`SELECT ${colList} FROM \`${table}\``);

      if (rows.length === 0) {
        await local.query(`DELETE FROM \`${table}\``);
        console.log('0 registros (tabla vacía)');
        continue;
      }

      // Limpiar tabla local
      await local.query(`DELETE FROM \`${table}\``);

      // Insertar datos del cloud en local (solo columnas compartidas)
      const placeholders = sharedCols.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of rows) {
        try {
          const values = sharedCols.map(c => row[c]);
          await local.query(sql, values);
          inserted++;
        } catch (rowErr) {
          // Saltar filas con errores (JSON inválido, etc.)
        }
      }

      const skipped = rows.length - inserted;
      const msg = skipped > 0 ? ` (${skipped} filas omitidas)` : '';
      console.log(`✅ ${inserted} registros${msg}`);
      totalRows += inserted;
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  // Reactivar foreign keys
  await local.query('SET FOREIGN_KEY_CHECKS=1');
  await local.query('SET UNIQUE_CHECKS=1');

  // Cerrar conexiones
  await cloud.end();
  await local.end();

  console.log(`\n✨ Sincronización completada: ${totalRows} registros totales`);
  console.log('   Cloud (Aiven) → Local MySQL\n');
}

sync().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
