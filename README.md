# playwright-worker

Playwright scrapers for Fixstrut lead lists.

## Golf club leads (Step 2 of `docs/HANDOVER.md`)

`data/golf_clubs_leads.csv` is the 244-club list from the directory pass.
`scripts/enrich-golf-clubs.js` visits each club's own website (homepage plus
up to 4 contact/staff/greenkeeping pages) and fills blank `email`, `phone`
and `contact_name`/`contact_role`, preferring Course Manager / Head
Greenkeeper. Existing values are never overwritten; everything found is kept
in the `web_*` columns so it can be checked by hand. Priority is recomputed
(A/B/C) except for D (possibly closed).

```bash
npm install
npm run enrich:essex                 # Essex clubs with a website and no email (the main gap)
node scripts/enrich-golf-clubs.js --all          # every club with a website
node scripts/enrich-golf-clubs.js --ids GC030,GC031
npm test
```

Output: `out/golf_clubs_leads_enriched.csv`. Progress is cached in
`out/cache.jsonl`, so an interrupted run resumes; delete it to re-scrape.

Needs outbound web access to the club sites.

## Live Google Sheet

`scripts/sync-sheet.js` pushes the enriched CSV into the shared sheet
"Golf Club Leads (Fixstrut)". The sheet wins: it only fills blank cells,
never touches `outreach_status` / `last_contacted` / `outreach_notes`,
refreshes the `web_*` columns, recomputes priority only when it fills an
email or contact, and appends new clubs as new rows.

Setup (once):
1. Google Cloud console: create a project, enable the Google Sheets API.
2. IAM & Admin → Service Accounts → create one → Keys → Add key → JSON.
3. Share the sheet with the service account's `client_email` as Editor.
4. Set env vars `GOOGLE_SERVICE_ACCOUNT_JSON` (key contents or path) and
   `GOOGLE_SHEET_ID` (from the sheet URL).

```bash
npm run enrich -- --county Essex && npm run sync -- --dry-run   # preview
npm run sync
```
