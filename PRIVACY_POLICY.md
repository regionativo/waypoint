# Waypoint Privacy Policy

_Last updated: 2026-09-24_

Waypoint is a Chrome extension that replaces bookmark folders with tags, fuzzy search, and a speed dial. This policy explains what data it handles.

## Data storage

All bookmarks, tags, and settings you create in Waypoint are stored locally on your device using Chrome's `storage.local` API. This data is never transmitted to Waypoint's developer or to any third-party server, and it is not synced to any account.

## Third-party requests

To display site icons, Waypoint requests favicons from two sources:

- **Chrome's built-in favicon cache** (`chrome-extension://<id>/_favicon/`), served locally by the browser from your existing browsing history.
- **Google's public favicon service** (`https://www.google.com/s2/favicons`), used as a fallback when Chrome has no cached icon. This sends the domain (e.g. `example.com`) of the bookmarked page to Google to retrieve its icon. No other bookmark data — title, tags, or full URL — is sent. See [Google's privacy policy](https://policies.google.com/privacy) for how Google handles that request.

Waypoint does not use any analytics, telemetry, or advertising services.

## Chrome bookmarks permission

If you choose to use the "Import from Chrome Bookmarks" feature, Waypoint reads your existing Chrome bookmarks (via the `bookmarks` permission) to copy them into Waypoint's tag system. This is read-only — Waypoint never modifies or deletes your native Chrome bookmarks — and only runs when you explicitly trigger an import.

## Data export and deletion

You can export all Waypoint data to a JSON file at any time from the Manage page, and delete it entirely by removing the extension, which clears its local storage.

## Contact

Questions about this policy can be directed to the developer via the [GitHub repository](https://github.com/regionativo/waypoint).
