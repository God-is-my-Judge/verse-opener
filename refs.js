// Bible reference finder + Blue Letter Bible URL builder.
// Pure logic, no DOM: runs in the popup, the service worker and Node (tests).
(function (root) {
  'use strict';

  var COUNTS = root.BIBLE_VERSE_COUNTS ||
    (typeof require !== 'undefined' ? require('./versecounts.js') : null);

  // [BLB abbreviation, number prefix (0 = none), full names, abbreviations]
  // Full names may stand alone with just a chapter ("Romans 8");
  // abbreviations need chapter:verse and a capital letter.
  var B = [
    ['Gen', 0, ['Genesis'], ['Gen', 'Ge', 'Gn']],
    ['Exo', 0, ['Exodus'], ['Exod', 'Exo', 'Ex']],
    ['Lev', 0, ['Leviticus'], ['Lev', 'Le', 'Lv']],
    ['Num', 0, ['Numbers'], ['Num', 'Nu', 'Nm', 'Nb']],
    ['Deu', 0, ['Deuteronomy'], ['Deut', 'Deu', 'De', 'Dt']],
    ['Jos', 0, ['Joshua'], ['Josh', 'Jos', 'Jsh']],
    ['Jdg', 0, ['Judges'], ['Judg', 'Jdgs', 'Jdg', 'Jg']],
    ['Rth', 0, ['Ruth'], ['Rth', 'Ru']],
    ['1Sa', 1, ['Samuel'], ['Sam', 'Sa', 'Sm']],
    ['2Sa', 2, ['Samuel'], ['Sam', 'Sa', 'Sm']],
    ['1Ki', 1, ['Kings'], ['Kgs', 'Kin', 'Ki', 'Kg']],
    ['2Ki', 2, ['Kings'], ['Kgs', 'Kin', 'Ki', 'Kg']],
    ['1Ch', 1, ['Chronicles'], ['Chron', 'Chr', 'Ch']],
    ['2Ch', 2, ['Chronicles'], ['Chron', 'Chr', 'Ch']],
    ['Ezr', 0, ['Ezra'], ['Ezr']],
    ['Neh', 0, ['Nehemiah'], ['Neh', 'Ne']],
    ['Est', 0, ['Esther'], ['Esth', 'Est', 'Es']],
    ['Job', 0, ['Job'], ['Jb']],
    ['Psa', 0, ['Psalms', 'Psalm'], ['Pslm', 'Psa', 'Psm', 'Pss', 'Ps']],
    ['Pro', 0, ['Proverbs'], ['Prov', 'Pro', 'Prv', 'Pr']],
    ['Ecc', 0, ['Ecclesiastes'], ['Eccles', 'Eccl', 'Ecc', 'Ec', 'Qoh']],
    ['Sng', 0, ['Song of Solomon', 'Song of Songs', 'Canticles'], ['Song', 'Cant', 'Sng', 'SOS', 'So']],
    ['Isa', 0, ['Isaiah'], ['Isa', 'Is']],
    ['Jer', 0, ['Jeremiah'], ['Jer', 'Je', 'Jr']],
    ['Lam', 0, ['Lamentations'], ['Lam', 'La']],
    ['Eze', 0, ['Ezekiel'], ['Ezek', 'Eze', 'Ezk']],
    ['Dan', 0, ['Daniel'], ['Dan', 'Da', 'Dn']],
    ['Hos', 0, ['Hosea'], ['Hos', 'Ho']],
    ['Joe', 0, ['Joel'], ['Joe', 'Jl']],
    ['Amo', 0, ['Amos'], ['Amo', 'Am']],
    ['Oba', 0, ['Obadiah'], ['Obad', 'Oba', 'Ob']],
    ['Jon', 0, ['Jonah'], ['Jon', 'Jnh']],
    ['Mic', 0, ['Micah'], ['Mic', 'Mc']],
    ['Nah', 0, ['Nahum'], ['Nah', 'Na']],
    ['Hab', 0, ['Habakkuk'], ['Hab', 'Hb']],
    ['Zep', 0, ['Zephaniah'], ['Zeph', 'Zep', 'Zp']],
    ['Hag', 0, ['Haggai'], ['Hag', 'Hg']],
    ['Zec', 0, ['Zechariah'], ['Zech', 'Zec', 'Zc']],
    ['Mal', 0, ['Malachi'], ['Mal', 'Ml']],
    ['Mat', 0, ['Matthew'], ['Matt', 'Mat', 'Mt']],
    ['Mar', 0, ['Mark'], ['Mrk', 'Mar', 'Mk', 'Mr']],
    ['Luk', 0, ['Luke'], ['Luk', 'Lk']],
    ['Jhn', 0, ['John'], ['Jhn', 'Joh', 'Jn']],
    ['Act', 0, ['Acts'], ['Act', 'Ac']],
    ['Rom', 0, ['Romans'], ['Rom', 'Ro', 'Rm']],
    ['1Co', 1, ['Corinthians'], ['Cor', 'Co']],
    ['2Co', 2, ['Corinthians'], ['Cor', 'Co']],
    ['Gal', 0, ['Galatians'], ['Gal', 'Ga']],
    ['Eph', 0, ['Ephesians'], ['Ephes', 'Eph']],
    ['Phl', 0, ['Philippians'], ['Phil', 'Php', 'Phl', 'Pp']],
    ['Col', 0, ['Colossians'], ['Col']],
    ['1Th', 1, ['Thessalonians'], ['Thess', 'Thes', 'Th']],
    ['2Th', 2, ['Thessalonians'], ['Thess', 'Thes', 'Th']],
    ['1Ti', 1, ['Timothy'], ['Tim', 'Ti', 'Tm']],
    ['2Ti', 2, ['Timothy'], ['Tim', 'Ti', 'Tm']],
    ['Tit', 0, ['Titus'], ['Tit']],
    ['Phm', 0, ['Philemon'], ['Philem', 'Phlm', 'Phm', 'Pm']],
    ['Heb', 0, ['Hebrews'], ['Heb']],
    ['Jas', 0, ['James'], ['Jas', 'Jam', 'Jms', 'Jm']],
    ['1Pe', 1, ['Peter'], ['Pet', 'Pe', 'Pt']],
    ['2Pe', 2, ['Peter'], ['Pet', 'Pe', 'Pt']],
    ['1Jo', 1, ['John'], ['Jhn', 'Joh', 'Jn', 'Jo']],
    ['2Jo', 2, ['John'], ['Jhn', 'Joh', 'Jn', 'Jo']],
    ['3Jo', 3, ['John'], ['Jhn', 'Joh', 'Jn', 'Jo']],
    ['Jde', 0, ['Jude'], ['Jde']],
    ['Rev', 0, ['Revelation', 'Revelations', 'Apocalypse'], ['Rev', 'Re', 'Rv']]
  ];

  var NUM_WORDS = { 1: ['1st', 'First', 'I', '1'], 2: ['2nd', 'Second', 'II', '2'], 3: ['3rd', 'Third', 'III', '3'] };

  // lookup: normalized token -> { book: index, full: bool }
  var LOOKUP = new Map();
  var plainAlts = new Set();
  var numberedAlts = new Set();
  B.forEach(function (row, idx) {
    var n = row[1];
    function add(name, full) {
      var key = (n ? n : '') + name.toLowerCase().replace(/\s+/g, ' ');
      if (!LOOKUP.has(key)) LOOKUP.set(key, { book: idx, full: full });
      (n ? numberedAlts : plainAlts).add(name);
    }
    row[2].forEach(function (x) { add(x, true); });
    row[3].forEach(function (x) { add(x, false); });
  });

  function alt(set) {
    return Array.from(set)
      .sort(function (a, b) { return b.length - a.length; })
      .map(function (s) { return s.replace(/\s+/g, '\\s+'); })
      .join('|');
  }
  var BOOK_SRC =
    '(?<![\\p{L}\\p{N}])(?:' +
    '(?:(1st|2nd|3rd|First|Second|Third|III|II|I)\\s+|([123])\\s*)(' + alt(numberedAlts) + ')' +
    '|(' + alt(plainAlts) + ')' +
    ')(?![\\p{L}])\\.?';
  var BOOK_RE = new RegExp(BOOK_SRC, 'giu');
  var BOOK_STICKY = new RegExp(BOOK_SRC + '\\s{0,3}\\d', 'yiu');

  var PREFIX_NUM = { '1st': 1, first: 1, i: 1, '1': 1, '2nd': 2, second: 2, ii: 2, '2': 2, '3rd': 3, third: 3, iii: 3, '3': 3 };

  function resolveBook(m) {
    var prefix = m[1] || m[2], name = m[3] || m[4];
    var key = name.toLowerCase().replace(/\s+/g, ' ');
    if (prefix) {
      // Roman numerals must be upper-case ("I John", not "i john").
      if (/^i+$/i.test(prefix) && prefix !== prefix.toUpperCase()) return null;
      key = PREFIX_NUM[prefix.toLowerCase()] + key;
    }
    var hit = LOOKUP.get(key);
    if (!hit) return null;
    // Abbreviations must start with a capital to avoid "is 3:16", "am 5:30"...
    if (!hit.full && !/^\p{Lu}/u.test(name)) return null;
    return hit;
  }

  function chapters(book) { return COUNTS[book].length; }
  function verses(book, c) { return COUNTS[book][c - 1]; }

  var FIRST = /\s{0,3}(\d{1,3})(?:(?:\s?:\s?|\.)(\d{1,3}))?/y;
  var SUFFIX = /(?:[a-d]|ff?\.?)?(?![\p{L}\p{N}])/yu;
  var RANGE = /\s?[-‐-―]\s?(?:(\d{1,3})(?:\s?:\s?|\.))?(\d{1,3})/y;
  var SEP = /\s?([,;])\s?(?:and\s+|cf\.\s?)?/y;
  var CV = /(\d{1,3})\s?:\s?(\d{1,3})/y;
  var BARE = /(\d{1,3})(?![\p{L}\p{N}:])/yu;

  function at(re, text, pos) { re.lastIndex = pos; return re.exec(text); }

  // A reference is { book, c1, v1, c2, v2 }. v1/v2 are null for whole chapters.
  function makeRef(book, c1, v1, c2, v2) {
    var nCh = chapters(book);
    if (c1 < 1 || c2 < 1 || c1 > nCh || c2 > nCh) return null;
    if (c2 < c1) return null;
    if (v1 == null) return { book: book, c1: c1, v1: null, c2: c2, v2: null };
    if (v1 < 1 || v2 < 1 || v1 > verses(book, c1) || v2 > verses(book, c2)) return null;
    if (c1 === c2 && v2 < v1) return null;
    return { book: book, c1: c1, v1: v1, c2: c2, v2: v2 };
  }

  // Parses "3:16", "3:16-18", "3:16-4:2", "3", "3-5" starting at pos.
  // ctx = { book, full, chapter (current chapter for bare verse lists) }
  function parseItem(text, pos, ctx, mode) {
    var c1, v1 = null, end, m;
    if (mode === 'cv') {
      m = at(CV, text, pos); if (!m) return null;
      c1 = +m[1]; v1 = +m[2]; end = CV.lastIndex;
    } else if (mode === 'verse') {
      m = at(BARE, text, pos); if (!m) return null;
      c1 = ctx.chapter; v1 = +m[1]; end = BARE.lastIndex;
    } else if (mode === 'chapter') {
      m = at(BARE, text, pos); if (!m) return null;
      c1 = +m[1]; end = BARE.lastIndex;
    } else {
      m = at(FIRST, text, pos); if (!m) return null;
      c1 = +m[1]; if (m[2] != null) v1 = +m[2]; end = FIRST.lastIndex;
    }
    var single = chapters(ctx.book) === 1;
    if (v1 == null && single) { v1 = c1; c1 = 1; }       // "Jude 5" = Jude 1:5
    if (v1 == null && !ctx.full) return null;             // abbreviations need a verse
    if (v1 != null) {
      if (!at(SUFFIX, text, end)) return null;            // rejects "3:16pm"
      end = SUFFIX.lastIndex;
    }
    m = at(RANGE, text, end);
    if (m) {
      var rc = m[1] != null ? +m[1] : null, rv = +m[2];
      var s1 = v1, e1, e2, after = RANGE.lastIndex, ok = true;
      if (v1 != null) { e1 = rc != null ? rc : c1; e2 = rv; }   // "3:16-18", "3:16-4:2"
      else if (rc != null) { s1 = 1; e1 = rc; e2 = rv; }        // "Gen 1-2:3"
      else { e1 = rv; e2 = null; }                              // "Gen 1-3"
      if (e2 != null) { if (at(SUFFIX, text, after)) after = SUFFIX.lastIndex; else ok = false; }
      var ranged = ok ? makeRef(ctx.book, c1, s1, e1, e2) : null;
      if (ranged) return { ref: ranged, end: after };
    }
    var c2 = c1, v2 = v1;
    var ref = makeRef(ctx.book, c1, v1, c2, v2);
    return ref ? { ref: ref, end: end } : null;
  }

  function findReferences(text) {
    var out = [], m;
    BOOK_RE.lastIndex = 0;
    while ((m = BOOK_RE.exec(text))) {
      var hit = resolveBook(m);
      if (!hit) continue;
      var ctx = { book: hit.book, full: hit.full, chapter: null };
      var item = parseItem(text, BOOK_RE.lastIndex, ctx, 'first');
      if (!item) continue;
      var pos = item.end, prev = item.ref;
      out.push(prev);
      // continuation lists: "John 3:16, 18; 4:5-7"
      for (;;) {
        var s = at(SEP, text, pos);
        if (!s) break;
        var p = SEP.lastIndex;
        if (at(BOOK_STICKY, text, p)) break;              // next book starts here
        ctx.chapter = prev.c2;
        var next = parseItem(text, p, ctx, 'cv');
        if (!next && s[1] === ',' && prev.v1 != null) {
          next = parseItem(text, p, ctx, 'verse');
          if (next && next.ref.v1 <= prev.v2) next = null; // verse lists ascend
        }
        if (!next && prev.v1 == null && chapters(ctx.book) > 1) {
          next = parseItem(text, p, ctx, 'chapter');
          if (next && (next.ref.v1 != null || next.ref.c1 <= prev.c2)) next = null;
        }
        if (!next) break;
        out.push(next.ref); prev = next.ref; pos = next.end;
      }
      BOOK_RE.lastIndex = pos;
    }
    return out;
  }

  // Widen a verse reference by n verses on each side, never leaving the book.
  function expandContext(ref, n) {
    if (ref.v1 == null || !n) return ref;
    var b = ref.book, c1 = ref.c1, v1 = ref.v1, c2 = ref.c2, v2 = ref.v2, i;
    for (i = 0; i < n; i++) {
      if (v1 > 1) v1--;
      else if (c1 > 1) { c1--; v1 = verses(b, c1); }
    }
    for (i = 0; i < n; i++) {
      if (v2 < verses(b, c2)) v2++;
      else if (c2 < chapters(b)) { c2++; v2 = 1; }
    }
    return { book: b, c1: c1, v1: v1, c2: c2, v2: v2 };
  }

  function label(ref) {
    var a = B[ref.book][0];
    if (ref.v1 == null) return a + ' ' + ref.c1 + (ref.c2 !== ref.c1 ? '-' + ref.c2 : '');
    if (ref.c1 === ref.c2) return a + ' ' + ref.c1 + ':' + ref.v1 + (ref.v2 !== ref.v1 ? '-' + ref.v2 : '');
    return a + ' ' + ref.c1 + ':' + ref.v1 + '-' + ref.c2 + ':' + ref.v2;
  }

  // Display name: "John 3:16", "1 Corinthians 13:4-7", "Psalm 23".
  function fullLabel(ref) {
    var row = B[ref.book], name = row[0] === 'Psa' ? 'Psalm' : row[2][0];
    return label(ref).replace(/^\S+/, (row[1] ? row[1] + ' ' : '') + name);
  }

  // One reference per chapter: "Rev 21:1-22:5" -> Rev 21:1-27, Rev 22:1-5;
  // "Gen 1-3" -> Gen 1, Gen 2, Gen 3. This is also how BLB's Multi-Verse tool
  // returns them, so log entries line up with copied text.
  function chapterPieces(ref) {
    if (ref.c1 === ref.c2) return [ref];
    var out = [];
    for (var c = ref.c1; c <= ref.c2; c++) {
      if (ref.v1 == null) { out.push({ book: ref.book, c1: c, v1: null, c2: c, v2: null }); continue; }
      out.push({ book: ref.book, c1: c, v1: c === ref.c1 ? ref.v1 : 1, c2: c, v2: c === ref.c2 ? ref.v2 : verses(ref.book, c) });
    }
    return out;
  }

  // Same passage, same key: "Romans 8" and "Rom 8:1-39" are both "Rom 8:1-39".
  function canonicalKey(ref) {
    var v1 = ref.v1 == null ? 1 : ref.v1, v2 = ref.v2 == null ? verses(ref.book, ref.c2) : ref.v2;
    return label({ book: ref.book, c1: ref.c1, v1: v1, c2: ref.c2, v2: v2 });
  }

  // BLB documents "Mat 5:12-22" and "Rom 7-16" but not cross-chapter verse
  // ranges, so those are split into one piece per chapter.
  function blbPieces(ref) {
    if (ref.v1 == null || ref.c1 === ref.c2) return [label(ref)];
    return chapterPieces(ref).map(label);
  }

  function dedupe(refs) {
    var seen = new Set();
    return refs.filter(function (r) {
      var k = label(r);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function blbPieceList(refs, opts) {
    var pieces = [];
    dedupe(refs.map(function (r) { return expandContext(r, opts.context || 0); }))
      .forEach(function (r) { pieces = pieces.concat(blbPieces(r)); });
    return pieces;
  }

  function blbQuery(refs, opts) {
    return blbPieceList(refs, opts || {}).join('; ');
  }

  function cleanTranslation(t) {
    t = String(t || '').trim().replace(/[^A-Za-z0-9]/g, '');
    return t || 'ESV';
  }

  // Checked live against blueletterbible.org on 11 Nov 2026:
  // - search/preSearch.cfm opens BLB's full passage page for ONE passage
  //   ("Jhn 3:16", "Rom 8:28-30", "Rom 8"), but mangles lists ("Jhn 3:16; Rom 8:28-30"
  //   opened John 3:28-30) and chapter ranges ("Gen 1-3" opened Gen 1:1-24).
  // - tools/MultiVerse.cfm shows every reference in a list, as a plain link, in the
  //   chosen translation. It accepted all 66 book codes above, whole chapters,
  //   chapter ranges and the per-chapter pieces from blbPieces().
  // So: one simple passage goes to the passage page, anything more to Multi-Verse.
  // opts.multiVerse forces Multi-Verse (every passage in one list, to read or copy by hand).
  function blbUrl(refs, opts) {
    opts = opts || {};
    var pieces = blbPieceList(refs, opts);
    var t = '&t=' + encodeURIComponent(cleanTranslation(opts.translation));
    if (!opts.multiVerse && pieces.length === 1 && !/^\S+ \d+-\d+$/.test(pieces[0])) {
      return 'https://www.blueletterbible.org/search/preSearch.cfm?Criteria=' + encodeURIComponent(pieces[0]) + t;
    }
    return 'https://www.blueletterbible.org/tools/MultiVerse.cfm?mvText=' + encodeURIComponent(pieces.join('; ')) + t;
  }

  var api = {
    findReferences: findReferences, expandContext: expandContext, label: label,
    dedupe: dedupe, blbQuery: blbQuery, blbUrl: blbUrl, cleanTranslation: cleanTranslation,
    fullLabel: fullLabel, chapterPieces: chapterPieces, canonicalKey: canonicalKey,
    versesIn: function (book, c) { return verses(book, c); }
  };
  root.BibleRefs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
