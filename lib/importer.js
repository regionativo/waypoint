import { saveBookmark, getBookmarkByUrl } from './bookmarks.js';
import { normalizeTag } from './tags.js';

const SKIP_FOLDERS = new Set([
  'bookmarks bar',
  'other bookmarks',
  'mobile bookmarks',
  'bookmarks',
]);

export async function importChromeBookmarks(onProgress) {
  const tree = await chrome.bookmarks.getTree();
  const items = [];
  collectBookmarks(tree, [], items);

  let imported = 0;
  let skipped = 0;
  let merged = 0;

  for (let i = 0; i < items.length; i++) {
    const { url, title, tags } = items[i];

    const existing = await getBookmarkByUrl(url);
    if (existing) {
      // Merge tags
      const mergedTags = [...new Set([...existing.tags, ...tags])];
      if (mergedTags.length > existing.tags.length) {
        await saveBookmark({ url, title: existing.title, tags: mergedTags, favIconUrl: existing.favIconUrl });
        merged++;
      } else {
        skipped++;
      }
    } else {
      await saveBookmark({ url, title, tags });
      imported++;
    }

    if (onProgress) onProgress({ current: i + 1, total: items.length, imported, skipped, merged });
  }

  return { total: items.length, imported, skipped, merged };
}

function collectBookmarks(nodes, folderPath, results) {
  for (const node of nodes) {
    if (node.url) {
      // It's a bookmark
      const tags = folderPath
        .map(normalizeTag)
        .filter(Boolean);

      results.push({ url: node.url, title: node.title || node.url, tags });
    }

    if (node.children) {
      const folderName = (node.title || '').toLowerCase().trim();
      const nextPath = SKIP_FOLDERS.has(folderName)
        ? folderPath
        : [...folderPath, node.title];

      collectBookmarks(node.children, nextPath, results);
    }
  }
}

export async function getImportPreview() {
  const tree = await chrome.bookmarks.getTree();
  const items = [];
  collectBookmarks(tree, [], items);

  const uniqueUrls = new Set(items.map(i => i.url));
  const uniqueTags = new Set(items.flatMap(i => i.tags));

  return {
    totalBookmarks: items.length,
    uniqueUrls: uniqueUrls.size,
    uniqueTags: uniqueTags.size,
  };
}

export async function importFromJSON(jsonArray) {
  let imported = 0;
  let skipped = 0;
  let merged = 0;

  for (const item of jsonArray) {
    const { url, title, tags = [] } = item;
    if (!url) continue;

    const normalizedTags = tags.map(normalizeTag).filter(Boolean);
    const existing = await getBookmarkByUrl(url);

    if (existing) {
      const mergedTags = [...new Set([...existing.tags, ...normalizedTags])];
      if (mergedTags.length > existing.tags.length) {
        await saveBookmark({ url, title: existing.title, tags: mergedTags, favIconUrl: existing.favIconUrl });
        merged++;
      } else {
        skipped++;
      }
    } else {
      await saveBookmark({ url, title: title || url, tags: normalizedTags });
      imported++;
    }
  }

  return { total: jsonArray.length, imported, skipped, merged };
}
