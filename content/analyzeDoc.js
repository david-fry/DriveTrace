import { parseChangelog } from "./parseChangelog.js";
import { calculateScore } from "../shared/scoring.js";
import { detectFlags } from "../shared/flags.js";

/** Parse operations, group writing sessions, and compute document metrics.
 * @param {Object} input Revision response and document metadata.
 * @param {Object} settings User settings.
 * @returns {Object} Complete document analysis.
 */
export function analyzeDocument(input, settings = {}) {
  const operations = parseChangelog(input.operations, settings.minimumPasteSize ?? 150);
  const sessionGap = (settings.sessionGapMinutes ?? 5) * 60000;
  const sessions = [];
  for (const operation of operations) {
    let session = sessions.at(-1);
    if (!session || operation.timestamp - session.endTime > sessionGap) {
      session = {
        index: sessions.length, startTime: operation.timestamp, endTime: operation.timestamp,
        durationMs: 0, charsInserted: 0, charsDeleted: 0, operationCount: 0, peakCharsPerMin: 0
      };
      sessions.push(session);
    }
    operation.sessionIndex = session.index;
    session.endTime = operation.timestamp;
    session.durationMs = session.endTime - session.startTime;
    session.operationCount += 1;
    if (operation.type === "insert") session.charsInserted += operation.content.length;
    else session.charsDeleted += operation.deleteLength || operation.content.length;
  }
  for (const session of sessions) {
    session.peakCharsPerMin = session.durationMs
      ? Math.round(session.charsInserted / (session.durationMs / 60000))
      : session.charsInserted;
  }
  const copyPasteEvents = operations.filter(op => op.isCopyPaste).map(op => ({
    timestamp: op.timestamp, characters: op.content.length, words: op.content.trim().split(/\s+/).filter(Boolean).length,
    sessionIndex: op.sessionIndex
  }));
  const analysis = {
    docId: input.docId,
    docTitle: input.docTitle || "Untitled document",
    docUrl: input.docUrl || "",
    analyzedAt: Date.now(),
    totalRevisionCount: input.revisionCount || 0,
    operations,
    sessions,
    copyPasteEvents,
    totalCharacters: sessions.reduce((sum, item) => sum + item.charsInserted, 0),
    firstEdited: operations[0]?.timestamp || 0,
    lastEdited: operations.at(-1)?.timestamp || 0,
    truncated: Boolean(input.truncated),
    contributors: []
  };
  const scoring = calculateScore(analysis);
  analysis.score = scoring.score;
  analysis.scoreBreakdown = scoring.breakdown;
  analysis.flags = detectFlags(analysis);
  return analysis;
}
