import { fetchGroups, getArchiveConfig, setArchiveConfig } from "./api-client.js";

const els = {
  configPanel: document.getElementById("configPanel"),
  serverBaseUrl: document.getElementById("serverBaseUrl"),
  ingestToken: document.getElementById("ingestToken"),
  saveConfig: document.getElementById("saveConfig"),
  tabStatus: document.getElementById("tabStatus"),
  bulkGroupName: document.getElementById("bulkGroupName"),
  bulkGroups: document.getElementById("bulkGroups"),
  bulkCapture: document.getElementById("bulkCapture"),
  targetGroupName: document.getElementById("targetGroupName"),
  targetGroups: document.getElementById("targetGroups"),
  noteText: document.getElementById("noteText"),
  saveNote: document.getElementById("saveNote"),
  startScreenshot: document.getElementById("startScreenshot"),
  startDomNode: document.getElementById("startDomNode"),
  resultStatus: document.getElementById("resultStatus"),
};

init().catch((error) => setStatus(error.message));

async function init() {
  const config = await getArchiveConfig();
  els.serverBaseUrl.value = config.serverBaseUrl || "";
  els.ingestToken.value = config.ingestToken || "";
  if (config.serverBaseUrl && config.ingestToken) {
    els.configPanel.open = false;
  }

  els.saveConfig.addEventListener("click", async () => {
    await setArchiveConfig({
      serverBaseUrl: els.serverBaseUrl.value.trim(),
      ingestToken: els.ingestToken.value.trim(),
    });
    setStatus("Config saved.", "success");
    await refreshGroups();
    await refreshLookup();
  });

  els.noteText.addEventListener("input", syncNoteActionLabel);

  els.bulkCapture.addEventListener("click", async () => {
    setStatus("Capturing current window…", "info");
    const response = await sendMessage({
      type: "archive:bulk-capture",
      groupName: els.bulkGroupName.value.trim(),
    });
    setStatus(renderResultSummary(response.result), "success");
    await refreshGroups();
    await refreshLookup();
  });

  els.saveNote.addEventListener("click", async () => {
    try {
      setStatus("Saving link and HTML…", "info");
      const noteText = els.noteText.value.trim();
      const response = await sendMessage({
        type: "archive:targeted-capture",
        groupName: els.targetGroupName.value.trim(),
        noteText,
        action: "note",
      });
      setStatus(renderResultSummary(response.result), "success");
      els.noteText.value = "";
      syncNoteActionLabel();
      await refreshGroups();
      await refreshLookup();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  els.startScreenshot.addEventListener("click", async () => {
    await beginCapture("screenshot");
  });

  els.startDomNode.addEventListener("click", async () => {
    await beginCapture("dom-node");
  });

  await refreshGroups();
  await refreshLookup();
  syncNoteActionLabel();
}

async function beginCapture(action) {
  const noteText = els.noteText.value.trim();
  try {
    setStatus(
      action === "dom-node" ? "Pick an element to capture…" : "Brush a region to capture…",
      "info",
    );
    chrome.runtime.sendMessage(
      {
        type: "archive:targeted-capture",
        groupName: els.targetGroupName.value.trim(),
        noteText,
        action,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message);
        }
      },
    );
    window.close();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function refreshLookup() {
  const activeTabResponse = await sendMessage({ type: "archive:get-active-tab" });
  const tab = activeTabResponse.tab;
  if (!tab?.url) {
    els.tabStatus.textContent = "No active tab.";
    return;
  }

  const lookupResponse = await sendMessage({ type: "archive:lookup-active-tab" });
  const lookup = lookupResponse.lookup || { exists: false };
  els.tabStatus.innerHTML = lookup.exists
    ? renderTrackedTabStatus({
        title: lookup.title || tab.title || "Untitled",
        groupName: lookup.groupName || "—",
        lastCapturedAt: lookup.lastCapturedAt,
      })
    : renderUntrackedTabStatus({
        title: tab.title || "Untitled",
        hostname: readHostname(tab.url),
      });
}

async function refreshGroups() {
  try {
    const response = await fetchGroups();
    replaceOptions(els.bulkGroups, response.groups || []);
    replaceOptions(els.targetGroups, response.groups || []);
  } catch (error) {
    setStatus(`Could not load groups: ${error.message}`, "error");
  }
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown extension error"));
        return;
      }
      resolve(response);
    });
  });
}

function replaceOptions(datalist, groups) {
  if (!datalist) return;
  datalist.innerHTML = "";
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    datalist.appendChild(option);
  }
}

function renderResultSummary(result) {
  if (!result) return "Completed.";
  if (typeof result.createdCount === "number") {
    return `Bulk capture saved ${result.createdCount} item(s).${result.skipped?.length ? ` Skipped ${result.skipped.length}.` : ""}`;
  }
  if (result.action === "note" && !result.noteId) {
    return result.snapshotId ? "Link and HTML saved." : "Saved.";
  }
  if (result.noteId) {
    const label =
      result.action === "note"
        ? "Note saved."
        : result.action === "dom-node"
          ? "DOM capture saved."
          : "Screenshot saved.";
    return `${label}${result.createdImageCount ? ` Added ${result.createdImageCount} image.` : ""}${result.snapshotId ? " HTML snapshot stored." : ""}`;
  }
  return JSON.stringify(result, null, 2);
}

function syncNoteActionLabel() {
  if (!els.saveNote) return;
  els.saveNote.textContent = els.noteText.value.trim()
    ? "Save link note and HTML"
    : "Save link + HTML";
}

function setStatus(value, tone = "info") {
  els.resultStatus.textContent = value;
  els.resultStatus.className = `statusBanner ${tone}`;
}

function renderTrackedTabStatus({ title, groupName, lastCapturedAt }) {
  return [
    `<div class="pill">Tracked</div>`,
    `<div class="tabTitle" title="${escapeHtml(title)}">${escapeHtml(title)}</div>`,
    `<div class="statusGrid">`,
    renderStatusItem("Group", groupName),
    renderStatusItem("Saved", formatRelativeTime(lastCapturedAt)),
    `</div>`,
  ].join("");
}

function renderUntrackedTabStatus({ title, hostname }) {
  return [
    `<div class="pill">Not tracked</div>`,
    `<div class="tabTitle" title="${escapeHtml(title)}">${escapeHtml(title)}</div>`,
    `<div class="statusGrid">`,
    renderStatusItem("Site", hostname || "Unknown"),
    `</div>`,
  ].join("");
}

function renderStatusItem(key, value) {
  return `<div class="statusItem"><div class="statusKey">${escapeHtml(key)}</div><div class="statusValue" title="${escapeHtml(value)}">${escapeHtml(value)}</div></div>`;
}

function formatRelativeTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function readHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
