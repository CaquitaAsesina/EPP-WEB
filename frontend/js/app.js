/* ============================================================
   Inventario EPP — App Principal
   ============================================================ */

// ---- Estado ----
let currentView = 'dashboard';
let selectedId = null;
let eppList = [];
let tallasList = [];
let trabajadoresList = [];
let periodosList = [];
let tallasPorEpp = {};

// ---- Helpers ----
function v(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
// Normalize any date value to YYYY-MM-DD (MySQL DATE format)
function toDateStr(d) {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // already YYYY-MM-DD
  try { return new Date(d).toISOString().split('T')[0]; } catch { return d; }
}
function formatDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtEstado(e) {
  return { SUCIO:'Sucio',EN_LAVADO:'En Lavado',LAVADO:'Lavado',DANADO:'Dañado',PERDIDO:'Perdido',DESCARTADO:'Descartado',ACTIVO:'Activo',ANULADO:'Anulado' }[e]||e;
}
function badgeCls(e) {
  return { SUCIO:'bg-warning text-dark',EN_LAVADO:'bg-info',LAVADO:'bg-success',DANADO:'bg-danger',PERDIDO:'bg-dark',DESCARTADO:'bg-secondary' }[e]||'bg-secondary';
}

// ---- Confirm modal ----
function showConfirm(msg, title, btnText, icon) {
  return new Promise(resolve => {
    const m = document.getElementById('modal-confirmar');
    m.querySelector('#confirm-icon').textContent = icon || '⚠️';
    m.querySelector('#confirm-title').textContent = title || 'Confirmar';
    m.querySelector('#confirm-text').textContent = msg;
    const okBtn = m.querySelector('#confirm-ok');
    okBtn.textContent = btnText || 'Eliminar';
    const modal = new bootstrap.Modal(m);
    let done = false;
    const finish = r => { if (!done) { done = true; modal.hide(); resolve(r); } };
    okBtn.onclick = () => finish(true);
    m.addEventListener('hidden.bs.modal', () => finish(false), { once: true });
    modal.show();
  });
}

// ---- Alert modal ----
function showAlert(msg, title, icon) {
  return new Promise(resolve => {
    const m = document.getElementById('modal-alerta');
    m.querySelector('#alerta-icon').textContent = icon || 'ℹ️';
    m.querySelector('#alerta-title').textContent = title || 'Información';
    m.querySelector('#alerta-text').textContent = msg;
    const modal = new bootstrap.Modal(m);
    m.addEventListener('hidden.bs.modal', () => { modal.dispose(); resolve(); }, { once: true });
    modal.show();
  });
}

// ---- Generic form modal ----
let _formCb = null;
function openFormModal() {
  const el = document.getElementById('modal-generico');
  const inst = bootstrap.Modal.getOrCreateInstance(el);
  inst.show();
  return inst;
}
function showForm(title, html, onSubmit, submitLabel) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  const btn = document.getElementById('modal-submit');
  btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>' + (submitLabel || 'Guardar');
  btn.disabled = false;
  _formCb = onSubmit;
}
function hideForm() {
  const el = document.getElementById('modal-generico');
  const inst = bootstrap.Modal.getInstance(el);
  if (inst) inst.hide();
}

// ---- Cascade EPP → Talla ----
function wireCascade(eppId, tallaId) {
  requestAnimationFrame(() => {
    const eppEl = document.getElementById(eppId);
    const tallaEl = document.getElementById(tallaId);
    if (!eppEl || !tallaEl) return;
    const refresh = () => {
      const eid = parseInt(eppEl.value);
      const tallas = tallasPorEpp[eid] || [];
      tallaEl.innerHTML = tallas.length
        ? tallas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')
        : '<option value="">Sin tallas</option>';
    };
    eppEl.addEventListener('change', refresh);
    refresh();
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLogin();
  initNav();
  initConfigTabs();
  initFilters();
  initActionButtons();

  // Modal save button
  document.getElementById('modal-submit')?.addEventListener('click', async () => {
    if (!_formCb) return;
    const btn = document.getElementById('modal-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
    try {
      await _formCb();
    } catch (err) {
      showAlert(err.message, 'Error', '❌');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar';
      _formCb = null;
    }
  });

  checkSession();
});

// ============================================================
// THEME
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('epp_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('epp_theme', next);
    updateThemeIcon(next);
  });
}
function updateThemeIcon(t) {
  const i = document.querySelector('#theme-toggle i');
  if (i) i.className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
}

// ============================================================
// AUTH
// ============================================================
function initLogin() {
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errDiv = document.getElementById('login-error');
    try {
      errDiv.classList.add('d-none');
      const r = await API.login(v('login-username'), v('login-password'));
      API.setToken(r.token);
      API.setUser(r.user);
      showApp();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('d-none');
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const ok = await showConfirm('¿Cerrar sesión?', 'Salir', 'Cerrar sesión', '🚪');
    if (!ok) return;
    API.clearToken();
    document.getElementById('app-main').classList.add('d-none');
    document.getElementById('login-view').classList.remove('d-none');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  });

  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const inp = document.getElementById('login-password');
    const icon = document.querySelector('#toggle-password i');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    icon.className = inp.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
  });
}

function checkSession() {
  if (API.token && API.getUser()) showApp();
}

async function showApp() {
  document.getElementById('login-view').classList.add('d-none');
  document.getElementById('app-main').classList.remove('d-none');
  const u = API.getUser();
  document.getElementById('user-name').textContent = u.nombre;
  document.getElementById('user-role').textContent = u.rol;
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = u.rol === 'ADMIN' ? '' : 'none');
  document.querySelectorAll('.admin-only-almacen').forEach(el => el.style.display = ['ADMIN','ALMACEN'].includes(u.rol) ? '' : 'none');
  await loadBase();
  navigateTo('dashboard');
}

