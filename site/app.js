/* 我的詞族地圖・學生端
 * 同一份程式給免費版、課程版、進階版用；版本由後端「學生」工作表的「版本」欄決定。
 * 資料先存在這台裝置（localStorage），背景同步到 Apps Script。
 */
(() => {
'use strict';
const API = window.WFM_API, CFG = window.WFM_CONFIG || {};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const POS_LABEL = {n:'名詞', v:'動詞', adj:'形容詞', adv:'副詞', other:'其他'};
const TYPE_LABEL = {pre:'字首', root:'字根', suf:'字尾', base:'字基', cmp:'複合字'};
const ERR = {
  bad_token:'找不到這個登入碼，請檢查是否輸入正確。', disabled:'這個登入碼已停用，請聯絡老師。', busy:'伺服器忙碌中，請稍後再試。',
  feature_locked:'這是課程版的功能。', no_class:'你還沒有加入班級。', missing_fields:'有欄位還沒填。', own_question:'不能回應自己的提問。',
  network:'網路連線有問題，請稍後再試。', server_error:'伺服器發生錯誤，請稍後再試。'
};
const errMsg = c => ERR[c] || ('發生錯誤：' + c);

/* ---------- state ---------- */
let S = null;          // 登入後的資料
let P = null;          // 內容包
let MBY = {}, LIVE = [], KEY = {}, TRAPS = {}, COMP = {};
let L = null;          // 這台裝置的紀錄 {entries:{}, deletes:[], dirty:{}, progress:{}, progressDirty:false}
let storeOK = true;
const ui = {tab:'course', unit:1, clarity:'透明', subject:'', mapSel:null, review:null, wallWeek:0, wall:null, openSeg:null, askFor:null, lastCheck:null};

function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { storeOK = false; return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); return true; } catch (e) { storeOK = false; return false; } }
function lsDel(k){ try { localStorage.removeItem(k); } catch (e) {} }
const LKEY = () => 'wfm.v2.' + S.token;
function saveLocal(){ if (!lsSet(LKEY(), JSON.stringify(L))) $('#storeWarn').hidden = false; }
function loadLocal(token){
  try { const d = JSON.parse(lsGet('wfm.v2.' + token) || 'null'); if (d && d.entries) return d; } catch (e) {}
  return {entries:{}, deletes:[], dirty:{}, progress:{}, progressDirty:false};
}
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- boot ---------- */
async function boot(){
  if (API.preview) { $('#previewHint').hidden = false; }
  if (CFG.CONTACT) $('#contactLine').innerHTML = `　<a href="${esc(CFG.CONTACT)}" target="_blank" rel="noopener">需要協助</a>`;
  const q = new URLSearchParams(location.search);
  let token = (q.get('t') || '').trim().toUpperCase();
  if (token) { lsSet('wfm.token', token); history.replaceState(null, '', location.pathname); }
  else token = (lsGet('wfm.token') || '').toUpperCase();
  if (!token) return showLogin();
  await login(token, true);
}
function showLogin(msg){
  $('#appView').hidden = true; $('#loginView').hidden = false;
  $('#loginErr').textContent = msg || '';
  $('#tokenIn').focus();
}
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const t = $('#tokenIn').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(t)) { $('#loginErr').textContent = '登入碼是 6 個英文字母或數字。'; return; }
  login(t, false);
});

async function login(token, silent){
  $('#loginBtn').disabled = true; $('#loginErr').textContent = '';
  let res;
  try { res = await API.call('login', {token}); }
  catch (e) { res = null; }
  $('#loginBtn').disabled = false;
  if (!res) {
    // 離線：用這台裝置上次的資料開啟
    const cached = (() => { try { return JSON.parse(lsGet('wfm.session.' + token) || 'null'); } catch (e) { return null; } })();
    if (cached) { await start(cached, token, true); $('#offlineBanner').hidden = false; return; }
    return showLogin(errMsg('network'));
  }
  if (!res.ok) { if (res.error === 'bad_token' || res.error === 'disabled') lsDel('wfm.token'); return showLogin(errMsg(res.error)); }
  lsSet('wfm.token', token);
  lsSet('wfm.session.' + token, JSON.stringify(Object.assign({}, res, {entries:[]})));
  await start(res, token, false);
}

async function start(res, token, offline){
  S = {token, student:res.student, tier:res.tier, tierInfo:res.tierInfo, cls:res.cls, units:res.units || [], questions:res.questions || []};
  try {
    const r = await fetch('content/' + S.tierInfo.pack + '.json', {cache:'no-cache'});
    P = await r.json();
  } catch (e) { return showLogin('內容包載入失敗，請重新整理頁面。'); }
  MBY = Object.fromEntries(P.morphemes.map(m => [m.id, m]));
  LIVE = P.morphemes.filter(m => !m.display);
  KEY = P.key || {}; TRAPS = P.traps || {}; COMP = P.compounds || {};
  L = loadLocal(token);
  if (!offline) merge(res.entries || [], res.progress || {});
  const firstOpen = (P.units.find(u => S.units.includes(u.unit)) || P.units[0]).unit;
  ui.unit = isOpen(L.progress.unit) ? L.progress.unit : firstOpen;
  L.progress.unit = ui.unit;
  L.progress.maxUnit = Math.max(L.progress.maxUnit || 0, ui.unit);
  saveLocal();
  $('#loginView').hidden = true; $('#appView').hidden = false;
  $('#previewBanner').hidden = !API.preview;
  $('#storeWarn').hidden = storeOK;
  buildUnitSelect();
  renderAll();
  if (Object.keys(L.dirty).length || L.deletes.length || L.progressDirty) scheduleSync(300);
}

function merge(serverEntries, serverProgress){
  const seen = new Set();
  serverEntries.forEach(en => {
    seen.add(en.id);
    if (L.deletes.includes(en.id)) return;
    const mine = L.entries[en.id];
    if (!mine || (!L.dirty[en.id] && (en.updated || 0) >= (mine.updated || 0))) L.entries[en.id] = Object.assign(en, {_s:1});
  });
  Object.values(L.entries).forEach(en => {
    if (seen.has(en.id)) return;
    if (en._s && !L.dirty[en.id]) delete L.entries[en.id];     // 在別台裝置刪掉了
    else L.dirty[en.id] = 1;                                     // 還沒上傳
  });
  const p = L.progress, sp = serverProgress || {};
  p.done = Object.assign({}, sp.done || {}, p.done || {});
  p.answers = Object.assign({}, sp.answers || {}, p.answers || {});
  p.maxUnit = Math.max(p.maxUnit || 0, sp.maxUnit || 0);
  if (!p.unit) p.unit = sp.unit;
}

/* ---------- sync ---------- */
let syncTimer = null, syncing = false;
function scheduleSync(ms){ setDot('dirty'); clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms ?? 1500); }
function setDot(s){ const d = $('#syncDot'); d.className = 'sync' + (s === 'ok' ? '' : ' ' + s); d.title = {ok:'已同步', dirty:'等待同步', err:'同步失敗，稍後會再試'}[s]; }
function payload(){
  const ids = Object.keys(L.dirty);
  return {ids, body:{token:S.token, upserts: ids.map(id => L.entries[id]).filter(Boolean).map(stripLocal), deletes:L.deletes.slice(), progress: L.progressDirty ? L.progress : undefined}};
}
function stripLocal(en){ const o = Object.assign({}, en); delete o._s; return o; }
async function syncNow(keepalive){
  if (syncing && !keepalive) { scheduleSync(800); return; }
  const {ids, body} = payload();
  if (!ids.length && !body.deletes.length && !body.progress) { setDot('ok'); return; }
  const stamp = Object.fromEntries(ids.map(id => [id, L.entries[id] && L.entries[id].updated]));
  syncing = true;
  try {
    const res = await API.call('sync', body, {keepalive});
    if (!res || !res.ok) throw new Error(res && res.error || 'sync');
    ids.forEach(id => { const en = L.entries[id]; if (!en || en.updated === stamp[id]) { delete L.dirty[id]; if (en) en._s = 1; } });
    L.deletes = L.deletes.filter(id => !body.deletes.includes(id));
    if (body.progress) L.progressDirty = false;
    if (res.questions) { S.questions = res.questions; }
    saveLocal(); setDot(Object.keys(L.dirty).length ? 'dirty' : 'ok');
    $('#offlineBanner').hidden = true;
    if (res.questions && !keepalive) refreshAfterSync();
  } catch (e) {
    setDot('err'); clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 20000);
  } finally { syncing = false; }
}
function refreshAfterSync(){ if (ui.tab === 'capture') renderCaptureSide(); if (ui.tab === 'map') renderMap(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S) syncNow(true); });

