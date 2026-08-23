// ============================================================
// Service: Reportes PDF (pdfkit)
// ============================================================
const PDFDocument = require('pdfkit');
const InventarioService = require('./inventarioService');
const ConsultaService = require('./consultaService');

// Colores del sistema
const COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  dark: '#1e293b',
  muted: '#64748b',
  light: '#f3f5f9',
  white: '#ffffff',
  border: '#e2e8f0',
  tableHead: '#f1f5f9',
  stripe: '#f8fafc'
};

class ReporteService {

  // ---- Helper: dibujar tabla ----
  static drawTable(doc, startY, headers, rows, options = {}) {
    const { colWidths, align = [] } = options;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalCols = headers.length;
    const widths = colWidths || headers.map(() => pageW / totalCols);
    let y = startY;
    const x = doc.page.margins.left;
    const rowH = 20;
    const fontSize = 8;

    // Header
    doc.rect(x, y, pageW, rowH).fill(COLORS.tableHead);
    let cx = x;
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.dark);
      doc.text(h, cx + 4, y + 5, { width: widths[i] - 8, align: align[i] || 'left' });
      cx += widths[i];
    });
    y += rowH;

    // Rows
    rows.forEach((row, ri) => {
      if (y + rowH > doc.page.height - 50) {
        doc.addPage();
        y = doc.page.margins.top;
        // Re-draw header
        doc.rect(x, y, pageW, rowH).fill(COLORS.tableHead);
        cx = x;
        headers.forEach((h, i) => {
          doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.dark);
          doc.text(h, cx + 4, y + 5, { width: widths[i] - 8, align: align[i] || 'left' });
          cx += widths[i];
        });
        y += rowH;
      }

      // Stripe
      if (ri % 2 === 0) {
        doc.rect(x, y, pageW, rowH).fill(COLORS.stripe);
      } else {
        doc.rect(x, y, pageW, rowH).fill(COLORS.white);
      }

      // Row color for specific statuses
      const rowStr = row.join(' ').toLowerCase();
      if (rowStr.includes('anulado')) {
        doc.rect(x, y, pageW, rowH).fill('#fef2f2');
      } else if (rowStr.includes('faltante')) {
        doc.rect(x, y, pageW, rowH).fill('#fef2f2');
      } else if (rowStr.includes('sobrante')) {
        doc.rect(x, y, pageW, rowH).fill('#fffbeb');
      } else if (rowStr.includes('conforme')) {
        doc.rect(x, y, pageW, rowH).fill('#f0fdf4');
      }

      // Border
      doc.rect(x, y, pageW, rowH).lineWidth(0.5).strokeColor(COLORS.border).stroke();

      cx = x;
      row.forEach((cell, ci) => {
        doc.font('Helvetica').fontSize(fontSize).fillColor(COLORS.dark);
        doc.text(String(cell ?? '-'), cx + 4, y + 5, { width: widths[ci] - 8, align: align[ci] || 'left' });
        cx += widths[ci];
      });
      y += rowH;
    });

    return y;
  }

  // ---- Helper: dibujar gráfico de barras horizontal ----
  static drawBarChart(doc, startY, title, items, color) {
    const x = doc.page.margins.left;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = startY;

    // Title
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.dark);
    doc.text(title, x, y);
    y += 18;

    if (items.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
      doc.text('Sin datos', x, y);
      return y + 15;
    }

    const maxVal = Math.max(...items.map(i => i.value || 0), 1);
    const barH = 14;
    const barGap = 4;
    const labelW = 80;
    const barAreaW = pageW - labelW - 40;

    items.forEach((item, idx) => {
      if (y + barH + barGap > doc.page.height - 50) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      const barW = Math.max(((item.value || 0) / maxVal) * barAreaW, 2);

      // Label
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
      doc.text(item.label, x, y + 3, { width: labelW, align: 'right' });

      // Bar background
      doc.rect(x + labelW + 5, y, barAreaW, barH).fill(COLORS.light);

      // Bar
      doc.rect(x + labelW + 5, y, barW, barH).fill(color);

      // Value
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.dark);
      doc.text(String(item.value || 0), x + labelW + barW + 10, y + 3, { width: 30 });

      y += barH + barGap;
    });

    return y + 10;
  }

  // ---- Helper: encabezado del reporte ----
  static drawHeader(doc, title, periodo) {
    const x = doc.page.margins.left;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Barra superior
    doc.rect(0, 0, doc.page.width, 60).fill(COLORS.dark);

    // Logo/ícono
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white);
    doc.text('Inventario EPP', x, 18);

    // Título
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
    doc.text(title, x, 38);

    // Fecha
    const now = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8');
    doc.text(now, doc.page.width - doc.page.margins.right - 120, 18, { width: 120, align: 'right' });

    if (periodo) {
      doc.text(`Período: ${periodo}`, doc.page.width - doc.page.margins.right - 120, 30, { width: 120, align: 'right' });
    }

    return 75; // startY after header
  }

  // ---- Helper: pie de página ----
  static drawFooter(doc) {
    const y = doc.page.height - 30;
    doc.rect(0, y - 5, doc.page.width, 35).fill(COLORS.dark);
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
    doc.text('Sistema de Inventario EPP - Reporte generado automáticamente', doc.page.margins.left, y, { width: 300 });
    doc.text(`Página ${doc.page.number}`, doc.page.width - doc.page.margins.right - 60, y, { width: 60, align: 'right' });
  }

  // ============================================================
  // PDF: Dashboard
  // ============================================================
  static async generarDashboard(periodo) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'letter', margin: 40, bufferPages: true });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        let y = this.drawHeader(doc, 'Dashboard - Resumen General', periodo);

        const data = await InventarioService.dashboard(periodo);

        // Resumen cards
        const cards = [
          ['Total EPP', data.totalEpp],
          ['Stock Disponible', data.stockDisponible],
          ['Sucios', data.sucios],
          ['En Lavado', data.enLavado],
          ['Lavados', data.lavados],
          ['Entregas', data.totalEntregas],
          ['Ingresos', data.totalIngresos],
          ['Pérdidas', data.totalPerdidas]
        ];

        doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.dark);
        doc.text('Resumen', doc.page.margins.left, y);
        y += 18;

        const cardW = 120;
        const cardH = 40;
        const cardGap = 8;
        let cx = doc.page.margins.left;
        cards.forEach((c, i) => {
          if (cx + cardW > doc.page.width - doc.page.margins.right) {
            cx = doc.page.margins.left;
            y += cardH + cardGap;
          }
          doc.roundedRect(cx, y, cardW, cardH, 4).fill(COLORS.white).lineWidth(1).strokeColor(COLORS.border).stroke();
          doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.primary);
          doc.text(String(c[1] || 0), cx + 8, y + 6, { width: cardW - 16 });
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
          doc.text(c[0], cx + 8, y + 26, { width: cardW - 16 });
          cx += cardW + cardGap;
        });
        y += cardH + cardGap + 15;

        // Stock por EPP
        if (data.porEpp && data.porEpp.length > 0) {
          const stockItems = data.porEpp.map(e => ({ label: e.nombre, value: e.stock || 0 }));
          y = this.drawBarChart(doc, y, 'Stock por EPP', stockItems, COLORS.primary);
        }

        // Ingresos por EPP
        if (data.ingresosPorEpp && data.ingresosPorEpp.length > 0) {
          if (y > doc.page.height - 150) { doc.addPage(); y = doc.page.margins.top; }
          const ingItems = data.ingresosPorEpp.map(e => ({ label: e.nombre, value: e.total || 0 }));
          y = this.drawBarChart(doc, y, 'Ingresos por EPP', ingItems, COLORS.success);
        }

        // Entregas por EPP
        if (data.entregasPorEpp && data.entregasPorEpp.length > 0) {
          if (y > doc.page.height - 150) { doc.addPage(); y = doc.page.margins.top; }
          const entItems = data.entregasPorEpp.map(e => ({ label: e.nombre, value: e.total || 0 }));
          y = this.drawBarChart(doc, y, 'Entregas por EPP', entItems, COLORS.warning);
        }

        this.drawFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ============================================================
  // PDF: Sistemático
  // ============================================================
  static async generarSistematico(periodo) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'letter', margin: 40, bufferPages: true });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        let y = this.drawHeader(doc, 'Control Sistemático de Stock', periodo);

        const vista = await InventarioService.vistaSistematica(periodo);

        const headers = ['EPP', 'Talla', 'Inicial', 'Ingresos', 'Entregas', 'Lavados', 'Sistém.', 'Físico', 'Difer.', 'Estado'];
        const widths = [70, 40, 45, 45, 45, 45, 45, 45, 45, 55];
        const rows = vista.map(v => [
          v.epp_nombre, v.talla_nombre,
          v.stock_inicial, v.ingresos, v.entregas, v.lavados,
          v.sistematico,
          v.cantidad_fisica !== null ? v.cantidad_fisica : '-',
          v.diferencia !== null ? v.diferencia : '-',
          v.estado
        ]);

        y = this.drawTable(doc, y, headers, rows, { colWidths: widths, align: ['left', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'center'] });

        // Resumen
        y += 15;
        if (y > doc.page.height - 80) { doc.addPage(); y = doc.page.margins.top; }
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.dark);
        const conformes = vista.filter(v => v.estado === 'CONFORME').length;
        const faltantes = vista.filter(v => v.estado === 'FALTANTE').length;
        const sobrantes = vista.filter(v => v.estado === 'SOBRANTE').length;
        doc.text(`Resumen: ${conformes} conformes | ${faltantes} faltantes | ${sobrantes} sobrantes`, doc.page.margins.left, y);

        this.drawFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ============================================================
  // PDF: Consultas
  // ============================================================
  static async generarConsultas(filtros) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'letter', margin: 40, bufferPages: true });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        let y = this.drawHeader(doc, 'Reporte de Consultas', filtros.fecha_desde ? `${filtros.fecha_desde} - ${filtros.fecha_hasta}` : '');

        const resultados = await ConsultaService.buscar(filtros);

        const headers = ['Fecha', 'Tipo', 'EPP', 'Talla', 'Trabajador', 'Cant.', 'Detalle'];
        const widths = [100, 70, 60, 40, 70, 35, 185];
        const rows = resultados.map(r => [
          this.formatDateShort(r.fecha),
          r.tipo,
          r.epp_nombre || '-',
          r.talla_nombre || '-',
          r.trabajador_nombre || '-',
          r.cantidad,
          (r.detalle || '-').substring(0, 40)
        ]);

        y = this.drawTable(doc, y, headers, rows, { colWidths: widths });

        // Resumen
        y += 10;
        if (y > doc.page.height - 50) { doc.addPage(); y = doc.page.margins.top; }
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark);
        doc.text(`Total de registros: ${resultados.length}`, doc.page.margins.left, y);

        this.drawFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  static formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

module.exports = ReporteService;
