(() => {
  const docId = window.location.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/)?.[1];
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
    const settings = await storage.getSettings();
    const title = document.querySelector(".docs-title-input")?.value
      || document.title.replace(/ - Google Docs$/, "") || "Untitled document";
    const pageHtml = document.documentElement.innerHTML;
    const authToken = pageHtml.match(/"token":"(.*?)"/)?.[1] || null;
    const userId = pageHtml.match(/"docs-pid":"(.*?)"/)?.[1]
      || document.querySelector("[data-gapiuid]")?.getAttribute("data-gapiuid")
      || document.querySelector('img[src*="googleusercontent.com"]')?.src.match(/\/([0-9]{8,})\//)?.[1]
      || null;
    let refreshTimer = null;
    let refreshInFlight = false;

    const refreshAnalysis = async () => {
      if (refreshInFlight) return;
      try {
        if (isReplayTabActive()) return;
        refreshInFlight = true;
        const sidebarWasOpen = document.querySelector("#drivetrace-sidebar")?.classList.contains("open") ?? false;
        const activeTab = document.querySelector("#drivetrace-sidebar .dt-tabs button.active")?.dataset.tab || "overview";
        const fetched = await fetchModule.fetchRevisions(docId, userId, authToken);
        const analysis = analyzeModule.analyzeDocument({
          ...fetched, docId, docTitle: title, docUrl: window.location.href
        }, settings);
        await storage.saveDocument(analysis);
        if (fetched.truncated) analysis.truncated = true;
        if (!settings.enableFlags) analysis.flags = [];
        const sidebar = sidebarModule.createSidebar(analysis);
        sidebar.element.querySelector(`.dt-tabs button[data-tab="${activeTab}"]`)?.click();
        if (sidebarWasOpen) sidebar.open();
        wireSidebarRefreshControls(sidebar.element);
        statsModule.injectStatsBar(analysis, settings.enableStatsBar, sidebar.open);
      } catch (error) {
        console.error("DriveTrace could not analyze this document:", error);
        const notice = document.createElement("div");
        notice.id = "drivetrace-error";
        notice.textContent = "DriveTrace could not load revision history. Check that you can access this document, then reload.";
        document.body.append(notice);
      } finally {
        refreshInFlight = false;
      }
    };

    const stopRefresh = () => {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
        refreshTimer = null;
      }
    };

    const startRefresh = () => {
      if (refreshTimer || isReplayTabActive()) return;
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

    window.addEventListener("beforeunload", stopRefresh, { once: true });
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
