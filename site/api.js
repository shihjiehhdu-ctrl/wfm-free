/* 我的詞族地圖・後端呼叫
 * API_URL 有值：POST text/plain JSON 到 Apps Script。
 * API_URL 留空：預覽模式，用這個檔案下半部的示範後端（資料存在這台裝置的 localStorage）。
 *   學生 DEMO01＝免費版　DEMOC1＝課程版（班級 DEMO-A）　DEMOA1＝進階版
 *   老師代碼 TDEMO
 */
(function () {
  'use strict';
  var CFG = window.WFM_CONFIG || {};
  var URL_ = (CFG.API_URL || '').trim();

  function call(action, payload, opts) {
    var body = Object.assign({ action: action }, payload || {});
    if (!URL_) return Demo.handle(body);
    return fetch(URL_, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body), keepalive: !!(opts && opts.keepalive), redirect: 'follow'
    }).then(function (r) { return r.json(); });
  }

  /* ---------------- 示範後端 ---------------- */
  var TIERS = {
    free:     { label: '免費版', pack: 'free',   unlock: 'all',   features: { wall: false, ask: false, ai: false } },
    course:   { label: '課程版', pack: 'course', unlock: 'class', features: { wall: true,  ask: true,  ai: false } },
    advanced: { label: '進階版', pack: 'course', unlock: 'all',   features: { wall: false, ask: false, ai: true } }
  };
  var VERDICTS = { confirmed: 1, trap: 1, mismatch: 1, '': 1 };
  var DBKEY = 'wfm.demo.db.v2';
  var mem = null;

  function seed() {
    var now = Date.now(), day = 86400000;
    var q = function (id, nick, week, word, split, sentence, pm, m, doubt, status, verdict, note, same) {
      return { qid: id, cls: 'DEMO-A', token: 'X' + id, nick: nick, week: week, entryId: '', word: word, split: split, sentence: sentence,
        partsMeaning: pm, meaning: m, doubt: doubt, status: status, verdict: verdict, note: note, askedAt: now - (20 - week) * day,
        answeredAt: status === '已回答' ? now - (19 - week) * day : 0, rx: { same: same || [], diff: [] } };
    };
    return {
      students: {
        DEMO01: { token: 'DEMO01', child: '小安', tier: 'free', cls: '', progress: {}, nick: '' },
        DEMOC1: { token: 'DEMOC1', child: '小安', tier: 'course', cls: 'DEMO-A', progress: {}, nick: '' },
        DEMOA1: { token: 'DEMOA1', child: '小安', tier: 'advanced', cls: '', progress: {}, nick: '' }
      },
      entries: {},
      classes: { 'DEMO-A': { code: 'DEMO-A', name: '示範班（週六上午）', teacher: 'Hsu 老師', tcode: 'TDEMO', start: '', live: '每週六 10:00', open: 10 } },
      questions: [
        q('qd1', '阿哲', 1, 'discover', 'dis+cover', 'Scientists discovered a new kind of frog.', 'dis 不、相反；cover 蓋住', '發現', 'dis 不是「不」的意思嗎？「不蓋住」怎麼會變成發現？', '已回答', 'confirmed', '你的拆法是對的。dis 在這裡比較接近「拿開」：把蓋子拿開，原本藏著的東西就被看見了。回到句子：科學家「發現」了一種新的青蛙。這是半透明的字。', ['a', 'b']),
        q('qd2', 'Mia', 2, 'restaurant', 're+staurant', 'We had dinner at a small restaurant.', 're 再一次', '餐廳', 'restaurant 的 re 是「再一次」嗎？', '已回答', 'trap', '這是陷阱字。拿掉 re，剩下的 staurant 不是一個意思接得上的字，所以 restaurant 不要拆，標成「不能拆」。', ['c']),
        q('qd3', '小宇', 9, 'opportunity', 'op+port+unity', 'This is a great opportunity to learn.', 'op 對著；port 帶著移動', '機會', 'port 是帶著東西移動，可是「機會」跟移動有什麼關係？', '排入直播', '', '', ['a', 'd', 'e']),
        q('qd4', 'Leo', 9, 'support', 'sup+port', 'My parents support my decision.', 'sup 在下面；port 帶著', '支持', '為什麼是 sup 不是 sub？', '待回答', '', '', [])
      ]
    };
  }
  function db() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(DBKEY) || 'null'); } catch (e) { mem = null; }   // 每次呼叫都重新讀，讓學生頁和老師頁看到同一份
    if (mem && !mem.students) mem = null;
    if (!mem) mem = seed();
    return mem;
  }
  function save() { try { localStorage.setItem(DBKEY, JSON.stringify(mem)); } catch (e) {} }
  function fail(code) { return { ok: false, error: code }; }
  function student(token) {
    var s = db().students[String(token || '').toUpperCase()];
    if (!s) return null;
    var tier = TIERS[s.tier] ? s.tier : 'free';
    var cls = s.cls ? db().classes[s.cls] : null;
    if (tier === 'course' && !cls) tier = 'free';
    return { s: s, tierName: tier, tier: TIERS[tier], cls: cls };
  }
  function units(st) {
    if (st.tier.pack === 'free') return [1, 4, 9, 14];
    var n = 15;
    if (st.tier.unlock === 'class' && st.cls) n = st.cls.open || 1;
    var out = []; for (var i = 1; i <= n; i++) out.push(i); return out;
  }
  function pubQ(q, token) {
    var answered = q.status === '已回答';
    return { qid: q.qid, nickname: q.nick, week: q.week, entryId: q.entryId, word: q.word, split: q.split, sentence: q.sentence,
      partsMeaning: q.partsMeaning, meaning: q.meaning, doubt: q.doubt, status: q.status,
      verdict: (answered || !token) ? q.verdict : '', note: (answered || !token) ? q.note : '', askedAt: q.askedAt, answeredAt: q.answeredAt,
      same: q.rx.same.length, diff: q.rx.diff.length, mine: !!token && q.token === token,
      myReaction: token ? (q.rx.same.indexOf(token) >= 0 ? 'same' : q.rx.diff.indexOf(token) >= 0 ? 'diff' : '') : '' };
  }
  function pubClass(c) { return { code: c.code, name: c.name, teacher: c.teacher, start: c.start, live: c.live }; }
  function teacher(code) {
    code = String(code || '').toUpperCase();
    var cs = Object.keys(db().classes).map(function (k) { return db().classes[k]; }).filter(function (c) { return c.tcode === code; });
    return cs.length ? cs : null;
  }
  function genToken() {
    var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += A.charAt(Math.floor(Math.random() * A.length));
    return s;
  }

  var H = {
    apply: function (r) {
      if (!r.email || !r.child || !r.parent) return fail('missing_fields');
      var code = String(r.classCode || '').toUpperCase();
      if (code && !db().classes[code]) return fail('bad_class');
      var t = genToken();
      db().students[t] = { token: t, child: r.child, tier: code ? 'course' : 'free', cls: code, progress: {}, nick: '' };
      save();
      return { ok: true, resent: false, mailed: false, demoToken: t };
    },
    login: function (r) {
      var st = student(r.token); if (!st) return fail('bad_token');
      var es = db().entries[st.s.token] || {};
      return { ok: true, student: { token: st.s.token, child: st.s.child, nickname: st.s.nick || st.s.child },
        tier: st.tierName, tierInfo: { name: st.tierName, label: st.tier.label, pack: st.tier.pack, features: st.tier.features },
        cls: st.cls ? pubClass(st.cls) : null, units: units(st), entries: Object.keys(es).map(function (k) { return es[k]; }),
        progress: st.s.progress || {}, questions: st.tier.features.ask ? H._mine(st) : [], now: Date.now() };
    },
    _mine: function (st) { return db().questions.filter(function (q) { return q.token === st.s.token; }).map(function (q) { return pubQ(q, st.s.token); }); },
    sync: function (r) {
      var st = student(r.token); if (!st) return fail('bad_token');
      var es = db().entries[st.s.token] = db().entries[st.s.token] || {};
      (r.upserts || []).forEach(function (en) { if (!es[en.id] || (es[en.id].updated || 0) <= (en.updated || 0)) es[en.id] = en; });
      (r.deletes || []).forEach(function (id) { delete es[id]; });
      if (r.progress) st.s.progress = r.progress;
      save();
      return { ok: true, now: Date.now(), questions: st.tier.features.ask ? H._mine(st) : [] };
    },
    ask: function (r) {
      var st = student(r.token); if (!st) return fail('bad_token');
      if (!st.tier.features.ask) return fail('feature_locked');
      if (!r.word || !r.doubt) return fail('missing_fields');
      var q = { qid: 'q' + Date.now().toString(36), cls: st.cls.code, token: st.s.token, nick: r.nickname || st.s.child, week: Number(r.week) || 0,
        entryId: r.entryId || '', word: String(r.word).toLowerCase(), split: r.split || '', sentence: r.sentence || '', partsMeaning: r.partsMeaning || '',
        meaning: r.meaning || '', doubt: r.doubt, status: '待回答', verdict: '', note: '', askedAt: Date.now(), answeredAt: 0, rx: { same: [], diff: [] } };
      db().questions.push(q); st.s.nick = q.nick; save();
      return { ok: true, question: pubQ(q, st.s.token) };
    },
    wall: function (r) {
      var st = student(r.token); if (!st) return fail('bad_token');
      if (!st.tier.features.wall) return fail('feature_locked');
      var w = Number(r.week) || 0;
      var qs = db().questions.filter(function (q) { return q.cls === st.cls.code && (!w || q.week === w); })
        .sort(function (a, b) { return b.askedAt - a.askedAt; });
      return { ok: true, questions: qs.map(function (q) { return pubQ(q, st.s.token); }) };
    },
    react: function (r) {
      var st = student(r.token); if (!st) return fail('bad_token');
      if (!st.tier.features.wall) return fail('feature_locked');
      var q = db().questions.filter(function (x) { return x.qid === r.qid; })[0];
      if (!q) return fail('not_found');
      if (q.token === st.s.token) return fail('own_question');
      var k = r.kind === 'diff' ? 'diff' : 'same', o = k === 'same' ? 'diff' : 'same', t = st.s.token;
      q.rx[o] = q.rx[o].filter(function (x) { return x !== t; });
      var i = q.rx[k].indexOf(t); if (i >= 0) q.rx[k].splice(i, 1); else q.rx[k].push(t);
      save();
      return { ok: true, question: pubQ(q, t) };
    },
    tLogin: function (r) {
      var cs = teacher(r.teacherCode); if (!cs) return fail('bad_teacher');
      return { ok: true, teacher: { name: cs[0].teacher }, ai: false, classes: cs.map(function (c) {
        var p = pubClass(c); p.openUnits = []; for (var i = 1; i <= (c.open || 1); i++) p.openUnits.push(i); return p; }) };
    },
    tQuestions: function (r) {
      var cs = teacher(r.teacherCode); if (!cs) return fail('bad_teacher');
      if (!cs.some(function (c) { return c.code === r.classCode; })) return fail('not_found');
      var w = Number(r.week) || 0;
      var qs = db().questions.filter(function (q) { return q.cls === r.classCode && (!w || q.week === w) && (!r.status || q.status === r.status); })
        .sort(function (a, b) { return a.askedAt - b.askedAt; });
      return { ok: true, questions: qs.map(function (q) { return pubQ(q, ''); }) };
    },
    tAnswer: function (r) {
      var cs = teacher(r.teacherCode); if (!cs) return fail('bad_teacher');
      var q = db().questions.filter(function (x) { return x.qid === r.qid; })[0];
      if (!q || !cs.some(function (c) { return c.code === q.cls; })) return fail('not_found');
      if (r.verdict !== undefined) { if (!(r.verdict in VERDICTS)) return fail('bad_verdict'); q.verdict = r.verdict; }
      if (r.note !== undefined) q.note = String(r.note).slice(0, 1500);
      if (r.status !== undefined) q.status = r.status;
      if (q.status === '已回答' && !q.answeredAt) q.answeredAt = Date.now();
      save();
      return { ok: true, question: pubQ(q, '') };
    },
    tAiDraft: function () { return fail('no_ai'); },
    tStats: function (r) {
      var cs = teacher(r.teacherCode); if (!cs) return fail('bad_teacher');
      var code = r.classCode;
      var tokens = Object.keys(db().students).filter(function (t) { return db().students[t].cls === code; });
      var words = {}, morphs = {}, perUnit = {}, subjects = {}, total = 0, active = 0;
      tokens.forEach(function (t) {
        var es = db().entries[t] || {}, ks = Object.keys(es);
        if (ks.length) active++;
        ks.forEach(function (k) {
          var en = es[k]; total++;
          words[en.word] = (words[en.word] || 0) + 1;
          perUnit[en.unit || 0] = (perUnit[en.unit || 0] || 0) + 1;
          if (en.subject) subjects[en.subject] = (subjects[en.subject] || 0) + 1;
          var seen = {};
          (en.parts || []).forEach(function (p) { if (p.m && !seen[p.m]) { seen[p.m] = 1; morphs[p.m] = (morphs[p.m] || 0) + 1; } });
        });
      });
      // 示範用：加上假想同學的統計，讓畫面看起來像一個班
      [['port', 23], ['tion', 41], ['un', 30], ['re', 27], ['dis', 18], ['ment', 22], ['vis', 12], ['spec', 9], ['al', 25], ['duc', 14]].forEach(function (x) { morphs[x[0]] = (morphs[x[0]] || 0) + x[1]; });
      [['transportation', 7], ['disappear', 6], ['unhappy', 6], ['report', 5], ['support', 5], ['development', 4], ['television', 4], ['return', 4]].forEach(function (x) { words[x[0]] = (words[x[0]] || 0) + x[1]; });
      var top = function (o, n) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n); };
      var qs = db().questions.filter(function (q) { return q.cls === code; }), verdicts = {}, qStatus = {};
      qs.forEach(function (q) { var v = q.verdict || '未判定'; verdicts[v] = (verdicts[v] || 0) + 1; qStatus[q.status] = (qStatus[q.status] || 0) + 1; });
      return { ok: true, stats: { students: tokens.length + 11, activeStudents: active + 10, entries: total + 214, distinctWords: Object.keys(words).length + 96,
        perUnit: perUnit, subjects: subjects, topWords: top(words, 30), topMorphemes: top(morphs, 30), sharedWords: 18,
        questions: qs.length, verdicts: verdicts, questionStatus: qStatus } };
    }
  };

  var Demo = {
    handle: function (body) {
      try { if (localStorage.getItem(DBKEY)) mem = null; } catch (e) {}
      var h = H[body.action];
      var res = h && body.action.charAt(0) !== '_' ? h(body) : fail('unknown_action');
      return new Promise(function (ok) { setTimeout(function () { ok(JSON.parse(JSON.stringify(res))); }, 120); });
    },
    reset: function () { mem = seed(); save(); }
  };

  window.WFM_API = { call: call, preview: !URL_, demo: Demo };
})();
