// Makes the Chrome Web Store images (1280x800 screenshots, 440x280 promo tile) from
// the real extension in headless Brave, with KJV (public domain) sample text.
//
//   node bible-ref-blb/store/make-images.mjs
//
// Writes into bible-ref-blb/store/images/. Throwaway profile; every host except
// 127.0.0.1 is unreachable. Like the browser test, the copied manifest gets host
// access to 127.0.0.1 because automation can't make a real toolbar click.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAVE = process.env.BRAVE || '/usr/bin/brave-browser';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..');
const outDir = path.join(here, 'images');
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verse-opener-img-'));
const ext = path.join(tmp, 'ext'), profile = path.join(tmp, 'profile'), raw = path.join(tmp, 'raw');
fs.mkdirSync(raw);
fs.cpSync(src, ext, { recursive: true, filter: (p) => !/[\\/](test|store)([\\/]|$)/.test(p.slice(src.length)) });
const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(manifest));
fs.mkdirSync(path.join(profile, 'Default'), { recursive: true });
fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
  download: { default_directory: tmp, prompt_for_download: false }
}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sermon = `<!doctype html><html><head><title>Sunday notes: Rest for the weary</title>
<style>body{font:18px/1.6 Georgia,serif;color:#222;background:#fbfaf7;margin:0}
main{max-width:700px;margin:0 auto;padding:48px 32px}h1{font:600 34px system-ui,sans-serif;margin:0 0 8px}
.by{color:#777;font:15px system-ui,sans-serif;margin-bottom:28px}</style></head><body><main>
<h1>Rest for the weary</h1><div class="by">Sunday notes · small group</div>
<p>We began with Psalm 23:1-3 and the picture of the shepherd who leads his sheep beside still waters.</p>
<p>Jesus' invitation in Matt 11:28-30 is the same rest offered to people who are worn out.
It rests on the love described in John 3:16 and the promise of Rom 8:28.</p>
<p>For the week ahead, memorise Phil 4:13 and read Isaiah 40:28-31 slowly, one verse a day.</p>
<p>Questions for discussion: where do you look for rest? What does it mean that he "restoreth my soul"?</p>
</main></body></html>`;
const copied = [
  '[Psalm 23:1-3 KJV] – 1 The LORD is my shepherd; I shall not want. 2 He maketh me to lie down in green pastures: he leadeth me beside the still waters. 3 He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.',
  '[John 3:16 KJV] – 16 For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  '[Romans 8:28 KJV] – 28 And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
  '[Philippians 4:13 KJV] – 13 I can do all things through Christ which strengtheneth me.'
].join('\n');

