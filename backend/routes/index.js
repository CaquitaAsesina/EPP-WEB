// ============================================================
// Routes - Todas las rutas de la API
// ============================================================
const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');

// Controllers
const UsuarioController = require('../controllers/usuarioController');
const EppController = require('../controllers/eppController');
const TallaController = require('../controllers/tallaController');
const TrabajadorController = require('../controllers/trabajadorController');
const PeriodoController = require('../controllers/periodoController');
const InventarioController = require('../controllers/inventarioController');
const IngresoController = require('../controllers/ingresoController');
const EntregaController = require('../controllers/entregaController');
const DevolucionController = require('../controllers/devolucionController');
const ConsultaController = require('../controllers/consultaController');

// ============ AUTH ============
router.post('/auth/login', UsuarioController.login);

// ============ USUARIOS (solo ADMIN) ============
router.get('/usuarios', authMiddleware, requireRole('ADMIN'), UsuarioController.listar);
router.get('/usuarios/:id', authMiddleware, requireRole('ADMIN'), UsuarioController.obtenerPorId);
router.post('/usuarios', authMiddleware, requireRole('ADMIN'), UsuarioController.crear);
router.put('/usuarios/:id', authMiddleware, requireRole('ADMIN'), UsuarioController.actualizar);
router.delete('/usuarios/:id', authMiddleware, requireRole('ADMIN'), UsuarioController.eliminar);
router.post('/usuarios/:id/activar', authMiddleware, requireRole('ADMIN'), UsuarioController.activar);

// ============ EPP ============
router.get('/epp', authMiddleware, EppController.listar);
router.get('/epp/tallas-por-epp', authMiddleware, EppController.tallasPorEpp);
router.get('/epp/:id', authMiddleware, EppController.obtenerPorId);
router.post('/epp', authMiddleware, requireRole('ADMIN'), EppController.crear);
router.put('/epp/:id', authMiddleware, requireRole('ADMIN'), EppController.actualizar);
router.delete('/epp/:id', authMiddleware, requireRole('ADMIN'), EppController.eliminar);

// ============ TALLAS ============
router.get('/tallas', authMiddleware, TallaController.listar);
router.get('/tallas/:id', authMiddleware, TallaController.obtenerPorId);
router.post('/tallas', authMiddleware, requireRole('ADMIN'), TallaController.crear);
router.put('/tallas/:id', authMiddleware, requireRole('ADMIN'), TallaController.actualizar);
router.delete('/tallas/:id', authMiddleware, requireRole('ADMIN'), TallaController.eliminar);

// ============ TRABAJADORES ============
router.get('/trabajadores', authMiddleware, TrabajadorController.listar);
router.get('/trabajadores/buscar', authMiddleware, TrabajadorController.buscar);
router.get('/trabajadores/:id', authMiddleware, TrabajadorController.obtenerPorId);
router.post('/trabajadores', authMiddleware, requireRole('ADMIN'), TrabajadorController.crear);
router.put('/trabajadores/:id', authMiddleware, requireRole('ADMIN'), TrabajadorController.actualizar);
router.delete('/trabajadores/:id', authMiddleware, requireRole('ADMIN'), TrabajadorController.eliminar);

// ============ PERÍODOS (solo ADMIN) ============
router.get('/periodos', authMiddleware, PeriodoController.listar);
router.get('/periodos/activo', authMiddleware, PeriodoController.activo);
router.post('/periodos', authMiddleware, requireRole('ADMIN'), PeriodoController.crear);  router.delete('/periodos/:id', authMiddleware, requireRole('ADMIN'), PeriodoController.eliminar);
  router.put('/periodos/:id/cerrar', authMiddleware, requireRole('ADMIN'), PeriodoController.cerrar);

// ============ INVENTARIO ============
router.get('/inventario/stock-inicial', authMiddleware, InventarioController.listarStockInicial);
router.post('/inventario/stock-inicial', authMiddleware, requireRole('ADMIN'), InventarioController.registrarStockInicial);
router.get('/inventario/sistematico', authMiddleware, InventarioController.vistaSistematica);
router.post('/inventario/fisico', authMiddleware, requireRole('ADMIN'), InventarioController.registrarInventarioFisico);
router.get('/inventario/dashboard', authMiddleware, InventarioController.dashboard);

