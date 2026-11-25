# Verse Opener: this implementation

The choices this version makes. The purpose, values and requirements are in
[CONCEPT.md](CONCEPT.md); anything here can be done differently without changing what
Verse Opener is.

## Platform

- A Chrome extension (Manifest V3), also working in Brave and Edge on a computer.
- **Permissions:** `activeTab` and `scripting` to read the current page's text when the toolbar
  button or shortcut is used; `storage` for settings, the log and practice; `downloads` to write
  the optional Markdown log file. No host permissions and no content scripts.
- No external code, no network requests of its own: it only opens Blue Letter Bible pages as
  ordinary links.

## Where things are

| File | What it does |
|---|---|
| `refs.js` | Finds references in text (book names, abbreviations, ranges, lists, chapters), checks them against verse counts (`versecounts.js`) and builds Blue Letter Bible links. |
| `grab.js` | Reads the page's visible text or the selection, only when invoked. |
| `popup.html`, `popup.js` | The toolbar popup: the list of references, translation, context option, Open and Copy. |
| `background.js` | The Alt+Shift+B shortcut: opens everything without the popup. |
| `verselog.js`, `store.js` | The verse log: entries, the Markdown file format, storage. |
| `log.html`, `log.js` | The Verse log page: view, type or paste text, remove, keep the Markdown file. |
| `practice.html`, `practice.js`, `recall.js` | Practice: phrases, words, typing; progress. |
| `privacy.html` | The privacy policy. |

## Choices

- **Destination:** Blue Letter Bible. One simple passage opens BLB's passage page
  (`search/preSearch.cfm`); anything more opens its Multi-Verse page (`tools/MultiVerse.cfm`),
  which shows every passage in one list. (Checked against the live site on 11 November 2026:
  the passage page mishandles lists and chapter ranges.)
- **Translation:** any Blue Letter Bible code; ESV until changed.
- **Context:** one verse each side, clamped at the ends of a book.
- **Log file:** `Downloads/Scripture memory/verse-log.md`, rewritten in place. The same Markdown
  format (a "Scripture Way-Pack") is read by the stand-alone practice page and other tools.
- **Pasting text:** the paste box reads text copied from Blue Letter Bible's Multi-Verse page
  ("Copy to Clipboard"), with verse labels like `[8:28]` so practice can split it into verses.
- **Practice levels:** Phrases ★, Words ★★ (with decoy words), Type ★★★ (punctuation and
  capitals don't count).

## Tests

- `test/refs.test.js`, `test/recall.test.js`, `test/verselog.test.js`: plain Node.
- `test/browser.test.mjs`: loads the real extension in headless Brave (a Chromium browser) with puppeteer-core and
  checks the popup, opening, the log (including that opening Blue Letter Bible imports no
  verse text, and that pasted text is added), the Markdown file, practice, and that the
  stand-alone practice page makes no outside requests.

Run them with `npm install`, then `npm test`.
