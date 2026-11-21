// 用假的 SpreadsheetApp 跑 backend/Code.gs：node tests/backend.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
function makeSheet(name){
  const rows = [];
  const sh = {
    name, rows,
    appendRow(r){ rows.push(r.slice()); },
    getLastRow(){ return rows.length; },
    getLastColumn(){ return rows.reduce((m, r) => Math.max(m, r.length), 0); },
    setFrozenRows(){},
    deleteRow(i){ rows.splice(i - 1, 1); },
    getDataRange(){ const w = sh.getLastColumn(); return {getValues: () => rows.map(r => Array.from({length:w}, (_, j) => r[j] === undefined ? '' : r[j]))}; },
    getRange(r, c, nr, nc){ return {
      setValue(v){ while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
      getValues(){ return Array.from({length:nr || 1}, (_, i) => Array.from({length:nc || 1}, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')); }
    }; }
  };
  return sh;
}
const sheets = {}, mails = [];
const ctx = {
  console,
  SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet(n))})},
  LockService: {getScriptLock: () => ({waitLock(){}, releaseLock(){}})},
  MailApp: {sendEmail(a, b, c){ mails.push(typeof a === 'object' ? a : {to:a, subject:b, body:c}); }, getRemainingDailyQuota: () => 100},
  ContentService: {MimeType:{JSON:'json'}, createTextOutput: t => ({t, setMimeType(){ return this; }})},
  PropertiesService: {getScriptProperties: () => ({getProperty: k => k === 'OPENAI_API_KEY' ? 'sk-test' : null})},
  UrlFetchApp: {fetch: (u, o) => ({getResponseCode: () => 200, getContentText: () => JSON.stringify({choices:[{message:{content:'你的拆法是對的。\n判定：confirmed'}}]})})},
  Utilities: {formatDate: d => d.toISOString().slice(0, 10)}, Session: {getScriptTimeZone: () => 'Asia/Taipei'}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../backend/Code.gs'), 'utf8'), ctx);
const call = body => { vm.runInContext('_tables = {}', ctx); return JSON.parse(ctx.doPost({postData:{contents: JSON.stringify(body)}}).t); };

// 1. 免費版申請、登入
let r = call({action:'apply', parent:'王媽媽', email:'a@b.com', child:'小安', grade:'小六', level:'B1'});
assert.ok(r.ok && r.mailed, 'apply');
const tok = sheets['學生'].rows[1][0];
assert.match(tok, /^[A-Z0-9]{6}$/);
r = call({action:'apply', parent:'王媽媽', email:'A@b.com', child:'小安'});
assert.ok(r.resent, 'resend same token');
assert.strictEqual(sheets['學生'].rows.length, 2);
r = call({action:'login', token:tok.toLowerCase()});
assert.ok(r.ok); assert.strictEqual(r.tier, 'free'); assert.deepStrictEqual(r.units, [1, 4, 9, 14]);
assert.strictEqual(call({action:'ask', token:tok, word:'x', doubt:'why'}).error, 'feature_locked');
assert.strictEqual(call({action:'wall', token:tok}).error, 'feature_locked');

// 2. 同步：新增、較舊的覆蓋會被拒、刪除
const en = {id:'e1', word:'support', parts:[{t:'pre', s:'sup', m:'sub'}, {t:'root', s:'port', m:'port'}], unit:9, created:1, updated:100, check:{kind:'key'}};
r = call({action:'sync', token:tok, upserts:[en], progress:{unit:9, done:{'w9-s0':1}}});
assert.ok(r.ok);
call({action:'sync', token:tok, upserts:[Object.assign({}, en, {meaning:'old', updated:50})]});
r = call({action:'login', token:tok});
assert.strictEqual(r.entries.length, 1); assert.strictEqual(r.entries[0].meaning, undefined); assert.strictEqual(r.progress.unit, 9);
call({action:'sync', token:tok, upserts:[{id:'e2', word:'export', parts:[], updated:5}]});
call({action:'sync', token:tok, deletes:['e2']});
assert.strictEqual(call({action:'login', token:tok}).entries.length, 1);
assert.strictEqual(sheets['紀錄'].rows[1][3], 'sup+port');

// 3. 課程版：班級、提問、班級牆、回應
const start = new Date(Date.now() - 20 * 86400000);
sheets['班級'].appendRow(['CLS1', '週六班', 'Hsu', 'TCODE', start, '週六 10:00', '', 'course', '開課中']);
r = call({action:'apply', parent:'李爸爸', email:'c@d.com', child:'阿哲', classCode:'cls1'});
assert.ok(r.ok);
const tok2 = sheets['學生'].rows[2][0];
r = call({action:'login', token:tok2});
assert.strictEqual(r.tier, 'course'); assert.deepStrictEqual(r.units, [1, 2, 3], 'unlock by start date');
assert.strictEqual(call({action:'apply', parent:'x', email:'e@f.com', child:'y', classCode:'NOPE'}).error, 'bad_class');
// 把第一位學生也改成課程版
sheets['學生'].rows[1][11] = 'course'; sheets['學生'].rows[1][12] = 'CLS1';
r = call({action:'ask', token:tok, entryId:'e1', week:3, word:'support', split:'sup+port', sentence:'My parents support me.', doubt:'為什麼是 sup？', nickname:'安安'});
assert.ok(r.ok); const qid = r.question.qid; assert.ok(r.question.mine);
r = call({action:'wall', token:tok2});
assert.strictEqual(r.questions.length, 1); assert.strictEqual(r.questions[0].mine, false); assert.strictEqual(r.questions[0].nickname, '安安');
assert.ok(!('token' in r.questions[0]), 'no token on wall');
r = call({action:'react', token:tok2, qid, kind:'same'}); assert.strictEqual(r.question.same, 1); assert.strictEqual(r.question.myReaction, 'same');
r = call({action:'react', token:tok2, qid, kind:'diff'}); assert.strictEqual(r.question.same, 0); assert.strictEqual(r.question.diff, 1);
assert.strictEqual(call({action:'react', token:tok, qid, kind:'same'}).error, 'own_question');
// 開放週次欄位優先
sheets['班級'].rows[1][6] = 8;
assert.strictEqual(call({action:'login', token:tok2}).units.length, 8);

// 4. 老師
assert.strictEqual(call({action:'tLogin', teacherCode:'bad'}).error, 'bad_teacher');
r = call({action:'tLogin', teacherCode:'tcode'}); assert.ok(r.ok && r.ai); assert.strictEqual(r.classes[0].openUnits.length, 8);
r = call({action:'tQuestions', teacherCode:'TCODE', classCode:'CLS1'}); assert.strictEqual(r.questions.length, 1);
assert.strictEqual(call({action:'tQuestions', teacherCode:'TCODE', classCode:'OTHER'}).error, 'not_found');
r = call({action:'tAiDraft', teacherCode:'TCODE', qid}); assert.strictEqual(r.verdict, 'confirmed'); assert.ok(!/判定/.test(r.draft));
r = call({action:'tAnswer', teacherCode:'TCODE', qid, verdict:'confirmed', note:'sub 在 p 前面變成 sup。', status:'排入直播'});
assert.ok(r.ok);
// 還沒「已回答」時，學生看不到判定
assert.strictEqual(call({action:'wall', token:tok2}).questions[0].verdict, '');
call({action:'tAnswer', teacherCode:'TCODE', qid, status:'已回答'});
r = call({action:'login', token:tok});
assert.strictEqual(r.questions[0].verdict, 'confirmed'); assert.strictEqual(r.questions[0].entryId, 'e1');
assert.strictEqual(sheets['紀錄'].rows[1][14], '拆法正確');
assert.strictEqual(call({action:'tAnswer', teacherCode:'TCODE', qid, verdict:'nope'}).error, 'bad_verdict');
r = call({action:'tStats', teacherCode:'TCODE', classCode:'CLS1'});
assert.strictEqual(r.stats.students, 2); assert.strictEqual(r.stats.entries, 1); assert.deepStrictEqual(r.stats.topMorphemes[0], ['sub', 1]);

// 5. 停用、錯誤
sheets['學生'].rows[2][10] = '停用';
assert.strictEqual(call({action:'login', token:tok2}).error, 'disabled');
assert.strictEqual(call({action:'nope'}).error, 'unknown_action');
assert.strictEqual(JSON.parse(ctx.doPost({postData:{contents:'{bad'}}).t).error, 'bad_json');
console.log('backend: all tests passed;', mails.length, 'mails');
