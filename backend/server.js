// ============================================================
// Server - Punto de entrada
// ============================================================
const app = require('./app');
const config = require('./config/config');
const db = require('./config/database');
const path = require('path');

async function startServer() {
  try {
    console.log('🚀 Iniciando Sistema de Inventario EPP...');

    // 1. Verificar/conectar a BD
    await db.getPool();
    console.log('✅ Conexión a MySQL establecida');

    // 2. Auto-inicializar BD si es necesario
    await db.ensureDatabase();

    // 3. Verificar si las tablas existen
    try {
      const tables = await db.query("SHOW TABLES LIKE 'usuarios'");
      if (tables.length === 0) {
        console.log('📦 Base de datos vacía, ejecutando schema...');
        await db.runSqlFile(path.join(__dirname, '..', 'database', 'schema.sql'));
        console.log('📦 Ejecutando seed...');
        await db.runSqlFile(path.join(__dirname, '..', 'database', 'seed.sql'));
        console.log('✅ Base de datos inicializada con datos semilla');
      } else {
        console.log('✅ Base de datos ya inicializada');
      }
    } catch (e) {
      console.log('⚠️ No se pudo verificar tablas, intentando crear...');
      await db.runSqlFile(path.join(__dirname, '..', 'database', 'schema.sql'));
      await db.runSqlFile(path.join(__dirname, '..', 'database', 'seed.sql'));
    }

    // 4. Asegurar índices de rendimiento
    await db.ensureIndexes();
    console.log('✅ Índices verificados');

    // 5. Iniciar servidor HTTP
    const PORT = config.server_port || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🌐 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📊 Sistema de Inventario EPP listo\n`);
    });

  } catch (err) {
    console.error('❌ Error fatal al iniciar:', err.message);
    process.exit(1);
  }
}

startServer();
