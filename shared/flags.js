const DEFINITIONS = {
  bulkPaste: ["Bulk Paste", "A single insert contained at least 500 characters."],
  noRevisions: ["No Revisions", "Fewer than three revision events were detected."],
  singleSession: ["Single Session", "The document appears to have been written in one session."],
  lastMinute: ["Last-Minute Write", "More than 60% of writing happened in the final 20% of the editing window."],
  lateNight: ["Late Night Writing", "Most writing activity happened between 11pm and 5am."],
  wellDistributed: ["Well-Distributed", "Writing occurred across four or more sessions and at least two days."],
  activeReviser: ["Active Reviser", "More than 15% of operations were part of a rewrite."]
};

/** Detect process patterns in an analysis.
 * @param {Object} analysis Parsed document analysis.
 * @returns {Object[]} Flags in relevance order.
 */
export function detectFlags(analysis) {
  const ops = analysis.operations || [];
  const sessions = analysis.sessions || [];
  const revisions = ops.filter(op => op.type === "delete" && op.isRevision).length;
  const characters = op => op.type === "insert" ? op.content.length : 0;
  const written = ops.reduce((sum, op) => sum + characters(op), 0);
  const start = ops[0]?.timestamp || 0;
  const end = ops.at(-1)?.timestamp || 0;
  const recentWindow = start + (end - start) * 0.8;
  const lateVolume = ops.filter(op => op.timestamp >= recentWindow).reduce((sum, op) => sum + characters(op), 0);
  const nightVolume = ops.filter(op => [0, 1, 2, 3, 4, 23].includes(new Date(op.timestamp).getHours()))
    .reduce((sum, op) => sum + characters(op), 0);
  const dayCount = new Set(sessions.map(s => new Date(s.startTime).toDateString())).size;
  const candidates = [
    [ops.some(op => op.isCopyPaste && op.content.length >= 500), "bulkPaste"],
    [revisions < 3, "noRevisions"],
    [sessions.length === 1, "singleSession"],
    [end > start && written > 0 && lateVolume / written > 0.6, "lastMinute"],
    [written > 0 && nightVolume / written > 0.5, "lateNight"],
    [sessions.length >= 4 && dayCount >= 2, "wellDistributed"],
    [ops.length > 0 && revisions / ops.length > 0.15, "activeReviser"]
  ];
  return candidates.filter(([active]) => active).map(([, key]) => ({
    name: DEFINITIONS[key][0],
    explanation: DEFINITIONS[key][1],
    severity: ["bulkPaste", "noRevisions", "singleSession"].includes(key) ? "danger"
      : ["lastMinute", "lateNight"].includes(key) ? "warning" : "success",
    key
  }));
}