function putEntry(en){ en.updated = Date.now(); L.entries[en.id] = en; L.dirty[en.id] = 1; saveLocal(); scheduleSync(); }
function delEntry(id){ const en = L.entries[id]; delete L.entries[id]; delete L.dirty[id]; if (en && en._s) L.deletes.push(id); saveLocal(); scheduleSync(); }
function setProgress(fn){ fn(L.progress); L.progressDirty = true; saveLocal(); scheduleSync(2500); }
const entries = () => Object.values(L.entries);

/* ---------- units ---------- */
const unitObj = n => P.units.find(u => u.unit === n);
const isOpen = n => !!n && S.units.includes(n) && !!unitObj(n);
const maxReached = () => Math.max(L.progress.maxUnit || 0, ui.unit);
const stageOf = n => P.stages.find(s => n >= s.from && n <= s.to) || P.stages[0];
const unlocked = m => !m.display && m.unit <= maxReached();
const mLabel = m => m.label || (m.t === 'pre' ? m.forms[0] + '-' : m.t === 'suf' ? '-' + m.forms[0] : m.forms[0] || m.id);
const feat = f => !!(S.tierInfo.features || {})[f];

function buildUnitSelect(){
  const sel = $('#unitSel');
  sel.innerHTML = P.units.map(u => {
    const open = isOpen(u.unit);
    return `<option value="${u.unit}" ${open ? '' : 'disabled'}>W${u.unit} ${esc(u.title.length > 14 ? u.title.slice(0, 14) + '…' : u.title)}${open ? '' : '（尚未開放）'}</option>`;
  }).join('');
}
$('#unitSel').addEventListener('change', e => {
  const n = +e.target.value; if (!isOpen(n)) return;
  ui.unit = n; ui.openSeg = null;
  setProgress(p => { p.unit = n; p.maxUnit = Math.max(p.maxUnit || 0, n); });
  renderAll();
});

function renderHeader(){
  $('#unitSel').value = ui.unit;
  const st = stageOf(ui.unit);
  $('#stagePill').textContent = `${st.name}`;
  $('#stagePill').title = `第${'一二三四'[st.n - 1]}階段`;
  $('#tierPill').textContent = S.tierInfo.label + (S.cls ? ' · ' + S.cls.name : '');
  $('#countPill').textContent = `${entries().length} 個字`;
  const wcOpen = maxReached() >= 4;
  $('#wcLock').textContent = wcOpen ? '' : 'W4';
  $('#tab-wc').classList.toggle('off', !wcOpen);
  $('#wallLock').textContent = feat('wall') ? '' : (S.tier === 'advanced' ? '' : '課程版');
  $('#tab-wall').classList.toggle('off', !feat('wall'));
  $('#subjectField').hidden = maxReached() < 13;
}

/* ---------- tabs ---------- */
const TABS = ['course','capture','map','wc','review','wall'];
TABS.forEach(t => $('#tab-' + t).addEventListener('click', () => go(t)));
function go(t){ ui.tab = t; renderTabs(); renderView(); window.scrollTo({top:0}); }
function renderTabs(){
  TABS.forEach(t => { $('#tab-' + t).setAttribute('aria-selected', String(ui.tab === t)); $('#v-' + t).hidden = ui.tab !== t; });
}
function renderView(){
  ({course:renderCourse, capture:renderCaptureSide, map:renderMap, wc:renderWC, review:renderReview, wall:renderWall})[ui.tab]();
}
function renderAll(){ renderHeader(); renderTabs(); renderView(); refreshSugs(); refreshParts(); }

/* ---------- 課程 ---------- */
function rich(s){ return esc(s).replace(/\*([^*]+)\*/g, '<em class="en" lang="en">$1</em>').replace(/〔停頓\s*[\d.]+\s*秒〕/g, ''); }
function slideHTML(s){ const [a, b] = s.split('｜'); return `<div class="slide">${b !== undefined ? `<b>${rich(a)}</b><span>${rich(b)}</span>` : `<span>${rich(a)}</span>`}</div>`; }

function renderCourse(){
  const box = $('#v-course'), u = unitObj(ui.unit);
  if (!u) { box.innerHTML = '<div class="panel locked"><div class="big">找不到這個單元</div></div>'; return; }
  const st = stageOf(u.unit);
  const done = u.segments.filter(s => L.progress.done && L.progress.done[s.id]).length;
  if (ui.openSeg === null) { const f = u.segments.find(s => !(L.progress.done || {})[s.id]); ui.openSeg = f ? f.id : ''; }
  const morphs = u.morphemes.map(id => MBY[id]).filter(Boolean);
  box.innerHTML = `
  <div class="grid">
    <div class="stack">
      <div class="panel">
        <span class="eyebrow">W${u.unit} · 第${'一二三四'[st.n - 1]}階段 ${esc(st.name)}</span>
        <div class="unit-head"><span class="big">${esc(u.title)}</span></div>
        <div class="unit-progress" aria-hidden="true"><span style="width:${u.segments.length ? done / u.segments.length * 100 : 0}%"></span></div>
        <p class="sub" style="margin:0">已完成 ${done} / ${u.segments.length} 段講解${S.cls && S.cls.live ? `　·　直播時段：${esc(S.cls.live)}` : ''}</p>
      </div>
      <div class="segs">${u.segments.map((s, i) => segHTML(s, i)).join('')}</div>
      <div class="taskbox">
        <h3>本週任務</h3>
        <p style="margin:0 0 10px">${esc(u.task)}</p>
        <div class="actions"><button class="btn btn-primary btn-sm" type="button" data-go="capture">去採集</button>
        ${feat('wall') ? '<button class="btn btn-quiet btn-sm" type="button" data-go="wall">看班級牆</button>' : ''}</div>
      </div>
    </div>
    <div class="side-gap">
      <div class="panel">
        <span class="eyebrow">這週的零件</span>
        <h2>${morphs.length ? '在書裡找這些詞素' : '整合所有學過的詞素'}</h2>
        <p class="sub">${morphs.length ? '數字是你目前收集到的字數。' : '這週沒有新的零件，把前面學過的全部用上。'}</p>
        <div class="mlist">${(morphs.length ? morphs : []).map(m => `<div class="mrow"><span class="f">${esc(mLabel(m))}</span><span class="mean">${esc(m.mean)}</span><span class="n">${countFor(m.id)} 個</span></div>`).join('')}</div>
      </div>
      ${S.tier === 'free' ? `<div class="panel"><span class="eyebrow">免費版</span><h2>完整課程有 15 週</h2><p class="sub" style="margin:0">免費版包含 W1、W4、W9、W14 四個代表單元。完整課程會一週一週帶你學完所有字首、字尾和字根，還有班級牆、提問和每週直播。</p></div>` : ''}
      ${S.tier === 'course' && S.cls ? `<div class="panel"><span class="eyebrow">我的班級</span><h2>${esc(S.cls.name)}</h2><p class="sub" style="margin:0">${esc(S.cls.teacher || '')}${S.cls.live ? '　·　' + esc(S.cls.live) : ''}<br>拿不準的字，在採集紀錄上按「提問」。下週直播，老師會回答。</p></div>` : ''}
    </div>
  </div>`;
}

