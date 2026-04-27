import { initialize } from '../lib/storage.js';
import { getAllBookmarks, getSpeedDial, deleteBookmark, getBookmarkByUrl, setSpeedDialSlot } from '../lib/bookmarks.js';
import { buildIndex, search } from '../lib/search.js';
import { renameTag, deleteTag, getAllTags } from '../lib/tags.js';
import { createSearchBar } from './components/search-bar.js';
import { createSpeedDial } from './components/speed-dial.js';
import { createBookmarkList } from './components/bookmark-list.js';
import { createCaptureForm } from './components/capture-form.js';
import { get } from '../lib/storage.js';
import { loadTheme } from '../lib/theme.js';

const app = document.getElementById('app');
let currentView = 'main'; // 'main' | 'capture'
let activeTagFilter = null;
let speedDialVisible = false;

// --- Components ---

const searchBar = createSearchBar({
  onSearch: handleSearch,
  onClear: handleClearSearch,
  onCapture: showCaptureForCurrentTab,
  onSpeedDialToggle: () => toggleSpeedDial(),
});

const speedDial = createSpeedDial({
  onEdit: showEditForm,
  onEmptySlotClick: showSlotPicker,
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

// Slot picker overlay
let slotPickerTarget = -1;
let slotPickerAllBookmarks = [];

const slotPickerOverlay = document.createElement('div');
slotPickerOverlay.className = 'slot-picker-overlay';
slotPickerOverlay.style.display = 'none';
slotPickerOverlay.innerHTML = `
  <div class="slot-picker-dialog">
    <div class="slot-picker-header">
      <span class="slot-picker-title">Assign to slot <strong id="slot-picker-num"></strong></span>
      <button class="slot-picker-close">&times;</button>
    </div>
    <input type="text" class="slot-picker-input" id="slot-picker-input" placeholder="Search bookmarks...">
    <div class="slot-picker-results" id="slot-picker-results"></div>
  </div>
`;

slotPickerOverlay.querySelector('.slot-picker-close').addEventListener('click', hideSlotPicker);
slotPickerOverlay.addEventListener('click', (e) => {
  if (e.target === slotPickerOverlay) hideSlotPicker();
});

const slotPickerInput = slotPickerOverlay.querySelector('#slot-picker-input');
const slotPickerResults = slotPickerOverlay.querySelector('#slot-picker-results');
const slotPickerNum = slotPickerOverlay.querySelector('#slot-picker-num');

slotPickerInput.addEventListener('input', () => renderSlotPickerResults(slotPickerInput.value.trim()));
slotPickerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.stopPropagation(); hideSlotPicker(); }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const first = slotPickerResults.querySelector('.slot-picker-item');
    if (first) first.focus();
  }
});

function hideSlotPicker() {
  slotPickerOverlay.style.display = 'none';
  slotPickerTarget = -1;
}

async function showSlotPicker(slotIndex) {
  slotPickerTarget = slotIndex;
  slotPickerNum.textContent = slotIndex;
  slotPickerInput.value = '';
  slotPickerAllBookmarks = await getAllBookmarks();
  renderSlotPickerResults('');
  slotPickerOverlay.style.display = 'flex';
  slotPickerInput.focus();
}

function renderSlotPickerResults(query) {
  const q = query.toLowerCase();
  const matches = q
    ? slotPickerAllBookmarks.filter(bk =>
        bk.title.toLowerCase().includes(q) ||
        bk.url.toLowerCase().includes(q) ||
        bk.tags.some(t => t.includes(q))
      )
    : slotPickerAllBookmarks;

  slotPickerResults.innerHTML = '';

  if (matches.length === 0) {
    slotPickerResults.innerHTML = '<div class="slot-picker-empty">No bookmarks found</div>';
    return;
  }

  for (const bk of matches.slice(0, 30)) {
    const item = document.createElement('button');
    item.className = 'slot-picker-item';

    const img = document.createElement('img');
    img.src = bk.favIconUrl || `https://www.google.com/s2/favicons?domain=${bk.domain}&sz=16`;
    img.width = 16; img.height = 16;
    img.className = bk.faviconLight ? 'favicon-light' : '';
    img.onerror = () => { img.style.display = 'none'; };

    const text = document.createElement('span');
    text.className = 'slot-picker-item-title';
    text.textContent = bk.title;

    const domain = document.createElement('span');
    domain.className = 'slot-picker-item-domain';
    domain.textContent = bk.domain;

    item.appendChild(img);
    item.appendChild(text);
    item.appendChild(domain);

    item.addEventListener('click', async () => {
      const slot = slotPickerTarget;
      hideSlotPicker();
      await setSpeedDialSlot(bk.id, slot);
      await speedDial.render();
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); (item.nextElementSibling || item).focus(); }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        item.previousElementSibling ? item.previousElementSibling.focus() : slotPickerInput.focus();
      }
    });

    slotPickerResults.appendChild(item);
  }
}