// ============================================================
// NAV
// ============================================================
function initNav() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.view); });
  });
}

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.sidebar-link[data-view="${view}"]`)?.classList.add('active');
  document.querySelectorAll('.view-container').forEach(v => v.classList.add('d-none'));
  document.getElementById(`view-${view}`)?.classList.remove('d-none');
  loadView(view);
}

async function loadBase() {
  try {
    eppList = await API.getEpp(true);
    tallasList = await API.getTallas(true);
    trabajadoresList = await API.getTrabajadores(true);
    periodosList = await API.getPeriodos();
    const td = await API.getTallasPorEpp();
    tallasPorEpp = {};
    td.forEach(i => { tallasPorEpp[i.epp_id] = i.tallas; });
  } catch (e) { console.error('loadBase:', e); }
}

async function loadView(view) {
  try {
    if (view === 'dashboard') await loadDashboard();
    else if (view === 'stock') await loadStock();
    else if (view === 'ingresos') await loadIngresos();
    else if (view === 'entregas') await loadEntregas();
    else if (view === 'devoluciones') await loadDevoluciones();
    else if (view === 'sistematico') await loadSistematico();
    else if (view === 'consultas') await loadConsultas();
    else if (view === 'trabajadores') await loadTrabajadores();
    else if (view === 'configuracion') await loadConfig();
  } catch (e) { console.error('loadView ' + view, e); }
}

// ---- Periodo selects ----
function fillPeriodoSelects(forceId) {
  ['dashboard-periodo','stock-periodo','sist-periodo'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prevVal = forceId === id ? undefined : sel.value; // preserve selection unless forced
    sel.innerHTML = '<option value="">Seleccionar período</option>';
    periodosList.forEach(p => {
      const o = document.createElement('option');
      const fechaStr = toDateStr(p.fecha);
      o.value = fechaStr;
      o.textContent = new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' }) + (p.activo ? '' : ' (Cerrado)');
      sel.appendChild(o);
    });
    // Restore previous selection if still valid, else select active
    if (prevVal && sel.querySelector(`option[value="${prevVal}"]`)) {
      sel.value = prevVal;
    } else {
      const activo = periodosList.find(p => p.activo);
      if (activo) sel.value = toDateStr(activo.fecha);
    }
  });
}
async function refreshPeriodos() { periodosList = await API.getPeriodos(); }

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  await refreshPeriodos();
  fillPeriodoSelects();
  const periodo = v('dashboard-periodo');
  if (!periodo) {
    document.getElementById('dashboard-cards').innerHTML = '<div class="col-12"><div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-1"></i>Seleccione un período para ver el dashboard</div></div>';
    document.getElementById('dashboard-epp-cards').innerHTML = '';
    document.getElementById('dashboard-charts').innerHTML = '';
    return;
  }
  const d = await API.getDashboard(periodo);

  // 8 stat cards
  const cards = [
    { t:'Total EPP', n:d.totalEpp, c:'var(--blue)', i:'bi-box-seam' },
    { t:'Stock Disponible', n:d.stockDisponible, c:'var(--green)', i:'bi-check-circle' },
    { t:'Sucios', n:d.sucios, c:'var(--orange)', i:'bi-exclamation-triangle' },
    { t:'En Lavado', n:d.enLavado, c:'var(--purple)', i:'bi-droplet' },
    { t:'Lavados', n:d.lavados, c:'var(--teal)', i:'bi-droplet-fill' },
    { t:'Entregas', n:d.totalEntregas, c:'var(--blue)', i:'bi-arrow-up-circle' },
    { t:'Ingresos', n:d.totalIngresos, c:'var(--green)', i:'bi-arrow-down-circle' },
    { t:'Pérdidas', n:d.totalPerdidas, c:'var(--red)', i:'bi-x-circle' }
  ];
  document.getElementById('dashboard-cards').innerHTML = cards.map(c => `
    <div class="col-xl-3 col-md-4 col-6">
      <div class="card stat-card" style="border-left-color:${c.c}">
        <div class="card-body py-4 px-4">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="stat-number" style="color:${c.c}">${c.n||0}</div>
              <div class="stat-label">${c.t}</div>
            </div>
            <i class="${c.i}" style="font-size:2.2rem;color:${c.c};opacity:0.12"></i>
          </div>
        </div>
      </div>
    </div>`).join('');

  // EPP stock cards
  document.getElementById('dashboard-epp-cards').innerHTML = (d.porEpp||[]).map(e => `
    <div class="col-xl-2 col-md-3 col-sm-4 col-4">
      <div class="card text-center py-3">
        <div class="card-body py-3">
          <small style="color:var(--text3);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.05em">${e.nombre}</small>
          <div class="fw-bold" style="color:var(--blue);font-size:28px;margin:4px 0">${e.stock||0}</div>
          <small style="color:var(--text3);font-size:10px">unidades</small>
        </div>
      </div>
    </div>`).join('');

  // Charts
  const charts = [
    { title:'Stock por EPP', items:d.porEpp||[], color:'var(--blue)', key:'stock' },
    { title:'Ingresos por EPP', items:d.ingresosPorEpp||[], color:'var(--green)', key:'total' },
    { title:'Entregas por EPP', items:d.entregasPorEpp||[], color:'var(--orange)', key:'total' }
  ];
  document.getElementById('dashboard-charts').innerHTML = charts.map(ch => {
    const max = Math.max(...ch.items.map(i => i[ch.key]||0), 1);
    return `<div class="col-lg-4 col-md-6">
      <div class="card"><div class="card-body py-4">
        <h6 class="fw-bold mb-3" style="font-size:13px">${ch.title}</h6>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${ch.items.map(i => `
            <div class="d-flex align-items-center" style="height:22px">
              <small style="width:60px;font-size:11px;color:var(--text3)" class="text-truncate">${i.nombre}</small>
              <div style="flex:1;height:14px;background:var(--input-bg);border-radius:4px;overflow:hidden">
                <div style="width:${Math.max(((i[ch.key]||0)/max)*100,2)}%;height:100%;background:${ch.color};border-radius:4px"></div>
              </div>
              <small class="fw-bold ms-2" style="width:36px;text-align:right;font-size:11px">${i[ch.key]||0}</small>
            </div>`).join('')}
        </div>
      </div></div>
    </div>`;
  }).join('');
}

// ============================================================
// STOCK
// ============================================================
async function loadStock() {
  await refreshPeriodos();
  fillPeriodoSelects();
  const periodo = v('stock-periodo');
  const warn = document.getElementById('stock-warning');
  if (!periodo) { warn?.classList.remove('d-none'); document.getElementById('stock-table-body').innerHTML = ''; return; }
  warn?.classList.add('d-none');
  const data = await API.getStockInicial(periodo);
  const tb = document.getElementById('stock-table-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:32px;color:var(--text3)">No hay stock inicial registrado</td></tr>'; return; }
  tb.innerHTML = data.map(s => `<tr>
    <td class="fw-semibold">${s.epp_nombre}</td><td>${s.talla_nombre}</td>
    <td class="fw-bold">${s.cantidad}</td><td>${formatDate(s.creado_el)}</td><td>${s.usuario_nombre||'-'}</td>
  </tr>`).join('');
}

// ============================================================
// FILTROS (poblar selects)
// ============================================================
function fillEppSelects() {
  ['filtro-ing-epp','filtro-ent-epp','filtro-dev-epp','filtro-cons-epp'].forEach(id => {
    const s = document.getElementById(id);
    if (!s) return;
    const cur = s.value;
    s.innerHTML = '<option value="">EPP</option>';
    eppList.filter(e => e.estado === 'ACTIVO').forEach(e => {
      s.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
    s.value = cur;
  });
}
function fillTallaSelects() {
  ['filtro-ing-talla','filtro-ent-talla','filtro-dev-talla','filtro-cons-talla'].forEach(id => {
    const s = document.getElementById(id);
    if (!s) return;
    const cur = s.value;
    s.innerHTML = '<option value="">Talla</option>';
    tallasList.filter(t => t.estado === 'ACTIVO').forEach(t => {
      s.innerHTML += `<option value="${t.id}">${t.nombre}</option>`;
    });
    s.value = cur;
  });
}
function fillTrabSelects() {
  ['filtro-ent-trabajador','filtro-dev-trabajador','filtro-cons-trabajador'].forEach(id => {
    const s = document.getElementById(id);
    if (!s) return;
    const cur = s.value;
    s.innerHTML = '<option value="">Trabajador</option>';
    trabajadoresList.filter(t => t.estado === 'ACTIVO').forEach(t => {
      s.innerHTML += `<option value="${t.id}">${t.nombre}</option>`;
    });
    s.value = cur;
  });
}

function initFilters() {
  // Auto-refresh on filter change
  const ingFilters = ['filtro-ing-epp','filtro-ing-talla','filtro-ing-estado','filtro-ing-desde','filtro-ing-hasta'];
  ingFilters.forEach(id => document.getElementById(id)?.addEventListener('change', () => { if (currentView === 'ingresos') loadIngresos(); }));

  const entFilters = ['filtro-ent-epp','filtro-ent-talla','filtro-ent-trabajador','filtro-ent-estado','filtro-ent-desde','filtro-ent-hasta'];
  entFilters.forEach(id => document.getElementById(id)?.addEventListener('change', () => { if (currentView === 'entregas') loadEntregas(); }));

  const devFilters = ['filtro-dev-epp','filtro-dev-talla','filtro-dev-trabajador','filtro-dev-estado','filtro-dev-desde','filtro-dev-hasta'];
  devFilters.forEach(id => document.getElementById(id)?.addEventListener('change', () => { if (currentView === 'devoluciones') loadDevoluciones(); }));

  // Periodo selects
  ['dashboard-periodo','stock-periodo','sist-periodo'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (currentView === 'dashboard') loadDashboard();
      else if (currentView === 'stock') loadStock();
      else if (currentView === 'sistematico') loadSistematico();
    });
  });

  // Search debounce
  let dt;
  document.getElementById('busqueda-trab')?.addEventListener('input', () => {
    clearTimeout(dt);
    dt = setTimeout(loadTrabajadores, 300);
  });

  // Refresh buttons
  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', loadDashboard);
  document.getElementById('btn-refresh-stock')?.addEventListener('click', loadStock);
  document.getElementById('btn-refresh-ingresos')?.addEventListener('click', loadIngresos);
  document.getElementById('btn-refresh-entregas')?.addEventListener('click', loadEntregas);
  document.getElementById('btn-refresh-dev')?.addEventListener('click', loadDevoluciones);
  document.getElementById('btn-refresh-sist')?.addEventListener('click', loadSistematico);
  document.getElementById('btn-refresh-trab')?.addEventListener('click', loadTrabajadores);
  document.getElementById('btn-buscar-consulta')?.addEventListener('click', loadConsultas);
}

// ============================================================
// ACTION BUTTONS
// ============================================================
function initActionButtons() {
  // Períodos
  document.getElementById('btn-nuevo-periodo')?.addEventListener('click', actionNuevoPeriodo);
  document.getElementById('btn-eliminar-periodo')?.addEventListener('click', actionEliminarPeriodo);
  document.getElementById('btn-cerrar-periodo')?.addEventListener('click', actionCerrarPeriodo);
  document.getElementById('btn-reg-stock')?.addEventListener('click', actionRegStock);
  // Ingresos
  document.getElementById('btn-nuevo-ingreso')?.addEventListener('click', actionNuevoIngreso);
  document.getElementById('btn-editar-ingreso')?.addEventListener('click', actionEditarIngreso);
  document.getElementById('btn-anular-ingreso')?.addEventListener('click', actionAnularIngreso);
  // Entregas
  document.getElementById('btn-nueva-entrega')?.addEventListener('click', actionNuevaEntrega);
  document.getElementById('btn-entrega-muda')?.addEventListener('click', actionEntregaMuda);
  document.getElementById('btn-editar-entrega')?.addEventListener('click', actionEditarEntrega);
  document.getElementById('btn-anular-entrega')?.addEventListener('click', actionAnularEntrega);
  // Devoluciones
  document.getElementById('btn-nueva-dev')?.addEventListener('click', actionNuevaDev);
  document.getElementById('btn-cambiar-estado-dev')?.addEventListener('click', actionCambiarEstado);
  document.getElementById('btn-historial-dev')?.addEventListener('click', actionHistorial);
  document.getElementById('btn-anular-dev')?.addEventListener('click', actionAnularDev);
  // Sistemático
  document.getElementById('btn-reg-fisico')?.addEventListener('click', actionRegFisico);
  document.getElementById('btn-export-pdf')?.addEventListener('click', () => downloadPdf('/reportes/dashboard', v('dashboard-periodo')));
  document.getElementById('btn-export-sist-pdf')?.addEventListener('click', () => downloadPdf('/reportes/sistematico', v('sist-periodo')));
  document.getElementById('btn-export-sist-excel')?.addEventListener('click', () => downloadExcel('/export/excel/sistematico', v('sist-periodo')));
  // Trabajadores
  document.getElementById('btn-nuevo-trab')?.addEventListener('click', actionNuevoTrab);
  document.getElementById('btn-editar-trab')?.addEventListener('click', actionEditarTrab);
  document.getElementById('btn-eliminar-trab')?.addEventListener('click', actionEliminarTrab);
  // Consultas
  document.getElementById('btn-export-consultas-pdf')?.addEventListener('click', () => downloadPdf('/reportes/consultas', null, true));
  // Config
  document.getElementById('btn-nuevo-epp')?.addEventListener('click', actionNuevoEpp);
  document.getElementById('btn-nueva-talla')?.addEventListener('click', actionNuevaTalla);
  document.getElementById('btn-nuevo-usuario')?.addEventListener('click', actionNuevoUsuario);
}

// ---- Select row ----
function selectRow(tr) {
  document.querySelectorAll('.table tbody tr').forEach(r => r.classList.remove('table-active'));
  tr.classList.add('table-active');
  selectedId = parseInt(tr.dataset.id);
}

// ============================================================
// PERÍODO ACTIONS
// ============================================================
async function actionNuevoPeriodo() {
  const today = new Date().toISOString().split('T')[0];
  showForm('Nuevo Período', `
    <div class="mb-0"><label class="form-label">Fecha del período</label>
    <input type="date" class="form-control" id="f-fecha" value="${today}"></div>`,
  async () => {
    await API.crearPeriodo({ fecha: v('f-fecha') });
    hideForm(); await refreshPeriodos(); fillPeriodoSelects(); await loadStock();
    showAlert('Período creado', 'Éxito', '✅');
  });
  openFormModal();
}

async function actionEliminarPeriodo() {
  if (!periodosList.length) return showAlert('No hay períodos registrados', 'Atención', '⚠️');
  const opts = periodosList.map(p => `<option value="${p.id}">${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})} ${p.activo ? '(Activo)' : ''}</option>`).join('');
  showForm('Eliminar Período', `
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-3" style="font-size:13px">
      <i class="bi bi-exclamation-triangle-fill" style="font-size:1.2rem"></i>
      <div><strong>¡Acción irreversible!</strong> Se eliminará el período junto con TODOS sus registros: stock inicial, ingresos, entregas y devoluciones.</div>
    </div>
    <div class="mb-3">
      <label class="form-label"><i class="bi bi-calendar-event me-1"></i>Seleccione el período a eliminar</label>
      <select class="form-select" id="f-periodo-eliminar">${opts}</select>
    </div>`,
  async () => {
    const id = v('f-periodo-eliminar');
    if (!id) return;
    const p = periodosList.find(x => x.id == id);
    if (!await showConfirm(`¿Eliminar permanentemente el período ${p.fecha}?\n\nSe borrarán TODOS los registros asignados a este período.`, 'Eliminar período', 'Eliminar', '🗑️')) return;
    const res = await API.eliminarPeriodo(id);
    hideForm();
    await refreshPeriodos(); fillPeriodoSelects(); await loadStock(); await loadDashboard();
    showAlert(`Período eliminado. Se borraron ${res.registros || 0} registros.`, 'Período eliminado', '✅');
  });
  openFormModal();
}

async function actionCerrarPeriodo() {
  if (!periodosList.length) return showAlert('No hay períodos registrados', 'Atención', '⚠️');
  const opts = periodosList.map(p => `<option value="${p.id}" ${p.activo?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})} ${p.activo ? '(Activo)' : ''}</option>`).join('');
  showForm('Cerrar Período', `
    <div class="alert alert-warning d-flex align-items-center gap-2 mb-3" style="font-size:13px">
      <i class="bi bi-info-circle-fill" style="font-size:1.2rem"></i>
      <div>El período se <strong>cerrará permanentemente</strong>. Todos los registros (stock, ingresos, entregas, devoluciones) se conservan pero <strong>ya no podrá agregar más datos</strong> a este período.</div>
    </div>
    <div class="mb-0">
      <label class="form-label"><i class="bi bi-calendar-event me-1"></i>Seleccione el período a cerrar</label>
      <select class="form-select" id="f-periodo-cerrar">${opts}</select>
    </div>`,
  async () => {
    const id = v('f-periodo-cerrar');
    if (!id) return;
    const p = periodosList.find(x => x.id == id);
    if (!await showConfirm(`¿Cerrar permanentemente el período ${p.fecha}?\n\nNo podrá volver a abrirlo ni agregar registros.`, 'Cerrar período', 'Cerrar', '🔒')) return;
    await API.cerrarPeriodo(id);
    hideForm();
    await refreshPeriodos(); fillPeriodoSelects(); await loadStock();
    showAlert('Período cerrado. Los registros se conservan.', 'Período cerrado', '✅');
  });
  openFormModal();
}

// ============================================================
// STOCK ACTIONS
// ============================================================
async function actionRegStock() {
  const periodo = v('stock-periodo');
  if (!periodo) return showAlert('Seleccione un período', 'Atención', '⚠️');
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  showForm('Registrar Stock Inicial', `
    <div class="mb-3"><label class="form-label">Período</label><input type="text" class="form-control" value="${periodo}" disabled></div>
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-0"><label class="form-label">Cantidad</label><input type="number" class="form-control" id="f-cant" min="0" value="0"></div>`,
  async () => {
    if (!v('f-epp')) throw new Error('Seleccione un EPP');
    if (!v('f-talla')) throw new Error('Seleccione una talla');
    await API.registrarStockInicial({ periodo, epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad: parseInt(v('f-cant')) });
    hideForm(); await loadStock();
    showAlert('Stock registrado', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
}

// ============================================================
// INGRESO ACTIONS
// ============================================================
async function actionNuevoIngreso() {
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  const pOpts = periodosList.map(p => `<option value="${toDateStr(p.fecha)}" ${p.activo?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}</option>`).join('');
  showForm('Nuevo Ingreso', `
    <div class="mb-3"><label class="form-label">Período</label><select class="form-select" id="f-periodo">${pOpts}</select></div>
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-0"><label class="form-label">Cantidad</label><input type="number" class="form-control" id="f-cant" min="1" value="1"></div>`,
  async () => {
    if (!v('f-epp')) throw new Error('Seleccione un EPP');
    if (!v('f-talla')) throw new Error('Seleccione una talla');
    await API.crearIngreso({ periodo: v('f-periodo'), epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad: v('f-cant') });
    hideForm(); await loadIngresos();
    showAlert('Ingreso registrado', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
}

async function actionEditarIngreso() {
  if (!selectedId) return showAlert('Seleccione un ingreso', 'Atención', '⚠️');
  const ing = await API.request('GET', `/ingresos/${selectedId}`);
  if (ing.estado === 'ANULADO') return showAlert('No se puede editar un ingreso anulado', 'Atención', '⚠️');
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}" ${e.id===ing.epp_id?'selected':''}>${e.nombre}</option>`).join('');
  const pOpts = periodosList.map(p => `<option value="${toDateStr(p.fecha)}" ${toDateStr(p.fecha)===toDateStr(ing.periodo)?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}</option>`).join('');
  showForm('Editar Ingreso', `
    <div class="mb-3"><label class="form-label">Período</label><select class="form-select" id="f-periodo">${pOpts}</select></div>
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-0"><label class="form-label">Cantidad</label><input type="number" class="form-control" id="f-cant" min="1" value="${ing.cantidad}"></div>`,
  async () => {
    await API.actualizarIngreso(selectedId, { periodo: v('f-periodo'), epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad: v('f-cant') });
    hideForm(); selectedId = null; await loadIngresos();
    showAlert('Ingreso actualizado', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
  setTimeout(() => { const s = document.getElementById('f-talla'); if (s) s.value = ing.talla_id; }, 200);
}

async function actionAnularIngreso() {
  if (!selectedId) return showAlert('Seleccione un ingreso', 'Atención', '⚠️');
  if (!await showConfirm('¿Anular este ingreso? Afectará el stock.', 'Anular', 'Anular', '⚠️')) return;
  await API.anularIngreso(selectedId);
  selectedId = null; await loadIngresos();
  showAlert('Ingreso anulado', 'Éxito', '✅');
}

// ============================================================
// ENTREGA ACTIONS
// ============================================================
async function actionNuevaEntrega() {
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  const tOpts = trabajadoresList.filter(t => t.estado === 'ACTIVO').map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  const pOpts = periodosList.map(p => `<option value="${toDateStr(p.fecha)}" ${p.activo?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}</option>`).join('');
  showForm('Nueva Entrega', `
    <div class="mb-3"><label class="form-label">Período</label><select class="form-select" id="f-periodo">${pOpts}</select></div>
    <div class="mb-3"><label class="form-label">Trabajador</label><select class="form-select" id="f-trab">${tOpts}</select></div>
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-0"><label class="form-label">Cantidad</label><input type="number" class="form-control" id="f-cant" min="1" value="1"></div>`,
  async () => {
    if (!v('f-epp')) throw new Error('Seleccione un EPP');
    if (!v('f-talla')) throw new Error('Seleccione una talla');
    await API.crearEntrega({ periodo: v('f-periodo'), trabajador_id: v('f-trab'), epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad: v('f-cant') });
    hideForm(); await loadEntregas();
    showAlert('Entrega registrada', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
}

async function actionEntregaMuda() {
  const tOpts = trabajadoresList.filter(t => t.estado === 'ACTIVO').map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  const pOpts = periodosList.map(p => `<option value="${toDateStr(p.fecha)}" ${p.activo?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}</option>`).join('');
  const tallOpts = tallasList.filter(t => t.estado === 'ACTIVO').map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  showForm('Entrega MUDA', `
    <div class="mb-3"><label class="form-label">Período</label><select class="form-select" id="f-periodo">${pOpts}</select></div>
    <div class="mb-3"><label class="form-label">Trabajador</label><select class="form-select" id="f-trab">${tOpts}</select></div>
    <div class="mb-3"><label class="form-label">Talla (se aplica a todos excepto Casco)</label><select class="form-select" id="f-talla">${tallOpts}</select></div>
    <div class="alert alert-info mb-0"><i class="bi bi-info-circle me-1"></i>Se entregará 1 Pantalón, 1 Polo, 1 Chaleco y 1 Guantes.</div>`,
  async () => {
    await API.crearEntregaMuda({ periodo: v('f-periodo'), trabajador_id: v('f-trab'), talla_id: v('f-talla') });
    hideForm(); await loadEntregas();
    showAlert('Entrega MUDA registrada', 'Éxito', '✅');
  });
  openFormModal();
}

async function actionEditarEntrega() {
  if (!selectedId) return showAlert('Seleccione una entrega', 'Atención', '⚠️');
  const ent = await API.request('GET', `/entregas/${selectedId}`);
  if (ent.estado === 'ANULADO') return showAlert('No se puede editar una entrega anulada', 'Atención', '⚠️');
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}" ${e.id===ent.epp_id?'selected':''}>${e.nombre}</option>`).join('');
  const tOpts = trabajadoresList.filter(t => t.estado === 'ACTIVO').map(t => `<option value="${t.id}" ${t.id===ent.trabajador_id?'selected':''}>${t.nombre}</option>`).join('');
  const pOpts = periodosList.map(p => `<option value="${toDateStr(p.fecha)}" ${toDateStr(p.fecha)===toDateStr(ent.periodo)?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}</option>`).join('');
  showForm('Editar Entrega', `
    <div class="mb-3"><label class="form-label">Período</label><select class="form-select" id="f-periodo">${pOpts}</select></div>
    <div class="mb-3"><label class="form-label">Trabajador</label><select class="form-select" id="f-trab">${tOpts}</select></div>
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-0"><label class="form-label">Cantidad</label><input type="number" class="form-control" id="f-cant" min="1" value="${ent.cantidad}"></div>`,
  async () => {
    await API.actualizarEntrega(selectedId, { periodo: v('f-periodo'), trabajador_id: v('f-trab'), epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad: v('f-cant') });
    hideForm(); selectedId = null; await loadEntregas();
    showAlert('Entrega actualizada', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
  setTimeout(() => { const s = document.getElementById('f-talla'); if (s) s.value = ent.talla_id; }, 200);
}

async function actionAnularEntrega() {
  if (!selectedId) return showAlert('Seleccione una entrega', 'Atención', '⚠️');
  if (!await showConfirm('¿Anular esta entrega? Afectará el stock.', 'Anular', 'Anular', '⚠️')) return;
  await API.anularEntrega(selectedId);
  selectedId = null; await loadEntregas();
  showAlert('Entrega anulada', 'Éxito', '✅');
}

// ============================================================
// DEVOLUCION ACTIONS
// ============================================================
async function actionNuevaDev() {
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  const tOpts = trabajadoresList.filter(t => t.estado === 'ACTIVO').map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  const pOpts = periodosList.map(p => `<option value="${toDateStr(p.fecha)}" ${p.activo?'selected':''}>${new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}</option>`).join('');
  showForm('Nueva Devolución', `
    <div class="mb-3"><label class="form-label">Período</label><select class="form-select" id="f-periodo">${pOpts}</select></div>
    <div class="mb-3"><label class="form-label">Trabajador</label><select class="form-select" id="f-trab">${tOpts}</select></div>
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-3"><label class="form-label">Cantidad</label><input type="number" class="form-control" id="f-cant" min="1" value="1"></div>
    <div class="alert alert-warning mb-0"><i class="bi bi-info-circle me-1"></i>Entrará en estado <strong>SUCIO</strong>.</div>`,
  async () => {
    if (!v('f-epp')) throw new Error('Seleccione un EPP');
    if (!v('f-talla')) throw new Error('Seleccione una talla');
    await API.crearDevolucion({ periodo: v('f-periodo'), trabajador_id: v('f-trab'), epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad: v('f-cant') });
    hideForm(); await loadDevoluciones();
    showAlert('Devolución registrada', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
}

async function actionCambiarEstado() {
  const data = await API.getDevoluciones({ estado: 'SUCIO,EN_LAVADO,LAVADO' });
  const activas = Array.isArray(data) ? data.filter(d => d.estado_registro !== 'ANULADO') : [];
  if (!activas.length) return showAlert('No hay devoluciones activas para cambiar estado', 'Atención', '⚠️');
  const devOpts = activas.map(d => `<option value="${d.id}">#${d.id} - ${d.epp_nombre} ${d.talla_nombre} (${d.trabajador_nombre}) [${fmtEstado(d.estado)}]</option>`).join('');
  showForm('Cambiar Estado de Devolución', `
    <div class="mb-3"><label class="form-label">Seleccione la devolución</label><select class="form-select" id="f-dev-select">${devOpts}</select></div>
    <div id="f-estado-box" class="d-none"><label class="form-label">Estado actual</label><input type="text" class="form-control mb-3" id="f-estado-actual" disabled>
    <label class="form-label">Nuevo estado</label><select class="form-select" id="f-estado"></select></div>`,
  async () => {
    const devId = v('f-dev-select');
    const nuevoEstado = v('f-estado');
    if (!nuevoEstado) return showAlert('Seleccione un nuevo estado', 'Atención', '⚠️');
    await API.cambiarEstadoDevolucion(devId, nuevoEstado);
    hideForm(); await loadDevoluciones();
    showAlert('Estado actualizado', 'Éxito', '✅');
  });
  openFormModal();
  requestAnimationFrame(async () => {
    const sel = document.getElementById('f-dev-select');
    if (!sel) return;
    const loadEstados = async () => {
      const id = sel.value;
      const box = document.getElementById('f-estado-box');
      if (!id) { box.classList.add('d-none'); return; }
      const dev = await API.request('GET', `/devoluciones/${id}`);
      const tr = await API.getTransicionesDevolucion(id);
      document.getElementById('f-estado-actual').value = fmtEstado(dev.estado);
      const estSel = document.getElementById('f-estado');
      estSel.innerHTML = tr.transiciones.map(t => `<option value="${t}">${fmtEstado(t)}</option>`).join('');
      box.classList.remove('d-none');
    };
    sel.addEventListener('change', loadEstados);
    await loadEstados();
  });
}

async function actionHistorial() {
  const data = await API.getDevoluciones();
  if (!data.length) return showAlert('No hay devoluciones', 'Atención', '⚠️');
  const devOpts = data.map(d => `<option value="${d.id}">#${d.id} - ${d.epp_nombre} ${d.talla_nombre} (${d.trabajador_nombre})</option>`).join('');
  showForm('Historial de Devolución', `
    <div class="mb-0"><label class="form-label">Seleccione la devolución</label><select class="form-select" id="f-dev-hist-select">${devOpts}</select></div>`,
  async () => {
    const id = v('f-dev-hist-select');
    const h = await API.getHistorialDevolucion(id);
    let html = '<table class="table table-sm"><thead><tr><th>Fecha</th><th>Anterior</th><th>Nuevo</th><th>Usuario</th></tr></thead><tbody>';
    h.forEach(r => { html += `<tr><td>${formatDate(r.fecha)}</td><td>${r.estado_anterior||'-'}</td><td>${fmtEstado(r.estado_nuevo)}</td><td>${r.usuario_nombre||'-'}</td></tr>`; });
    html += '</tbody></table>';
    document.getElementById('modal-historial-body').innerHTML = html || '<p style="color:var(--text3)">Sin historial</p>';
    hideForm();
    new bootstrap.Modal(document.getElementById('modal-historial')).show();
  }, 'Ver Historial');
  openFormModal();
}

async function actionAnularDev() {
  const data = await API.getDevoluciones();
  const activas = data.filter(d => d.estado_registro !== 'ANULADO');
  if (!activas.length) return showAlert('No hay devoluciones activas para anular', 'Atención', '⚠️');
  const devOpts = activas.map(d => `<option value="${d.id}">#${d.id} - ${d.epp_nombre} ${d.talla_nombre} (${d.trabajador_nombre}) [${fmtEstado(d.estado)}]</option>`).join('');
  showForm('Anular Devolución', `
    <div class="mb-0"><label class="form-label">Seleccione la devolución a anular</label><select class="form-select" id="f-dev-anular-select">${devOpts}</select></div>`,
  async () => {
    const id = v('f-dev-anular-select');
    if (!await showConfirm('¿Anular esta devolución?', 'Anular', 'Anular', '⚠️')) return;
    await API.anularDevolucion(id);
    hideForm(); await loadDevoluciones();
    showAlert('Devolución anulada', 'Éxito', '✅');
  }, 'Anular');
  openFormModal();
}

// ============================================================
// INVENTARIO FÍSICO
// ============================================================
async function actionRegFisico() {
  const opts = eppList.filter(e => e.estado === 'ACTIVO').map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  showForm('Registrar Inventario Físico', `
    <div class="mb-3"><label class="form-label">EPP</label><select class="form-select" id="f-epp">${opts}</select></div>
    <div class="mb-3"><label class="form-label">Talla</label><select class="form-select" id="f-talla"></select></div>
    <div class="mb-0"><label class="form-label">Cantidad Física</label><input type="number" class="form-control" id="f-cant" min="0" value="0"></div>`,
  async () => {
    if (!v('f-epp')) throw new Error('Seleccione un EPP');
    if (!v('f-talla')) throw new Error('Seleccione una talla');
    await API.registrarInventarioFisico({ epp_id: v('f-epp'), talla_id: v('f-talla'), cantidad_fisica: v('f-cant') });
    hideForm(); await loadSistematico();
    showAlert('Inventario físico registrado', 'Éxito', '✅');
  });
  openFormModal();
  wireCascade('f-epp', 'f-talla');
}

// ============================================================
// TRABAJADOR ACTIONS
// ============================================================
async function actionNuevoTrab() {
  showForm('Nuevo Trabajador', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre"></div>
    <div class="mb-3"><label class="form-label">DNI</label><input type="text" class="form-control" id="f-dni" maxlength="12"></div>
    <div class="mb-3"><label class="form-label">Cargo</label><input type="text" class="form-control" id="f-cargo"></div>
    <div class="mb-0"><label class="form-label">Área</label><input type="text" class="form-control" id="f-area"></div>`,
  async () => {
    await API.crearTrabajador({ nombre: v('f-nombre'), dni: v('f-dni'), cargo: v('f-cargo'), area: v('f-area') });
    hideForm(); await loadBase(); await loadTrabajadores();
    showAlert('Trabajador creado', 'Éxito', '✅');
  });
  openFormModal();
}

async function actionEditarTrab() {
  if (!selectedId) return showAlert('Seleccione un trabajador', 'Atención', '⚠️');
  const t = await API.request('GET', `/trabajadores/${selectedId}`);
  showForm('Editar Trabajador', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre" value="${t.nombre}"></div>
    <div class="mb-3"><label class="form-label">DNI</label><input type="text" class="form-control" id="f-dni" value="${t.dni}" maxlength="12"></div>
    <div class="mb-3"><label class="form-label">Cargo</label><input type="text" class="form-control" id="f-cargo" value="${t.cargo||''}"></div>
    <div class="mb-3"><label class="form-label">Área</label><input type="text" class="form-control" id="f-area" value="${t.area||''}"></div>
    <div class="mb-0"><label class="form-label">Estado</label><select class="form-select" id="f-estado">
      <option value="ACTIVO" ${t.estado==='ACTIVO'?'selected':''}>Activo</option>
      <option value="INACTIVO" ${t.estado==='INACTIVO'?'selected':''}>Inactivo</option></select></div>`,
  async () => {
    await API.actualizarTrabajador(selectedId, { nombre: v('f-nombre'), dni: v('f-dni'), cargo: v('f-cargo'), area: v('f-area'), estado: v('f-estado') });
    hideForm(); selectedId = null; await loadBase(); await loadTrabajadores();
    showAlert('Trabajador actualizado', 'Éxito', '✅');
  });
  openFormModal();
}

async function actionEliminarTrab() {
  if (!selectedId) return showAlert('Seleccione un trabajador', 'Atención', '⚠️');
  if (!await showConfirm('¿Eliminar este trabajador?', 'Eliminar', 'Eliminar', '🗑️')) return;
  await API.eliminarTrabajador(selectedId);
  selectedId = null; await loadBase(); await loadTrabajadores();
}

// ============================================================
// INGRESOS / ENTREGAS / DEVOLUCIONES - List
// ============================================================
async function loadIngresos() {
  fillEppSelects(); fillTallaSelects();
  const data = await API.getIngresos({ epp_id:v('filtro-ing-epp'), talla_id:v('filtro-ing-talla'), estado:v('filtro-ing-estado'), fecha_desde:v('filtro-ing-desde'), fecha_hasta:v('filtro-ing-hasta') });
  const tb = document.getElementById('ingresos-table-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:32px;color:var(--text3)">No hay ingresos</td></tr>'; return; }
  tb.innerHTML = data.map(i => `<tr class="${i.estado==='ANULADO'?'row-anulado':''}" data-id="${i.id}" onclick="selectRow(this)">
    <td>${i.id}</td><td>${formatDate(i.fecha)}</td><td>${i.epp_nombre}</td><td>${i.talla_nombre}</td>
    <td class="fw-bold">${i.cantidad}</td><td>${i.usuario_nombre||'-'}</td>
    <td><span class="badge ${i.estado==='ACTIVO'?'bg-success':'bg-danger'}">${i.estado}</span></td></tr>`).join('');
}

async function loadEntregas() {
  fillEppSelects(); fillTallaSelects(); fillTrabSelects();
  const showDni = API.getUser()?.rol === 'ADMIN';
  const data = await API.getEntregas({ epp_id:v('filtro-ent-epp'), talla_id:v('filtro-ent-talla'), trabajador_id:v('filtro-ent-trabajador'), estado:v('filtro-ent-estado'), fecha_desde:v('filtro-ent-desde'), fecha_hasta:v('filtro-ent-hasta') });
  const tb = document.getElementById('entregas-table-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:32px;color:var(--text3)">No hay entregas</td></tr>'; return; }
  tb.innerHTML = data.map(e => `<tr class="${e.estado==='ANULADO'?'row-anulado':''}" data-id="${e.id}" onclick="selectRow(this)">
    <td>${e.id}</td><td>${formatDate(e.fecha)}</td><td>${e.trabajador_nombre}</td>
    <td>${showDni?e.trabajador_dni:'***'}</td><td>${e.epp_nombre}</td><td>${e.talla_nombre}</td>
    <td class="fw-bold">${e.cantidad}</td><td>${e.usuario_nombre||'-'}</td>
    <td><span class="badge ${e.estado==='ACTIVO'?'bg-success':'bg-danger'}">${e.estado}</span></td></tr>`).join('');
}

async function loadDevoluciones() {
  fillEppSelects(); fillTallaSelects(); fillTrabSelects();
  const showDni = API.getUser()?.rol === 'ADMIN';
  const data = await API.getDevoluciones({ epp_id:v('filtro-dev-epp'), talla_id:v('filtro-dev-talla'), trabajador_id:v('filtro-dev-trabajador'), estado:v('filtro-dev-estado'), fecha_desde:v('filtro-dev-desde'), fecha_hasta:v('filtro-dev-hasta') });
  const tb = document.getElementById('devoluciones-table-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:32px;color:var(--text3)">No hay devoluciones</td></tr>'; return; }
  tb.innerHTML = data.map(d => `<tr class="${d.estado_registro==='ANULADO'?'row-anulado':''}" data-id="${d.id}" onclick="selectRow(this)">
    <td>${d.id}</td><td>${formatDate(d.fecha)}</td><td>${d.trabajador_nombre}</td>
    <td>${showDni?d.trabajador_dni:'***'}</td><td>${d.epp_nombre}</td><td>${d.talla_nombre}</td>
    <td class="fw-bold">${d.cantidad}</td>
    <td><span class="badge ${badgeCls(d.estado)}">${fmtEstado(d.estado)}</span></td>
    <td>${d.usuario_nombre||'-'}</td></tr>`).join('');
}

// ============================================================
// SISTEMÁTICO
// ============================================================
async function loadSistematico() {
  await refreshPeriodos(); fillPeriodoSelects();
  const periodo = v('sist-periodo');
  if (!periodo) { document.getElementById('sist-table-body').innerHTML = '<tr><td colspan="10" class="text-center" style="padding:32px;color:var(--text3)">Seleccione un período</td></tr>'; return; }
  const vista = await API.getSistematico(periodo);
  const tb = document.getElementById('sist-table-body');
  if (!vista.length) { tb.innerHTML = '<tr><td colspan="10" class="text-center" style="padding:32px;color:var(--text3)">Sin datos</td></tr>'; return; }
  tb.innerHTML = vista.map(v => {
    const rc = v.estado==='CONFORME'?'row-conforme':v.estado==='FALTANTE'?'row-faltante':v.estado==='SOBRANTE'?'row-sobrante':'';
    const bc = v.estado==='CONFORME'?'bg-success':v.estado==='FALTANTE'?'bg-danger':v.estado==='SOBRANTE'?'bg-warning text-dark':'bg-secondary';
    return `<tr class="${rc}"><td class="fw-semibold">${v.epp_nombre}</td><td>${v.talla_nombre}</td><td>${v.stock_inicial}</td><td>${v.ingresos}</td><td>${v.entregas}</td><td>${v.lavados}</td><td class="fw-bold">${v.sistematico}</td><td>${v.cantidad_fisica!==null?v.cantidad_fisica:'-'}</td><td>${v.diferencia!==null?v.diferencia:'-'}</td><td><span class="badge ${bc}">${v.estado}</span></td></tr>`;
  }).join('');
}

// ============================================================
// CONSULTAS
// ============================================================
async function loadConsultas() {
  fillEppSelects(); fillTallaSelects(); fillTrabSelects();
  // Fill periodos filter
  const pSel = document.getElementById('filtro-cons-periodo');
  if (pSel && !pSel.dataset.filled) {
    periodosList.forEach(p => {
      const o = document.createElement('option');
      o.value = toDateStr(p.fecha);
      o.textContent = new Date(toDateStr(p.fecha)+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}) + (p.activo?' (Activo)':'');
      pSel.appendChild(o);
    });
    pSel.dataset.filled = '1';
  }
  const data = await API.buscarConsultas({ tipo:v('filtro-cons-tipo'), epp_id:v('filtro-cons-epp'), talla_id:v('filtro-cons-talla'), trabajador_id:v('filtro-cons-trabajador'), fecha_desde:v('filtro-cons-desde'), fecha_hasta:v('filtro-cons-hasta'), periodo:v('filtro-cons-periodo') });
  const tb = document.getElementById('consultas-table-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:32px;color:var(--text3)">Sin resultados</td></tr>'; return; }
  tb.innerHTML = data.map(r => `<tr><td>${formatDate(r.fecha)}</td><td><span class="badge bg-info">${r.tipo}</span></td><td>${r.epp_nombre||'-'}</td><td>${r.talla_nombre||'-'}</td><td>${r.trabajador_nombre||'-'}</td><td class="fw-bold">${r.cantidad}</td><td><small>${r.detalle||'-'}</small></td><td>${r.usuario_nombre||'-'}</td></tr>`).join('');
}

// ============================================================
// TRABAJADORES
// ============================================================
async function loadTrabajadores() {
  fillTrabSelects();
  const q = v('busqueda-trab');
  const data = q ? await API.buscarTrabajadores(q) : await API.getTrabajadores(true);
  const showDni = API.getUser()?.rol === 'ADMIN';
  const tb = document.getElementById('trabajadores-table-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:32px;color:var(--text3)">Sin trabajadores</td></tr>'; return; }
  tb.innerHTML = data.map(t => `<tr class="${t.estado==='INACTIVO'?'row-inactivo':''}" data-id="${t.id}" onclick="selectRow(this)">
    <td>${t.id}</td><td><code>${t.codigo||'-'}</code></td><td>${t.nombre}</td>
    <td>${showDni?t.dni:'***'}</td><td>${t.cargo||'-'}</td><td>${t.area||'-'}</td>
    <td><span class="badge ${t.estado==='ACTIVO'?'bg-success':'bg-secondary'}">${t.estado}</span></td></tr>`).join('');
}

// ============================================================
// CONFIGURACIÓN
// ============================================================
function initConfigTabs() {
  document.querySelectorAll('#config-tabs .nav-link').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#config-tabs .nav-link').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('#config-tab-content .tab-pane').forEach(p => p.classList.remove('show','active'));
      document.getElementById(tab.dataset.tab)?.classList.add('show','active');
    });
  });
}

async function loadConfig() {
  // EPP
  const epp = await API.getEpp(true);
  document.getElementById('config-epp-table').innerHTML = epp.map(e => {
    const t = (tallasPorEpp[e.id]||[]).map(x=>x.nombre).join(', ')||'-';
    return `<tr class="${e.estado==='INACTIVO'?'row-inactivo':''}"><td>${e.id}</td><td>${e.nombre}</td><td>${e.descripcion||'-'}</td><td><small style="color:var(--text3)">${t}</small></td><td><span class="badge ${e.estado==='ACTIVO'?'bg-success':'bg-secondary'}">${e.estado}</span></td><td><button class="btn btn-outline-warning btn-sm" onclick="actionEditarEpp(${e.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-outline-danger btn-sm" onclick="actionEliminarEpp(${e.id})"><i class="bi bi-trash"></i></button></td></tr>`;
  }).join('');

  // Tallas
  const tallas = await API.getTallas(true);
  document.getElementById('config-tallas-table').innerHTML = tallas.map(t => `<tr class="${t.estado==='INACTIVO'?'row-inactivo':''}"><td>${t.id}</td><td>${t.nombre}</td><td>${t.orden}</td><td><span class="badge ${t.estado==='ACTIVO'?'bg-success':'bg-secondary'}">${t.estado}</span></td><td><button class="btn btn-outline-warning btn-sm" onclick="actionEditarTalla(${t.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-outline-danger btn-sm" onclick="actionEliminarTalla(${t.id})"><i class="bi bi-trash"></i></button></td></tr>`).join('');

  // Usuarios
  const users = await API.getUsuarios();
  const cur = API.getUser();
  document.getElementById('config-usuarios-table').innerHTML = users.map(u => `<tr class="${u.estado==='INACTIVO'?'row-inactivo':''}"><td>${u.id}</td><td>${u.nombre}</td><td>${u.username}</td><td><span class="badge ${u.rol==='ADMIN'?'bg-primary':u.rol==='ALMACEN'?'bg-success':'bg-secondary'}">${u.rol}</span></td><td><span class="badge ${u.estado==='ACTIVO'?'bg-success':'bg-secondary'}">${u.estado}</span></td><td><button class="btn btn-outline-warning btn-sm" onclick="actionEditarUsuario(${u.id})"><i class="bi bi-pencil"></i></button>${u.id!==cur.id?` <button class="btn btn-outline-danger btn-sm" onclick="actionToggleUsuario(${u.id},'${u.estado}')"><i class="bi bi-${u.estado==='ACTIVO'?'lock':'unlock'}"></i></button>`:''}</td></tr>`).join('');
}

// ---- EPP Config ----
async function actionNuevoEpp() {
  const th = tallasList.filter(t=>t.estado==='ACTIVO').map(t=>
    `<div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" value="${t.id}" id="f-t-${t.id}"><label class="form-check-label" for="f-t-${t.id}">${t.nombre}</label></div>`
  ).join('');
  showForm('Nuevo EPP', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre"></div>
    <div class="mb-3"><label class="form-label">Descripción</label><input type="text" class="form-control" id="f-desc"></div>
    <div class="mb-0"><label class="form-label">Tallas</label><div>${th}</div></div>`,
  async () => {
    const tallas = tallasList.filter(t => document.getElementById(`f-t-${t.id}`)?.checked).map(t => t.id);
    await API.crearEpp({ nombre: v('f-nombre'), descripcion: v('f-desc'), tallas });
    hideForm(); await loadBase(); await loadConfig();
    showAlert('EPP creado', 'Éxito', '✅');
  });
  openFormModal();
}

window.actionEditarEpp = async function(id) {
  const epp = await API.request('GET', `/epp/${id}`);
  const th = tallasList.filter(t=>t.estado==='ACTIVO').map(t=>{
    const a = tallasPorEpp[id]?.some(x=>x.id===t.id);
    return `<div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" value="${t.id}" id="f-t-${t.id}" ${a?'checked':''}><label class="form-check-label" for="f-t-${t.id}">${t.nombre}</label></div>`;
  }).join('');
  showForm('Editar EPP', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre" value="${epp.nombre}"></div>
    <div class="mb-3"><label class="form-label">Descripción</label><input type="text" class="form-control" id="f-desc" value="${epp.descripcion||''}"></div>
    <div class="mb-3"><label class="form-label">Estado</label><select class="form-select" id="f-estado"><option value="ACTIVO" ${epp.estado==='ACTIVO'?'selected':''}>Activo</option><option value="INACTIVO" ${epp.estado==='INACTIVO'?'selected':''}>Inactivo</option></select></div>
    <div class="mb-0"><label class="form-label">Tallas</label><div>${th}</div></div>`,
  async () => {
    const tallas = tallasList.filter(t => document.getElementById(`f-t-${t.id}`)?.checked).map(t => t.id);
    await API.actualizarEpp(id, { nombre: v('f-nombre'), descripcion: v('f-desc'), estado: v('f-estado'), tallas });
    hideForm(); await loadBase(); await loadConfig();
    showAlert('EPP actualizado', 'Éxito', '✅');
  });
  openFormModal();
};

window.actionEliminarEpp = async function(id) {
  if (!await showConfirm('¿Eliminar este EPP?', 'Eliminar', 'Eliminar', '🗑️')) return;
  await API.eliminarEpp(id); await loadBase(); await loadConfig();
};

// ---- Tallas Config ----
function actionNuevaTalla() {
  showForm('Nueva Talla', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre"></div>
    <div class="mb-0"><label class="form-label">Orden</label><input type="number" class="form-control" id="f-orden" value="0"></div>`,
  async () => {
    await API.crearTalla({ nombre: v('f-nombre'), orden: v('f-orden') });
    hideForm(); await loadBase(); await loadConfig();
    showAlert('Talla creada', 'Éxito', '✅');
  });
  openFormModal();
}

window.actionEditarTalla = async function(id) {
  const t = await API.request('GET', `/tallas/${id}`);
  showForm('Editar Talla', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre" value="${t.nombre}"></div>
    <div class="mb-3"><label class="form-label">Orden</label><input type="number" class="form-control" id="f-orden" value="${t.orden}"></div>
    <div class="mb-0"><label class="form-label">Estado</label><select class="form-select" id="f-estado"><option value="ACTIVO" ${t.estado==='ACTIVO'?'selected':''}>Activo</option><option value="INACTIVO" ${t.estado==='INACTIVO'?'selected':''}>Inactivo</option></select></div>`,
  async () => {
    await API.actualizarTalla(id, { nombre: v('f-nombre'), orden: v('f-orden'), estado: v('f-estado') });
    hideForm(); await loadBase(); await loadConfig();
    showAlert('Talla actualizada', 'Éxito', '✅');
  });
  openFormModal();
};

window.actionEliminarTalla = async function(id) {
  if (!await showConfirm('¿Eliminar esta talla?', 'Eliminar', 'Eliminar', '🗑️')) return;
  await API.eliminarTalla(id); await loadBase(); await loadConfig();
};

// ---- Usuarios Config ----
function actionNuevoUsuario() {
  showForm('Nuevo Usuario', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre"></div>
    <div class="mb-3"><label class="form-label">Usuario</label><input type="text" class="form-control" id="f-username"></div>
    <div class="mb-3"><label class="form-label">Contraseña</label><input type="password" class="form-control" id="f-pass"></div>
    <div class="mb-0"><label class="form-label">Rol</label><select class="form-select" id="f-rol"><option value="ADMIN">ADMIN</option><option value="ALMACEN">ALMACEN</option><option value="CONSULTA" selected>CONSULTA</option></select></div>`,
  async () => {
    await API.crearUsuario({ nombre: v('f-nombre'), username: v('f-username'), password: v('f-pass'), rol: v('f-rol') });
    hideForm(); await loadConfig();
    showAlert('Usuario creado', 'Éxito', '✅');
  });
  openFormModal();
}

window.actionEditarUsuario = async function(id) {
  const u = await API.request('GET', `/usuarios/${id}`);
  showForm('Editar Usuario', `
    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="f-nombre" value="${u.nombre}"></div>
    <div class="mb-3"><label class="form-label">Usuario</label><input type="text" class="form-control" id="f-username" value="${u.username}"></div>
    <div class="mb-3"><label class="form-label">Nueva Contraseña (vacío = no cambiar)</label><input type="password" class="form-control" id="f-pass"></div>
    <div class="mb-0"><label class="form-label">Rol</label><select class="form-select" id="f-rol"><option value="ADMIN" ${u.rol==='ADMIN'?'selected':''}>ADMIN</option><option value="ALMACEN" ${u.rol==='ALMACEN'?'selected':''}>ALMACEN</option><option value="CONSULTA" ${u.rol==='CONSULTA'?'selected':''}>CONSULTA</option></select></div>`,
  async () => {
    const data = { nombre: v('f-nombre'), username: v('f-username'), rol: v('f-rol') };
    const pass = v('f-pass');
    if (pass) data.password = pass;
    await API.actualizarUsuario(id, data);
    hideForm(); await loadConfig();
    showAlert('Usuario actualizado', 'Éxito', '✅');
  });
  openFormModal();
};

window.actionToggleUsuario = async function(id, estado) {
  if (estado === 'ACTIVO') {
    if (!await showConfirm('¿Desactivar este usuario?', 'Desactivar', 'Desactivar', '🔒')) return;
    await API.eliminarUsuario(id);
  } else {
    await API.activarUsuario(id);
  }
  await loadConfig();
};

// ============================================================
// EXPORT
// ============================================================
async function downloadPdf(endpoint, periodo, withFilters) {
  try {
    const params = {};
    if (withFilters) {
      params.tipo = v('filtro-cons-tipo'); params.epp_id = v('filtro-cons-epp');
      params.talla_id = v('filtro-cons-talla'); params.trabajador_id = v('filtro-cons-trabajador');
      params.fecha_desde = v('filtro-cons-desde'); params.fecha_hasta = v('filtro-cons-hasta');
      params.periodo = v('filtro-cons-periodo');
    } else if (periodo) {
      params.periodo = periodo;
    }
    await API.downloadPdf(endpoint, params);
  } catch (err) {
    showAlert(err.message, 'Error', '❌');
  }
}

function downloadExcel(endpoint, periodo) {
  const params = {};
  if (periodo) params.periodo = periodo;
  const url = API.baseURL + endpoint + '?' + new URLSearchParams(params).toString();
  const a = document.createElement('a');
  a.href = url;
  const token = API.token;
  fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.blob())
    .then(blob => {
      a.href = URL.createObjectURL(blob);
      a.download = 'reporte_' + (periodo || 'todos') + '.csv';
      a.click();
      showAlert('Excel descargado', 'Éxito', '📄');
    })
    .catch(err => showAlert(err.message, 'Error', '❌'));
}
