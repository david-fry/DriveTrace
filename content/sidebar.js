import { createReplay } from "./replay.js";
import { computeDiff, reconstruct, renderDiff, escapeHtml } from "./diff.js";
import { heatmapHtml, speedSvg, timelineSvg } from "./charts.js";
import { scoreColor } from "./statsBar.js";
import { buildExportReport } from "../shared/exportReport.js";

/** Build the collapsible analysis sidebar.
 * @param {Object} analysis Document analysis.
 * @returns {{open:Function,element:HTMLElement}} Sidebar controller.
 */
export function createSidebar(analysis) {
  document.querySelector("#drivetrace-sidebar")?.remove();
  const aside = document.createElement("aside");
  aside.id = "drivetrace-sidebar";
  aside.innerHTML = `<button class="dt-pull-tab" aria-label="Open DriveTrace">◀</button>
    <div class="dt-panel"><header><strong>DriveTrace</strong><button class="dt-close" aria-label="Close sidebar">×</button></header>
    <nav class="dt-tabs" role="tablist"><button class="active" data-tab="overview">Overview</button><button data-tab="timeline">Timeline</button><button data-tab="replay">Replay</button></nav>
    <main class="dt-panel-content">
      <section data-panel="overview"><h3>Process flags</h3><div class="dt-flags"></div><h3>Document activity</h3><div class="dt-stat-grid"></div>
      <h3>Contributors</h3><div class="dt-contributors"></div><button class="dt-export">Export Report</button></section>
      <section data-panel="timeline" hidden><h3>Writing sessions</h3><div class="dt-timeline"></div><h3>Activity by day</h3><div class="dt-heatmap-wrap"></div><h3>Writing speed</h3><div class="dt-speed"></div></section>
      <section data-panel="replay" hidden><div class="dt-transport"><button class="dt-play">▶ Play</button><button class="dt-pause">⏸ Pause</button><button class="dt-reset">⏮ Reset</button>
      <select class="dt-replay-speed" aria-label="Playback speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option><option value="50">50×</option></select></div>
      <label>Jump to session <select class="dt-replay-session"></select></label><input class="dt-replay-range" type="range" min="0" value="0" aria-label="Replay position">
      <p class="dt-replay-status"></p><pre class="dt-replay-text"></pre>
      <button class="dt-toggle-diff">Compare versions</button><div class="dt-diff" hidden><label>From <input class="dt-diff-from" type="range" min="0" value="0"></label><label>To <input class="dt-diff-to" type="range" min="0" value="0"></label><p class="dt-diff-summary"></p><div class="dt-diff-output"></div></div></section>
    </main></div>`;
  document.body.append(aside);
  const setOpen = open => aside.classList.toggle("open", open);
  aside.querySelector(".dt-pull-tab").addEventListener("click", () => setOpen(true));
  aside.querySelector(".dt-close").addEventListener("click", () => setOpen(false));
  aside.querySelectorAll(".dt-tabs button").forEach(button => button.addEventListener("click", () => {
    aside.querySelectorAll(".dt-tabs button").forEach(tab => tab.classList.toggle("active", tab === button));
    aside.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== button.dataset.tab; });
  }));
  aside.querySelector(".dt-flags").innerHTML = analysis.flags.map(flag =>
    `<span class="dt-flag ${flag.severity}" title="${escapeHtml(flag.explanation)}">${escapeHtml(flag.name)}</span>`
  ).join("") || "<p>No process flags detected.</p>";
  const totalWriting = analysis.sessions.reduce((sum, item) => sum + item.durationMs, 0);
  const stats = [
    ["Total edits", analysis.operations.length], ["Total characters", analysis.totalCharacters],
    ["Avg session length", formatDuration(analysis.sessions.length ? totalWriting / analysis.sessions.length : 0)],
    ["Longest session", formatDuration(Math.max(0, ...analysis.sessions.map(item => item.durationMs)))],
    ["Total writing time", formatDuration(totalWriting)], ["First edited", dateText(analysis.firstEdited)],
    ["Last edited", dateText(analysis.lastEdited)]
  ];
  aside.querySelector(".dt-stat-grid").innerHTML = stats.map(([name, value]) =>
    `<div><small>${name}</small><b>${escapeHtml(value)}</b></div>`
  ).join("");
  const contributors = new Map();
  for (const op of analysis.operations) if (op.authorId && op.type === "insert") {
    contributors.set(op.authorId, (contributors.get(op.authorId) || 0) + op.content.length);
  }
  const top = [...contributors].sort((a, b) => b[1] - a[1]).slice(0, 3);
  aside.querySelector(".dt-contributors").innerHTML = top.length
    ? top.map(([name, chars]) => `<p>${escapeHtml(name)} · ${Math.round(chars / Math.max(1, analysis.totalCharacters) * 100)}%</p>`).join("")
    : "<p>No contributor details available.</p>";
  aside.querySelector(".dt-timeline").innerHTML = timelineSvg(analysis.sessions);
  aside.querySelector(".dt-heatmap-wrap").innerHTML = heatmapHtml(analysis.operations);
  aside.querySelector(".dt-speed").innerHTML = speedSvg(analysis.operations);
  createReplay(aside, analysis);
  const from = aside.querySelector(".dt-diff-from");
  const to = aside.querySelector(".dt-diff-to");
  from.max = to.max = String(analysis.operations.length);
  to.value = String(analysis.operations.length);
  const updateDiff = () => {
    const before = reconstruct(analysis.operations, Number(from.value));
    const after = reconstruct(analysis.operations, Number(to.value));
    const segments = computeDiff(before, after);
    aside.querySelector(".dt-diff-output").innerHTML = renderDiff(segments);
    const words = text => (text.match(/\b[\p{L}\p{N}_'-]+\b/gu) || []).length;
    const additions = segments.filter(item => item.type === "insert").map(item => item.text).join("");
    const deletions = segments.filter(item => item.type === "delete").map(item => item.text).join("");
    aside.querySelector(".dt-diff-summary").textContent = `+${words(additions)} words added, −${words(deletions)} words removed`;
  };
  from.addEventListener("input", updateDiff);
  to.addEventListener("input", updateDiff);
  aside.querySelector(".dt-toggle-diff").addEventListener("click", () => {
    const diff = aside.querySelector(".dt-diff");
    diff.hidden = !diff.hidden;
    if (!diff.hidden) updateDiff();
  });
  aside.querySelector(".dt-export").addEventListener("click", () => {
    const blob = new Blob([buildExportReport(analysis)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(analysis.docTitle || "DriveTrace-report").replace(/[^\w-]+/g, "-")}-report.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
  return { open: () => setOpen(true), element: aside };
}

function formatDuration(milliseconds) {
  const minutes = Math.round(milliseconds / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function dateText(timestamp) { return timestamp ? new Date(timestamp).toLocaleString() : "—"; }