// ============ INGRESOS (ADMIN y ALMACEN) ============
router.get('/ingresos', authMiddleware, IngresoController.listar);
router.get('/ingresos/:id', authMiddleware, IngresoController.obtenerPorId);
router.post('/ingresos', authMiddleware, requireRole('ADMIN', 'ALMACEN'), IngresoController.crear);
router.put('/ingresos/:id', authMiddleware, requireRole('ADMIN'), IngresoController.actualizar);
router.post('/ingresos/:id/anular', authMiddleware, requireRole('ADMIN'), IngresoController.anular);

// ============ ENTREGAS (ADMIN y ALMACEN) ============
router.get('/entregas', authMiddleware, EntregaController.listar);
router.get('/entregas/:id', authMiddleware, EntregaController.obtenerPorId);
router.post('/entregas', authMiddleware, requireRole('ADMIN', 'ALMACEN'), EntregaController.crear);
router.post('/entregas/muda', authMiddleware, requireRole('ADMIN', 'ALMACEN'), EntregaController.crearMuda);
router.put('/entregas/:id', authMiddleware, requireRole('ADMIN'), EntregaController.actualizar);
router.post('/entregas/:id/anular', authMiddleware, requireRole('ADMIN'), EntregaController.anular);

// ============ DEVOLUCIONES (ADMIN y ALMACEN) ============
router.get('/devoluciones', authMiddleware, DevolucionController.listar);
router.get('/devoluciones/:id', authMiddleware, DevolucionController.obtenerPorId);
router.get('/devoluciones/:id/historial', authMiddleware, DevolucionController.historialEstados);
router.get('/devoluciones/:id/transiciones', authMiddleware, DevolucionController.transiciones);
router.post('/devoluciones', authMiddleware, requireRole('ADMIN', 'ALMACEN'), DevolucionController.crear);
router.post('/devoluciones/:id/cambiar-estado', authMiddleware, requireRole('ADMIN', 'ALMACEN'), DevolucionController.cambiarEstado);
router.post('/devoluciones/:id/anular', authMiddleware, requireRole('ADMIN'), DevolucionController.anular);

// ============ CONSULTAS ============
router.get('/consultas', authMiddleware, ConsultaController.buscar);
router.post('/consultas/anular', authMiddleware, requireRole('ADMIN'), ConsultaController.anularMovimiento);

// ============ AUDITORÍA (solo ADMIN) ============
router.get('/auditoria', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const AuditoriaService = require('../services/auditoriaService');
    const registros = await AuditoriaService.listar(req.query);
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ REPORTES PDF ============
router.get('/reportes/dashboard', authMiddleware, async (req, res) => {
  try {
    const ReporteService = require('../services/reporteService');
    const pdf = await ReporteService.generarDashboard(req.query.periodo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard_${req.query.periodo || 'reporte'}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reportes/sistematico', authMiddleware, async (req, res) => {
  try {
    const ReporteService = require('../services/reporteService');
    const pdf = await ReporteService.generarSistematico(req.query.periodo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sistematico_${req.query.periodo || 'reporte'}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reportes/consultas', authMiddleware, async (req, res) => {
  try {
    const ReporteService = require('../services/reporteService');
    const pdf = await ReporteService.generarConsultas(req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="consultas_reporte.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ EXPORTACIONES EXCEL (CSV con UTF-8 BOM) ============
router.get('/export/excel/sistematico', authMiddleware, async (req, res) => {
  try {
    const InventarioService = require('../services/inventarioService');
    const vista = await InventarioService.vistaSistematica(req.query.periodo);
    let csv = '\uFEFFEPP;Talla;Inicial;Ingresos;Entregas;Lavados;Sistémático;Físico;Diferencia;Estado\n';
    vista.forEach(v => { csv += `${v.epp_nombre};${v.talla_nombre};${v.stock_inicial};${v.ingresos};${v.entregas};${v.lavados};${v.sistematico};${v.cantidad_fisica||''};${v.diferencia||''};${v.estado}\n`; });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sistematico_${req.query.periodo||'reporte'}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
