import { incrementVisitCount, deleteBookmark } from '../../lib/bookmarks.js';

export function createBookmarkList({ onTagClick, onEdit, onDelete }) {
  const container = document.createElement('div');
  container.className = 'bookmark-list';

  let currentBookmarks = [];
  let selectedIndex = -1;

  function updateSelection() {
    const items = container.querySelectorAll('.bookmark-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
    if (selectedIndex >= 0 && items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function selectNext() {
    if (currentBookmarks.length === 0) return;
    selectedIndex = Math.min(selectedIndex + 1, currentBookmarks.length - 1);
    updateSelection();
  }

  function selectPrev() {
    if (currentBookmarks.length === 0) return;
    selectedIndex = Math.max(selectedIndex - 1, -1);
    updateSelection();
  }

  function openSelected(newTab = false) {
    if (selectedIndex < 0 || selectedIndex >= currentBookmarks.length) return false;
    const bk = currentBookmarks[selectedIndex];
    incrementVisitCount(bk.id);
    if (newTab) {
      chrome.tabs.create({ url: bk.url });
    } else {
      chrome.tabs.update({ url: bk.url });
      window.close();
    }
    return true;
  }

  function editSelected() {
    if (selectedIndex < 0 || selectedIndex >= currentBookmarks.length) return false;
    onEdit(currentBookmarks[selectedIndex]);
    return true;
  }

  function clearSelection() {
    selectedIndex = -1;
    updateSelection();
  }

  function render(bookmarks) {
    container.innerHTML = '';
    currentBookmarks = bookmarks;
    selectedIndex = -1;

    const label = document.createElement('div');
    label.className = 'bookmark-list-section-label';
    label.innerHTML = '<span class="bookmark-list-section-dot"></span> BOOKMARKS';
    container.appendChild(label);

    if (bookmarks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bookmark-list-empty';
      empty.textContent = 'No bookmarks yet. Click + to save your first one.';
      container.appendChild(empty);
      return;
    }

    for (const bk of bookmarks) {
      const item = document.createElement('div');
      item.className = 'bookmark-item';

      const favicon = document.createElement('img');
      favicon.className = 'bookmark-favicon';
      favicon.src = bk.favIconUrl || `https://www.google.com/s2/favicons?domain=${bk.domain}&sz=16`;
      favicon.width = 16;
      favicon.height = 16;
      favicon.alt = '';
      favicon.onerror = () => { favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="%234fc3f7" width="16" height="16" rx="3"/></svg>'; };

      const info = document.createElement('div');
      info.className = 'bookmark-info';

      const title = document.createElement('span');
      title.className = 'bookmark-title';
      title.textContent = bk.title;
      title.title = bk.url;

      const tags = document.createElement('div');
      tags.className = 'bookmark-tags';
      for (const tag of bk.tags.slice(0, 3)) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-small';
        chip.textContent = tag;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          onTagClick(tag);
        });
        tags.appendChild(chip);
      }
      if (bk.tags.length > 3) {
        const more = document.createElement('span');
        more.className = 'tag-chip-more';
        more.textContent = `+${bk.tags.length - 3}`;
        tags.appendChild(more);
      }

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'bookmark-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'bookmark-action-btn';
      editBtn.textContent = '\u270E'; // pencil
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onEdit(bk);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'bookmark-action-btn bookmark-action-delete';
      deleteBtn.textContent = '\u00d7';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete(bk);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      info.appendChild(title);
      info.appendChild(tags);

      item.appendChild(favicon);
      item.appendChild(info);
      item.appendChild(actions);

      // Click to open
      item.addEventListener('click', (e) => {
        incrementVisitCount(bk.id);
        if (e.ctrlKey || e.metaKey) {
          chrome.tabs.create({ url: bk.url });
        } else {
          chrome.tabs.update({ url: bk.url });
          window.close();
        }
      });

      item.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          incrementVisitCount(bk.id);
          chrome.tabs.create({ url: bk.url, active: false });
        }
      });

      container.appendChild(item);
    }
  }

  function getSelectedUrl() {
    if (selectedIndex < 0 || selectedIndex >= currentBookmarks.length) return null;
    return currentBookmarks[selectedIndex].url;
  }

  return { element: container, render, selectNext, selectPrev, openSelected, editSelected, clearSelection, getSelectedUrl };
}
