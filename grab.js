// Shared by popup and service worker: read the page text (selection wins).
(function (root) {
  function pageText() {
    var sel = String(window.getSelection ? window.getSelection() : '').trim();
    return { text: sel || (document.body ? document.body.innerText : ''), selection: !!sel };
  }
  root.grabPageText = async function (tabId) {
    var res = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: pageText });
    return res && res[0] && res[0].result ? res[0].result : { text: '', selection: false };
  };
  // logOpened: add opened references to the verse log; keepFile: mirror it to Downloads.
  root.loadSettings = async function () {
    var s = await chrome.storage.sync.get({ translation: 'ESV', context: false, logOpened: false, keepFile: true });
    return { translation: BibleRefs.cleanTranslation(s.translation).toUpperCase(), context: !!s.context,
      logOpened: s.logOpened === true, keepFile: s.keepFile !== false };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
