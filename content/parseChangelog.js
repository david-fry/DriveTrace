/** @typedef {{type:"insert"|"delete",opType:"insert"|"delete",content:string,textContent:string,position:number,startIdx:number,endIdx:number,timestamp:number,unixTimestamp:number,sessionIndex:number,authorId:string,userId:string,tab:string,isCopyPaste:boolean,isRevision:boolean}} TracedOp */

/** Convert endpoint changes into ordered, annotated operations.
 * @param {Object[]} rawOperations Raw changelog entries.
 * @param {number} minimumPasteSize Character threshold for paste detection.
 * @returns {TracedOp[]} Normalized operations in timestamp order.
 */
export function parseChangelog(rawOperations, minimumPasteSize = 150) {
  const flattened = [];
  collectOperations(rawOperations, flattened);
  const operations = [];
  for (const raw of flattened) {
    const ty = String(raw.ty || raw.type || raw.changeType || raw.opType || "").toLowerCase();
    const type = ty === "is" || ty === "insert" || ty === "insertion" || ty === "inserttext"
      ? "insert"
      : ty === "ds" || ty === "delete" || ty === "deletion" || ty === "deletetext"
        ? "delete"
        : null;
    if (!type) continue;
    const content = type === "insert"
      ? String(raw.s || raw.text || raw.textContent || raw.content || raw.value || "")
      : String(raw.s || raw.deletedText || raw.text || raw.textContent || raw.content || raw.value || "");
    const start = Number(raw.ibi ?? raw.si ?? raw.startIdx ?? raw.startIndex ?? raw.position ?? 0);
    const end = Number(raw.ei ?? raw.endIdx ?? raw.endIndex ?? (Number.isFinite(start) ? start + Math.max(0, content.length - 1) : NaN));
    const timestamp = Number(raw.ts ?? raw.timestamp ?? raw.unixTimestamp ?? raw.time);
    if (!Number.isFinite(start) || !Number.isFinite(timestamp)) continue;
    const authorId = String(raw.uid ?? raw.euid ?? raw.userId ?? raw.authorId ?? "");
    const text = content.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    const common = {
      opType: type,
      type,
      content,
      textContent: content,
      position: Math.max(0, start),
      startIdx: Math.max(0, start),
      endIdx: Number.isFinite(end) ? end : Math.max(0, start + Math.max(0, content.length - 1)),
      timestamp,
      unixTimestamp: timestamp,
      sessionIndex: 0,
      authorId,
      userId: authorId,
      tab: String(raw.tab ?? raw.sheet ?? "t.0"),
      isCopyPaste: type === "insert" && authorId !== "COPY" && content.length >= minimumPasteSize && words >= 20,
      isRevision: false
    };
    if (type === "delete" && !content && Number.isFinite(end) && end >= start) {
      operations.push({
        ...common,
        content: "",
        textContent: "",
        deleteLength: end - start + 1,
        isCopyPaste: false
      });
      continue;
    }
    operations.push(common);
  }
  operations.sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < operations.length; i += 1) {
    const op = operations[i];
    if (op.type !== "delete") continue;
    const rewritten = operations.slice(i + 1).find(next => next.type === "insert"
      && next.position === op.position && next.timestamp - op.timestamp <= 300000);
    if (rewritten) {
      op.isRevision = true;
      rewritten.isRevision = true;
    }
  }
  return operations;
}

function collectOperations(value, output, context = {}) {
  if (!value) return;
  if (Array.isArray(value)) {
    // Google changelog entries are [operation, timestamp, authorId, ...].
    if (value[0] && typeof value[0] === "object" && !Array.isArray(value[0])
      && value[1] != null && ["number", "string"].includes(typeof value[1])
      && Number.isFinite(Number(value[1]))) {
      collectOperations(value[0], output, {
        ...context,
        timestamp: Number(value[1]),
        authorId: typeof value[2] === "string" ? value[2] : context.authorId
      });
    } else {
      for (const item of value) collectOperations(item, output, context);
    }
    return;
  }
  if (typeof value !== "object") return;
  const metadata = {
    timestamp: value.ts ?? value.timestamp ?? value.unixTimestamp ?? value.time ?? context.timestamp,
    authorId: context.authorId === "COPY" ? "COPY"
      : value.uid ?? value.euid ?? value.userId ?? value.authorId ?? context.authorId,
    tab: value.tab ?? value.sheet ?? context.tab ?? "t.0"
  };
  const type = String(value.ty || value.type || value.changeType || value.opType || "").toLowerCase();
  if (type === "mlti") {
    collectOperations(value.mts, output, metadata);
  } else if (type === "nm") {
    collectOperations(value.nmc, output, { ...metadata, tab: value.nmr?.[1] ?? metadata.tab });
  } else if (type === "rplc") {
    collectOperations(value.snapshot, output, { ...metadata, authorId: "COPY" });
  } else if (type || "ibi" in value || "si" in value) {
    output.push({ ...value, ts: metadata.timestamp, uid: metadata.authorId, tab: metadata.tab });
  } else {
    for (const key of ["changelog", "rawChangeLog", "rawChangelog", "operations", "ops", "changes"]) {
      if (key in value) collectOperations(value[key], output, metadata);
    }
  }
}
