import { initialize, get, set } from '../lib/storage.js';
import { getAllBookmarks, deleteBookmark, saveBookmark, updateFavicon } from '../lib/bookmarks.js';
import { normalizeTag, getAllTags, deleteTag } from '../lib/tags.js';
import { THEMES, getTheme, setTheme, loadTheme } from '../lib/theme.js';
import { importChromeBookmarks, getImportPreview, importFromJSON } from '../lib/importer.js';

let allBookmarks = [];
let displayedBookmarks = [];
let checkedIds = new Set();
let activeTag = null; // null = show all

const tagListEl = document.getElementById('tag-list');
const tagTotalCount = document.getElementById('tag-total-count');
const listEl = document.getElementById('bookmark-list');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const selectAllCb = document.getElementById('select-all');
const selectionCount = document.getElementById('selection-count');
const btnAddTag = document.getElementById('btn-add-tag');
const btnRemoveTag = document.getElementById('btn-remove-tag');
const btnDelete = document.getElementById('btn-delete');
const btnDeleteAll = document.getElementById('btn-delete-all');
const btnExport = document.getElementById('btn-export');
const btnImportJson = document.getElementById('btn-import-json');
const fileImport = document.getElementById('file-import');
const btnImportChrome = document.getElementById('btn-import-chrome');
const btnRefreshFavicons = document.getElementById('btn-refresh-favicons');

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

async function load() {
  allBookmarks = await getAllBookmarks();
  renderSidebar();
  renderBookmarks();
}

// ── Tag Sidebar ──

async function renderSidebar() {
  const tags = await getAllTags();
  tagTotalCount.textContent = `${allBookmarks.length}`;
  tagListEl.innerHTML = '';

  const singleCount = tags.filter(t => t.bookmarks === 1).length;

  // "All" item
  const allItem = document.createElement('div');
  allItem.className = `tag-sidebar-item tag-sidebar-all ${activeTag === null ? 'active' : ''}`;
  allItem.innerHTML = `
    <span class="tag-sidebar-item-name">All Bookmarks</span>
    <span class="tag-sidebar-item-count">${allBookmarks.length}</span>
  `;
  allItem.addEventListener('click', () => {
    activeTag = null;
    renderSidebar();
    renderBookmarks();
  });
  tagListEl.appendChild(allItem);

  // Bulk cleanup for single-use tags
  if (singleCount > 0) {
    const cleanupItem = document.createElement('div');
    cleanupItem.className = 'tag-sidebar-item tag-sidebar-cleanup';
    cleanupItem.innerHTML = `
      <span class="tag-sidebar-item-name">Delete single-use tags</span>
      <span class="tag-sidebar-item-count">${singleCount}</span>
    `;
    cleanupItem.addEventListener('click', async () => {
      const singleTags = tags.filter(t => t.bookmarks === 1).map(t => t.tag);
      if (!confirm(`Delete ${singleTags.length} tags that only appear on 1 bookmark?\n\nTags: ${singleTags.slice(0, 20).join(', ')}${singleTags.length > 20 ? '...' : ''}`)) return;
      for (const tag of singleTags) await deleteTag(tag);
      if (activeTag && singleTags.includes(activeTag)) activeTag = null;
      allBookmarks = await getAllBookmarks();
      renderSidebar();
      renderBookmarks(true);
    });
    tagListEl.appendChild(cleanupItem);
  }

  for (const { tag, bookmarks: count } of tags) {
    const item = document.createElement('div');
    item.className = `tag-sidebar-item ${activeTag === tag ? 'active' : ''}${count === 1 ? ' tag-single' : ''}`;

    const name = document.createElement('span');
    name.className = 'tag-sidebar-item-name';
    name.textContent = tag;

    const right = document.createElement('span');
    right.className = 'tag-sidebar-item-right';

    const countEl = document.createElement('span');
    countEl.className = 'tag-sidebar-item-count';
    countEl.textContent = count;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tag-sidebar-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = `Delete tag "${tag}"`;
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete tag "${tag}" from ${count} bookmark${count !== 1 ? 's' : ''}?`)) return;
      await deleteTag(tag);
      if (activeTag === tag) activeTag = null;
      allBookmarks = await getAllBookmarks();
      renderSidebar();
      renderBookmarks(true);
    });

    right.appendChild(countEl);
    right.appendChild(deleteBtn);
    item.appendChild(name);
    item.appendChild(right);

    item.addEventListener('click', () => {
      activeTag = tag;
      renderSidebar();
      renderBookmarks();
    });
    tagListEl.appendChild(item);
  }
}

// ── Bookmark List ──

function getFilteredBookmarks() {
  let bks = allBookmarks;

  if (activeTag) {
    bks = bks.filter(b => b.tags.includes(activeTag));
  }

  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    bks = bks.filter(bk =>
      bk.title.toLowerCase().includes(query) ||
      bk.url.toLowerCase().includes(query) ||
      bk.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  return bks;
}

function renderBookmarks(preserveSelection = false) {
  displayedBookmarks = getFilteredBookmarks();
  if (!preserveSelection) checkedIds.clear();
  // Remove checked IDs that are no longer in the displayed set
  const displayedIds = new Set(displayedBookmarks.map(b => b.id));
  for (const id of checkedIds) {
    if (!displayedIds.has(id)) checkedIds.delete(id);
  }
  listEl.innerHTML = '';

  if (displayedBookmarks.length === 0) {
    listEl.innerHTML = '<div class="manage-empty">No bookmarks found.</div>';
    updateToolbar();
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
    favicon.className = `manage-favicon${bk.faviconLight ? ' favicon-light' : ''}`;
    favicon.src = bk.favIconUrl || `https://www.google.com/s2/favicons?domain=${bk.domain}&sz=16`;
    favicon.width = 16;
    favicon.height = 16;
    favicon.title = 'Click to upload custom favicon';
    favicon.onerror = () => { favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="%234fc3f7" width="16" height="16" rx="3"/></svg>'; };
    favicon.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          await updateFavicon(bk.id, reader.result, false);
          allBookmarks = await getAllBookmarks();
          renderBookmarks(true);
        };
        reader.readAsDataURL(file);
      });
      input.click();
    });

    const info = document.createElement('div');
    info.className = 'manage-info';

    const title = document.createElement('span');
    title.className = 'manage-title-link';
    title.textContent = bk.title;
    title.title = bk.url;

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
        activeTag = tag;
        searchInput.value = '';
        renderSidebar();
        renderBookmarks();
      });
      tagsDiv.appendChild(chip);
    }

    info.appendChild(title);
    info.appendChild(url);
    info.appendChild(tagsDiv);

    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('manage-tag-chip')) return;
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

  updateToolbar();
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
  searchClear.style.display = searchInput.value ? 'flex' : 'none';
  debounceTimer = setTimeout(renderBookmarks, 200);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  renderBookmarks();
});

