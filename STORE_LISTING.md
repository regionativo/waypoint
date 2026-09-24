# Chrome Web Store listing — copy/paste reference

## Category
Productivity

## Single purpose (required field in the Dashboard)
Waypoint lets users save, tag, and quickly reopen bookmarks using fuzzy search and a 10-slot speed dial, replacing folder-based bookmark management.

## Short summary (max 132 characters)
Tag-based bookmark manager with fuzzy search and a 10-slot speed dial. No folders — just tags.

## Detailed description
Waypoint replaces bookmark folders with tags. Save a page once, tag it however you like, and find it again in seconds — by search, by tag, or instantly from a 10-slot speed dial.

FEATURES

★ Tag-based organization — Assign multiple tags to any bookmark instead of filing it into a single folder. Browse by clicking any tag.

★ Fuzzy search — Powered by Fuse.js, matches against titles, URLs, and tags as you type, so a typo or partial word still finds the right page.

★ Speed dial — Pin your 10 most-used sites to numbered slots. Press a digit key to open one instantly.

★ Quick capture — Save the page you're on with one click or a keyboard shortcut. Waypoint suggests tags based on your tagging history for that domain.

★ Manage page — A full-page view with a tag treemap, bulk edit, and bulk delete for cleaning up your bookmark collection.

★ Import & export — Bring in your existing Chrome bookmarks (folders become tags) or a JSON backup, and export everything to JSON at any time.

Everything is stored locally in your browser — Waypoint doesn't require an account and doesn't sync your data to any server.

## Permission justifications (Dashboard → Privacy practices)

**storage**
Stores all bookmarks, tags, and settings locally on the device using chrome.storage.local. Required for the extension's core function.

**bookmarks**
Used only when the user explicitly runs "Import from Chrome Bookmarks" on the Manage page, to read (never modify) the existing Chrome bookmark tree and copy entries into Waypoint's tag system.

**activeTab**
Used to read the URL, title, and favicon of the page the user is currently viewing, so it can be saved as a bookmark via the popup capture form or the "save current page" keyboard shortcut.

**favicon**
Used to read site icons from Chrome's local favicon cache (chrome-extension://<id>/_favicon/) so bookmark icons can be displayed without a network request, falling back to a remote favicon service only when no cached icon exists.

**host permission: https://www.google.com/***
Used solely to fetch favicon images from Google's public favicon service (https://www.google.com/s2/favicons) as a fallback when a site's icon isn't in Chrome's local favicon cache. Only the bookmarked page's domain is sent in this request.

## Remote code / privacy disclosures (Dashboard checkboxes)
- Does this item use remote code? **No** — all JS ships in the package (Fuse.js is vendored, not loaded from a CDN).
- Data collected: **Web history is NOT collected** in the CWS sense (no data leaves the device except the domain sent to Google's favicon endpoint, disclosed above). If the Dashboard's data-usage form requires a category, select **"Website content"** limited to domain names, and check "not sold to third parties" / "not used for purposes unrelated to the item's core functionality" / "not used to determine creditworthiness or for lending purposes".
- Privacy policy URL: link to `PRIVACY_POLICY.md` in this repo, e.g.
  `https://github.com/regionativo/waypoint/blob/main/PRIVACY_POLICY.md`
  (push this commit first, or host it via GitHub Pages for a cleaner URL.)

## Assets still needed before submission
- [ ] At least 1 screenshot, 1280x800 or 640x400 (up to 5)
- [ ] Store icon 128x128 — already have `icons/icon-128.png`, reuse it
- [ ] Optional: small promo tile 440x280, marquee 1400x560
