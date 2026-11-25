// Recall exercises for memorising a verse, following these rules:
// see one half, rebuild the other; then rebuild the whole verse.
//
// Levels:  phrases  ~4 phrase tiles, no decoys           (easiest)
//          words    one tile per word, plus decoy words   (harder)
//          type     type it; case, punctuation, apostrophes and spacing are ignored (hardest)
// Stages:  second   first half shown, rebuild the second half
//          first    second half shown, rebuild the first half
//          whole    only the reference shown, rebuild the whole verse
//
// Pure logic, no DOM: runs in the practice page and in Node (tests).
(function (root) {
  'use strict';

  var LEVELS = ['phrases', 'words', 'type'];
  var STAGES = ['second', 'first', 'whole'];

  // normalize(): what "the same words" means when checking.
  function normalize(s) {
    return String(s).normalize('NFKC').toLowerCase().replace(/[’']/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function words(s) { return String(s).trim().split(/\s+/).filter(Boolean); }

  // halves(): first ceil(n/2) words, then the rest.
  function halves(text) {
    var w = words(text), n = Math.max(1, Math.ceil(w.length / 2));
    return [w.slice(0, n).join(' '), w.slice(n).join(' ') || w.slice(0, n).join(' ')];
  }

  // Very short verses ("Jesus wept.") skip the half stages.
  function stagesFor(text) { return words(text).length >= 4 ? STAGES.slice() : ['whole']; }

  // The text to show and the text to rebuild for a stage.
  function exercise(text, stage) {
    var h = halves(text);
    if (stage === 'second') return { shown: h[0], hidden: h[1], hiddenFirst: false };
    if (stage === 'first') return { shown: h[1], hidden: h[0], hiddenFirst: true };
    return { shown: '', hidden: oneLine(text), hiddenFirst: true };
  }
  function oneLine(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  var SENTENCE_END = /[.!?]["”’')\]]*$/;

  // About `max` groups of words, never running across the end of a sentence.
  function phrases(text, max) {
    var w = words(text), groups = Math.min(w.length, max || 4);
    var size = Math.max(1, Math.ceil(w.length / Math.max(1, groups))), out = [], chunk = [];
    w.forEach(function (word) {
      chunk.push(word);
      if (chunk.length >= size || SENTENCE_END.test(word)) { out.push(chunk.join(' ')); chunk = []; }
    });
    if (chunk.length) out.push(chunk.join(' '));
    return out;
  }

  // One tile per word, punctuation trimmed.
  function wordTiles(text) {
    return words(text).map(function (w) { return w.replace(/^[“”"‘’',:;!?.()\[\]—–-]+|[“”"‘’',:;!?.()\[\]—–-]+$/g, ''); })
      .filter(function (w) { return normalize(w); });
  }

  // Deterministic random numbers (mulberry32), so tests can repeat a shuffle.
  function rng(seed) {
    var h = 1779033703 ^ String(seed).length;
    for (var i = 0; i < String(seed).length; i++) { h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    var n = h >>> 0;
    return function () {
      n += 0x6D2B79F5; var t = n;
      t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, r) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // Tiles for the phrases/words levels. `others` = text of other verses, used for
  // decoy words. Returns { answer: [tile texts in order], pool: [{ text, correct }] }.
  function puzzle(hidden, level, others, r) {
    r = r || Math.random;
    var answer = level === 'words' ? wordTiles(hidden) : phrases(hidden, 4);
    var pool = answer.map(function (t) { return { text: t, correct: true }; });
    if (level === 'words') {
      var want = Math.min(6, Math.max(2, Math.ceil(answer.length / 4)));
      var used = new Set(answer.map(normalize)), decoys = [];
      (others || []).forEach(function (o) {
        wordTiles(o).forEach(function (w) {
          var k = normalize(w);
          if (k.length >= 3 && !used.has(k)) { used.add(k); decoys.push(w); }
        });
      });
      shuffle(decoys, r).slice(0, want).forEach(function (w) { pool.push({ text: w, correct: false }); });
    }
    var mixed = shuffle(pool, r);
    // never hand over the answer already in order
    var inOrder = mixed.filter(function (p) { return p.correct; }).map(function (p) { return p.text; }).join('\u0000') === answer.join('\u0000');
    if (inOrder && answer.length > 1) {
      var a = mixed.findIndex(function (p) { return p.correct; });
      var b = mixed.findIndex(function (p, i) { return p.correct && i > a && normalize(p.text) !== normalize(mixed[a].text); });
      if (b > 0) { var t = mixed[a]; mixed[a] = mixed[b]; mixed[b] = t; }
    }
    return { answer: answer, pool: mixed };
  }

  // Compare by words, not tiles, so identical tiles are interchangeable.
  function check(attempt, hidden) {
    var a = words(normalize(Array.isArray(attempt) ? attempt.join(' ') : attempt));
    var b = words(normalize(hidden));
    var i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    var ok = i === a.length && i === b.length;
    return { ok: ok, rightWords: i, total: b.length };
  }

  // Progress: which level/stage combinations are done for one verse.
  // Level reached = the highest level whose three stages (or one, for short verses) are all done.
  function levelReached(done, text) {
    var stages = stagesFor(text), reached = 0;
    LEVELS.forEach(function (lv, i) {
      if (stages.every(function (st) { return done && done[lv + ':' + st]; })) reached = i + 1;
    });
    return reached;   // 0..3
  }

  // Short, stable fingerprint: changed wording resets that verse's progress.
  function fingerprint(s) {
    var h = 2166136261;
    s = normalize(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  var api = {
    LEVELS: LEVELS, STAGES: STAGES, normalize: normalize, halves: halves, stagesFor: stagesFor,
    exercise: exercise, phrases: phrases, wordTiles: wordTiles, rng: rng, shuffle: shuffle,
    puzzle: puzzle, check: check, levelReached: levelReached, fingerprint: fingerprint
  };
  root.Recall = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
