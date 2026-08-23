// ============================================================
// Service: Ingresos
// ============================================================
const db = require('../config/database');
const InventarioService = require('./inventarioService');

class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'ValidationError'; }
}

function requireField(val, label) {
  if (!val || (typeof val === 'string' && !val.trim())) {
    throw new ValidationError(`${label} es obligatorio`);
  }
}

function positiveInt(val, label) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n <= 0) throw new ValidationError(`${label} debe ser un número positivo`);
  return n;
}

class IngresoService {
  static SELECT_BASE = `
    SELECT i.*, e.nombre AS epp_nombre, t.nombre AS talla_nombre, u.nombre AS usuario_nombre
    FROM ingresos i
    JOIN epp e ON e.id = i.epp_id
    JOIN tallas t ON t.id = i.talla_id
    LEFT JOIN usuarios u ON u.id = i.usuario_id
  `;

  static async listar(filtros = {}) {
    let sql = this.SELECT_BASE + ' WHERE 1=1';
    const params = [];
    if (filtros.epp_id) { sql += ' AND i.epp_id = ?'; params.push(filtros.epp_id); }
    if (filtros.talla_id) { sql += ' AND i.talla_id = ?'; params.push(filtros.talla_id); }
    if (filtros.estado) { sql += ' AND i.estado = ?'; params.push(filtros.estado); }
    if (filtros.fecha_desde) { sql += ' AND i.fecha >= ?'; params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND i.fecha <= ?'; params.push(filtros.fecha_hasta); }
    sql += ' ORDER BY i.fecha DESC';
    return db.query(sql, params);
  }

  static async obtenerPorId(id) {
    return db.fetchone(this.SELECT_BASE + ' WHERE i.id = ?', [id]);
  }

  static async crear({ periodo, epp_id, talla_id, cantidad }, usuarioActual) {
    requireField(periodo, 'Período');
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    const cant = positiveInt(cantidad, 'Cantidad');

    const result = await db.execute(
      `INSERT INTO ingresos (periodo, epp_id, talla_id, cantidad, usuario_id) VALUES (?, ?, ?, ?, ?)`,
      [periodo, epp_id, talla_id, cant, usuarioActual ? usuarioActual.id : null]
    );

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'ingresos', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ periodo, epp_id, talla_id, cantidad: cant })]
      );
    }
    return { id: result.insertId };
  }

  static async actualizar(id, { periodo, epp_id, talla_id, cantidad }, usuarioActual) {
    const anterior = await this.obtenerPorId(id);
    if (!anterior) throw new ValidationError('Ingreso no encontrado');
    if (anterior.estado === 'ANULADO') throw new ValidationError('No se puede editar un ingreso anulado');

    requireField(periodo, 'Período');
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    const cant = positiveInt(cantidad, 'Cantidad');

    await db.execute(
      `UPDATE ingresos SET periodo=?, epp_id=?, talla_id=?, cantidad=? WHERE id=?`,
      [periodo, epp_id, talla_id, cant, id]
    );

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'UPDATE', 'ingresos', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ cantidad: anterior.cantidad }), JSON.stringify({ cantidad: cant })]
      );
    }
    return { success: true };
  }

  static async anular(id, usuarioActual) {
    const anterior = await this.obtenerPorId(id);
    if (!anterior) throw new ValidationError('Ingreso no encontrado');
    if (anterior.estado === 'ANULADO') throw new ValidationError('Ya está anulado');

    await db.execute(`UPDATE ingresos SET estado = 'ANULADO' WHERE id = ?`, [id]);

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'ANULAR', 'ingresos', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ estado: 'ACTIVO' }), JSON.stringify({ estado: 'ANULADO' })]
      );
    }
    return { success: true };
  }
}

module.exports = IngresoService;
