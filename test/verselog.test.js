const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = require('../refs.js');
const L = require('../verselog.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

// --- refs.js additions
eq(R.fullLabel(R.findReferences('1 Cor 13:4-7')[0]), '1 Corinthians 13:4-7');
eq(R.fullLabel(R.findReferences('Ps 23:1')[0]), 'Psalm 23:1');
eq(R.fullLabel(R.findReferences('Romans 8')[0]), 'Romans 8');
eq(R.chapterPieces(R.findReferences('Rev 21:1-22:5')[0]).map(R.label), ['Rev 21:1-27', 'Rev 22:1-5']);
eq(R.chapterPieces(R.findReferences('Genesis 1-3')[0]).map(R.label), ['Gen 1', 'Gen 2', 'Gen 3']);
eq(R.canonicalKey(R.findReferences('Romans 8')[0]), 'Rom 8:1-39');
eq(R.canonicalKey(R.findReferences('Rom 8:1-39')[0]), 'Rom 8:1-39');

// --- adding references: one entry per chapter, repeats counted, not duplicated
let r = L.addRefs(L.emptyLog(), R.findReferences('John 3:16; Rom 8:28-30; Rev 21:1-22:5'), 'esv',
  { date: '2026-11-11', source: { title: 'Sermon', url: 'https://example.org/s?token=secret#x' } });
eq(r.added, 4);
eq(r.log.entries.map((e) => e.id), ['jhn-3-16-esv', 'rom-8-28-30-esv', 'rev-21-1-27-esv', 'rev-22-1-5-esv']);
eq(r.log.entries[0].source, { title: 'Sermon', url: 'https://example.org/s' }, 'query string dropped');
eq(r.log.entries[1].title, 'Romans 8:28-30');
r = L.addRefs(r.log, R.findReferences('Jn 3:16 and John 3:16'), 'ESV', { date: '2026-11-12' });
eq([r.added, r.again], [0, 2]);
eq([r.log.entries[0].seen, r.log.entries[0].last, r.log.entries.length], [3, '2026-11-12', 4]);
r = L.addRefs(r.log, R.findReferences('John 3:16'), 'KJV', { date: '2026-11-12' });
eq(r.added, 1, 'another translation is another entry');
let log = r.log;

// --- text copied from BLB's Multi-Verse page (format checked live, 11 Nov 2026)
const copied = `[John 3:16 ESV] – 16 "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.

[Romans 8:28-30 ESV] – 28 And we know that for those who love God all things work together for good, for those who are called according to his purpose. 29 For those whom he foreknew he also predestined to be conformed to the image of his Son, in order that he might be the firstborn among many brothers. 30 And those whom he predestined he also called, and those whom he called he also justified, and those whom he justified he also glorified.

[Psalm 23:1-6 ESV] – 1 The LORD is my shepherd; I shall not want. 2 He makes me lie down in green pastures. 3 He restores my soul. 4 Even though I walk. 5 You prepare a table. 6 Surely goodness and mercy.`;
const items = L.parseCopied(copied);
eq(items.map((i) => [i.key, i.translation]), [['Jhn 3:16', 'ESV'], ['Rom 8:28-30', 'ESV'], ['Psa 23:1-6', 'ESV']]);
ok(items[1].text.startsWith('[8:28] And we know') && items[1].text.includes(' [8:29] For those whom') && items[1].text.includes(' [8:30] And those whom'), items[1].text);
eq(items[0].text.slice(0, 22), '[3:16] "For God so lov');
// a verse number that can't be found in order: one label for the whole passage
eq(L.labelVerses(R.findReferences('Rom 8:28-29')[0], '28 And we know all things.'), '[8:28-29] And we know all things.');
// numbers inside the text don't confuse it, the next expected verse number is searched in order
eq(L.labelVerses(R.findReferences('Gen 7:4-5')[0], '4 For in seven days I will send rain forty days and forty nights 5 And Noah did all'),
  '[7:4] For in seven days I will send rain forty days and forty nights [7:5] And Noah did all');
eq(L.parseCopied('nothing here [not a ref ESV] – text'), []);

r = L.addTexts(log, items, { date: '2026-11-13' });
eq([r.filled, r.added], [2, 1], 'two logged passages get text, Psalm 23 is new');
log = r.log;
eq(log.entries.map((e) => !!e.text), [true, true, false, false, false, true]);

// --- units (recall pieces)
eq(L.units(log.entries[1].text).map((u) => u.label), ['8:28', '8:29', '8:30']);
eq(L.units('no labels here'), [{ label: '', text: 'no labels here' }]);
eq(L.headline(log.entries[1].text), 'And we know that for those who love God all things work…');
eq(L.headline('[11:35] Jesus wept.'), 'Jesus wept.');

// --- Markdown: waiting passages above the entries, round trip keeps everything
const md = L.toMarkdown(log);
ok(md.indexOf('- Revelation 21:1-27 (ESV), logged 2026-11-11') < md.indexOf('## John 3:16 (ESV)'), 'waiting list first');
ok(md.includes('## Romans 8:28-30 (ESV)\n\n### And we know'));
ok(md.includes('"translation": "CUSTOM"') && md.includes('"version": "ESV"'));
const back = L.fromMarkdown(md);
eq(back.problems, []);
const strip = (l) => l.entries.map((e) => [e.id, e.title, e.translation, e.text, e.logged]).sort();
eq(strip(back.log), strip(log));

// Imported metadata is untrusted: links must be HTTP(S), with credentials,
// query strings and fragments removed just as they are for newly logged pages.
function importedSource(url) {
  return L.fromMarkdown('## John 3:16 (CSB)\n\nExample verse text.\n\n#### Metadata\n```json\n' +
    JSON.stringify({ source_page: { title: 'Source', url } }) + '\n```').log.entries[0].source;
}
eq(importedSource('javascript:alert(1)'), null, 'reject script source links');
eq(importedSource('data:text/html,private'), null, 'reject data source links');
eq(importedSource('file:///home/private.txt'), null, 'reject local file source links');
eq(importedSource('https://user:password@example.org/study?token=secret#private'),
  { title: 'Source', url: 'https://example.org/study' }, 'strip sensitive URL parts on import');

// --- A Scripture Way-Pack importer accepts the file (if WAYPACK_IMPORTER_DIST points to one's dist folder)
const lrDist = process.env.WAYPACK_IMPORTER_DIST || '';
const core = lrDist && fs.existsSync(lrDist) && fs.readdirSync(lrDist).find((f) => /^core\.[0-9a-f]+\.js$/.test(f));
if (core) {
  const c = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(lrDist, core), 'utf8') + '\n;globalThis.Road = Road;', c);
  const cards = c.Road.parse(md, 'scripture');
  eq(cards.length, 3, 'the importer takes the 3 passages with text');
  eq(Array.from(c.Road.units(cards[1], 'excerpts'), (u) => u.label), ['[8:28]', '[8:29]', '[8:30]']);
  console.log(`ok - ${n} verse-log checks passed (incl. Way-Pack import with ${core})`);
} else {
  console.log(`ok - ${n} verse-log checks passed (no Way-Pack importer given, import check skipped)`);
}
