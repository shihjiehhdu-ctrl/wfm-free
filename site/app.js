/* 我的詞族地圖（免費版／課程版／進階版共用同一份程式）
 * 版本由後端「學生」工作表的「版本」欄決定，登入時回傳 tier、features、pack。
 * 資料流：本機優先（localStorage）→ 背景同步到 Apps Script。
 * Entry 結構與課程版、進階版相同，升級時直接沿用。
 */
(() => {
'use strict';
const cfg = window.WFM_CONFIG || {};
const API = window.WFM_API;
const STORE_KEY = 'wfm.free.v1';
const SCHEMA = 1;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => Date.now();
const POS_LABEL = {n:'名詞', v:'動詞', adj:'形容詞', adv:'副詞', other:'其他'};
const TYPE_LABEL = {pre:'字首', root:'字根', suf:'字尾', base:'字基', cmp:'複合字'};
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------- content pack ---------- */
let PACK, M, MBY, UNITS, COMP;
const mLabel = m => m.label || (m.t === 'pre' ? m.forms[0] + '-' : m.t === 'suf' ? '-' + m.forms[0] : m.forms[0]);

/* ---------- storage ---------- */
let storeOK = true;
function loadLocal(){
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY)); if (d && d.schema === SCHEMA) return d; }
  catch (e) { storeOK = false; }
  return null;
}
function save(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { storeOK = false; $('#storeWarn').hidden = false; }
}
let state = null;
const blankState = (token, child) => ({schema:SCHEMA, token, child, unit:1, entries:[], progress:{}, pending:{up:{}, del:[], progress:false}, lastSync:0});
let ui = {tab:'lesson', seg:null, clarity:'透明', mapSel:null, mapWord:null, review:null};

/* ---------- sync ---------- */
let syncTimer = null, syncing = false;
function markEntry(e){ e.updated = now(); state.pending.up[e.id] = e; save(); scheduleSync(); }
function markDelete(id){ delete state.pending.up[id]; state.pending.del.push(id); save(); scheduleSync(); }
function markProgress(){ state.pending.progress = true; save(); scheduleSync(); }
function hasPending(){ return Object.keys(state.pending.up).length || state.pending.del.length || state.pending.progress; }
function scheduleSync(delay = 1500){ clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, delay); renderSync(); }
async function syncNow(opts){
  if (!state || syncing || !hasPending()) { renderSync(); return true; }
  syncing = true; renderSync();
  const ups = Object.values(state.pending.up), dels = [...state.pending.del], sendProg = state.pending.progress;
  try {
    const out = await API.call('sync', {token:state.token, upserts:ups, deletes:dels, progress: sendProg ? state.progress : null}, opts);
    if (!out.ok) {
      if (out.code === 'bad_token') { syncing = false; forceLogout('這個 token 已失效，請重新登入。'); return false; }
      throw new Error(out.message || 'sync failed');
    }
    ups.forEach(e => { if (state.pending.up[e.id] && state.pending.up[e.id].updated === e.updated) delete state.pending.up[e.id]; });
    state.pending.del = state.pending.del.filter(id => !dels.includes(id));
    if (sendProg) state.pending.progress = false;
    state.lastSync = now(); save();
    syncing = false; renderSync();
    if (hasPending()) scheduleSync(500);
    return true;
  } catch (err) {
    syncing = false; renderSync(true);
    scheduleSync(20000);
    return false;
  }
}
function renderSync(failed){
  const el = $('#syncPill'); if (!el || !state) return;
  el.classList.toggle('warn', !!failed);
  if (syncing) el.textContent = '同步中…';
  else if (failed) el.textContent = '離線，稍後同步';
  else if (hasPending()) el.textContent = '等待同步';
  else el.textContent = state.lastSync ? '已備份' : '';
}
window.addEventListener('online', () => scheduleSync(300));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && state && hasPending()) syncNow({keepalive:true}); });

/* ---------- login ---------- */
function showGate(msg){
  $('#app').hidden = true; $('#gate').hidden = false;
  $('#gErr').textContent = msg || '';
  $('#gDemo').hidden = !API.demo;
  $('#gApply').href = cfg.APPLY_URL || 'apply.html';
  setTimeout(() => $('#gToken').focus(), 30);
}
function forceLogout(msg){ try { localStorage.removeItem(STORE_KEY); } catch (e) {} state = null; showGate(msg); }
function mergeServer(serverEntries, serverProgress){
  const byId = new Map(state.entries.map(e => [e.id, e]));
  (serverEntries || []).forEach(se => {
    if (state.pending.del.includes(se.id)) return;
    const le = byId.get(se.id);
    if (!le || (se.updated || 0) > (le.updated || 0)) byId.set(se.id, se);
  });
  state.entries = [...byId.values()];
  if (serverProgress && !state.pending.progress) {
    Object.entries(serverProgress).forEach(([k, v]) => { if (!state.progress[k] || (v.at || 0) > (state.progress[k].at || 0)) state.progress[k] = v; });
  }
}
async function login(token){
  token = String(token || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!token) { showGate('請輸入 token。'); return; }
  $('#gBtn').disabled = true; $('#gBtn').textContent = '登入中…';
  try {
    const out = await API.call('login', {token});
    if (!out.ok) { showGate(out.message || '找不到這個 token。'); return; }
    const local = loadLocal();
    state = local && local.token === token ? local : blankState(token, out.child);
    applyTier(out);
    mergeServer(out.entries, out.progress);
    await loadPack(state.pack);
    save(); start();
  } catch (err) {
    const local = loadLocal();
    if (local && local.token === token) { state = local; start(); toast('目前離線，先用這台裝置上的紀錄'); }
    else showGate('連不上伺服器，請稍後再試。');
  } finally { $('#gBtn').disabled = false; $('#gBtn').textContent = '開始'; }
}
$('#gateForm').addEventListener('submit', e => { e.preventDefault(); login($('#gToken').value); });

