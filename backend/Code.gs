/**
 * 我的詞族地圖・免費版 — Google Apps Script 後端
 *
 * 功能：
 *   apply  家長申請 → 產生 token → 寄出登入連結
 *   login  驗證 token，回傳孩子的紀錄與課程進度
 *   sync   逐筆寫入／更新／刪除紀錄，儲存課程進度
 *
 * 試算表會自動建立三個工作表：
 *   學生   一個孩子一列（token、家長、信箱、孩子、年級、iEnglish、申請時間、最後使用、字數、進度、狀態）
 *   紀錄   一個字一列（token、entryId、單字、拆法、零件的意思、在句子裡的意思、原句…）
 *   申請記錄  每一次送出申請的原始紀錄
 *
 * 部署：
 * 1. 建立 Google 試算表 →「擴充功能 → Apps Script」→ 貼上本檔。
 * 2. 修改下方 APP_URL（Netlify 網址，結尾不加斜線）。
 * 3. 部署 → 新增部署作業 → 網頁應用程式；執行身分：我；存取權：所有人。
 * 4. 第一次部署會要求授權（試算表、寄信），請同意。
 * 5. 把網頁應用程式網址（/exec 結尾）貼到 Netlify 的 config.js 的 API_URL。
 * 6. 之後修改程式碼：部署 → 管理部署作業 → 編輯 → 版本選「新版本」。
 *
 * 停用某個 token：在「學生」工作表把「狀態」改成「停用」。
 */

const APP_URL = 'https://YOUR-SITE.netlify.app';   // ← 換成你的 Netlify 網址
const MAIL_FROM_NAME = '大腦裡的英語工程';
const NOTIFY_EMAIL = '';                           // 有新申請時通知的信箱，留空則不通知
const MAX_CHILDREN_PER_EMAIL = 5;
const TIMEZONE = 'Asia/Taipei';

const SH_STUDENTS = '學生', SH_ENTRIES = '紀錄', SH_APPLY = '申請記錄';
const H_STUDENTS = ['token', '家長姓名', '電子信箱', '孩子', '年級', 'iEnglish 等級', '申請時間', '最後使用', '字數', '進度', '狀態', '版本'];
const H_ENTRIES = ['token', 'entryId', '單字', '拆法', '零件的意思', '在句子裡的意思', '原句', '出處', '透明度', '詞性', '詞族', '單元', '詞表比對', '建立時間', '更新時間', 'json'];
const H_APPLY = ['時間', '家長姓名', '電子信箱', '孩子', '年級', 'iEnglish 等級', 'token', '結果', '來源頁面'];
const C = { // 學生 column numbers (1-based)
  token: 1, parent: 2, email: 3, child: 4, grade: 5, ie: 6, created: 7, lastSeen: 8, count: 9, progress: 10, status: 11, tier: 12
};

function doGet() { return json_({ ok: true, service: 'wordfamilymap-free' }); }

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, message: 'bad request' }); }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (d.action === 'apply') return json_(apply_(d));
    if (d.action === 'login') return json_(login_(d));
    if (d.action === 'sync') return json_(sync_(d));
    return json_({ ok: false, message: 'unknown action' });
  } catch (x) {
    console.error(x);
    return json_({ ok: false, message: '系統忙碌中，請稍後再試。' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- apply ---------- */
function apply_(d) {
  if (d.website) return { ok: true };
  const parent = clean_(d.parentName, 40), email = clean_(d.email, 120).toLowerCase(), child = clean_(d.childName, 20);
  const grade = clean_(d.grade, 20), ie = clean_(d.iEnglishLevel, 2);
  if (!parent) return { ok: false, message: '請填寫家長姓名。' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: '請填寫正確的電子信箱。' };
  if (!child) return { ok: false, message: '請填寫孩子的名字或暱稱。' };
  if (!grade) return { ok: false, message: '請選擇年級。' };
  if (ie && !/^\d{1,2}$/.test(ie)) return { ok: false, message: 'iEnglish 等級請填數字。' };

  const sh = sheet_(SH_STUDENTS, H_STUDENTS);
  const rows = sh.getDataRange().getValues();
  let token = '', sameEmail = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][C.email - 1]).toLowerCase() !== email) continue;
    sameEmail++;
    if (String(rows[i][C.child - 1]) === child) token = String(rows[i][C.token - 1]);
  }
  let result = '重寄';
  if (!token) {
    if (sameEmail >= MAX_CHILDREN_PER_EMAIL) return { ok: false, message: '這個信箱申請的數量已達上限，請透過 LINE 聯繫我們。' };
    const used = new Set(rows.slice(1).map(r => String(r[0])));
    do { token = newToken_(); } while (used.has(token));
    sh.appendRow([token, parent, email, child, grade, ie, stamp_(), '', 0, '{}', '啟用', 'free']);
    result = '新申請';
  }
  sheet_(SH_APPLY, H_APPLY).appendRow([stamp_(), parent, email, child, grade, ie, token, result, clean_(d.page, 300)]);
  sendToken_(email, parent, child, token);
  if (NOTIFY_EMAIL && result === '新申請') {
    MailApp.sendEmail(NOTIFY_EMAIL, '［詞族地圖申請］' + child + '・' + grade, [parent, email, child, grade, 'iEnglish：' + (ie || '—'), 'token：' + token].join('\n'));
  }
  return { ok: true };
}

