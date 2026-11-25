'use strict';
const $ = (id) => document.getElementById(id);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.flat().forEach((k) => { if (k != null && k !== false) e.append(k); });
  return e;
}
function note(id, kind, text) { $(id).textContent = ''; if (text) $(id).append(el('div', { class: 'note ' + kind }, text)); }
// A button that asks for a second click before doing something destructive.
function confirmButton(btn, label, action) {
  let armed = false, t;
  btn.addEventListener('click', () => {
    if (!armed) { armed = true; btn.dataset.label = btn.textContent; btn.textContent = label; t = setTimeout(() => { armed = false; btn.textContent = btn.dataset.label; }, 4000); return; }
    clearTimeout(t); armed = false; btn.textContent = btn.dataset.label; action();
  });
}
const refsOf = (e) => BibleRefs.findReferences(e.key || e.ref);
const blbLink = (e) => BibleRefs.blbUrl(refsOf(e), { translation: e.translation });

async function render() {
  const log = await LogStore.load();
  const total = log.entries.length, waiting = log.entries.filter((e) => !e.text);
  $('count').textContent = total
    ? `${plural(total, 'passage')}; ${total - waiting.length} with text, ready to practise.`
    : 'Nothing logged yet.';

  // passages still waiting for text: one Multi-Verse tab per translation
  $('waiting').hidden = !waiting.length;
  $('waitingTitle').textContent = `${plural(waiting.length, 'passage')} still need${waiting.length === 1 ? 's' : ''} verse text`;
  const byT = new Map();
  waiting.forEach((e) => byT.set(e.translation, (byT.get(e.translation) || []).concat(refsOf(e))));
  $('waitingButtons').textContent = '';
  byT.forEach((refs, t) => {
    $('waitingButtons').append(el('button', { class: 'primary', onclick: () =>
      chrome.tabs.create({ url: BibleRefs.blbUrl(refs, { translation: t, multiVerse: true }) }) },
    `Open ${plural(refs.length, 'passage')} on BLB (${t})`));
  });

  const list = $('list');
  list.textContent = '';
  if (!total) list.append(el('p', { class: 'muted' }, 'References you open with the toolbar button appear here.'));
  log.entries.forEach((e) => list.append(entryView(e)));
}

function textView(text) {
  const p = el('p', { class: 'text' });
  VerseLog.units(text).forEach((u, i) => {
    if (i) p.append(' ');
    if (u.label) p.append(el('sup', {}, u.label));
    p.append(u.text);
  });
  return p;
}

function entryView(e) {
  const meta = [`logged ${e.logged}`];
  if (e.seen > 1) meta.push(`opened ${e.seen}×, last ${e.last}`);
  // Also validate older logs already present before the import fix.
  const origin = VerseLog.cleanSource(e.source);
  const source = origin ? el('a', { href: origin.url, target: '_blank', rel: 'noopener noreferrer' }, origin.title || origin.url) : null;
  const box = el('article', { class: 'entry' },
    el('h3', {}, `${e.title} (${e.translation})`,
      el('a', { class: 'small', href: blbLink(e), target: '_blank', rel: 'noopener' }, 'BLB ↗')),
    el('div', { class: 'meta' }, meta.join(' · '), source ? [' · from ', source] : null),
    e.text ? textView(e.text) : el('p', { class: 'missing' }, 'No verse text yet.'));
  const edit = el('button', { class: 'link' }, e.text ? 'Edit text' : 'Type the text');
  const remove = el('button', { class: 'link danger' }, 'Remove');
  box.append(el('div', { class: 'actions' }, edit, remove));
  edit.addEventListener('click', () => {
    const ta = el('textarea', { 'aria-label': 'Verse text for ' + e.title }); ta.value = e.text || '';
    const save = el('button', { class: 'primary' }, 'Save');
    const cancel = el('button', {}, 'Cancel');
    const help = el('p', { class: 'small muted' }, 'Optional verse labels like [8:28] split it into verses for practice.');
    box.querySelector('.actions').replaceWith(el('div', {}, ta, help, el('div', { class: 'bar' }, save, cancel)));
    ta.focus();
    cancel.addEventListener('click', render);
    save.addEventListener('click', () => LogStore.update((log) => ({
      log: { ...log, entries: log.entries.map((x) => (x.id === e.id ? { ...x, text: ta.value.replace(/\s+/g, ' ').trim() } : x)) }
    })));
  });
  confirmButton(remove, 'Click again to remove', () =>
    LogStore.update((log) => ({ log: { ...log, entries: log.entries.filter((x) => x.id !== e.id) } })));
  return box;
}