/* ---------- morpheme logic ---------- */
function matchForm(piece, type){ for (const m of M) if (m.t === type && m.forms.includes(piece)) return m; return null; }
function parseSplit(text){
  const pieces = String(text).toLowerCase().split('+').map(s => s.replace(/[^a-z]/g, '')).filter(Boolean);
  return pieces.map((p, i) => {
    const last = i === pieces.length - 1, first = i === 0, many = pieces.length > 1;
    let m = null, t = 'base';
    if (many && first && (m = matchForm(p, 'pre'))) t = 'pre';
    else if (many && last && (m = matchForm(p, 'suf'))) t = 'suf';
    else if ((m = matchForm(p, 'root'))) t = 'root';
    else if (many && !first && !last && (m = matchForm(p, 'pre'))) t = 'pre';
    else m = null;
    return {t, s:p, m: m ? m.id : null};
  });
}
const isCompoundSplit = parts => parts.length === 2 && parts.every(p => p.t === 'base' && p.s.length >= 2);
function familyGuess(parts){
  const root = parts.find(p => p.t === 'root'); if (root) return root.s;
  const base = parts.filter(p => p.t === 'base');
  if (base.length === 1) return base[0].s;
  return '';
}
function suggest(word){
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length < 4) return [];
  const out = new Map();
  const add = (pieces, score) => {
    const key = pieces.join('+');
    if (pieces.length < 2 || pieces.some(x => x.length < 2)) return;
    if (!out.has(key) || out.get(key) < score) out.set(key, score);
  };
  if (COMP[word]) add(COMP[word].split('+'), 6);
  const pres = M.filter(m => m.t === 'pre' && !m.display).flatMap(m => m.forms.map(f => ({f, m})));
  const sufs = M.filter(m => m.t === 'suf' && !m.display).flatMap(m => m.forms.map(f => ({f, m})));
  const roots = M.filter(m => m.t === 'root' && !m.display).flatMap(m => m.forms.map(f => ({f, m})));
  const preOpts = [null, ...pres.filter(p => word.startsWith(p.f) && word.length - p.f.length >= 3)];
  for (const p of preOpts) {
    const r1 = p ? word.slice(p.f.length) : word;
    const sufOpts = [null, ...sufs.filter(s => r1.endsWith(s.f) && r1.length - s.f.length >= 2)];
    for (const s of sufOpts) {
      const mid = s ? r1.slice(0, r1.length - s.f.length) : r1;
      const head = p ? [p.f] : [], tail = s ? [s.f] : [];
      const base = (p ? 2 : 0) + (s ? 2 + s.f.length * .1 : 0) + (p ? p.f.length * .1 : 0);
      if (mid.length >= 2) add([...head, mid, ...tail], base - (mid.length < 3 ? 1 : 0));
      for (const r of roots) {
        const k = mid.indexOf(r.f); if (k < 0) continue;
        const before = mid.slice(0, k), after = mid.slice(k + r.f.length);
        add([...head, ...(before ? [before] : []), r.f, ...(after ? [after] : []), ...tail], base + 3 + r.f.length * .1 - (before.length === 1 ? .5 : 0) - (after.length === 1 ? .5 : 0));
      }
    }
  }
  return [...out.entries()].filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
}
const famNames = ids => ids.map(id => MBY[id] ? mLabel(MBY[id]) : id).join('、');
function checkEntry(word, parts, clarity){
  const used = parts.filter(p => p.m).map(p => p.m);
  const trapFor = PACK.traps[word], keyFor = PACK.key[word], comp = COMP[word];
  if (clarity === '不能拆') {
    if (trapFor) return {kind:'key', msg:`答對了：${word} ${trapFor.includes('cmp') ? '看起來像複合字' : '看起來有 ' + famNames(trapFor)}，其實不能這樣拆。`};
    if (keyFor) return {kind:'mismatch', msg:`課程詞表裡，${word} 是可以拆的，它屬於 ${famNames(keyFor)} 家族。再看看？`};
    if (comp) return {kind:'mismatch', msg:`${word} 是複合字，可以拆成 ${comp.replace('+', ' + ')}。`};
    return {kind:'open', msg:'詞表外的字。你的判斷先保留在地圖上，標成待確認。'};
  }
  if (trapFor && (trapFor.some(id => used.includes(id)) || (trapFor.includes('cmp') && isCompoundSplit(parts))))
    return {kind:'trap', msg:`小心：${word} 看起來${trapFor.includes('cmp') ? '是複合字' : '有 ' + famNames(trapFor)}，但意思接不起來。要改成「不能拆」嗎？`};
  if (keyFor) {
    if (keyFor.some(id => used.includes(id))) return {kind:'key', msg:`符合課程詞表：${word} 屬於 ${famNames(keyFor)} 家族。`};
    return {kind:'mismatch', msg:`課程詞表把 ${word} 放在 ${famNames(keyFor)} 家族。再看看你的拆法？`};
  }
  if (comp) {
    if (parts.map(p => p.s).join('+') === comp) return {kind:'key', msg:`符合課程詞表：${word} 是複合字，${comp.replace('+', ' + ')}。`};
    return {kind:'mismatch', msg:`${word} 是複合字，課程詞表的拆法是 ${comp.replace('+', ' + ')}。`};
  }
  if (isCompoundSplit(parts)) return {kind:'open', msg:'看起來是複合字。詞表裡沒有這個字，先保留你的拆法，標成待確認。'};
  return {kind:'open', msg:'詞表外的字。你的拆法先保留在地圖上，標成待確認。'};
}
function badgeFor(e){
  if (e.check === 'key') return '<span class="badge key">詞表確認</span>';
  if (e.check === 'trap' || e.check === 'mismatch') return '<span class="badge trap">再看看</span>';
  return '<span class="badge open">待確認</span>';
}
const confirmed = e => e.check === 'key';
function partsHTML(parts){
  if (!parts.length) return '<span class="empty">拆好的零件會顯示在這裡</span>';
  return parts.map((p, i) => {
    const m = p.m ? MBY[p.m] : null;
    const note = m ? m.mean : (parts.length === 2 && parts.every(x => x.t === 'base') ? '字' : TYPE_LABEL[p.t]);
    return (i ? '<span class="plus">+</span>' : '') + `<div class="part ${p.t}"><b>${esc(p.s)}</b><span>${esc(note)}</span></div>`;
  }).join('');
}
const inFamily = (e, id) => id === 'cmp' ? !!e.compound : e.parts.some(p => p.m === id);
const countFor = id => state.entries.filter(e => inFamily(e, id)).length;
const unitOf = n => UNITS.find(u => u.unit === n);

/* ---------- header ---------- */
function renderHeader(){
  $('#tierLabel').textContent = state.tierLabel || '免費版';
  $('#tab-wall').classList.toggle('locked-tab', !feat('wall'));
  $('#tab-wall').innerHTML = feat('wall') ? '班級牆' : '班級牆 <span class="lock">課程版</span>';
  $('#unitPick').innerHTML = UNITS.map(u => `<button type="button" data-u="${u.unit}" aria-pressed="${state.unit === u.unit}">W${u.unit}</button>`).join('');
  $('#countPill').textContent = `${state.entries.length} 個字`;
  $('#acctBtn').textContent = state.child || '帳號';
  renderSync();
}
$('#unitPick').addEventListener('click', e => {
  const b = e.target.closest('[data-u]'); if (!b) return;
  state.unit = +b.dataset.u; ui.seg = null; ui.mapSel = null; save(); renderAll();
});