function sendToken_(email, parent, child, token) {
  const link = APP_URL + '/?t=' + token;
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = [
    '<div style="font-family:-apple-system,PingFang TC,Microsoft JhengHei,sans-serif;line-height:1.75;color:#16323A">',
    '<p>' + esc(parent) + ' 您好：</p>',
    '<p>這是 <b>' + esc(child) + '</b> 的「我的詞族地圖」免費版登入資訊。</p>',
    '<p style="font-size:15px"><b>登入連結：</b><a href="' + link + '">' + link + '</a><br>',
    '<b>Token：</b><span style="font-family:monospace;font-size:18px;letter-spacing:2px">' + token + '</span></p>',
    '<p>請讓孩子用筆電或平板打開連結。換裝置時，打開 ' + APP_URL + ' 再輸入 token 即可，紀錄會自動備份。</p>',
    '<p>免費版包含 W1（字首與複合字）、W4（名詞字尾）、W9（字根：移動家族）三個單元。建議每個單元先聽完講解，再到正在讀的書裡找字。</p>',
    '<p style="color:#5C7077">大腦裡的英語工程　english-brain.tw<br>LINE 官方帳號：https://lin.ee/HCmnCgn</p>',
    '</div>'
  ].join('');
  MailApp.sendEmail({ to: email, subject: '「我的詞族地圖」登入資訊｜' + child, htmlBody: html, name: MAIL_FROM_NAME });
}

/* ---------- login ---------- */
function login_(d) {
  const st = findStudent_(d.token);
  if (!st) return { ok: false, code: 'bad_token', message: '找不到這個 token，請確認信裡的代碼。' };
  const sh = sheet_(SH_STUDENTS, H_STUDENTS);
  sh.getRange(st.row, C.lastSeen).setValue(stamp_());
  let progress = {};
  try { progress = JSON.parse(st.values[C.progress - 1] || '{}'); } catch (x) {}
  return { ok: true, child: String(st.values[C.child - 1]), entries: entriesFor_(st.token), progress: progress };
}

/* ---------- sync ---------- */
function sync_(d) {
  const st = findStudent_(d.token);
  if (!st) return { ok: false, code: 'bad_token', message: '找不到這個 token。' };
  const sh = sheet_(SH_ENTRIES, H_ENTRIES);
  const last = sh.getLastRow();
  const keys = last > 1 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
  const index = {};
  keys.forEach((k, i) => { if (String(k[0]) === st.token) index[String(k[1])] = i + 2; });

  const ups = (d.upserts || []).slice(0, 300);
  const appends = [];
  ups.forEach(e => {
    if (!e || typeof e.id !== 'string' || typeof e.word !== 'string') return;
    const row = entryRow_(st.token, e);
    if (index[e.id]) {
      const cur = sh.getRange(index[e.id], 15).getValue();
      if (Number(cur) > Number(e.updated || 0)) return;        // 伺服器上的版本比較新
      sh.getRange(index[e.id], 1, 1, row.length).setValues([row]);
    } else {
      appends.push(row);
      index[e.id] = -1;
    }
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, H_ENTRIES.length).setValues(appends);

  const dels = (d.deletes || []).map(String).filter(id => index[id] > 0).map(id => index[id]).sort((a, b) => b - a);
  dels.forEach(r => sh.deleteRow(r));

  const ss = sheet_(SH_STUDENTS, H_STUDENTS);
  const count = Object.keys(index).length - dels.length;
  ss.getRange(st.row, C.count).setValue(count);
  ss.getRange(st.row, C.lastSeen).setValue(stamp_());
  if (d.progress) ss.getRange(st.row, C.progress).setValue(JSON.stringify(d.progress).slice(0, 45000));
  return { ok: true, count: count, at: Date.now() };
}

/* ---------- helpers ---------- */
function entryRow_(token, e) {
  const split = (e.parts || []).map(p => p.s).join(' + ');
  const fmt = t => t ? Utilities.formatDate(new Date(Number(t)), TIMEZONE, 'yyyy-MM-dd HH:mm') : '';
  const json = JSON.stringify(e);
  return [token, e.id, clean_(e.word, 40), split, clean_(e.gloss, 200), clean_(e.meaning, 300), clean_(e.sentence, 500), clean_(e.book, 120),
    clean_(e.clarity, 10), clean_(e.pos, 10), clean_(e.family, 40), e.unit ? 'W' + e.unit : '', clean_(e.check, 12),
    fmt(e.ts), Number(e.updated || 0), json.length > 45000 ? '' : json];
}
function entriesFor_(token) {
  const sh = sheet_(SH_ENTRIES, H_ENTRIES);
  const last = sh.getLastRow(); if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, H_ENTRIES.length).getValues();
  const out = [];
  rows.forEach(r => {
    if (String(r[0]) !== token) return;
    try { const e = JSON.parse(r[15]); e.updated = Number(r[14]) || e.updated; out.push(e); } catch (x) {}
  });
  return out;
}
function findStudent_(token) {
  token = String(token || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!token) return null;
  const sh = sheet_(SH_STUDENTS, H_STUDENTS);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === token) {
      if (String(rows[i][C.status - 1]) === '停用') return null;
      return { token: token, row: i + 1, values: rows[i] };
    }
  }
  return null;
}
function newToken_() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let t = '';
  for (let i = 0; i < 6; i++) t += A.charAt(Math.floor(Math.random() * A.length));
  return t;
}
function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function clean_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function stamp_() { return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
