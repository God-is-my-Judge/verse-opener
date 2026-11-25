'use strict';
// Verse practice. Two homes, same file:
//  - inside the extension: reads the verse log from chrome.storage
//  - on its own (a local file or a web page): reads a verse-log.md the user chooses;
//    the file and progress stay in this browser's localStorage, nothing is uploaded.
const $ = (id) => document.getElementById(id);
const IN_EXTENSION = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local && chrome.runtime && chrome.runtime.id);
const LEVEL_NAMES = { phrases: 'Phrases', words: 'Words', type: 'Type it' };
const STAGE_TEXT = {
  second: 'Finish the verse: put the second half in order.',
  first: 'Start the verse: put the first half in order.',
  whole: 'The whole verse, from its reference.'
};

let passages = [];   // [{ entry, units: [{ label, text }] }] — only entries with text
let progress = {};   // entry id -> { unit index -> { fp, done: { 'level:stage': date } } }
let level = 'phrases';
let cur = null;      // the exercise on screen

// ---------- storage: chrome.storage in the extension, localStorage otherwise
const local = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode etc.: works for this visit only */ } }
};
const store = IN_EXTENSION ? {
  async log() { return (await chrome.storage.local.get({ verseLog: null })).verseLog || VerseLog.emptyLog(); },
  async progress() { return (await chrome.storage.local.get({ practice: {} })).practice; },
  saveProgress(p) { return chrome.storage.local.set({ practice: p }); },
  async level() { return (await chrome.storage.local.get({ practiceLevel: 'phrases' })).practiceLevel; },
  saveLevel(l) { return chrome.storage.local.set({ practiceLevel: l }); }
} : {
  async log() { const md = local.get('versePractice.md'); return md ? VerseLog.fromMarkdown(md).log : null; },
  async progress() { try { return JSON.parse(local.get('versePractice.progress') || '{}'); } catch (e) { return {}; } },
  async saveProgress(p) { local.set('versePractice.progress', JSON.stringify(p)); },
  async level() { return local.get('versePractice.level') || 'phrases'; },
  async saveLevel(l) { local.set('versePractice.level', l); }
};

// ---------- progress helpers
function unitRecord(id, i, text, create) {
  const fp = Recall.fingerprint(text);
  const byUnit = progress[id] || (create ? (progress[id] = {}) : {});
  let rec = byUnit[i];
  if (!rec || rec.fp !== fp) {           // new verse, or its wording changed: start over
    rec = { fp, done: {} };
    if (create) byUnit[i] = rec;
  }
  return rec;
}
const unitLevel = (p, i) => Recall.levelReached(unitRecord(p.entry.id, i, p.units[i].text).done, p.units[i].text);
const passageLevel = (p) => Math.min(...p.units.map((_, i) => unitLevel(p, i)));
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const levelIndex = () => Recall.LEVELS.indexOf(level) + 1;

// ---------- loading
async function load() {
  progress = await store.progress();
  const savedLevel = await store.level();
  level = Recall.LEVELS.includes(savedLevel) ? savedLevel : 'phrases';
  const log = await store.log();
  $('toLog').hidden = !IN_EXTENSION;
  $('otherFile').hidden = IN_EXTENSION || !log;
  if (!IN_EXTENSION && !log) { show('loader'); return; }
  passages = log.entries.filter((e) => e.text).map((entry) => ({ entry, units: VerseLog.units(entry.text) }))
    .filter((p) => p.units.length);
  if (!passages.length) {
    $('emptyText').textContent = IN_EXTENSION
      ? 'Passages need their verse text before they can be practised. Open the Verse log to add it.'
      : 'That file has no passages with verse text. Choose another file.';
    show('empty');
    if (!IN_EXTENSION) $('loader').hidden = false;
    return;
  }
  show('practice');
  renderLevel();
  goTo(nextTarget(null));
}
function show(id) { ['loader', 'empty', 'practice'].forEach((s) => { $(s).hidden = s !== id; }); }

async function useFile(file) {
  if (!file) return;
  const md = await file.text();
  const { log, problems } = VerseLog.fromMarkdown(md);
  if (!log.entries.length) {
    $('loadNote').textContent = '';
    $('loadNote').append(Object.assign(document.createElement('div'), { className: 'note bad', textContent: 'No passages found in that file.' + (problems.length ? ' ' + problems.slice(0, 3).join('; ') : '') }));
    show('loader');
    return;
  }
  local.set('versePractice.md', md);
  load();
}

