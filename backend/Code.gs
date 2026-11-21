/**
 * 我的詞族地圖・後端（免費版／課程版／進階版共用）
 *
 * 部署：擴充功能 → Apps Script，貼上這個檔案 → 部署 → 新增部署作業 → 網頁應用程式
 *       執行身分「我」，存取權「所有人」。改完程式要「管理部署作業 → 編輯 → 新版本」。
 *
 * 工作表（第一次執行時自動建立）：
 *   學生     一個孩子一列。「版本」欄決定 free / course / advanced；「班級代碼」對應「班級」工作表。
 *   紀錄     一個字一列。
 *   班級     一個班一列：老師代碼、開課日期、開放週次……
 *   提問     學生的提問與老師的回答。
 *   申請記錄 每一次送出申請的原始資料。
 *
 * 選用的指令碼屬性（專案設定 → 指令碼屬性）：
 *   OPENAI_API_KEY   老師後台「AI 草稿」用。沒有設定就不會出現 AI 草稿。
 *   OPENAI_MODEL     預設 gpt-4o-mini
 */

var APP_URL = '';                 // Netlify 網址，例如 https://wordfamilymap.netlify.app
var NOTIFY_EMAIL = '';            // 有人申請時通知你（可留空）
var MAIL_FROM_NAME = '我的詞族地圖';
var SERVICE = 'wordfamilymap';

var TIERS = {
  free:     { label: '免費版', pack: 'free',   unlock: 'all',   features: { wall: false, ask: false, ai: false } },
  course:   { label: '課程版', pack: 'course', unlock: 'class', features: { wall: true,  ask: true,  ai: false } },
  advanced: { label: '進階版', pack: 'course', unlock: 'all',   features: { wall: false, ask: false, ai: true } }
};
var TOTAL_UNITS = { free: [1, 4, 9, 14], course: 15 };

var SHEETS = {
  '學生': ['token', '家長姓名', '電子信箱', '孩子暱稱', '年級', 'iEnglish 等級', '申請時間', '最後使用', '字數', '課程進度', '狀態', '版本', '班級代碼', '提問暱稱'],
  '紀錄': ['token', 'id', '單字', '拆法', '零件的意思', '在句子裡的意思', '原句', '出處', '學科', '透明度', '詞性', '詞族', '單元', '詞表比對', '老師判定', '建立', '更新', 'json'],
  '班級': ['班級代碼', '班級名稱', '老師名稱', '老師代碼', '開課日期', '直播時段', '開放週次', '內容包', '狀態'],
  '提問': ['qid', '班級代碼', 'token', '暱稱', '週次', 'entryId', '單字', '拆法', '原句', '零件的意思', '在句子裡的意思', '不確定的地方', '狀態', '判定', '老師說明', '提問時間', '回答時間', 'reactions'],
  '申請記錄': ['時間', '家長姓名', '電子信箱', '孩子暱稱', '年級', 'iEnglish 等級', '班級代碼', '結果', 'token']
};
var Q_STATUS = ['待回答', '排入直播', '已回答'];
var VERDICTS = { confirmed: '拆法正確', trap: '陷阱字', mismatch: '拆法要再想想', '': '' };

/* ---------------- 入口 ---------------- */

