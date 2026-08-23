// ============================================================
// Controller: Tallas
// ============================================================
const TallaService = require('../services/tallaService');

class TallaController {
  static async listar(req, res) {
    try {
      const todas = req.query.todas === '1';
      const tallas = todas ? await TallaService.listarTodas() : await TallaService.listarActivas();
      res.json(tallas);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await TallaService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async actualizar(req, res) {
    try {
      const result = await TallaService.actualizar(req.params.id, req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async eliminar(req, res) {
    try {
      const result = await TallaService.eliminar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = TallaController;
