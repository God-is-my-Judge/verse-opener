// Drives the real extension in Brave (headless): popup, verse log, Markdown file,
// practice page, and the practice page on its own as a website would serve it.
//
//   node test/browser.test.mjs [screenshot-dir]
//
// Uses a throwaway profile; downloads go to a temp folder, never ~/Downloads; every
// host except 127.0.0.1 is unreachable, so Blue Letter Bible is never contacted.
// Test-only change: the copied manifest gets host access to 127.0.0.1, because a
// real toolbar click (which grants activeTab) can't be made from automation.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAVE = process.env.BRAVE || '/usr/bin/brave-browser';
if (!fs.existsSync(BRAVE)) { console.log('skipped browser test (no Brave at ' + BRAVE + ')'); process.exit(0); }
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..');
const shots = process.argv[2];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blb-ext-'));
const ext = path.join(tmp, 'ext'), profile = path.join(tmp, 'profile'), dl = path.join(tmp, 'downloads');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + what); await sleep(200); }
}
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

fs.cpSync(src, ext, { recursive: true, filter: (p) => !p.includes(`${path.sep}test`) });
const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(manifest));
fs.mkdirSync(path.join(profile, 'Default'), { recursive: true });
fs.mkdirSync(dl);
fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
  download: { default_directory: dl, prompt_for_download: false, directory_upgrade: true }, savefile: { default_directory: dl }
}));
const realDownloads = path.join(os.homedir(), 'Downloads', 'Scripture memory');
const realBefore = fs.existsSync(realDownloads);

