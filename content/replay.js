import { reconstruct, escapeHtml } from "./diff.js";

/** Replay revisions in a text surface with transport controls.
 * @param {Object} root Replay container.
 * @param {Object} analysis Document analysis.
 * @returns {void} Installs replay controls and listeners.
 */
export function createReplay(root, analysis) {
  const ops = analysis.operations;
  const view = root.querySelector(".dt-replay-text");
  const slider = root.querySelector(".dt-replay-range");
  const status = root.querySelector(".dt-replay-status");
  const speed = root.querySelector(".dt-replay-speed");
  const session = root.querySelector(".dt-replay-session");
  session.innerHTML = `<option value="">All sessions</option>${analysis.sessions.map(item =>
    `<option value="${item.index}">Session ${item.index + 1}</option>`).join("")}`;
  let cursor = 0;
  let playing = false;
  let frame = 0;
  let lastStep = 0;
  const show = () => {
    const operation = ops[cursor - 1];
    const previous = reconstruct(ops, Math.max(0, cursor - 1));
    if (operation && cursor) {
      const index = Math.max(0, Math.min(previous.length, operation.position));
      const deleted = operation.type === "delete"
        ? operation.content || previous.slice(index, index + (operation.deleteLength || 0))
        : "";
      const changed = operation.type === "insert" ? operation.content : deleted;
      const remaining = operation.type === "insert"
        ? previous.slice(index) : previous.slice(index + deleted.length);
      const prefix = previous.slice(0, index);
      view.innerHTML = `${escapeHtml(prefix)}<span class="dt-replay-highlight ${operation.type}">${escapeHtml(changed)}</span>${escapeHtml(remaining)}`;
      window.setTimeout(() => { view.textContent = reconstruct(ops, cursor); }, 500);
    } else {
      view.textContent = reconstruct(ops, cursor);
    }
    const current = ops[Math.max(0, cursor - 1)];
    status.textContent = current ? `${new Date(current.timestamp).toLocaleString()} · ${cursor} / ${ops.length} operations`
      : `0 / ${ops.length} operations`;
    slider.value = String(cursor);
  };
  const tick = now => {
    if (!playing) return;
    if (cursor >= ops.length) { playing = false; return; }
    if (!lastStep || now - lastStep >= Math.max(16, 160 / Number(speed.value))) {
      cursor += 1;
      show();
      lastStep = now;
    }
    frame = window.requestAnimationFrame(tick);
  };
  slider.max = String(ops.length);
  slider.addEventListener("input", () => { cursor = Number(slider.value); show(); });
  root.querySelector(".dt-play").addEventListener("click", () => {
    playing = !playing;
    window.cancelAnimationFrame(frame);
    lastStep = 0;
    if (playing) frame = window.requestAnimationFrame(tick);
  });
  root.querySelector(".dt-pause").addEventListener("click", () => { playing = false; window.cancelAnimationFrame(frame); });
  root.querySelector(".dt-reset").addEventListener("click", () => { playing = false; window.cancelAnimationFrame(frame); cursor = 0; show(); });
  session.addEventListener("change", () => {
    if (session.value !== "") {
      const first = ops.findIndex(op => op.sessionIndex === Number(session.value));
      cursor = first < 0 ? 0 : first;
      show();
    }
  });
  show();
}
