// ============================================================
// Service: Auditoría
// ============================================================
const db = require('../config/database');

class AuditoriaService {
  static async listar(filtros = {}) {
    let sql = `SELECT * FROM auditoria WHERE 1=1`;
    const params = [];
    if (filtros.tabla) { sql += ' AND tabla = ?'; params.push(filtros.tabla); }
    if (filtros.accion) { sql += ' AND accion = ?'; params.push(filtros.accion); }
    if (filtros.usuario_id) { sql += ' AND usuario_id = ?'; params.push(filtros.usuario_id); }
    if (filtros.fecha_desde) { sql += ' AND fecha >= ?'; params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND fecha <= ?'; params.push(filtros.fecha_hasta); }
    sql += ' ORDER BY fecha DESC LIMIT 500';
    return db.query(sql, params);
  }
}

module.exports = AuditoriaService;
