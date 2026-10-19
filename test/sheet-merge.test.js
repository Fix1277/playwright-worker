const test = require('node:test');
const assert = require('node:assert');
const { mergeSheet } = require('../scripts/sheet-merge');

const header = ['lead_id', 'club_name', 'email', 'contact_name', 'priority', 'outreach_status', 'outreach_notes'];

test('fills blanks but never overwrites what people typed', () => {
  const sheet = [header,
    ['GC1', 'Club One', 'fixed@club.co.uk', '', 'B', 'Emailed', 'spoke to Sue'],
    ['GC2', 'Club Two', '', '', 'C', 'Not contacted', ''],
  ];
  const local = [
    { lead_id: 'GC1', club_name: 'Club One', email: 'info@club.co.uk', contact_name: 'Tom Brown', priority: 'A', outreach_status: 'Not contacted', outreach_notes: '', web_emails: 'info@club.co.uk', web_pages: 'x' },
    { lead_id: 'GC2', club_name: 'Club Two', email: 'office@two.co.uk', contact_name: '', priority: 'B', outreach_status: 'Not contacted', outreach_notes: '', web_emails: 'office@two.co.uk', web_pages: 'y' },
  ];
  const { values, stats } = mergeSheet(sheet, local);
  const [h, r1, r2] = values;
  const col = n => h.indexOf(n);
  assert.ok(!h.includes('web_pages'), 'skipped column not added');
  assert.strictEqual(r1[col('email')], 'fixed@club.co.uk');
  assert.strictEqual(r1[col('contact_name')], 'Tom Brown');
  assert.strictEqual(r1[col('priority')], 'A');
  assert.strictEqual(r1[col('outreach_status')], 'Emailed');
  assert.strictEqual(r1[col('outreach_notes')], 'spoke to Sue');
  assert.strictEqual(r2[col('email')], 'office@two.co.uk');
  assert.strictEqual(r2[col('priority')], 'B');
  assert.strictEqual(r2[col('web_emails')], 'office@two.co.uk');
  assert.deepStrictEqual(stats, { updated: 2, added: 0, cellsFilled: 2 });
});

test('appends new clubs and keeps a manual priority', () => {
  const sheet = [header, ['GC1', 'Club One', 'a@b.co.uk', '', 'A', 'Not contacted', '']];
  const local = [
    { lead_id: 'GC1', club_name: 'Club One', email: 'a@b.co.uk', contact_name: '', priority: 'B', outreach_status: 'Not contacted', outreach_notes: '' },
    { lead_id: 'GC9', club_name: 'New Club', email: '', contact_name: '', priority: 'C', outreach_status: 'Not contacted', outreach_notes: '' },
  ];
  const { values, stats } = mergeSheet(sheet, local);
  assert.strictEqual(values.length, 3);
  assert.strictEqual(values[1][header.indexOf('priority')], 'A');
  assert.strictEqual(values[2][0], 'GC9');
  assert.strictEqual(stats.added, 1);
});

test('writes everything into an empty sheet', () => {
  const local = [{ lead_id: 'GC1', club_name: 'A', web_pages: 'x' }];
  const { values } = mergeSheet([], local);
  assert.deepStrictEqual(values, [['lead_id', 'club_name'], ['GC1', 'A']]);
});
