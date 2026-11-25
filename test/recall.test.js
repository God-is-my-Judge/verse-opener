const assert = require('assert');
const C = require('../recall.js');
let n = 0;
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };

const v = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

// halves and stages (first ceil(n/2) words)
const [a, b] = C.halves(v);
eq(a.split(' ').length, 12); eq(b.split(' ').length, 12);   // 24 words
eq(a + ' ' + b, v);
eq(C.exercise(v, 'second'), { shown: a, hidden: b, hiddenFirst: false });
eq(C.exercise(v, 'first'), { shown: b, hidden: a, hiddenFirst: true });
eq(C.exercise(v, 'whole').hidden, v);
eq(C.stagesFor('Jesus wept.'), ['whole']);
eq(C.stagesFor(v), ['second', 'first', 'whole']);

// phrases: about four groups, never across a sentence end
const p = C.phrases(v, 4);
ok(p.length >= 4 && p.length <= 5, p);
eq(p.join(' '), v);
eq(C.phrases('One two three. Four five six seven eight nine.', 4), ['One two three.', 'Four five six', 'seven eight nine.']);

// word tiles: punctuation trimmed, nothing empty
eq(C.wordTiles('"For God so loved — the world," he said.'), ['For', 'God', 'so', 'loved', 'the', 'world', 'he', 'said']);

// puzzles: all answer tiles present, decoys only at the words level, never already in order
for (let i = 0; i < 200; i++) {
  const r = C.rng('seed' + i);
  for (const level of ['phrases', 'words']) {
    const pz = C.puzzle(b, level, ['Jesus wept.', 'In the beginning was the Word, and the Word was with God'], r);
    const correct = pz.pool.filter((t) => t.correct).map((t) => t.text);
    assert.deepStrictEqual([...correct].sort(), [...pz.answer].sort());
    assert.notDeepStrictEqual(correct, pz.answer, 'shuffled');
    const decoys = pz.pool.filter((t) => !t.correct);
    if (level === 'phrases') assert.strictEqual(decoys.length, 0);
    else {
      assert.ok(decoys.length >= 2 && decoys.length <= 6);
      const answerWords = new Set(pz.answer.map(C.normalize));
      assert.ok(decoys.every((d) => !answerWords.has(C.normalize(d.text)) && C.normalize(d.text).length >= 3));
    }
  }
}
n++;

// checking: by words, ignoring case, punctuation, apostrophes and spacing
eq(C.check(C.phrases(b, 4), b).ok, true);
eq(C.check(C.wordTiles(b), b).ok, true, 'word tiles without punctuation still match');
eq(C.check('THAT whoever  believes in him should not perish but have eternal life', b).ok, true);
eq(C.check('dont be afraid', "Don't be afraid!").ok, true);
eq(C.check('that whoever believes in him shall not perish', b), { ok: false, rightWords: 5, total: 12 });
eq(C.check('that whoever believes in him should not perish but have eternal life forever', b).ok, false, 'extra words fail');
eq(C.check(['the', 'Word', 'the', 'Word'], 'the Word the Word').ok, true, 'repeated tiles are interchangeable');

// progress levels
eq(C.levelReached({}, v), 0);
eq(C.levelReached({ 'phrases:second': 1, 'phrases:first': 1 }, v), 0);
eq(C.levelReached({ 'phrases:second': 1, 'phrases:first': 1, 'phrases:whole': 1 }, v), 1);
eq(C.levelReached({ 'type:whole': 1 }, 'Jesus wept.'), 3);
ok(C.fingerprint('Jesus wept.') === C.fingerprint('jesus WEPT'), 'fingerprint ignores case/punctuation');
ok(C.fingerprint('Jesus wept.') !== C.fingerprint('Jesus slept.'));

console.log(`ok - ${n} recall checks passed`);
