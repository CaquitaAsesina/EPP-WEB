// ============================================================
// Controller: Períodos
// ============================================================
const PeriodoService = require('../services/periodoService');

class PeriodoController {
  static async listar(req, res) {
    try {
      const periodos = await PeriodoService.listar();
      res.json(periodos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await PeriodoService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async eliminar(req, res) {
    try {
      const result = await PeriodoService.eliminar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async cerrar(req, res) {
    try {
      const result = await PeriodoService.cerrar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = PeriodoController;