function doGet(e) {
  return json_({ ok: true, service: SERVICE, version: '2026.11' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return json_({ ok: false, error: 'busy' }); }
  try {
    setup_();
    var fn = ACTIONS[req.action];
    if (!fn) return json_({ ok: false, error: 'unknown_action' });
    return json_(fn(req));
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code });
    console.error(err && err.stack || err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

var ACTIONS = {
  apply: apply_, login: login_, sync: sync_, ask: ask_, wall: wall_, react: react_,
  tLogin: tLogin_, tQuestions: tQuestions_, tAnswer: tAnswer_, tAiDraft: tAiDraft_, tStats: tStats_
};

/* ---------------- 學生 ---------------- */

function apply_(req) {
  var email = clean_(req.email, 120).toLowerCase(), child = clean_(req.child, 40), parent = clean_(req.parent, 40);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !child || !parent) throw err_('missing_fields');
  var grade = clean_(req.grade, 20), level = clean_(req.level, 20), classCode = clean_(req.classCode, 20).toUpperCase();
  var cls = classCode ? findClass_(classCode) : null;
  if (classCode && !cls) { logApply_(req, '班級代碼不存在', ''); throw err_('bad_class'); }
  var t = table_('學生');
  var row = t.find(function (r) { return String(r['電子信箱']).toLowerCase() === email && r['孩子暱稱'] === child; });
  var resent = !!row, token;
  if (row) {
    token = row.token;
    if (cls && row['班級代碼'] !== cls['班級代碼']) t.update(row, { '班級代碼': cls['班級代碼'], '版本': 'course' });
  } else {
    token = newToken_(t);
    t.append({ token: token, '家長姓名': parent, '電子信箱': email, '孩子暱稱': child, '年級': grade, 'iEnglish 等級': level,
      '申請時間': new Date(), '字數': 0, '課程進度': '{}', '狀態': '使用中', '版本': cls ? 'course' : 'free', '班級代碼': cls ? cls['班級代碼'] : '' });
  }
  logApply_(req, resent ? '重寄' : '新申請', token);
  var link = (APP_URL || '').replace(/\/$/, '') + '/?t=' + token;
  var body = parent + ' 您好：\n\n這是 ' + child + ' 的「我的詞族地圖」登入碼：' + token + '\n\n'
    + (APP_URL ? '直接點這個連結就能開始：' + link + '\n\n' : '')
    + '第一次打開時會要求輸入登入碼，之後同一台裝置會記住。換裝置時，再用這封信的連結或登入碼登入，紀錄會自動同步。\n\n'
    + (cls ? '班級：' + cls['班級名稱'] + (cls['直播時段'] ? '（直播時段：' + cls['直播時段'] + '）' : '') + '\n\n' : '')
    + '請妥善保存這封信。\n\n' + MAIL_FROM_NAME;
  try {
    MailApp.sendEmail({ to: email, subject: '「我的詞族地圖」登入碼：' + token, body: body, name: MAIL_FROM_NAME });
    if (NOTIFY_EMAIL && !resent) MailApp.sendEmail(NOTIFY_EMAIL, '詞族地圖新申請：' + child, parent + ' / ' + email + ' / ' + grade + ' / ' + level + (cls ? ' / ' + cls['班級代碼'] : ''));
  } catch (e) { console.error('mail', e); return { ok: true, resent: resent, mailed: false }; }
  return { ok: true, resent: resent, mailed: true };
}

function login_(req) {
  var s = student_(req.token);
  table_('學生').update(s.row, { '最後使用': new Date() });
  var entries = table_('紀錄').filter(function (r) { return r.token === s.token; }).map(function (r) {
    try { return JSON.parse(r.json); } catch (e) { return null; }
  }).filter(Boolean);
  var progress = {};
  try { progress = JSON.parse(s.row['課程進度'] || '{}'); } catch (e) {}
  return { ok: true, student: { token: s.token, child: s.row['孩子暱稱'], nickname: s.row['提問暱稱'] || s.row['孩子暱稱'] },
    tier: s.tierName, tierInfo: publicTier_(s.tierName), cls: s.cls ? publicClass_(s.cls) : null,
    units: openUnits_(s), entries: entries, progress: progress,
    questions: s.tier.features.ask ? myQuestions_(s) : [], now: Date.now() };
}

function sync_(req) {
  var s = student_(req.token);
  var t = table_('紀錄');
  var mine = {};
  t.filter(function (r) { return r.token === s.token; }).forEach(function (r) { mine[r.id] = r; });
  (req.upserts || []).slice(0, 500).forEach(function (en) {
    if (!en || typeof en.id !== 'string' || typeof en.word !== 'string') return;
    var old = mine[en.id];
    if (old) { var o = {}; try { o = JSON.parse(old.json); } catch (e) {} if ((o.updated || 0) > (en.updated || 0)) return; }
    var vals = entryRow_(s.token, en);
    if (old) t.update(old, vals); else { t.append(vals); mine[en.id] = vals; }
  });
  (req.deletes || []).forEach(function (id) { if (mine[id]) t.remove(mine[id]); });
  var upd = { '最後使用': new Date(), '字數': t.filter(function (r) { return r.token === s.token; }).length };
  if (req.progress && typeof req.progress === 'object') upd['課程進度'] = JSON.stringify(req.progress).slice(0, 45000);
  table_('學生').update(s.row, upd);
  return { ok: true, now: Date.now(), questions: s.tier.features.ask ? myQuestions_(s) : [] };
}

function ask_(req) {
  var s = student_(req.token);
  requireFeature_(s, 'ask');
  if (!s.cls) throw err_('no_class');
  var doubt = clean_(req.doubt, 500), word = clean_(req.word, 40).toLowerCase();
  if (!word || !doubt) throw err_('missing_fields');
  var nick = clean_(req.nickname, 20) || s.row['孩子暱稱'];
  var q = {
    qid: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), '班級代碼': s.cls['班級代碼'], token: s.token, '暱稱': nick,
    '週次': Number(req.week) || 0, entryId: clean_(req.entryId, 40), '單字': word, '拆法': clean_(req.split, 80), '原句': clean_(req.sentence, 400),
    '零件的意思': clean_(req.partsMeaning, 200), '在句子裡的意思': clean_(req.meaning, 200), '不確定的地方': doubt,
    '狀態': '待回答', '判定': '', '老師說明': '', '提問時間': new Date(), '回答時間': '', reactions: '{}'
  };
  table_('提問').append(q);
  table_('學生').update(s.row, { '提問暱稱': nick });
  return { ok: true, question: publicQ_(q, s.token) };
}

