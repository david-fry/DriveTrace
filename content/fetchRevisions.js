/** Fetch revision tiles and changelog for an accessible Google Doc or Slides presentation.
 * @param {string} docId Google Drive file ID.
 * @param {string|null} userId Optional numeric Google user ID.
 * @param {string|null} authToken Optional page auth token.
 * @param {"document"|"presentation"} documentType Google editor type.
 * @returns {Promise<{revisionCount:number, operations:Object[], truncated:boolean}>} Revision data.
 */
export async function fetchRevisions(docId, userId, authToken, documentType = "document", signal) {
  const kind = documentType === "presentation" ? "presentation" : "document";
  const BASE = "https://docs.google.com/" + kind + "/d/";
  let start = 1;
  let revisionCount = 0;
  let truncated = false;
  while (start <= 3000) {
    const query = new URLSearchParams({
      id: docId,
      start: String(start),
      revisionBatchSize: "1500",
      showDetailedRevisions: "false",
      loadType: "0",
      includes_info_params: "true",
      cros_files: "false"
    });
    if (authToken) query.set("token", authToken);
    if (userId) query.set("ouid", userId);
    const response = await fetch(`${BASE}${encodeURIComponent(docId)}/revisions/tiles?${query}`, {
      credentials: "include", signal
    });
    if (response.status === 403) throw new Error("User does not have edit access to this document.");
    if (!response.ok) throw new Error(`Revision request failed (${response.status}).`);
    const tileText = await response.text();
    const tiles = JSON.parse(tileText.replace(/^\)\]\}'\s*/, ""));
    const data = tiles.tileInfo || tiles[0]?.tileInfo || [];
    const end = Number(data.at(-1)?.end || 0);
    revisionCount = Math.max(revisionCount, end);
    if (!end || end < start + 1499) break;
    if (end >= 3000) {
      truncated = true;
      break;
    }
    start = end + 1;
  }
  if (revisionCount > 3000) {
    revisionCount = 3000;
    truncated = true;
  }
  if (!revisionCount) return { revisionCount: 0, operations: [], truncated };
  const params = new URLSearchParams({
    id: docId,
    start: "1",
    end: String(revisionCount),
    smv: "9",
    srfn: "false",
    ern: "false",
    smb: "[9, ]",
    showDetailedRevisions: "true",
    includes_info_params: "true",
    cros_files: "false"
  });
  if (authToken) params.set("token", authToken);
  if (userId) params.set("ouid", userId);
  const response = await fetch(`${BASE}${encodeURIComponent(docId)}/revisions/load?${params}`, {
    credentials: "include", signal
  });
  if (response.status === 403) throw new Error("User does not have edit access to this document.");
  if (!response.ok) throw new Error(`Revision content request failed (${response.status}).`);
  const text = await response.text();
  const payload = JSON.parse(text.replace(/^\)\]\}'\s*/, ""));
  return { revisionCount, operations: payload.changelog || [], truncated };
}
