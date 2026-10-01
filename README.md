# DriveTrace

DriveTrace is a local-only Chrome extension that helps teachers understand the
writing process behind Google Docs. It analyzes revision history in the signed-in
browser and stores document summaries in `chrome.storage.local`; it has no
backend, login, OAuth flow, dependencies, or build step.

## Load in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked** and choose the repository folder containing
   `manifest.json`.
4. Open a Google Doc using an account that can access its revision history.
5. Open the DriveTrace toolbar popup to see recently analyzed documents. Use
   **Settings** in the popup to configure session and paste thresholds.

The extension requests Google Docs revision history using the current browser
session. Revision history may be unavailable for documents or accounts where
Google does not permit access. Data remains in the local Chrome profile; use the
settings page's **Clear all stored data** button to remove it.