function wall_(req) {
  var s = student_(req.token);
  requireFeature_(s, 'wall');
  if (!s.cls) throw err_('no_class');
  var week = Number(req.week) || 0;
  var qs = table_('提問').filter(function (r) { return r['班級代碼'] === s.cls['班級代碼'] && (!week || Number(r['週次']) === week); });
  qs.sort(function (a, b) { return time_(b['提問時間']) - time_(a['提問時間']); });
  return { ok: true, questions: qs.slice(0, 200).map(function (q) { return publicQ_(q, s.token); }) };
}

function react_(req) {
  var s = student_(req.token);
  requireFeature_(s, 'wall');
  var t = table_('提問');
  var q = t.find(function (r) { return r.qid === req.qid && s.cls && r['班級代碼'] === s.cls['班級代碼']; });
  if (!q) throw err_('not_found');
  if (q.token === s.token) throw err_('own_question');
  var kind = req.kind === 'diff' ? 'diff' : 'same';
  var rx = parseRx_(q.reactions);
  var other = kind === 'same' ? 'diff' : 'same';
  rx[other] = rx[other].filter(function (x) { return x !== s.token; });
  var i = rx[kind].indexOf(s.token);
  if (i >= 0) rx[kind].splice(i, 1); else rx[kind].push(s.token);
  t.update(q, { reactions: JSON.stringify(rx) });
  q.reactions = JSON.stringify(rx);
  return { ok: true, question: publicQ_(q, s.token) };
}

/* ---------------- 老師 ---------------- */

function tLogin_(req) {
  var tc = teacher_(req.teacherCode);
  var ai = !!PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  return { ok: true, teacher: { name: tc.name }, classes: tc.classes.map(function (c) {
    var p = publicClass_(c); p.openUnits = classUnits_(c); return p; }), ai: ai };
}

function tQuestions_(req) {
  var tc = teacher_(req.teacherCode), code = teacherClass_(tc, req.classCode);
  var week = Number(req.week) || 0, status = req.status || '';
  var qs = table_('提問').filter(function (r) {
    return r['班級代碼'] === code && (!week || Number(r['週次']) === week) && (!status || r['狀態'] === status);
  });
  qs.sort(function (a, b) { return time_(a['提問時間']) - time_(b['提問時間']); });
  return { ok: true, questions: qs.map(function (q) { var p = publicQ_(q, ''); p.nickname = q['暱稱']; return p; }) };
}

function tAnswer_(req) {
  var tc = teacher_(req.teacherCode);
  var t = table_('提問');
  var q = t.find(function (r) { return r.qid === req.qid; });
  if (!q || !tc.codes[q['班級代碼']]) throw err_('not_found');
  var upd = {};
  if (req.verdict !== undefined) { if (!(req.verdict in VERDICTS)) throw err_('bad_verdict'); upd['判定'] = req.verdict; }
  if (req.note !== undefined) upd['老師說明'] = clean_(req.note, 1500);
  if (req.status !== undefined) { if (Q_STATUS.indexOf(req.status) < 0) throw err_('bad_status'); upd['狀態'] = req.status; }
  if (upd['狀態'] === '已回答' && !q['回答時間']) upd['回答時間'] = new Date();
  t.update(q, upd);
  for (var k in upd) q[k] = upd[k];
  if (q.entryId && upd['判定'] !== undefined) {           // 同步到學生的紀錄欄位，方便老師在試算表裡看
    var rt = table_('紀錄');
    var r = rt.find(function (x) { return x.token === q.token && x.id === q.entryId; });
    if (r) rt.update(r, { '老師判定': VERDICTS[q['判定']] || '' });
  }
  var p = publicQ_(q, ''); p.nickname = q['暱稱'];
  return { ok: true, question: p };
}

