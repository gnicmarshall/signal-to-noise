# Signal to Noise — Project Context

## What this is
A personal productivity dashboard built and maintained by Glen Marshall (glmarshall@ebay.com). It separates important work (Signal) from lower-priority noise, surfaces Confluence-synced tasks, and tracks morning routines. Vibe-coded as a Google Apps Script web app backed by a Google Sheet.

## Live resources
| Resource | URL |
|---|---|
| Running app | https://script.google.com/a/macros/ebay.com/s/AKfycbzNvn-sn9a4alEwXgC2yQs4zbIsTvVH3LbKwDNpVhJ5T3ptLEgL52s69q7xTL-GdXFK5g/exec |
| Apps Script editor | https://script.google.com/d/1FUuMSgg4wuw_6m8KeDBdDi5k0siKoRQLTymoo7yRKBBB7TblaEtnohq-/edit |
| Live data sheet (Signal - Noise DB) | https://docs.google.com/spreadsheets/d/1nZLpc-axRgs-YH-egqYFHtjdx40KE8oXskA_O2LJHRU |
| Original data sheet (archived) | https://docs.google.com/spreadsheets/d/1pdKnmBo2dQMRegZhC-nFOj2-hPH1isuPvd3xddgNc3c |

## Tech stack
- **Frontend/logic**: Google Apps Script (`.gs` server-side, HTML service for UI)
- **Data store**: Google Sheets — 6 tabs acting as separate entity stores
- **Integrations**: Confluence (Fleet space, page ID 1869909355, user: glmarshall)
- **Auth**: eBay Google Workspace SSO

## Project structure (this folder)
```
Signal to noise/
├── CLAUDE.md              ← you are here; LLM/IDE context
├── schema/
│   └── data-model.md      ← full sheet schema, column definitions, ID conventions
└── src/
    ├── Code.gs            ← server-side Apps Script (paste from editor)
    └── index.html         ← web app UI (paste from editor)
```

## Data model summary
IDs are Unix millisecond timestamps used as primary keys across all tabs. Source field is currently always `manual`; a `confluence` source is planned via the Confluence sync integration.

See `schema/data-model.md` for full column definitions.

## Key design decisions
- Sheet tabs are used as independent entity stores (no relational joins)
- Confluence sync is configured via the Config tab (`watchedPageIds`, `watchedSpaceKeys`)
- All timestamps stored as Unix milliseconds

## What to work on next (as of July 2026)
- ServiceNow MCP integration (replace manual XLSX upload pattern)
- Confluence task pull (source: `confluence` already planned in schema)
- Persistent project folder consolidation (this folder — in progress)
