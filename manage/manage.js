import { initialize, get, set } from '../lib/storage.js';
import { getAllBookmarks, deleteBookmark, saveBookmark } from '../lib/bookmarks.js';
import { normalizeTag, getAllTags } from '../lib/tags.js';

let allBookmarks = [];
let displayedBookmarks = [];
let checkedIds = new Set();
let drillPath = []; // stack of tag filters for drill-down

const treemapEl = document.getElementById('treemap');
const listViewEl = document.getElementById('list-view');
const listEl = document.getElementById('bookmark-list');
const breadcrumbEl = document.getElementById('breadcrumb');
const searchInput = document.getElementById('search-input');
const selectAllCb = document.getElementById('select-all');
const selectionCount = document.getElementById('selection-count');
const btnAddTag = document.getElementById('btn-add-tag');
const btnRemoveTag = document.getElementById('btn-remove-tag');
const btnDelete = document.getElementById('btn-delete');
const btnDeleteAll = document.getElementById('btn-delete-all');
const btnExport = document.getElementById('btn-export');

const tagDialog = document.getElementById('tag-dialog');
const tagDialogTitle = document.getElementById('tag-dialog-title');
const tagDialogInput = document.getElementById('tag-dialog-input');
const tagDialogCancel = document.getElementById('tag-dialog-cancel');
const tagDialogConfirm = document.getElementById('tag-dialog-confirm');

const confirmDialog = document.getElementById('confirm-dialog');
const confirmTitle = document.getElementById('confirm-dialog-title');
const confirmSubtitle = document.getElementById('confirm-dialog-subtitle');
const confirmCancel = document.getElementById('confirm-dialog-cancel');
const confirmConfirm = document.getElementById('confirm-dialog-confirm');

// Color palette for treemap cells
const COLORS = [
  { bg: '#eff6ff', fg: '#3b82f6', border: '#bfdbfe' },
  { bg: '#f5f3ff', fg: '#8b5cf6', border: '#ddd6fe' },
  { bg: '#f0fdfa', fg: '#14b8a6', border: '#99f6e4' },
  { bg: '#fffbeb', fg: '#f59e0b', border: '#fde68a' },
  { bg: '#fff1f2', fg: '#f43f5e', border: '#fecdd3' },
  { bg: '#fff7ed', fg: '#f97316', border: '#fed7aa' },
  { bg: '#f0fdf4', fg: '#22c55e', border: '#bbf7d0' },
  { bg: '#fdf4ff', fg: '#d946ef', border: '#f5d0fe' },
];

async function load() {
  allBookmarks = await getAllBookmarks();
  render();
}

function render() {
  const query = searchInput.value.trim().toLowerCase();

  if (query) {
    showListView(query);
  } else {
    showTreemap();
  }
  renderBreadcrumb();
}

// ── Treemap ──

function getBookmarksForDrill() {
  let bks = allBookmarks;
  for (const tag of drillPath) {
    bks = bks.filter(b => b.tags.includes(tag));
  }
  return bks;
}