function segHTML(s, i){
  const done = !!(L.progress.done || {})[s.id], open = ui.openSeg === s.id;
  return `<article class="segcard" data-seg="${esc(s.id)}">
    <header role="button" tabindex="0" aria-expanded="${open}" data-toggle="${esc(s.id)}">
      <span class="num">${String(i).padStart(2, '0')}</span><span class="t">${esc(s.title)}</span>
      ${done ? '<span class="done">完成</span>' : ''}<span class="min">${s.minutes} 分</span>
    </header>
    ${open ? `<div class="segbody">
      <div class="player"><button class="btn btn-primary btn-sm" type="button" data-play="${esc(s.id)}">▶ 播放講解</button><span class="state" id="ps-${esc(s.id)}"></span></div>
      ${s.slides.length ? `<div class="slides">${s.slides.map(slideHTML).join('')}</div>` : ''}
      <details class="script"><summary>講解文字</summary>${s.script.map(p => `<p>${rich(p)}</p>`).join('')}</details>
      ${s.passage ? passageHTML(s.passage) : ''}
      ${s.checks.length ? `<div class="checks">${s.checks.map((c, k) => checkHTML(s.id, c, k)).join('')}</div>` : ''}
      <div class="actions" style="margin-top:14px"><button class="btn ${done ? 'btn-quiet' : 'btn-primary'} btn-sm" type="button" data-done="${esc(s.id)}">${done ? '標成還沒完成' : '這段完成了'}</button></div>
    </div>` : ''}
  </article>`;
}

function checkHTML(sid, c, k){
  const key = sid + ':' + k, ans = (L.progress.answers || {})[key];
  if (c.type === 'mcq') {
    const picked = typeof ans === 'number' ? ans : null;
    return `<div class="qbox"><div class="q">${rich(c.q)}</div><div class="opts">${c.options.map((o, j) => {
      const cls = picked === null ? '' : j === c.answer ? 'right' : j === picked ? 'wrong' : '';
      return `<button type="button" class="opt ${cls}" data-mcq="${esc(key)}" data-j="${j}">${rich(o)}</button>`;
    }).join('')}</div>${picked !== null ? `<div class="fb"><b>${picked === c.answer ? '答對了。' : '再想想：正確答案是「' + rich(c.options[c.answer]) + '」。'}</b> ${rich(c.explain || '')}</div>` : ''}</div>`;
  }
  const shown = ans && ans.shown;
  return `<div class="qbox"><div class="q">${rich(c.q)}</div>
    <textarea class="in" data-open="${esc(key)}" placeholder="先寫下你的答案">${esc(ans && ans.text || '')}</textarea>
    <div class="actions"><button class="btn btn-quiet btn-sm" type="button" data-ref="${esc(key)}">${shown ? '收起參考答案' : '看參考答案'}</button></div>
    ${shown ? `<div class="fb"><b>參考答案：</b>${rich(c.ref)}</div>` : ''}</div>`;
}

function passageHTML(p){
  const have = new Set(entries().map(e => e.word));
  const paras = p.paras.map(par => {
    const sentences = par.match(/[^.!?]+[.!?]+["”]?\s*/g) || [par];
    return '<p>' + sentences.map(sen => {
      const plain = sen.replace(/\{\{([^|}]+)\|([^}]+)\}\}/g, '$1').trim();
      return esc(sen).replace(/\{\{([^|}]+)\|([^}]+)\}\}/g, (_, surf, lem) =>
        `<button type="button" class="pw ${have.has(lem) ? 'have' : ''}" data-pw="${esc(lem)}" data-sen="${esc(plain)}">${surf}</button>`);
    }).join('') + '</p>';
  }).join('');
  return `<div class="passage" data-title="${esc(p.title)}" data-subject="${esc(p.subject || '')}"><h3 lang="en">${esc(p.title)}</h3><div lang="en">${paras}</div>
    <p class="hint" style="font-family:var(--body);margin:0">點有底線的字，可以直接帶著原句去採集。實線底線＝已經在你的地圖上。</p></div>`;
}

$('#v-course').addEventListener('click', e => {
  const t = e.target.closest('[data-toggle]');
  if (t) { stopAudio(); ui.openSeg = ui.openSeg === t.dataset.toggle ? '' : t.dataset.toggle; renderCourse(); return; }
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const d = e.target.closest('[data-done]');
  if (d) {
    const id = d.dataset.done, was = !!(L.progress.done || {})[id];
    setProgress(p => { p.done = p.done || {}; if (was) delete p.done[id]; else p.done[id] = Date.now(); });
    if (!was) { const u = unitObj(ui.unit), i = u.segments.findIndex(s => s.id === id), nx = u.segments[i + 1]; ui.openSeg = nx ? nx.id : ''; stopAudio(); }
    renderCourse(); return;
  }
  const pl = e.target.closest('[data-play]'); if (pl) { togglePlay(pl.dataset.play, pl); return; }
  const mq = e.target.closest('[data-mcq]');
  if (mq) { const k = mq.dataset.mcq; if (typeof (L.progress.answers || {})[k] === 'number') return; setProgress(p => { p.answers = p.answers || {}; p.answers[k] = +mq.dataset.j; }); renderCourse(); return; }
  const rf = e.target.closest('[data-ref]');
  if (rf) { const k = rf.dataset.ref, ta = document.querySelector(`[data-open="${CSS.escape(k)}"]`);
    setProgress(p => { p.answers = p.answers || {}; const o = p.answers[k] || {}; p.answers[k] = {text: ta ? ta.value : o.text || '', shown: !o.shown}; }); renderCourse(); return; }
  const pw = e.target.closest('[data-pw]');
  if (pw) {
    const box = pw.closest('.passage');
    resetForm();
    fWord.value = pw.dataset.pw; $('#f-sentence').value = pw.dataset.sen; $('#f-book').value = box.dataset.title;
    if (box.dataset.subject) setSeg('#subject', box.dataset.subject);
    fSplit.value = pw.dataset.pw; fSplit.dataset.auto = '1';
    go('capture'); refreshSugs(); refreshParts(); fSplit.focus();
  }
});
$('#v-course').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-toggle]')) { e.preventDefault(); e.target.click(); } });
$('#v-course').addEventListener('change', e => {
  const ta = e.target.closest('[data-open]'); if (!ta) return;
  setProgress(p => { p.answers = p.answers || {}; const o = p.answers[ta.dataset.open] || {}; p.answers[ta.dataset.open] = {text: ta.value, shown: !!o.shown}; });
});

