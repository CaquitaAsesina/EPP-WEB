// ============================================================
// Service: Tallas
// ============================================================
const db = require('../config/database');

class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'ValidationError'; }
}

function requireField(val, label) {
  if (!val || (typeof val === 'string' && !val.trim())) {
    throw new ValidationError(`${label} es obligatorio`);
  }
}

let tallaCache = { data: null, ts: 0 };
const CACHE_TTL = 10000;

class TallaService {
  static invalidateCache() { tallaCache = { data: null, ts: 0 }; }

  static async listarActivas() {
    const now = Date.now();
    if (tallaCache.data && (now - tallaCache.ts) < CACHE_TTL) return tallaCache.data;
    const rows = await db.query(`SELECT * FROM tallas WHERE estado = 'ACTIVO' ORDER BY orden`);
    tallaCache = { data: rows, ts: now };
    return rows;
  }

  static async listarTodas() {
    return db.query(`SELECT * FROM tallas ORDER BY orden`);
  }

  static async obtenerPorId(id) {
    return db.fetchone(`SELECT * FROM tallas WHERE id = ?`, [id]);
  }

  static async crear({ nombre, orden }, usuarioActual) {
    requireField(nombre, 'Nombre');
    const result = await db.execute(
      `INSERT INTO tallas (nombre, orden) VALUES (?, ?)`,
      [nombre.trim(), orden || 0]
    );
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'tallas', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ nombre, orden })]
      );
    }
    return { id: result.insertId };
  }

  static async actualizar(id, { nombre, orden, estado }, usuarioActual) {
    requireField(nombre, 'Nombre');
    const anterior = await db.fetchone(`SELECT * FROM tallas WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('Talla no encontrada');
    await db.execute(
      `UPDATE tallas SET nombre=?, orden=?, estado=? WHERE id=?`,
      [nombre.trim(), orden || 0, estado || anterior.estado, id]
    );
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'UPDATE', 'tallas', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ nombre: anterior.nombre }), JSON.stringify({ nombre, estado: estado || anterior.estado })]
      );
    }
    return { success: true };
  }

  static async eliminar(id, usuarioActual) {
    const anterior = await db.fetchone(`SELECT * FROM tallas WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('Talla no encontrada');
    const tieneMovimientos = await db.fetchone(`
      SELECT 1 FROM (
        SELECT talla_id FROM stock_inicial WHERE talla_id = ?
        UNION ALL
        SELECT talla_id FROM ingresos WHERE talla_id = ?
        UNION ALL
        SELECT talla_id FROM entregas WHERE talla_id = ?
        UNION ALL
        SELECT talla_id FROM devoluciones WHERE talla_id = ?
        LIMIT 1
      ) t`, [id, id, id, id]);
    if (tieneMovimientos) {
      await db.execute(`UPDATE tallas SET estado = 'INACTIVO' WHERE id = ?`, [id]);
    } else {
      await db.execute(`DELETE FROM tallas WHERE id = ?`, [id]);
    }
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id) VALUES (?, ?, 'DELETE', 'tallas', ?)`,
        [usuarioActual.id, usuarioActual.nombre, id]
      );
    }
    return { success: true };
  }
}

module.exports = TallaService;