/* ---------- tabs ---------- */
const TABS = ['lesson','capture','map','wc','review','wall'];
const feat = name => !!(state && state.features && state.features[name]);
const ASK_OFF = '提問和班級牆是課程版的功能';
const askBtn = (cls = 'btn btn-quiet', id = '') => feat('ask')
  ? `<button type="button" class="${cls} ask-on" data-ask="${esc(id)}">提問</button>`
  : `<button type="button" class="${cls} ask-off" disabled aria-disabled="true" title="${ASK_OFF}">提問 <span class="lock">課程版</span></button>`;
// 課程版的提問流程之後接在這裡（後端會再檢查版本）
document.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (b) toast('提問功能會在開課時啟用'); });
TABS.forEach(t => $('#tab-' + t).addEventListener('click', () => { ui.tab = t; if (t === 'review') ui.review = null; renderTabs(); renderView(); }));
function renderTabs(){ TABS.forEach(t => { $('#tab-' + t).setAttribute('aria-selected', String(ui.tab === t)); $('#v-' + t).hidden = ui.tab !== t; }); }
function renderView(){
  stopSpeech();
  ({lesson:renderLesson, capture:renderCaptureSide, map:renderMap, wc:renderWC, review:renderReview, wall:renderWall})[ui.tab]();
}

/* ---------- lesson ---------- */
const segDone = s => !!(state.progress[s.id] && state.progress[s.id].done);
function renderLesson(){
  const u = unitOf(state.unit);
  if (!ui.seg || !u.segments.some(s => s.id === ui.seg)) ui.seg = (u.segments.find(s => !segDone(s)) || u.segments[0]).id;
  const done = u.segments.filter(segDone).length;
  $('#segNav').innerHTML = `<span class="stage">W${u.unit} · ${esc(u.stage)}</span><h3>${esc(u.title)}</h3>
    <div class="unitprog" aria-label="完成 ${done} / ${u.segments.length} 段"><span style="width:${done / u.segments.length * 100}%"></span></div>` +
    u.segments.map((s, i) => `<button type="button" class="segbtn ${segDone(s) ? 'done' : ''}" data-s="${s.id}" aria-current="${ui.seg === s.id}">
      <span class="no">${segDone(s) ? '✓' : i}</span><span class="t">${esc(s.title)}</span><span class="min">${s.minutes}′</span></button>`).join('');
  renderSegment();
}
$('#segNav').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; ui.seg = b.dataset.s; renderLesson(); window.scrollTo({top:0}); });
const passageHTML = ps => `<div class="passage" lang="en">${ps.map((t, i) => `<p>${esc(t).replace(/\{\{(.+?)\|(.+?)\}\}/g, (m, w, lemma) => `<button type="button" class="pw" data-w="${lemma}" data-p="${i}">${w}</button>`)}</p>`).join('')}</div>`;
const plainPassage = t => t.replace(/\{\{(.+?)\|.+?\}\}/g, '$1');
const scriptHTML = p => esc(p).replace(/\*(.+?)\*/g, '<em lang="en">$1</em>').replace(/〔停頓 (\d+) 秒〕/g, '<span class="pause">〔停頓 $1 秒〕</span>');
function renderSegment(){
  const u = unitOf(state.unit), i = u.segments.findIndex(s => s.id === ui.seg), s = u.segments[i];
  const pr = state.progress[s.id] || {};
  const answers = pr.answers || {};
  $('#segPanel').innerHTML = `
    <span class="eyebrow">W${u.unit} · 第 ${i} 段 / 共 ${u.segments.length - 1} 段 · 約 ${s.minutes} 分鐘</span>
    <h2>${esc(s.title)}</h2>
    <div class="player">
      <audio id="segAudio" controls preload="metadata" src="${esc(s.audio)}" hidden></audio>
      <div class="fallback" id="segFallback" hidden>
        <button type="button" class="btn btn-quiet" id="speakBtn">▶ 播放講解（瀏覽器語音）</button>
        <span>正式語音檔準備中，先用瀏覽器內建的聲音朗讀。</span>
      </div>
    </div>
    ${s.passage ? `<span class="eyebrow" style="display:block;margin-top:16px">短文 · 點一下畫底線的字，把它帶到「採集」</span>${passageHTML(s.passage)}` : ''}
    <ul class="slides" aria-label="畫面重點">${s.slides.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <details class="script" id="scriptBox"><summary>講解文字</summary>${s.script.map(p => `<p>${scriptHTML(p)}</p>`).join('')}</details>
    ${s.checks.length ? `<div class="checks"><h3>段後檢核</h3>${s.checks.map((c, k) => checkHTML(c, k, answers[k])).join('')}</div>` : ''}
    <div class="segfoot">
      <button type="button" class="btn btn-quiet" data-nav="-1" ${i === 0 ? 'disabled' : ''}>上一段</button>
      ${segDone(s) ? '<span class="badge key">這一段完成了</span>' : `<button type="button" class="btn btn-primary" id="doneBtn">${s.checks.length ? '檢核做完了，標成完成' : '聽完了，標成完成'}</button>`}
      <button type="button" class="btn btn-quiet" data-nav="1" ${i === u.segments.length - 1 ? 'disabled' : ''}>下一段</button>
    </div>
    ${i === u.segments.length - 1 ? `<p class="proto-note">本單元任務：${esc(u.task)}</p>` : ''}`;
  const au = $('#segAudio');
  au.addEventListener('loadedmetadata', () => { au.hidden = false; $('#segFallback').hidden = true; });
  au.addEventListener('error', () => { au.hidden = true; $('#segFallback').hidden = !('speechSynthesis' in window); if (!('speechSynthesis' in window)) $('#scriptBox').open = true; });
  au.addEventListener('ended', () => setSeg(s.id, {heard:true}));
  $('#speakBtn') && $('#speakBtn').addEventListener('click', () => speaking ? stopSpeech() : speak(s));
}
function checkHTML(c, k, ans){
  if (c.type === 'open') return `<div class="q" data-k="${k}"><div class="qt">${k + 1}. ${esc(c.q)}</div>
    <textarea class="in" data-open="${k}" placeholder="用自己的話寫一句">${esc(ans && ans.text || '')}</textarea>
    <div class="actions"><button type="button" class="btn btn-quiet" data-ref="${k}">看參考說法</button></div>
    <div class="fb ok" ${ans && ans.ref ? '' : 'hidden'}>參考說法：${esc(c.ref)}</div></div>`;
  const answered = ans && ans.picked !== undefined;
  return `<div class="q" data-k="${k}"><div class="qt">${k + 1}. ${esc(c.q)}</div><div class="opts">` +
    c.options.map((o, j) => `<button type="button" class="opt ${answered && j === c.answer && ans.picked === j ? 'right' : ''} ${answered && ans.picked === j && j !== c.answer ? 'wrong' : ''}" data-o="${j}">（${'ABCD'[j]}）${esc(o)}</button>`).join('') +
    `</div>${answered ? (ans.picked === c.answer ? `<div class="fb ok">答對了。${esc(c.explain || '')}</div>` : '<div class="fb no">再想一想，也可以重聽這一段，再選一次。</div>') : ''}</div>`;
}
function setSeg(id, patch){ state.progress[id] = {...(state.progress[id] || {}), ...patch, at: now()}; markProgress(); }
$('#segPanel').addEventListener('click', e => {
  const u = unitOf(state.unit), s = u.segments.find(x => x.id === ui.seg);
  const nav = e.target.closest('[data-nav]');
  if (nav) { const i = u.segments.indexOf(s) + +nav.dataset.nav; if (u.segments[i]) { ui.seg = u.segments[i].id; renderLesson(); window.scrollTo({top:0}); } return; }
  if (e.target.id === 'doneBtn') {
    setSeg(s.id, {done:true}); renderLesson(); toast('這一段完成了');
    if (u.segments.every(segDone)) toast(`W${u.unit} 全部完成！到「採集」記下你在書裡找到的字`);
    return;
  }
  const pw = e.target.closest('.pw');
  if (pw) {
    const sentence = plainPassage(s.passage[+pw.dataset.p]).split(/(?<=[.!?:])\s+/).find(x => x.toLowerCase().includes(pw.textContent.toLowerCase())) || plainPassage(s.passage[+pw.dataset.p]);
    resetForm();
    fWord.value = pw.dataset.w; fSplit.value = pw.dataset.w; fSplit.dataset.auto = '1';
    $('#f-sentence').value = sentence.trim(); $('#f-book').value = '示範短文：A City Without Smoke';
    ui.tab = 'capture'; renderTabs(); renderView(); refreshSugs(); refreshParts();
    window.scrollTo({top:0}); fSplit.focus();
    toast(`${pw.dataset.w} 已帶到採集，選一個拆法吧`);
    return;
  }
  const opt = e.target.closest('[data-o]');
  if (opt) {
    const k = +opt.closest('.q').dataset.k;
    const answers = {...((state.progress[s.id] || {}).answers || {})}; answers[k] = {picked: +opt.dataset.o};
    setSeg(s.id, {answers}); renderSegment(); return;
  }
  const ref = e.target.closest('[data-ref]');
  if (ref) {
    const k = +ref.dataset.ref; const answers = {...((state.progress[s.id] || {}).answers || {})};
    answers[k] = {...(answers[k] || {}), ref:true, text: $(`[data-open="${k}"]`).value.slice(0, 300)};
    setSeg(s.id, {answers}); renderSegment();
  }
});
$('#segPanel').addEventListener('change', e => {
  const ta = e.target.closest('[data-open]'); if (!ta) return;
  const s = unitOf(state.unit).segments.find(x => x.id === ui.seg);
  const k = +ta.dataset.open; const answers = {...((state.progress[s.id] || {}).answers || {})};
  answers[k] = {...(answers[k] || {}), text: ta.value.slice(0, 300)}; setSeg(s.id, {answers});
});

