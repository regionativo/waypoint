import { initialize } from '../lib/storage.js';
import { getAllBookmarks, getSpeedDial, deleteBookmark, getBookmarkByUrl } from '../lib/bookmarks.js';
import { buildIndex, search } from '../lib/search.js';
import { renameTag, deleteTag, getAllTags } from '../lib/tags.js';
import { createSearchBar } from './components/search-bar.js';
import { createSpeedDial } from './components/speed-dial.js';
import { createBookmarkList } from './components/bookmark-list.js';
import { createCaptureForm } from './components/capture-form.js';
import { importChromeBookmarks, getImportPreview, importFromJSON } from '../lib/importer.js';
import { get } from '../lib/storage.js';

const app = document.getElementById('app');
let currentView = 'main'; // 'main' | 'capture'
let activeTagFilter = null;

// --- Components ---

const searchBar = createSearchBar({
  onSearch: handleSearch,
  onClear: handleClearSearch,
  onCapture: showCaptureForCurrentTab,
  onImport: handleImport,
  onImportFile: handleImportFile,
});

const speedDial = createSpeedDial({
  onEdit: showEditForm,
});

const bookmarkList = createBookmarkList({
  onTagClick: handleTagFilter,
  onEdit: showEditForm,
  onDelete: confirmDelete,
});

const tagGrid = document.createElement('div');
tagGrid.className = 'tag-grid';

const backToTagsBtn = document.createElement('button');
backToTagsBtn.className = 'back-to-tags';
backToTagsBtn.innerHTML = '\u2190 <span class="back-to-tags-label">All Tags</span>';
backToTagsBtn.style.display = 'none';
backToTagsBtn.addEventListener('click', () => {
  activeTagFilter = null;
  searchBar.clear();
  showTagGrid();
});

const captureForm = createCaptureForm({
  onSave: () => {
    showMainView();
    refreshMainView();
  },
  onCancel: showMainView,
  onDelete: () => {
    showMainView();
    refreshMainView();
  },
});

// Delete confirmation overlay
const deleteOverlay = document.createElement('div');
deleteOverlay.className = 'delete-overlay';
deleteOverlay.style.display = 'none';
deleteOverlay.innerHTML = `
  <div class="delete-dialog">
    <p class="delete-message">Delete this bookmark?</p>
    <p class="delete-title-preview"></p>
    <div class="delete-actions">
      <button class="delete-cancel-btn">Cancel</button>
      <button class="delete-confirm-btn">Delete</button>
    </div>
  </div>
`;

let pendingDeleteBookmark = null;
deleteOverlay.querySelector('.delete-cancel-btn').addEventListener('click', () => {
  deleteOverlay.style.display = 'none';
  pendingDeleteBookmark = null;
});
deleteOverlay.querySelector('.delete-confirm-btn').addEventListener('click', async () => {
  if (pendingDeleteBookmark) {
    await deleteBookmark(pendingDeleteBookmark.id);
    pendingDeleteBookmark = null;
    deleteOverlay.style.display = 'none';
    await refreshMainView();
  }
});

// --- Layout ---

const mainContainer = document.createElement('div');
mainContainer.id = 'main-view';

mainContainer.appendChild(searchBar.element);
mainContainer.appendChild(speedDial.element);
mainContainer.appendChild(tagGrid);
mainContainer.appendChild(backToTagsBtn);
mainContainer.appendChild(bookmarkList.element);

app.appendChild(mainContainer);
app.appendChild(captureForm.element);
app.appendChild(deleteOverlay);
captureForm.element.style.display = 'none';

// --- Views ---

function showMainView() {
  currentView = 'main';
  mainContainer.style.display = 'flex';
  mainContainer.style.flexDirection = 'column';
  captureForm.element.style.display = 'none';
  tagManagerContainer.style.display = 'none';
  document.activeElement?.blur();
  updateCurrentPageIndicator();
}

async function showCaptureForCurrentTab() {
  currentView = 'capture';
  mainContainer.style.display = 'none';
  captureForm.element.style.display = 'flex';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await captureForm.populateFromTab(tab);
  }
}

function showEditForm(bookmark) {
  currentView = 'capture';
  mainContainer.style.display = 'none';
  captureForm.element.style.display = 'flex';
  captureForm.populateFromBookmark(bookmark);
}

// --- Current page indicator ---
// Highlight the + button if current page is already bookmarked
async function updateCurrentPageIndicator() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const existing = await getBookmarkByUrl(tab.url);
    searchBar.setBookmarked(!!existing);
  }
}

