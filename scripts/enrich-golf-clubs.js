#!/usr/bin/env node
// Visits each club's own website and fills gaps in the golf club lead list:
// emails (the big Essex gap), phones, and named staff, preferring the
// Course Manager / Head Greenkeeper who owns machinery storage.
//
// Usage:
//   node scripts/enrich-golf-clubs.js [--county Essex] [--ids GC030,GC031]
//     [--all] [--limit 10] [--concurrency 3]
//     [--input data/golf_clubs_leads.csv] [--output out/golf_clubs_leads_enriched.csv]
//
// By default only rows with a website and no email are visited; --all visits
// every row with a website. Results are cached in out/cache.jsonl so a rerun
// skips clubs already done (delete the file to start over).

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { chromium } = require('playwright');
const {
  extractEmails, extractPhones, extractContacts, rankLinks, pickBestEmail,
} = require('./extract');

const MAX_EXTRA_PAGES = 4;
const NAV_TIMEOUT = 25000;
const PREFERRED_ROLES = ['Course Manager', 'Head Greenkeeper', 'Estates Manager'];

function parseArgs(argv) {
  const args = {
    input: 'data/golf_clubs_leads.csv',
    output: 'out/golf_clubs_leads_enriched.csv',
    cache: 'out/cache.jsonl',
    concurrency: 3,
    limit: Infinity,
    all: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--county') args.county = next();
    else if (a === '--ids') args.ids = new Set(next().split(','));
    else if (a === '--all') args.all = true;
    else if (a === '--limit') args.limit = Number(next());
    else if (a === '--concurrency') args.concurrency = Number(next());
    else if (a === '--input') args.input = next();
    else if (a === '--output') args.output = next();
    else if (a === '--cache') args.cache = next();
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function siteUrl(website) {
  const w = website.trim();
  if (!w) return null;
  return /^https?:\/\//.test(w) ? w : `https://${w.startsWith('www.') ? w : `www.${w}`}`;
}

function loadCache(file) {
  const done = new Map();
  if (!fs.existsSync(file)) return done;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    done.set(r.lead_id, r);
  }
  return done;
}

async function readPage(page, url) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  // Give JS-built footers a moment to render their contact block.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  const html = await page.content();
  const text = await page.innerText('body').catch(() => '');
  const links = await page.$$eval('a[href]', as => as.map(a => ({ href: a.href, text: a.textContent || '' })));
  return { status: resp ? resp.status() : 0, finalUrl: page.url(), html, text, links };
}

async function scrapeClub(context, row) {
  const start = siteUrl(row.website);
  const result = {
    lead_id: row.lead_id, emails: [], phones: [], contacts: [], pages: [], status: '', error: '',
  };
  const page = await context.newPage();
  try {
    let home;
    try {
      home = await readPage(page, start);
    } catch (e) {
      // Some clubs only answer on http or without www.
      const alt = start.replace('https://www.', 'http://');
      home = await readPage(page, alt);
    }
    const host = new URL(home.finalUrl).hostname.replace(/^www\./, '');
    const visited = [home];
    for (const url of rankLinks(home.links, host).slice(0, MAX_EXTRA_PAGES)) {
      try { visited.push(await readPage(page, url)); } catch { /* skip dead subpage */ }
    }
    const emails = new Set();
    const phones = new Set();
    const contacts = new Map();
    for (const v of visited) {
      result.pages.push(v.finalUrl);
      extractEmails(v.html).forEach(e => emails.add(e));
      extractPhones(v.text).forEach(p => phones.add(p));
      extractContacts(v.text).forEach(c => contacts.set(`${c.name}|${c.role}`, c));
    }
    result.host = host;
    result.emails = [...emails];
    result.phones = [...phones];
    result.contacts = [...contacts.values()];
    result.status = home.status >= 400 ? `http ${home.status}` : 'ok';
  } catch (e) {
    result.status = 'failed';
    result.error = e.message.split('\n')[0].slice(0, 200);
  } finally {
    await page.close();
  }
  return result;
}