function getTagCounts(bookmarks) {
  const counts = {};
  for (const bk of bookmarks) {
    for (const tag of bk.tags) {
      if (!drillPath.includes(tag)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);
}

function showTreemap() {
  treemapEl.style.display = 'block';
  listViewEl.style.display = 'none';

  const bookmarks = getBookmarksForDrill();
  const tagCounts = getTagCounts(bookmarks);

  treemapEl.innerHTML = '';

  if (tagCounts.length === 0) {
    if (bookmarks.length > 0) {
      // No more sub-tags to show, switch to list
      showDrilledList(bookmarks);
      return;
    }
    treemapEl.innerHTML = '<div class="manage-empty">No bookmarks yet.</div>';
    return;
  }

  // Show total count
  const statsBar = document.createElement('div');
  statsBar.className = 'treemap-stats';
  statsBar.textContent = `${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''} \u00b7 ${tagCounts.length} tag${tagCounts.length !== 1 ? 's' : ''}`;
  treemapEl.appendChild(statsBar);

  const grid = document.createElement('div');
  grid.className = 'treemap-grid';
  treemapEl.appendChild(grid);

  // Squarified treemap layout
  const totalCount = tagCounts.reduce((s, [, c]) => s + c, 0);
  const rects = layoutTreemap(tagCounts, totalCount);

  for (let i = 0; i < rects.length; i++) {
    const [tag, count] = tagCounts[i];
    const rect = rects[i];
    const color = COLORS[i % COLORS.length];

    const cell = document.createElement('div');
    cell.className = 'treemap-cell';
    cell.style.left = `${rect.x}%`;
    cell.style.top = `${rect.y}%`;
    cell.style.width = `${rect.w}%`;
    cell.style.height = `${rect.h}%`;
    cell.style.backgroundColor = color.bg;
    cell.style.borderColor = color.border;

    const label = document.createElement('span');
    label.className = 'treemap-cell-label';
    label.style.color = color.fg;
    label.textContent = tag;

    const countEl = document.createElement('span');
    countEl.className = 'treemap-cell-count';
    countEl.style.color = color.fg;
    countEl.textContent = count;

    cell.appendChild(label);
    cell.appendChild(countEl);

    cell.addEventListener('click', () => {
      drillPath.push(tag);
      render();
    });

    grid.appendChild(cell);
  }

  // "Show all" button if drilled down
  if (drillPath.length > 0) {
    const showAllBtn = document.createElement('button');
    showAllBtn.className = 'manage-btn treemap-show-all';
    showAllBtn.textContent = `Show ${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''} as list`;
    showAllBtn.addEventListener('click', () => showDrilledList(bookmarks));
    treemapEl.appendChild(showAllBtn);
  }
}

function showDrilledList(bookmarks) {
  treemapEl.style.display = 'none';
  listViewEl.style.display = 'block';
  displayedBookmarks = bookmarks;
  checkedIds.clear();
  renderList();
  updateToolbar();
}

// ── Squarified treemap layout ──
// Attempt a simple slice-and-dice with alternating direction

function layoutTreemap(items, total) {
  const rects = [];
  squarify(items.map(([, c]) => c), 0, 0, 100, 100, rects, total);
  return rects;
}

function squarify(values, x, y, w, h, rects, total) {
  if (values.length === 0) return;
  if (values.length === 1) {
    rects.push({ x, y, w, h });
    return;
  }

  const sum = values.reduce((a, b) => a + b, 0);

  if (w >= h) {
    // Split vertically
    let accum = 0;
    let splitIdx = 0;
    const halfSum = sum / 2;
    for (let i = 0; i < values.length - 1; i++) {
      accum += values[i];
      if (accum >= halfSum) {
        splitIdx = i + 1;
        break;
      }
      splitIdx = i + 1;
    }

    const leftSum = values.slice(0, splitIdx).reduce((a, b) => a + b, 0);
    const leftW = (leftSum / sum) * w;

    squarify(values.slice(0, splitIdx), x, y, leftW, h, rects, total);
    squarify(values.slice(splitIdx), x + leftW, y, w - leftW, h, rects, total);
  } else {
    // Split horizontally
    let accum = 0;
    let splitIdx = 0;
    const halfSum = sum / 2;
    for (let i = 0; i < values.length - 1; i++) {
      accum += values[i];
      if (accum >= halfSum) {
        splitIdx = i + 1;
        break;
      }
      splitIdx = i + 1;
    }

    const topSum = values.slice(0, splitIdx).reduce((a, b) => a + b, 0);
    const topH = (topSum / sum) * h;

    squarify(values.slice(0, splitIdx), x, y, w, topH, rects, total);
    squarify(values.slice(splitIdx), x, y + topH, w, h - topH, rects, total);
  }
}

// ── Breadcrumb ──

function renderBreadcrumb() {
  breadcrumbEl.innerHTML = '';

  if (drillPath.length === 0 && !searchInput.value.trim()) {
    breadcrumbEl.style.display = 'none';
    return;
  }

  breadcrumbEl.style.display = 'flex';

  const homeBtn = document.createElement('span');
  homeBtn.className = 'breadcrumb-item breadcrumb-home';
  homeBtn.textContent = 'All Tags';
  homeBtn.addEventListener('click', () => {
    drillPath = [];
    searchInput.value = '';
    render();
  });
  breadcrumbEl.appendChild(homeBtn);

  for (let i = 0; i < drillPath.length; i++) {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = '\u203A';
    breadcrumbEl.appendChild(sep);

    const crumb = document.createElement('span');
    crumb.className = 'breadcrumb-item';
    crumb.textContent = drillPath[i];
    if (i < drillPath.length - 1) {
      crumb.addEventListener('click', () => {
        drillPath = drillPath.slice(0, i + 1);
        render();
      });
    } else {
      crumb.classList.add('breadcrumb-current');
    }
    breadcrumbEl.appendChild(crumb);
  }

  if (searchInput.value.trim()) {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = '\u203A';
    breadcrumbEl.appendChild(sep);

    const searchCrumb = document.createElement('span');
    searchCrumb.className = 'breadcrumb-item breadcrumb-current';
    searchCrumb.textContent = `search: "${searchInput.value.trim()}"`;
    breadcrumbEl.appendChild(searchCrumb);
  }
}

// ── List view (search results or drilled-down bookmarks) ──

function showListView(query) {
  treemapEl.style.display = 'none';
  listViewEl.style.display = 'block';

  let bks = getBookmarksForDrill();
  displayedBookmarks = bks.filter(bk =>
    bk.title.toLowerCase().includes(query) ||
    bk.url.toLowerCase().includes(query) ||
    bk.tags.some(t => t.toLowerCase().includes(query))
  );

  checkedIds.clear();
  renderList();
  updateToolbar();
}

function renderList() {
  listEl.innerHTML = '';

  if (displayedBookmarks.length === 0) {
    listEl.innerHTML = '<div class="manage-empty">No bookmarks found.</div>';
    return;
  }

  for (const bk of displayedBookmarks) {
    const row = document.createElement('div');
    row.className = 'manage-row';
    if (checkedIds.has(bk.id)) row.classList.add('checked');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'manage-checkbox';
    cb.checked = checkedIds.has(bk.id);
    cb.addEventListener('change', () => {
      if (cb.checked) checkedIds.add(bk.id);
      else checkedIds.delete(bk.id);
      row.classList.toggle('checked', cb.checked);
      updateToolbar();
    });

    const favicon = document.createElement('img');
    favicon.className = 'manage-favicon';
    favicon.src = bk.favIconUrl || `https://www.google.com/s2/favicons?domain=${bk.domain}&sz=16`;
    favicon.width = 16;
    favicon.height = 16;
    favicon.onerror = () => { favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="%234fc3f7" width="16" height="16" rx="3"/></svg>'; };

    const info = document.createElement('div');
    info.className = 'manage-info';

    const title = document.createElement('a');
    title.className = 'manage-title-link';
    title.textContent = bk.title;
    title.href = bk.url;
    title.target = '_blank';

    const url = document.createElement('span');
    url.className = 'manage-url';
    url.textContent = bk.domain;

    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'manage-tags';
    for (const tag of bk.tags) {
      const chip = document.createElement('span');
      chip.className = 'manage-tag-chip';
      chip.textContent = tag;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        drillPath = [tag];
        searchInput.value = '';
        render();
      });
      tagsDiv.appendChild(chip);
    }

    info.appendChild(title);
    info.appendChild(url);
    info.appendChild(tagsDiv);

    row.addEventListener('click', (e) => {
      if (e.target === cb || e.target === title || e.target.classList.contains('manage-tag-chip')) return;
      cb.checked = !cb.checked;
      if (cb.checked) checkedIds.add(bk.id);
      else checkedIds.delete(bk.id);
      row.classList.toggle('checked', cb.checked);
      updateToolbar();
    });

    row.appendChild(cb);
    row.appendChild(favicon);
    row.appendChild(info);
    listEl.appendChild(row);
  }
}

function updateToolbar() {
  const count = checkedIds.size;
  selectionCount.textContent = `${count} selected`;
  btnAddTag.disabled = count === 0;
  btnRemoveTag.disabled = count === 0;
  btnDelete.disabled = count === 0;
  selectAllCb.checked = count > 0 && count === displayedBookmarks.length;
  selectAllCb.indeterminate = count > 0 && count < displayedBookmarks.length;
}

// ── Events ──

let debounceTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 200);
});