// --- View toggling ---

let selectedTagIndex = -1;
let tagGridVisible = false;

function showTagGrid() {
  tagGrid.style.display = 'flex';
  backToTagsBtn.style.display = 'none';
  bookmarkList.element.style.display = 'none';
  tagGridVisible = true;
  selectedTagIndex = -1;
  renderTagGrid();
}

function showBookmarkList() {
  tagGrid.style.display = 'none';
  backToTagsBtn.style.display = 'flex';
  bookmarkList.element.style.display = 'block';
  tagGridVisible = false;
  selectedTagIndex = -1;
}

function updateTagGridSelection() {
  const btns = tagGrid.querySelectorAll('.tag-grid-btn');
  btns.forEach((btn, i) => btn.classList.toggle('selected', i === selectedTagIndex));
  if (selectedTagIndex >= 0 && btns[selectedTagIndex]) {
    btns[selectedTagIndex].scrollIntoView({ block: 'nearest' });
  }
}

async function renderTagGrid() {
  const tags = await getAllTags();
  tagGrid.innerHTML = '';
  selectedTagIndex = -1;

  if (tags.length === 0) {
    tagGrid.innerHTML = '<div class="tag-grid-empty">No bookmarks yet. Click + to save a page.</div>';
    return;
  }

  for (const { tag, bookmarks: count } of tags) {
    const btn = document.createElement('button');
    btn.className = 'tag-grid-btn';
    btn.innerHTML = `${tag} <span class="tag-grid-count">${count}</span>`;
    btn.addEventListener('click', () => handleTagFilter(tag));
    tagGrid.appendChild(btn);
  }
}

// --- Search ---

async function handleSearch(query) {
  activeTagFilter = null;
  showBookmarkList();
  backToTagsBtn.innerHTML = '\u2190 <span class="back-to-tags-label">All Tags</span>';
  const results = search(query);
  bookmarkList.render(results);
}

async function handleClearSearch() {
  activeTagFilter = null;
  showTagGrid();
}

// --- Tag filter ---

async function handleTagFilter(tag) {
  activeTagFilter = tag;

  const { tagIndex = {}, bookmarks = {} } = await get(['tagIndex', 'bookmarks']);
  const ids = tagIndex[tag] || [];
  const filtered = ids
    .map(id => bookmarks[id])
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  showBookmarkList();
  backToTagsBtn.innerHTML = `\u2190 <span class="back-to-tags-label">${tag}</span> <span style="color:var(--text-dim)">(${filtered.length})</span>`;
  bookmarkList.render(filtered);
}

// --- Delete confirmation ---

function confirmDelete(bookmark) {
  resetDeleteOverlay();
  pendingDeleteBookmark = bookmark;
  deleteOverlay.querySelector('.delete-title-preview').textContent = bookmark.title;
  deleteOverlay.style.display = 'flex';
}

// --- Import ---

async function handleImport() {
  const preview = await getImportPreview();
  const msg = `Found ${preview.totalBookmarks} bookmarks (${preview.uniqueUrls} unique URLs, ${preview.uniqueTags} tags). Import?`;

  // Simple confirm using the delete overlay pattern
  pendingDeleteBookmark = null;
  const dialog = deleteOverlay.querySelector('.delete-dialog');
  deleteOverlay.querySelector('.delete-message').textContent = msg;
  deleteOverlay.querySelector('.delete-title-preview').textContent = '';
  deleteOverlay.querySelector('.delete-cancel-btn').textContent = 'Cancel';

  const confirmBtn = deleteOverlay.querySelector('.delete-confirm-btn');
  confirmBtn.textContent = 'Import';
  confirmBtn.className = 'delete-confirm-btn import-confirm';

  // Replace confirm handler for import
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  newConfirm.addEventListener('click', async () => {
    newConfirm.textContent = 'Importing...';
    newConfirm.disabled = true;
    await importChromeBookmarks();
    deleteOverlay.style.display = 'none';
    newConfirm.textContent = 'Delete';
    newConfirm.disabled = false;
    newConfirm.className = 'delete-confirm-btn';
    // Restore original handler
    resetDeleteOverlay();
    await refreshMainView();
  });

  deleteOverlay.style.display = 'flex';
}

