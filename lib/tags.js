import { get, set } from './storage.js';

export function normalizeTag(tag) {
  return tag.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 30);
}

export async function getTagSuggestions(partial, domain = null) {
  const { tagUsage = {}, domainTags = {} } = await get(['tagUsage', 'domainTags']);

  const allTags = Object.entries(tagUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const domainSuggestions = domain ? (domainTags[domain] || []) : [];

  // Merge: domain tags first, then usage-ranked, deduplicated
  const merged = [...new Set([...domainSuggestions, ...allTags])];

  if (!partial) return merged.slice(0, 10);

  const lower = partial.toLowerCase();
  return merged.filter(t => t.includes(lower)).slice(0, 10);
}

export async function updateTagUsage(tags) {
  const { tagUsage = {} } = await get('tagUsage');
  for (const tag of tags) {
    tagUsage[tag] = (tagUsage[tag] || 0) + 1;
  }
  await set({ tagUsage });
}

export async function updateDomainTags(domain, tags) {
  if (!domain || tags.length === 0) return;
  const { domainTags = {} } = await get('domainTags');
  const existing = new Set(domainTags[domain] || []);
  for (const tag of tags) existing.add(tag);
  domainTags[domain] = [...existing];
  await set({ domainTags });
}

export async function renameTag(oldName, newName) {
  const normalized = normalizeTag(newName);
  if (!normalized || normalized === oldName) return;

  const { bookmarks = {}, tagIndex = {}, tagUsage = {}, domainTags = {} } = await get(['bookmarks', 'tagIndex', 'tagUsage', 'domainTags']);

  // Update all bookmarks that have this tag
  const affectedIds = tagIndex[oldName] || [];
  for (const id of affectedIds) {
    if (bookmarks[id]) {
      bookmarks[id].tags = bookmarks[id].tags.map(t => t === oldName ? normalized : t);
      // Deduplicate in case newName already existed on this bookmark
      bookmarks[id].tags = [...new Set(bookmarks[id].tags)];
    }
  }

  // Update tagIndex
  const mergedIds = [...new Set([...(tagIndex[oldName] || []), ...(tagIndex[normalized] || [])])];
  delete tagIndex[oldName];
  if (mergedIds.length > 0) {
    tagIndex[normalized] = mergedIds;
  }

  // Update tagUsage
  const oldCount = tagUsage[oldName] || 0;
  const existingCount = tagUsage[normalized] || 0;
  delete tagUsage[oldName];
  if (oldCount + existingCount > 0) {
    tagUsage[normalized] = oldCount + existingCount;
  }

  // Update domainTags
  for (const domain of Object.keys(domainTags)) {
    const tags = domainTags[domain];
    const idx = tags.indexOf(oldName);
    if (idx !== -1) {
      tags[idx] = normalized;
      domainTags[domain] = [...new Set(tags)];
    }
  }

  await set({ bookmarks, tagIndex, tagUsage, domainTags });
}

export async function deleteTag(tagName) {
  const { bookmarks = {}, tagIndex = {}, tagUsage = {}, domainTags = {} } = await get(['bookmarks', 'tagIndex', 'tagUsage', 'domainTags']);

  // Remove tag from all bookmarks
  const affectedIds = tagIndex[tagName] || [];
  for (const id of affectedIds) {
    if (bookmarks[id]) {
      bookmarks[id].tags = bookmarks[id].tags.filter(t => t !== tagName);
    }
  }

  // Remove from tagIndex
  delete tagIndex[tagName];

  // Remove from tagUsage
  delete tagUsage[tagName];

  // Remove from domainTags
  for (const domain of Object.keys(domainTags)) {
    domainTags[domain] = domainTags[domain].filter(t => t !== tagName);
    if (domainTags[domain].length === 0) delete domainTags[domain];
  }

  await set({ bookmarks, tagIndex, tagUsage, domainTags });
}

export async function getAllTags() {
  const { tagUsage = {}, tagIndex = {} } = await get(['tagUsage', 'tagIndex']);
  return Object.entries(tagUsage)
    .map(([tag, count]) => ({ tag, count, bookmarks: (tagIndex[tag] || []).length }))
    .sort((a, b) => b.count - a.count);
}

export async function updateTagIndex(bookmarkId, oldTags, newTags) {
  const { tagIndex = {} } = await get('tagIndex');

  // Remove bookmark from old tags
  for (const tag of oldTags) {
    if (tagIndex[tag]) {
      tagIndex[tag] = tagIndex[tag].filter(id => id !== bookmarkId);
      if (tagIndex[tag].length === 0) delete tagIndex[tag];
    }
  }

  // Add bookmark to new tags
  for (const tag of newTags) {
    if (!tagIndex[tag]) tagIndex[tag] = [];
    if (!tagIndex[tag].includes(bookmarkId)) {
      tagIndex[tag].push(bookmarkId);
    }
  }

  await set({ tagIndex });
}
