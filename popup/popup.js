import { getDocuments } from "../shared/storage.js";

/** Escape document-provided text for HTML rendering.
 * @param {string} value Text to escape.
 * @returns {string} Safe HTML text.
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

/** Format the time elapsed since analysis.
 * @param {number} timestamp Analysis time in milliseconds.
 * @returns {string} Human-readable elapsed time.
 */
function timeAgo(timestamp) {
  const days = Math.floor(Math.max(0, Date.now() - timestamp) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

const list = document.querySelector("#documents");
const docs = Object.values(await getDocuments()).sort((a, b) => b.analyzedAt - a.analyzedAt);
if (!docs.length) {
  list.innerHTML = `<p class="empty">Open a Google Doc to see its writing-process analysis here.</p>`;
} else {
  list.innerHTML = docs.map(doc => {
    const color = doc.score <= 40 ? "danger" : doc.score <= 69 ? "warning" : "success";
    const flags = (doc.flags || []).slice(0, 2).map(flag =>
      `<span class="flag ${escapeHtml(flag.severity)}">${escapeHtml(flag.name)}</span>`
    ).join("");
    return `<button class="document" data-url="${escapeHtml(doc.docUrl)}">
      <span class="doc-title">${escapeHtml((doc.docTitle || "Untitled document").slice(0, 40))}</span>
      <span class="score ${color}">${Number(doc.score) || 0}</span>
      <span class="meta">${timeAgo(doc.analyzedAt)}</span><span class="flags">${flags}</span></button>`;
  }).join("");
  list.querySelectorAll(".document").forEach(row => row.addEventListener("click", () => {
    if (row.dataset.url) chrome.tabs.create({ url: row.dataset.url });
  }));
}
document.querySelector("#settings").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") });
});