async function handleImportFile(jsonData) {
  const msg = `Import ${jsonData.length} bookmarks from JSON file?`;

  pendingDeleteBookmark = null;
  deleteOverlay.querySelector('.delete-message').textContent = msg;
  deleteOverlay.querySelector('.delete-title-preview').textContent = '';
  deleteOverlay.querySelector('.delete-cancel-btn').textContent = 'Cancel';

  const confirmBtn = deleteOverlay.querySelector('.delete-confirm-btn');
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  newConfirm.textContent = 'Import';
  newConfirm.className = 'delete-confirm-btn import-confirm';

  newConfirm.addEventListener('click', async () => {
    newConfirm.textContent = 'Importing...';
    newConfirm.disabled = true;
    const result = await importFromJSON(jsonData);
    deleteOverlay.style.display = 'none';
    resetDeleteOverlay();
    await refreshMainView();
  });

  deleteOverlay.style.display = 'flex';
}

function resetDeleteOverlay() {
  const confirmBtn = deleteOverlay.querySelector('.delete-confirm-btn');
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  newConfirm.addEventListener('click', async () => {
    if (pendingDeleteBookmark) {
      await deleteBookmark(pendingDeleteBookmark.id);
      pendingDeleteBookmark = null;
      deleteOverlay.style.display = 'none';
      await refreshMainView();
    }
  });
  deleteOverlay.querySelector('.delete-message').textContent = 'Delete this bookmark?';
  deleteOverlay.querySelector('.delete-cancel-btn').textContent = 'Cancel';
  newConfirm.textContent = 'Delete';
  newConfirm.className = 'delete-confirm-btn';
}

// --- Tag Manager ---

const tagManagerContainer = document.createElement('div');
tagManagerContainer.className = 'tag-manager';
tagManagerContainer.style.display = 'none';
app.appendChild(tagManagerContainer);

function showTagManager() {
  currentView = 'tags';
  mainContainer.style.display = 'none';
  captureForm.element.style.display = 'none';
  tagManagerContainer.style.display = 'flex';
  renderTagManager();
}

async function renderTagManager() {
  const tags = await getAllTags();

  tagManagerContainer.innerHTML = `
    <div class="tag-manager-header">
      <span class="tag-manager-title">Manage Tags</span>
      <button class="tag-manager-close">\u00d7</button>
    </div>
    <div class="tag-manager-list"></div>
  `;

  tagManagerContainer.querySelector('.tag-manager-close').addEventListener('click', () => {
    showMainView();
    refreshMainView();
  });

  const list = tagManagerContainer.querySelector('.tag-manager-list');

  if (tags.length === 0) {
    list.innerHTML = '<div class="bookmark-list-empty">No tags yet</div>';
    return;
  }

  for (const { tag, count, bookmarks } of tags) {
    const row = document.createElement('div');
    row.className = 'tag-manager-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tag-manager-name';
    nameSpan.textContent = tag;

    const countSpan = document.createElement('span');
    countSpan.className = 'tag-manager-count';
    countSpan.textContent = `${bookmarks} bookmark${bookmarks !== 1 ? 's' : ''}`;

    const actions = document.createElement('div');
    actions.className = 'tag-manager-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'bookmark-action-btn';
    renameBtn.textContent = '\u270E';
    renameBtn.title = 'Rename';
    renameBtn.addEventListener('click', () => startRenameTag(row, tag));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bookmark-action-btn bookmark-action-delete';
    deleteBtn.textContent = '\u00d7';
    deleteBtn.title = 'Delete tag from all bookmarks';
    deleteBtn.addEventListener('click', () => confirmDeleteTag(tag));

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(nameSpan);
    row.appendChild(countSpan);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

function startRenameTag(row, oldName) {
  const nameSpan = row.querySelector('.tag-manager-name');
  const currentText = nameSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-rename-input';
  input.value = currentText;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  async function commitRename() {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      await renameTag(oldName, newName);
    }
    await renderTagManager();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      renderTagManager();
    }
  });

  input.addEventListener('blur', commitRename);
}

function confirmDeleteTag(tagName) {
  resetDeleteOverlay();
  pendingDeleteBookmark = null;

  deleteOverlay.querySelector('.delete-message').textContent = `Remove tag "${tagName}" from all bookmarks?`;
  deleteOverlay.querySelector('.delete-title-preview').textContent = 'Bookmarks will not be deleted, only the tag.';

  const confirmBtn = deleteOverlay.querySelector('.delete-confirm-btn');
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  newConfirm.textContent = 'Remove Tag';
  newConfirm.addEventListener('click', async () => {
    await deleteTag(tagName);
    deleteOverlay.style.display = 'none';
    resetDeleteOverlay();
    await renderTagManager();
  });

  deleteOverlay.style.display = 'flex';
}

