// Fuse.js-based search — will be wired in Phase 2
// For now, popup.js uses a simple weighted search

let fuse = null;

export async function buildIndex(bookmarks) {
  const { default: Fuse } = await import('../vendor/fuse.min.js');
  fuse = new Fuse(bookmarks, {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'tags', weight: 0.35 },
      { name: 'url', weight: 0.15 },
      { name: 'domain', weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
  });
}

export function search(query) {
  if (!fuse) return [];
  return fuse.search(query).map(r => r.item);
}
