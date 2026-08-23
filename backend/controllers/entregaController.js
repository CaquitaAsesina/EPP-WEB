// ============================================================
// Controller: Entregas
// ============================================================
const EntregaService = require('../services/entregaService');

class EntregaController {
  static async listar(req, res) {
    try {
      const entregas = await EntregaService.listar(req.query);
      res.json(entregas);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await EntregaService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async crearMuda(req, res) {
    try {
      const result = await EntregaService.crearMuda(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async actualizar(req, res) {
    try {
      const result = await EntregaService.actualizar(req.params.id, req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async anular(req, res) {
    try {
      const result = await EntregaService.anular(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = EntregaController;