selectAllCb.addEventListener('change', () => {
  if (selectAllCb.checked) {
    displayedBookmarks.forEach(bk => checkedIds.add(bk.id));
  } else {
    checkedIds.clear();
  }
  renderList();
  updateToolbar();
});

btnDelete.addEventListener('click', () => {
  showConfirm(
    `Delete ${checkedIds.size} bookmark${checkedIds.size !== 1 ? 's' : ''}?`,
    'This cannot be undone.',
    async () => {
      for (const id of checkedIds) await deleteBookmark(id);
      checkedIds.clear();
      await load();
    }
  );
});

btnDeleteAll.addEventListener('click', () => {
  showConfirm(
    `Delete ALL ${allBookmarks.length} bookmarks?`,
    'This will remove every bookmark and reset all data. Cannot be undone.',
    async () => {
      await set({
        bookmarks: {},
        tagIndex: {},
        tagUsage: {},
        domainTags: {},
        speedDial: [null, null, null, null, null, null, null, null, null, null],
      });
      checkedIds.clear();
      drillPath = [];
      await load();
    }
  );
});

btnAddTag.addEventListener('click', () => {
  showTagDialog('Add tag to selected bookmarks', async (tagName) => {
    const tag = normalizeTag(tagName);
    if (!tag) return;
    for (const id of checkedIds) {
      const bk = allBookmarks.find(b => b.id === id);
      if (bk && !bk.tags.includes(tag)) {
        await saveBookmark({
          url: bk.url, title: bk.title,
          tags: [...bk.tags, tag],
          favIconUrl: bk.favIconUrl, speedDialSlot: bk.speedDial,
        });
      }
    }
    await load();
  });
});

