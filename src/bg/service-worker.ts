/**
 * MapLayout Pro — Service Worker (Background)
 *
 * Handles:
 * - Opening the designer tab
 * - Message routing between popup and designer
 * - Tile cache management
 */

const DESIGNER_URL = chrome.runtime.getURL('src/ui/designer/designer.html');

// Track the designer tab so we don't open duplicates
let designerTabId: number | null = null;

/** Open or focus the designer tab */
async function openDesigner(params?: Record<string, string>): Promise<void> {
  // Check if existing tab is still open
  if (designerTabId !== null) {
    try {
      const tab = await chrome.tabs.get(designerTabId);
      if (tab && tab.url?.startsWith(DESIGNER_URL)) {
        await chrome.tabs.update(designerTabId, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        return;
      }
    } catch {
      designerTabId = null;
    }
  }

  // Build URL with optional query params
  let url = DESIGNER_URL;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const tab = await chrome.tabs.create({ url });
  designerTabId = tab.id ?? null;
}

// Listen for messages from popup and designer
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'openDesigner') {
    openDesigner(message.params).then(() => sendResponse({ ok: true }));
    return true; // async response
  }

  if (message.action === 'getDesignerTabId') {
    sendResponse({ tabId: designerTabId });
    return false;
  }

  // Proxy fetch — bypasses extension_pages CSP for external APIs
  if (message.action === 'proxyFetch') {
    fetch(message.url, { redirect: 'follow' })
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ error: `HTTP ${res.status}` });
          return;
        }
        const text = await res.text();
        sendResponse({ data: text });
      })
      .catch((err) => {
        sendResponse({ error: (err as Error).message });
      });
    return true; // async response
  }

  return false;
});

// Track tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === designerTabId) {
    designerTabId = null;
  }
});

// Extension icon click — open designer directly
chrome.action.onClicked.addListener(() => {
  openDesigner();
});

console.log('[MapLayout Pro] Service worker initialized');
