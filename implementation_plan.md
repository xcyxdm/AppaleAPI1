# Daily Memo PWA Implementation Plan

## Goal Description
Create a simple, offline-capable Daily Memo PWA for Android. It will allow users to save text notes by date, view past notes, and work offline.

## User Review Required
None.

## Proposed Changes
All files will be created in `DailyMemo/` directory (or root if preferred, I will decide after seeing the file list).

### Core
#### [NEW] [index.html](file:///c%3A/Users/jyo/Documents/MyProject/AppaleAPI1/index.html)
- Main UI with text area, date display, save button, and list of past memos.
- Meta tags for viewport and PWA.

#### [NEW] [style.css](file:///c%3A/Users/jyo/Documents/MyProject/AppaleAPI1/style.css)
- Mobile-first CSS.
- "Calm" design (soft colors, plenty of whitespace).
- Flexbox/Grid for layout.

#### [NEW] [app.js](file:///c%3A/Users/jyo/Documents/MyProject/AppaleAPI1/app.js)
- Handle `DOMContentLoaded`.
- Get today's date and set as active.
- Load existing note for today if any.
- Save note to `localStorage` with key `memo_YYYY-MM-DD`.
- Render list of past memos (keys filtering).
- Register Service Worker.

### PWA
#### [NEW] [manifest.json](file:///c%3A/Users/jyo/Documents/MyProject/AppaleAPI1/manifest.json)
- Name, short_name, start_url, display (standalone), background_color, theme_color, icons.

#### [NEW] [sw.js](file:///c%3A/Users/jyo/Documents/MyProject/AppaleAPI1/sw.js)
- Cache core assets (html, css, js) on install.
- Serve from cache on fetch.

## Verification Plan
### Manual Verification
- Open `index.html` in browser.
- Type a memo, save.
- Reload page, check if memo persists.
- Change date (simulated) or check past memos list logic.
- Verify manifest and SW registration in DevTools.