selectAllCb.addEventListener('change', () => {
  if (selectAllCb.checked) {
    displayedBookmarks.forEach(bk => checkedIds.add(bk.id));
  } else {
    checkedIds.clear();
  }
  // Re-render checkboxes
  const rows = listEl.querySelectorAll('.manage-row');
  rows.forEach((row, i) => {
    const cb = row.querySelector('.manage-checkbox');
    if (cb) {
      cb.checked = selectAllCb.checked;
      row.classList.toggle('checked', selectAllCb.checked);
    }
  });
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
      activeTag = null;
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
  showRemoveTagPicker();
});

btnExport.addEventListener('click', async () => {
  const { speedDial = [null,null,null,null,null,null,null,null,null,null], bookmarks = {} } = await get(['speedDial', 'bookmarks']);
  const sdMap = {};
  speedDial.forEach((id, i) => { if (id) sdMap[id] = i; });
  const data = allBookmarks.map(bk => {
    const entry = { url: bk.url, title: bk.title, tags: bk.tags };
    if (sdMap[bk.id] !== undefined) entry.speedDial = sdMap[bk.id];
    if (bk.faviconLight) entry.faviconLight = true;
    return entry;
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'waypoint-bookmarks.json';
  a.click();
  URL.revokeObjectURL(url);
});

btnImportJson.addEventListener('click', () => fileImport.click());

fileImport.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Invalid format');
    if (!confirm(`Import ${data.length} bookmarks from JSON? Duplicates will be merged.`)) {
      fileImport.value = '';
      return;
    }
    const result = await importFromJSON(data);
    fileImport.value = '';
    allBookmarks = await getAllBookmarks();
    renderSidebar();
    renderBookmarks();
    alert(`Imported ${result.imported}, merged ${result.merged}, skipped ${result.skipped}.`);
  } catch (err) {
    alert('Failed to import: ' + err.message);
    fileImport.value = '';
  }
});

btnImportChrome.addEventListener('click', async () => {
  const preview = await getImportPreview();
  const msg = `Found ${preview.totalBookmarks} Chrome bookmarks (${preview.uniqueUrls} unique URLs, ${preview.uniqueTags} tags). Import?`;
  if (!confirm(msg)) return;
  const result = await importChromeBookmarks();
  allBookmarks = await getAllBookmarks();
  renderSidebar();
  renderBookmarks();
  alert(`Imported ${result.imported}, merged ${result.merged}, skipped ${result.skipped}.`);
});

async function checkFaviconLight(imgUrl) {
  try {
    const resp = await fetch(imgUrl);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

    let totalLum = 0;
    let samples = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 30) continue;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      totalLum += lum;
      samples++;
    }

    const avgLum = samples > 0 ? totalLum / samples : 0;
    const isLight = samples > 0 && avgLum > 0.92;
    console.log(`Favicon ${imgUrl}: avgLum=${avgLum.toFixed(3)}, samples=${samples}/${bitmap.width * bitmap.height}, light=${isLight}`);
    return isLight;
  } catch (err) {
    console.log(`Favicon check failed for ${imgUrl}:`, err);
    return false;
  }
}

