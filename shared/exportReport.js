import { heatmapHtml, speedSvg, timelineSvg } from "../content/charts.js";

/** Build a standalone printable HTML report for an analysis.
 * @param {Object} analysis Document analysis.
 * @returns {string} Complete HTML report without external dependencies.
 */
export function buildExportReport(analysis) {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const color = analysis.score <= 40 ? "#DC2626" : analysis.score <= 69 ? "#D97706" : "#16A34A";
  const stats = [
    ["Total edits", analysis.operations.length], ["Total characters", analysis.totalCharacters],
    ["Sessions", analysis.sessions.length], ["Revisions", analysis.scoreBreakdown.revisionCount],
    ["Pastes", analysis.copyPasteEvents.length], ["First edited", analysis.firstEdited ? new Date(analysis.firstEdited).toLocaleString() : "—"],
    ["Last edited", analysis.lastEdited ? new Date(analysis.lastEdited).toLocaleString() : "—"]
  ];
  const heat = [...analysis.operations.reduce((days, op) => {
    if (op.type !== "insert") return days;
    const date = new Date(op.timestamp).toISOString().slice(0, 10);
    days.set(date, (days.get(date) || 0) + op.content.length);
    return days;
  }, new Map())];
  const maxChars = Math.max(1, ...heat.map(([, value]) => value));
  const heatSvg = `<svg viewBox="0 0 ${Math.max(140, heat.length * 18)} 24" role="img" aria-label="Activity by day">${heat.map(([date, value], index) =>
    `<rect x="${index * 18}" y="0" width="14" height="14" rx="2" fill="${value / maxChars > .66 ? "#16A34A" : value / maxChars > .33 ? "#86EFAC" : "#DCFCE7"}"><title>${escape(date)}: ${value} characters</title></rect>`
  ).join("")}</svg>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>${escape(analysis.docTitle)} — DriveTrace report</title><style>
  :root{font:14px Arial,sans-serif;color:#202124;background:#fff}body{max-width:900px;margin:32px auto;padding:0 24px}
  header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #e5e7eb;padding-bottom:16px}h1{font-size:22px}
  .score{display:inline-block;border-radius:8px;padding:12px 18px;color:white;font-size:28px;background:${color}}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.grid div{background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px}
  .flags li{margin:8px 0}.chart{overflow-x:auto}svg{max-width:100%;height:auto}section{margin:24px 0}
  @media print{body{margin:0;max-width:none}.no-print{display:none}}
  </style></head><body><header><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 27 14 18l6 5 11-14M25 9h6v6" fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div><h1>DriveTrace Writing Process Report</h1><div>Exported ${new Date().toLocaleString()}</div></div></header>
  <section><h2>${escape(analysis.docTitle)}</h2><p><a href="${escape(analysis.docUrl)}">${escape(analysis.docUrl)}</a></p>
  
  <section><h2>Process flags</h2><ul class="flags">${analysis.flags.map(flag => `<li><strong>${escape(flag.name)}</strong> — ${escape(flag.explanation)}</li>`).join("") || "<li>No flags detected.</li>"}</ul></section>
  <section><h2>Activity summary</h2><div class="grid">${stats.map(([name, value]) => `<div><small>${escape(name)}</small><br><strong>${escape(value)}</strong></div>`).join("")}</div></section>
  <section><h2>Session timeline</h2><div class="chart">${timelineSvg(analysis.sessions)}</div></section>
  <section><h2>Activity heatmap</h2><div class="chart">${heatSvg || heatmapHtml(analysis.operations)}</div></section>
  <section><h2>Writing speed</h2><div class="chart">${speedSvg(analysis.operations)}</div></section>
  <button class="no-print" onclick="window.print()">Print report</button></body></html>`;
}
