import { get, set } from './storage.js';
import { normalizeTag, updateTagIndex, updateTagUsage, updateDomainTags } from './tags.js';

function generateId() {
  const hex = Math.random().toString(16).slice(2, 6);
  return `bk_${Date.now()}_${hex}`;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function saveBookmark({ url, title, tags = [], favIconUrl = '', speedDialSlot = null }) {
  const { bookmarks = {}, speedDial = [null, null, null, null, null, null, null, null, null, null] } = await get(['bookmarks', 'speedDial']);

  const normalizedTags = tags.map(normalizeTag).filter(Boolean);
  const domain = extractDomain(url);

  // Check if URL already exists
  const existing = Object.values(bookmarks).find(b => b.url === url);
  const id = existing ? existing.id : generateId();
  const oldTags = existing ? existing.tags : [];

  const bookmark = {
    id,
    url,
    title: title || url,
    tags: normalizedTags,
    domain,
    favIconUrl,
    speedDial: speedDialSlot,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
    visitCount: existing ? existing.visitCount : 0,
  };

  bookmarks[id] = bookmark;

  // Update speed dial — clear existing assignment first
  for (let i = 0; i < 10; i++) {
    if (speedDial[i] === id) speedDial[i] = null;
  }
  // Assign new slot if specified
  if (speedDialSlot !== null && speedDialSlot >= 0 && speedDialSlot <= 9) {
    speedDial[speedDialSlot] = id;
  }

  await set({ bookmarks, speedDial });
  await updateTagIndex(id, oldTags, normalizedTags);
  await updateTagUsage(normalizedTags);
  await updateDomainTags(domain, normalizedTags);

  return bookmark;
}

export async function deleteBookmark(id) {
  const { bookmarks = {}, speedDial = [null, null, null, null, null, null, null, null, null, null] } = await get(['bookmarks', 'speedDial']);

  const bookmark = bookmarks[id];
  if (!bookmark) return;

  const oldTags = bookmark.tags;
  delete bookmarks[id];

  // Clear speed dial slot
  for (let i = 0; i < 10; i++) {
    if (speedDial[i] === id) speedDial[i] = null;
  }

  await set({ bookmarks, speedDial });
  await updateTagIndex(id, oldTags, []);
}

export async function updateFavicon(id, favIconUrl, faviconLight = false) {
  const { bookmarks = {} } = await get('bookmarks');
  if (!bookmarks[id]) return;
  bookmarks[id].favIconUrl = favIconUrl;
  bookmarks[id].faviconLight = faviconLight;
  await set({ bookmarks });
}

export async function getBookmarkByUrl(url) {
  const { bookmarks = {} } = await get('bookmarks');
  return Object.values(bookmarks).find(b => b.url === url) || null;
}

export async function getAllBookmarks() {
  const { bookmarks = {} } = await get('bookmarks');
  return Object.values(bookmarks).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getRecentBookmarks(limit = 20) {
  const all = await getAllBookmarks();
  return all.slice(0, limit);
}

export async function getSpeedDial() {
  const { speedDial = [null, null, null, null, null, null, null, null, null, null], bookmarks = {} } = await get(['speedDial', 'bookmarks']);
  return speedDial.map(id => id ? bookmarks[id] || null : null);
}

export async function setSpeedDialSlot(bookmarkId, slot) {
  const { bookmarks = {}, speedDial = [null, null, null, null, null, null, null, null, null, null] } = await get(['bookmarks', 'speedDial']);
  const bookmark = bookmarks[bookmarkId];
  if (!bookmark) return;

  // Clear any existing slot for this bookmark
  for (let i = 0; i < 10; i++) {
    if (speedDial[i] === bookmarkId) speedDial[i] = null;
  }

  // Assign new slot (null means remove from speed dial)
  if (slot !== null && slot >= 0 && slot <= 9) {
    speedDial[slot] = bookmarkId;
    bookmark.speedDial = slot;
  } else {
    bookmark.speedDial = null;
  }

  bookmarks[bookmarkId] = bookmark;
  await set({ bookmarks, speedDial });
}

export async function getAvailableSpeedDialSlots() {
  const { speedDial = [null, null, null, null, null, null, null, null, null, null] } = await get('speedDial');
  const available = [];
  for (let i = 0; i < 10; i++) {
    if (speedDial[i] === null) available.push(i);
  }
  return available;
}

export async function incrementVisitCount(id) {
  const { bookmarks = {} } = await get('bookmarks');
  if (bookmarks[id]) {
    bookmarks[id].visitCount++;
    bookmarks[id].updatedAt = Date.now();
    await set({ bookmarks });
  }
}