/* ---------- 語音：mp3 優先，沒有就用瀏覽器語音 ---------- */
let audio = null, tts = null, playing = null;
function stopAudio(){
  if (audio) { audio.pause(); audio = null; }
  if (tts) { tts.cancel = true; try { speechSynthesis.cancel(); } catch (e) {} tts = null; }
  playing = null;
  $$('[data-play]').forEach(b => { b.textContent = '▶ 播放講解'; });
}
function findSeg(id){ for (const u of P.units) for (const s of u.segments) if (s.id === id) return s; return null; }
function togglePlay(id, btn){
  if (playing === id) { stopAudio(); return; }
  stopAudio();
  const s = findSeg(id), state = $('#ps-' + CSS.escape(id));
  playing = id; btn.textContent = '■ 停止';
  audio = new Audio(s.audio);
  audio.addEventListener('ended', () => { if (state) state.textContent = '播放完畢'; stopAudio(); });
  audio.addEventListener('error', () => {
    if (playing !== id) return;
    audio = null;
    if (!$('#ttsFallback').checked || !('speechSynthesis' in window)) { if (state) state.textContent = '這段的錄音還沒上傳，可以先展開「講解文字」閱讀。'; stopAudio(); return; }
    if (state) state.textContent = '錄音還沒上傳，先用瀏覽器語音朗讀。';
    speakScript(s.script, () => { if (state) state.textContent = '播放完畢'; stopAudio(); });
  });
  audio.play().then(() => { if (state) state.textContent = '播放中'; }).catch(() => {});
}
function speakScript(lines, onEnd){
  const runs = [];
  lines.forEach(ln => {
    const re = /(\*[^*]+\*)|(〔停頓\s*([\d.]+)\s*秒〕)/g; let i = 0, m;
    while ((m = re.exec(ln))) {
      if (m.index > i) runs.push({lang:'zh', text: ln.slice(i, m.index)});
      if (m[1]) runs.push({lang:'en', text: m[1].slice(1, -1)}); else runs.push({pause: +m[3]});
      i = re.lastIndex;
    }
    if (i < ln.length) runs.push({lang:'zh', text: ln.slice(i)});
    runs.push({pause: .6});
  });
  const voices = speechSynthesis.getVoices();
  const zh = voices.find(v => /zh[-_]TW/i.test(v.lang)) || voices.find(v => /^zh/i.test(v.lang));
  const en = voices.find(v => /en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
  const job = tts = {cancel:false};
  let k = 0;
  const next = () => {
    if (job.cancel) return;
    if (k >= runs.length) { onEnd(); return; }
    const r = runs[k++];
    if (r.pause) { setTimeout(next, r.pause * 1000); return; }
    const t = r.text.replace(/[「」]/g, '').trim(); if (!t) { next(); return; }
    const u = new SpeechSynthesisUtterance(t);
    u.lang = r.lang === 'en' ? 'en-US' : 'zh-TW'; const v = r.lang === 'en' ? en : zh; if (v) u.voice = v;
    u.rate = r.lang === 'en' ? .9 : 1;
    u.onend = next; u.onerror = next;
    speechSynthesis.speak(u);
  };
  next();
}

/* ---------- 拆字 ---------- */
function matchForm(piece, type){
  // 先找本課程教的詞素，再找只顯示意思的零件
  for (const m of LIVE) if (m.t === type && m.forms.includes(piece)) return m;
  for (const m of P.morphemes) if (m.display && m.t === type && m.forms.includes(piece)) return m;
  return null;
}
function parseSplit(text){
  const pieces = String(text).toLowerCase().split('+').map(s => s.replace(/[^a-z]/g, '')).filter(Boolean);
  return pieces.map((p, i) => {
    const last = i === pieces.length - 1, first = i === 0, many = pieces.length > 1;
    let m = null, t = 'base';
    if (many && first && (m = matchForm(p, 'pre'))) t = 'pre';
    else if (many && last && (m = matchForm(p, 'suf'))) t = 'suf';
    else if ((m = matchForm(p, 'root'))) t = 'root';
    else if (many && !last && (m = matchForm(p, 'pre'))) t = 'pre';
    else if (many && !first && (m = matchForm(p, 'suf'))) t = 'suf';
    else m = null;
    return {t, s:p, m: m ? m.id : null};
  });
}
function suggest(word){
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length < 4) return [];
  const pool = t => LIVE.filter(m => m.t === t && unlocked(m)).flatMap(m => m.forms.filter(f => f.length >= 2).map(f => ({f, m})));
  const pres = pool('pre'), sufs = pool('suf'), roots = pool('root');
  const out = new Map();
  const add = (pieces, score) => {
    if (pieces.length < 2 || pieces.some(x => x.length < 2)) return;
    const k = pieces.join('+'); if (!out.has(k) || out.get(k) < score) out.set(k, score);
  };
  if (COMP[word]) add(COMP[word].split('+'), 9);
  for (const p of [null, ...pres.filter(p => word.startsWith(p.f) && word.length - p.f.length >= 3)]) {
    const r1 = p ? word.slice(p.f.length) : word;
    for (const s of [null, ...sufs.filter(s => r1.endsWith(s.f) && r1.length - s.f.length >= 2)]) {
      const mid = s ? r1.slice(0, r1.length - s.f.length) : r1;
      const head = p ? [p.f] : [], tail = s ? [s.f] : [];
      const base = (p ? 2 : 0) + (s ? (s.m.id === 'en' ? 1 : 2) : 0) + (s ? s.f.length * .1 : 0) + (p ? p.f.length * .1 : 0);
      if (mid.length >= 2) add([...head, mid, ...tail], base - (mid.length < 3 ? 1 : 0));
      for (const r of roots) {
        const k = mid.indexOf(r.f); if (k < 0) continue;
        const before = mid.slice(0, k), after = mid.slice(k + r.f.length);
        add([...head, ...(before ? [before] : []), r.f, ...(after ? [after] : []), ...tail],
          base + 3 + r.f.length * .1 - (before.length === 1 ? .5 : 0) - (after.length === 1 ? .5 : 0));
      }
    }
  }
  return [...out.entries()].filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
}
function partNote(p){
  const m = p.m ? MBY[p.m] : null;
  if (!m) return `<span>${esc(TYPE_LABEL[p.t])}</span>`;
  if (m.display || unlocked(m)) return `<span>${esc(m.mean)}</span>`;
  return `<span class="later">W${m.unit} 會學到</span>`;
}
function partsHTML(parts){
  if (!parts.length) return '<span class="empty">拆好的零件會顯示在這裡</span>';
  return parts.map((p, i) => (i ? '<span class="plus">+</span>' : '') +
    `<div class="part ${p.t}${p.m && MBY[p.m] && MBY[p.m].display ? ' disp' : ''}"><b>${esc(p.s)}</b>${partNote(p)}</div>`).join('');
}
function familyGuess(parts){
  const root = parts.find(p => p.t === 'root'); if (root) return root.s;
  return parts.filter(p => p.t === 'base').map(p => p.s).join('') || '';
}
const isCompound = en => en.clarity !== '不能拆' && (COMP[en.word] === en.parts.map(p => p.s).join('+') || (en.parts.length >= 2 && en.parts.every(p => p.t === 'base' && p.s.length >= 3)));

/* ---------- 比對答案表 ---------- */
function checkEntry(en){
  const w = en.word;
  const ids = new Set(en.parts.map(p => p.m).filter(id => id && MBY[id] && !MBY[id].display));
  const whole = en.clarity === '不能拆' || en.parts.length < 2;
  if (TRAPS[w]) {
    const labels = TRAPS[w].map(id => MBY[id]).filter(Boolean).map(mLabel).join('、');
    return whole ? {kind:'key', trap:true, msg:`你認出了陷阱字：${w} 看起來有 ${labels}，其實不能這樣拆。`}
                 : {kind:'trap', msg:`${w} 是陷阱字：看起來有 ${labels}，但拆開後意思接不上。建議改成「不能拆」。`};
  }
  if (COMP[w]) {
    return en.parts.map(p => p.s).join('+') === COMP[w] ? {kind:'key', msg:'和課程詞表一致：這是複合字。'}
      : {kind:'mismatch', msg:`課程詞表把它當成複合字：兩個獨立的字拼在一起。再看看？`};
  }
  if (KEY[w]) {
    const exp = KEY[w].filter(id => MBY[id] && unlocked(MBY[id]));
    if (!exp.length) return {kind:'open', msg:'這個字的零件，之後的單元才會學到。先照你的判斷記下來。'};
    const miss = exp.filter(id => !ids.has(id));
    if (!miss.length && !whole) return {kind:'key', msg:'和課程詞表一致。'};
    return {kind:'mismatch', msg:`課程詞表裡，${w} 和 ${miss.map(id => mLabel(MBY[id])).join('、')} 有關。對照原句，再看看你的拆法？`};
  }
  return {kind:'open', msg: feat('ask') ? '這個字不在課程詞表裡。照你的判斷記錄；拿不準的話，可以按「提問」。' : '這個字不在課程詞表裡。照你的判斷記錄，等你在別的句子裡再遇到它，再回來確認。'};
}
const CHECK_TAG = {key:'詞表一致', trap:'陷阱字', mismatch:'再看看', open:'待確認'};