function tAiDraft_(req) {
  var tc = teacher_(req.teacherCode);
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('OPENAI_API_KEY');
  if (!key) throw err_('no_ai');
  var q = table_('提問').find(function (r) { return r.qid === req.qid; });
  if (!q || !tc.codes[q['班級代碼']]) throw err_('not_found');
  var prompt = '你是台灣國中小英文老師，正在回答學生在「詞素（字首、字根、字尾）」課程裡的提問。'
    + '請用繁體中文、對小學高年級到國中生說話的口吻，寫 3 到 5 句的回答草稿：先判斷學生的拆法是否合理，'
    + '說明每個零件的意思，最後一定要回到原句，說明這個字在句子裡的意思。中文只當鷹架，英文字和原句保留英文。\n\n'
    + '單字：' + q['單字'] + '\n學生的拆法：' + q['拆法'] + '\n原句：' + q['原句'] + '\n學生寫的零件意思：' + q['零件的意思']
    + '\n學生寫的句中意思：' + q['在句子裡的意思'] + '\n學生不確定的地方：' + q['不確定的地方']
    + '\n\n最後一行另外寫「判定：confirmed / trap / mismatch」其中一個（confirmed＝拆法正確，trap＝陷阱字不能這樣拆，mismatch＝拆法要再想想）。';
  var res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({ model: props.getProperty('OPENAI_MODEL') || 'gpt-4o-mini', temperature: 0.4,
      messages: [{ role: 'user', content: prompt }] })
  });
  if (res.getResponseCode() !== 200) { console.error(res.getContentText()); throw err_('ai_failed'); }
  var text = JSON.parse(res.getContentText()).choices[0].message.content || '';
  var m = text.match(/判定[:：]\s*(confirmed|trap|mismatch)/i);
  return { ok: true, draft: text.replace(/\n?.*判定[:：].*$/m, '').trim(), verdict: m ? m[1].toLowerCase() : '' };
}

function tStats_(req) {
  var tc = teacher_(req.teacherCode), code = teacherClass_(tc, req.classCode);
  var tokens = {};
  table_('學生').forEach(function (r) { if (r['班級代碼'] === code && r['狀態'] !== '停用') tokens[r.token] = true; });
  var nStudents = Object.keys(tokens).length;
  var words = {}, morphs = {}, units = {}, subjects = {}, total = 0, active = {};
  table_('紀錄').forEach(function (r) {
    if (!tokens[r.token]) return;
    var en; try { en = JSON.parse(r.json); } catch (e) { return; }
    total++; active[r.token] = true;
    words[en.word] = (words[en.word] || 0) + 1;
    units[en.unit || 0] = (units[en.unit || 0] || 0) + 1;
    if (en.subject) subjects[en.subject] = (subjects[en.subject] || 0) + 1;
    var seen = {};
    (en.parts || []).forEach(function (p) { if (p.m && !seen[p.m]) { seen[p.m] = 1; morphs[p.m] = (morphs[p.m] || 0) + 1; } });
  });
  var qs = table_('提問').filter(function (r) { return r['班級代碼'] === code; });
  var verdicts = {}, qStatus = {};
  qs.forEach(function (q) { verdicts[q['判定'] || '未判定'] = (verdicts[q['判定'] || '未判定'] || 0) + 1; qStatus[q['狀態']] = (qStatus[q['狀態']] || 0) + 1; });
  var top = function (o, n) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n); };
  return { ok: true, stats: { students: nStudents, activeStudents: Object.keys(active).length, entries: total,
    distinctWords: Object.keys(words).length, perUnit: units, subjects: subjects,
    topWords: top(words, 30), topMorphemes: top(morphs, 30), sharedWords: top(words, 300).filter(function (x) { return x[1] >= 3; }).length,
    questions: qs.length, verdicts: verdicts, questionStatus: qStatus } };
}

/* ---------------- 共用 ---------------- */

