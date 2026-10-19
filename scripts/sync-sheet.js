#!/usr/bin/env node
// Pushes the enriched lead list into the shared Google Sheet without
// touching anything people have typed there (see sheet-merge.js).
//
// Needs a Google service account with Editor access to the sheet:
//   GOOGLE_SERVICE_ACCOUNT_JSON  the key file contents (or a path to it)
//   GOOGLE_SHEET_ID              the id from the sheet's URL (or --sheet)
//
// Usage: node scripts/sync-sheet.js [--sheet <id>] [--input out/golf_clubs_leads_enriched.csv] [--dry-run]

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { google } = require('googleapis');
const { mergeSheet } = require('./sheet-merge');

function parseArgs(argv) {
  const args = {
    sheet: process.env.GOOGLE_SHEET_ID,
    input: 'out/golf_clubs_leads_enriched.csv',
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sheet') args.sheet = argv[++i];
    else if (a === '--input') args.input = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sheet) throw new Error('Set GOOGLE_SHEET_ID or pass --sheet <id>');
  return args;
}

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Set GOOGLE_SERVICE_ACCOUNT_JSON to the service account key (JSON or path)');
  return JSON.parse(raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8'));
}

async function main() {
  const args = parseArgs(process.argv);
  const creds = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: args.sheet });
  const tab = meta.data.sheets[0].properties.title;
  const range = `'${tab}'`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId: args.sheet, range });
  const localRows = parse(fs.readFileSync(args.input), { columns: true, bom: true, skip_empty_lines: true });

  const { values, stats } = mergeSheet(current.data.values || [], localRows);
  console.log(`Sheet "${meta.data.properties.title}" / ${tab}:`, stats);
  if (args.dryRun) return console.log('Dry run: nothing written');

  await sheets.spreadsheets.values.update({
    spreadsheetId: args.sheet,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  console.log(`Wrote ${values.length - 1} rows`);
}

main().catch(e => {
  const msg = e.response?.data?.error?.message || e.message;
  if (/permission|caller does not have/i.test(msg)) {
    console.error(`${msg}\nShare the sheet with the service account email (client_email in the key) as Editor.`);
  } else {
    console.error(msg);
  }
  process.exit(1);
});
