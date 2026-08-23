// ============================================================
// Service: EPP
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

// Cache simple con TTL 10s
let eppCache = { data: null, ts: 0 };
const CACHE_TTL = 10000;

class EppService {
  static invalidateCache() { eppCache = { data: null, ts: 0 }; }

  static async listarActivos() {
    const now = Date.now();
    if (eppCache.data && (now - eppCache.ts) < CACHE_TTL) return eppCache.data;
    const rows = await db.query(`SELECT * FROM epp WHERE estado = 'ACTIVO' ORDER BY nombre`);
    eppCache = { data: rows, ts: now };
    return rows;
  }

  static async listarTodos() {
    return db.query(`SELECT * FROM epp ORDER BY id`);
  }

  // Trae todas las tallas de todos los EPP en UNA sola consulta
  static async tallasPorEpp() {
    const rows = await db.query(`
      SELECT et.epp_id, e.nombre AS epp_nombre, t.id AS talla_id, t.nombre AS talla_nombre, t.orden
      FROM epp_tallas et
      JOIN epp e ON e.id = et.epp_id
      JOIN tallas t ON t.id = et.talla_id
      WHERE e.estado = 'ACTIVO' AND t.estado = 'ACTIVO'
      ORDER BY e.nombre, t.orden
    `);
    const map = {};
    for (const r of rows) {
      if (!map[r.epp_id]) map[r.epp_id] = { epp_id: r.epp_id, epp_nombre: r.epp_nombre, tallas: [] };
      map[r.epp_id].tallas.push({ id: r.talla_id, nombre: r.talla_nombre, orden: r.orden });
    }
    return Object.values(map);
  }

  static async crear({ nombre, descripcion, tallas }, usuarioActual) {
    requireField(nombre, 'Nombre');
    const result = await db.execute(
      `INSERT INTO epp (nombre, descripcion) VALUES (?, ?)`,
      [nombre.trim(), descripcion || null]
    );
    const eppId = result.insertId;
    // Asociar tallas
    if (tallas && tallas.length > 0) {
      for (const tallaId of tallas) {
        await db.execute(`INSERT IGNORE INTO epp_tallas (epp_id, talla_id) VALUES (?, ?)`, [eppId, tallaId]);
      }
    }
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'epp', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, eppId, JSON.stringify({ nombre, tallas })]
      );
    }
    return { id: eppId };
  }

  static async actualizar(id, { nombre, descripcion, estado, tallas }, usuarioActual) {
    requireField(nombre, 'Nombre');
    const anterior = await db.fetchone(`SELECT * FROM epp WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('EPP no encontrado');

    await db.execute(
      `UPDATE epp SET nombre=?, descripcion=?, estado=? WHERE id=?`,
      [nombre.trim(), descripcion || null, estado || anterior.estado, id]
    );

    // Actualizar tallas asociadas
    if (tallas !== undefined) {
      await db.execute(`DELETE FROM epp_tallas WHERE epp_id = ?`, [id]);
      if (tallas && tallas.length > 0) {
        for (const tallaId of tallas) {
          await db.execute(`INSERT IGNORE INTO epp_tallas (epp_id, talla_id) VALUES (?, ?)`, [id, tallaId]);
        }
      }
    }

    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'UPDATE', 'epp', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ nombre: anterior.nombre }), JSON.stringify({ nombre, estado: estado || anterior.estado })]
      );
    }
    return { success: true };
  }

  static async eliminar(id, usuarioActual) {
    const anterior = await db.fetchone(`SELECT * FROM epp WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('EPP no encontrado');
    // Verificar si tiene movimientos
    const tieneMovimientos = await db.fetchone(`
      SELECT 1 FROM (
        SELECT epp_id FROM stock_inicial WHERE epp_id = ?
        UNION ALL
        SELECT epp_id FROM ingresos WHERE epp_id = ?
        UNION ALL
        SELECT epp_id FROM entregas WHERE epp_id = ?
        UNION ALL
        SELECT epp_id FROM devoluciones WHERE epp_id = ?
        LIMIT 1
      ) t`, [id, id, id, id]);
    if (tieneMovimientos) {
      await db.execute(`UPDATE epp SET estado = 'INACTIVO' WHERE id = ?`, [id]);
    } else {
      await db.execute(`DELETE FROM epp WHERE id = ?`, [id]);
    }
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id) VALUES (?, ?, 'DELETE', 'epp', ?)`,
        [usuarioActual.id, usuarioActual.nombre, id]
      );
    }
    return { success: true };
  }
}

module.exports = EppService;
