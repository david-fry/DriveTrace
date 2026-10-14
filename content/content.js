(() => {
  const match = window.location.pathname.match(/\/(document|presentation)\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  const documentType = match?.[1];
  const docId = match?.[2];
  if (!docId || !document.body) return;
  const guard = "data-drivetrace-loaded";
  if (document.body.hasAttribute(guard)) return;
  document.body.setAttribute(guard, "true");

  const baseUrl = chrome.runtime.getURL("content/");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = `${baseUrl}content.css`;
  document.documentElement.append(stylesheet);

  Promise.all([
    import(`${baseUrl}fetchRevisions.js`),
    import(`${baseUrl}analyzeDoc.js`),
    import(`${baseUrl}statsBar.js`),
    import(`${baseUrl}sidebar.js`),
    import(chrome.runtime.getURL("shared/storage.js"))
  ]).then(async ([fetchModule, analyzeModule, statsModule, sidebarModule, storage]) => {
    let settings = await storage.getSettings();
    const title = document.querySelector(".docs-title-input")?.value
      || document.title.replace(/ - Google (Docs|Slides)$/, "") || "Untitled document";
    const pageHtml = document.documentElement.innerHTML;
    const authToken = pageHtml.match(/"token":"(.*?)"/)?.[1] || null;
    const userId = pageHtml.match(/"docs-pid":"(.*?)"/)?.[1]
      || document.querySelector("[data-gapiuid]")?.getAttribute("data-gapiuid")
      || document.querySelector('img[src*="googleusercontent.com"]')?.src.match(/\/([0-9]{8,})\//)?.[1]
      || null;
    let refreshTimer = null;
    let refreshInFlight = false;
    let activeRequest = null;

    const refreshAnalysis = async () => {
      if (settings.enabled === false || refreshInFlight) return;
      const controller = new AbortController();
      activeRequest = controller;
      try {
        if (isReplayTabActive()) return;
        refreshInFlight = true;
        const sidebarWasOpen = document.querySelector("#drivetrace-sidebar")?.classList.contains("open") ?? false;
        const activeTab = document.querySelector("#drivetrace-sidebar .dt-tabs button.active")?.dataset.tab || "overview";
        const fetched = await fetchModule.fetchRevisions(docId, userId, authToken, documentType, controller.signal);
        if (controller.signal.aborted || settings.enabled === false) return;
        const analysis = analyzeModule.analyzeDocument({
          ...fetched, docId, documentType, docTitle: title, docUrl: window.location.href
        }, settings);
        document.querySelector("#drivetrace-error")?.remove();
        await storage.saveDocument(analysis);
        if (controller.signal.aborted || settings.enabled === false) return;
        if (fetched.truncated) analysis.truncated = true;
        if (!settings.enableFlags) analysis.flags = [];
        const sidebar = sidebarModule.createSidebar(analysis);
        sidebar.element.querySelector(`.dt-tabs button[data-tab="${activeTab}"]`)?.click();
        if (sidebarWasOpen) sidebar.open();
        wireSidebarRefreshControls(sidebar.element);
        statsModule.injectStatsBar(analysis, settings.enableStatsBar, sidebar.open);
      } catch (error) {
        if (controller.signal.aborted || settings.enabled === false) return;
        console.error("DriveTrace could not analyze this document:", error);
        const notice = document.createElement("div");
        notice.id = "drivetrace-error";
        notice.textContent = "DriveTrace could not load revision history. Check that you can access this document, then reload.";
        document.querySelector("#drivetrace-error")?.remove();
        document.body.append(notice);
      } finally {
        refreshInFlight = false;
        if (activeRequest === controller) activeRequest = null;
        if (controller.signal.aborted && settings.enabled !== false) void refreshAnalysis();
      }
    };

    const stopRefresh = () => {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
        refreshTimer = null;
      }
    };

    const startRefresh = () => {
      if (settings.enabled === false || refreshTimer || isReplayTabActive()) return;
      refreshTimer = window.setInterval(refreshAnalysis, 5000);
    };

    const syncRefreshTimer = () => {
      if (isReplayTabActive()) stopRefresh();
      else startRefresh();
    };

    function isReplayTabActive() {
      return document.querySelector("#drivetrace-sidebar .dt-tabs button.active")?.dataset.tab === "replay";
    }

    function wireSidebarRefreshControls(sidebarElement) {
      sidebarElement.querySelectorAll(".dt-tabs button").forEach(button => {
        button.addEventListener("click", syncRefreshTimer);
      });
    }

    const applySettings = next => {
      const wasEnabled = settings.enabled !== false;
      settings = next;
      if (settings.enabled === false) {
        stopRefresh();
        activeRequest?.abort();
        document.querySelectorAll("#drivetrace-sidebar, #drivetrace-stats-bar, #drivetrace-error")
          .forEach(element => element.remove());
      } else if (!wasEnabled) {
        void refreshAnalysis();
        startRefresh();
      }
    };
    const onSettingsChanged = (changes, area) => {
      if (area === "local" && changes[storage.SETTINGS_KEY]) {
        // A cleared settings record restores the enabled default.
        applySettings(changes[storage.SETTINGS_KEY].newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(onSettingsChanged);
    applySettings(await storage.getSettings());
    window.addEventListener("beforeunload", () => {
      stopRefresh();
      activeRequest?.abort();
      chrome.storage.onChanged.removeListener(onSettingsChanged);
    }, { once: true });
    try {
      await refreshAnalysis();
      startRefresh();
    } catch (error) {
      console.error("DriveTrace could not analyze this document:", error);
      const notice = document.createElement("div");
      notice.id = "drivetrace-error";
      notice.textContent = "DriveTrace could not load revision history. Check that you can access this document, then reload.";
      document.body.append(notice);
    }
  }).catch(error => console.error("DriveTrace failed to initialize:", error));
})();
