// ============================================================
// Controller: EPP
// ============================================================
const EppService = require('../services/eppService');

class EppController {
  static async listar(req, res) {
    try {
      const todos = req.query.todos === '1';
      const epp = todos ? await EppService.listarTodos() : await EppService.listarActivos();
      res.json(epp);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async obtenerPorId(req, res) {
    try {
      const epp = await EppService.obtenerPorId(req.params.id);
      if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });
      res.json(epp);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async tallasPorEpp(req, res) {
    try {
      const result = await EppService.tallasPorEpp();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await EppService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async actualizar(req, res) {
    try {
      const result = await EppService.actualizar(req.params.id, req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async eliminar(req, res) {
    try {
      const result = await EppService.eliminar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = EppController;
