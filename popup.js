'use strict';
const $ = (id) => document.getElementById(id);
let refs = [];       // unique references found, in page order
let tabIndex = 0;
let activeTab = null;

function chosen() {
  return refs.filter((_, i) => $('list').querySelector(`input[data-i="${i}"]`).checked);
}
function options() {
  return { translation: BibleRefs.cleanTranslation($('translation').value).toUpperCase(), context: $('context').checked ? 1 : 0 };
}
function refresh() {
  const picked = chosen();
  $('open').disabled = $('copy').disabled = picked.length === 0;
  $('open').textContent = picked.length ? `Open ${picked.length} in Blue Letter Bible` : 'Open in Blue Letter Bible';
  const tooLong = picked.length && BibleRefs.blbUrl(picked, options()).length > 2000;
  $('warn').style.display = tooLong ? 'block' : 'none';
  $('warn').textContent = tooLong ? 'That is a lot of references; the site may cut the list short. Untick some, or use Copy.' : '';
}
function save() {
  const o = options();
  chrome.storage.sync.set({ translation: o.translation, context: !!o.context });
  refresh();
}

async function init() {
  const s = await loadSettings();
  $('translation').value = s.translation;
  $('context').checked = s.context;
  $('logIt').checked = s.logOpened;
  showFileWarning();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  tabIndex = tab ? tab.index : 0;
  showLogCount();
  let page;
  try {
    page = await grabPageText(tab.id);
  } catch (e) {
    $('status').textContent = 'This page can’t be read (browser pages and the extension store are off limits).';
    return;
  }
  refs = BibleRefs.dedupe(BibleRefs.findReferences(page.text));
  const where = page.selection ? 'in your selection' : 'on this page';
  $('status').textContent = refs.length ? `${refs.length} found ${where}` : `No references found ${where}.`;

  const list = $('list');
  refs.forEach((r, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = true; box.dataset.i = i;
    box.addEventListener('change', refresh);
    label.append(box, document.createTextNode(BibleRefs.label(r)));
    li.append(label); list.append(li);
  });
  refresh();
}

async function showLogCount() {
  const log = await LogStore.load();
  const waiting = log.entries.filter((e) => !e.text).length;
  $('logged').textContent = log.entries.length
    ? `${log.entries.length} logged${waiting ? `, ${waiting} need text` : ''}` : '';
}
function openPage(file) { chrome.tabs.create({ url: chrome.runtime.getURL(file), index: tabIndex + 1 }); window.close(); }
$('openLog').addEventListener('click', () => openPage('log.html'));
$('openPractice').addEventListener('click', () => openPage('practice.html'));

function setAll(v) { $('list').querySelectorAll('input').forEach((b) => { b.checked = v; }); refresh(); }
$('all').addEventListener('click', () => setAll(true));
$('none').addEventListener('click', () => setAll(false));
$('translation').addEventListener('change', save);
$('context').addEventListener('change', save);
$('logIt').addEventListener('change', () => chrome.storage.sync.set({ logOpened: $('logIt').checked }));
// the references as cited, without the extra context verses
function logChosen() {
  return $('logIt').checked ? LogStore.logOpened(chosen(), options().translation, activeTab, true) : null;
}
async function showFileWarning() {
  const { logFile } = await chrome.storage.local.get({ logFile: null });
  const text = LogStore.fileProblem(logFile);
  $('fileWarn').textContent = text;
  $('fileWarn').style.display = text ? 'block' : 'none';
}
$('open').addEventListener('click', async () => {
  save();
  await logChosen();
  await chrome.tabs.create({ url: BibleRefs.blbUrl(chosen(), options()), index: tabIndex + 1 });
  window.close();
});
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(BibleRefs.blbQuery(chosen(), options()));
  const r = await logChosen();
  if (r) showLogCount();
  $('copy').textContent = r && r.added ? 'Copied, logged' : 'Copied';
  setTimeout(() => { $('copy').textContent = 'Copy'; }, 1200);
});
init();