// ---------- choosing what to practise
// The first verse (from `after` onwards, wrapping) not yet done at the current level.
function nextTarget(after) {
  const all = [];
  passages.forEach((p, pi) => p.units.forEach((_, ui) => all.push({ pi, ui })));
  let start = 0;
  if (after) start = all.findIndex((t) => t.pi === after.pi && t.ui === after.ui) + 1;
  for (let k = 0; k < all.length; k++) {
    const t = all[(start + k) % all.length];
    if (unitLevel(passages[t.pi], t.ui) < levelIndex()) return t;
  }
  return null;
}

function goTo(target) {
  renderPicker();
  if (!target) {
    cur = null;
    $('refTitle').textContent = `Every verse is done at the ${LEVEL_NAMES[level]} level.`;
    $('stars').textContent = '';
    $('steps').textContent = '';
    $('stepText').textContent = level === 'type' ? 'Well done. Pick a passage above to keep it fresh.' : 'Try the next level up, or pick a passage above.';
    ['verse', 'pool', 'feedback'].forEach((id) => { $(id).textContent = ''; });
    $('typeBox').hidden = true; $('reading').hidden = true;
    ['check', 'undo', 'read', 'skip'].forEach((id) => { $(id).disabled = true; });
    return;
  }
  const p = passages[target.pi], unit = p.units[target.ui];
  const stages = Recall.stagesFor(unit.text);
  const done = unitRecord(p.entry.id, target.ui, unit.text).done;
  let si = stages.findIndex((st) => !done[level + ':' + st]);
  if (si < 0) si = 0;
  cur = { ...target, p, unit, stages, si };
  $('pick').value = String(target.pi);
  startStage();
}

function startStage() {
  const { p, unit, stages, si } = cur;
  const stage = stages[si];
  const ex = Recall.exercise(unit.text, stage);
  const others = [];
  passages.forEach((q) => q.units.forEach((u) => { if (u !== unit) others.push(u.text); }));
  cur.ex = ex;
  cur.picked = [];
  cur.puzzle = level === 'type' ? null : Recall.puzzle(ex.hidden, level, others);

  const multi = p.units.length > 1 ? ` · verse ${cur.ui + 1} of ${p.units.length}` : '';
  $('refTitle').textContent = `${p.entry.title} (${p.entry.translation})`;
  $('refTitle').title = unit.label ? 'Verse ' + unit.label : '';
  $('stars').textContent = stars(unitLevel(p, cur.ui));
  $('steps').textContent = '';
  stages.forEach((_, i) => $('steps').append(Object.assign(document.createElement('span'), { className: i < si ? 'done' : i === si ? 'now' : '' })));
  $('stepText').textContent = `Step ${si + 1} of ${stages.length}${multi}${unit.label ? ' (' + unit.label + ')' : ''}. ` +
    (level === 'type' ? STAGE_TEXT[stage].replace('put', 'type').replace(' in order', '') : STAGE_TEXT[stage]);
  $('typeBox').hidden = level !== 'type';
  $('typed').value = '';
  $('feedback').textContent = '';
  $('reading').hidden = true;
  ['check', 'read', 'skip'].forEach((id) => { $(id).disabled = false; });
  $('undo').disabled = true;
  $('undo').hidden = level === 'type';
  renderVerse();
  renderPool();
  if (level === 'type') $('typed').focus();
}

