// Merge rules for pushing the enriched CSV into the shared Google Sheet.
// The sheet is where people work, so it wins: we only fill blanks, except
// for the scraper's own web_* columns, which always reflect the latest run.

const OUTREACH_COLS = ['outreach_status', 'last_contacted', 'outreach_notes'];
// Too noisy or long to be useful in the shared sheet.
const SKIP_COLS = ['web_pages', 'web_phones'];
// Filling any of these can change a row's priority.
const PRIORITY_INPUTS = ['email', 'contact_name'];

function computePriority(row) {
  if (row.priority === 'D') return 'D';
  const hasEmail = Boolean(row.email);
  const hasName = Boolean(row.contact_name);
  return hasEmail && hasName ? 'A' : hasEmail || hasName ? 'B' : 'C';
}

// sheetValues: 2D array from the Sheets API (header row first).
// localRows: objects parsed from the enriched CSV.
// Returns the full new 2D array plus counts of what changed.
function mergeSheet(sheetValues, localRows) {
  const header = sheetValues.length ? [...sheetValues[0]] : [];
  const localCols = Object.keys(localRows[0] || {}).filter(c => !SKIP_COLS.includes(c));
  for (const c of localCols) if (!header.includes(c)) header.push(c);
  const idx = Object.fromEntries(header.map((c, i) => [c, i]));
  if (idx.lead_id === undefined) throw new Error('Sheet has no lead_id column');

  const rows = sheetValues.slice(1).map(r => header.map((_, i) => r[i] ?? ''));
  const byId = new Map(rows.map(r => [r[idx.lead_id], r]));
  const stats = { updated: 0, added: 0, cellsFilled: 0 };

  for (const local of localRows) {
    let row = byId.get(local.lead_id);
    if (!row) {
      row = header.map(c => local[c] ?? '');
      rows.push(row);
      byId.set(local.lead_id, row);
      stats.added++;
      continue;
    }
    let changed = false;
    let priorityInputFilled = false;
    for (const c of localCols) {
      if (OUTREACH_COLS.includes(c) || c === 'priority') continue;
      const value = local[c] ?? '';
      const i = idx[c];
      if (c.startsWith('web_')) {
        if (row[i] !== value) { row[i] = value; changed = true; }
      } else if (!row[i] && value) {
        row[i] = value;
        changed = true;
        stats.cellsFilled++;
        if (PRIORITY_INPUTS.includes(c)) priorityInputFilled = true;
      }
    }
    if (priorityInputFilled || !row[idx.priority]) {
      const obj = Object.fromEntries(header.map((c, i) => [c, row[i]]));
      const p = computePriority(obj);
      if (row[idx.priority] !== p) { row[idx.priority] = p; changed = true; }
    }
    if (changed) stats.updated++;
  }
  return { values: [header, ...rows], stats };
}

module.exports = { mergeSheet, computePriority, OUTREACH_COLS, SKIP_COLS };
