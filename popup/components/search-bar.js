// Inline SVG icons (16x16 viewBox)
const ICONS = {
  plus: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  download: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2v8.5M4.5 7.5L8 11l3.5-3.5M3 13h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  folder: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.5h5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

export function createSearchBar({ onSearch, onClear, onCapture, onImport, onImportFile }) {
  const container = document.createElement('div');
  container.className = 'search-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = 'Press / to search...';

  const captureBtn = document.createElement('button');
  captureBtn.className = 'capture-btn';
  captureBtn.innerHTML = ICONS.plus;
  captureBtn.title = 'Save current page (Cmd+S)';

  const importBtn = document.createElement('button');
  importBtn.className = 'import-btn';
  importBtn.innerHTML = ICONS.download;
  importBtn.title = 'Import Chrome bookmarks';

  const importFileBtn = document.createElement('button');
  importFileBtn.className = 'import-btn';
  importFileBtn.innerHTML = ICONS.folder;
  importFileBtn.title = 'Import from JSON file';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) onImportFile(data);
      } catch (err) {
        console.error('Invalid JSON file:', err);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  importFileBtn.addEventListener('click', () => fileInput.click());

  const manageBtn = document.createElement('button');
  manageBtn.className = 'import-btn';
  manageBtn.innerHTML = ICONS.settings;
  manageBtn.title = 'Manage bookmarks';
  manageBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  container.appendChild(input);
  container.appendChild(captureBtn);
  container.appendChild(importBtn);
  container.appendChild(importFileBtn);
  container.appendChild(fileInput);
  container.appendChild(manageBtn);

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) {
      onClear();
      return;
    }
    debounceTimer = setTimeout(() => onSearch(query), 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
      onClear();
    }
  });

  captureBtn.addEventListener('click', onCapture);
  importBtn.addEventListener('click', onImport);

  function setBookmarked(isBookmarked) {
    if (isBookmarked) {
      captureBtn.classList.add('bookmarked');
      captureBtn.innerHTML = ICONS.check;
      captureBtn.title = 'Edit current page bookmark (Cmd+S)';
    } else {
      captureBtn.classList.remove('bookmarked');
      captureBtn.innerHTML = ICONS.plus;
      captureBtn.title = 'Save current page (Cmd+S)';
    }
  }

  return {
    element: container,
    input,
    focus: () => input.focus(),
    clear: () => {
      input.value = '';
      onClear();
    },
    setBookmarked,
  };
}