// ---------- drawing
function renderLevel() {
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
}
function renderPicker() {
  const pick = $('pick');
  pick.textContent = '';
  passages.forEach((p, i) => pick.append(new Option(`${stars(passageLevel(p))}  ${p.entry.title} (${p.entry.translation})`, String(i))));
}
function renderVerse() {
  const v = $('verse');
  v.textContent = '';
  const slot = document.createElement('span');
  slot.className = 'slot';
  if (level === 'type') { slot.textContent = '_____'; slot.classList.add('empty'); }
  else if (!cur.picked.length) { slot.textContent = 'tap the pieces below in order'; slot.classList.add('empty'); }
  else cur.picked.forEach((tile, k) => {
    const b = document.createElement('button');
    b.className = 'tile'; b.textContent = tile.text; b.title = 'Take this piece back';
    b.addEventListener('click', () => { cur.picked.splice(k, 1); renderVerse(); renderPool(); });
    slot.append(b);
  });
  const shown = document.createElement('span');
  shown.textContent = cur.ex.shown;
  if (!cur.ex.shown) v.append(slot);
  else if (cur.ex.hiddenFirst) v.append(slot, ' ', shown);
  else v.append(shown, ' ', slot);
  $('undo').disabled = !cur.picked.length;
}
function renderPool() {
  const pool = $('pool');
  pool.textContent = '';
  if (!cur.puzzle) return;
  cur.puzzle.pool.forEach((tile) => {
    const b = document.createElement('button');
    b.className = 'tile' + (cur.picked.includes(tile) ? ' used' : '');
    b.textContent = tile.text;
    b.addEventListener('click', () => { if (cur.picked.includes(tile)) return; cur.picked.push(tile); renderVerse(); renderPool(); });
    pool.append(b);
  });
}
function feedback(kind, text) {
  $('feedback').textContent = '';
  $('feedback').append(Object.assign(document.createElement('div'), { className: 'note ' + kind, textContent: text }));
}

// ---------- actions
async function check() {
  if (!cur) return;
  const attempt = level === 'type' ? $('typed').value : cur.picked.map((t) => t.text);
  if (!String(attempt).trim() && !(Array.isArray(attempt) && attempt.length)) return feedback('bad', level === 'type' ? 'Type the missing words first.' : 'Tap the pieces in order first.');
  const r = Recall.check(attempt, cur.ex.hidden);
  if (!r.ok) {
    return feedback('bad', r.rightWords
      ? `Not yet: the first ${r.rightWords} of ${r.total} words are right.`
      : 'Not yet: the first word isn’t right.');
  }
  const stage = cur.stages[cur.si];
  unitRecord(cur.p.entry.id, cur.ui, cur.unit.text, true).done[level + ':' + stage] = VerseLog.isoDate();
  await store.saveProgress(progress);
  ['check', 'undo', 'skip'].forEach((id) => { $(id).disabled = true; });
  if (cur.si + 1 < cur.stages.length) {
    feedback('ok', level === 'type' ? `Right: “${cur.ex.hidden}”` : 'Right!');
    const before = cur;
    setTimeout(() => { if (cur === before) { cur.si++; startStage(); } }, 1100);
  } else {
    const reached = unitLevel(cur.p, cur.ui);
    feedback('ok', `Verse learned at the ${LEVEL_NAMES[level]} level. ${stars(reached)}`);
    $('stars').textContent = stars(reached);
    renderPicker(); $('pick').value = String(cur.pi);
    $('next').focus();
  }
}

$('check').addEventListener('click', check);
$('typed').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(); } });
$('undo').addEventListener('click', () => { if (cur && cur.picked.length) { cur.picked.pop(); renderVerse(); renderPool(); } });
$('read').addEventListener('click', () => {
  if (!cur) return;
  $('reading').hidden = !$('reading').hidden;
  $('reading').textContent = cur.unit.text;
});
$('skip').addEventListener('click', () => goTo(nextTarget(cur)));
$('next').addEventListener('click', () => goTo(nextTarget(cur)));
$('pick').addEventListener('change', () => goTo({ pi: Number($('pick').value), ui: 0 }));
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', async () => {
  level = b.dataset.level;
  await store.saveLevel(level);
  renderLevel();
  goTo(cur ? { pi: cur.pi, ui: cur.ui } : nextTarget(null));
}));

// stand-alone: choose or drop a file
$('openFile').addEventListener('click', () => $('fileInput').click());
$('otherFile').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', () => { useFile($('fileInput').files[0]); $('fileInput').value = ''; });
['dragover', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
  if (IN_EXTENSION) return;
  e.preventDefault();
  if (ev === 'drop') useFile(e.dataTransfer.files[0]);
}));

// in the extension, pick up new verse text added while this tab is open
if (IN_EXTENSION) chrome.storage.onChanged.addListener((c) => { if (c.verseLog && !cur) load(); });
load();
