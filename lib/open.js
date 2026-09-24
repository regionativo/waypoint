import { get, set } from './storage.js';

export const OPEN_MODES = [
  { id: 'new-tab', name: 'Always a new tab', description: 'Every bookmark opens in a fresh tab.' },
  { id: 'current-tab', name: 'The current tab', description: 'Bookmarks replace whatever is open in the active tab.' },
  { id: 'smart', name: 'Current tab, if empty', description: "Reuses the active tab only when it's a new tab page; otherwise opens a new tab." },
];

const NEW_TAB_URLS = new Set(['chrome://newtab/', 'chrome://new-tab-page/', 'about:blank']);

export async function getOpenMode() {
  const { openMode = 'new-tab' } = await get('openMode');
  return openMode;
}

export async function setOpenMode(mode) {
  await set({ openMode: mode });
}

// Opens a bookmark according to the user's open-mode setting. Middle-click /
// "open in background" gestures should call chrome.tabs.create directly instead.
export async function openBookmark(url) {
  const mode = await getOpenMode();

  if (mode !== 'new-tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && (mode === 'current-tab' || NEW_TAB_URLS.has(tab.url))) {
      chrome.tabs.update(tab.id, { url });
      return;
    }
  }

  chrome.tabs.create({ url });
}
