import { getSettings, saveSettings } from "../shared/storage.js";

const fields = {
  enableStatsBar: document.querySelector("#enableStatsBar"),
  enableFlags: document.querySelector("#enableFlags"),
  sessionGapMinutes: document.querySelector("#sessionGapMinutes"),
  minimumPasteSize: document.querySelector("#minimumPasteSize")
};
const status = document.querySelector("#saved");

/** Persist the current value of a setting and update the status message.
 * @param {string} name Setting key.
 * @param {string|boolean|number} value Updated value.
 * @returns {Promise<void>} Resolves after saving.
 */
async function updateSetting(name, value) {
  await saveSettings({ [name]: value });
  status.textContent = "Settings saved";
  window.setTimeout(() => { status.textContent = ""; }, 1500);
}

const settings = await getSettings();
for (const [name, field] of Object.entries(fields)) {
  field.type === "checkbox" ? field.checked = Boolean(settings[name]) : field.value = String(settings[name]);
}
const gapValue = document.querySelector("#gap-value");
gapValue.textContent = fields.sessionGapMinutes.value;
fields.enableStatsBar.addEventListener("change", () => updateSetting("enableStatsBar", fields.enableStatsBar.checked));
fields.enableFlags.addEventListener("change", () => updateSetting("enableFlags", fields.enableFlags.checked));
fields.sessionGapMinutes.addEventListener("input", () => { gapValue.textContent = fields.sessionGapMinutes.value; });
fields.sessionGapMinutes.addEventListener("change", () => updateSetting("sessionGapMinutes", Number(fields.sessionGapMinutes.value)));
fields.minimumPasteSize.addEventListener("change", () => {
  const value = Math.max(1, Number(fields.minimumPasteSize.value) || 150);
  fields.minimumPasteSize.value = String(value);
  updateSetting("minimumPasteSize", value);
});
document.querySelector("#clear").addEventListener("click", async () => {
  if (window.confirm("Clear all DriveTrace documents and settings?")) {
    await chrome.storage.local.clear();
    status.textContent = "Stored data cleared";
  }
});
