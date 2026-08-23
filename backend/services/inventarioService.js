// ============================================================
// Service: Inventario (Stock Inicial + Stock Sistemático + Dashboard)
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

let eppCache = null;
let tallaCache = null;

class InventarioService {
  // ---- Stock Inicial ----
  static async listarStockInicial(periodo) {
    requireField(periodo, 'Período');
    return db.query(`
      SELECT si.*, e.nombre AS epp_nombre, t.nombre AS talla_nombre, u.nombre AS usuario_nombre
      FROM stock_inicial si
      JOIN epp e ON e.id = si.epp_id
      JOIN tallas t ON t.id = si.talla_id
      LEFT JOIN usuarios u ON u.id = si.usuario_id
      WHERE si.periodo = ?
      ORDER BY e.nombre, t.orden
    `, [periodo]);
  }

  static async registrarStockInicial({ periodo, epp_id, talla_id, cantidad }, usuarioActual) {
    requireField(periodo, 'Período');
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    if (cantidad === undefined || cantidad === null || parseInt(cantidad) < 0) {
      throw new ValidationError('La cantidad debe ser ≥ 0');
    }
    // UPSERT
    await db.execute(`
      INSERT INTO stock_inicial (periodo, epp_id, talla_id, cantidad, usuario_id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad), usuario_id = VALUES(usuario_id)
    `, [periodo, epp_id, talla_id, parseInt(cantidad), usuarioActual ? usuarioActual.id : null]);

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'stock_inicial', NULL, ?)`,
        [usuarioActual.id, usuarioActual.nombre, JSON.stringify({ periodo, epp_id, talla_id, cantidad })]
      );
    }
    return { success: true };
  }

  // ---- Cálculo de stock sistemático ----
  static async calcularStock(periodo, eppId, tallaId) {
    // Stock = Inicial + Ingresos(ACTIVOS) - Entregas(ACTIVAS) + Devoluciones(LAVADO y ACTIVO)
    const [row] = await db.query(`
      SELECT
        COALESCE((SELECT cantidad FROM stock_inicial WHERE periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS stock_inicial,
        COALESCE((SELECT SUM(cantidad) FROM ingresos WHERE estado = 'ACTIVO' AND periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS ingresos,
        COALESCE((SELECT SUM(cantidad) FROM entregas WHERE estado = 'ACTIVO' AND periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS entregas,
        COALESCE((SELECT SUM(cantidad) FROM devoluciones WHERE estado_registro = 'ACTIVO' AND estado = 'LAVADO' AND periodo = ? AND epp_id = ? AND talla_id = ?), 0) AS lavados
    `, [periodo, eppId, tallaId, periodo, eppId, tallaId, periodo, eppId, tallaId, periodo, eppId, tallaId]);

    const inicial = parseInt(row.stock_inicial) || 0;
    const ingresos = parseInt(row.ingresos) || 0;
    const entregas = parseInt(row.entregas) || 0;
    const lavados = parseInt(row.lavados) || 0;
    const sistematico = inicial + ingresos - entregas + lavados;

    return {
      stock_inicial: inicial,
      ingresos,
      entregas,
      lavados,
      sistematico
    };
  }

  // ---- Stock para una combinación específica (para validación de entregas) ----
  static async stockDisponible(periodo, eppId, tallaId) {
    const stock = await this.calcularStock(periodo, eppId, tallaId);
    return stock.sistematico;
  }

  // ---- Vista completa del sistemático ----
  static async vistaSistematica(periodo) {
    requireField(periodo, 'Período');

    // Obtener TODOS los EPP activos con sus tallas asignadas
    const eppConTallas = await db.query(`
      SELECT e.id AS epp_id, e.nombre AS epp_nombre, t.id AS talla_id, t.nombre AS talla_nombre, t.orden
      FROM epp e
      JOIN epp_tallas et ON et.epp_id = e.id
      JOIN tallas t ON t.id = et.talla_id
      WHERE e.estado = 'ACTIVO' AND t.estado = 'ACTIVO'
      ORDER BY e.nombre, t.orden
    `);

    const resultado = [];
    for (const c of eppConTallas) {
      const stock = await this.calcularStock(periodo, c.epp_id, c.talla_id);
      // Obtener inventario físico más reciente
      const fisico = await db.fetchone(`
        SELECT * FROM inventarios_fisicos
        WHERE epp_id = ? AND talla_id = ?
        ORDER BY fecha DESC LIMIT 1
      `, [c.epp_id, c.talla_id]);

      const cantidadFisica = fisico ? fisico.cantidad_fisica : null;
      const diferencia = cantidadFisica !== null ? cantidadFisica - stock.sistematico : null;
      let estado = 'SIN FÍSICO';
      if (diferencia !== null) {
        if (diferencia === 0) estado = 'CONFORME';
        else if (diferencia < 0) estado = 'FALTANTE';
        else estado = 'SOBRANTE';
      }

      resultado.push({
        epp_id: c.epp_id,
        epp_nombre: c.epp_nombre,
        talla_id: c.talla_id,
        talla_nombre: c.talla_nombre,
        ...stock,
        cantidad_fisica: cantidadFisica,
        diferencia,
        estado
      });
    }
    return resultado;
  }

  // ---- Inventario Físico ----
  static async registrarInventarioFisico({ epp_id, talla_id, cantidad_fisica }, usuarioActual) {
    requireField(epp_id, 'EPP');
    requireField(talla_id, 'Talla');
    if (cantidad_fisica === undefined || cantidad_fisica === null || parseInt(cantidad_fisica) < 0) {
      throw new ValidationError('La cantidad física debe ser ≥ 0');
    }

    // Obtener período activo
    const periodo = await db.fetchone(`SELECT fecha FROM periodos WHERE activo = 1 ORDER BY fecha DESC LIMIT 1`);
    if (!periodo) throw new ValidationError('No hay período activo');

    const stock = await this.calcularStock(periodo.fecha, epp_id, talla_id);
    const sistematico = stock.sistematico;
    const diferencia = parseInt(cantidad_fisica) - sistematico;

    let tipo = 'CONFORME';
    if (diferencia < 0) tipo = 'FALTANTE';
    else if (diferencia > 0) tipo = 'SOBRANTE';

    const result = await db.execute(`
      INSERT INTO inventarios_fisicos (usuario_id, epp_id, talla_id, stock_sistematico, cantidad_fisica, diferencia, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [usuarioActual ? usuarioActual.id : null, epp_id, talla_id, sistematico, parseInt(cantidad_fisica), diferencia, tipo]);

    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INVENTARIO', 'inventarios_fisicos', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ epp_id, talla_id, stock_sistematico: sistematico, cantidad_fisica, diferencia, tipo })]
      );
    }
    return { id: result.insertId, stock_sistematico: sistematico, diferencia, tipo };
  }

  // ---- Dashboard ----
  static async dashboard(periodo) {
    const result = {
      totalEpp: 0,
      stockDisponible: 0,
      sucios: 0,
      enLavado: 0,
      lavados: 0,
      totalEntregas: 0,
      totalIngresos: 0,
      totalPerdidas: 0,
      porEpp: [],
      ingresosPorEpp: [],
      entregasPorEpp: []
    };

    if (!periodo) return result;

    // Total EPP activos
    const [r1] = await db.query(`SELECT COUNT(*) AS total FROM epp WHERE estado = 'ACTIVO'`);
    result.totalEpp = r1.total;

    // Stock disponible total
    const [r2] = await db.query(`
      SELECT
        COALESCE(SUM(si.cantidad), 0) AS stock_inicial,
        COALESCE((SELECT SUM(cantidad) FROM ingresos WHERE estado = 'ACTIVO' AND periodo = ?), 0) AS ingresos,
        COALESCE((SELECT SUM(cantidad) FROM entregas WHERE estado = 'ACTIVO' AND periodo = ?), 0) AS entregas,
        COALESCE((SELECT SUM(cantidad) FROM devoluciones WHERE estado_registro = 'ACTIVO' AND estado = 'LAVADO' AND periodo = ?), 0) AS lavados
      FROM stock_inicial si WHERE si.periodo = ?
    `, [periodo, periodo, periodo, periodo]);
    result.stockDisponible = parseInt(r2.stock_inicial||0) + parseInt(r2.ingresos||0) - parseInt(r2.entregas||0) + parseInt(r2.lavados||0);

    // Sucios (devoluciones en estado SUCIO activas)
    const [r3] = await db.query(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM devoluciones WHERE estado = 'SUCIO' AND estado_registro = 'ACTIVO' AND periodo = ?`, [periodo]);
    result.sucios = parseInt(r3.total)||0;

    // En lavado
    const [r4] = await db.query(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM devoluciones WHERE estado = 'EN_LAVADO' AND estado_registro = 'ACTIVO' AND periodo = ?`, [periodo]);
    result.enLavado = parseInt(r4.total)||0;

    // Lavados (que ya sumaron al stock)
    const [r5] = await db.query(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM devoluciones WHERE estado = 'LAVADO' AND estado_registro = 'ACTIVO' AND periodo = ?`, [periodo]);
    result.lavados = parseInt(r5.total)||0;

    // Total entregas
    const [r6] = await db.query(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM entregas WHERE estado = 'ACTIVO' AND periodo = ?`, [periodo]);
    result.totalEntregas = parseInt(r6.total)||0;

    // Total ingresos
    const [r7] = await db.query(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM ingresos WHERE estado = 'ACTIVO' AND periodo = ?`, [periodo]);
    result.totalIngresos = parseInt(r7.total)||0;

    // Total pérdidas
    const [r8] = await db.query(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM devoluciones WHERE estado IN ('PERDIDO', 'DESCARTADO') AND estado_registro = 'ACTIVO' AND periodo = ?`, [periodo]);
    result.totalPerdidas = parseInt(r8.total)||0;

    // Por EPP: stock disponible
    result.porEpp = await db.query(`
      SELECT e.nombre,
        COALESCE(SUM(si.cantidad), 0) AS stock_inicial,
        COALESCE((SELECT SUM(cantidad) FROM ingresos WHERE estado = 'ACTIVO' AND periodo = ? AND epp_id = e.id), 0) AS ingresos,
        COALESCE((SELECT SUM(cantidad) FROM entregas WHERE estado = 'ACTIVO' AND periodo = ? AND epp_id = e.id), 0) AS entregas,
        COALESCE((SELECT SUM(cantidad) FROM devoluciones WHERE estado_registro = 'ACTIVO' AND estado = 'LAVADO' AND periodo = ? AND epp_id = e.id), 0) AS lavados
      FROM epp e
      LEFT JOIN stock_inicial si ON si.epp_id = e.id AND si.periodo = ?
      WHERE e.estado = 'ACTIVO'
      GROUP BY e.id, e.nombre
      ORDER BY e.nombre
    `, [periodo, periodo, periodo, periodo]);

    for (const e of result.porEpp) {
      e.stock_inicial = parseInt(e.stock_inicial)||0;
      e.ingresos = parseInt(e.ingresos)||0;
      e.entregas = parseInt(e.entregas)||0;
      e.lavados = parseInt(e.lavados)||0;
      e.stock = e.stock_inicial + e.ingresos - e.entregas + e.lavados;
    }

    // Ingresos por EPP
    result.ingresosPorEpp = await db.query(`
      SELECT e.nombre, COALESCE(SUM(i.cantidad), 0) AS total
      FROM epp e
      LEFT JOIN ingresos i ON i.epp_id = e.id AND i.estado = 'ACTIVO' AND i.periodo = ?
      WHERE e.estado = 'ACTIVO'
      GROUP BY e.id, e.nombre
      ORDER BY total DESC
    `, [periodo]);

    // Entregas por EPP
    result.entregasPorEpp = await db.query(`
      SELECT e.nombre, COALESCE(SUM(en.cantidad), 0) AS total
      FROM epp e
      LEFT JOIN entregas en ON en.epp_id = e.id AND en.estado = 'ACTIVO' AND en.periodo = ?
      WHERE e.estado = 'ACTIVO'
      GROUP BY e.id, e.nombre
      ORDER BY total DESC
    `, [periodo]);

    return result;
  }
}

module.exports = InventarioService;
