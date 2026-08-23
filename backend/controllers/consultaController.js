// ============================================================
// Controller: Consultas
// ============================================================
const ConsultaService = require('../services/consultaService');

class ConsultaController {
  static async buscar(req, res) {
    try {
      const resultados = await ConsultaService.buscar(req.query);
      res.json(resultados);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async anularMovimiento(req, res) {
    try {
      const { tipo, id } = req.body;
      const result = await ConsultaService.anularMovimiento(tipo, id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }
}

module.exports = ConsultaController;