/* browser speech fallback: Chinese runs in zh-TW, *English* runs in en-US, 〔停頓 N 秒〕 as real pauses */
let speaking = false, speechTimer = null;
function voiceFor(lang){
  const vs = speechSynthesis.getVoices();
  return vs.find(v => v.lang === lang) || vs.find(v => v.lang.replace('_', '-').startsWith(lang.slice(0, 2))) || null;
}
function speechQueue(s){
  const q = [];
  s.script.forEach(p => {
    p.split(/(\*[^*]+\*|〔停頓 \d+ 秒〕)/).filter(Boolean).forEach(run => {
      const pm = run.match(/〔停頓 (\d+) 秒〕/);
      if (pm) q.push({pause: +pm[1] * 1000});
      else if (run.startsWith('*')) q.push({text: run.slice(1, -1), lang:'en-US'});
      else if (run.trim()) q.push({text: run, lang:'zh-TW'});
    });
    q.push({pause: 600});
  });
  return q;
}
function speak(s){
  stopSpeech(); speaking = true;
  const q = speechQueue(s); let i = 0;
  const btn = $('#speakBtn'); if (btn) btn.textContent = '■ 停止';
  const next = () => {
    if (!speaking) return;
    if (i >= q.length) { stopSpeech(); setSeg(s.id, {heard:true}); return; }
    const it = q[i++];
    if (it.pause) { speechTimer = setTimeout(next, it.pause); return; }
    const u = new SpeechSynthesisUtterance(it.text);
    u.lang = it.lang; const v = voiceFor(it.lang); if (v) u.voice = v;
    u.rate = it.lang === 'en-US' ? .92 : 1;
    u.onend = next; u.onerror = next;
    speechSynthesis.speak(u);
  };
  next();
}
function stopSpeech(){
  speaking = false; clearTimeout(speechTimer);
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  const btn = $('#speakBtn'); if (btn) btn.textContent = '▶ 播放講解（瀏覽器語音）';
}

