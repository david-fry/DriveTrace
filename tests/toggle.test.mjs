import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { getSettings } from "../shared/storage.js";

const contentSource = await readFile(new URL("../content/content.js", import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

function page(initialEnabled, deferred = false) {
  let settings = { enabled: initialEnabled, enableStatsBar: true, enableFlags: true };
  let listener;
  let requests = 0;
  const pending = [];
  const nodes = new Map();
  const intervals = new Map();
  const saved = [];
  const errors = [];
  const storage = {
    SETTINGS_KEY: "drivetrace_settings",
    getSettings: async () => settings,
    saveDocument: async analysis => saved.push(analysis)
  };
  const element = () => ({ classList: { contains: () => false }, dataset: {},
    querySelector: () => null, querySelectorAll: () => [], remove() {
      for (const [key, value] of nodes) if (value === this) nodes.delete(key);
    } });
  const document = {
    body: { hasAttribute: () => false, setAttribute() {}, append(node) { nodes.set("#" + node.id, node); } },
    documentElement: { innerHTML: "", append() {} }, title: "Test - Google Slides",
    createElement: element, querySelector: selector => nodes.get(selector) || null,
    querySelectorAll: () => [...nodes.values()]
  };
  const modules = [
    { fetchRevisions: async (...args) => {
      requests++;
      if (deferred) await new Promise(resolve => pending.push(resolve));
      return { operations: [], revisionCount: 0 };
    } },
    { analyzeDocument: () => ({ sessions: [], flags: [] }) },
    { injectStatsBar: () => nodes.set("#drivetrace-stats-bar", element()) },
    { createSidebar: () => {
      const sidebar = element();
      nodes.set("#drivetrace-sidebar", sidebar);
      return { element: sidebar, open() {} };
    } },
    storage
  ];
  let importIndex = 0;
  vm.runInNewContext(contentSource.replace(/\bimport\(/g, "__load("), {
    __load: async () => modules[importIndex++], AbortController, document,
    window: { location: { pathname: "/presentation/d/test", href: "https://docs.google.com/presentation/d/test/edit" },
      addEventListener() {}, setInterval(callback) { intervals.set(1, callback); return 1; },
      clearInterval(id) { intervals.delete(id); } },
    chrome: { runtime: { getURL: path => path }, storage: { onChanged: {
      addListener: callback => { listener = callback; }, removeListener() {}
    } } },
    console: { error: (...args) => errors.push(args) }
  });
  return { nodes, saved, intervals, errors, pending, get requests() { return requests; },
    change(enabled) {
      settings = { ...settings, enabled };
      listener({ drivetrace_settings: { newValue: settings } }, "local");
    } };
}

test("enabled setting defaults to true for existing users", async () => {
  const previous = globalThis.chrome;
  globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
  try { assert.equal((await getSettings()).enabled, true); }
  finally { globalThis.chrome = previous; }
});

test("disabled startup skips analysis; enabling starts it; disabling removes UI and polling", async () => {
  const app = page(false);
  await flush();
  assert.equal(app.requests, 0);
  assert.equal(app.intervals.size, 0);
  app.change(true);
  await flush();
  assert.equal(app.requests, 1);
  assert.ok(app.nodes.has("#drivetrace-sidebar"));
  assert.equal(app.intervals.size, 1);
  app.change(false);
  await flush();
  assert.equal(app.nodes.size, 0);
  assert.equal(app.intervals.size, 0);
  assert.deepEqual(app.errors, []);
});

test("a response arriving after disabling cannot restore UI or save its analysis", async () => {
  const app = page(true, true);
  await flush();
  assert.equal(app.requests, 1);
  app.change(false);
  app.pending.shift()();
  await flush();
  assert.equal(app.nodes.size, 0);
  assert.equal(app.saved.length, 0);
  assert.equal(app.intervals.size, 0);
});

test("reenabling during a previous request starts fresh analysis", async () => {
  const app = page(true, true);
  await flush();
  app.change(false);
  app.change(true);
  app.pending.shift()();
  await flush();
  assert.equal(app.requests, 2);
  app.pending.shift()();
  await flush();
  assert.ok(app.nodes.has("#drivetrace-sidebar"));
  assert.equal(app.saved.length, 1);
});

test("popup switch saves the selected state and reflects storage changes", async () => {
  const source = await readFile(new URL("../popup/popup.js", import.meta.url), "utf8");
  let change;
  let click;
  const attributes = {};
  const toggle = { disabled: true, setAttribute: (key, value) => { attributes[key] = value; },
    addEventListener: (event, callback) => { click = callback; } };
  const status = {};
  const list = { querySelectorAll: () => [] };
  let saved;
  const context = {
    getSettings: async () => ({ enabled: true }),
    getDocuments: async () => ({}),
    SETTINGS_KEY: "drivetrace_settings",
    saveSettings: async value => {
      saved = value;
      change({ drivetrace_settings: { newValue: value } }, "local");
    },
    document: { querySelector: selector => ({
      "#enable-toggle": toggle, "#toggle-status": status, "#documents": list,
      "#settings": { addEventListener() {} }
    })[selector] },
    chrome: { storage: { onChanged: { addListener: callback => { change = callback; } } } },
    console
  };
  await vm.runInNewContext("(async () => {" + source.replace(/^import .*;\r?$/gm, "") + "})()", context);
  assert.equal(toggle.textContent, "Enabled");
  await click();
  assert.equal(saved.enabled, false);
  assert.equal(toggle.textContent, "Disabled");
  assert.equal(attributes["aria-checked"], "false");
  assert.equal(toggle.disabled, false);
  await click();
  assert.equal(saved.enabled, true);
  assert.equal(toggle.textContent, "Enabled");
});
