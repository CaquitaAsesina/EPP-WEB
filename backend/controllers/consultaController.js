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

}

module.exports = ConsultaController;
