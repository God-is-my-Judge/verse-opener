> Review update, 19 November 2026 (0.3.1): imported source links are validated and
> privacy disclosures now explain browser preference syncing and requests to BLB.
> The one-click text reader remains a permission question; it is not cleared for
> public distribution. See [the review](../LEGAL-AND-IMPROVEMENTS-REVIEW.md) and
> [the local privacy policy](privacy.html).

# Verse Opener (Bible references to Blue Letter Bible)

Not affiliated with Blue Letter Bible. Folder name kept as `bible-ref-blb`.

Browser extension (Chromium: Brave, Chrome, Edge). Click the toolbar button and it
lists every Bible reference on the page, or in your selection if you have text
selected. One click opens them all together on Blue Letter Bible in your translation.
It keeps a running **verse log** (a Markdown file) of what you open, and a
**Practice** page helps you memorise those verses.

## Install for yourself (no account or fee)

1. Open `brave://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode** (top right).
3. **Load unpacked** and choose this folder.
4. Pin the extension from the puzzle-piece menu.

After changing any file here, click ↻ on the extension's card.

## Use

- **Toolbar button**: shows the references found, each with a checkbox. Untick any
  you don't want, then **Open in Blue Letter Bible**.
- **Select text first** to limit the scan to the selection.
- **Translation**: type a Blue Letter Bible code (KJV, NKJV, ESV, NASB20, NASB95,
  LSB, CSB, NIV, NLT, NET, RSV, ASV, YLT, ...). ESV until you change it; your choice
  is remembered.
- **Include one verse before and after**: widens each verse reference by one verse
  each side. It crosses chapter boundaries but never leaves the book
  (Gen 1:1 stays at 1:1, Rev 22:21 stays at 22:21).
- **Alt+Shift+B**: skip the popup and open everything straight away. Change the key
  at `brave://extensions/shortcuts`.
- **Copy**: copies the list (`Jhn 3:16; Rom 8:28-30`) for pasting elsewhere.
- **Save these references to the verse log**: off until you tick it. While ticked, the
  ticked references are added to the verse log when you open or copy them. Your choice is
  remembered (it also applies to Alt+Shift+B).

## Verse log

Every reference you open or copy (popup or Alt+Shift+B), while **Save these
references to the verse log** is ticked, is added to the log, in the translation you opened it in: one entry per passage (per chapter), newest at the
end. Opening the same passage again doesn't duplicate it; the log counts it.

**Getting the verse text** (needed for practice). The extension never takes text from
Blue Letter Bible or any website (0.4.0 removed the old "Save verse text" button). You bring it in:

1. On BLB's **Multi-Verse** page (the extension opens that page when you open several
   references; the Verse log page has a button that opens every passage still
   waiting for text there), use BLB's own **Copy to Clipboard** and paste into the
   Verse log page's paste box. It reads the `[Romans 8:28-30 ESV] – 28 And we know…` lines.
2. Or type or edit the text yourself on the Verse log page.

**The file.** The log is kept in the browser, and after every change it is written to
`Downloads/Scripture memory/verse-log.md` (the whole file rewritten in place).
Edit on the Verse log page, not in the file: the next change overwrites the file. To
bring edits made in the file back, use **Import a .md file** on the Verse log page.
Brave may briefly show its download icon at each rewrite; the file copy can be turned
off on the Verse log page. **Brave asks where to save every download unless you turn
that off**, so with Brave's default settings a Save dialog appears at every rewrite. Turn
off "Ask where to save each file before downloading" at `brave://settings/downloads`,
or turn the file copy off. If the file is saved under another name, or the save is
cancelled, the popup and the Verse log page say so.

**Format.** The file is a "Scripture Way-Pack": each passage with text is a
`## John 3:16 (ESV)` entry with a `###` headline, the text with `[3:16]` verse labels,
and a `#### Metadata` JSON block (log date, how often opened, the page it came from,
without query strings). Passages still waiting for text are listed at the top, where
importers of the format ignore them. Translations other than CSB, LSB and KJV are marked
`CUSTOM` (the real one is kept as `version`). Importers may accept at most 250 passages
per file.

## Practice

Opens from the popup or the Verse log page. Three levels:

| Level | You… |
|---|---|
| Phrases | put about four phrases in order |
| Words | put every word in order, with a few decoy words from your other verses |
| Type it | type it; capitals, punctuation, apostrophes and spacing don't matter |

Each verse has three steps: finish it from its first half, start it from its second
half, then the whole verse from its reference. Completing all three at a level earns
its star (★ phrases, ★★ words, ★★★ typed). Passages with `[8:28]`-style labels are
practised verse by verse. **Next** picks the next verse you haven't done at this level.

