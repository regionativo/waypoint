# Waypoint

A Chrome extension that replaces traditional bookmarks with a tag-based system. No folders, no hierarchy — just tags, fuzzy search, and a speed dial for your most-used sites.

## Features

- **Tag-based organization** — Assign multiple tags to any bookmark. Browse by clicking tags in the popup.
- **Fuzzy search** — Powered by Fuse.js. Matches against titles, URLs, and tags as you type.
- **Speed dial** — Pin up to 10 bookmarks to numbered slots (0-9). Press the digit key to open instantly.
- **Quick capture** — Save the current page with one click or `Cmd+S`. Auto-suggests tags based on domain history.
- **Manage page** — Full-page tag treemap visualization with drill-down. Bulk edit, delete, add/remove tags.
- **Import/Export** — Import from Chrome bookmarks (folders become tags) or from a JSON file. Export to JSON for backup or transfer to another browser.

## Install

1. Clone or download this repo
2. Open `chrome://extensions` and enable **Developer Mode**
3. Click **Load unpacked** and select the `waypoint/` directory
4. Click the Waypoint icon in the toolbar (or press `Cmd+Shift+B`)

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Cmd+Shift+B` | Open popup (global) |
| `/` | Focus search |
| `0-9` | Open speed dial slot |
| `Arrow keys` | Navigate tags or bookmarks |
| `Enter` | Open selected tag or bookmark |
| `Cmd+Enter` | Open bookmark in new tab |
| `Cmd+S` | Save/edit current page |
| `Cmd+Y` | Copy selected bookmark URL |
| `e` | Edit selected bookmark |
| `Escape` | Back to tags / close popup |

## Project Structure

```
waypoint/
├── manifest.json          # Chrome Extension Manifest V3
├── popup/
│   ├── popup.html         # Popup entry point
│   ├── popup.js           # Main popup logic, view switching, shortcuts
│   ├── popup.css
│   └── components/
│       ├── search-bar.js  # Search input + action buttons
│       ├── speed-dial.js  # Pinned bookmarks grid
│       ├── bookmark-list.js # Bookmark results list
│       ├── capture-form.js  # Save/edit bookmark form
│       └── tag-input.js   # Autocomplete tag input
├── manage/
│   ├── manage.html        # Full-page manage/options page
│   ├── manage.js          # Treemap, bulk operations, search
│   └── manage.css
├── lib/
│   ├── storage.js         # chrome.storage.local abstraction
│   ├── bookmarks.js       # CRUD, tag index sync, speed dial
│   ├── tags.js            # Tag suggestions, rename, delete
│   ├── search.js          # Fuse.js index and search
│   └── importer.js        # Chrome bookmarks + JSON import
├── background/
│   └── service-worker.js
├── vendor/
│   └── fuse.min.js        # Vendored Fuse.js
├── styles/
│   └── tokens.css         # Design tokens (colors, spacing, type)
└── icons/
    └── icon-{16,32,48,128}.png
```

## Data Model

Bookmarks are stored in `chrome.storage.local` with denormalized indexes for fast lookups:

- `bookmarks` — `Record<id, Bookmark>` where each bookmark has `id`, `url`, `title`, `tags[]`, `domain`, `speedDial`, `favIconUrl`, `createdAt`, `updatedAt`, `visitCount`
- `tagIndex` — `Record<tag, id[]>` for fast tag filtering
- `tagUsage` — `Record<tag, count>` for suggestion ranking
- `domainTags` — `Record<domain, tag[]>` for domain-based suggestions
- `speedDial` — `(id|null)[10]` array indexed by slot number

## Tech Stack

- Vanilla JS + ES Modules (no framework, no build step)
- [Fuse.js](https://www.fusejs.io/) for fuzzy search (vendored)
- Chrome Extension Manifest V3
- `chrome.storage.local` for persistence

## Development

- Reload the extension after file changes via the reload button on `chrome://extensions`
- Right-click the popup and select **Inspect** to open DevTools
- Inspect storage: `chrome.storage.local.get(null, console.log)` in the popup console

## License

MIT
