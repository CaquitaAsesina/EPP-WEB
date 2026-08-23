// ============================================================
// Service: Trabajadores
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

function validarDNI(dni) {
  if (!/^\d{7,12}$/.test(dni)) {
    throw new ValidationError('DNI debe tener entre 7 y 12 dígitos');
  }
}

let trabajadorCache = { data: null, ts: 0 };
const CACHE_TTL = 10000;

class TrabajadorService {
  static invalidateCache() { trabajadorCache = { data: null, ts: 0 }; }

  static async listarActivos() {
    const now = Date.now();
    if (trabajadorCache.data && (now - trabajadorCache.ts) < CACHE_TTL) return trabajadorCache.data;
    const rows = await db.query(`SELECT * FROM trabajadores WHERE estado = 'ACTIVO' ORDER BY nombre`);
    trabajadorCache = { data: rows, ts: now };
    return rows;
  }

  static async listarTodos() {
    return db.query(`SELECT * FROM trabajadores ORDER BY id`);
  }

  static async buscar(q) {
    if (!q) return this.listarActivos();
    return db.query(
      `SELECT * FROM trabajadores WHERE (nombre LIKE ? OR dni LIKE ? OR codigo LIKE ?) ORDER BY nombre`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
  }

  static async generarCodigo() {
    const last = await db.fetchone(`SELECT codigo FROM trabajadores ORDER BY id DESC LIMIT 1`);
    if (!last || !last.codigo) return 'TRAB-001';
    const num = parseInt(last.codigo.replace('TRAB-', ''), 10) + 1;
    return `TRAB-${String(num).padStart(3, '0')}`;
  }

  static async crear({ nombre, dni, cargo, area }, usuarioActual) {
    requireField(nombre, 'Nombre');
    requireField(dni, 'DNI');
    validarDNI(dni);
    const codigo = await this.generarCodigo();
    const result = await db.execute(
      `INSERT INTO trabajadores (codigo, nombre, dni, cargo, area) VALUES (?, ?, ?, ?, ?)`,
      [codigo, nombre.trim(), dni.trim(), cargo || null, area || null]
    );
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'trabajadores', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ codigo, nombre, dni, cargo, area })]
      );
    }
    return { id: result.insertId, codigo };
  }

  static async actualizar(id, { nombre, dni, cargo, area, estado }, usuarioActual) {
    requireField(nombre, 'Nombre');
    requireField(dni, 'DNI');
    validarDNI(dni);
    const anterior = await db.fetchone(`SELECT * FROM trabajadores WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('Trabajador no encontrado');
    await db.execute(
      `UPDATE trabajadores SET nombre=?, dni=?, cargo=?, area=?, estado=? WHERE id=?`,
      [nombre.trim(), dni.trim(), cargo || null, area || null, estado || anterior.estado, id]
    );
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'UPDATE', 'trabajadores', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ nombre: anterior.nombre, dni: anterior.dni }), JSON.stringify({ nombre, dni, estado: estado || anterior.estado })]
      );
    }
    return { success: true };
  }

  static async eliminar(id, usuarioActual) {
    const anterior = await db.fetchone(`SELECT * FROM trabajadores WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('Trabajador no encontrado');
    const tieneMovimientos = await db.fetchone(`
      SELECT 1 FROM (
        SELECT trabajador_id FROM entregas WHERE trabajador_id = ?
        UNION ALL
        SELECT trabajador_id FROM devoluciones WHERE trabajador_id = ?
        LIMIT 1
      ) t`, [id, id]);
    if (tieneMovimientos) {
      await db.execute(`UPDATE trabajadores SET estado = 'INACTIVO' WHERE id = ?`, [id]);
    } else {
      await db.execute(`DELETE FROM trabajadores WHERE id = ?`, [id]);
    }
    this.invalidateCache();
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id) VALUES (?, ?, 'DELETE', 'trabajadores', ?)`,
        [usuarioActual.id, usuarioActual.nombre, id]
      );
    }
    return { success: true };
  }
}

module.exports = TrabajadorService;