/* 老師對每個字的判定（來自已回答的提問） */
function teacherOf(id){
  const qs = (S.questions || []).filter(q => q.entryId === id);
  const ans = qs.filter(q => q.status === '已回答' && q.verdict).sort((a, b) => b.answeredAt - a.answeredAt)[0];
  return {asked: qs.length > 0, pending: qs.some(q => q.status !== '已回答'), q: ans || null};
}
function tagsHTML(en){
  const t = teacherOf(en.id), c = en.check || {kind:'open'};
  let h = '';
  if (t.q) h += t.q.verdict === 'confirmed' ? '<span class="tag teacher">老師確認</span>' : '<span class="tag teacher again">老師：再看看</span>';
  else h += `<span class="tag ${c.kind}">${CHECK_TAG[c.kind]}</span>`;
  if (t.pending) h += '<span class="tag asked">已提問</span>';
  return h;
}
const confirmedEntry = en => { const t = teacherOf(en.id); return t.q ? t.q.verdict === 'confirmed' : (en.check && en.check.kind === 'key'); };

/* ---------- 採集 ---------- */
const fWord = $('#f-word'), fSplit = $('#f-split'), fPos = $('#f-pos'), fFam = $('#f-family');
let famTouched = false, posTouched = false;
function refreshSugs(){
  const w = fWord.value.trim(), box = $('#sugs');
  if (!w) { box.innerHTML = '<span class="hint">輸入單字後，這裡會出現依照目前進度可用的拆法。</span>'; return; }
  const s = suggest(w);
  box.innerHTML = s.map(k => `<button type="button" class="sug" data-k="${esc(k)}">${esc(k)}</button>`).join('') +
    `<button type="button" class="sug none" data-k="${esc(w.toLowerCase())}" data-whole="1">不能拆</button>` +
    (s.length ? '' : '<span class="hint">目前進度裡沒有找到可用的詞素，可以自己拆，或標成不能拆。</span>');
}
function refreshParts(){
  const parts = parseSplit(fSplit.value);
  $('#partsPreview').innerHTML = partsHTML(parts);
  if (!famTouched) fFam.value = familyGuess(parts);
  if (!posTouched) { const suf = [...parts].reverse().find(p => p.t === 'suf'); if (suf && MBY[suf.m] && MBY[suf.m].pos) fPos.value = MBY[suf.m].pos; }
}
fWord.addEventListener('input', () => { refreshSugs(); if (!fSplit.value || fSplit.dataset.auto) { fSplit.value = fWord.value.trim().toLowerCase(); fSplit.dataset.auto = '1'; refreshParts(); } });
fSplit.addEventListener('input', () => { delete fSplit.dataset.auto; refreshParts(); });
fFam.addEventListener('input', () => { famTouched = true; });
fPos.addEventListener('change', () => { posTouched = true; });
$('#sugs').addEventListener('click', e => {
  const b = e.target.closest('.sug'); if (!b) return;
  fSplit.value = b.dataset.k; delete fSplit.dataset.auto;
  if (b.dataset.whole) setSeg('#clarity', '不能拆'); else if (ui.clarity === '不能拆') setSeg('#clarity', '透明');
  refreshParts();
});
function setSeg(sel, v){ $$(sel + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); if (sel === '#clarity') ui.clarity = v; else ui.subject = v; }
$('#clarity').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSeg('#clarity', b.dataset.v); });
$('#subject').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSeg('#subject', b.dataset.v); });
function resetForm(){
  $('#capForm').reset(); fSplit.dataset.auto = '1'; famTouched = posTouched = false;
  setSeg('#clarity', '透明'); setSeg('#subject', '');
  refreshSugs(); refreshParts(); $('#formErr').textContent = '';
}
$('#resetBtn').addEventListener('click', () => { resetForm(); $('#lastCheck').innerHTML = ''; });
$('#capForm').addEventListener('submit', e => {
  e.preventDefault();
  const word = fWord.value.trim().toLowerCase().replace(/[^a-z\-]/g, '');
  if (!word) { $('#formErr').textContent = '先輸入一個單字。'; fWord.focus(); return; }
  const parts = ui.clarity === '不能拆' ? [{t:'base', s:word, m:null}] : parseSplit(fSplit.value || word);
  const joined = parts.map(p => p.s).join('');
  if (ui.clarity !== '不能拆' && joined !== word.replace(/-/g, '')) { $('#formErr').textContent = `拆法合起來是「${joined}」，和單字「${word}」不一樣，請檢查。`; return; }
  const sentence = $('#f-sentence').value.trim();
  if (!sentence) { $('#formErr').textContent = '請抄下原句：意思要回到句子裡確認。'; $('#f-sentence').focus(); return; }
  const now = Date.now();
  const en = {id:'e' + now.toString(36) + Math.random().toString(36).slice(2, 6), word, parts, pos: fPos.value,
    partsMeaning: $('#f-pm').value.trim(), meaning: $('#f-meaning').value.trim(), clarity: ui.clarity,
    book: $('#f-book').value.trim(), sentence, subject: maxReached() >= 13 ? ui.subject : '',
    family: ui.clarity === '不能拆' ? '' : fFam.value.trim().toLowerCase(), unit: ui.unit, created: now, ease: 0, tier: S.tier};
  en.check = checkEntry(en);
  putEntry(en);
  ui.lastCheck = en.id;
  resetForm(); renderHeader(); renderCaptureSide(); renderLastCheck(); fWord.focus();
  toast(en.check.kind === 'key' ? '已加入地圖・和詞表一致' : '已加入地圖');
});
function renderLastCheck(){
  const en = L.entries[ui.lastCheck], box = $('#lastCheck');
  if (!en) { box.innerHTML = ''; return; }
  const c = en.check || checkEntry(en);
  box.innerHTML = `<div class="check ${c.kind}"><b>${esc(en.word)}　${CHECK_TAG[c.kind]}</b>${esc(c.msg)}
    <div class="actions" style="margin-top:8px"><button class="btn btn-quiet btn-sm" type="button" data-word="${esc(en.id)}">看詳細</button>
    ${askBtn(en, true)}</div></div>`;
}
function askBtn(en, big){
  const cls = big ? 'btn btn-quiet btn-sm' : 'link';
  if (!feat('ask')) return `<button class="${cls}" type="button" disabled title="課程版功能" style="opacity:.55;cursor:not-allowed">提問（課程版）</button>`;
  return `<button class="${cls}" type="button" data-ask="${esc(en.id)}">提問</button>`;
}
function countFor(id){
  if (id === 'cmp') return entries().filter(isCompound).length;
  return entries().filter(e => e.parts.some(p => p.m === id)).length;
}
function renderCaptureSide(){
  const u = unitObj(ui.unit), st = stageOf(ui.unit);
  $('#unitEyebrow').textContent = `W${ui.unit} · ${st.name}`;
  $('#unitTitle').textContent = u ? u.title : '';
  $('#unitTask').textContent = u ? u.task : '';
  let list = u ? u.morphemes.map(id => MBY[id]).filter(Boolean) : [];
  if (!list.length) list = LIVE.filter(unlocked).sort((a, b) => countFor(b.id) - countFor(a.id)).slice(0, 8);
  $('#unitMorphs').innerHTML = list.map(m => `<div class="mrow"><span class="f">${esc(mLabel(m))}</span><span class="mean">${esc(m.mean)}</span><span class="n">${countFor(m.id)} 個</span></div>`).join('');
  const rec = entries().sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 10);
  $('#recent').innerHTML = rec.length ? rec.map(e => `<li><button class="w" type="button" data-word="${esc(e.id)}">${esc(e.word)}</button>
      <span class="meta">${esc(e.parts.map(p => p.s).join(' + '))}</span>${tagsHTML(e)}${askBtn(e)}</li>`).join('')
    : '<li><span class="meta">還沒有紀錄。從正在讀的書裡找第一個字吧。</span></li>';
  renderLastCheck();
}
document.addEventListener('click', e => {
  const w = e.target.closest('[data-word]'); if (w) { openWord(w.dataset.word); return; }
  const a = e.target.closest('[data-ask]'); if (a && !a.disabled) { openAsk(a.dataset.ask); return; }
  const c = e.target.closest('[data-close]'); if (c) { c.closest('.sheet').hidden = true; return; }
  if (e.target.classList.contains('sheet')) e.target.hidden = true;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.sheet').forEach(s => { s.hidden = true; }); });

/* ---------- 單字詳細 ---------- */
function detailHTML(en){
  const c = en.check || checkEntry(en), t = teacherOf(en.id);
  return `<div class="dw">${esc(en.word)}</div>
    <div class="parts" style="margin-top:10px">${partsHTML(en.parts)}</div>
    ${en.sentence ? `<div class="quote" lang="en">${esc(en.sentence)}</div>` : ''}
    ${en.partsMeaning ? `<p style="margin:8px 0 0"><b>零件的意思：</b>${esc(en.partsMeaning)}</p>` : ''}
    ${en.meaning ? `<p style="margin:6px 0 0"><b>在這句話裡的意思：</b>${esc(en.meaning)}</p>` : ''}
    <div class="kv" style="margin-top:10px"><span>詞性 <b>${esc(POS_LABEL[en.pos] || '')}</b></span><span>透明度 <b>${esc(en.clarity)}</b></span>${en.family ? `<span>詞族 <b>${esc(en.family)}</b></span>` : ''}${en.book ? `<span>出處 <b>${esc(en.book)}</b></span>` : ''}${en.subject ? `<span>學科 <b>${esc(en.subject)}</b></span>` : ''}<span>記錄於 <b>W${en.unit}</b></span></div>
    <div class="check ${c.kind}"><b>${CHECK_TAG[c.kind]}</b>${esc(c.msg)}</div>
    ${t.q ? `<div class="tnote"><b>${t.q.verdict === 'confirmed' ? '老師確認' : '老師：再看看'}</b><br>${esc(t.q.note || '')}</div>` : t.pending ? '<p class="hint">你已經提問了，老師會在直播時回答。</p>' : ''}`;
}
function openWord(id){
  const en = L.entries[id]; if (!en) return;
  $('#wordBox').innerHTML = detailHTML(en) + `<div class="actions" style="margin-top:14px;justify-content:space-between">
      <span>${askBtn(en, true)} <button class="danger" type="button" id="delWord" style="margin-left:10px">刪除這個字</button><span id="delConfirm"></span></span>
      <button class="btn btn-quiet" type="button" data-close>關閉</button></div>`;
  $('#wordSheet').hidden = false;
  $('#delWord').addEventListener('click', () => {
    $('#delConfirm').innerHTML = ' 確定刪除？ <button type="button" class="danger" id="delYes">刪除</button>';
    $('#delYes').addEventListener('click', () => { delEntry(id); $('#wordSheet').hidden = true; renderHeader(); renderView(); toast('已刪除'); });
  });
}

/* ---------- 提問 ---------- */
function openAsk(id){
  const en = L.entries[id]; if (!en) return;
  if (!feat('ask')) { toast(errMsg('feature_locked')); return; }
  ui.askFor = id;
  $('#wordSheet').hidden = true;
  $('#askEntry').innerHTML = `<div class="dw mono" style="font-size:1.2rem;font-weight:600">${esc(en.word)}</div><div class="parts" style="margin:8px 0">${partsHTML(en.parts)}</div>
    ${en.sentence ? `<div class="quote" lang="en">${esc(en.sentence)}</div>` : ''}`;
  $('#askDoubt').value = ''; $('#askErr').textContent = '';
  $('#askNick').value = S.student.nickname || S.student.child || '';
  $('#askSub').textContent = `會出現在 ${S.cls ? S.cls.name : '班級'} 的班級牆（W${ui.unit}），下一次直播時老師會回答。`;
  $('#askSheet').hidden = false; $('#askDoubt').focus();
}
$('#askForm').addEventListener('submit', async e => {
  e.preventDefault();
  const en = L.entries[ui.askFor]; if (!en) return;
  const doubt = $('#askDoubt').value.trim();
  if (doubt.length < 4) { $('#askErr').textContent = '寫下你不確定的地方，老師才知道要怎麼回答。'; return; }
  const btn = e.submitter || $('#askForm button[type=submit]'); btn.disabled = true;
  try {
    const res = await API.call('ask', {token:S.token, entryId:en.id, week:ui.unit, word:en.word, split:en.parts.map(p => p.s).join('+'),
      sentence:en.sentence, partsMeaning:en.partsMeaning, meaning:en.meaning, doubt, nickname:$('#askNick').value.trim()});
    if (!res.ok) throw new Error(res.error);
    S.questions.push(res.question); S.student.nickname = res.question.nickname;
    $('#askSheet').hidden = true; toast('已送出提問'); ui.wall = null; renderView();
  } catch (err) { $('#askErr').textContent = errMsg(err.message === 'Failed to fetch' ? 'network' : err.message); }
  finally { btn.disabled = false; }
});

/* ---------- 地圖 ---------- */
function renderMap(){
  const open = LIVE.filter(unlocked);
  if (!ui.mapSel || !MBY[ui.mapSel] || !unlocked(MBY[ui.mapSel])) {
    const best = open.map(m => [m.id, countFor(m.id)]).sort((a, b) => b[1] - a[1])[0];
    ui.mapSel = best ? best[0] : null;
  }
  const groups = [];
  LIVE.forEach(m => { let g = groups.find(x => x.field === m.field); if (!g) groups.push(g = {field:m.field, items:[]}); g.items.push(m); });
  $('#mnav').innerHTML = groups.map(g => `<div class="group"><h3>${esc(g.field)}</h3>` + g.items.map(m => {
    const ok = unlocked(m);
    return `<button type="button" class="mbtn" data-m="${m.id}" ${ok ? '' : 'disabled'} aria-current="${ui.mapSel === m.id}">
      <span class="f">${esc(mLabel(m))}</span><span class="mean">${esc(m.mean)}</span>${ok ? `<span class="n">${countFor(m.id)}</span>` : `<span class="wk">W${m.unit}</span>`}</button>`;
  }).join('') + '</div>').join('');
  const panel = $('#mapPanel');
  if (!ui.mapSel) { panel.innerHTML = '<div class="locked"><div class="big">還沒有可用的詞素</div>先完成 W1 的講解。</div>'; return; }
  const m = MBY[ui.mapSel];
  const mine = entries().filter(e => m.id === 'cmp' ? isCompound(e) : e.parts.some(p => p.m === m.id));
  const words = new Set(mine.map(e => e.word));
  const anchors = m.anchors.filter(a => !words.has(a));
  const nodes = [...mine.map(e => ({w:e.word, id:e.id, mine:true, ok:confirmedEntry(e)})), ...anchors.map(a => ({w:a}))];
  const foundTraps = new Set(entries().filter(e => e.clarity === '不能拆').map(e => e.word));
  panel.innerHTML = `
    <div class="map-head"><span class="big">${esc(mLabel(m))}</span><span class="mean">＝ ${esc(m.mean)}</span><span class="eyebrow">W${m.unit} · ${esc(TYPE_LABEL[m.t])}</span></div>
    <div class="svgbox">${mapSVG(m, nodes)}</div>
    <div class="legend"><span><i style="background:#08333B"></i>我找到的字（已確認）</span><span><i style="background:#E8A33D"></i>我找到的字（待確認）</span><span><i style="background:#fff;border:1.5px dashed #5C7077"></i>課程錨點詞，還沒收集</span></div>
    ${m.traps.length ? `<p class="sub" style="margin:14px 0 0">陷阱字：看起來有 ${esc(mLabel(m))}，其實不是這個意思（實心＝你已經找到）</p><div class="traps">${m.traps.map(t => `<span class="trap" style="${foundTraps.has(t) ? 'background:#C1495B;color:#fff' : ''}">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="detail" id="mapDetail" hidden></div>`;
}
function mapSVG(m, nodes){
  const W = 680, H = 460, cx = W / 2, cy = H / 2, n = nodes.length, two = n > 12, out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(mLabel(m))} 詞族地圖，共 ${n} 個字">`);
  const pos = nodes.map((nd, i) => { const r = two ? (i % 2 ? 200 : 140) : 170, a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(n, 1); return {x: cx + r * Math.cos(a) * 1.28, y: cy + r * Math.sin(a) * .92}; });
  nodes.forEach((nd, i) => out.push(`<line x1="${cx}" y1="${cy}" x2="${pos[i].x.toFixed(1)}" y2="${pos[i].y.toFixed(1)}" stroke="${nd.mine ? '#9FB8BD' : '#D7E4E5'}" stroke-width="1.5" ${nd.mine ? '' : 'stroke-dasharray="4 4"'}/>`));
  out.push(`<circle cx="${cx}" cy="${cy}" r="58" fill="#08333B"/>`);
  out.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="${m.id === 'cmp' ? 17 : 22}" fill="#E8A33D">${esc(m.id === 'cmp' ? '複合字' : m.forms[0])}</text>`);
  out.push(`<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="13" fill="#C4D7DB">${esc(m.mean.length > 8 ? m.mean.slice(0, 8) + '…' : m.mean)}</text>`);
  nodes.forEach((nd, i) => {
    const w = Math.max(56, nd.w.length * 9.2 + 24), h = 32, x = pos[i].x - w / 2, y = pos[i].y - h / 2;
    const fill = nd.mine ? (nd.ok ? '#08333B' : '#E8A33D') : '#FFFFFF', txt = nd.mine ? (nd.ok ? '#FFFFFF' : '#08333B') : '#5C7077';
    const attrs = nd.mine ? `class="node" data-node="${esc(nd.id)}" tabindex="0" role="button" aria-label="${esc(nd.w)}" style="cursor:pointer"` : '';
    out.push(`<g ${attrs}><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="16" fill="${fill}" stroke="${nd.mine ? fill : '#5C7077'}" stroke-width="1.5" ${nd.mine ? '' : 'stroke-dasharray="4 3"'}/>` +
      `<text x="${pos[i].x.toFixed(1)}" y="${(pos[i].y + 5).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="15" font-weight="${nd.mine ? 600 : 400}" fill="${txt}">${esc(nd.w)}</text></g>`);
  });
  if (!n) out.push(`<text x="${cx}" y="${cy + 110}" text-anchor="middle" font-size="14" fill="#5C7077">還沒有字。回到「採集」，在書裡找一個含有 ${esc(m.forms[0] || '兩個字')} 的字。</text>`);
  out.push('</svg>');
  return out.join('');
}
$('#mnav').addEventListener('click', e => { const b = e.target.closest('.mbtn'); if (!b || b.disabled) return; ui.mapSel = b.dataset.m; renderMap(); });
function pickNode(e){
  const g = e.target.closest('[data-node]'); if (!g) return;
  const en = L.entries[g.dataset.node], box = $('#mapDetail'); if (!en) return;
  box.hidden = false;
  box.innerHTML = detailHTML(en) + `<div class="actions" style="margin-top:12px">${askBtn(en, true)}<button class="btn btn-quiet btn-sm" type="button" data-word="${esc(en.id)}">編輯／刪除</button></div>`;
}
$('#mapPanel').addEventListener('click', pickNode);
$('#mapPanel').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-node]')) { e.preventDefault(); pickNode(e); } });

