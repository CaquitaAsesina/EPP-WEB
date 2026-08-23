// ============================================================
// Controller: Trabajadores
// ============================================================
const TrabajadorService = require('../services/trabajadorService');

class TrabajadorController {
  static async listar(req, res) {
    try {
      const todos = req.query.todos === '1';
      const trabajadores = todos ? await TrabajadorService.listarTodos() : await TrabajadorService.listarActivos();
      res.json(trabajadores);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async buscar(req, res) {
    try {
      const result = await TrabajadorService.buscar(req.query.q);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async obtenerPorId(req, res) {
    try {
      const trabajador = await TrabajadorService.obtenerPorId(req.params.id);
      if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });
      res.json(trabajador);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await TrabajadorService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async actualizar(req, res) {
    try {
      const result = await TrabajadorService.actualizar(req.params.id, req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async eliminar(req, res) {
    try {
      const result = await TrabajadorService.eliminar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = TrabajadorController;
