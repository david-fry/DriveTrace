export const DOCS_KEY = "drivetrace_docs";
export const SETTINGS_KEY = "drivetrace_settings";

/** Read all saved document analyses.
 * @returns {Promise<Record<string, Object>>} Analyses indexed by document ID.
 */
export async function getDocuments() {
  const result = await chrome.storage.local.get(DOCS_KEY);
  return result[DOCS_KEY] || {};
}

/** Save an analysis and retain at most 50 recent documents.
 * @param {Object} analysis The document analysis to save.
 * @returns {Promise<void>} Resolves when storage is updated.
 */
export async function saveDocument(analysis) {
  const documents = await getDocuments();
  documents[analysis.docId] = analysis;
  const recent = Object.entries(documents)
    .sort((a, b) => (b[1].analyzedAt || 0) - (a[1].analyzedAt || 0))
    .slice(0, 50);
  await chrome.storage.local.set({ [DOCS_KEY]: Object.fromEntries(recent) });
}

/** Read user settings merged with defaults.
 * @returns {Promise<Object>} Current extension settings.
 */
export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    enableStatsBar: true,
    enableFlags: true,
    sessionGapMinutes: 5,
    minimumPasteSize: 150,
    ...(result[SETTINGS_KEY] || {})
  };
}

/** Persist a partial settings update.
 * @param {Object} settings Settings to merge and save.
 * @returns {Promise<void>} Resolves when storage is updated.
 */
export async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...(await getSettings()), ...settings } });
}