function student_(token) {
  token = clean_(token, 10).toUpperCase();
  if (!token) throw err_('bad_token');
  var row = table_('學生').find(function (r) { return r.token === token; });
  if (!row) throw err_('bad_token');
  if (row['狀態'] === '停用') throw err_('disabled');
  var tierName = TIERS[row['版本']] ? row['版本'] : 'free';
  var cls = row['班級代碼'] ? findClass_(row['班級代碼']) : null;
  if (tierName === 'course' && !cls) tierName = 'free';          // 課程版一定要有班級
  return { token: token, row: row, tierName: tierName, tier: TIERS[tierName], cls: cls };
}

function requireFeature_(s, f) { if (!s.tier.features[f]) throw err_('feature_locked'); }

function publicTier_(name) { var t = TIERS[name]; return { name: name, label: t.label, pack: t.pack, features: t.features }; }

function findClass_(code) {
  code = String(code || '').toUpperCase();
  return table_('班級').find(function (r) { return String(r['班級代碼']).toUpperCase() === code && r['狀態'] !== '停用'; }) || null;
}

function publicClass_(c) {
  return { code: c['班級代碼'], name: c['班級名稱'], teacher: c['老師名稱'], start: c['開課日期'] ? fmtDate_(c['開課日期']) : '',
    live: c['直播時段'] || '' };
}

function classUnits_(c) {
  var n = Number(c['開放週次']);
  if (!n && c['開課日期']) {
    var start = new Date(c['開課日期']); start.setHours(0, 0, 0, 0);
    n = Math.floor((Date.now() - start.getTime()) / 86400000 / 7) + 1;
  }
  n = Math.max(1, Math.min(TOTAL_UNITS.course, n || 1));
  var out = []; for (var i = 1; i <= n; i++) out.push(i);
  return out;
}

function openUnits_(s) {
  if (s.tier.pack === 'free') return TOTAL_UNITS.free.slice();
  if (s.tier.unlock === 'class' && s.cls) return classUnits_(s.cls);
  var out = []; for (var i = 1; i <= TOTAL_UNITS.course; i++) out.push(i); return out;
}

function myQuestions_(s) {
  return table_('提問').filter(function (r) { return r.token === s.token; }).map(function (q) { return publicQ_(q, s.token); });
}

function parseRx_(v) {
  var rx = {}; try { rx = JSON.parse(v || '{}'); } catch (e) {}
  return { same: rx.same || [], diff: rx.diff || [] };
}

function publicQ_(q, token) {
  var rx = parseRx_(q.reactions);
  var answered = q['狀態'] === '已回答';
  return { qid: q.qid, nickname: q['暱稱'], week: Number(q['週次']) || 0, entryId: q.entryId, word: q['單字'], split: q['拆法'],
    sentence: q['原句'], partsMeaning: q['零件的意思'], meaning: q['在句子裡的意思'], doubt: q['不確定的地方'],
    status: q['狀態'], verdict: (answered || !token) ? q['判定'] : '', note: (answered || !token) ? q['老師說明'] : '',
    askedAt: time_(q['提問時間']), answeredAt: time_(q['回答時間']),
    same: rx.same.length, diff: rx.diff.length, mine: !!token && q.token === token,
    myReaction: token ? (rx.same.indexOf(token) >= 0 ? 'same' : rx.diff.indexOf(token) >= 0 ? 'diff' : '') : '' };
}

function teacher_(code) {
  code = clean_(code, 20).toUpperCase();
  if (!code) throw err_('bad_teacher');
  var classes = table_('班級').filter(function (r) { return String(r['老師代碼']).toUpperCase() === code && r['狀態'] !== '停用'; });
  if (!classes.length) throw err_('bad_teacher');
  var codes = {}; classes.forEach(function (c) { codes[c['班級代碼']] = true; });
  return { name: classes[0]['老師名稱'], classes: classes, codes: codes };
}

function teacherClass_(tc, code) {
  code = String(code || '').toUpperCase();
  if (!tc.codes[code]) throw err_('not_found');
  return code;
}

function entryRow_(token, en) {
  var parts = (en.parts || []).map(function (p) { return p.s; }).join('+');
  var check = en.check ? ({ key: '詞表一致', trap: '陷阱字', mismatch: '和詞表不同', open: '不在詞表' }[en.check.kind] || '') : '';
  return { token: token, id: en.id, '單字': en.word, '拆法': parts, '零件的意思': en.partsMeaning || '', '在句子裡的意思': en.meaning || '',
    '原句': en.sentence || '', '出處': en.book || '', '學科': en.subject || '', '透明度': en.clarity || '', '詞性': en.pos || '',
    '詞族': en.family || '', '單元': en.unit || '', '詞表比對': check, '建立': new Date(en.created || Date.now()),
    '更新': new Date(en.updated || Date.now()), json: JSON.stringify(en).slice(0, 45000) };
}

