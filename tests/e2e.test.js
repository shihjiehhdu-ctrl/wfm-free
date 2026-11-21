// 預覽模式的端對端測試：node tests/e2e.test.js（需要 playwright）
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '../site');
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.mp3':'audio/mpeg'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
});
const SHOTS = process.env.SHOTS || '';
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctxB = await browser.newContext({viewport:{width:1280, height:900}});
  const page = await ctxB.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|fonts/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const shot = async n => { if (SHOTS) await page.screenshot({path: path.join(SHOTS, n + '.png'), fullPage: false}); };

  // ---- 免費版 ----
  await page.goto(base);
  await page.fill('#tokenIn', 'demo01'); await page.click('#loginBtn');
  await page.waitForSelector('#appView:not([hidden])');
  assert.strictEqual(await page.locator('#unitSel option').count(), 4, 'free has 4 units');
  assert.match(await page.textContent('#tierPill'), /免費版/);
  await page.waitForSelector('.segcard');
  assert.strictEqual(await page.locator('.segcard').count(), 6);
  const s0 = await page.textContent('.segbody');
  assert.ok(/免費版會帶你體驗/.test(s0) && !/第一到三週叫「拆」/.test(s0), 'free script variant');
  await page.click('.segbody .opt >> nth=1');
  assert.ok(await page.locator('.opt.right').count() === 1);
  await page.click('[data-play]');
  await page.waitForFunction(() => /錄音還沒上傳/.test(document.querySelector('.player .state').textContent));
  await shot('01-free-course');
  await page.click('#tab-capture');
  await page.fill('#f-word', 'unhappy');
  await page.waitForSelector('.sug[data-k="un+happy"]');
  await page.click('.sug[data-k="un+happy"]');
  await page.fill('#f-sentence', 'She looked unhappy when the bus left.');
  await page.fill('#f-pm', 'un 不 + happy 快樂'); await page.fill('#f-meaning', '不開心');
  await page.click('#saveBtn');
  await page.waitForSelector('#lastCheck .check.key');
  // 陷阱字
  await page.fill('#f-word', 'uncle'); await page.fill('#f-split', 'un+cle'); await page.fill('#f-sentence', 'My uncle lives here.');
  await page.click('#saveBtn'); await page.waitForSelector('#lastCheck .check.trap');
  assert.ok(await page.locator('#recent [data-ask]').count() === 0, 'no ask in free');
  await shot('02-free-capture');
  await page.click('#tab-wall');
  await page.waitForSelector('#wallPanel .wall[aria-hidden="true"]');
  await page.click('#tab-map'); await page.waitForSelector('#mapPanel svg');
  // W2 的詞素在免費版不會出現在地圖導覽
  assert.strictEqual(await page.locator('.mbtn[data-m="re"]').count(), 0);
  await page.waitForFunction(() => document.querySelector('#syncDot').className === 'sync');
  await page.click('#menuBtn'); await page.click('#logoutBtn');
  await page.waitForSelector('#loginView:not([hidden])');

  // ---- 課程版 ----
  await page.fill('#tokenIn', 'DEMOC1'); await page.click('#loginBtn');
  await page.waitForSelector('#appView:not([hidden])');
  assert.strictEqual(await page.locator('#unitSel option').count(), 15);
  assert.strictEqual(await page.locator('#unitSel option:disabled').count(), 5, 'W11-15 locked');
  await page.selectOption('#unitSel', '9');
  await page.waitForSelector('.segcard');
  assert.ok(/直播/.test(await page.textContent('#v-course')));
  // 打開 W9 任務段，確認課程版的結尾
  await page.click('[data-toggle="w9-s5"]');
  assert.ok(/班級牆/.test(await page.textContent('[data-seg="w9-s5"] .segbody')));
  await page.click('#tab-capture');
  await page.fill('#f-word', 'transportation');
  await page.waitForSelector('.sug[data-k="trans+port+ation"]');
  await page.click('.sug[data-k="trans+port+ation"]');
  assert.strictEqual(await page.inputValue('#f-family'), 'port');
  await page.fill('#f-sentence', 'Public transportation is cheap.');
  await page.click('#saveBtn'); await page.waitForSelector('#lastCheck .check.key');
  await page.click('#lastCheck [data-ask]');
  await page.fill('#askDoubt', 'ation 和 tion 是同一個字尾嗎？');
  await page.click('#askForm button[type=submit]');
  await page.waitForSelector('#askSheet', {state:'hidden'});
  await page.waitForSelector('#recent .tag.asked');
  await page.click('#tab-wall');
  await page.waitForSelector('#wallList .qcard');
  assert.ok(await page.locator('#wallList .qcard.mine').count() >= 1);
  const other = page.locator('#wallList .qcard:not(.mine) [data-rx="same"]').first();
  await other.click();
  await page.waitForSelector('#wallList [data-rx="same"][aria-pressed="true"]');
  await shot('03-course-wall');
  await page.click('#tab-wc'); await page.waitForSelector('table.wc');
  await page.click('#tab-review'); await page.click('[data-a="show"]'); await page.waitForSelector('.card .parts');

  // ---- 老師 ----
  const t = await ctxB.newPage();
  t.on('pageerror', e => errors.push('teacher: ' + e.message));
  await t.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await t.goto(base + 'teacher.html');
  await t.fill('#tc', 'tdemo'); await t.click('#loginForm button');
  await t.waitForSelector('.qitem');
  const item = t.locator('.qitem', {hasText:'transportation'});
  await item.click();
  await t.click('#vSeg [data-v="confirmed"]');
  await t.fill('#note', 'ation 是 tion 的一種長相，前面多了一個 a。');
  await t.click('#saveDone'); await t.waitForSelector('.qitem .st.s2 >> nth=0');
  if (SHOTS) await t.screenshot({path: path.join(SHOTS, '04-teacher.png')});
  await t.click('#tab-live'); await t.selectOption('#lWeek', '9'); await t.selectOption('#lScope', '');
  await t.click('#liveStart'); await t.waitForSelector('#live:not([hidden]) .bigw');
  await t.keyboard.press(' '); await t.waitForSelector('#live .ansbox');
  await t.keyboard.press('ArrowRight');
  if (SHOTS) await t.screenshot({path: path.join(SHOTS, '05-live.png')});
  await t.keyboard.press('Escape'); await t.waitForSelector('#live', {state:'hidden'});
  await t.click('#tab-stats'); await t.waitForSelector('.stat-row');
  if (SHOTS) await t.screenshot({path: path.join(SHOTS, '06-stats.png'), fullPage:true});

  // 學生重新整理：看到老師確認
  await page.reload(); await page.waitForSelector('#appView:not([hidden])');
  await page.click('#tab-capture');
  await page.waitForSelector('#recent .tag.teacher');
  await page.click('#recent [data-word]'); await page.waitForSelector('#wordBox .tnote');
  await shot('07-teacher-verdict');

  // 手機寬度
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390, height:800});
  await page.click('#tab-course');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'no horizontal scroll on phone: ' + overflow);
  await shot('08-phone');

  // apply 預覽
  const a = await browser.newPage();
  await a.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await a.goto(base + 'apply.html');
  await a.fill('#parent', '王媽媽'); await a.fill('#email', 'a@b.com'); await a.fill('#child', '小安'); await a.fill('#classCode', 'DEMO-A');
  await a.check('#agree'); await a.click('#go'); await a.waitForSelector('#done:not([hidden])');
  const href = await a.getAttribute('#openApp', 'href'); assert.match(href, /\?t=[A-Z0-9]{6}$/);
  await a.goto(base + href.slice(2)); await a.waitForSelector('#appView:not([hidden])');
  assert.match(await a.textContent('#tierPill'), /課程版/);

  assert.deepStrictEqual(errors, [], 'console errors');
  console.log('e2e: all tests passed');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
