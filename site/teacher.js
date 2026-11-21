/* 我的詞族地圖・老師後台：回答提問、直播展示、第 16 場回顧 */
(() => {
'use strict';
const API = window.WFM_API;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const VERDICT = {confirmed:'拆法正確', trap:'陷阱字', mismatch:'拆法要再想想', '':'未判定'};
const ST_CLS = {'待回答':'s0', '排入直播':'s1', '已回答':'s2'};
const ERR = {bad_teacher:'找不到這個老師代碼。', not_found:'找不到這筆資料。', no_ai:'還沒有設定 OPENAI_API_KEY，無法產生 AI 草稿。', ai_failed:'AI 草稿產生失敗，請稍後再試。', busy:'伺服器忙碌中，請稍後再試。'};
const errMsg = c => ERR[c] || (c === 'Failed to fetch' ? '網路連線有問題。' : '發生錯誤：' + c);
let T = null, P = null, MBY = {}, Q = [], sel = null, tab = 'q';
const ss = {get(k){ try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v){ try { sessionStorage.setItem(k, v); } catch (e) {} }, del(k){ try { sessionStorage.removeItem(k); } catch (e) {} }};
function toast(m){ const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400); }

/* 拆字顯示（與學生端相同的規則，只用來顯示零件意思） */
function matchForm(piece, type){ for (const m of P.morphemes) if (m.t === type && m.forms.includes(piece)) return m; return null; }
function parseSplit(text){
  const pieces = String(text || '').toLowerCase().split('+').map(s => s.replace(/[^a-z]/g, '')).filter(Boolean);
  return pieces.map((p, i) => {
    const last = i === pieces.length - 1, first = i === 0, many = pieces.length > 1;
    let m = null, t = 'base';
    if (many && first && (m = matchForm(p, 'pre'))) t = 'pre';
    else if (many && last && (m = matchForm(p, 'suf'))) t = 'suf';
    else if ((m = matchForm(p, 'root'))) t = 'root';
    else if (many && !last && (m = matchForm(p, 'pre'))) t = 'pre';
    else if (many && !first && (m = matchForm(p, 'suf'))) t = 'suf';
    else m = null;
    return {t, s:p, m};
  });
}
const partsHTML = split => parseSplit(split).map((p, i) => (i ? '<span class="plus">+</span>' : '') +
  `<div class="part ${p.t}"><b>${esc(p.s)}</b><span>${esc(p.m ? p.m.mean : '字基')}</span></div>`).join('');
const mLabel = m => m.label || (m.t === 'pre' ? m.forms[0] + '-' : m.t === 'suf' ? '-' + m.forms[0] : m.forms[0] || m.id);

/* ---------- 登入 ---------- */
async function boot(){
  if (API.preview) $('#previewHint').hidden = false;
  try { P = await (await fetch('content/course.json', {cache:'no-cache'})).json(); MBY = Object.fromEntries(P.morphemes.map(m => [m.id, m])); }
  catch (e) { P = {morphemes:[], units:[]}; }
  const code = ss.get('wfm.teacher');
  if (code) login(code); else showLogin();
}
function showLogin(msg){ $('#appView').hidden = true; $('#loginView').hidden = false; $('#loginErr').textContent = msg || ''; $('#tc').focus(); }
$('#loginForm').addEventListener('submit', e => { e.preventDefault(); login($('#tc').value.trim().toUpperCase()); });
async function login(code){
  let res; try { res = await API.call('tLogin', {teacherCode:code}); } catch (e) { return showLogin(errMsg('Failed to fetch')); }
  if (!res.ok) { ss.del('wfm.teacher'); return showLogin(errMsg(res.error)); }
  ss.set('wfm.teacher', code);
  T = {code, name:res.teacher.name, classes:res.classes, ai:res.ai, cls:res.classes[0].code};
  $('#loginView').hidden = true; $('#appView').hidden = false; $('#previewBanner').hidden = !API.preview;
  $('#who').textContent = T.name;
  $('#clsSel').innerHTML = T.classes.map(c => `<option value="${esc(c.code)}">${esc(c.name)}（${esc(c.code)}）</option>`).join('');
  fillWeeks();
  go('q');
}
$('#logout').addEventListener('click', () => { ss.del('wfm.teacher'); location.reload(); });
$('#clsSel').addEventListener('change', e => { T.cls = e.target.value; sel = null; fillWeeks(); go(tab); });
const curClass = () => T.classes.find(c => c.code === T.cls);
function fillWeeks(){
  const open = (curClass().openUnits || []).length || 15;
  const opts = Array.from({length:15}, (_, i) => `<option value="${i + 1}">W${i + 1}${i + 1 > open ? '（未開放）' : ''}</option>`).join('');
  $('#fWeek').innerHTML = '<option value="0">全部週次</option>' + opts;
  $('#lWeek').innerHTML = opts;
  $('#lWeek').value = Math.max(1, open - 1);    // 這週的直播回答上週的提問
}

/* ---------- 分頁 ---------- */
['q', 'live', 'stats'].forEach(t => $('#tab-' + t).addEventListener('click', () => go(t)));
function go(t){
  tab = t;
  ['q', 'live', 'stats'].forEach(x => { $('#tab-' + x).setAttribute('aria-selected', String(x === t)); $('#v-' + x).hidden = x !== t; });
  if (t === 'q') loadQ(); if (t === 'stats') loadStats();
}

/* ---------- 提問 ---------- */
async function fetchQ(week, status){
  const res = await API.call('tQuestions', {teacherCode:T.code, classCode:T.cls, week, status});
  if (!res.ok) throw new Error(res.error);
  return res.questions;
}
async function loadQ(){
  $('#qlist').innerHTML = '<div class="locked">載入中…</div>';
  try { Q = await fetchQ(+$('#fWeek').value, $('#fStatus').value); } catch (e) { $('#qlist').innerHTML = `<div class="locked">${esc(errMsg(e.message))}</div>`; return; }
  renderList();
  if (sel && !Q.some(q => q.qid === sel)) sel = null;
  renderEditor();
}
['#fWeek', '#fStatus'].forEach(s => $(s).addEventListener('change', loadQ));
$('#reload').addEventListener('click', loadQ);
function renderList(){
  $('#qCount').textContent = `${Q.length} 題`;
  $('#qlist').innerHTML = Q.length ? Q.map(q => `<button type="button" class="qitem" data-q="${esc(q.qid)}" aria-current="${q.qid === sel}">
    <span class="l1"><span class="st ${ST_CLS[q.status] || 's0'}">${esc(q.status)}</span>W${q.week}・${esc(q.nickname)}${q.same ? `・${q.same} 人也這樣想` : ''}${q.verdict ? '・' + esc(VERDICT[q.verdict]) : ''}</span>
    <span class="w">${esc(q.word)}</span><span class="d">${esc(q.doubt)}</span></button>`).join('')
    : '<div class="panel locked"><div class="big">沒有符合條件的提問</div></div>';
}
$('#qlist').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; sel = b.dataset.q; renderList(); renderEditor(); });
function renderEditor(){
  const q = Q.find(x => x.qid === sel), box = $('#editor');
  if (!q) { box.innerHTML = '<div class="locked">從左邊選一個提問。</div>'; return; }
  box.innerHTML = `<span class="eyebrow">W${q.week}・${esc(q.nickname)}・${new Date(q.askedAt).toLocaleString('zh-TW')}</span>
    <div class="dw mono" style="font-size:1.6rem;font-weight:600;color:var(--ink)">${esc(q.word)}</div>
    <div class="parts" style="margin:8px 0">${partsHTML(q.split)}</div>
    ${q.sentence ? `<div class="quote" lang="en">${esc(q.sentence)}</div>` : ''}
    <div class="kv"><span>零件的意思 <b>${esc(q.partsMeaning || '—')}</b></span><span>在句子裡的意思 <b>${esc(q.meaning || '—')}</b></span></div>
    <div class="check mismatch"><b>不確定的地方</b>${esc(q.doubt)}</div>
    <p class="hint">${q.same} 人「我也這樣想」・${q.diff} 人「我有不同看法」</p>
    <div class="row field"><span class="lbl">判定</span><div class="seg" id="vSeg">${Object.keys(VERDICT).map(k => `<button type="button" data-v="${k}" aria-pressed="${(q.verdict || '') === k}">${VERDICT[k]}</button>`).join('')}</div></div>
    <div class="row field"><label for="note">回答（學生在班級牆和自己的紀錄上會看到）</label><textarea class="in" id="note" style="min-height:130px">${esc(q.note || '')}</textarea>
      <span class="hint">記得回到原句：零件給方向，句子給答案。</span></div>
    <div class="row field"><label for="stSel">狀態</label><select class="in" id="stSel" style="width:auto">${['待回答', '排入直播', '已回答'].map(s => `<option ${s === q.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="actions">
      <button class="btn btn-primary" type="button" id="saveAns">儲存</button>
      <button class="btn btn-quiet" type="button" id="saveDone">儲存並標成已回答</button>
      <button class="btn btn-quiet" type="button" id="toLive">排入直播</button>
      ${T.ai ? '<button class="btn btn-quiet" type="button" id="aiBtn">AI 草稿</button>' : ''}
      <span class="err" id="edErr"></span>
    </div>`;
  let verdict = q.verdict || '';
  $('#vSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; verdict = b.dataset.v; [...$('#vSeg').children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  const save = async status => {
    try {
      const res = await API.call('tAnswer', {teacherCode:T.code, qid:q.qid, verdict, note:$('#note').value, status: status || $('#stSel').value});
      if (!res.ok) throw new Error(res.error);
      Object.assign(q, res.question); renderList(); renderEditor(); toast('已儲存');
    } catch (e) { $('#edErr').textContent = errMsg(e.message); }
  };
  $('#saveAns').addEventListener('click', () => save());
  $('#saveDone').addEventListener('click', () => save('已回答'));
  $('#toLive').addEventListener('click', () => save('排入直播'));
  if (T.ai) $('#aiBtn').addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = '產生中…';
    try {
      const res = await API.call('tAiDraft', {teacherCode:T.code, qid:q.qid}); if (!res.ok) throw new Error(res.error);
      $('#note').value = res.draft;
      if (res.verdict) { verdict = res.verdict; [...$('#vSeg').children].forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === verdict))); }
      toast('已放入 AI 草稿，請檢查後再儲存');
    } catch (err) { $('#edErr').textContent = errMsg(err.message); }
    e.target.disabled = false; e.target.textContent = 'AI 草稿';
  });
}

/* ---------- 直播 ---------- */
let LV = null;
$('#liveStart').addEventListener('click', async () => {
  const week = +$('#lWeek').value, scope = $('#lScope').value;
  let qs;
  try { qs = await fetchQ(week, scope === 'open' ? '' : scope); } catch (e) { $('#liveInfo').textContent = errMsg(e.message); return; }
  if (scope === 'open') qs = qs.filter(q => q.status !== '已回答');
  qs.sort((a, b) => (b.same - a.same) || (a.askedAt - b.askedAt));      // 同感的人多的先回答
  if (!qs.length) { $('#liveInfo').textContent = `W${week} 沒有符合的提問。`; return; }
  LV = {qs, i:0, show:false, week};
  $('#live').hidden = false; renderLive();
  try { await document.documentElement.requestFullscreen(); } catch (e) {}
});
function renderLive(){
  const q = LV.qs[LV.i];
  $('#live').innerHTML = `<div class="lt"><span>W${LV.week} 提問・${LV.i + 1} / ${LV.qs.length}</span><span class="sp"></span>
      <button type="button" data-l="prev">←</button><button type="button" data-l="show">${LV.show ? '隱藏回答' : '顯示回答'}</button><button type="button" data-l="done">${q.status === '已回答' ? '已回答 ✓' : '標成已回答'}</button><button type="button" data-l="next">→</button><button type="button" data-l="exit">離開</button></div>
    <div class="stage">
      <div class="who">${esc(q.nickname)} 問${q.same ? `・${q.same} 位同學也這樣想` : ''}${q.diff ? `・${q.diff} 位有不同看法` : ''}</div>
      <div class="bigw">${esc(q.word)}</div>
      <div class="parts">${partsHTML(q.split)}</div>
      ${q.sentence ? `<div class="sen" lang="en">${esc(q.sentence)}</div>` : ''}
      <div class="dbt">${esc(q.doubt)}</div>
      ${LV.show ? `<div class="ansbox"><b>${esc(VERDICT[q.verdict || ''])}</b><br>${esc(q.note || '（還沒有寫回答，現場口頭說明）')}</div>` : ''}
    </div>
    <div class="hintline">← → 換題・空白鍵 顯示回答・A 標成已回答・Esc 離開</div>`;
}
async function liveAct(a){
  if (!LV) return;
  if (a === 'next') { LV.i = Math.min(LV.qs.length - 1, LV.i + 1); LV.show = false; }
  if (a === 'prev') { LV.i = Math.max(0, LV.i - 1); LV.show = false; }
  if (a === 'show') LV.show = !LV.show;
  if (a === 'exit') { LV = null; $('#live').hidden = true; try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {} if (tab === 'q') loadQ(); return; }
  if (a === 'done') {
    const q = LV.qs[LV.i];
    try { const res = await API.call('tAnswer', {teacherCode:T.code, qid:q.qid, status:'已回答'}); if (!res.ok) throw new Error(res.error); Object.assign(q, res.question); toast('已標成已回答'); }
    catch (e) { toast(errMsg(e.message)); }
  }
  renderLive();
}
$('#live').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) liveAct(b.dataset.l); });
document.addEventListener('keydown', e => {
  if (!LV || $('#live').hidden) return;
  const k = {ArrowRight:'next', ArrowLeft:'prev', ' ':'show', Escape:'exit', a:'done', A:'done'}[e.key];
  if (k) { e.preventDefault(); liveAct(k); }
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && LV) { /* 保留畫面，按離開才關 */ } });

/* ---------- 第 16 場回顧：只看全班的統計 ---------- */
function bars(rows, label){
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="bars">${rows.map(([k, v]) => `<div class="bar"><span class="lab" title="${esc(k)}">${esc(label ? label(k) : k)}</span><span class="track"><span class="fill" style="width:${v / max * 100}%"></span></span><span class="v">${v}</span></div>`).join('')}</div>`;
}
async function loadStats(){
  const box = $('#statsBox'); box.innerHTML = '<div class="panel locked">載入中…</div>';
  let st; try { const res = await API.call('tStats', {teacherCode:T.code, classCode:T.cls}); if (!res.ok) throw new Error(res.error); st = res.stats; }
  catch (e) { box.innerHTML = `<div class="panel locked">${esc(errMsg(e.message))}</div>`; return; }
  const units = Array.from({length:15}, (_, i) => ['W' + (i + 1), st.perUnit[i + 1] || 0]);
  const vRows = Object.keys(st.verdicts).map(k => [VERDICT[k] || k, st.verdicts[k]]);
  box.innerHTML = `
    <div class="panel" style="margin-bottom:18px"><span class="eyebrow">第 16 場・總結</span><h2>${esc(curClass().name)}的詞族地圖</h2>
      <p class="sub" style="margin:0">這裡只有全班的合計，看不到個別學生的紀錄，可以直接投影給全班看。</p></div>
    <div class="stat-row">
      <div class="stat"><b>${st.activeStudents}</b><span>位同學有採集紀錄（全班 ${st.students} 位）</span></div>
      <div class="stat"><b>${st.entries}</b><span>筆採集紀錄</span></div>
      <div class="stat"><b>${st.distinctWords}</b><span>個不同的字</span></div>
      <div class="stat"><b>${st.sharedWords}</b><span>個字被 3 位以上的同學找到</span></div>
      <div class="stat"><b>${st.questions}</b><span>則提問</span></div>
    </div>
    <div class="grid">
      <div class="panel"><h3>全班最大的家族</h3><p class="sub">有多少筆紀錄用到這個詞素</p>${bars(st.topMorphemes.slice(0, 15), k => MBY[k] ? mLabel(MBY[k]) + ' ' + MBY[k].mean : k)}</div>
      <div class="stack">
        <div class="panel"><h3>最多人找到的字</h3>${bars(st.topWords.slice(0, 12))}</div>
        <div class="panel"><h3>每週的採集數</h3>${bars(units)}</div>
        <div class="panel"><h3>提問的判定</h3>${vRows.length ? bars(vRows) : '<p class="sub">還沒有提問。</p>'}</div>
        ${Object.keys(st.subjects).length ? `<div class="panel"><h3>學科</h3>${bars(Object.entries(st.subjects))}</div>` : ''}
      </div>
    </div>`;
}

boot();
})();
