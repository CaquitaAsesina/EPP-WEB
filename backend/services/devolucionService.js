// ============================================================
// Service: Devoluciones (con máquina de estados)
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

function positiveInt(val, label) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n <= 0) throw new ValidationError(`${label} debe ser un número positivo`);
  return n;
}

// Transiciones válidas
const TRANSICIONES = {
  'SUCIO':      ['EN_LAVADO', 'DANADO', 'PERDIDO', 'DESCARTADO'],
  'EN_LAVADO':  ['LAVADO', 'DANADO', 'PERDIDO', 'DESCARTADO'],
  'LAVADO':     ['DANADO', 'PERDIDO', 'DESCARTADO'],
  'DANADO':     [],
  'PERDIDO':    [],
  'DESCARTADO': []
};

class DevolucionService {
  static SELECT_BASE = `
    SELECT d.*, tr.nombre AS trabajador_nombre, tr.dni AS trabajador_dni,
           e.nombre AS epp_nombre, t.nombre AS talla_nombre, u.nombre AS usuario_nombre
    FROM devoluciones d
    JOIN trabajadores tr ON tr.id = d.trabajador_id
    JOIN epp e ON e.id = d.epp_id
    JOIN tallas t ON t.id = d.talla_id
    LEFT JOIN usuarios u ON u.id = d.usuario_id
  `;

  static async listar(filtros = {}) {
    let sql = this.SELECT_BASE + ' WHERE 1=1';
    const params = [];
    if (filtros.epp_id) { sql += ' AND d.epp_id = ?'; params.push(filtros.epp_id); }
    if (filtros.talla_id) { sql += ' AND d.talla_id = ?'; params.push(filtros.talla_id); }
    if (filtros.trabajador_id) { sql += ' AND d.trabajador_id = ?'; params.push(filtros.trabajador_id); }
    if (filtros.estado) { const estados = filtros.estado.split(','); sql += ` AND d.estado IN (${estados.map(()=>'?').join(',')})`; params.push(...estados); }
    if (filtros.fecha_desde) { sql += ' AND d.fecha >= ?'; params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND d.fecha <= ?'; params.push(filtros.fecha_hasta); }
    sql += ' ORDER BY d.fecha DESC';
    return db.query(sql, params);
  }

  static async obtenerPorId(id) {
    return db.fetchone(this.SELECT_BASE + ' WHERE d.id = ?', [id]);
  }

  // Transiciones disponibles para un estado
  static transicionesDisponibles(estado) {
    return TRANSICIONES[estado] || [];
  }

  static async crear({ periodo, trabajador_id, epp_id, talla_id, cantidad }, usuarioActual) {
    requireField(periodo, 'Período');
    requireField(trabajador_id, 'Trabajador');
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    const cant = positiveInt(cantidad, 'Cantidad');

    // Nueva devolución siempre entra en estado SUCIO
    const result = await db.execute(
      `INSERT INTO devoluciones (periodo, trabajador_id, epp_id, talla_id, cantidad, estado, usuario_id) VALUES (?, ?, ?, ?, ?, 'SUCIO', ?)`,
      [periodo, trabajador_id, epp_id, talla_id, cant, usuarioActual ? usuarioActual.id : null]
    );

    // Registrar en historial
    await db.execute(
      `INSERT INTO devolucion_estados (devolucion_id, estado_anterior, estado_nuevo, usuario_id) VALUES (?, NULL, 'SUCIO', ?)`,
      [result.insertId, usuarioActual ? usuarioActual.id : null]
    );

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'devoluciones', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ periodo, trabajador_id, epp_id, talla_id, cantidad: cant, estado: 'SUCIO' })]
      );
    }
    return { id: result.insertId };
  }

  static async cambiarEstado(id, nuevoEstado, usuarioActual) {
    const dev = await this.obtenerPorId(id);
    if (!dev) throw new ValidationError('Devolución no encontrada');
    if (dev.estado_registro === 'ANULADO') throw new ValidationError('No se puede cambiar el estado de una devolución anulada');

    const transiciones = this.transicionesDisponibles(dev.estado);
    if (!transiciones.includes(nuevoEstado)) {
      throw new ValidationError(`Transición inválida: ${dev.estado} → ${nuevoEstado}. Válidas: ${transiciones.join(', ')}`);
    }

    await db.transaction(async (conn) => {
      await conn.execute(`UPDATE devoluciones SET estado = ? WHERE id = ?`, [nuevoEstado, id]);
      await conn.execute(
        `INSERT INTO devolucion_estados (devolucion_id, estado_anterior, estado_nuevo, usuario_id) VALUES (?, ?, ?, ?)`,
        [id, dev.estado, nuevoEstado, usuarioActual ? usuarioActual.id : null]
      );
    });

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'CAMBIO_ESTADO', 'devoluciones', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ estado: dev.estado }), JSON.stringify({ estado: nuevoEstado })]
      );
    }
    return { success: true, estado_anterior: dev.estado, estado_nuevo: nuevoEstado };
  }

  static async historialEstados(devolucionId) {
    return db.query(`
      SELECT de.*, u.nombre AS usuario_nombre
      FROM devolucion_estados de
      LEFT JOIN usuarios u ON u.id = de.usuario_id
      WHERE de.devolucion_id = ?
      ORDER BY de.fecha ASC
    `, [devolucionId]);
  }

  static async anular(id, usuarioActual) {
    const dev = await this.obtenerPorId(id);
    if (!dev) throw new ValidationError('Devolución no encontrada');
    if (dev.estado_registro === 'ANULADO') throw new ValidationError('Ya está anulada');

    await db.execute(`UPDATE devoluciones SET estado_registro = 'ANULADO' WHERE id = ?`, [id]);

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'ANULAR', 'devoluciones', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ estado_registro: 'ACTIVO' }), JSON.stringify({ estado_registro: 'ANULADO' })]
      );
    }
    return { success: true };
  }
}

module.exports = DevolucionService;
