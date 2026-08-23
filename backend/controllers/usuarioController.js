// ============================================================
// Controller: Usuarios
// ============================================================
const UsuarioService = require('../services/usuarioService');

class UsuarioController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      const result = await UsuarioService.login(username, password);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async listar(req, res) {
    try {
      const usuarios = await UsuarioService.listar();
      res.json(usuarios);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async obtenerPorId(req, res) {
    try {
      const usuario = await UsuarioService.obtenerPorId(req.params.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json(usuario);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async crear(req, res) {
    try {
      const result = await UsuarioService.crear(req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async actualizar(req, res) {
    try {
      const result = await UsuarioService.actualizar(req.params.id, req.body, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async eliminar(req, res) {
    try {
      const result = await UsuarioService.eliminar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
    }
  }

  static async activar(req, res) {
    try {
      const result = await UsuarioService.activar(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = UsuarioController;
