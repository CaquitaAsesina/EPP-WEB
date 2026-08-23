// ============================================================
// API Module - Comunicación con el backend
// ============================================================
const API = {
  baseURL: '/api',
  token: localStorage.getItem('epp_token') || null,

  setToken(token) {
    this.token = token;
    localStorage.setItem('epp_token', token);
  },

  clearToken() {
    this.token = null;
    localStorage.removeItem('epp_token');
    localStorage.removeItem('epp_user');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('epp_user'));
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('epp_user', JSON.stringify(user));
  },

  async request(method, endpoint, data = null) {
    const url = this.baseURL + endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const options = { method, headers };
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || 'Error de servidor');
    }
    return json;
  },

  // ---- Auth ----
  async login(username, password) {
    return this.request('POST', '/auth/login', { username, password });
  },

  // ---- Usuarios ----
  async getUsuarios() { return this.request('GET', '/usuarios'); },
  async crearUsuario(data) { return this.request('POST', '/usuarios', data); },
  async actualizarUsuario(id, data) { return this.request('PUT', `/usuarios/${id}`, data); },
  async eliminarUsuario(id) { return this.request('DELETE', `/usuarios/${id}`); },
  async activarUsuario(id) { return this.request('POST', `/usuarios/${id}/activar`); },

  // ---- EPP ----
  async getEpp(todos = false) { return this.request('GET', `/epp${todos ? '?todos=1' : ''}`); },
  async getTallasPorEpp() { return this.request('GET', '/epp/tallas-por-epp'); },
  async crearEpp(data) { return this.request('POST', '/epp', data); },
  async actualizarEpp(id, data) { return this.request('PUT', `/epp/${id}`, data); },
  async eliminarEpp(id) { return this.request('DELETE', `/epp/${id}`); },

  // ---- Tallas ----
  async getTallas(todas = false) { return this.request('GET', `/tallas${todas ? '?todas=1' : ''}`); },
  async crearTalla(data) { return this.request('POST', '/tallas', data); },
  async actualizarTalla(id, data) { return this.request('PUT', `/tallas/${id}`, data); },
  async eliminarTalla(id) { return this.request('DELETE', `/tallas/${id}`); },

  // ---- Trabajadores ----
  async getTrabajadores(todos = false) { return this.request('GET', `/trabajadores${todos ? '?todos=1' : ''}`); },
  async buscarTrabajadores(q) { return this.request('GET', `/trabajadores/buscar?q=${encodeURIComponent(q)}`); },
  async crearTrabajador(data) { return this.request('POST', '/trabajadores', data); },
  async actualizarTrabajador(id, data) { return this.request('PUT', `/trabajadores/${id}`, data); },
  async eliminarTrabajador(id) { return this.request('DELETE', `/trabajadores/${id}`); },

  // ---- Períodos ----
  async getPeriodos() { return this.request('GET', '/periodos'); },
  async crearPeriodo(data) { return this.request('POST', '/periodos', data); },
  async eliminarPeriodo(id) { return this.request('DELETE', `/periodos/${id}`); },
  async cerrarPeriodo(id) { return this.request('PUT', `/periodos/${id}/cerrar`); },

  // ---- Inventario ----
  async getStockInicial(periodo) { return this.request('GET', `/inventario/stock-inicial?periodo=${periodo}`); },
  async registrarStockInicial(data) { return this.request('POST', '/inventario/stock-inicial', data); },
  async getSistematico(periodo) { return this.request('GET', `/inventario/sistematico?periodo=${periodo}`); },
  async registrarInventarioFisico(data) { return this.request('POST', '/inventario/fisico', data); },
  async getDashboard(periodo) { return this.request('GET', `/inventario/dashboard?periodo=${periodo}`); },

  // ---- Ingresos ----
  async getIngresos(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();
    return this.request('GET', `/ingresos?${params}`);
  },
  async crearIngreso(data) { return this.request('POST', '/ingresos', data); },
  async actualizarIngreso(id, data) { return this.request('PUT', `/ingresos/${id}`, data); },
  async anularIngreso(id) { return this.request('POST', `/ingresos/${id}/anular`); },

  // ---- Entregas ----
  async getEntregas(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();
    return this.request('GET', `/entregas?${params}`);
  },
  async crearEntrega(data) { return this.request('POST', '/entregas', data); },
  async crearEntregaMuda(data) { return this.request('POST', '/entregas/muda', data); },
  async actualizarEntrega(id, data) { return this.request('PUT', `/entregas/${id}`, data); },
  async anularEntrega(id) { return this.request('POST', `/entregas/${id}/anular`); },

  // ---- Devoluciones ----
  async getDevoluciones(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();
    return this.request('GET', `/devoluciones?${params}`);
  },
  async crearDevolucion(data) { return this.request('POST', '/devoluciones', data); },
  async cambiarEstadoDevolucion(id, estado) { return this.request('POST', `/devoluciones/${id}/cambiar-estado`, { estado }); },
  async getHistorialDevolucion(id) { return this.request('GET', `/devoluciones/${id}/historial`); },
  async getTransicionesDevolucion(id) { return this.request('GET', `/devoluciones/${id}/transiciones`); },
  async anularDevolucion(id) { return this.request('POST', `/devoluciones/${id}/anular`); },

  // ---- Consultas ----
  async buscarConsultas(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();
    return this.request('GET', `/consultas?${params}`);
  },
  async anularMovimientoConsulta(tipo, id) { return this.request('POST', '/consultas/anular', { tipo, id }); },

  // ---- Reportes PDF ----
  async downloadPdf(endpoint, params = {}) {
    const url = this.baseURL + endpoint + '?' + new URLSearchParams(params).toString();
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Error generando PDF');
    const blob = await response.blob();
    const cd = response.headers.get('content-disposition');
    let filename = 'reporte.pdf';
    if (cd) {
      const match = cd.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};
