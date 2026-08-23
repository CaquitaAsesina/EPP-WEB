// ============================================================
// Controller: Inventario
// ============================================================
const InventarioService = require('../services/inventarioService');

class InventarioController {
  static async listarStockInicial(req, res) {
    try {
      const { periodo } = req.query;
      const stock = await InventarioService.listarStockInicial(periodo);
      res.json(stock);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async registrarStockInicial(req, res) {
    try {
      const result = await InventarioService.registrarStockInicial(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async vistaSistematica(req, res) {
    try {
      const { periodo } = req.query;
      const vista = await InventarioService.vistaSistematica(periodo);
      res.json(vista);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async registrarInventarioFisico(req, res) {
    try {
      const result = await InventarioService.registrarInventarioFisico(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async dashboard(req, res) {
    try {
      const { periodo } = req.query;
      const dash = await InventarioService.dashboard(periodo);
      res.json(dash);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = InventarioController;
