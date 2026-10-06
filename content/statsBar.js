/** Render the compact process summary above the Docs canvas.
 * @param {Object} analysis Current document analysis.
 * @param {boolean} enabled Whether the bar is enabled in settings.
 * @param {Function} openSidebar Opens the sidebar.
 * @returns {HTMLElement|null} Injected stats bar.
 */
export function injectStatsBar(analysis, enabled, openSidebar) {
  document.querySelector("#drivetrace-stats-bar")?.remove();
  if (!enabled) return null;
  const bar = document.createElement("div");
  bar.id = "drivetrace-stats-bar";
  const insufficient = (analysis.sessions?.length || 0) === 0;
  const totalWritingTime = analysis.sessions.reduce((sum, session) => sum + session.durationMs, 0);
  const flags = analysis.flags.slice(0, 3).map(flag =>
    `<span class="dt-flag ${flag.severity}" title="${escapeAttribute(flag.explanation)}">${escapeText(flag.name)}</span>`
  ).join("");
  bar.innerHTML = insufficient
    ? `<span class="dt-not-enough">Not enough data</span>`
    : `<span>Total writing time: <b>${formatDuration(totalWritingTime)}</b></span>
      <span>Sessions: <b>${analysis.sessions.length}</b></span>
      <span>Revisions: <b>${analysis.scoreBreakdown.revisionCount}</b></span>
      <span>Pastes: <b>${analysis.copyPasteEvents.length}</b></span>${flags}
      <button type="button" class="dt-view-process">▶ View Process</button>`;
  bar.querySelector(".dt-view-process")?.addEventListener("click", openSidebar);
  const canvas = document.querySelector(".kix-appview-editor, .docs-editor-container, .kix-appview-editor-container");
  (canvas?.parentElement || document.body).insertBefore(bar, canvas || null);
  return bar;
}

/** Select the score badge color class.
 * @param {number} score Writing-process score.
 * @returns {string} CSS color category.
 */
export function scoreColor(score) {
  return score <= 40 ? "danger" : score <= 69 ? "warning" : "success";
}

function formatDuration(milliseconds) {
  const minutes = Math.round(milliseconds / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function escapeText(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
function escapeAttribute(value) { return escapeText(value).replace(/'/g, "&#39;"); }
