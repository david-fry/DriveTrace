const SVG_NS = "http://www.w3.org/2000/svg";

/** Build an SVG timeline of writing sessions.
 * @param {Object[]} sessions Writing sessions.
 * @param {number} width SVG width.
 * @returns {string} Inline SVG chart.
 */
export function timelineSvg(sessions, width = 700) {
  const times = sessions.flatMap(session => [session.startTime, session.endTime]);
  const min = Math.min(...times, Date.now());
  const max = Math.max(...times, min + 1);
  const span = Math.max(1, max - min);
  const chartWidth = width - 64;
  const chartHeight = Math.max(38, sessions.length * 25 + 36);
  const axisY = chartHeight - 18;
  const rows = sessions.map((session, index) => {
    const x = 48 + ((session.startTime - min) / span) * chartWidth;
    const w = Math.max(3, ((Math.max(session.endTime, session.startTime + 1) - session.startTime) / span) * chartWidth);
    return `<text x="2" y="${20 + index * 25}" font-size="11">S${index + 1}</text><rect x="${x.toFixed(1)}" y="${8 + index * 25}" width="${w.toFixed(1)}" height="16" rx="4" fill="#2563EB"><title>${new Date(session.startTime).toLocaleString()} · ${session.charsInserted} characters</title></rect>`;
  }).join("");
  const ticks = [min, min + span / 2, max].map((time, index) => {
    const x = 48 + ((time - min) / span) * chartWidth;
    const anchor = index === 0 ? "start" : index === 2 ? "end" : "middle";
    return `<line x1="${x.toFixed(1)}" y1="${axisY - 6}" x2="${x.toFixed(1)}" y2="${axisY}" stroke="#94A3B8" stroke-width="1"/><text x="${x.toFixed(1)}" y="${axisY + 12}" text-anchor="${anchor}" font-size="10" fill="#475569">${escapeSvg(formatTimelineLabel(time))}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${chartHeight}" role="img" aria-label="Writing session timeline">${rows || "<text x='4' y='20'>No session data</text>"}<line x1="48" y1="${axisY}" x2="${width - 16}" y2="${axisY}" stroke="#CBD5E1" stroke-width="1"/>${ticks}</svg>`;
}

/** Build a day-by-day activity heatmap.
 * @param {Object[]} operations Traced operations.
 * @returns {string} HTML grid with accessible day tooltips.
 */
export function heatmapHtml(operations) {
  const days = new Map();
  for (const op of operations) {
    if (op.type !== "insert") continue;
    const date = new Date(op.timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const item = days.get(key) || { chars: 0, first: op.timestamp, last: op.timestamp };
    item.chars += op.content.length;
    item.first = Math.min(item.first, op.timestamp);
    item.last = Math.max(item.last, op.timestamp);
    days.set(key, item);
  }
  const maximum = Math.max(1, ...[...days.values()].map(day => day.chars));
  const cells = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => {
    const intensity = day.chars / maximum;
    const level = intensity > 0.75 ? 4 : intensity > 0.5 ? 3 : intensity > 0.25 ? 2 : 1;
    return `<div class="dt-heat-cell level-${level}" title="${date}: ${day.chars} characters, ${new Date(day.first).toLocaleTimeString()}–${new Date(day.last).toLocaleTimeString()}" aria-label="${date}: ${day.chars} characters"></div>`;
  }).join("");
  return `<div class="dt-heatmap">${cells || "<span>No activity data</span>"}</div>`;
}

/** Build a five-minute rolling writing-speed graph.
 * @param {Object[]} operations Traced operations.
 * @param {number} width SVG width.
 * @param {number} height SVG height.
 * @returns {string} Inline SVG line chart.
 */
export function speedSvg(operations, width = 700, height = 150) {
  const inserts = operations.filter(op => op.type === "insert");
  if (!inserts.length) return `<svg viewBox="0 0 ${width} ${height}"><text x="8" y="24">No writing activity</text></svg>`;
  const points = [];
  let windowStart = 0;
  let chars = 0;
  for (let index = 0; index < inserts.length; index += 1) {
    const operation = inserts[index];
    chars += operation.content.length;
    while (operation.timestamp - inserts[windowStart].timestamp >= 300000) {
      chars -= inserts[windowStart].content.length;
      windowStart += 1;
    }
    points.push({ time: operation.timestamp, speed: chars / 5 });
  }
  const start = points[0].time;
  const span = Math.max(1, points.at(-1).time - start);
  const max = Math.max(1, ...points.map(point => point.speed));
  const coords = points.map((point, index) =>
    `${index ? "L" : "M"} ${(12 + ((point.time - start) / span) * (width - 24)).toFixed(1)} ${(height - 14 - (point.speed / max) * (height - 32)).toFixed(1)}`
  ).join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Writing speed in characters per minute"><path d="${coords}" fill="none" stroke="#2563EB" stroke-width="2"/><text x="4" y="12" font-size="10">${Math.round(max)} chars/min</text></svg>`;
}

/** Create a detached SVG text node with the standard namespace.
 * @param {string} name SVG element name.
 * @returns {SVGElement} SVG element.
 */
export function createSvgElement(name) {
  return document.createElementNS(SVG_NS, name);
}

function formatTimelineLabel(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeSvg(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
