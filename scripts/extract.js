// Pure helpers for pulling contact details out of page HTML/text.
// Kept separate from the browser code so they can be unit tested.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// UK numbers: 01xxx / 02x / 03xx / 07xxx, optionally written as +44 (0)...
const PHONE_RE = /(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/g;

const ROLES = [
  'Course Manager',
  'Head Greenkeeper',
  'Deputy Head Greenkeeper',
  'Estates Manager',
  'General Manager',
  'Club Manager',
  'Operations Manager',
  'Club Secretary',
  'Secretary',
  'Director of Golf',
  'Head Professional',
];

// Words that show a "name" match is really a heading or button label.
const NOT_A_NAME = /\b(Golf|Club|Course|Park|Booking|Visitor|Contact|Email|Phone|Tel|Office|Team|Shop|Members?hip|Events?|Hotel|Country|Manager|Secretary|Professional|The|Our|Find|Book|Read|More|View|Call)\b/i;

// Contact-ish pages worth visiting after the homepage, best first.
const LINK_HINTS = [
  /contact/i,
  /green\s?keep|course\s?(team|manager|report)|greenstaff/i,
  /staff|team|who.?s.?who|people|committee/i,
  /about/i,
];

const JUNK_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|@(example|domain|email|sentry|wixpress)\.|^(name|your|user)@/i;

// Cloudflare "email protection" hides addresses as hex in data-cfemail.
function decodeCfEmail(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

function extractEmails(html) {
  const found = new Set();
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) found.add(decodeCfEmail(m[1]));
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) found.add(decodeCfEmail(m[1]));
  // Common "info [at] club [dot] co [dot] uk" obfuscation.
  const deobf = html
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
  for (const m of deobf.matchAll(EMAIL_RE)) found.add(m[0]);
  return [...found]
    .map(e => e.toLowerCase().replace(/^mailto:/, '').replace(/[.,;]+$/, ''))
    .filter(e => !JUNK_EMAIL.test(e));
}

function normalisePhone(p) {
  let d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('+44')) d = '0' + d.slice(3).replace(/^0/, '');
  if (d.length !== 11) return null;
  // Format as STD + number, close enough for a lead sheet.
  if (d.startsWith('02')) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

function extractPhones(text) {
  const found = new Set();
  for (const m of text.matchAll(PHONE_RE)) {
    const n = normalisePhone(m[0]);
    if (n) found.add(n);
  }
  return [...found];
}

// Finds "Role: Name" / "Name - Role" / "Name, Role" pairs in visible text.
function extractContacts(text) {
  const out = [];
  const seen = new Set();
  const name = "([A-Z][a-z'’-]+(?:[ \\t]+[A-Z][a-z'’-]+){1,2})";
  for (const role of ROLES) {
    const r = role.replace(/ /g, '\\s+');
    const patterns = [
      new RegExp(`${r}\\s*[:\\-–—|]?\\s*${name}`, 'g'),
      new RegExp(`${name}\\s*[,\\-–—|(]\\s*${r}`, 'g'),
    ];
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        const person = m[1].trim();
        if (ROLES.some(x => x.toLowerCase().includes(person.toLowerCase()))) continue;
        if (NOT_A_NAME.test(person)) continue;
        const key = `${person}|${role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: person, role });
      }
    }
  }
  return out;
}

function rankLinks(links, baseHost) {
  const scored = [];
  for (const { href, text } of links) {
    let url;
    try { url = new URL(href); } catch { continue; }
    if (url.hostname.replace(/^www\./, '') !== baseHost) continue;
    const hay = `${url.pathname} ${text}`;
    const idx = LINK_HINTS.findIndex(re => re.test(hay));
    if (idx === -1) continue;
    url.hash = '';
    scored.push({ url: url.toString(), score: idx });
  }
  scored.sort((a, b) => a.score - b.score);
  return [...new Set(scored.map(s => s.url))];
}

// Prefer an address on the club's own domain, then generic inboxes.
function pickBestEmail(emails, siteHost) {
  const host = (siteHost || '').replace(/^www\./, '');
  const score = e => {
    let s = 0;
    const domain = e.split('@')[1];
    if (host && (domain === host || host.endsWith(domain) || domain.endsWith(host))) s -= 10;
    if (/^(info|office|enquir|admin|secretary|manager|gm|reception)/.test(e)) s -= 3;
    if (/^(proshop|pro|shop|events|bar|catering|restaurant|functions|bookings)/.test(e)) s += 2;
    return s;
  };
  return [...emails].sort((a, b) => score(a) - score(b))[0] || '';
}

module.exports = {
  decodeCfEmail,
  extractEmails,
  extractPhones,
  extractContacts,
  normalisePhone,
  rankLinks,
  pickBestEmail,
  ROLES,
  NOT_A_NAME,
};
