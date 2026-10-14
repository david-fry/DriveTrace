import test from "node:test";
import assert from "node:assert/strict";
import { parseChangelog } from "../content/parseChangelog.js";
import { reconstruct } from "../content/diff.js";
import { analyzeDocument } from "../content/analyzeDoc.js";
import { fetchRevisions } from "../content/fetchRevisions.js";

function presentation() {
  const entries = [];
  let time = 1000;
  const add = (...commands) => entries.push([[40, [4, commands]], time += 1000, "alice"]);
  add([12, "s1", 0, 0], [3, "a", 108, [], [], "s1"], [15, "a", null, 0, "hello"],
    [3, "b", 108, [], [], "s1"], [15, "b", null, 0, "world"]);
  add([16, "a", null, 0, 2], [15, "a", null, 0, "HE"]);
  add([12, "s2", 1, 0], [3, "c", 108, [], [], "s2"], [15, "c", null, 0, "second"],
    [3, "n", 108, [], [], "s1:notes"], [15, "n", null, 0, "notes"]);
  add([14, 1, 0, 0]);
  return { entries, add };
}

test("Slides replay separates text boxes, reorders slides, and includes notes", () => {
  const { entries, add } = presentation();
  let ops = parseChangelog(entries, 150, "presentation");
  assert.equal(reconstruct(ops, ops.length),
    "Slide 1\nsecond\n\n---\n\nSlide 2\nHEllo\n\nworld\n\nSpeaker notes\nnotes");
  assert.equal(ops.find(op => op.type === "delete").deleteLength, 2);
  assert.ok(ops.find(op => op.type === "delete").isRevision);
  assert.ok(ops.every(op => op.authorId === "alice"));
  add([0, ["b"]], [13, 0, 0, null, "s2"]);
  ops = parseChangelog(entries, 150, "presentation");
  assert.equal(reconstruct(ops, ops.length), "Slide 1\nHEllo\n\nSpeaker notes\nnotes");
});

test("analysis counts text and detects pastes without counting structure as deleted text", () => {
  const { entries } = presentation();
  const analysis = analyzeDocument({ documentType: "presentation", operations: entries });
  assert.equal(analysis.totalCharacters, 23);
  assert.equal(analysis.sessions[0].charsDeleted, 2);
  const paste = parseChangelog([[[15, "a", null, 0, "longword ".repeat(25)], 1000, "alice"]], 150, "presentation");
  assert.ok(paste[0].isCopyPaste);
  const unrelated = parseChangelog([[[16, "a", null, 0, 2], 1000, "alice"],
    [[15, "b", null, 0, "hi"], 2000, "alice"]], 150, "presentation");
  assert.equal(unrelated[0].isRevision, false);
});

test("Docs changelog and text replay remain compatible", () => {
  const ops = parseChangelog([[{ ty: "mlti", mts: [
    { ty: "is", ibi: 0, s: "abc" }, { ty: "ds", si: 1, ei: 1 }, { ty: "is", ibi: 1, s: "x" }
  ] }, 1000, "bob"]]);
  assert.equal(reconstruct(ops, ops.length), "axc");
});

test("fetch routes Docs and Slides, carries credentials, handles XSSI, and caps history", async t => {
  const requests = [];
  let large = false;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: new URL(url), options });
    const payload = url.includes("/tiles?")
      ? { tileInfo: [{ end: large ? 5000 : 10 }] } : { changelog: [] };
    return { ok: true, status: 200, text: async () => ")]}'\n" + JSON.stringify(payload) };
  });
  await fetchRevisions("slides-id", "user", "token", "presentation");
  assert.equal(requests[0].url.pathname, "/presentation/d/slides-id/revisions/tiles");
  assert.equal(requests[1].url.pathname, "/presentation/d/slides-id/revisions/load");
  assert.equal(requests[1].url.searchParams.get("end"), "10");
  assert.equal(requests[0].url.searchParams.get("token"), "token");
  assert.equal(requests[0].url.searchParams.get("ouid"), "user");
  assert.equal(requests[0].options.credentials, "include");
  requests.length = 0;
  large = true;
  const result = await fetchRevisions("doc-id", null, null);
  assert.equal(requests[0].url.pathname, "/document/d/doc-id/revisions/tiles");
  assert.equal(requests[1].url.searchParams.get("end"), "3000");
  assert.equal(result.revisionCount, 3000);
  assert.ok(result.truncated);
});

test("history access failures are surfaced", async t => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 403 }));
  await assert.rejects(fetchRevisions("id", null, null, "presentation"), /edit access/);
});
