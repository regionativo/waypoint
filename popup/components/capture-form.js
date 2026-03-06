import { saveBookmark, getBookmarkByUrl, getAvailableSpeedDialSlots, deleteBookmark } from '../../lib/bookmarks.js';
import { createTagInput } from './tag-input.js';

export function createCaptureForm({ onSave, onCancel, onDelete }) {
  const form = document.createElement('div');
  form.className = 'capture-form';

  form.innerHTML = `
    <div class="capture-header">
      <span class="capture-title-label">Save Bookmark</span>
      <button class="capture-cancel" title="Cancel (Esc)">\u00d7</button>
    </div>
    <div class="capture-field">
      <label class="capture-label">Title</label>
      <input type="text" class="capture-title-input" placeholder="Title" />
    </div>
    <div class="capture-field">
      <label class="capture-label">URL</label>
      <div class="capture-url"></div>
    </div>
    <div class="capture-field capture-tags-field">
      <label class="capture-label">Tags</label>
    </div>
    <div class="capture-field capture-speed-dial-field">
      <label class="capture-label">Speed Dial Slot</label>
      <select class="capture-speed-dial-select">
        <option value="">None</option>
      </select>
    </div>
    <div class="capture-actions">
      <button class="capture-delete-btn" style="display:none">Delete</button>
      <div class="capture-actions-right">
        <button class="capture-cancel-btn">Cancel</button>
        <button class="capture-save-btn">Save</button>
      </div>
    </div>
  `;

  const titleInput = form.querySelector('.capture-title-input');
  const urlDisplay = form.querySelector('.capture-url');
  const tagsField = form.querySelector('.capture-tags-field');
  const speedDialSelect = form.querySelector('.capture-speed-dial-select');
  const saveBtn = form.querySelector('.capture-save-btn');
  const cancelBtn = form.querySelector('.capture-cancel');
  const cancelBtn2 = form.querySelector('.capture-cancel-btn');
  const deleteBtn = form.querySelector('.capture-delete-btn');

  let currentUrl = '';
  let currentFavIconUrl = '';
  let currentBookmarkId = null; // non-null when editing existing
  let tagInput = null;

  async function populateSpeedDialSelect(currentSlot) {
    const available = await getAvailableSpeedDialSlots();
    speedDialSelect.innerHTML = '<option value="">None</option>';

    const displayOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    for (const slot of displayOrder) {
      if (available.includes(slot) || slot === currentSlot) {
        const opt = document.createElement('option');
        opt.value = slot;
        opt.textContent = `Slot ${slot}`;
        if (slot === currentSlot) opt.selected = true;
        speedDialSelect.appendChild(opt);
      }
    }
  }

  // Populate from the active browser tab (new bookmark or edit if URL exists)
  async function populateFromTab(tab) {
    currentUrl = tab.url || '';
    currentFavIconUrl = tab.favIconUrl || '';
    titleInput.value = tab.title || '';
    urlDisplay.textContent = currentUrl;

    let domain = '';
    try { domain = new URL(currentUrl).hostname.replace(/^www\./, ''); } catch {}

    resetTagInput(domain);

    const existing = await getBookmarkByUrl(currentUrl);
    if (existing) {
      currentBookmarkId = existing.id;
      titleInput.value = existing.title;
      tagInput.setTags(existing.tags);
      currentFavIconUrl = existing.favIconUrl || currentFavIconUrl;
      form.querySelector('.capture-title-label').textContent = 'Edit Bookmark';
      deleteBtn.style.display = '';
      await populateSpeedDialSelect(existing.speedDial);
    } else {
      currentBookmarkId = null;
      form.querySelector('.capture-title-label').textContent = 'Save Bookmark';
      deleteBtn.style.display = 'none';
      await populateSpeedDialSelect(null);
    }

    setTimeout(() => tagInput.focus(), 50);
  }

  // Populate from an existing bookmark object (edit mode)
  async function populateFromBookmark(bk) {
    currentBookmarkId = bk.id;
    currentUrl = bk.url;
    currentFavIconUrl = bk.favIconUrl || '';
    titleInput.value = bk.title;
    urlDisplay.textContent = bk.url;

    let domain = '';
    try { domain = new URL(bk.url).hostname.replace(/^www\./, ''); } catch {}

    resetTagInput(domain);
    tagInput.setTags(bk.tags);

    form.querySelector('.capture-title-label').textContent = 'Edit Bookmark';
    deleteBtn.style.display = '';
    await populateSpeedDialSelect(bk.speedDial);

    setTimeout(() => tagInput.focus(), 50);
  }

  function resetTagInput(domain) {
    const oldTagContainer = tagsField.querySelector('.tag-input-container');
    if (oldTagContainer) oldTagContainer.remove();
    tagInput = createTagInput({ onTagsChange: () => {}, domain });
    tagsField.appendChild(tagInput.element);
  }

  async function handleSave() {
    if (!currentUrl) return;
    const tags = tagInput.getTags();
    const title = titleInput.value.trim() || currentUrl;
    const speedDialValue = speedDialSelect.value;
    const speedDialSlot = speedDialValue === '' ? null : parseInt(speedDialValue);

    await saveBookmark({
      url: currentUrl,
      title,
      tags,
      favIconUrl: currentFavIconUrl,
      speedDialSlot,
    });

    onSave();
  }

  async function handleDelete() {
    if (!currentBookmarkId) return;
    await deleteBookmark(currentBookmarkId);
    onDelete();
  }

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', onCancel);
  cancelBtn2.addEventListener('click', onCancel);
  deleteBtn.addEventListener('click', handleDelete);

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  });

  return {
    element: form,
    populateFromTab,
    populateFromBookmark,
  };
}
