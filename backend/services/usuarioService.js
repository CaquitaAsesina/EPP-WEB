// ============================================================
// Service: Usuarios
// ============================================================
const db = require('../config/database');
const crypto = require('crypto');
const { generateToken } = require('../middleware/auth');

class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'ValidationError'; }
}

function hashPassword(username, password) {
  return crypto.createHash('sha256')
    .update(`${username}:epp2026:${password}`)
    .digest('hex');
}

function requireField(val, label) {
  if (!val || (typeof val === 'string' && !val.trim())) {
    throw new ValidationError(`${label} es obligatorio`);
  }
}

class UsuarioService {
  static async login(username, password) {
    requireField(username, 'Usuario');
    requireField(password, 'Contraseña');
    const hash = hashPassword(username, password);
    const user = await db.fetchone(
      `SELECT * FROM usuarios WHERE username = ? AND password_hash = ? AND estado = 'ACTIVO'`,
      [username, hash]
    );
    if (!user) throw new ValidationError('Credenciales incorrectas');
    // Registrar login en auditoría
    await db.query(
      `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id) VALUES (?, ?, 'LOGIN', 'usuarios', ?)`,
      [user.id, user.nombre, user.id]
    );
    const token = generateToken(user);
    return { token, user: { id: user.id, nombre: user.nombre, username: user.username, rol: user.rol } };
  }

  static async listar() {
    return db.query(`SELECT id, nombre, username, rol, estado, creado_el FROM usuarios ORDER BY id`);
  }

  static async obtenerPorId(id) {
    return db.fetchone(`SELECT id, nombre, username, rol, estado, creado_el FROM usuarios WHERE id = ?`, [id]);
  }

  static async crear({ nombre, username, password, rol }, usuarioActual) {
    requireField(nombre, 'Nombre');
    requireField(username, 'Usuario');
    requireField(password, 'Contraseña');
    requireField(rol, 'Rol');
    if (!['ADMIN', 'ALMACEN', 'CONSULTA'].includes(rol)) throw new ValidationError('Rol inválido');
    const hash = hashPassword(username, password);
    const result = await db.execute(
      `INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES (?, ?, ?, ?)`,
      [nombre.trim(), username.trim(), hash, rol]
    );
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'INSERT', 'usuarios', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, result.insertId, JSON.stringify({ nombre, username, rol })]
      );
    }
    return { id: result.insertId };
  }

  static async actualizar(id, { nombre, username, password, rol, estado }, usuarioActual) {
    requireField(nombre, 'Nombre');
    requireField(username, 'Usuario');
    requireField(rol, 'Rol');
    if (!['ADMIN', 'ALMACEN', 'CONSULTA'].includes(rol)) throw new ValidationError('Rol inválido');

    const anterior = await db.fetchone(`SELECT * FROM usuarios WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('Usuario no encontrado');

    let sql, params;
    if (password) {
      const hash = hashPassword(username, password);
      sql = `UPDATE usuarios SET nombre=?, username=?, password_hash=?, rol=?, estado=? WHERE id=?`;
      params = [nombre.trim(), username.trim(), hash, rol, estado || anterior.estado, id];
    } else {
      sql = `UPDATE usuarios SET nombre=?, username=?, rol=?, estado=? WHERE id=?`;
      params = [nombre.trim(), username.trim(), rol, estado || anterior.estado, id];
    }
    await db.execute(sql, params);
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'UPDATE', 'usuarios', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ nombre: anterior.nombre, username: anterior.username, rol: anterior.rol, estado: anterior.estado }), JSON.stringify({ nombre, username, rol, estado: estado || anterior.estado })]
      );
    }
    return { success: true };
  }

  static async eliminar(id, usuarioActual) {
    const anterior = await db.fetchone(`SELECT * FROM usuarios WHERE id = ?`, [id]);
    if (!anterior) throw new ValidationError('Usuario no encontrado');
    // No puedes desactivarte a ti mismo
    if (usuarioActual && parseInt(id) === usuarioActual.id) {
      throw new ValidationError('No puedes desactivarte a ti mismo');
    }
    await db.execute(`UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?`, [id]);
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos) VALUES (?, ?, 'ANULAR', 'usuarios', ?, ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ estado: 'ACTIVO' }), JSON.stringify({ estado: 'INACTIVO' })]
      );
    }
    return { success: true };
  }

  static async activar(id, usuarioActual) {
    await db.execute(`UPDATE usuarios SET estado = 'ACTIVO' WHERE id = ?`, [id]);
    if (usuarioActual) {
      await db.query(
        `INSERT INTO auditoria (usuario_id, usuario_nombre, accion, tabla, registro_id, datos_nuevos) VALUES (?, ?, 'UPDATE', 'usuarios', ?, ?)`,
        [usuarioActual.id, usuarioActual.nombre, id, JSON.stringify({ estado: 'ACTIVO' })]
      );
    }
    return { success: true };
  }
}

module.exports = UsuarioService;