/* ---------- 詞性表 ---------- */
function renderWC(){
  const panel = $('#wcPanel');
  if (maxReached() < 4) { panel.innerHTML = '<div class="locked"><div class="big">詞性表在 W4 開放</div>第二階段開始學字尾，那時同一個字族的名詞、動詞、形容詞會排在一起。</div>'; return; }
  const fams = new Map();
  entries().filter(e => e.family && e.clarity !== '不能拆').forEach(e => { if (!fams.has(e.family)) fams.set(e.family, []); fams.get(e.family).push(e); });
  const rows = [...fams.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const cols = ['n', 'v', 'adj', 'adv'];
  panel.innerHTML = `<span class="eyebrow">詞性表</span><h2>同一個字族，換一個字尾就換一個詞性</h2>
    <p class="sub">空格是還沒找到的形式。下次在書裡遇到，就把它補上。寫作時想把句子「打包」成名詞，就從這張表找。</p>
    ${rows.length ? `<div class="tablebox"><table class="wc"><thead><tr><th>詞族</th>${cols.map(c => `<th>${POS_LABEL[c]}</th>`).join('')}</tr></thead><tbody>` +
      rows.map(([fam, es]) => {
        const m = LIVE.find(x => x.t === 'root' && x.forms.includes(fam));
        return `<tr><th class="base">${esc(fam)}<small>${m ? esc(m.mean) : es.length + ' 個字'}</small></th>` + cols.map(c => {
          const ws = es.filter(e => e.pos === c);
          return ws.length ? `<td>${ws.map(e => `<span class="w">${esc(e.word)}</span>`).join('')}</td>` : '<td class="miss">還沒找到</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="locked"><div class="big">還沒有字族</div>採集時填上「歸入詞族」，這裡就會出現。</div>'}`;
}

/* ---------- 複習 ---------- */
function startReview(){
  const pool = entries().filter(e => e.clarity !== '不能拆' && e.parts.length > 1).sort((a, b) => (a.ease || 0) - (b.ease || 0) || (a.created || 0) - (b.created || 0)).slice(0, 10);
  ui.review = {queue: pool.map(e => e.id), i:0, shown:false, known:0};
}
function renderReview(){
  const panel = $('#reviewPanel');
  if (!ui.review) startReview();
  const r = ui.review;
  if (!r.queue.length) { panel.innerHTML = '<div class="locked"><div class="big">還沒有可以複習的字</div>先在「採集」記下幾個拆得開的字。</div>'; return; }
  if (r.i >= r.queue.length) {
    panel.innerHTML = `<div class="card"><span class="eyebrow">這一輪結束</span><div class="word" style="font-family:var(--display)">${r.known} / ${r.queue.length}</div><p class="prompt">記得的字會慢慢排到後面，不熟的字下次會先出現。</p><div class="actions"><button class="btn btn-primary" type="button" data-a="again">再來一輪</button></div></div>`;
    return;
  }
  const en = L.entries[r.queue[r.i]]; if (!en) { r.i++; renderReview(); return; }
  panel.innerHTML = `<div class="card">
    <span class="eyebrow">拆拆看 · 第 ${r.i + 1} / ${r.queue.length} 個</span>
    <div class="progress" aria-hidden="true"><span style="width:${r.i / r.queue.length * 100}%"></span></div>
    <div class="word">${esc(en.word)}</div>
    ${en.sentence ? `<div class="quote" lang="en" style="text-align:left">${esc(en.sentence)}</div>` : ''}
    <p class="prompt">${r.shown ? '對照一下你的拆法和意思。' : '先在心裡拆開它：有哪些零件？在這句話裡是什麼意思？'}</p>
    ${r.shown ? `<div class="parts">${partsHTML(en.parts)}</div>${en.partsMeaning ? `<p class="meaning">${esc(en.partsMeaning)}</p>` : ''}${en.meaning ? `<p class="meaning"><b>${esc(en.meaning)}</b></p>` : ''}` : ''}
    <div class="actions">${r.shown ? '<button class="btn btn-quiet" type="button" data-a="again1">再練習</button><button class="btn btn-primary" type="button" data-a="know">記得了</button>' : '<button class="btn btn-primary" type="button" data-a="show">看答案</button>'}</div></div>`;
}
$('#reviewPanel').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'again') { ui.review = null; renderReview(); return; }
  const r = ui.review, en = L.entries[r.queue[r.i]];
  if (a === 'show') r.shown = true;
  else {
    if (en) { en.ease = Math.max(0, (en.ease || 0) + (a === 'know' ? 1 : -1)); putEntry(en); }
    if (a === 'know') r.known++;
    r.i++; r.shown = false;
  }
  renderReview();
});