async function renderFile() {
  const s = await loadSettings();
  $('keepFile').checked = s.keepFile;
  $('logOpened').checked = s.logOpened;
  const { logFile } = await chrome.storage.local.get({ logFile: null });
  $('fileStatus').textContent = !s.keepFile ? 'The file copy is off; the log is kept in the browser only.'
    : !logFile ? `It will be saved as Downloads/${LogStore.FILE} after the next change.`
      : logFile.ok ? `Saved to ${logFile.path} at ${new Date(logFile.at).toLocaleTimeString()}.`
        : LogStore.fileProblem(logFile);
}

$('keepFile').addEventListener('change', () => chrome.storage.sync.set({ keepFile: $('keepFile').checked }));
$('logOpened').addEventListener('change', () => chrome.storage.sync.set({ logOpened: $('logOpened').checked }));
$('saveNow').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'write-file-now' });
  note('fileNote', 'ok', 'Saving…');
  setTimeout(() => note('fileNote', 'ok', ''), 1500);
});
$('copyMd').addEventListener('click', async () => {
  await navigator.clipboard.writeText(VerseLog.toMarkdown(await LogStore.load()));
  note('fileNote', 'ok', 'Copied the Markdown.');
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async () => {
  const f = $('importFile').files[0];
  if (!f) return;
  const { log: incoming, problems } = VerseLog.fromMarkdown(await f.text());
  $('importFile').value = '';
  if (!incoming.entries.length) return note('fileNote', 'bad', 'No passages found in that file.');
  // merge: same passage (same id) keeps the earlier log date; the file's text wins if it has any
  const r = await LogStore.update((log) => {
    const byId = new Map(log.entries.map((e) => [e.id, e]));
    let added = 0;
    incoming.entries.forEach((e) => {
      const old = byId.get(e.id);
      if (!old) { byId.set(e.id, e); added++; return; }
      byId.set(e.id, { ...old, text: e.text || old.text, seen: Math.max(old.seen || 1, e.seen || 1),
        logged: old.logged < e.logged ? old.logged : e.logged });
    });
    const entries = [...byId.values()].sort((a, b) => (a.logged < b.logged ? -1 : a.logged > b.logged ? 1 : 0));
    return { log: { version: 1, entries }, added };
  });
  note('fileNote', problems.length ? 'bad' : 'ok', `Imported ${plural(incoming.entries.length, 'passage')} (${r.added} new).` +
    (problems.length ? ' Skipped: ' + problems.join('; ') : ''));
});
$('pasteBtn').addEventListener('click', async () => {
  const items = VerseLog.parseCopied($('paste').value);
  if (!items.length) return note('pasteNote', 'bad', 'No passages found. Copy them with “Copy to Clipboard” on BLB’s Multi-Verse page.');
  const r = await LogStore.update((log) => VerseLog.addTexts(log, items));
  $('paste').value = '';
  note('pasteNote', 'ok', `Added text to ${plural(r.filled, 'logged passage')}` + (r.added ? `; ${plural(r.added, 'new passage')} added.` : '.'));
});
confirmButton($('clearAll'), 'Click again to delete every passage', () => LogStore.save(VerseLog.emptyLog()));

// stay current when the popup (or another tab) changes the log
chrome.storage.onChanged.addListener((changes) => {
  if (changes.verseLog) render();
  if (changes.logFile || changes.keepFile || changes.logOpened) renderFile();
});
if (location.hash === '#paste') $('pasteBox').open = true;
render();
renderFile();
