import { getSpeedDial, incrementVisitCount, setSpeedDialSlot } from '../../lib/bookmarks.js';

export function createSpeedDial({ onEdit, onEmptySlotClick }) {
  const container = document.createElement('div');
  container.className = 'speed-dial';

  let draggedSlot = -1;

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
      const tile = document.createElement('div');

      if (!slot) {
        tile.className = 'speed-dial-tile empty';

        const emptyLabel = document.createElement('span');
        emptyLabel.className = 'speed-dial-label';
        emptyLabel.textContent = num;
        tile.appendChild(emptyLabel);

        const plusIcon = document.createElement('span');
        plusIcon.className = 'speed-dial-empty-plus';
        plusIcon.textContent = '+';
        tile.appendChild(plusIcon);

        tile.addEventListener('click', () => onEmptySlotClick(num));

        tile.addEventListener('dragover', (e) => {
          if (draggedSlot === -1) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          tile.classList.add('drag-over');
        });
        tile.addEventListener('dragleave', () => tile.classList.remove('drag-over'));
        tile.addEventListener('drop', async (e) => {
          e.preventDefault();
          tile.classList.remove('drag-over');
          if (draggedSlot === -1 || draggedSlot === num) return;
          const srcBk = slots[draggedSlot];
          draggedSlot = -1;
          await setSpeedDialSlot(srcBk.id, num);
          await render();
        });

        grid.appendChild(tile);
        continue;
      }

      tile.className = 'speed-dial-tile filled';
      tile.draggable = true;

      const slotLabel = document.createElement('span');
      slotLabel.className = 'speed-dial-label';
      slotLabel.textContent = num;

      const favicon = document.createElement('img');
      favicon.className = `speed-dial-favicon${slot.faviconLight ? ' favicon-light' : ''}`;
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

      tile.appendChild(slotLabel);
      tile.appendChild(favicon);
      tile.appendChild(title);
      tile.appendChild(removeBtn);

      // Drag events
      tile.addEventListener('dragstart', (e) => {
        draggedSlot = num;
        e.dataTransfer.effectAllowed = 'move';
        // Defer so the tile isn't already hidden when ghost is captured
        requestAnimationFrame(() => tile.classList.add('dragging'));
      });
      tile.addEventListener('dragend', () => {
        draggedSlot = -1;
        tile.classList.remove('dragging');
        grid.querySelectorAll('.drag-over').forEach(t => t.classList.remove('drag-over'));
      });
      tile.addEventListener('dragover', (e) => {
        if (draggedSlot === -1 || draggedSlot === num) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        grid.querySelectorAll('.drag-over').forEach(t => t.classList.remove('drag-over'));
        tile.classList.add('drag-over');
      });
      tile.addEventListener('dragleave', () => tile.classList.remove('drag-over'));
      tile.addEventListener('drop', async (e) => {
        e.preventDefault();
        tile.classList.remove('drag-over');
        if (draggedSlot === -1 || draggedSlot === num) return;
        const srcSlot = draggedSlot;
        const srcBk = slots[srcSlot];
        const dstBk = slot; // this tile's bookmark
        draggedSlot = -1;
        // Swap: move src to dst slot, then dst to src slot
        await setSpeedDialSlot(srcBk.id, num);
        await setSpeedDialSlot(dstBk.id, srcSlot);
        await render();
      });

      tile.addEventListener('click', () => {
        incrementVisitCount(slot.id);
        chrome.tabs.create({ url: slot.url });
      });
      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onEdit(slot);
      });

      grid.appendChild(tile);
    }

    const hasFilled = slots.some(Boolean);
    if (!hasFilled) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';
    container.appendChild(grid);
  }

  return { element: container, render };
}
