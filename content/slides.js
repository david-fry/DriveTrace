/**
 * Slides changelogs use numeric commands inside [command, timestamp, author] entries.
 * Text offsets are local to an element; delete end offsets are exclusive.
 */
export function collectSlidesOperations(entries, output) {
  const visit = (command, timestamp, authorId) => {
    if (!Array.isArray(command)) return;
    const code = command[0];
    if (code === 40) { visit(command[1], timestamp, authorId); return; }
    if (code === 4) {
      for (const child of command[1] || []) visit(child, timestamp, authorId);
      return;
    }
    const common = { ts: timestamp, uid: authorId, documentType: "presentation" };
    if (code === 15 && typeof command[1] === "string" && typeof command[4] === "string") {
      output.push({ ...common, ty: "insert", elementId: command[1], si: command[3], s: command[4] });
    } else if (code === 16 && typeof command[1] === "string"
      && Number.isFinite(command[3]) && Number.isFinite(command[4]) && command[4] > command[3]) {
      output.push({ ...common, ty: "delete", elementId: command[1], si: command[3], ei: command[4] - 1 });
    } else if ([0, 3, 12, 13, 14].includes(code)) {
      output.push({ ...common, ty: "structure", si: 0, command });
    }
  };
  for (const entry of entries || []) {
    if (!Array.isArray(entry) || !Number.isFinite(Number(entry[1]))) continue;
    visit(entry[0], Number(entry[1]), String(entry[2] || ""));
  }
}

export function createSlidesState() {
  return { slides: [], elements: new Map() };
}

/** Apply only commands needed for text replay; formatting and geometry are omitted. */
export function applySlidesOperation(state, operation) {
  if (operation.type === "structure") {
    const command = operation.command;
    if (command[0] === 12) {
      const [, id, index, kind] = command;
      if (!state.slides.some(slide => slide.id === id)) {
        state.slides.splice(Math.max(0, index), 0, { id, kind });
      }
    } else if (command[0] === 3) {
      state.elements.set(command[1], { parent: command[5], text: "" });
    } else if (command[0] === 0) {
      for (const id of command[1] || []) state.elements.delete(id);
    } else if (command[0] === 13) {
      const id = command[4];
      state.slides = state.slides.filter(slide => slide.id !== id);
      for (const [key, element] of state.elements) {
        if (element.parent === id || element.parent === id + ":notes") state.elements.delete(key);
      }
    } else if (command[0] === 14) {
      // Template slides do not participate in the visible slide order.
      const slides = state.slides.filter(slide => slide.kind === 0);
      const moved = slides[command[1]];
      if (moved) {
        state.slides.splice(state.slides.indexOf(moved), 1);
        const remaining = state.slides.filter(slide => slide.kind === 0);
        const target = remaining[command[2]];
        state.slides.splice(target ? state.slides.indexOf(target) : state.slides.length, 0, moved);
      }
    }
    return;
  }
  const element = state.elements.get(operation.elementId);
  if (!element) return;
  const index = Math.max(0, Math.min(element.text.length, operation.position));
  if (operation.type === "insert") {
    element.text = element.text.slice(0, index) + operation.content + element.text.slice(index);
  } else if (operation.type === "delete") {
    element.text = element.text.slice(0, index)
      + element.text.slice(index + (operation.deleteLength || operation.content.length));
  }
}

export function renderSlidesState(state) {
  return state.slides.filter(slide => slide.kind === 0).map((slide, index) => {
    const body = [...state.elements.values()].filter(element => element.parent === slide.id)
      .map(element => element.text).filter(Boolean).join("\n\n");
    const notes = [...state.elements.values()].filter(element => element.parent === slide.id + ":notes")
      .map(element => element.text).filter(Boolean).join("\n\n");
    return "Slide " + (index + 1) + "\n" + body + (notes ? "\n\nSpeaker notes\n" + notes : "");
  }).join("\n\n---\n\n");
}
