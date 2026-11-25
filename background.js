// Service worker:
//  - Alt+Shift+B: open every reference on the page without showing the popup
//  - keeps Downloads/Scripture memory/verse-log.md in step with the verse log
importScripts('versecounts.js', 'refs.js', 'grab.js', 'verselog.js', 'store.js');

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-all') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const page = await grabPageText(tab.id);
    const refs = BibleRefs.dedupe(BibleRefs.findReferences(page.text));
    if (!refs.length) return flash(tab.id, '0');
    const s = await loadSettings();
    await LogStore.logOpened(refs, s.translation, tab);
    const url = BibleRefs.blbUrl(refs, { translation: s.translation, context: s.context ? 1 : 0 });
    await chrome.tabs.create({ url, index: tab.index + 1 });
  } catch (e) {
    flash(tab.id, '!');   // e.g. browser-internal pages can't be read
  }
});

function flash(tabId, text) {
  chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2500);
}

// --- the Markdown file -------------------------------------------------------
// Extensions can't append to a file on disk, and Brave keeps the File System
// Access API behind a flag, so the whole file is rewritten through the downloads
// API (same name, overwrite) after each change. Then its entry is removed from
// the browser's download list (the file stays).
let timer = null;
function writeSoon(ms) { clearTimeout(timer); timer = setTimeout(writeFile, ms); }

async function writeFile(force) {
  const s = await loadSettings();
  if (!s.keepFile && !force) return;
  const md = VerseLog.toMarkdown(await LogStore.load());
  try {
    await chrome.downloads.download({
      url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md),
      filename: LogStore.FILE, conflictAction: 'overwrite', saveAs: false
    });
  } catch (e) {
    await chrome.storage.local.set({ logFile: { ok: false, error: String(e.message || e), at: Date.now() } });
  }
}

chrome.downloads.onChanged.addListener(async (d) => {
  if (!d.state || (d.state.current !== 'complete' && d.state.current !== 'interrupted')) return;
  const [item] = await chrome.downloads.search({ id: d.id });
  if (!item || item.byExtensionId !== chrome.runtime.id) return;
  const where = item.filename.replace(/\\/g, '/');
  await chrome.storage.local.set({ logFile: d.state.current !== 'complete'
    ? { ok: false, error: item.error || 'interrupted', at: Date.now() }
    : where.endsWith('/' + LogStore.FILE)
      ? { ok: true, path: item.filename, at: Date.now() }
      : { ok: false, renamed: true, path: item.filename, at: Date.now() } });
  chrome.downloads.erase({ id: d.id });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.verseLog) writeSoon(800);
  if (area === 'sync' && changes.keepFile && changes.keepFile.newValue) writeSoon(0);
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg && msg.type === 'write-file-now') { writeFile(true).then(() => respond({ ok: true })); return true; }
});