const pages = new Map();   // composition pages, served so their images load from the same origin
const server = http.createServer((req, res) => {
  if (pages.has(req.url)) { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(pages.get(req.url)); }
  if (req.url === '/notes') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(sermon); }
  const f = path.join(tmp, decodeURIComponent(req.url.split('?')[0]));
  if (req.url.startsWith('/raw/') && f.startsWith(raw) && fs.existsSync(f)) { res.setHeader('content-type', 'image/png'); return res.end(fs.readFileSync(f)); }
  if (req.url.startsWith('/icon')) { res.setHeader('content-type', 'image/png'); return res.end(fs.readFileSync(path.join(src, 'icons', 'icon128.png'))); }
  res.statusCode = 404; res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: BRAVE, headless: true, pipe: true, enableExtensions: [ext], userDataDir: profile,
  args: ['--no-first-run', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 800 }
});
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const worker = await swTarget.worker();
  const extUrl = (f) => `chrome-extension://${new URL(swTarget.url()).host}/${f}`;
  await worker.evaluate(() => chrome.storage.sync.set({ translation: 'KJV', logOpened: true, keepFile: false }));

  // 1. the popup over a page of notes
  const page = await browser.newPage();
  await page.goto(base + '/notes');
  await page.screenshot({ path: path.join(raw, 'notes.png') });
  await worker.evaluate(() => chrome.action.openPopup());
  const popup = await (await browser.waitForTarget((t) => t.url() === extUrl('popup.html'))).asPage();
  await popup.waitForFunction(() => !/Scanning/.test(document.getElementById('status').textContent));
  await popup.screenshot({ path: path.join(raw, 'popup.png') });
  await popup.close();

  // 2. the verse log, with text saved (as from BLB's Multi-Verse page)
  const log = await browser.newPage();
  await log.goto(extUrl('log.html'));
  await log.evaluate((c) => LogStore.update((l) => VerseLog.addTexts(l, VerseLog.parseCopied(c), { source: null })), copied);
  await log.evaluate(() => LogStore.update((l) => VerseLog.addRefs(l, BibleRefs.findReferences('Matt 11:28-30; Isaiah 40:28-31'), 'KJV')));
  await log.waitForFunction(() => document.querySelectorAll('.entry').length === 6);
  await log.evaluate(() => { document.getElementById('fileStatus').textContent = 'Saved to Downloads/Scripture memory/verse-log.md.'; document.getElementById('keepFile').checked = true; });
  await log.screenshot({ path: path.join(raw, 'log.png') });

  // 3. practice: phrases, one tile placed
  const pr = await browser.newPage();
  await pr.goto(extUrl('practice.html'));
  await pr.waitForSelector('#practice', { visible: true });
  await pr.evaluate(() => {
    const sel = document.getElementById('pick');
    const o = [...sel.options].find((x) => /John 3:16/.test(x.textContent));
    if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change')); }
  });
  await sleep(300);
  const first = await pr.evaluate(() => cur.puzzle.answer[0]);
  await pr.evaluate((t) => [...document.querySelectorAll('#pool .tile')].find((b) => b.textContent === t).click(), first);
  await pr.screenshot({ path: path.join(raw, 'practice.png') });
  // typed level, for a second practice shot
  await pr.click('.seg button[data-level="words"]');
  await sleep(300);
  await pr.screenshot({ path: path.join(raw, 'practice-words.png') });

  // Compose the store images: a caption band and the screenshot.
  const comp = await browser.newPage();
  const frame = (img, caption, sub, opts = {}) => `<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;width:1280px;height:800px;overflow:hidden;font-family:system-ui,sans-serif;background:#eef2f7;position:relative}
    .cap{position:absolute;left:0;right:0;top:0;height:120px;background:#1f4e8c;color:#fff;padding:26px 48px}
    .cap h1{margin:0;font-size:34px;font-weight:650}.cap p{margin:6px 0 0;font-size:19px;opacity:.9}
    .shot{position:absolute;left:0;right:0;top:120px;bottom:0;overflow:hidden}
    .shot img.bg{width:1280px;display:block}
    .pop{position:absolute;right:70px;top:26px;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid #c9d2de}
  </style></head><body><div class="cap"><h1>${caption}</h1><p>${sub}</p></div>
  <div class="shot"><img class="bg" src="${base}/raw/${img}">${opts.pop ? `<img class="pop" src="${base}/raw/${opts.pop}">` : ''}</div></body></html>`;
  const shots = [
    ['1-open.png', frame('notes.png', 'Every Bible reference on the page, in one click', 'Untick any you don\'t want, pick your translation, and open them together on Blue Letter Bible.', { pop: 'popup.png' })],
    ['2-log.png', frame('log.png', 'An optional verse log', 'Keep the passages you open, with their text, in the browser and as a Markdown file.')],
    ['3-practice.png', frame('practice.png', 'Practise memorising them', 'Put phrases in order, then every word, then type the verse from memory.')],
    ['4-words.png', frame('practice-words.png', 'Three levels for each verse', 'Phrases, words (with a few decoys from your other verses), and typing it out.')]
  ];
  for (const [name, html] of shots) {
    pages.set('/comp/' + name, html);
    await comp.goto(base + '/comp/' + name, { waitUntil: 'load' });
    await comp.screenshot({ path: path.join(outDir, name), clip: { x: 0, y: 0, width: 1280, height: 800 } });
  }
  await comp.setViewport({ width: 440, height: 280 });
  pages.set('/comp/promo', `<!doctype html><html><body style="margin:0;width:440px;height:280px;background:#1f4e8c;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box">
    <img src="${base}/icon" width="96" height="96">
    <div><div style="font-size:34px;font-weight:700;white-space:nowrap">Verse Opener</div><div style="font-size:17px;opacity:.92;margin-top:6px;line-height:1.35">Every Bible reference on a page, opened together on Blue Letter Bible</div></div>
  </body></html>`);
  await comp.goto(base + '/comp/promo', { waitUntil: 'load' });
  await comp.screenshot({ path: path.join(outDir, 'promo-small-440x280.png'), clip: { x: 0, y: 0, width: 440, height: 280 } });
  console.log('wrote', fs.readdirSync(outDir).join(', '));
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
