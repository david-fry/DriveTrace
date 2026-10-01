/** Reconstruct a document by applying chronological operations up to a position.
 * @param {Object[]} operations Parsed operations.
 * @param {number} position Number of operations to apply.
 * @returns {string} Reconstructed text.
 */
export function reconstruct(operations, position) {
  let text = "";
  for (const operation of operations.slice(0, position)) {
    const index = Math.max(0, Math.min(text.length, operation.position));
    if (operation.type === "insert") text = text.slice(0, index) + operation.content + text.slice(index);
    else text = text.slice(0, index) + text.slice(index + (operation.deleteLength || operation.content.length));
  }
  return text;
}

/** Find a compact word-level diff between two reconstructed versions.
 * @param {string} before Earlier document text.
 * @param {string} after Later document text.
 * @returns {Array<{type:string,text:string}>} Diff segments.
 */
export function computeDiff(before, after) {
  const a = before.match(/\s+|[^\s]+/g) || [];
  const b = after.match(/\s+|[^\s]+/g) || [];
  if (a.length * b.length > 400000) {
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < a.length - prefix && suffix < b.length - prefix
      && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
    return [
      { type: "equal", text: a.slice(0, prefix).join("") },
      { type: "delete", text: a.slice(prefix, a.length - suffix).join("") },
      { type: "insert", text: b.slice(prefix, b.length - suffix).join("") },
      { type: "equal", text: a.slice(a.length - suffix).join("") }
    ].filter(segment => segment.text);
  }
  const rows = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }
  const result = [];
  const append = (type, text) => {
    if (!text) return;
    if (result.at(-1)?.type === type) result.at(-1).text += text;
    else result.push({ type, text });
  };
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { append("equal", a[i]); i += 1; j += 1; }
    else if (rows[i + 1][j] >= rows[i][j + 1]) { append("delete", a[i]); i += 1; }
    else { append("insert", b[j]); j += 1; }
  }
  while (i < a.length) append("delete", a[i++]);
  while (j < b.length) append("insert", b[j++]);
  return result;
}

/** Render a safe HTML version of diff segments.
 * @param {Array<{type:string,text:string}>} segments Diff segments.
 * @returns {string} HTML fragment.
 */
export function renderDiff(segments) {
  return segments.map(segment => {
    const text = escapeHtml(segment.text);
    return segment.type === "insert" ? `<ins>${text}</ins>`
      : segment.type === "delete" ? `<del>${text}</del>` : text;
  }).join("");
}

/** Escape text before inserting it into HTML.
 * @param {string} value Plain text.
 * @returns {string} Escaped text.
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
