// ============================================================
// Controller: Ingresos
// ============================================================
const IngresoService = require('../services/ingresoService');

class IngresoController {
  static async listar(req, res) {
    try {
      const ingresos = await IngresoService.listar(req.query);
      res.json(ingresos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await IngresoService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async actualizar(req, res) {
    try {
      const result = await IngresoService.actualizar(req.params.id, req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async anular(req, res) {
    try {
      const result = await IngresoService.anular(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = IngresoController;
