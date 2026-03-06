# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Waypoint

Waypoint is a Chrome browser extension (Manifest V3) that replaces traditional bookmarks with a tag-based system featuring fuzzy search and a 10-slot speed dial.

## Tech Stack
- Vanilla JS + ES Modules (no framework, no build step)
- Fuse.js (vendored) for fuzzy search
- chrome.storage.local for persistence

## Development
- Load unpacked at `chrome://extensions` (enable Developer Mode)
- Reload extension after file changes via the reload button on the extensions page
- Right-click popup → Inspect to open DevTools for debugging
- Debug storage: `chrome.storage.local.get(null, console.log)` in popup DevTools console

## Architecture
- `lib/` — data layer (storage abstraction, bookmark CRUD, tag index, search, import)
- `popup/` — UI layer (popup.html entry point, component modules)
- `popup/components/` — reusable UI components (speed-dial, search-bar, capture-form, tag-input, bookmark-list)
- `background/` — service worker (minimal, for future use)
- `vendor/` — Fuse.js (vendored, do not modify)
- Storage abstraction in `lib/storage.js` wraps chrome.storage.local for future sync migration

## Conventions
- Tags are lowercase, hyphenated, max 30 chars (normalized via `lib/tags.js:normalizeTag`)
- Bookmark IDs: `bk_{timestamp}_{hex}`
- All storage writes go through `lib/bookmarks.js` to keep denormalized indexes in sync
- No folders — tags only
