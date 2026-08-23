// ============================================================
// Service: Períodos
// ============================================================
const db = require('../config/database');

class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'ValidationError'; }
}

class PeriodoService {
  static async listar() {
    return db.query(`SELECT * FROM periodos ORDER BY fecha DESC`);
  }

  static async activo() {
    return db.fetchone(`SELECT * FROM periodos WHERE activo = 1 ORDER BY fecha DESC LIMIT 1`);
  }

  static async crear({ fecha }, usuarioActual) {
    if (!fecha) throw new ValidationError('La fecha es obligatoria');
    // Desactivar el período activo anterior
    await db.execute(`UPDATE periodos SET activo = 0`);

    // Crear nuevo período activo
    const result = await db.execute(
      `INSERT INTO periodos (fecha, activo) VALUES (?, 1)`,
      [fecha]
    );

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'periodos', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ fecha, activo: 1 })]
      );
    }
    return { id: result.insertId };
  }

  static async eliminar(id, usuarioActual) {
    const periodo = await db.fetchone(`SELECT * FROM periodos WHERE id = ?`, [id]);
    if (!periodo) throw new ValidationError('Período no encontrado');

    // Contar registros antes de eliminar
    const [checks] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM stock_inicial WHERE periodo = ?) AS stock,
        (SELECT COUNT(*) FROM ingresos WHERE periodo = ?) AS ingresos,
        (SELECT COUNT(*) FROM entregas WHERE periodo = ?) AS entregas,
        (SELECT COUNT(*) FROM devoluciones WHERE periodo = ?) AS devoluciones
    `, [periodo.fecha, periodo.fecha, periodo.fecha, periodo.fecha]);
    const c = checks;
    const totalRegistros = parseInt(c.stock||0) + parseInt(c.ingresos||0) + parseInt(c.entregas||0) + parseInt(c.devoluciones||0);

    // Eliminar TODOS los registros asociados al período
    // 1. Historial de estados de devoluciones (cascade manual primero)
    await db.execute(`DELETE FROM devolucion_estados WHERE devolucion_id IN (SELECT id FROM devoluciones WHERE periodo = ?)`, [periodo.fecha]);
    // 2. Devoluciones
    await db.execute(`DELETE FROM devoluciones WHERE periodo = ?`, [periodo.fecha]);
    // 3. Entregas
    await db.execute(`DELETE FROM entregas WHERE periodo = ?`, [periodo.fecha]);
    // 4. Ingresos
    await db.execute(`DELETE FROM ingresos WHERE periodo = ?`, [periodo.fecha]);
    // 5. Stock inicial
    await db.execute(`DELETE FROM stock_inicial WHERE periodo = ?`, [periodo.fecha]);
    // 6. El período en sí
    await db.execute(`DELETE FROM periodos WHERE id = ?`, [id]);

    // Auditar
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores) VALUES (?, ?, 'DELETE', 'periodos', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({
          fecha: periodo.fecha,
          registros_eliminados: {
            stock: parseInt(c.stock||0),
            ingresos: parseInt(c.ingresos||0),
            entregas: parseInt(c.entregas||0),
            devoluciones: parseInt(c.devoluciones||0),
            total: totalRegistros
          }
        })]
      );
    }
    return { success: true, accion: 'eliminado', registros: totalRegistros };
  }

  static async cerrar(id, usuarioActual) {
    const periodo = await db.fetchone(`SELECT * FROM periodos WHERE id = ?`, [id]);
    if (!periodo) throw new ValidationError('Período no encontrado');
    await db.execute(`UPDATE periodos SET activo = 0 WHERE id = ?`, [id]);
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'CLOSE', 'periodos', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ fecha: periodo.fecha, activo: 0 })]
      );
    }
    return { success: true, accion: 'cerrado' };
  }
}

module.exports = PeriodoService;