/* ---------- 班級牆 ---------- */
const ST_CLS = {'待回答':'s0', '排入直播':'s1', '已回答':'s2'};
function qcardHTML(q, disabled){
  return `<article class="qcard ${q.mine ? 'mine' : ''}">
    <div class="top-line"><span class="st ${ST_CLS[q.status] || 's0'}">${esc(q.status)}</span><span>W${q.week}</span><span>${esc(q.nickname)}${q.mine ? '（我）' : ''}</span></div>
    <div class="qw">${esc(q.word)}</div>
    ${q.split ? `<div class="parts" style="min-height:0">${partsHTML(parseSplit(q.split))}</div>` : ''}
    ${q.sentence ? `<div class="quote" lang="en" style="margin:0">${esc(q.sentence)}</div>` : ''}
    <div class="doubt">${esc(q.doubt)}</div>
    ${q.status === '已回答' && (q.note || q.verdict) ? `<div class="ans"><b>${q.verdict === 'confirmed' ? '老師確認' : q.verdict ? '老師：再看看' : '老師回答'}</b><br>${esc(q.note)}</div>` : ''}
    <div class="rx">
      <button type="button" data-rx="same" data-q="${esc(q.qid)}" aria-pressed="${q.myReaction === 'same'}" ${disabled || q.mine ? 'disabled' : ''}>我也這樣想 ${q.same || ''}</button>
      <button type="button" data-rx="diff" data-q="${esc(q.qid)}" aria-pressed="${q.myReaction === 'diff'}" ${disabled || q.mine ? 'disabled' : ''}>我有不同看法 ${q.diff || ''}</button>
    </div></article>`;
}
async function renderWall(){
  const box = $('#wallPanel');
  if (!feat('wall')) {
    const sample = [{qid:'x1', status:'已回答', week:1, nickname:'同學 A', word:'discover', split:'dis+cover', sentence:'Scientists discovered a new kind of frog.', doubt:'dis 不是「不」嗎？「不蓋住」怎麼會變成發現？', verdict:'confirmed', note:'dis 在這裡比較接近「拿開」：把蓋子拿開，藏著的東西就被看見了。', same:3, diff:0},
                    {qid:'x2', status:'排入直播', week:9, nickname:'同學 B', word:'opportunity', split:'op+port+unity', sentence:'This is a great opportunity to learn.', doubt:'port 是帶著東西移動，「機會」跟移動有什麼關係？', same:5, diff:1}];
    box.innerHTML = `<div class="panel" style="margin-bottom:16px"><span class="eyebrow">${S.tier === 'advanced' ? '進階版' : '課程版功能'}</span>
      <h2>班級牆：看同學問了什麼，老師在直播裡回答</h2>
      <p class="sub" style="margin:0">${S.tier === 'advanced' ? '進階版沒有班級和老師；之後會由 AI 助教回答你的提問。' : '課程版的學生，可以把拿不準的字送到班級牆，看同學的提問、按「我也這樣想」，每週直播時老師會一題一題回答。下面是示意畫面。'}</p></div>
      <div class="wall" style="opacity:.6;pointer-events:none" aria-hidden="true">${sample.map(q => qcardHTML(q, true)).join('')}</div>`;
    return;
  }
  const maxOpen = Math.max(...S.units);
  box.innerHTML = `<div class="panel" style="margin-bottom:16px"><span class="eyebrow">班級牆 · ${esc(S.cls ? S.cls.name : '')}</span>
    <h2>同學問了什麼？</h2><p class="sub" style="margin:0">覺得同學問得好，按「我也這樣想」；有不同的想法，按「我有不同看法」，直播時可以說出來。</p>
    <div class="wallbar" style="margin:14px 0 0"><select class="in" id="wallWeek" aria-label="週次"><option value="0">全部週次</option>${Array.from({length:maxOpen}, (_, i) => `<option value="${i + 1}">W${i + 1}</option>`).join('')}</select>
    <button class="btn btn-quiet btn-sm" type="button" id="wallRefresh">重新整理</button></div></div>
    <div id="wallList"><div class="locked">載入中…</div></div>`;
  $('#wallWeek').value = ui.wallWeek;
  $('#wallWeek').addEventListener('change', e => { ui.wallWeek = +e.target.value; ui.wall = null; loadWall(); });
  $('#wallRefresh').addEventListener('click', () => { ui.wall = null; loadWall(); });
  loadWall();
}
async function loadWall(){
  const list = $('#wallList'); if (!list) return;
  if (!ui.wall) {
    try { const res = await API.call('wall', {token:S.token, week:ui.wallWeek}); if (!res.ok) throw new Error(res.error); ui.wall = res.questions; }
    catch (e) { list.innerHTML = `<div class="panel locked">${esc(errMsg(e.message === 'Failed to fetch' ? 'network' : e.message))}</div>`; return; }
  }
  list.innerHTML = ui.wall.length ? `<div class="wall">${ui.wall.map(q => qcardHTML(q)).join('')}</div>`
    : '<div class="panel locked"><div class="big">這週還沒有人提問</div>在採集紀錄上按「提問」，你的問題會出現在這裡。</div>';
}
$('#wallPanel').addEventListener('click', async e => {
  const b = e.target.closest('[data-rx]'); if (!b || b.disabled) return;
  b.disabled = true;
  try {
    const res = await API.call('react', {token:S.token, qid:b.dataset.q, kind:b.dataset.rx});
    if (!res.ok) throw new Error(res.error);
    ui.wall = ui.wall.map(q => q.qid === res.question.qid ? res.question : q); loadWall();
  } catch (err) { toast(errMsg(err.message)); b.disabled = false; }
});