btnRefreshFavicons.addEventListener('click', async () => {
  const total = allBookmarks.length;
  btnRefreshFavicons.disabled = true;
  btnRefreshFavicons.textContent = `Refreshing 0/${total}...`;

  // Collect all results first, then write once
  const updates = {};
  let done = 0;

  const batch = 5;
  for (let i = 0; i < allBookmarks.length; i += batch) {
    const chunk = allBookmarks.slice(i, i + batch);
    await Promise.all(chunk.map(async (bk) => {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${bk.domain}&sz=32`;
      const isLight = await checkFaviconLight(faviconUrl);
      updates[bk.id] = { faviconUrl, isLight };
      done++;
      btnRefreshFavicons.textContent = `Refreshing ${done}/${total}...`;
    }));
  }

  // Single write to storage
  const { bookmarks = {} } = await get('bookmarks');
  for (const [id, { faviconUrl, isLight }] of Object.entries(updates)) {
    if (bookmarks[id]) {
      bookmarks[id].favIconUrl = faviconUrl;
      bookmarks[id].faviconLight = isLight;
    }
  }
  await set({ bookmarks });

  btnRefreshFavicons.textContent = 'Refresh Favicons';
  btnRefreshFavicons.disabled = false;
  await load();
});

// ── Remove tag picker ──

const removeTagDialog = document.getElementById('remove-tag-dialog');
const removeTagList = document.getElementById('remove-tag-list');
const removeTagSubtitle = document.getElementById('remove-tag-subtitle');
const removeTagDone = document.getElementById('remove-tag-done');

removeTagDone.addEventListener('click', () => {
  removeTagDialog.style.display = 'none';
});

function showRemoveTagPicker() {
  // Collect all tags from selected bookmarks with counts
  const tagCounts = {};
  for (const id of checkedIds) {
    const bk = allBookmarks.find(b => b.id === id);
    if (bk) {
      for (const tag of bk.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  removeTagSubtitle.textContent = `${checkedIds.size} bookmark${checkedIds.size !== 1 ? 's' : ''} selected`;
  removeTagList.innerHTML = '';

  if (tags.length === 0) {
    removeTagList.innerHTML = '<span style="color:var(--text-dim);font-size:var(--text-sm)">No tags on selected bookmarks</span>';
    removeTagDialog.style.display = 'flex';
    return;
  }

  for (const [tag, count] of tags) {
    const item = document.createElement('button');
    item.className = 'remove-tag-item';
    item.innerHTML = `<span class="remove-tag-minus">&minus;</span> ${tag} <span class="remove-tag-count">(${count})</span>`;
    item.addEventListener('click', async () => {
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
      allBookmarks = await getAllBookmarks();
      renderSidebar();
      renderBookmarks(true);
      showRemoveTagPicker();
    });
    removeTagList.appendChild(item);
  }

  removeTagDialog.style.display = 'flex';
}

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
    if (removeTagDialog.style.display !== 'none') { removeTagDialog.style.display = 'none'; return; }
    if (tagDialog.style.display !== 'none') { tagDialog.style.display = 'none'; return; }
    if (confirmDialog.style.display !== 'none') { confirmDialog.style.display = 'none'; return; }
  }
});

// ── Theme picker ──

const THEME_SWATCHES = {
  default: ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e'],
  forge: ['#f59e0b', '#0a0a0a', '#e11d48', '#0d9488', '#7c3aed'],
};

async function renderThemePicker() {
  const picker = document.getElementById('theme-picker');
  const currentTheme = await getTheme();
  picker.innerHTML = '';

  for (const theme of THEMES) {
    const card = document.createElement('div');
    card.className = `theme-card ${theme.id === currentTheme ? 'active' : ''}`;

    const preview = document.createElement('div');
    preview.className = 'theme-card-preview';
    for (const color of (THEME_SWATCHES[theme.id] || [])) {
      const swatch = document.createElement('div');
      swatch.className = 'theme-card-swatch';
      swatch.style.background = color;
      preview.appendChild(swatch);
    }

    const name = document.createElement('span');
    name.className = 'theme-card-name';
    name.textContent = theme.name;

    const desc = document.createElement('span');
    desc.className = 'theme-card-desc';
    desc.textContent = theme.description;

    card.appendChild(preview);
    card.appendChild(name);
    card.appendChild(desc);

    card.addEventListener('click', async () => {
      await setTheme(theme.id);
      renderThemePicker();
    });

    picker.appendChild(card);
  }
}

// ── Init ──

initialize().then(async () => {
  await loadTheme();
  await load();
  renderThemePicker();
});