function applyResult(row, r) {
  const filled = [];
  if (!row.email && r.emails.length) {
    row.email = pickBestEmail(r.emails, r.host);
    filled.push('email');
  }
  if (!row.phone && r.phones.length) {
    row.phone = r.phones[0];
    filled.push('phone');
  }
  const preferred = r.contacts.find(c => PREFERRED_ROLES.includes(c.role));
  const best = preferred || r.contacts[0];
  if (!row.contact_name && best) {
    row.contact_name = best.name;
    row.contact_role = best.role;
    filled.push('contact');
  }
  if (row.priority !== 'D') {
    const hasEmail = Boolean(row.email);
    const hasName = Boolean(row.contact_name);
    row.priority = hasEmail && hasName ? 'A' : hasEmail || hasName ? 'B' : 'C';
  }
  row.web_status = r.status + (r.error ? `: ${r.error}` : '');
  row.web_emails = r.emails.join('; ');
  row.web_phones = r.phones.join('; ');
  row.web_contacts = r.contacts.map(c => `${c.name} (${c.role})`).join('; ');
  row.web_course_manager = preferred ? `${preferred.name} (${preferred.role})` : '';
  row.web_filled = filled.join(', ');
  row.web_pages = r.pages.join(' ');
  row.web_scraped_at = r.scraped_at;
}

async function main() {
  const args = parseArgs(process.argv);
  const rows = parse(fs.readFileSync(args.input), { columns: true, bom: true, skip_empty_lines: true });
  const columns = Object.keys(rows[0]);
  const webCols = ['web_status', 'web_emails', 'web_phones', 'web_contacts', 'web_course_manager', 'web_filled', 'web_pages', 'web_scraped_at'];

  const targets = rows.filter(r =>
    r.website &&
    (!args.county || r.county.toLowerCase() === args.county.toLowerCase()) &&
    (!args.ids || args.ids.has(r.lead_id)) &&
    (args.all || args.ids || !r.email)
  ).slice(0, args.limit);

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.mkdirSync(path.dirname(args.cache), { recursive: true });
  const cache = loadCache(args.cache);
  const todo = targets.filter(r => !cache.has(r.lead_id));
  console.log(`${targets.length} clubs selected, ${targets.length - todo.length} cached, ${todo.length} to visit`);

  if (todo.length) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      locale: 'en-GB',
    });
    const queue = [...todo];
    let n = 0;
    const worker = async () => {
      while (queue.length) {
        const row = queue.shift();
        const r = await scrapeClub(context, row);
        r.scraped_at = new Date().toISOString();
        cache.set(row.lead_id, r);
        fs.appendFileSync(args.cache, JSON.stringify(r) + '\n');
        n++;
        console.log(`[${n}/${todo.length}] ${row.lead_id} ${row.club_name}: ${r.status}, ${r.emails.length} emails, ${r.contacts.length} contacts`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker));
    await browser.close();
  }

  for (const row of rows) {
    for (const c of webCols) row[c] = row[c] || '';
    const r = cache.get(row.lead_id);
    if (r && targets.includes(row)) applyResult(row, r);
  }
  fs.writeFileSync(args.output, '﻿' + stringify(rows, { header: true, columns: [...columns, ...webCols.filter(c => !columns.includes(c))] }));

  const touched = rows.filter(r => r.web_status);
  const summary = {
    visited: touched.length,
    ok: touched.filter(r => r.web_status === 'ok').length,
    failed: touched.filter(r => r.web_status.startsWith('failed')).length,
    emails_filled: touched.filter(r => r.web_filled.includes('email')).length,
    contacts_filled: touched.filter(r => r.web_filled.includes('contact')).length,
    course_managers_found: touched.filter(r => r.web_course_manager).length,
  };
  console.log('Summary:', summary);
  console.log(`Wrote ${args.output}`);
}

main().catch(e => { console.error(e); process.exit(1); });