// --- Layout ---

const mainContainer = document.createElement('div');
mainContainer.id = 'main-view';

const recentSection = document.createElement('div');
recentSection.className = 'recent-section';

mainContainer.appendChild(searchBar.element);
mainContainer.appendChild(speedDial.element);
mainContainer.appendChild(recentSection);
mainContainer.appendChild(tagGrid);
mainContainer.appendChild(backToTagsBtn);
mainContainer.appendChild(bookmarkList.element);

app.appendChild(mainContainer);
app.appendChild(captureForm.element);
app.appendChild(deleteOverlay);
app.appendChild(slotPickerOverlay);
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
let selectedRecentIndex = -1;
let recentBookmarks = [];
let tagGridVisible = false;

function showTagGrid() {
  tagGrid.style.display = 'flex';
  backToTagsBtn.style.display = 'none';
  bookmarkList.element.style.display = 'none';
  recentSection.style.display = '';
  tagGridVisible = true;
  selectedTagIndex = -1;
  selectedRecentIndex = -1;
  renderTagGrid();
}

function showBookmarkList() {
  tagGrid.style.display = 'none';
  backToTagsBtn.style.display = 'flex';
  bookmarkList.element.style.display = 'block';
  recentSection.style.display = 'none';
  tagGridVisible = false;
  selectedTagIndex = -1;
  selectedRecentIndex = -1;
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
  bookmarkList.render(results, true);
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

document.addEventListener('keydown', async (e) => {
  // Handle slot picker
  if (slotPickerOverlay.style.display !== 'none') {
    if (e.key === 'Escape') hideSlotPicker();
    return;
  }

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
      // Flow: recents → tags
      if (selectedRecentIndex < recentBookmarks.length - 1 && recentBookmarks.length > 0) {
        // Still navigating within recents
        if (selectedTagIndex >= 0) {
          // Already in tags, continue in tags
          const btns = tagGrid.querySelectorAll('.tag-grid-btn');
          if (btns.length > 0) {
            selectedTagIndex = Math.min(selectedTagIndex + 1, btns.length - 1);
            updateTagGridSelection();
          }
        } else {
          selectedRecentIndex++;
          updateRecentSelection();
        }
      } else if (selectedTagIndex < 0) {
        // Move from recents to tags
        selectedRecentIndex = -1;
        updateRecentSelection();
        const btns = tagGrid.querySelectorAll('.tag-grid-btn');
        if (btns.length > 0) {
          selectedTagIndex = 0;
          updateTagGridSelection();
        }
      } else {
        // Navigate within tags
        const btns = tagGrid.querySelectorAll('.tag-grid-btn');
        if (btns.length > 0) {
          selectedTagIndex = Math.min(selectedTagIndex + 1, btns.length - 1);
          updateTagGridSelection();
        }
      }
    } else {
      bookmarkList.selectNext();
    }
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    if (tagGridVisible) {
      if (selectedTagIndex > 0) {
        // Navigate within tags
        selectedTagIndex--;
        updateTagGridSelection();
      } else if (selectedTagIndex === 0) {
        // Move from tags back to recents
        selectedTagIndex = -1;
        updateTagGridSelection();
        if (recentBookmarks.length > 0) {
          selectedRecentIndex = recentBookmarks.length - 1;
          updateRecentSelection();
        }
      } else if (selectedRecentIndex > 0) {
        // Navigate within recents
        selectedRecentIndex--;
        updateRecentSelection();
      } else if (selectedRecentIndex === 0) {
        selectedRecentIndex = -1;
        updateRecentSelection();
      }
    } else {
      bookmarkList.selectPrev();
    }
    return;
  }

  // Enter to open selected recent, tag, or bookmark
  if (e.key === 'Enter') {
    if (selectedRecentIndex >= 0 && selectedRecentIndex < recentBookmarks.length) {
      e.preventDefault();
      chrome.tabs.create({ url: recentBookmarks[selectedRecentIndex].url });
      return;
    }
    if (tagGridVisible && selectedTagIndex >= 0) {
      const btns = tagGrid.querySelectorAll('.tag-grid-btn');
      if (btns[selectedTagIndex]) {
        btns[selectedTagIndex].click();
        e.preventDefault();
        return;
      }
    }
    const opened = bookmarkList.openSelected();
    if (opened) {
      e.preventDefault();
      return;
    }
  }

  // 'y' to yank (copy) selected bookmark URL
  if (e.key === 'y' && !searchFocused && !e.metaKey && !e.ctrlKey) {
    const url = getSelectedUrl();
    if (url) {
      e.preventDefault();
      navigator.clipboard.writeText(url);
      showYankFeedback();
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

  // Tab to toggle speed dial (when search is empty)
  if (e.key === 'Tab' && searchEmpty) {
    e.preventDefault();
    await toggleSpeedDial();
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

async function toggleSpeedDial() {
  speedDialVisible = !speedDialVisible;
  if (speedDialVisible) {
    await speedDial.render();
    // render() hides itself when no filled slots; respect that
    speedDialVisible = speedDial.element.style.display !== 'none';
  } else {
    speedDial.element.style.display = 'none';
  }
  searchBar.setSpeedDialActive(speedDialVisible);
}

async function openSpeedDialSlot(slot) {
  const slots = await getSpeedDial();
  const bk = slots[slot];
  if (bk) {
    chrome.tabs.create({ url: bk.url });
  }
}

// --- Yank feedback ---

function showYankFeedback() {
  let toast = document.querySelector('.yank-toast');
  if (toast) toast.remove();
  toast = document.createElement('div');
  toast.className = 'yank-toast';
  toast.textContent = 'URL copied';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1200);
}

// --- Recent bookmarks ---

function updateRecentSelection() {
  const items = recentSection.querySelectorAll('.recent-item');
  items.forEach((item, i) => item.classList.toggle('selected', i === selectedRecentIndex));
  if (selectedRecentIndex >= 0 && items[selectedRecentIndex]) {
    items[selectedRecentIndex].scrollIntoView({ block: 'nearest' });
  }
}

function getSelectedUrl() {
  // Check recents first, then bookmark list
  if (selectedRecentIndex >= 0 && selectedRecentIndex < recentBookmarks.length) {
    return recentBookmarks[selectedRecentIndex].url;
  }
  return bookmarkList.getSelectedUrl();
}

async function renderRecent() {
  const all = await getAllBookmarks();
  recentBookmarks = all
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  recentSection.innerHTML = '';
  selectedRecentIndex = -1;

  if (recentBookmarks.length === 0) return;

  const label = document.createElement('div');
  label.className = 'recent-section-label';
  label.innerHTML = '<span class="recent-section-dot"></span> RECENT';
  recentSection.appendChild(label);

  const list = document.createElement('div');
  list.className = 'recent-list';

  for (const bk of recentBookmarks) {
    const item = document.createElement('a');
    item.className = 'recent-item';
    item.href = bk.url;
    item.title = bk.url;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: bk.url });
    });
    item.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        chrome.tabs.create({ url: bk.url, active: false });
      }
    });

    const favicon = document.createElement('img');
    favicon.className = `recent-favicon${bk.faviconLight ? ' favicon-light' : ''}`;
    favicon.src = bk.favIconUrl || `https://www.google.com/s2/favicons?domain=${bk.domain}&sz=16`;
    favicon.width = 16;
    favicon.height = 16;
    favicon.alt = '';
    favicon.onerror = () => { favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="%234fc3f7" width="16" height="16" rx="3"/></svg>'; };

    const title = document.createElement('span');
    title.className = 'recent-title';
    title.textContent = bk.title;

    item.appendChild(favicon);
    item.appendChild(title);
    list.appendChild(item);
  }

  recentSection.appendChild(list);
}

// --- Refresh ---

async function refreshMainView() {
  await speedDial.render();
  if (!speedDialVisible) speedDial.element.style.display = 'none';
  const all = await getAllBookmarks();
  await buildIndex(all);
  await renderRecent();
  showTagGrid();
  await updateCurrentPageIndicator();
}

// --- Init ---

async function init() {
  await initialize();
  await loadTheme();
  showMainView();
  await refreshMainView();
  searchBar.focus();
}

init();
