// ============================================================
// Controller: Devoluciones
// ============================================================
const DevolucionService = require('../services/devolucionService');

class DevolucionController {
  static async listar(req, res) {
    try {
      const devoluciones = await DevolucionService.listar(req.query);
      res.json(devoluciones);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await DevolucionService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async cambiarEstado(req, res) {
    try {
      const { estado } = req.body;
      const result = await DevolucionService.cambiarEstado(req.params.id, estado, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async historialEstados(req, res) {
    try {
      const historial = await DevolucionService.historialEstados(req.params.id);
      res.json(historial);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async transiciones(req, res) {
    try {
      const dev = await DevolucionService.obtenerPorId(req.params.id);
      if (!dev) return res.status(404).json({ error: 'Devolución no encontrada' });
      const transiciones = DevolucionService.transicionesDisponibles(dev.estado);
      res.json({ estado_actual: dev.estado, transiciones });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async anular(req, res) {
    try {
      const result = await DevolucionService.anular(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = DevolucionController;
