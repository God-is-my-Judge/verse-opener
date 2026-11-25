const assert = require('assert');
const R = require('../refs.js');
const L = (t) => R.findReferences(t).map(R.label);
let n = 0;
function eq(text, expected) { assert.deepStrictEqual(L(text), expected, text); n++; }

// basic forms
eq('For God so loved (John 3:16).', ['Jhn 3:16']);
eq('See Jn 3:16-18 and Rom. 8:28–30.', ['Jhn 3:16-18', 'Rom 8:28-30']);
eq('1 Cor 13:4-7; 2 Tim. 3:16; I John 1:9; II Pet 3:9; 1Jn 4:8', ['1Co 13:4-7', '2Ti 3:16', '1Jo 1:9', '2Pe 3:9', '1Jo 4:8']);
eq('First Corinthians 15:3 and Second Samuel 7:12', ['1Co 15:3', '2Sa 7:12']);
eq('Gen. 1:1, Ex 20:2, Deut 6:4, Ps 23:1, Prov 3:5-6, Isa 53:5, Matt 5:3, Mk 1:15, Lk 2:11, Rev 21:4',
   ['Gen 1:1', 'Exo 20:2', 'Deu 6:4', 'Psa 23:1', 'Pro 3:5-6', 'Isa 53:5', 'Mat 5:3', 'Mar 1:15', 'Luk 2:11', 'Rev 21:4']);
eq('Song of Solomon 2:1; Song 2:4; Phil 4:13; Phm 6; Philemon 1:6', ['Sng 2:1', 'Sng 2:4', 'Phl 4:13', 'Phm 1:6', 'Phm 1:6']);
// lists and continuations
eq('John 3:16, 18; 4:5-7', ['Jhn 3:16', 'Jhn 3:18', 'Jhn 4:5-7']);
eq('John 3:16, 2 Cor 5:17, 21', ['Jhn 3:16', '2Co 5:17', '2Co 5:21']);
eq('Romans 8:28-30, 35, 38-39', ['Rom 8:28-30', 'Rom 8:35', 'Rom 8:38-39']);
// chapters
eq('Read Romans 8 and Psalm 23, then Genesis 1-3.', ['Rom 8', 'Psa 23', 'Gen 1-3']);
eq('Psalms 23, 24; 27', ['Psa 23', 'Psa 24', 'Psa 27']);
eq('Rev 21:1-22:5', ['Rev 21:1-22:5']);
eq('Jude 5-7 and Obadiah 3, 2 John 4', ['Jde 1:5-7', 'Oba 1:3', '2Jo 1:4']);
eq('John 3:16b, Mark 1:1ff, John 3.16', ['Jhn 3:16', 'Mar 1:1', 'Jhn 3:16']);
eq('JOHN 3:16 and john 3:16', ['Jhn 3:16', 'Jhn 3:16']);
// things that must NOT match
eq('The meeting is 3:16 today, I am 5:30 late, so 2:1 odds.', []);
eq('Call at 3:16pm. Gen 99:1 is not real. John 3:99 neither. Rom 3 is an abbreviation without a verse.', []);
eq('Johnson 3:16, Romanian 8:28, Markdown 2:1', []);
eq('in 1 Chronicles 30:1', []);            // only 29 chapters
eq('Version 2.1.0 of Acts-as-list', []);

// context expansion
const X = (t, c) => R.blbQuery(R.findReferences(t), { context: c });
assert.strictEqual(X('John 3:16', 1), 'Jhn 3:15-17'); n++;
assert.strictEqual(X('Gen 1:1', 1), 'Gen 1:1-2'); n++;                       // start of book: clamp
assert.strictEqual(X('Rev 22:21', 1), 'Rev 22:20-21'); n++;                  // end of book: clamp
assert.strictEqual(X('Gen 1:31', 1), 'Gen 1:30-31; Gen 2:1'); n++;           // crosses a chapter, split for BLB
assert.strictEqual(X('Gen 2:1', 1), 'Gen 1:31; Gen 2:1-2'); n++;
assert.strictEqual(X('Romans 8', 1), 'Rom 8'); n++;                          // whole chapters unchanged
assert.strictEqual(X('John 3:16; John 3:16; Rom 8:28', 0), 'Jhn 3:16; Rom 8:28'); n++;  // dedupe
assert.strictEqual(X('Rev 21:1-22:5', 0), 'Rev 21:1-27; Rev 22:1-5'); n++;

// URL
// several references: Multi-Verse tool (preSearch.cfm mangles lists; checked live)
assert.strictEqual(
  R.blbUrl(R.findReferences('John 3:16; Rom 8:28-30'), { translation: ' esv ' }),
  'https://www.blueletterbible.org/tools/MultiVerse.cfm?mvText=Jhn%203%3A16%3B%20Rom%208%3A28-30&t=esv'); n++;
// one passage: BLB's normal passage page
assert.strictEqual(
  R.blbUrl(R.findReferences('Rom 8:28-30'), { translation: 'NKJV' }),
  'https://www.blueletterbible.org/search/preSearch.cfm?Criteria=Rom%208%3A28-30&t=NKJV'); n++;
assert.ok(R.blbUrl(R.findReferences('Romans 8'), {}).includes('preSearch.cfm?Criteria=Rom%208&t=ESV')); n++;
// a chapter range or a context window that crosses chapters is more than one passage
assert.ok(R.blbUrl(R.findReferences('Genesis 1-3'), {}).includes('MultiVerse.cfm?mvText=Gen%201-3&')); n++;
assert.ok(R.blbUrl(R.findReferences('Gen 1:31'), { context: 1 }).includes('MultiVerse.cfm?mvText=Gen%201%3A30-31%3B%20Gen%202%3A1&')); n++;
assert.strictEqual(R.cleanTranslation(''), 'ESV'); n++;

// speed: 2 MB of text
const big = ('Lorem ipsum dolor sit amet, see John 3:16 and Rom 8:28. ' + 'x '.repeat(40)).repeat(15000);
const t0 = Date.now(); const found = R.findReferences(big).length; const ms = Date.now() - t0;
assert.strictEqual(found, 30000); n++;
console.log(`ok - ${n} checks passed; ${(big.length / 1e6).toFixed(1)} MB scanned in ${ms} ms`);