// --- Keyboard shortcuts ---

document.addEventListener('keydown', (e) => {
  // Handle delete overlay
  if (deleteOverlay.style.display !== 'none') {
    if (e.key === 'Escape') {
      deleteOverlay.style.display = 'none';
      pendingDeleteBookmark = null;
    } else if (e.key === 'Enter') {
      deleteOverlay.querySelector('.delete-confirm-btn').click();
    }
    return;
  }

  // Capture form has its own key handling
  if (currentView === 'capture') return;

  // Tag manager: Escape goes back
  if (currentView === 'tags') {
    if (e.key === 'Escape') {
      showMainView();
      refreshMainView();
    }
    return;
  }

  const searchInput = searchBar.input;
  const searchFocused = document.activeElement === searchInput;
  const searchEmpty = searchInput.value.trim() === '';

  // Speed dial: digit keys when search is not focused, or focused but empty
  if (e.key >= '0' && e.key <= '9' && (!searchFocused || searchEmpty)) {
    // If search is focused and empty, prevent the digit from being typed
    if (searchFocused) {
      e.preventDefault();
    }
    const slot = e.key === '0' ? 0 : parseInt(e.key);
    openSpeedDialSlot(slot);
    return;
  }

  // Arrow keys to navigate
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    if (tagGridVisible) {
      const btns = tagGrid.querySelectorAll('.tag-grid-btn');
      if (btns.length > 0) {
        selectedTagIndex = Math.min(selectedTagIndex + 1, btns.length - 1);
        updateTagGridSelection();
      }
    } else {
      bookmarkList.selectNext();
    }
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    if (tagGridVisible) {
      const btns = tagGrid.querySelectorAll('.tag-grid-btn');
      if (btns.length > 0) {
        selectedTagIndex = Math.max(selectedTagIndex - 1, 0);
        updateTagGridSelection();
      }
    } else {
      bookmarkList.selectPrev();
    }
    return;
  }

  // Enter to open selected tag or bookmark
  if (e.key === 'Enter') {
    if (tagGridVisible && selectedTagIndex >= 0) {
      const btns = tagGrid.querySelectorAll('.tag-grid-btn');
      if (btns[selectedTagIndex]) {
        btns[selectedTagIndex].click();
        e.preventDefault();
        return;
      }
    }
    const opened = bookmarkList.openSelected(e.metaKey || e.ctrlKey);
    if (opened) {
      e.preventDefault();
      return;
    }
  }

  // Cmd/Ctrl+Y to copy selected bookmark URL
  if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
    const url = bookmarkList.getSelectedUrl();
    if (url) {
      e.preventDefault();
      navigator.clipboard.writeText(url);
      return;
    }
  }

  // 'e' to edit selected bookmark (when not in input)
  if (e.key === 'e' && !searchFocused) {
    const edited = bookmarkList.editSelected();
    if (edited) {
      e.preventDefault();
      return;
    }
  }

  // Delete/Backspace to delete selected bookmark (when not in input)
  if ((e.key === 'Delete' || (e.key === 'Backspace' && !searchFocused))) {
    // Only handle when search is not focused
    if (!searchFocused) {
      e.preventDefault();
      // Get selected bookmark via internal method — we need to expose it
      // For now, this is handled through the editSelected pattern
    }
  }

  // Cmd/Ctrl+S to capture current page
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    showCaptureForCurrentTab();
    return;
  }

  // '/' to focus search (when not already in search)
  if (!searchFocused && e.key === '/') {
    e.preventDefault();
    searchBar.focus();
    return;
  }

  // Escape: go back to tag grid if filtered/searching, otherwise let Chrome close the popup
  if (e.key === 'Escape') {
    if (searchFocused || activeTagFilter || !searchEmpty) {
      e.preventDefault();
      searchInput.value = '';
      searchInput.blur();
      activeTagFilter = null;
      showTagGrid();
    }
    return;
  }
});

async function openSpeedDialSlot(slot) {
  const slots = await getSpeedDial();
  const bk = slots[slot];
  if (bk) {
    chrome.tabs.update({ url: bk.url });
    window.close();
  }
}

// --- Refresh ---

async function refreshMainView() {
  await speedDial.render();
  const all = await getAllBookmarks();
  await buildIndex(all);
  showTagGrid();
  await updateCurrentPageIndicator();
}

// --- Init ---

async function init() {
  await initialize();
  showMainView();
  await refreshMainView();
}

init();