/* ---------- 選單、備份 ---------- */
$('#menuBtn').addEventListener('click', () => {
  $('#menuTitle').textContent = `${S.student.child || ''}的詞族地圖`;
  $('#menuSub').textContent = `${S.tierInfo.label}${S.cls ? '・' + S.cls.name : ''}・登入碼 ${S.token}・${entries().length} 個字`;
  $('#importChoice').hidden = true; $('#menuSheet').hidden = false;
});
try { $('#ttsFallback').checked = lsGet('wfm.ttsFallback') !== '0'; } catch (e) {}
$('#ttsFallback').addEventListener('change', e => lsSet('wfm.ttsFallback', e.target.checked ? '1' : '0'));
$('#logoutBtn').addEventListener('click', async () => {
  if (Object.keys(L.dirty).length || L.deletes.length) await syncNow();
  lsDel('wfm.token'); location.href = location.pathname;
});
$('#dlBtn').addEventListener('click', () => {
  const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const blob = new Blob([JSON.stringify({app:'word-family-map', version:2, exported:d.toISOString(), token:S.token, entries:entries().map(stripLocal)}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `詞族地圖備份-${stamp}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});
let pendingImport = null;
$('#importFile').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result); if (!d || !Array.isArray(d.entries)) throw 0;
      pendingImport = d.entries.filter(x => x && typeof x.word === 'string' && Array.isArray(x.parts)).map(x => Object.assign(x, {
        id: x.id || 'e' + Math.random().toString(36).slice(2, 10), partsMeaning: x.partsMeaning || '', meaning: x.meaning || '',
        unit: x.unit || x.week || ui.unit, created: x.created || x.ts || Date.now()}));
      $('#importInfo').textContent = `備份檔裡有 ${pendingImport.length} 個字。要合併，還是取代目前的 ${entries().length} 個字？`;
      $('#importChoice').hidden = false;
    } catch (err) { toast('這不是詞族地圖的備份檔'); }
    e.target.value = '';
  };
  rd.readAsText(f);
});
$('#impMerge').addEventListener('click', () => { if (!pendingImport) return; pendingImport.forEach(x => { if (!L.entries[x.id]) { x.check = checkEntry(x); putEntry(x); } }); pendingImport = null; $('#menuSheet').hidden = true; renderAll(); toast('已合併備份'); });
$('#impReplace').addEventListener('click', () => {
  if (!pendingImport) return;
  entries().forEach(x => delEntry(x.id));
  pendingImport.forEach(x => { x.check = checkEntry(x); putEntry(x); });
  pendingImport = null; $('#menuSheet').hidden = true; renderAll(); toast('已取代為備份內容');
});

fSplit.dataset.auto = '1';
boot();
})();
