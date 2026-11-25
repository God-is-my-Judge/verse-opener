// The verse log lives in chrome.storage.local (it is the master copy); the
// service worker mirrors every change to Downloads/Scripture memory/verse-log.md.
// Used by the popup, the Verse log and Practice pages, and the service worker.
(function (root) {
  'use strict';
  var FILE = 'Scripture memory/verse-log.md';

  async function load() {
    var s = await chrome.storage.local.get({ verseLog: null });
    return s.verseLog && Array.isArray(s.verseLog.entries) ? s.verseLog : VerseLog.emptyLog();
  }
  function save(log) { return chrome.storage.local.set({ verseLog: log }); }
  // fn(log) -> { log, ...counts }; saves the new log and returns the counts.
  async function update(fn) {
    var r = fn(await load());
    await save(r.log);
    return r;
  }
  // Log references the user opened (settings permitting; `always` when the caller
  // has its own checkbox for it).
  async function logOpened(refs, translation, tab, always) {
    if (!refs.length) return null;
    if (!always && !(await loadSettings()).logOpened) return null;
    return update(function (log) {
      return VerseLog.addRefs(log, refs, translation, { source: tab ? { title: tab.title, url: tab.url } : null });
    });
  }

  // What's wrong with the last write of the Markdown file, in words ('' if nothing).
  // Brave asks where to save each download unless that setting is off, so the file
  // can end up under another name, or not be saved at all.
  var ASKS = 'Brave asks where to save each download. To save the file without asking, turn off ' +
    '"Ask where to save each file before downloading" at brave://settings/downloads.';
  function fileProblem(f) {
    if (!f || f.ok) return '';
    if (f.renamed) return 'The verse log file was saved as ' + f.path + ' instead of ' + FILE + '. ' + ASKS;
    if (f.error === 'USER_CANCELED') return 'The verse log file wasn\'t saved (the save was cancelled). ' + ASKS;
    return 'The verse log file couldn\'t be saved (' + f.error + ').';
  }

  root.LogStore = { FILE: FILE, load: load, save: save, update: update, logOpened: logOpened, fileProblem: fileProblem };
})(typeof globalThis !== 'undefined' ? globalThis : this);