// Pages: a "sermon" with references, and the shape of BLB's Multi-Verse results.
const blbFixture = `<!doctype html><title>Multi-Verse Retrieval</title><div id="multiResults">
<div>[John 3:16 ESV] – 16 "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life. <div>&nbsp;</div></div>
<div>[Romans 8:28-30 ESV] – 28 And we know that for those who love God all things work together for good, for those who are called according to his purpose. 29 For those whom he foreknew he also predestined to be conformed to the image of his Son, in order that he might be the firstborn among many brothers. 30 And those whom he predestined he also called, and those whom he called he also justified, and those whom he justified he also glorified.<div>&nbsp;</div></div>
<div>[Psalm 23:1-6 ESV] – 1 The LORD is my shepherd; I shall not want. 2 He makes me lie down in green pastures. He leads me beside still waters. 3 He restores my soul. He leads me in paths of righteousness for his name's sake. 4 Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me. 5 You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows. 6 Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the LORD forever.<div>&nbsp;</div></div>
</div>`;
const requests = [];
const server = http.createServer((req, res) => {
  requests.push(req.url);
  if (req.url === '/sermon') { res.setHeader('content-type', 'text/html'); return res.end('<!doctype html><title>Sunday sermon</title><p>Read John 3:16 and Rom 8:28-30, then Psalm 23.</p>'); }
  if (req.url === '/sermon2') { res.setHeader('content-type', 'text/html'); return res.end('<!doctype html><title>Evening sermon</title><p>Gen 1:1 and Phil 4:13.</p>'); }
  if (req.url === '/blb') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(blbFixture); }
  const f = path.join(ext, decodeURIComponent(req.url.replace(/^\/site\//, '').split('?')[0]));
  if (req.url.startsWith('/site/') && f.startsWith(ext) && fs.existsSync(f)) {
    res.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream');
    return res.end(fs.readFileSync(f));
  }
  res.statusCode = 404; res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: BRAVE, headless: true, pipe: true, enableExtensions: [ext], userDataDir: profile,
  args: ['--no-first-run', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--window-size=900,1000'],
  defaultViewport: { width: 860, height: 900 }
});
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const worker = await swTarget.worker();
  const extId = new URL(swTarget.url()).host;
  const extUrl = (f) => `chrome-extension://${extId}/${f}`;
  const getLog = () => worker.evaluate(async () => (await chrome.storage.local.get({ verseLog: null })).verseLog);

  async function openPopupOn(page) {
    await page.bringToFront();
    await worker.evaluate(() => chrome.action.openPopup());
    const t = await browser.waitForTarget((t) => t.url() === extUrl('popup.html'));
    const popup = await t.asPage();
    await popup.waitForFunction(() => !/Scanning/.test(document.getElementById('status').textContent));
    return popup;
  }

  // 1. a page with references: open them in ESV -> logged, waiting for text
  const page = await browser.newPage();
  await page.goto(base + '/sermon');
  let popup = await openPopupOn(page);
  ok((await popup.$eval('#status', (e) => e.textContent)) === '3 found on this page');
  await popup.$eval('#translation', (e) => { e.value = 'ESV'; e.dispatchEvent(new Event('change')); });
  ok(!(await popup.$eval('#logIt', (e) => e.checked)), 'save-to-log box unticked by default');
  await popup.click('#logIt');
  if (shots) await popup.screenshot({ path: path.join(shots, 'popup.png') });
  await popup.click('#open');
  await sleep(600);
  let log = await getLog();
  ok(log && log.entries.length === 3, 'three passages logged');
  ok(log.entries.every((e) => e.translation === 'ESV' && !e.text && e.source.url === base + '/sermon'));
  ok(log.entries.map((e) => e.title).join('|') === 'John 3:16|Romans 8:28-30|Psalm 23');

  // the Markdown file appears in the (temp) Downloads folder
  const file = path.join(dl, 'Scripture memory', 'verse-log.md');
  for (let i = 0; i < 40 && !fs.existsSync(file); i++) await sleep(150);
  ok(fs.existsSync(file), 'verse-log.md written');
  ok(fs.readFileSync(file, 'utf8').includes('- Romans 8:28-30 (ESV), logged '));

  // 2. on BLB's Multi-Verse page the popup never takes the verse text: nothing is imported
  await page.goto(base + '/blb');
  popup = await openPopupOn(page);
  await sleep(400);
  ok((await popup.$('#capture')) === null && (await popup.$('#captureBtn')) === null, 'no verse-text import in the popup');
  await popup.close();
  log = await getLog();
  ok(log.entries.every((e) => !e.text), 'opening BLB imports no verse text');

  // the person copies the text themselves and pastes it into the verse log
  const copiedByHand = await page.evaluate(() => document.body.innerText);
  const pastePage = await browser.newPage();
  await pastePage.goto(extUrl('log.html#paste'));
  await pastePage.waitForSelector('#paste', { visible: true });
  await pastePage.$eval('#paste', (t, v) => { t.value = v; }, copiedByHand);
  await pastePage.click('#pasteBtn');
  await pastePage.waitForFunction(() => /^Added text/.test(document.getElementById('pasteNote').textContent));
  ok((await pastePage.$eval('#pasteNote', (e) => e.textContent)) === 'Added text to 3 logged passages.');
  await pastePage.close();
  log = await getLog();
  ok(log.entries.every((e) => e.text), 'all three have text');
  ok(log.entries[2].text.startsWith('[23:1] The LORD is my shepherd;') && log.entries[2].text.includes('[23:6] Surely goodness'));
  await sleep(1500);
  const md = fs.readFileSync(file, 'utf8');
  ok(md.includes('## Psalm 23 (ESV)') && !md.includes('Still waiting'), 'file rewritten with text');
  ok(fs.readdirSync(path.join(dl, 'Scripture memory')).length === 1, 'one file, overwritten in place');

  // 3. the Verse log page
  const logPage = await browser.newPage();
  await logPage.goto(extUrl('log.html'));
  await logPage.waitForFunction(() => document.querySelectorAll('.entry').length === 3);
  ok((await logPage.$eval('#count', (e) => e.textContent)) === '3 passages; 3 with text, ready to practise.');
  await logPage.waitForFunction(() => /^Saved to /.test(document.getElementById('fileStatus').textContent));
  if (shots) await logPage.screenshot({ path: path.join(shots, 'log.png'), fullPage: true });

  // 4. Practice: phrases level, all three steps of John 3:16 (one wrong try first)
  const pr = await browser.newPage();
  await pr.goto(extUrl('practice.html'));
  await pr.waitForSelector('#practice', { visible: true });
  ok((await pr.$eval('#refTitle', (e) => e.textContent)) === 'John 3:16 (ESV)');
  const solve = async (wrongFirst) => {
    const answer = await pr.evaluate(() => cur.puzzle.answer);
    const order = wrongFirst ? [...answer].reverse() : answer;
    for (const text of order) {
      await pr.evaluate((t) => [...document.querySelectorAll('#pool .tile:not(.used)')].find((b) => b.textContent === t).click(), text);
    }
    await pr.click('#check');
  };
  await solve(true);
  ok(/^Not yet/.test(await pr.$eval('#feedback', (e) => e.textContent)), 'wrong order is refused');
  while (await pr.evaluate(() => cur.picked.length)) await pr.click('#undo');
  for (let step = 1; step <= 3; step++) {
    ok((await pr.$eval('#stepText', (e) => e.textContent)).startsWith(`Step ${step} of 3 (3:16).`));
    if (step === 2 && shots) {
      const t = await pr.evaluate(() => cur.puzzle.answer[0]);
      await pr.evaluate((x) => [...document.querySelectorAll('#pool .tile')].find((b) => b.textContent === x).click(), t);
      await pr.screenshot({ path: path.join(shots, 'practice-phrases.png') });
      await pr.click('#undo');
    }
    await solve(false);
    if (step < 3) await pr.waitForFunction((s) => document.getElementById('stepText').textContent.startsWith(`Step ${s} of 3`), {}, step + 1);
  }
  ok((await pr.$eval('#feedback', (e) => e.textContent)) === 'Verse learned at the Phrases level. ★☆☆');

  // words level: decoys present; type level: punctuation and capitals don't matter
  await pr.click('.seg button[data-level="words"]');
  const decoys = await pr.evaluate(() => cur.puzzle.pool.filter((t) => !t.correct).length);
  ok(decoys >= 2, 'decoy words at the Words level');
  if (shots) await pr.screenshot({ path: path.join(shots, 'practice-words.png') });
  await pr.click('.seg button[data-level="type"]');
  const hidden = await pr.evaluate(() => cur.ex.hidden);
  await pr.type('#typed', hidden.toLowerCase().replace(/[^a-z ]/g, ''));
  await pr.keyboard.press('Enter');
  ok(/^Right: /.test(await pr.$eval('#feedback', (e) => e.textContent)), 'typed answer accepted');
  const progress = await worker.evaluate(async () => (await chrome.storage.local.get('practice')).practice);
  ok(Object.keys(progress['jhn-3-16-esv'][0].done).length === 4, 'progress saved');

  // 5. the practice page on its own, served like a website, with the .md file chosen by the user
  requests.length = 0;
  const site = await browser.newPage();
  const outside = [];
  site.on('request', (r) => { if (!r.url().startsWith(base)) outside.push(r.url()); });
  await site.goto(base + '/site/practice.html');
  await site.waitForSelector('#loader', { visible: true });
  const input = await site.$('#fileInput');
  await input.uploadFile(file);
  await site.waitForSelector('#practice', { visible: true });
  ok((await site.$$eval('#pick option', (o) => o.length)) === 3, 'stand-alone page reads the file');
  if (shots) await site.screenshot({ path: path.join(shots, 'standalone.png') });
  ok(outside.length === 0, 'no requests leave the page: ' + outside.join(', '));
  await site.reload();
  await site.waitForSelector('#practice', { visible: true });
  ok(true, 'remembers the file on this device');

  // 6. "Save these references to the verse log": unticked, opening logs nothing (and it's remembered)
  const page2 = await browser.newPage();
  await page2.goto(base + '/sermon2');
  popup = await openPopupOn(page2);
  ok(await popup.$eval('#logIt', (e) => e.checked), 'the ticked box is remembered');
  await popup.click('#logIt');
  await popup.click('#open');
  await sleep(600);
  ok((await getLog()).entries.length === 3, 'unticked: nothing logged');
  await page2.bringToFront();
  popup = await openPopupOn(page2);
  ok(!(await popup.$eval('#logIt', (e) => e.checked)), 'the unticked box is remembered');
  ok(await popup.$eval('#fileWarn', (e) => e.style.display === 'none'), 'no file warning while the file is fine');

  // ticked again: Copy logs too. The file can't be written (a folder is in the way):
  // the popup says so.
  fs.rmSync(file);
  fs.mkdirSync(file);
  await browser.defaultBrowserContext().overridePermissions(extUrl(''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await popup.click('#logIt');
  await popup.click('#copy');
  await popup.waitForFunction(() => /Copied/.test(document.getElementById('copy').textContent));
  ok((await popup.$eval('#copy', (e) => e.textContent)) === 'Copied, logged', 'copy with the box ticked logs');
  ok((await getLog()).entries.map((e) => e.title).slice(3).join('|') === 'Genesis 1:1|Philippians 4:13', 'both added');
  await popup.close();
  await until(() => worker.evaluate(async () => (await chrome.storage.local.get('logFile')).logFile.ok === false), 8000, 'failed save noticed');
  const fileWarn = async () => {
    const p = await openPopupOn(page2);
    await p.waitForFunction(() => document.getElementById('fileWarn').style.display === 'block');
    return [p, await p.$eval('#fileWarn', (e) => e.textContent)];
  };
  let [p2, warn] = await fileWarn();
  ok(warn === "The verse log file couldn't be saved (FILE_FAILED).", 'popup warns: ' + warn);
  await p2.close();

  // Saved under another name (Brave's Save dialog given another name): says where, and why.
  // (Set directly: a real Save dialog can't be answered from automation.)
  await worker.evaluate(() => chrome.storage.local.set({ logFile: { ok: false, renamed: true, path: '/home/me/Downloads/Scripture memory/verse-log2.md', at: Date.now() } }));
  [p2, warn] = await fileWarn();
  ok(warn.startsWith('The verse log file was saved as /home/me/Downloads/Scripture memory/verse-log2.md instead of Scripture memory/verse-log.md.') &&
    /turn off "Ask where to save each file before downloading" at brave:\/\/settings\/downloads/.test(warn), 'popup explains a renamed file: ' + warn);
  if (shots) await p2.screenshot({ path: path.join(shots, 'popup-filewarn.png') });
  await p2.close();

  // Older stored logs may predate the import validation: filter again at render.
  await worker.evaluate(async () => {
    const { verseLog } = await chrome.storage.local.get('verseLog');
    verseLog.entries[0].source = { title: 'Untrusted import', url: 'javascript:alert(1)' };
    await chrome.storage.local.set({ verseLog });
  });
  const safety = await browser.newPage();
  await safety.goto(extUrl('log.html'));
  await safety.waitForSelector('.entry');
  ok(await safety.$$eval('.entry a', (links) => links.every((a) => /^https?:/.test(a.href))), 'older stored source links are filtered');
  ok(!await safety.$eval('.entry .meta', (e) => e.textContent.includes('Untrusted import')), 'unsafe provenance omitted');
  ok(fs.existsSync(realDownloads) === realBefore, 'real ~/Downloads untouched');
  console.log(`ok - ${checks} browser checks passed in ${(await browser.version())}`);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