**On its own / on a website.** `practice.html` also works outside the extension: open it
from disk or host it, choose `verse-log.md` (or drop it on the page), and it runs
entirely in the browser: the file is read on the device and kept in that browser's
local storage with your progress; nothing is uploaded. To host it, copy these files
together: `practice.html practice.js pages.css recall.js verselog.js refs.js versecounts.js`.
This is the version that works on a phone (phone browsers don't run extensions).

## Sharing it with other people

- **Developer mode / Load unpacked** (as above) works for anyone, but each person has
  to do it, and it doesn't update itself.
- **Chrome Web Store**: the normal route for Brave and Chrome users. One-time US$5
  developer registration, then a review. Brave installs from the Chrome Web Store.
- **Your own website**: Chrome and Brave on Windows and Mac only install extensions
  from the Chrome Web Store, so a download link on your site can't install it for
  them (Linux has an awkward exception). Hosting the Practice page needs no store.
- Blue Letter Bible's [permissions page](https://www.blueletterbible.org/about/permissions.cfm)
  forbids scraping, so 0.4.0 removed the button that read verse text from BLB's page. The
  extension only opens BLB as ordinary links; text gets into the log by typing or pasting.

Permissions: `activeTab` + `scripting` read the page you click the button on;
`storage` holds the log, settings and practice progress; `downloads` writes the file.

## What it recognises

Full book names and common abbreviations, with or without a trailing dot:
`John 3:16`, `Jn 3:16-18`, `1 Cor. 13:4–7`, `I John 1:9`, `First Corinthians 15:3`,
`Rev 21:1-22:5`, `Rom 8:28-30, 35, 38-39`, `John 3:16, 18; 4:5-7`, `Jude 5`,
`Romans 8`, `Genesis 1-3`.

To keep false matches down:

- abbreviations need a capital letter and a verse (`Rom 8:28`, not `Rom 8`);
  whole chapters need the full book name (`Romans 8`);
- chapter and verse numbers are checked against the real size of each book, so
  `John 3:99` and times like `3:16pm` are ignored.

## How it works

| File | What |
|---|---|
| `refs.js` | Finds references, builds BLB links. No network, no page changes |
| `versecounts.js` | Verses per chapter for all 1,189 chapters |
| `verselog.js` | The log: adding references, reading BLB's copied text, Markdown out and in |
| `recall.js` | The practice exercises and checking |
| `store.js`, `grab.js` | Extension storage and settings; reading the page you clicked on |
| `background.js` | Alt+Shift+B, and rewriting `verse-log.md` after each change |
| `popup.*`, `log.*`, `practice.*`, `pages.css` | The three screens |

The links (checked live against blueletterbible.org, 11 Nov 2026):

- one passage (`Jhn 3:16`, `Rom 8:28-30`, `Rom 8`) opens BLB's normal passage page:
  `https://www.blueletterbible.org/search/preSearch.cfm?Criteria=<ref>&t=<translation>`
- anything more opens BLB's Multi-Verse Retrieval tool with every passage on one page:
  `https://www.blueletterbible.org/tools/MultiVerse.cfm?mvText=<refs separated by ;>&t=<translation>`

`preSearch.cfm` can't take a list: `Jhn 3:16; Rom 8:28-30` opened John 3:28-30, and
`Gen 1-3` opened Genesis 1:1-24. Multi-Verse returned all 66 book codes the
extension uses, whole chapters and chapter ranges correctly.

## Tests

From this folder, `npm install` once, then `npm test`, or one at a time:

    node test/refs.test.js        # reference finding, links
    node test/recall.test.js      # practice exercises
    node test/verselog.test.js    # log, pasted BLB text, Markdown (+ Way-Pack import if WAYPACK_IMPORTER_DIST is set)
    node test/browser.test.mjs    # the real extension in headless Brave (BRAVE=/path/to/browser to choose another)

The browser test uses a throwaway profile and temp downloads folder, blocks every
host except 127.0.0.1 (BLB is never contacted; a local page mimics its Multi-Verse
output), and checks the popup, log, file, practice levels and the stand-alone page.
Pass a folder as an argument to save screenshots.

## Not yet verified

Everything above has run in headless Brave 157 except: the real toolbar click
(automation opens the popup another way), the Alt+Shift+B shortcut, Brave's download
icon behaviour, and the Save button on BLB's real Multi-Verse page (tested against a
copy of its layout as seen on 11 Nov 2026).

## Licence

The code is under the [Apache License 2.0](LICENSE). Verse Opener is an independent tool and
isn't affiliated with or endorsed by Blue Letter Bible or any Bible publisher. Bible text you
paste into your own log stays under its translation publisher's terms. What the tool is for,
and its values, are in [CONCEPT.md](CONCEPT.md), so anyone can build their own version.
