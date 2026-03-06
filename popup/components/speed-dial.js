import { getSpeedDial, incrementVisitCount, setSpeedDialSlot } from '../../lib/bookmarks.js';

export function createSpeedDial({ onEdit }) {
  const container = document.createElement('div');
  container.className = 'speed-dial';

  async function render() {
    const slots = await getSpeedDial();
    container.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'speed-dial-section-label';
    label.innerHTML = '<span class="speed-dial-section-dot"></span> SPEED DIAL';
    container.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'speed-dial-grid';

    const displayOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    for (const num of displayOrder) {
      const slot = slots[num];
      if (!slot) continue;

      const tile = document.createElement('div');
      tile.className = 'speed-dial-tile filled';

      const label = document.createElement('span');
      label.className = 'speed-dial-label';
      label.textContent = num;

      const favicon = document.createElement('img');
      favicon.className = 'speed-dial-favicon';
      favicon.src = slot.favIconUrl || `https://www.google.com/s2/favicons?domain=${slot.domain}&sz=16`;
      favicon.width = 16;
      favicon.height = 16;
      favicon.alt = '';
      favicon.onerror = () => { favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="%234fc3f7" width="16" height="16" rx="3"/></svg>'; };

      const title = document.createElement('span');
      title.className = 'speed-dial-title';
      title.textContent = slot.title;
      title.title = `${slot.title}\n${slot.url}\nRight-click for options`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'speed-dial-remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.title = 'Remove from speed dial';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await setSpeedDialSlot(slot.id, null);
        await render();
      });

      tile.appendChild(label);
      tile.appendChild(favicon);
      tile.appendChild(title);
      tile.appendChild(removeBtn);

      tile.addEventListener('click', () => {
        incrementVisitCount(slot.id);
        chrome.tabs.update({ url: slot.url });
        window.close();
      });

      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onEdit(slot);
      });

      grid.appendChild(tile);
    }

    if (grid.children.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';
    container.appendChild(grid);
  }

  return { element: container, render };
}
