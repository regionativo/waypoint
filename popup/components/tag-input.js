import { getTagSuggestions } from '../../lib/tags.js';

export function createTagInput({ onTagsChange, domain = null }) {
  const container = document.createElement('div');
  container.className = 'tag-input-container';

  const tagsDisplay = document.createElement('div');
  tagsDisplay.className = 'tag-input-tags';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-input-field';
  input.placeholder = 'Add tags...';
  input.autocomplete = 'off';

  const suggestions = document.createElement('div');
  suggestions.className = 'tag-suggestions';
  suggestions.style.display = 'none';

  const inputRow = document.createElement('div');
  inputRow.className = 'tag-input-row';
  inputRow.appendChild(tagsDisplay);
  inputRow.appendChild(input);

  container.appendChild(inputRow);
  container.appendChild(suggestions);

  let currentTags = [];
  let selectedSuggestionIndex = -1;

  function renderTags() {
    tagsDisplay.innerHTML = '';
    for (const tag of currentTags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;

      const remove = document.createElement('button');
      remove.className = 'tag-chip-remove';
      remove.textContent = '\u00d7';
      remove.addEventListener('click', () => {
        currentTags = currentTags.filter(t => t !== tag);
        renderTags();
        onTagsChange(currentTags);
        input.focus();
      });

      chip.appendChild(remove);
      tagsDisplay.appendChild(chip);
    }
  }

  function addTag(tag) {
    const normalized = tag.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 30);
    if (normalized && !currentTags.includes(normalized)) {
      currentTags.push(normalized);
      renderTags();
      onTagsChange(currentTags);
    }
    input.value = '';
    hideSuggestions();
  }

  function hideSuggestions() {
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
    selectedSuggestionIndex = -1;
  }

  async function showSuggestions(partial) {
    const results = await getTagSuggestions(partial, domain);
    const filtered = results.filter(t => !currentTags.includes(t));

    if (filtered.length === 0) {
      hideSuggestions();
      return;
    }

    suggestions.innerHTML = '';
    selectedSuggestionIndex = -1;

    for (let i = 0; i < filtered.length; i++) {
      const item = document.createElement('div');
      item.className = 'tag-suggestion-item';
      item.textContent = filtered[i];
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addTag(filtered[i]);
      });
      suggestions.appendChild(item);
    }

    suggestions.style.display = 'block';
  }

  function updateSuggestionHighlight() {
    const items = suggestions.querySelectorAll('.tag-suggestion-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedSuggestionIndex);
    });
  }

  input.addEventListener('input', () => {
    showSuggestions(input.value);
  });

  input.addEventListener('focus', () => {
    if (input.value || currentTags.length === 0) {
      showSuggestions(input.value);
    }
  });

  input.addEventListener('blur', () => {
    // Delay to allow click on suggestion
    setTimeout(hideSuggestions, 150);
  });

  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.tag-suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
      updateSuggestionHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
      updateSuggestionHighlight();
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
        e.preventDefault();
        addTag(items[selectedSuggestionIndex].textContent);
      } else if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        addTag(input.value);
      }
    } else if (e.key === 'Backspace' && !input.value && currentTags.length > 0) {
      currentTags.pop();
      renderTags();
      onTagsChange(currentTags);
    }
  });

  // Click on input row focuses the input
  inputRow.addEventListener('click', () => input.focus());

  return {
    element: container,
    input,
    getTags: () => [...currentTags],
    setTags: (tags) => {
      currentTags = [...tags];
      renderTags();
    },
    focus: () => input.focus(),
    clear: () => {
      currentTags = [];
      input.value = '';
      renderTags();
      hideSuggestions();
    },
  };
}
