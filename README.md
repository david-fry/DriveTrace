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

## Education deployment (self-host + Google Admin)

Use this flow if your district/school wants to host DriveTrace internally and
push it to managed Chrome users.

### 1. Package a signed release

1. Keep a private extension key file (`.pem`) in secure admin storage.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, then use
   **Pack extension**.
3. Select the DriveTrace folder (the one with `manifest.json`) and the same
   `.pem` key each time you release.
4. Chrome outputs a `.crx` package. Reusing the same key keeps the extension ID
   stable across updates.

### 2. Host update files over HTTPS

1. Upload the `.crx` file to an HTTPS location reachable by managed devices
   (for example, your district web server).
2. Create an update manifest XML file, for example `updates.xml`:

   <?xml version="1.0" encoding="UTF-8"?>
   <gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
     <app appid="YOUR_EXTENSION_ID">
       <updatecheck codebase="https://your-domain.example/extensions/drivetrace-1.0.1.crx" version="1.0.1" />
     </app>
   </gupdate>

3. Host `updates.xml` on HTTPS (for example,
   `https://your-domain.example/extensions/updates.xml`).
4. For each new release, publish a new `.crx`, update the `version` in
   `manifest.json`, and update `codebase` + `version` in `updates.xml`.

### 3. Force-install from Google Admin

1. In Admin console, go to **Devices > Chrome > Apps & extensions > Users & browsers**.
2. Choose the organizational unit (OU) for students/teachers.
3. Add the extension by ID/update URL (UI text may appear as **Add by ID** or
   similar):
   - Extension ID: your stable DriveTrace extension ID
   - Update URL: your hosted `updates.xml` URL
4. Set installation policy to **Force install**.
5. Save and wait for policy sync on managed browsers.

### 4. Recommended pilot checklist

1. Test in a pilot OU before district-wide rollout.
2. Verify users can open Google Docs and see DriveTrace load normally.
3. Confirm extension updates by publishing a minor version bump.
4. Keep the `.pem` key backed up; losing it prevents in-place upgrades.

### Notes

- This project stores analysis data in each user's local Chrome profile
  (`chrome.storage.local`) and does not send data to a backend.
- Google Admin UI labels can change; if wording differs, look for options to
  add a private extension using extension ID plus update URL.
