import { initialize } from '../lib/storage.js';
import { saveBookmark, getBookmarkByUrl } from '../lib/bookmarks.js';

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

    await initialize();

    // If already saved, just notify
    const existing = await getBookmarkByUrl(tab.url);
    if (existing) {
      await chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
      return;
    }

    // Extract domain for auto-tag
    let domain = '';
    try { domain = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
    const tags = domain ? [domain] : [];

    await saveBookmark({
      url: tab.url,
      title: tab.title || tab.url,
      tags,
      favIconUrl: tab.favIconUrl || '',
    });

    // Show brief badge confirmation
    await chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
  }
});
