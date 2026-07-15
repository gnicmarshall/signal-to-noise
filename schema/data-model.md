# Signal to Noise — Data Model

Backend: Google Sheets (`Signal - Noise DB`)
https://docs.google.com/spreadsheets/d/1nZLpc-axRgs-YH-egqYFHtjdx40KE8oXskA_O2LJHRU

## ID convention
All `id` fields are Unix millisecond timestamps generated at creation time. They serve as primary keys and sort-order proxies. No auto-increment — IDs are set client-side at the moment of record creation.

---

## Tab 2 — Routines (Morning Tasks)

| Column | Type | Notes |
|---|---|---|
| `id` | number (ms timestamp) | Primary key |
| `text` | string | Task label |
| `category` | string | e.g. `morning` |
| `completedDate` | date string (YYYY-MM-DD) or blank | Blank = not completed today |

---

## Tab 3 — Todos (Active Tasks)

| Column | Type | Notes |
|---|---|---|
| `id` | number (ms timestamp) | Primary key |
| `text` | string | Task description |
| `completed` | 0 or 1 | Boolean as integer |
| `createdAt` | number (ms timestamp) | Creation time |
| `source` | string | `manual` or `confluence` (planned) |
| `confluenceTaskId` | string or blank | ID of linked Confluence task |

---

## Tab 4 — Notes / Journal

| Column | Type | Notes |
|---|---|---|
| `id` | number (ms timestamp) | Primary key |
| `text` | string | Note body |
| `timestamp` | number (ms timestamp) | Creation time |

Currently no data rows.

---

## Tab 5 — Signals

| Column | Type | Notes |
|---|---|---|
| `id` | number (ms timestamp) | Primary key |
| `text` | string | Signal description |
| `source` | string | `manual` or `confluence` (planned) |
| `status` | string | `signal`, `done`, `do` |
| `createdAt` | number (ms timestamp) | Creation time |
| `confluenceTaskId` | string or blank | Linked Confluence task ID |
| `pageTitle` | string or blank | Confluence page title |
| `pageUrl` | string or blank | Confluence page URL |

### Status values
- `signal` — active, important item
- `do` — queued/in progress
- `done` — completed

---

## Tab 6 — Config

| Key | Value | Notes |
|---|---|---|
| `sessionStart` | ms timestamp | Start of current session |
| `lastSync` | ISO 8601 datetime | Last Confluence sync |
| `confluenceUser` | `glmarshall` | eBay Confluence username |
| `watchedPageIds` | `1869909355` | Confluence page IDs to sync from |
| `watchedSpaceKeys` | `Fleet` | Confluence space keys to sync from |