btnRemoveTag.addEventListener('click', () => {
  showTagDialog('Remove tag from selected bookmarks', async (tagName) => {
    const tag = normalizeTag(tagName);
    if (!tag) return;
    for (const id of checkedIds) {
      const bk = allBookmarks.find(b => b.id === id);
      if (bk && bk.tags.includes(tag)) {
        await saveBookmark({
          url: bk.url, title: bk.title,
          tags: bk.tags.filter(t => t !== tag),
          favIconUrl: bk.favIconUrl, speedDialSlot: bk.speedDial,
        });
      }
    }
    await load();
  });
});

btnExport.addEventListener('click', () => {
  const data = allBookmarks.map(bk => ({ url: bk.url, title: bk.title, tags: bk.tags }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'waypoint-bookmarks.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Dialogs ──

function showTagDialog(title, onConfirm) {
  tagDialogTitle.textContent = title;
  tagDialogInput.value = '';
  tagDialog.style.display = 'flex';
  tagDialogInput.focus();

  const cleanup = () => {
    tagDialog.style.display = 'none';
    tagDialogConfirm.onclick = null;
    tagDialogCancel.onclick = null;
    tagDialogInput.onkeydown = null;
  };

  tagDialogConfirm.onclick = () => { cleanup(); onConfirm(tagDialogInput.value); };
  tagDialogCancel.onclick = cleanup;
  tagDialogInput.onkeydown = (e) => {
    if (e.key === 'Enter') { cleanup(); onConfirm(tagDialogInput.value); }
    if (e.key === 'Escape') cleanup();
  };
}

function showConfirm(title, subtitle, onConfirm) {
  confirmTitle.textContent = title;
  confirmSubtitle.textContent = subtitle;
  confirmDialog.style.display = 'flex';

  const cleanup = () => {
    confirmDialog.style.display = 'none';
    confirmConfirm.onclick = null;
    confirmCancel.onclick = null;
  };

  confirmConfirm.onclick = () => { cleanup(); onConfirm(); };
  confirmCancel.onclick = cleanup;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (tagDialog.style.display !== 'none') { tagDialog.style.display = 'none'; return; }
    if (confirmDialog.style.display !== 'none') { confirmDialog.style.display = 'none'; return; }
    // Escape in list view goes back to treemap
    if (listViewEl.style.display !== 'none' && !searchInput.value.trim()) {
      render();
    }
  }
});

initialize().then(load);