function logApply_(req, result, token) {
  table_('申請記錄').append({ '時間': new Date(), '家長姓名': clean_(req.parent, 40), '電子信箱': clean_(req.email, 120),
    '孩子暱稱': clean_(req.child, 40), '年級': clean_(req.grade, 20), 'iEnglish 等級': clean_(req.level, 20),
    '班級代碼': clean_(req.classCode, 20), '結果': result, token: token });
}

function newToken_(t) {
  var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', have = {};
  t.forEach(function (r) { have[r.token] = 1; });
  for (;;) {
    var s = ''; for (var i = 0; i < 6; i++) s += A.charAt(Math.floor(Math.random() * A.length));
    if (!have[s] && !/^DEMO/.test(s)) return s;
  }
}

/* ---------------- 試算表小工具 ---------------- */

function setup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); return; }
    var lastCol = Math.max(1, sh.getLastColumn());
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    SHEETS[name].forEach(function (h) {
      if (head.indexOf(h) < 0) { head.push(h); sh.getRange(1, head.length).setValue(h); }
    });
  });
}

var _tables = {};
function table_(name) {
  if (_tables[name]) return _tables[name];
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var values = sh.getDataRange().getValues();
  var head = values.shift().map(String);
  var rows = values.map(function (v, i) {
    var o = { _r: i + 2 }; head.forEach(function (h, j) { o[h] = v[j] instanceof Date ? v[j] : (v[j] === '' ? '' : (typeof v[j] === 'number' ? v[j] : String(v[j]))); });
    return o;
  });
  var T = {
    rows: rows,
    find: function (f) { for (var i = 0; i < rows.length; i++) if (!rows[i]._gone && f(rows[i])) return rows[i]; return null; },
    filter: function (f) { return rows.filter(function (r) { return !r._gone && f(r); }); },
    forEach: function (f) { rows.forEach(function (r) { if (!r._gone) f(r); }); },
    append: function (o) {
      var line = head.map(function (h) { return o[h] === undefined ? '' : o[h]; });
      sh.appendRow(line);
      var r = {}; head.forEach(function (h, j) { r[h] = line[j]; }); r._r = sh.getLastRow(); rows.push(r);
      for (var k in r) o[k] = r[k];
      return r;
    },
    update: function (r, vals) {
      Object.keys(vals).forEach(function (k) {
        var j = head.indexOf(k); if (j < 0) return;
        sh.getRange(r._r, j + 1).setValue(vals[k]); r[k] = vals[k];
      });
    },
    remove: function (r) {
      sh.deleteRow(r._r); r._gone = true;
      rows.forEach(function (x) { if (x._r > r._r) x._r--; });
    }
  };
  _tables[name] = T;
  return T;
}

function clean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200); }
function time_(v) { if (!v) return 0; var d = v instanceof Date ? v : new Date(v); return isNaN(d) ? 0 : d.getTime(); }
function fmtDate_(v) { var d = v instanceof Date ? v : new Date(v); return isNaN(d) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function err_(code) { var e = new Error(code); e.code = code; return e; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------- 手動執行 ---------------- */

/** 第一次部署前先執行一次：建立工作表、要求寄信授權。 */
function testSetup() {
  setup_();
  MailApp.getRemainingDailyQuota();
  console.log('工作表已建立；今日剩餘寄信額度：' + MailApp.getRemainingDailyQuota());
}

/** 建立一個示範班級（可以重複執行，不會重複建立）。 */
function addDemoClass() {
  setup_();
  if (findClass_('CLASS-A')) { console.log('CLASS-A 已存在'); return; }
  table_('班級').append({ '班級代碼': 'CLASS-A', '班級名稱': '週六上午班', '老師名稱': 'Hsu 老師', '老師代碼': 'T' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    '開課日期': new Date(), '直播時段': '每週六 10:00', '開放週次': '', '內容包': 'course', '狀態': '開課中' });
  console.log('已建立 CLASS-A，老師代碼請到「班級」工作表查看。');
}
