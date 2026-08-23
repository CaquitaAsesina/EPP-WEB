// ============================================================
// Service: Consultas (búsqueda unificada de movimientos)
// ============================================================
const db = require('../config/database');

class ConsultaService {
  static async buscar(filtros = {}) {
    const { tipo, epp_id, talla_id, trabajador_id, estado_devolucion, fecha_desde, fecha_hasta, periodo } = filtros;

    let uniones = [];

    // Stock Inicial
    if (!tipo || tipo === 'TODOS' || tipo === 'STOCK INICIAL') {
      uniones.push(`
        SELECT si.periodo AS fecha, 'STOCK INICIAL' AS tipo, epp.nombre AS epp_nombre,
               t.nombre AS talla_nombre, NULL AS trabajador_nombre, NULL AS trabajador_dni,
               si.cantidad AS cantidad, CONCAT('Stock inicial registrado') AS detalle,
               u.nombre AS usuario_nombre, si.periodo AS periodo
        FROM stock_inicial si
        JOIN epp epp ON epp.id = si.epp_id
        JOIN tallas t ON t.id = si.talla_id
        LEFT JOIN usuarios u ON u.id = si.usuario_id
        WHERE 1=1
        ${epp_id ? 'AND si.epp_id = ' + parseInt(epp_id) : ''}
        ${talla_id ? 'AND si.talla_id = ' + parseInt(talla_id) : ''}
        ${periodo ? "AND si.periodo = '" + periodo + "'" : ''}
        ${fecha_desde ? "AND si.fecha >= '" + fecha_desde + "'" : ''}
        ${fecha_hasta ? "AND si.fecha <= '" + fecha_hasta + "'" : ''}
      `);
    }

    // Ingresos
    if (!tipo || tipo === 'TODOS' || tipo === 'INGRESO') {
      uniones.push(`
        SELECT i.fecha, 'INGRESO' AS tipo, epp.nombre AS epp_nombre,
               t.nombre AS talla_nombre, NULL AS trabajador_nombre, NULL AS trabajador_dni,
               i.cantidad, CONCAT('Ingreso #', i.id, ' - ', i.estado) AS detalle,
               u.nombre AS usuario_nombre, i.periodo AS periodo
        FROM ingresos i
        JOIN epp epp ON epp.id = i.epp_id
        JOIN tallas t ON t.id = i.talla_id
        LEFT JOIN usuarios u ON u.id = i.usuario_id
        WHERE 1=1
        ${epp_id ? 'AND i.epp_id = ' + parseInt(epp_id) : ''}
        ${talla_id ? 'AND i.talla_id = ' + parseInt(talla_id) : ''}
        ${periodo ? "AND i.periodo = '" + periodo + "'" : ''}
        ${fecha_desde ? "AND i.fecha >= '" + fecha_desde + "'" : ''}
        ${fecha_hasta ? "AND i.fecha <= '" + fecha_hasta + "'" : ''}
      `);
    }

    // Entregas
    if (!tipo || tipo === 'TODOS' || tipo === 'ENTREGA') {
      uniones.push(`
        SELECT en.fecha, 'ENTREGA' AS tipo, epp.nombre AS epp_nombre,
               t.nombre AS talla_nombre, tr.nombre AS trabajador_nombre, tr.dni AS trabajador_dni,
               en.cantidad, CONCAT('Entrega #', en.id, ' - ', en.estado) AS detalle,
               u.nombre AS usuario_nombre, en.periodo AS periodo
        FROM entregas en
        JOIN trabajadores tr ON tr.id = en.trabajador_id
        JOIN epp epp ON epp.id = en.epp_id
        JOIN tallas t ON t.id = en.talla_id
        LEFT JOIN usuarios u ON u.id = en.usuario_id
        WHERE 1=1
        ${epp_id ? 'AND en.epp_id = ' + parseInt(epp_id) : ''}
        ${talla_id ? 'AND en.talla_id = ' + parseInt(talla_id) : ''}
        ${trabajador_id ? 'AND en.trabajador_id = ' + parseInt(trabajador_id) : ''}
        ${periodo ? "AND en.periodo = '" + periodo + "'" : ''}
        ${fecha_desde ? "AND en.fecha >= '" + fecha_desde + "'" : ''}
        ${fecha_hasta ? "AND en.fecha <= '" + fecha_hasta + "'" : ''}
      `);
    }

    // Devoluciones
    if (!tipo || tipo === 'TODOS' || tipo === 'DEVOLUCIÓN' || tipo === 'CAMBIO DE ESTADO' || tipo === 'PÉRDIDA') {
      let devWhere = `d.estado_registro = 'ACTIVO'`;
      if (estado_devolucion) devWhere += ` AND d.estado = '${estado_devolucion}'`;
      if (tipo === 'PÉRDIDA') devWhere += ` AND d.estado IN ('PERDIDO', 'DESCARTADO')`;

      uniones.push(`
        SELECT d.fecha, 'DEVOLUCIÓN' AS tipo, epp.nombre AS epp_nombre,
               t.nombre AS talla_nombre, tr.nombre AS trabajador_nombre, tr.dni AS trabajador_dni,
               d.cantidad, CONCAT('Devolución #', d.id, ' - Estado: ', d.estado) AS detalle,
               u.nombre AS usuario_nombre, d.periodo AS periodo
        FROM devoluciones d
        JOIN trabajadores tr ON tr.id = d.trabajador_id
        JOIN epp epp ON epp.id = d.epp_id
        JOIN tallas t ON t.id = d.talla_id
        LEFT JOIN usuarios u ON u.id = d.usuario_id
        WHERE ${devWhere}
        ${epp_id ? 'AND d.epp_id = ' + parseInt(epp_id) : ''}
        ${talla_id ? 'AND d.talla_id = ' + parseInt(talla_id) : ''}
        ${trabajador_id ? 'AND d.trabajador_id = ' + parseInt(trabajador_id) : ''}
        ${periodo ? "AND d.periodo = '" + periodo + "'" : ''}
        ${fecha_desde ? "AND d.fecha >= '" + fecha_desde + "'" : ''}
        ${fecha_hasta ? "AND d.fecha <= '" + fecha_hasta + "'" : ''}
      `);
    }

    // Cambios de estado
    if (!tipo || tipo === 'TODOS' || tipo === 'CAMBIO DE ESTADO') {
      uniones.push(`
        SELECT de.fecha, 'CAMBIO ESTADO' AS tipo, epp.nombre AS epp_nombre,
               t.nombre AS talla_nombre, tr.nombre AS trabajador_nombre, tr.dni AS trabajador_dni,
               d.cantidad, CONCAT(de.estado_anterior, ' → ', de.estado_nuevo) AS detalle,
               u.nombre AS usuario_nombre, d.periodo AS periodo
        FROM devolucion_estados de
        JOIN devoluciones d ON d.id = de.devolucion_id
        JOIN trabajadores tr ON tr.id = d.trabajador_id
        JOIN epp epp ON epp.id = d.epp_id
        JOIN tallas t ON t.id = d.talla_id
        LEFT JOIN usuarios u ON u.id = de.usuario_id
        WHERE d.estado_registro = 'ACTIVO'
        ${epp_id ? 'AND d.epp_id = ' + parseInt(epp_id) : ''}
        ${talla_id ? 'AND d.talla_id = ' + parseInt(talla_id) : ''}
        ${trabajador_id ? 'AND d.trabajador_id = ' + parseInt(trabajador_id) : ''}
        ${fecha_desde ? "AND de.fecha >= '" + fecha_desde + "'" : ''}
        ${fecha_hasta ? "AND de.fecha <= '" + fecha_hasta + "'" : ''}
      `);
    }

    // Inventario Físico
    if (!tipo || tipo === 'TODOS' || tipo === 'INVENTARIO FÍSICO' || tipo === 'SOBRANTE') {
      let invWhere = `1=1`;
      if (tipo === 'SOBRANTE') invWhere += ` AND inv.tipo = 'SOBRANTE'`;

      uniones.push(`
        SELECT inv.fecha, 'INVENTARIO FÍSICO' AS tipo, epp.nombre AS epp_nombre,
               t.nombre AS talla_nombre, NULL AS trabajador_nombre, NULL AS trabajador_dni,
               inv.cantidad_fisica AS cantidad,
               CONCAT('Sistematico: ', inv.stock_sistematico, ' | Fisico: ', inv.cantidad_fisica, ' | ', inv.tipo) AS detalle,
               u.nombre AS usuario_nombre, NULL AS periodo
        FROM inventarios_fisicos inv
        JOIN epp epp ON epp.id = inv.epp_id
        JOIN tallas t ON t.id = inv.talla_id
        LEFT JOIN usuarios u ON u.id = inv.usuario_id
        WHERE ${invWhere}
        ${epp_id ? 'AND inv.epp_id = ' + parseInt(epp_id) : ''}
        ${talla_id ? 'AND inv.talla_id = ' + parseInt(talla_id) : ''}
        ${fecha_desde ? "AND inv.fecha >= '" + fecha_desde + "'" : ''}
        ${fecha_hasta ? "AND inv.fecha <= '" + fecha_hasta + "'" : ''}
      `);
    }

    if (uniones.length === 0) return [];

    const sql = uniones.join(' UNION ALL ') + ' ORDER BY fecha DESC LIMIT 500';
    return db.query(sql);
  }

  static async anularMovimiento(tipo, id, usuarioActual) {
    // Delegar al service correspondiente
    if (tipo === 'INGRESO') {
      const IngresoService = require('./ingresoService');
      return IngresoService.anular(id, usuarioActual);
    } else if (tipo === 'ENTREGA') {
      const EntregaService = require('./entregaService');
      return EntregaService.anular(id, usuarioActual);
    } else if (tipo === 'DEVOLUCIÓN') {
      const DevolucionService = require('./devolucionService');
      return DevolucionService.anular(id, usuarioActual);
    }
    throw new Error('Tipo de movimiento no anulable');
  }
}

module.exports = ConsultaService;
