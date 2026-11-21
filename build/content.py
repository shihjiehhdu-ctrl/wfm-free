# -*- coding: utf-8 -*-
"""產生內容包與語音稿。

    python3 build/content.py

輸出：
  site/content/course.json   課程版（W1–W15）
  site/content/free.json     免費版（W1、W4、W9、W14）
  tts/*.txt, tts/*.ssml      每一段講解的語音稿
  tts/00-檔名清單.tsv          mp3 檔名 ↔ 單元段落
  build/key.json             答案表（單字 → 詞素）
  build/詞表.tsv               每週目標詞（給老師參考，不發給學生）

講解稿的寫法：
  *English sentence*   英文例句
  〔停頓 N 秒〕          停頓
  [課程版]開頭的段落     只出現在課程版
  [免費版]開頭的段落     只出現在免費版
"""
import json, re, pathlib, html, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from vocab import MORPHEMES, EXTRA_DISPLAY, COMPOUNDS, build_key
import units_1, units_2, units_3, units_4

VERSION = '2026.11'
ROOT = pathlib.Path(__file__).resolve().parent.parent
UNITS = units_1.UNITS + units_2.UNITS + units_3.UNITS + units_4.UNITS
STAGES = [{'n': 1, 'name': '拆', 'from': 1, 'to': 3}, {'n': 2, 'name': '轉', 'from': 4, 'to': 8},
          {'n': 3, 'name': '根', 'from': 9, 'to': 12}, {'n': 4, 'name': '用', 'from': 13, 'to': 15}]
FREE_UNITS = [1, 4, 9, 14]
TIER_TAG = re.compile(r'^\[(課程版|免費版)\]')

def course_tail(n):
    live = '第十六場總結直播' if n == 15 else '下週的直播'
    return [f'[課程版]做完以後，挑一個你最拿不準的字，在採集紀錄上按「提問」，寫下你不確定的地方。也到「班級牆」看看同學問了什麼，覺得有道理的，按「我也這樣想」。{live}，老師會一題一題回答大家的提問。',
            '[免費版]拿不準的字，先照你的判斷記下來。App 會告訴你它在不在課程詞表裡；不在的字，就留著「待確認」，等你在別的句子裡再遇到它。']

def pick(lines, tier):
    out = []
    for ln in lines:
        mm = TIER_TAG.match(ln)
        if mm:
            if (mm.group(1) == '課程版') != (tier == 'course'): continue
            ln = ln[mm.end():]
        out.append(ln)
    return out

def tts_text(lines):
    return '\n\n'.join(re.sub(r'\*([^*]+)\*', r'\1', ln) for ln in lines)

def tts_ssml(lines):
    out = []
    for ln in lines:
        x = html.escape(ln, quote=False)
        x = re.sub(r'\*([^*]+)\*', r'<lang xml:lang="en-US">\1</lang>', x)
        x = re.sub(r'〔停頓\s*(\d+(?:\.\d+)?)\s*秒〕', r'<break time="\1s"/>', x)
        out.append(f'<p>{x}</p>')
    return '<speak xml:lang="zh-TW">\n' + '\n'.join(out) + '\n</speak>\n'

def build_pack(tier, key, traps):
    units, segs_out = [], []
    keep = FREE_UNITS if tier == 'free' else [u['unit'] for u in UNITS]
    for u in UNITS:
        if u['unit'] not in keep: continue
        uu = {k: v for k, v in u.items() if k not in ('segments', 'free_task')}
        uu['segments'] = []
        for s in u['segments']:
            script = list(s['script'])
            if s['id'].endswith('-s5'): script += course_tail(u['unit'])
            ss = {k: v for k, v in s.items() if k != 'free'}
            ss['script'] = pick(script, tier)
            ss['slides'] = pick(s['slides'], tier)
            course_script = pick(script, 'course')
            if tier == 'free' and ss['script'] != course_script:
                ss['audio'] = f"audio/free-{s['id']}.mp3"
            uu['segments'].append(ss)
            segs_out.append((u['unit'], ss))
        units.append(uu)
    open_units = set(keep)
    morphs = []
    for x in MORPHEMES:
        y = dict(x)
        if tier == 'free' and x['unit'] not in open_units: y['display'] = True
        morphs.append(y)
    morphs += [dict(x) for x in EXTRA_DISPLAY]
    live = {x['id'] for x in morphs if not x.get('display')}
    k2 = {}
    for w, ids in key.items():
        ids2 = [i for i in ids if i in live]
        if ids2: k2[w] = ids2
    pack = {'version': VERSION, 'tier': tier, 'stages': STAGES, 'units': units, 'morphemes': morphs,
            'compounds': COMPOUNDS, 'key': k2, 'traps': traps}
    return pack, segs_out

def main():
    key, traps = build_key()
    (ROOT / 'site/content').mkdir(parents=True, exist_ok=True)
    tts = ROOT / 'tts'; tts.mkdir(exist_ok=True)
    for f in tts.glob('*'): f.unlink()
    rows, seen = [], set()
    for tier in ('course', 'free'):
        pack, segs = build_pack(tier, key, traps)
        (ROOT / f'site/content/{tier}.json').write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        for n, s in segs:
            name = s['audio'].split('/')[-1][:-4]
            if name in seen: continue
            seen.add(name)
            (tts / f'{name}.txt').write_text(tts_text(s['script']) + '\n', encoding='utf-8')
            (tts / f'{name}.ssml').write_text(tts_ssml(s['script']), encoding='utf-8')
            rows.append(f"{name}.mp3\tW{n}\t{s['title']}\t{'免費版' if name.startswith('free-') else '課程版＋免費版' if n in FREE_UNITS else '課程版'}")
        print(tier, len(pack['units']), 'units,', sum(len(u['segments']) for u in pack['units']), 'segments,', len(pack['key']), 'keyed words')
    (tts / '00-檔名清單.tsv').write_text('檔名\t單元\t段落\t用於\n' + '\n'.join(rows) + '\n', encoding='utf-8')
    (ROOT / 'build/key.json').write_text(json.dumps({'key': key, 'traps': traps}, ensure_ascii=False, indent=1), encoding='utf-8')
    unit_of = {x['id']: x['unit'] for x in MORPHEMES}
    by = {}
    for w, ids in key.items():
        n = max(unit_of[i] for i in ids)
        by.setdefault(n, []).append((w, '+'.join(ids)))
    lines = ['單元\t單字\t詞素']
    for n in sorted(by):
        lines += [f'W{n}\t{w}\t{ids}' for w, ids in sorted(by[n])]
    (ROOT / 'build/詞表.tsv').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(len(rows), 'tts files')

if __name__ == '__main__':
    main()
