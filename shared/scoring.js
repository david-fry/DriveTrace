/** Compute a bounded writing-process score and its component breakdown.
 * @param {Object} analysis Parsed document analysis.
 * @returns {{score:number,breakdown:Object}} Score details.
 */
export function calculateScore(analysis) {
  const sessions = analysis.sessions || [];
  const days = new Set(sessions.map(session => new Date(session.startTime).toDateString())).size;
  const sessionScore = sessions.length >= 4 && days >= 2 ? 30
    : sessions.length >= 3 ? 20 : sessions.length === 2 ? 10 : 0;
  const operations = analysis.operations || [];
  const revisionCount = operations.filter(op => op.type === "delete" && op.isRevision).length;
  const ratio = operations.length ? revisionCount / operations.length : 0;
  const revisionScore = ratio > 0.2 ? 25 : ratio >= 0.1 ? 18 : ratio >= 0.05 ? 10 : 0;
  const pastes = (analysis.copyPasteEvents || []).length;
  const pastePenalty = pastes >= 3 ? 20 : pastes === 2 ? 12 : pastes === 1 ? 5 : 0;
  const volumes = sessions.map(session => session.charsInserted).filter(value => value > 0);
  let gini = 0;
  if (volumes.length) {
    const sorted = [...volumes].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    gini = total ? (2 * sorted.reduce((sum, value, index) => sum + (index + 1) * value, 0))
      / (sorted.length * total) - (sorted.length + 1) / sorted.length : 0;
  }
  const timeScore = gini < 0.3 ? 25 : gini <= 0.6 ? 15 : 5;
  const score = Math.max(0, Math.min(100, sessionScore + revisionScore - pastePenalty + timeScore));
  return {
    score,
    breakdown: { sessionScore, revisionScore, pastePenalty, timeScore, gini, revisionCount, totalOperations: operations.length }
  };
}