/* ---------- capture ---------- */
const fWord = $('#f-word'), fSplit = $('#f-split'), fPos = $('#f-pos'), fFam = $('#f-family');
let famTouched = false, posTouched = false;
function refreshSugs(){
  const w = fWord.value.trim(), box = $('#sugs');
  if (!w) { box.innerHTML = '<span class="hint">輸入單字後，這裡會出現可用的拆法。</span>'; return; }
  const s = suggest(w);
  box.innerHTML = s.map(k => `<button type="button" class="sug" data-k="${esc(k)}">${esc(k)}</button>`).join('') +
    `<button type="button" class="sug none" data-k="${esc(w.toLowerCase())}" data-whole="1">不能拆</button>` +
    (s.length ? '' : '<span class="hint">三個單元的詞素裡沒有找到可用的拆法，可以自己拆，或標成不能拆。</span>');
}
function refreshParts(){
  const parts = parseSplit(fSplit.value);
  $('#partsPreview').innerHTML = partsHTML(parts);
  if (!famTouched) fFam.value = familyGuess(parts);
  if (!posTouched) { const suf = [...parts].reverse().find(p => p.t === 'suf'); if (suf && MBY[suf.m] && MBY[suf.m].pos) fPos.value = MBY[suf.m].pos; }
}
fWord.addEventListener('input', () => { $('#checkBox').innerHTML = ''; refreshSugs(); if (!fSplit.value || fSplit.dataset.auto) { fSplit.value = fWord.value.trim().toLowerCase(); fSplit.dataset.auto = '1'; refreshParts(); } });
fSplit.addEventListener('input', () => { delete fSplit.dataset.auto; refreshParts(); });
fFam.addEventListener('input', () => { famTouched = true; });
fPos.addEventListener('change', () => { posTouched = true; });
$('#sugs').addEventListener('click', e => {
  const b = e.target.closest('.sug'); if (!b) return;
  fSplit.value = b.dataset.k; delete fSplit.dataset.auto;
  if (b.dataset.whole) setClarity('不能拆'); else if (ui.clarity === '不能拆') setClarity('透明');
  refreshParts();
});
function setClarity(v){ document.querySelectorAll('#clarity button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); ui.clarity = v; }
$('#clarity').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setClarity(b.dataset.v); });
function showCheck(entry, res){
  const box = $('#checkBox');
  const title = {key:'確認了', trap:'可能是陷阱字', mismatch:'再看看你的拆法', open:'待確認'}[res.kind];
  const btns = [];
  if (res.kind === 'trap') btns.push('<button type="button" class="btn btn-quiet" data-fix="whole">改成不能拆</button>');
  if (res.kind === 'mismatch' || res.kind === 'trap') btns.push('<button type="button" class="btn btn-quiet" data-fix="edit">重新拆</button>');
  if (res.kind !== 'key') btns.push(askBtn('btn btn-quiet', entry.id));
  box.innerHTML = `<div class="check ${res.kind === 'mismatch' ? 'trap' : res.kind}"><span class="ct">${esc(entry.word)}：${title}</span><span>${esc(res.msg)}</span>${btns.length ? `<div class="actions">${btns.join('')}</div>` : ''}</div>`;
  box.dataset.id = entry.id;
}
$('#checkBox').addEventListener('click', e => {
  const b = e.target.closest('[data-fix]'); if (!b) return;
  const en = state.entries.find(x => x.id === $('#checkBox').dataset.id); if (!en) return;
  if (b.dataset.fix === 'whole') {
    en.parts = [{t:'base', s:en.word, m:null}]; en.clarity = '不能拆'; en.family = ''; en.compound = false;
    const r = checkEntry(en.word, en.parts, en.clarity); en.check = r.kind; markEntry(en); showCheck(en, r); renderCaptureSide();
  } else {
    state.entries = state.entries.filter(x => x.id !== en.id); markDelete(en.id);
    fWord.value = en.word; refreshSugs(); fSplit.value = en.parts.map(p => p.s).join('+'); delete fSplit.dataset.auto; refreshParts();
    $('#f-gloss').value = en.gloss || ''; $('#f-meaning').value = en.meaning || ''; $('#f-book').value = en.book || ''; $('#f-sentence').value = en.sentence || '';
    $('#checkBox').innerHTML = ''; renderHeader(); renderCaptureSide(); fSplit.focus();
  }
});
function resetForm(){
  $('#capForm').reset(); fSplit.dataset.auto = '1'; famTouched = posTouched = false; setClarity('透明');
  refreshSugs(); refreshParts(); $('#formErr').textContent = ''; $('#checkBox').innerHTML = '';
}
$('#resetBtn').addEventListener('click', resetForm);
$('#capForm').addEventListener('submit', e => {
  e.preventDefault();
  const word = fWord.value.trim().toLowerCase().replace(/[^a-z\-]/g, '');
  if (!word) { $('#formErr').textContent = '先輸入一個單字。'; fWord.focus(); return; }
  const parts = ui.clarity === '不能拆' ? [{t:'base', s:word, m:null}] : parseSplit(fSplit.value || word);
  const joined = parts.map(p => p.s).join('');
  if (ui.clarity !== '不能拆' && joined !== word.replace(/-/g, '')) { $('#formErr').textContent = `拆法合起來是「${joined}」，和單字「${word}」不一樣，請檢查。`; return; }
  const res = checkEntry(word, parts, ui.clarity);
  const entry = {id:'e' + now().toString(36) + Math.random().toString(36).slice(2, 6), word, parts,
    pos: fPos.value, gloss: $('#f-gloss').value.trim().slice(0, 200), meaning: $('#f-meaning').value.trim().slice(0, 300), clarity: ui.clarity,
    book: $('#f-book').value.trim().slice(0, 120), sentence: $('#f-sentence').value.trim().slice(0, 500),
    family: ui.clarity === '不能拆' ? '' : fFam.value.trim().toLowerCase().slice(0, 40),
    compound: ui.clarity !== '不能拆' && (isCompoundSplit(parts) || !!COMP[word]),
    unit: state.unit, check: res.kind, ts: now(), ease:0, tier:'free'};
  state.entries.push(entry); markEntry(entry);
  const keepBook = entry.book;
  resetForm(); $('#f-book').value = keepBook; showCheck(entry, res); renderHeader(); renderCaptureSide();
});
function renderCaptureSide(){
  const u = unitOf(state.unit);
  $('#unitEyebrow').textContent = `W${u.unit} · ${u.stage}`;
  $('#unitTitle').textContent = u.title;
  $('#unitTask').textContent = u.task;
  $('#unitMorphs').innerHTML = u.morphemes.map(id => MBY[id]).map(m =>
    `<div class="mrow"><span class="f">${esc(mLabel(m))}</span><span class="mean">${esc(m.mean)}</span><span class="n">${countFor(m.id)} 個</span></div>`).join('');
  const rec = [...state.entries].sort((a, b) => b.ts - a.ts).slice(0, 8);
  $('#recent').innerHTML = rec.length ? rec.map(e => `<li><span class="w">${esc(e.word)}</span><span class="meta">${esc(e.parts.map(p => p.s).join(' + '))}</span>${badgeFor(e)}${e.check !== 'key' ? askBtn('share', e.id) : ''}</li>`).join('')
    : '<li><span class="meta">還沒有紀錄。先聽完講解，再從正在讀的書裡找第一個字。</span></li>';
}

