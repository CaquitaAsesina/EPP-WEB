// ============================================================
// Service: Entregas (con lógica MUDA)
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

class EntregaService {
  static SELECT_BASE = `
    SELECT en.*, tr.nombre AS trabajador_nombre, tr.dni AS trabajador_dni,
           e.nombre AS epp_nombre, t.nombre AS talla_nombre, u.nombre AS usuario_nombre
    FROM entregas en
    JOIN trabajadores tr ON tr.id = en.trabajador_id
    JOIN epp e ON e.id = en.epp_id
    JOIN tallas t ON t.id = en.talla_id
    LEFT JOIN usuarios u ON u.id = en.usuario_id
  `;

  static async listar(filtros = {}) {
    let sql = this.SELECT_BASE + ' WHERE 1=1';
    const params = [];
    if (filtros.epp_id) { sql += ' AND en.epp_id = ?'; params.push(filtros.epp_id); }
    if (filtros.talla_id) { sql += ' AND en.talla_id = ?'; params.push(filtros.talla_id); }
    if (filtros.trabajador_id) { sql += ' AND en.trabajador_id = ?'; params.push(filtros.trabajador_id); }
    if (filtros.estado) { sql += ' AND en.estado = ?'; params.push(filtros.estado); }
    if (filtros.fecha_desde) { sql += ' AND en.fecha >= ?'; params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND en.fecha <= ?'; params.push(filtros.fecha_hasta); }
    sql += ' ORDER BY en.fecha DESC';
    return db.query(sql, params);
  }

  static async obtenerPorId(id) {
    return db.fetchone(this.SELECT_BASE + ' WHERE en.id = ?', [id]);
  }

  static async crear({ periodo, trabajador_id, epp_id, talla_id, cantidad }, usuarioActual) {
    requireField(periodo, 'Período');
    requireField(trabajador_id, 'Trabajador');
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    const cant = positiveInt(cantidad, 'Cantidad');

    // Validar stock
    const stock = await InventarioService.stockDisponible(periodo, epp_id, talla_id);
    if (cant > stock) {
      throw new ValidationError(`Stock insuficiente: disponible ${stock}, solicitado ${cant}`);
    }

    const result = await db.execute(
      `INSERT INTO entregas (periodo, trabajador_id, epp_id, talla_id, cantidad, usuario_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [periodo, trabajador_id, epp_id, talla_id, cant, usuarioActual ? usuarioActual.id : null]
    );

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'entregas', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ periodo, trabajador_id, epp_id, talla_id, cantidad: cant })]
      );
    }
    return { id: result.insertId };
  }

  // Crear entrega MUDA (solo Pantalón, Polo, Chaleco, Guantes)
  static async crearMuda({ periodo, trabajador_id, talla_id }, usuarioActual) {
    requireField(periodo, 'Período');
    requireField(trabajador_id, 'Trabajador');
    requireField(talla_id, 'Talla');

    const eppActivos = await db.query(`SELECT id, nombre FROM epp WHERE estado = 'ACTIVO' AND nombre IN ('Pantal\u00f3n', 'Polo', 'Chaleco', 'Guantes') ORDER BY nombre`);
    if (eppActivos.length === 0) throw new ValidationError('No hay EPP de MUDA activos (Pantalón, Polo, Chaleco, Guantes)');

    const resultados = [];
    await db.transaction(async (conn) => {
      for (const epp of eppActivos) {
        // Validar stock
        const [stockRow] = await conn.query(`
          SELECT
            COALESCE((SELECT cantidad FROM stock_inicial WHERE periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS stock_inicial,
            COALESCE((SELECT SUM(cantidad) FROM ingresos WHERE estado = 'ACTIVO' AND periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS ingresos,
            COALESCE((SELECT SUM(cantidad) FROM entregas WHERE estado = 'ACTIVO' AND periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS entregas,
            COALESCE((SELECT SUM(cantidad) FROM devoluciones WHERE estado_registro = 'ACTIVO' AND estado = 'LAVADO' AND periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS lavados
        `, [periodo, epp.id, talla_id, periodo, epp.id, talla_id, periodo, epp.id, talla_id, periodo, epp.id, talla_id]);
        const stock = stockRow.stock_inicial + stockRow.ingresos - stockRow.entregas + stockRow.lavados;
        if (stock <= 0) {
          throw new ValidationError(`Stock insuficiente para ${epp.nombre}: disponible ${stock}`);
        }

        const [result] = await conn.execute(
          `INSERT INTO entregas (periodo, trabajador_id, epp_id, talla_id, cantidad, usuario_id) VALUES (?, ?, ?, ?, 1, ?)`,
          [periodo, trabajador_id, epp.id, talla_id, usuarioActual ? usuarioActual.id : null]
        );
        resultados.push({ id: result.insertId, epp: epp.nombre, cantidad: 1 });
      }
    });

    if (usuarioActual && resultados.length > 0) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'entregas', NULL, ?)`,
        [usuarioActual.id, usuarioActual.nombre, JSON.stringify({ tipo: 'MUDA', trabajador_id, talla_id, entregas: resultados.length })]
      );
    }
    return resultados;
  }

  static async actualizar(id, { periodo, trabajador_id, epp_id, talla_id, cantidad }, usuarioActual) {
    const anterior = await this.obtenerPorId(id);
    if (!anterior) throw new ValidationError('Entrega no encontrada');
    if (anterior.estado === 'ANULADO') throw new ValidationError('No se puede editar una entrega anulada');

    requireField(periodo, 'Período');
    requireField(trabajador_id, 'Trabajador');
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    const cant = positiveInt(cantidad, 'Cantidad');

    // Validar stock (restar la anterior y sumar la nueva)
    const stock = await InventarioService.stockDisponible(periodo, epp_id, talla_id);
    if (cant > stock + anterior.cantidad) {
      throw new ValidationError(`Stock insuficiente: disponible ${stock + anterior.cantidad}, solicitado ${cant}`);
    }

    await db.execute(
      `UPDATE entregas SET periodo=?, trabajador_id=?, epp_id=?, talla_id=?, cantidad=? WHERE id=?`,
      [periodo, trabajador_id, epp_id, talla_id, cant, id]
    );

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'UPDATE', 'entregas', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ cantidad: anterior.cantidad }), JSON.stringify({ cantidad: cant })]
      );
    }
    return { success: true };
  }

  static async anular(id, usuarioActual) {
    const anterior = await this.obtenerPorId(id);
    if (!anterior) throw new ValidationError('Entrega no encontrada');
    if (anterior.estado === 'ANULADO') throw new ValidationError('Ya está anulada');

    await db.execute(`UPDATE entregas SET estado = 'ANULADO' WHERE id = ?`, [id]);

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'ANULAR', 'entregas', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ estado: 'ACTIVO' }), JSON.stringify({ estado: 'ANULADO' })]
      );
    }
    return { success: true };
  }
}

module.exports = EntregaService;
