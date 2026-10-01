import { getDocuments, getSettings, saveDocument, saveSettings } from "./shared/storage.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const actions = {
    "get-documents": () => getDocuments(),
    "get-settings": () => getSettings(),
    "save-document": () => saveDocument(message.analysis),
    "save-settings": () => saveSettings(message.settings)
  };
  const action = Object.hasOwn(actions, message?.type) ? actions[message.type] : null;
  if (!action) return false;
  action().then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
