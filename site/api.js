/* 我的詞族地圖・免費版 — 後端呼叫
 * 正式模式：POST 到 Apps Script（text/plain，避免 CORS 預檢）。
 * 預覽模式（API_URL 留空）：用這台裝置的 localStorage 模擬後端，方便測試整個流程。
 */
(() => {
  'use strict';
  const cfg = window.WFM_CONFIG || {};
  const DEMO_KEY = 'wfm.demoBackend';

  function demoDB(){
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {students:{DEMO01:{child:'示範同學', entries:{}, progress:{}}}}; }
    catch (e) { return {students:{DEMO01:{child:'示範同學', entries:{}, progress:{}}}}; }
  }
  function demoSave(db){ try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) {} }
  function demoToken(){ const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let t = ''; for (let i = 0; i < 6; i++) t += A[Math.floor(Math.random() * A.length)]; return t; }

  async function demo(action, p){
    await new Promise(r => setTimeout(r, 250));
    const db = demoDB();
    if (action === 'apply') {
      const tok = demoToken();
      db.students[tok] = {child: p.childName, entries:{}, progress:{}};
      demoSave(db);
      return {ok:true, demoToken: tok};
    }
    const st = db.students[String(p.token || '').toUpperCase()];
    if (!st) return {ok:false, code:'bad_token', message:'找不到這個 token，請確認信裡的代碼。'};
    if (action === 'login') return {ok:true, child: st.child, entries: Object.values(st.entries), progress: st.progress || {}};
    if (action === 'sync') {
      (p.upserts || []).forEach(e => { const cur = st.entries[e.id]; if (!cur || (cur.updated || 0) <= (e.updated || 0)) st.entries[e.id] = e; });
      (p.deletes || []).forEach(id => { delete st.entries[id]; });
      if (p.progress) st.progress = p.progress;
      demoSave(db);
      return {ok:true, count: Object.keys(st.entries).length, at: Date.now()};
    }
    return {ok:false, message:'unknown action'};
  }

  async function call(action, payload, opts){
    if (!cfg.API_URL) return demo(action, payload || {});
    const res = await fetch(cfg.API_URL, {
      method:'POST', body: JSON.stringify({action, ...(payload || {})}),
      keepalive: !!(opts && opts.keepalive)
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) { throw new Error('後端沒有回傳 JSON（請確認 Apps Script 已部署成「所有人」可存取，網址以 /exec 結尾）'); }
  }

  window.WFM_API = {call, demo: !cfg.API_URL};
})();
