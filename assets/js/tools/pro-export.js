/* =========================================================
   Oney Pro — PDF + JSON export (Phase 4)
   PDF via jsPDF (dynamic import from CDN — no bundling).
   Same finance-math.js result is the single source of truth.
   ========================================================= */

import { resolveResult } from '../core/result-engine.js';
import { proWorkspaceConfig } from './pro-workspace.config.js';
import { getProFlow } from '../app/pro-bridge.js';
import { storage, SCOPES } from '../app/storage.js';

const JSPDF_CDN = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';

/* ---------- Public ---------- */

export function exportProJSON() {
  const values = currentValues();
  const result = resolveResult(proWorkspaceConfig, values);
  const flow = getProFlow();
  const payload = {
    tool: 'oney-pro',
    generatedAt: new Date().toISOString(),
    values,
    result: stripGated(result),
    flow: flow || null,
  };
  download('oney-pro-case.json', JSON.stringify(payload, null, 2), 'application/json');
}

export async function exportProPDF() {
  const { jsPDF } = await import(JSPDF_CDN);
  const values = currentValues();
  const result = resolveResult(proWorkspaceConfig, values);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawPDF(doc, values, result);
  const safeName = (values.borrowerName || 'oney-pro-case').replace(/[^a-z0-9-_ ]/gi, '').slice(0, 60).trim() || 'oney-pro-case';
  doc.save(`${safeName}.pdf`);
}

/* ---------- Internal ---------- */

function currentValues() {
  return storage.get(SCOPES.PRO, proWorkspaceConfig.id) || proWorkspaceConfig.defaults;
}

function stripGated(result) {
  // Pro export already includes everything — but keep the shape clean.
  const { gated, ...rest } = result;
  return { ...rest, gatedExtras: gated || null };
}

function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PDF layout ---------- */

const COLOURS = {
  text: [20, 24, 32],
  soft: [80, 88, 102],
  muted: [130, 138, 152],
  green: [31, 173, 115],
  amber: [196, 144, 47],
  red: [200, 60, 60],
  rule: [225, 228, 235],
  brand: [46, 204, 133],
};

function toneColour(tone) {
  switch (tone) {
    case 'pass': return COLOURS.green;
    case 'warn': return COLOURS.amber;
    case 'fail': return COLOURS.red;
    default: return COLOURS.soft;
  }
}

function drawPDF(doc, values, result) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  // Header band
  doc.setFillColor(...COLOURS.brand);
  doc.rect(0, 0, W, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLOURS.text);
  doc.text('Oney Pro — Credit Summary', M, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOURS.muted);
  const meta = `Generated ${new Date().toLocaleString('en-AU')}  ·  oneyco.com.au`;
  doc.text(meta, W - M, y + 24, { align: 'right' });
  y += 44;

  doc.setDrawColor(...COLOURS.rule);
  doc.line(M, y, W - M, y);
  y += 16;

  // Hero
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOURS.muted);
  doc.text(result.heroLabel.toUpperCase(), M, y);
  y += 18;
  doc.setFontSize(22);
  doc.setTextColor(...COLOURS.text);
  doc.text(result.heroValue, M, y);
  y += 24;

  // Borrower line
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOURS.soft);
  const borrowerLine = `${values.borrowerName || 'Unnamed borrower'}  ·  ${values.entityType}  ·  ${values.purpose}  ·  ${values.termYears}y ${values.repaymentType.toUpperCase()}`;
  doc.text(borrowerLine, M, y);
  y += 24;

  // Metrics grid
  y = drawSection(doc, 'Key metrics', M, y);
  y = drawMetricsGrid(doc, result.metrics, M, y, W);
  y += 8;

  // Insights
  y = drawSection(doc, 'Assessment', M, y);
  result.insights.forEach((it) => {
    y = ensurePage(doc, y, H, M);
    drawInsight(doc, it, M, y, W);
    y += 28;
  });
  y += 4;

  // Narrative
  if (result.narrative) {
    y = drawSection(doc, 'Credit narrative', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...COLOURS.text);
    const wrapped = doc.splitTextToSize(result.narrative, W - 2 * M);
    wrapped.forEach((line) => {
      y = ensurePage(doc, y, H, M);
      doc.text(line, M, y);
      y += 14;
    });
    y += 12;
  }

  // Risk notes
  const notes = collectNotes(values);
  if (notes.length) {
    y = drawSection(doc, 'Risk notes (3 Cs + mitigants)', M, y);
    notes.forEach(([label, text]) => {
      y = ensurePage(doc, y, H, M);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLOURS.muted);
      doc.text(label.toUpperCase(), M, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOURS.text);
      const wrapped = doc.splitTextToSize(text, W - 2 * M);
      wrapped.forEach((line) => {
        y = ensurePage(doc, y, H, M);
        doc.text(line, M, y);
        y += 14;
      });
      y += 6;
    });
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(...COLOURS.muted);
    doc.text('Generated by Oney Pro · numbers from finance-math.js', M, H - 24);
    doc.text(`${i} / ${total}`, W - M, H - 24, { align: 'right' });
  }
}

function drawSection(doc, title, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOURS.muted);
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(...COLOURS.rule);
  doc.line(x, y + 6, x + 36, y + 6);
  return y + 22;
}

function drawMetricsGrid(doc, metrics, x, y, W) {
  if (!metrics || !metrics.length) return y;
  const cols = 3;
  const colW = (W - 2 * x) / cols;
  const rowH = 38;
  metrics.forEach((m, i) => {
    const cx = x + (i % cols) * colW;
    const cy = y + Math.floor(i / cols) * rowH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOURS.muted);
    doc.text(m.label.toUpperCase(), cx, cy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOURS.text);
    doc.text(String(m.value), cx, cy + 16);
  });
  return y + Math.ceil(metrics.length / cols) * rowH;
}

function drawInsight(doc, insight, x, y, W) {
  const c = toneColour(insight.tone);
  doc.setFillColor(...c);
  doc.rect(x, y - 9, 3, 18, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOURS.text);
  const wrapped = doc.splitTextToSize(insight.text, W - 2 * x - 14);
  doc.text(wrapped, x + 12, y);
}

function ensurePage(doc, y, H, M) {
  if (y > H - 56) {
    doc.addPage();
    return M + 8;
  }
  return y;
}

function collectNotes(values) {
  const out = [];
  if (values.characterNotes) out.push(['Character', values.characterNotes]);
  if (values.capacityNotes) out.push(['Capacity', values.capacityNotes]);
  if (values.collateralNotes) out.push(['Collateral', values.collateralNotes]);
  if (values.mitigants) out.push(['Mitigants', values.mitigants]);
  if (values.exitStrategy) out.push(['Exit strategy', values.exitStrategy]);
  return out;
}