/* ---------- map ---------- */
function renderMap(){
  if (!ui.mapSel || !MBY[ui.mapSel] || MBY[ui.mapSel].display) {
    const own = unitOf(state.unit).morphemes;
    ui.mapSel = own.map(id => [id, countFor(id)]).sort((a, b) => b[1] - a[1])[0][0];
  }
  const groups = [];
  M.filter(m => !m.display).forEach(m => { let g = groups.find(x => x.field === m.field); if (!g) groups.push(g = {field:m.field, items:[]}); g.items.push(m); });
  $('#mnav').innerHTML = groups.map(g => `<div class="group"><h3>${esc(g.field)}</h3>` + g.items.map(m =>
    `<button type="button" class="mbtn" data-id="${m.id}" aria-current="${ui.mapSel === m.id}"><span class="f">${esc(mLabel(m))}</span><span class="mean">${esc(m.mean)}</span><span class="n">${countFor(m.id)}</span></button>`).join('') + '</div>').join('');
  const m = MBY[ui.mapSel];
  const mine = state.entries.filter(e => inFamily(e, m.id));
  const mineWords = new Set(mine.map(e => e.word));
  const nodes = [...mine.map(e => ({w:e.word, id:e.id, mine:true, pending:!confirmed(e)})), ...m.anchors.filter(a => !mineWords.has(a)).map(a => ({w:a, mine:false}))];
  const myTraps = state.entries.filter(e => e.clarity === '不能拆' && (PACK.traps[e.word] || []).includes(m.id)).map(e => e.word);
  $('#mapPanel').innerHTML = `
    <div class="map-head"><span class="big">${esc(mLabel(m))}</span><span class="mean">＝ ${esc(m.mean)}</span><span class="eyebrow">W${m.unit} · ${esc(TYPE_LABEL[m.t])}</span></div>
    <div class="svgbox">${mapSVG(m, nodes)}</div>
    <div class="legend"><span><i style="background:#08333B"></i>我找到的字（詞表確認）</span><span><i style="background:#E8A33D"></i>我找到的字（待確認）</span><span><i style="background:#fff;border:1.5px dashed #5C7077"></i>課程錨點詞，還沒收集</span></div>
    ${m.traps.length ? `<p class="sub" style="margin:14px 0 0">陷阱字：看起來${m.t === 'cmp' ? '拼得起來' : '有 ' + esc(mLabel(m))}，其實意思接不起來${myTraps.length ? `。你已經抓到 ${myTraps.length} 個` : ''}</p><div class="traps">${[...new Set([...m.traps, ...myTraps])].map(t => `<span class="trap">${esc(t)}${myTraps.includes(t) ? ' ✓' : ''}</span>`).join('')}</div>` : ''}
    <div class="detail" id="mapDetail" ${ui.mapWord ? '' : 'hidden'}></div>`;
  if (ui.mapWord) renderDetail(ui.mapWord);
}
function mapSVG(m, nodes){
  const W = 680, H = 460, cx = W / 2, cy = H / 2, n = nodes.length, two = n > 12, out = [];
  const center = m.t === 'cmp' ? '複合字' : m.forms[0];
  out.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(mLabel(m))} 詞族地圖，共 ${n} 個字">`);
  const pos = nodes.map((nd, i) => { const r = two ? (i % 2 ? 200 : 140) : 170, a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1); return {x: cx + r * Math.cos(a) * 1.28, y: cy + r * Math.sin(a) * .92}; });
  nodes.forEach((nd, i) => out.push(`<line x1="${cx}" y1="${cy}" x2="${pos[i].x.toFixed(1)}" y2="${pos[i].y.toFixed(1)}" stroke="${nd.mine ? '#9FB8BD' : '#D7E4E5'}" stroke-width="1.5" ${nd.mine ? '' : 'stroke-dasharray="4 4"'}/>`));
  out.push(`<circle cx="${cx}" cy="${cy}" r="58" fill="#08333B"/>`);
  out.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="IBM Plex Mono, Noto Serif TC, monospace" font-weight="600" font-size="22" fill="#E8A33D">${esc(center)}</text>`);
  out.push(`<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="13" fill="#C4D7DB">${esc(m.mean.length > 8 ? m.mean.slice(0, 8) + '…' : m.mean)}</text>`);
  nodes.forEach((nd, i) => {
    const w = Math.max(56, nd.w.length * 9.2 + 24), h = 32, x = pos[i].x - w / 2, y = pos[i].y - h / 2;
    const fill = nd.mine ? (nd.pending ? '#E8A33D' : '#08333B') : '#FFFFFF', txt = nd.mine ? (nd.pending ? '#08333B' : '#FFFFFF') : '#5C7077', stroke = nd.mine ? fill : '#5C7077';
    const attrs = nd.mine ? `class="node" data-id="${esc(nd.id)}" tabindex="0" role="button" aria-label="${esc(nd.w)}" style="cursor:pointer"` : '';
    out.push(`<g ${attrs}><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${nd.mine ? '' : 'stroke-dasharray="4 3"'}/><text x="${pos[i].x.toFixed(1)}" y="${(pos[i].y + 5).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="15" font-weight="${nd.mine ? 600 : 400}" fill="${txt}">${esc(nd.w)}</text></g>`);
  });
  if (!n) out.push(`<text x="${cx}" y="${cy + 110}" text-anchor="middle" font-size="14" fill="#5C7077">還沒有字。回到「採集」，在書裡找一個這個家族的字。</text>`);
  out.push('</svg>');
  return out.join('');
}
$('#mnav').addEventListener('click', e => { const b = e.target.closest('.mbtn'); if (!b) return; ui.mapSel = b.dataset.id; ui.mapWord = null; renderMap(); });
function pickNode(e){ const g = e.target.closest('.node'); if (!g) return; ui.mapWord = g.dataset.id; renderDetail(ui.mapWord); }
$('#mapPanel').addEventListener('click', pickNode);
$('#mapPanel').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.node')) { e.preventDefault(); pickNode(e); } });
function renderDetail(id){
  const box = $('#mapDetail'); if (!box) return;
  const en = state.entries.find(x => x.id === id);
  if (!en) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <div class="dw">${esc(en.word)}</div>
    <div class="parts" style="margin-top:10px">${partsHTML(en.parts)}</div>
    ${en.sentence ? `<div class="quote">${esc(en.sentence)}</div>` : ''}
    ${en.gloss ? `<p style="margin:10px 0 0"><b>零件的意思：</b>${esc(en.gloss)}</p>` : ''}
    ${en.meaning ? `<p style="margin:6px 0 0"><b>在句子裡：</b>${esc(en.meaning)}</p>` : ''}
    <div class="kv" style="margin-top:10px"><span>詞性 <b>${esc(POS_LABEL[en.pos] || '')}</b></span><span>透明度 <b>${esc(en.clarity)}</b></span><span>狀態 ${badgeFor(en)}</span>${en.book ? `<span>出處 <b>${esc(en.book)}</b></span>` : ''}<span>記錄於 <b>W${en.unit}</b></span></div>
    <div class="actions" style="margin-top:12px">${en.check !== 'key' ? askBtn('btn btn-quiet', en.id) : ''}<button type="button" class="danger" id="delWord">刪除這個字</button><span id="delConfirm"></span></div>`;
  $('#delWord').addEventListener('click', () => {
    $('#delConfirm').innerHTML = '確定刪除？ <button type="button" class="danger" id="delYes">刪除</button> <button type="button" class="btn btn-quiet" style="padding:4px 12px;font-size:.84rem" id="delNo">保留</button>';
    $('#delYes').addEventListener('click', () => { state.entries = state.entries.filter(x => x.id !== id); markDelete(id); ui.mapWord = null; renderHeader(); renderMap(); toast('已刪除'); });
    $('#delNo').addEventListener('click', () => { $('#delConfirm').innerHTML = ''; });
  });
}

/* ---------- word-class table ---------- */
function renderWC(){
  const fams = new Map();
  state.entries.filter(e => e.family && e.clarity !== '不能拆').forEach(e => { if (!fams.has(e.family)) fams.set(e.family, []); fams.get(e.family).push(e); });
  const rows = [...fams.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const cols = ['n','v','adj','adv'];
  $('#wcPanel').innerHTML = `<span class="eyebrow">詞性表</span><h2>同一個字族，換一個字尾就換一個詞性</h2>
    <p class="sub">空格是還沒找到的形式。下次在書裡遇到，就把它補上。W4 之後，這張表會越來越完整。</p>
    ${rows.length ? `<div class="tablebox"><table class="wc"><thead><tr><th>詞族</th>${cols.map(c => `<th>${POS_LABEL[c]}</th>`).join('')}</tr></thead><tbody>` +
      rows.map(([fam, es]) => {
        const m = M.find(x => x.t === 'root' && x.forms.includes(fam));
        return `<tr><th class="base">${esc(fam)}<small>${m ? esc(m.mean) : es.length + ' 個字'}</small></th>` + cols.map(c => {
          const ws = es.filter(e => e.pos === c);
          return ws.length ? `<td>${ws.map(e => `<span class="w">${esc(e.word)}</span>`).join('')}</td>` : '<td class="miss">還沒找到</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="locked"><div class="big">還沒有字族</div>採集時填上「歸入詞族」，這裡就會出現。例如 development 的詞族填 develop。</div>'}`;
}

/* ---------- review ---------- */
function startReview(){
  const pool = state.entries.filter(e => e.clarity !== '不能拆' && e.parts.length > 1).sort((a, b) => (a.ease || 0) - (b.ease || 0) || a.ts - b.ts).slice(0, 10);
  ui.review = {queue: pool.map(e => e.id), i:0, shown:false, known:0};
}
function renderReview(){
  const panel = $('#reviewPanel');
  if (!ui.review) startReview();
  const r = ui.review;
  if (!r.queue.length) { panel.innerHTML = '<div class="locked"><div class="big">還沒有可以複習的字</div>先在「採集」記下幾個拆得開的字。</div>'; return; }
  if (r.i >= r.queue.length) {
    panel.innerHTML = `<div class="card"><span class="eyebrow">這一輪結束</span><div class="word" style="font-family:var(--display)">${r.known} / ${r.queue.length}</div><p class="prompt">記得的字會慢慢排到後面，不熟的字下次會先出現。</p><div class="actions"><button class="btn btn-primary" type="button" id="again">再來一輪</button></div></div>`;
    $('#again').addEventListener('click', () => { ui.review = null; renderReview(); });
    return;
  }
  const en = state.entries.find(x => x.id === r.queue[r.i]);
  if (!en) { r.i++; renderReview(); return; }
  panel.innerHTML = `<div class="card">
    <span class="eyebrow">拆拆看 · 第 ${r.i + 1} / ${r.queue.length} 個</span>
    <div class="progress" aria-hidden="true"><span style="width:${(r.i / r.queue.length) * 100}%"></span></div>
    <div class="word">${esc(en.word)}</div>
    ${en.sentence ? `<div class="detail"><div class="quote">${esc(en.sentence)}</div></div>` : ''}
    <p class="prompt">${r.shown ? '對照一下你的拆法和意思。' : '先在心裡拆開它：有哪些零件？在這句話裡是什麼意思？'}</p>
    ${r.shown ? `<div class="parts">${partsHTML(en.parts)}</div>${en.gloss ? `<p class="sub" style="margin:8px 0 0">${esc(en.gloss)}</p>` : ''}${en.meaning ? `<p class="meaning">${esc(en.meaning)}</p>` : ''}` : ''}
    <div class="actions">${r.shown ? '<button class="btn btn-quiet" type="button" data-a="again">再練習</button><button class="btn btn-primary" type="button" data-a="know">記得了</button>' : '<button class="btn btn-primary" type="button" data-a="show">看答案</button>'}</div></div>`;
}
$('#reviewPanel').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || !ui.review) return;
  const r = ui.review, en = state.entries.find(x => x.id === r.queue[r.i]);
  if (b.dataset.a === 'show') r.shown = true;
  else {
    if (en) { en.ease = Math.max(0, (en.ease || 0) + (b.dataset.a === 'know' ? 1 : -1)); markEntry(en); }
    if (b.dataset.a === 'know') r.known++;
    r.i++; r.shown = false;
  }
  renderReview();
});

/* ---------- class wall (course tier; shown disabled in the free tier) ---------- */
const WALL_PREVIEW = [
  {by:'小安', word:'passport', split:'pass + port', sentence:'Keep your passport in a safe place.', doubt:'這裡的 port 是港口，還是搬運？', same:3, status:'已回答',
   answer:'兩個都對：port 原本就是「貨物和人進出、被搬運的地方」。passport 是讓你「通過港口」的文件。'},
  {by:'Leo', word:'important', split:'im + port + ant', sentence:'It is important to drink water.', doubt:'拆得開，可是意思好像對不上？', same:2, status:'排入直播'},
  {by:'芮芮', word:'unemployment', split:'un + employ + ment', sentence:'Unemployment rose last year.', doubt:'un 和 ment 一起出現，要先拆哪一個？', same:1, status:'待回答'}
];
function renderWall(){
  if (feat('wall')) {
    $('#wallPanel').innerHTML = `<span class="eyebrow">班級牆 · ${esc(state.classCode || '尚未加入班級')}</span>
      <h2>這一班的提問會出現在這裡</h2>
      <p class="sub">班級牆會在開課時啟用。到時候，你按「提問」送出的字，會和同學的問題一起出現在這裡，老師會在每週直播回答。</p>
      <div class="locked"><div class="big">還沒有提問</div>開課後，第一個問題就從你在書裡找到的字開始。</div>`;
    return;
  }
  $('#wallPanel').innerHTML = `
    <div class="wall-lock">
      <span class="eyebrow">課程版功能</span>
      <h2>班級牆：把拿不準的字，變成全班的問題</h2>
      <p class="sub">課程版的學生加入班級後，可以把拿不準的字按「提問」送到班級牆。同學可以按「我也這樣想」，老師會在每週直播一題一題回答，回答後地圖上的狀態也會更新。</p>
      <div class="actions"><a class="btn btn-primary" href="${esc(cfg.COURSE_URL || '#')}" target="_blank" rel="noopener">了解課程版</a>
        <button type="button" class="btn btn-quiet" disabled aria-disabled="true">輸入班級代碼 <span class="lock">課程版</span></button></div>
    </div>
    <p class="proto-note">下面是班級牆的樣子（示意，無法操作）：</p>
    <div class="posts preview" aria-hidden="true">${WALL_PREVIEW.map(p => `
      <article class="post">
        <div class="ph"><span class="pw">${esc(p.word)}</span><span class="qstatus">${esc(p.status)}</span><span class="by">${esc(p.by)}</span></div>
        <div class="meta mono">${esc(p.split)}</div>
        <div class="ps">${esc(p.sentence)}</div>
        <div class="doubt"><b>不確定的地方</b>${esc(p.doubt)}</div>
        ${p.answer ? `<div class="answer confirmed"><span class="ah">老師回答 · 直播</span><p>${esc(p.answer)}</p></div>` : ''}
        <div class="votes"><button type="button" class="vote" disabled tabindex="-1">我也這樣想 ${p.same}</button><button type="button" class="vote" disabled tabindex="-1">我有不同看法 0</button></div>
      </article>`).join('')}</div>`;
}

/* ---------- account ---------- */
const acct = $('#acctSheet');
$('#acctBtn').addEventListener('click', () => {
  $('#acctTitle').textContent = state.child || '我的帳號';
  $('#acctInfo').textContent = '紀錄會自動備份。換裝置時，用同一個 token 登入就能看到。';
  const done = UNITS.map(u => `W${u.unit} ${u.segments.filter(segDone).length}/${u.segments.length} 段`).join('　');
  $('#acctKv').innerHTML = `<span>Token <b class="mono">${esc(state.token)}</b></span><span>字數 <b>${state.entries.length}</b></span><span>課程 <b>${esc(done)}</b></span><span>最後備份 <b>${state.lastSync ? new Date(state.lastSync).toLocaleString('zh-TW') : '尚未'}</b></span>`;
  $('#acctErr').textContent = ''; acct.hidden = false;
});
$('#acctClose').addEventListener('click', () => { acct.hidden = true; });
acct.addEventListener('click', e => { if (e.target === acct) acct.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') acct.hidden = true; });
$('#syncNow').addEventListener('click', async () => { const ok = await syncNow(); $('#acctErr').textContent = ok ? '' : '目前連不上伺服器，紀錄先存在這台裝置，稍後會自動同步。'; if (ok) toast('已同步'); });
$('#logout').addEventListener('click', async () => {
  if (hasPending()) { const ok = await syncNow(); if (!ok) { $('#acctErr').textContent = '還有紀錄沒有同步，請連上網路後再登出。'; return; } }
  acct.hidden = true; forceLogout('已登出。');
});

/* ---------- boot ---------- */
function renderAll(){ renderHeader(); renderTabs(); renderView(); refreshSugs(); refreshParts(); }
function start(){
  $('#gate').hidden = true; $('#app').hidden = false;
  if (!storeOK) $('#storeWarn').hidden = false;
  fSplit.dataset.auto = '1';
  renderAll();
  if (hasPending()) scheduleSync(800);
}
/* ---------- tier: which version this student sees ---------- */
const DEFAULT_PACK = cfg.CONTENT_URL || 'content/free.json';
let packUrl = null;
function applyTier(out){
  state.child = out.child;
  state.tier = out.tier || 'free';
  state.tierLabel = out.tierLabel || '免費版';
  state.features = out.features || {wall:false, ask:false};
  state.classCode = out.classCode || '';
  state.pack = out.pack || DEFAULT_PACK;
}
function setPack(p){ PACK = p; M = PACK.morphemes; MBY = Object.fromEntries(M.map(m => [m.id, m])); UNITS = PACK.units; COMP = PACK.compounds; }
async function loadPack(url){
  url = url || DEFAULT_PACK;
  if (url === packUrl) return;
  try {
    const res = await fetch(url, {cache:'no-cache'});
    if (!res.ok) throw new Error(res.status);
    setPack(await res.json()); packUrl = url;
  } catch (e) {
    if (!PACK) { setPack(await (await fetch(DEFAULT_PACK, {cache:'no-cache'})).json()); packUrl = DEFAULT_PACK; }
  }
  if (state && !UNITS.some(u => u.unit === state.unit)) state.unit = UNITS[0].unit;
}
async function boot(){
  try { await loadPack(DEFAULT_PACK); }
  catch (e) { document.body.innerHTML = '<p style="padding:24px">內容載入失敗，請重新整理頁面。</p>'; return; }
  const params = new URLSearchParams(location.search);
  const t = params.get('t');
  if (t) { history.replaceState(null, '', location.pathname); await login(t); return; }
  const local = loadLocal();
  if (local && local.token) {
    state = local;
    await loadPack(state.pack);
    start();
    API.call('login', {token: state.token}).then(async out => {
      if (out && out.ok) { applyTier(out); mergeServer(out.entries, out.progress); await loadPack(state.pack); save(); renderAll(); }
      else if (out && out.code === 'bad_token') forceLogout('這個 token 已失效，請重新登入。');
    }).catch(() => renderSync(true));
    return;
  }
  showGate();
}
boot();
})();
