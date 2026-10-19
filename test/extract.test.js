const test = require('node:test');
const assert = require('node:assert');
const x = require('../scripts/extract');

function cfEncode(email, key = 0x42) {
  return key.toString(16).padStart(2, '0') +
    [...email].map(c => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
}

test('decodes Cloudflare-protected emails', () => {
  assert.strictEqual(x.decodeCfEmail(cfEncode('info@club.co.uk')), 'info@club.co.uk');
  const html = `<a data-cfemail="${cfEncode('sec@club.co.uk')}">x</a>`;
  assert.deepStrictEqual(x.extractEmails(html), ['sec@club.co.uk']);
});

test('finds plain and [at]/[dot] emails, drops image names', () => {
  const e = x.extractEmails('mailto:Info@Club.co.uk. office [at] club [dot] com <img src="a@2x.png">');
  assert.deepStrictEqual(e.sort(), ['info@club.co.uk', 'office@club.com']);
});

test('normalises UK phones', () => {
  assert.deepStrictEqual(x.extractPhones('Tel 01245 256483 or +44 (0)20 8500 2059'), ['01245 256483', '020 8500 2059']);
});

test('extracts role/name pairs both ways round', () => {
  const c = x.extractContacts('Course Manager: Nick Meehan\nJane Smith, Secretary');
  assert.ok(c.some(p => p.name === 'Nick Meehan' && p.role === 'Course Manager'));
  assert.ok(c.some(p => p.name === 'Jane Smith' && p.role === 'Secretary'));
});

test('ranks same-site contact links first', () => {
  const links = [
    { href: 'https://www.club.co.uk/about', text: 'About' },
    { href: 'https://www.club.co.uk/contact', text: 'Contact' },
    { href: 'https://facebook.com/contact', text: 'Contact' },
    { href: 'https://www.club.co.uk/tee-times', text: 'Book' },
  ];
  assert.deepStrictEqual(x.rankLinks(links, 'club.co.uk'), ['https://www.club.co.uk/contact', 'https://www.club.co.uk/about']);
});

test('prefers own-domain generic inbox over pro shop or ISP', () => {
  assert.strictEqual(x.pickBestEmail(['proshop@club.co.uk', 'bob@btinternet.com', 'info@club.co.uk'], 'www.club.co.uk'), 'info@club.co.uk');
});

test('ignores headings and buttons that look like names', () => {
  const c = x.extractContacts('Visitor Booking - General Manager\nCrondon Park Golf, Director of Golf\nGeneral Manager: Iain Evans');
  assert.deepStrictEqual(c.map(p => p.name), ['Iain Evans']);
});

test('drops safeguarding emails and Ofcom drama numbers', () => {
  assert.deepStrictEqual(x.extractEmails('info@club.co.uk help@nspcc.org.uk safeguarding@englandgolf.org a@essex.gov.uk'), ['info@club.co.uk']);
  assert.deepStrictEqual(x.extractPhones('020 7946 0123 or 01992 522118'), ['01992 522118']);
});

test('drops Wix/Sentry tracking addresses and tab-joined names', () => {
  assert.deepStrictEqual(x.extractEmails('a@club.co.uk 605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com'), ['a@club.co.uk']);
  assert.deepStrictEqual(x.extractContacts('Course Manager: Tony James\tYes').map(c => c.name), ['Tony James']);
});

test('prefers the listed website domain when the site redirects elsewhere', () => {
  assert.strictEqual(x.pickBestEmail(['enquiries@otherhotel.co.uk', 'reservations@uffordpark.co.uk'], 'group.co.uk', 'www.uffordpark.co.uk'), 'reservations@uffordpark.co.uk');
});
