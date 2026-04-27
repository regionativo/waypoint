// Inline SVG icons (16x16 viewBox)
const ICONS = {
  plus: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  grid: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,
};

export function createSearchBar({ onSearch, onClear, onCapture, onSpeedDialToggle }) {
  const container = document.createElement('div');
  container.className = 'search-bar';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'search-input-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = 'Search bookmarks...';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'search-clear-btn';
  clearBtn.innerHTML = '&times;';
  clearBtn.title = 'Clear search';
  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    onClear();
  });

  inputWrap.appendChild(input);
  inputWrap.appendChild(clearBtn);

  const captureBtn = document.createElement('button');
  captureBtn.className = 'capture-btn';
  captureBtn.innerHTML = ICONS.plus;
  captureBtn.title = 'Save current page (Cmd+S)';

  const speedDialBtn = document.createElement('button');
  speedDialBtn.className = 'speed-dial-toggle-btn';
  speedDialBtn.innerHTML = ICONS.grid;
  speedDialBtn.title = 'Toggle speed dial (Tab)';
  speedDialBtn.addEventListener('click', () => {
    if (onSpeedDialToggle) onSpeedDialToggle();
  });

  const manageBtn = document.createElement('button');
  manageBtn.className = 'import-btn';
  manageBtn.innerHTML = ICONS.settings;
  manageBtn.title = 'Manage bookmarks';
  manageBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  container.appendChild(inputWrap);
  container.appendChild(captureBtn);
  container.appendChild(speedDialBtn);
  container.appendChild(manageBtn);

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    clearBtn.style.display = query ? 'flex' : 'none';
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

  function setSpeedDialActive(active) {
    speedDialBtn.classList.toggle('active', active);
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
    setSpeedDialActive,
  };
}
