// The running verse log: adding references, reading verse text copied from Blue
// Letter Bible, and writing/reading the Markdown file.
// Pure logic, no DOM or chrome APIs: runs in extension pages, the service worker,
// the stand-alone practice page and Node (tests).
//
// The Markdown is a "Scripture Way-Pack": each passage with text is a
// "## Reference (TRANSLATION)" entry with a "###" headline, the text with
// [chapter:verse] labels, and a "#### Metadata" JSON block. Passages still waiting
// for text are listed above the first entry, where importers of this format ignore
// them (entries need text).
(function (root) {
  'use strict';

  var R = root.BibleRefs || (typeof require !== 'undefined' ? require('./refs.js') : null);
  var PACK_TRANSLATIONS = ['CSB', 'LSB', 'KJV'];   // the format names these; anything else is CUSTOM

  function isoDate(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function emptyLog() { return { version: 1, entries: [] }; }
  function makeId(key, translation) {
    return (key + '-' + translation).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  }
  function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  // Where a reference was found, without query strings (they can hold private tokens).
  function cleanSource(source) {
    if (!source || !source.url || !/^https?:/.test(source.url)) return null;
    try {
      var u = new URL(source.url);
      return { title: oneLine(source.title).slice(0, 200), url: u.origin + u.pathname };
    } catch (e) { return null; }
  }

  function newEntry(piece, translation, date, source) {
    var key = R.canonicalKey(piece);
    return {
      id: makeId(key, translation), key: key, ref: R.label(piece), title: R.fullLabel(piece),
      translation: translation, logged: date, last: date, seen: 1, text: '', source: cleanSource(source)
    };
  }

  // Add references (from refs.js) to the log. One entry per chapter piece; a
  // passage already logged in the same translation just gets seen + 1.
  function addRefs(log, refs, translation, opts) {
    opts = opts || {};
    var date = opts.date || isoDate(), t = R.cleanTranslation(translation).toUpperCase();
    var entries = log.entries.slice(), added = 0, again = 0;
    refs.forEach(function (ref) {
      R.chapterPieces(ref).forEach(function (piece) {
        var e = newEntry(piece, t, date, opts.source);
        var i = entries.findIndex(function (x) { return x.id === e.id; });
        if (i < 0) { entries.push(e); added++; }
        else {
          entries[i] = Object.assign({}, entries[i], { seen: (entries[i].seen || 1) + 1, last: date });
          again++;
        }
      });
    });
    return { log: { version: 1, entries: entries }, added: added, again: again };
  }

  // Put [chapter:verse] labels in front of each verse of BLB's copied text
  // ("28 And we know ... 29 For those ..."). Falls back to one label for the
  // whole passage if the verse numbers can't all be found in order.
  function labelVerses(piece, body) {
    body = oneLine(body);
    var c = piece.c1, v1 = piece.v1 == null ? 1 : piece.v1, v2 = piece.v2 == null ? R.versesIn(piece.book, c) : piece.v2;
    var cuts = [], pos = 0;
    for (var n = v1; n <= v2; n++) {
      var re = new RegExp('(^|\\s)' + n + '\\s', 'g');
      re.lastIndex = pos;
      var m = re.exec(body);
      if (!m || (n === v1 && m.index !== 0)) { cuts = null; break; }
      var at = m.index + m[1].length;
      cuts.push({ n: n, at: at, textAt: at + String(n).length + 1 });
      pos = at + String(n).length;
    }
    if (cuts) {
      return cuts.map(function (cut, i) {
        var end = i + 1 < cuts.length ? cuts[i + 1].at : body.length;
        return '[' + c + ':' + cut.n + '] ' + body.slice(cut.textAt, end).trim();
      }).join(' ');
    }
    var label = '[' + c + ':' + v1 + (v2 !== v1 ? '-' + v2 : '') + '] ';
    return label + body.replace(new RegExp('^' + v1 + '\\s+'), '');
  }

  // Text copied with BLB's Multi-Verse "Copy to Clipboard" (or selected on that
  // page): "[Romans 8:28-30 ESV] – 28 And we know ..." one passage per line.
  var COPIED = /\[([^\]\n]{3,60}?)\s+([A-Za-z][A-Za-z0-9]{1,9})\]\s*[–—-]\s*([^\n]+)/g;
  function parseCopied(text) {
    var out = [], m;
    COPIED.lastIndex = 0;
    while ((m = COPIED.exec(String(text || '')))) {
      var refs = R.findReferences(m[1]);
      if (refs.length !== 1) continue;
      var pieces = R.chapterPieces(refs[0]);
      if (pieces.length !== 1) continue;
      var body = oneLine(m[3]);
      if (!body) continue;
      var piece = pieces[0], t = m[2].toUpperCase();
      out.push({ piece: piece, key: R.canonicalKey(piece), translation: t, text: labelVerses(piece, body) });
    }
    return out;
  }

  // Attach copied text to logged passages; passages not in the log are added.
  function addTexts(log, items, opts) {
    opts = opts || {};
    var date = opts.date || isoDate(), entries = log.entries.slice(), filled = 0, added = 0;
    items.forEach(function (it) {
      var id = makeId(it.key, it.translation);
      var i = entries.findIndex(function (x) { return x.id === id; });
      if (i < 0) {
        var e = newEntry(it.piece, it.translation, date, opts.source);
        e.text = it.text; e.seen = 0;
        entries.push(e); added++;
      } else {
        entries[i] = Object.assign({}, entries[i], { text: it.text });
        filled++;
      }
    });
    return { log: { version: 1, entries: entries }, filled: filled, added: added };
  }

  // The verse text split at its [label]s: the units recall works with.
  function units(text) {
    text = oneLine(text);
    var marks = [], re = /\[(\d{1,3}(?::\d{1,3})?(?:[-–]\d{1,3})?)\]/g, m;
    while ((m = re.exec(text))) marks.push({ label: m[1], at: m.index, after: re.lastIndex });
    if (!marks.length) return text ? [{ label: '', text: text }] : [];
    var out = [];
    if (text.slice(0, marks[0].at).trim()) out.push({ label: '', text: text.slice(0, marks[0].at).trim() });
    marks.forEach(function (mk, i) {
      var t = text.slice(mk.after, i + 1 < marks.length ? marks[i + 1].at : text.length).trim();
      if (t) out.push({ label: mk.label, text: t });
    });
    return out;
  }
  function plainText(text) { return units(text).map(function (u) { return u.text; }).join(' '); }

  // The format needs a "###" headline: the opening words of the passage.
  function headline(text) {
    var w = plainText(text).split(' ').filter(Boolean), out = [];
    for (var i = 0; i < w.length && out.length < 12; i++) {
      out.push(w[i]);
      if (out.length >= 5 && /[.;:!?]["”’')\]]*$/.test(w[i])) break;
    }
    var h = out.join(' ').replace(/[,;:]+$/, '');
    return out.length < w.length ? h.replace(/[.!?]+["”’')\]]*$/, '') + '…' : h;
  }

  function toMarkdown(log) {
    var withText = log.entries.filter(function (e) { return oneLine(e.text); });
    var waiting = log.entries.filter(function (e) { return !oneLine(e.text); });
    var out = [
      '# Scripture Way-Pack: Verse log', '',
      'Kept by the "Verse Opener" browser extension. New passages are added at the end.',
      'Practise them on the extension\'s Practice page, or import this file into any',
      'tool that reads Scripture Way-Packs. Edit verse text on the extension\'s Verse log',
      'page: this file is rewritten from there after every change.', '',
      'Verse text was copied from Blue Letter Bible (blueletterbible.org) for personal study.',
      'Each translation remains under its publisher\'s copyright.', ''
    ];
    if (waiting.length) {
      out.push('Still waiting for verse text (copy it from Blue Letter Bible and paste it on the Verse log page):', '');
      waiting.forEach(function (e) { out.push('- ' + e.title + ' (' + e.translation + '), logged ' + e.logged); });
      out.push('');
    }
    withText.forEach(function (e) {
      var meta = {
        id: e.id,
        translation: PACK_TRANSLATIONS.indexOf(e.translation) >= 0 ? e.translation : 'CUSTOM',
        version: e.translation, ref: e.ref, key: e.key,
        logged: e.logged, last: e.last, seen: e.seen, locations: []
      };
      if (e.source) meta.source_page = e.source;
      out.push('## ' + e.title + ' (' + e.translation + ')', '', '### ' + headline(e.text), '',
        oneLine(e.text), '', '#### Metadata', '', '```json', JSON.stringify(meta, null, 2), '```', '');
    });
    return out.join('\n');
  }

  // Reads a verse-log file back (also any Scripture Way-Pack).
  // Returns { log, problems }; entries that can't be read are reported, not fatal.
  function fromMarkdown(md) {
    md = String(md || '').replace(/\r/g, '');
    var blocks = md.split(/^## /m), pre = blocks.shift(), entries = [], problems = [];
    pre.split('\n').forEach(function (line) {
      var m = /^- (.+?) \(([A-Za-z0-9]{2,10})\), logged (\d{4}-\d\d-\d\d)\s*$/.exec(line);
      if (!m) return;
      var refs = R.findReferences(m[1]);
      if (refs.length !== 1) { problems.push('Could not read waiting passage: ' + m[1]); return; }
      R.chapterPieces(refs[0]).forEach(function (piece) {
        entries.push(newEntry(piece, m[2].toUpperCase(), m[3]));
      });
    });
    blocks.forEach(function (block) {
      var lines = block.split('\n'), title = lines.shift().trim(), body = lines.join('\n');
      var mm = /^#### Metadata\s*\n\s*```json\s*\n([\s\S]*?)\n```/m.exec(body);
      var meta = {};
      if (mm) { try { meta = JSON.parse(mm[1]); } catch (e) { problems.push(title + ': metadata is not valid JSON'); } }
      var head = body.split(/^#### /m)[0];
      var text = oneLine(head.replace(/^### .+$/m, '').replace(/^\*Tags:.*\*\s*$/m, ''));
      if (!text) { problems.push(title + ': no verse text'); return; }
      var tm = /\(([A-Za-z0-9]{2,10})\)\s*$/.exec(title);
      var translation = String(meta.version || (tm && tm[1]) || meta.translation || 'KJV').toUpperCase();
      var refs = R.findReferences(title.replace(/\([^)]*\)\s*$/, ''));
      var key = meta.key || (refs.length === 1 && R.chapterPieces(refs[0]).length === 1 ? R.canonicalKey(refs[0]) : '');
      entries.push({
        id: /^[a-zA-Z0-9_-]{1,70}$/.test(meta.id || '') ? meta.id : makeId(key || title, translation),
        key: key, ref: meta.ref || (refs[0] ? R.label(refs[0]) : title),
        title: title.replace(/\s*\([^)]*\)\s*$/, ''), translation: translation,
        logged: meta.logged || isoDate(), last: meta.last || meta.logged || isoDate(), seen: meta.seen || 1,
        text: text, source: cleanSource(meta.source_page)
      });
    });
    var seen = new Set();
    entries = entries.filter(function (e) { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
    entries.sort(function (a, b) { return a.logged < b.logged ? -1 : a.logged > b.logged ? 1 : 0; });
    return { log: { version: 1, entries: entries }, problems: problems };
  }

  var api = {
    emptyLog: emptyLog, isoDate: isoDate, addRefs: addRefs, parseCopied: parseCopied, addTexts: addTexts,
    labelVerses: labelVerses, units: units, plainText: plainText, headline: headline,
    toMarkdown: toMarkdown, fromMarkdown: fromMarkdown, cleanSource: cleanSource
  };
  root.VerseLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
