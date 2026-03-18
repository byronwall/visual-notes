import { lookupPage, sendBulkCapture, sendTargetedCapture } from "./api-client.js";
import { cropScreenshotToSelection } from "./screenshot.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.tabs.onActivated.addListener(() => {
  void refreshActiveTabBadge();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    void refreshTabBadge(tab);
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  void refreshActiveTabBadge();
});

async function handleMessage(message) {
  switch (message?.type) {
    case "archive:get-active-tab":
      return { tab: await getActiveTab() };
    case "archive:lookup-active-tab": {
      const tab = await getActiveTab();
      if (!tab?.url) return { lookup: { exists: false } };
      return { lookup: await lookupPage(tab.url) };
    }
    case "archive:bulk-capture":
      return { result: await runBulkCapture(message.groupName) };
    case "archive:targeted-capture":
      return {
        result: await runTargetedCapture({
          groupName: message.groupName,
          noteText: message.noteText,
          mode: message.mode || "region",
          skipSnapshot: Boolean(message.skipSnapshot),
        }),
      };
    default:
      throw new Error("Unknown message");
  }
}

async function runBulkCapture(groupName) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const capturedAt = new Date().toISOString();
  const items = [];
  const skipped = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (!isInjectableUrl(tab.url)) {
      skipped.push({ tabId: tab.id, url: tab.url, reason: "restricted_url" });
      continue;
    }
    try {
      const snapshot = await extractFromTab(tab.id);
      items.push({
        tabId: tab.id,
        url: snapshot.url,
        title: snapshot.title,
        html: snapshot.html,
        meta: snapshot.meta,
        textSnippet: snapshot.textSnippet,
        extensionPayload: {
          tabStatus: tab.status || null,
          favIconUrl: tab.favIconUrl || null,
        },
      });
    } catch (error) {
      skipped.push({
        tabId: tab.id,
        url: tab.url,
        reason: error.message || "extract_failed",
      });
    }
  }

  if (!items.length) {
    return { ok: false, captured: 0, skipped, message: "No injectable tabs captured." };
  }

  const payload = {
    groupName: resolveGroupName(groupName),
    capturedAt,
    windowId: tabs[0]?.windowId,
    items,
  };
  const result = await sendBulkCapture(payload);
  await refreshActiveTabBadge();
  return { ...result, skipped };
}

async function runTargetedCapture({ groupName, noteText, mode, skipSnapshot }) {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) throw new Error("No active tab");
  if (!isInjectableUrl(tab.url)) throw new Error("Active tab cannot be captured");

  let selection = undefined;
  let screenshotDataUrl = undefined;
  if (mode === "viewport") {
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    selection = {
      mode: "viewport",
      rect: {
        x: 0,
        y: 0,
        width: tab.width || 0,
        height: tab.height || 0,
        devicePixelRatio: 1,
      },
    };
  } else if (mode !== "note") {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-targeted.js"],
    });

    const selectionResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "archive:start-selection",
      mode,
    });
    if (!selectionResponse?.ok) {
      throw new Error(selectionResponse?.error || "Selection failed");
    }
    selection = selectionResponse.selection;

    const visibleShot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    screenshotDataUrl = await cropScreenshotToSelection(
      visibleShot,
      selection?.rect,
    );
  }

  const snapshot = skipSnapshot
    ? {
        url: tab.url,
        title: tab.title || tab.url,
        html: "",
        textSnippet: "",
        meta: {},
      }
    : await extractFromTab(tab.id);
  const payload = {
    url: snapshot.url,
    title: snapshot.title,
    capturedAt: new Date().toISOString(),
    groupName: groupName || undefined,
    html: snapshot.html || undefined,
    meta: snapshot.meta,
    noteText,
    screenshotDataUrl,
    selection,
    textSnippet: snapshot.textSnippet || undefined,
    extensionPayload: {
      tabId: tab.id,
      windowId: tab.windowId,
    },
    skipSnapshot: Boolean(skipSnapshot),
  };
  const result = await sendTargetedCapture(payload);
  await refreshActiveTabBadge();
  return result;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function resolveGroupName(input) {
  return (input || "Window capture").trim();
}

function isInjectableUrl(url) {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url);
}

async function refreshActiveTabBadge() {
  const tab = await getActiveTab();
  await refreshTabBadge(tab);
}

async function refreshTabBadge(tab) {
  if (!tab?.id || !tab.url || !isInjectableUrl(tab.url)) {
    await chrome.action.setBadgeText({ text: "", tabId: tab?.id });
    return;
  }

  try {
    const lookup = await lookupPage(tab.url);
    if (lookup?.exists) {
      await chrome.action.setBadgeText({ text: "ON", tabId: tab.id });
      await chrome.action.setBadgeBackgroundColor({
        color: "#166534",
        tabId: tab.id,
      });
      await chrome.action.setTitle({
        tabId: tab.id,
        title: `Visual Notes Archive: tracked (${lookup.title || tab.url})`,
      });
    } else {
      await chrome.action.setBadgeText({ text: "", tabId: tab.id });
      await chrome.action.setTitle({
        tabId: tab.id,
        title: "Visual Notes Archive",
      });
    }
  } catch {
    await chrome.action.setBadgeText({ text: "", tabId: tab.id });
  }
}

async function extractFromTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const readMeta = (selector) =>
        document.head?.querySelector(selector)?.getAttribute("content") || null;

      const byName = {};
      const byProperty = {};
      for (const node of Array.from(document.head?.querySelectorAll("meta") || [])) {
        const name = node.getAttribute("name");
        const property = node.getAttribute("property");
        const content = node.getAttribute("content");
        if (!content) continue;
        if (name) byName[name] = content;
        if (property) byProperty[property] = content;
      }

      const textSnippet = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

      return {
        url: location.href,
        title: document.title || location.href,
        html: document.documentElement?.outerHTML || "",
        textSnippet,
        meta: {
          description: readMeta('meta[name="description"]'),
          ogTitle: readMeta('meta[property="og:title"]'),
          ogDescription: readMeta('meta[property="og:description"]'),
          ogImage: readMeta('meta[property="og:image"]'),
          ogUrl: readMeta('meta[property="og:url"]'),
          ogSiteName: readMeta('meta[property="og:site_name"]'),
          twitterCard: readMeta('meta[name="twitter:card"]'),
          twitterTitle: readMeta('meta[name="twitter:title"]'),
          twitterDescription: readMeta('meta[name="twitter:description"]'),
          twitterImage: readMeta('meta[name="twitter:image"]'),
          faviconUrl:
            document.querySelector('link[rel~="icon"]')?.href || null,
          byName,
          byProperty,
        },
      };
    },
  });

  if (!result?.html) {
    throw new Error("Extractor returned empty HTML");
  }
  return result;
}
