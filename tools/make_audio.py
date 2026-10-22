#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 OpenAI TTS 產生「我的詞族地圖」各段講解的 mp3。

讀取：site/content/free.json（每一段的 script）
輸出：site/audio/<段落 id>.mp3，例如 site/audio/w1-s1.mp3

處理方式
  - 〔停頓 N 秒〕 → 在音檔裡插入 N 秒靜音（TTS 本身不支援停頓標記）
  - *English sentence* → 去掉星號；預設和中文一起唸，靠 instructions 要求英文用清楚的美式發音
    加上 --split-english 時，英文例句會單獨產生，用另一組 instructions（稍慢、清楚）
  - 每一段落之間插入 0.6 秒靜音
  - 向 API 要 PCM（24 kHz、16-bit、單聲道），接好之後再轉成 mp3

安裝
  pip install openai lameenc

使用
  export OPENAI_API_KEY=sk-...           # Windows: set OPENAI_API_KEY=sk-...
  python3 tools/make_audio.py --list               # 列出所有段落
  python3 tools/make_audio.py --only w1-s1         # 先產生一段試聽
  python3 tools/make_audio.py                      # 產生所有還沒有的音檔
  python3 tools/make_audio.py --force              # 全部重新產生
  python3 tools/make_audio.py --dry-run            # 只顯示會送出的文字，不呼叫 API
"""
import argparse, json, os, re, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'site' / 'content' / 'free.json'
OUT_DIR = ROOT / 'site' / 'audio'

RATE = 24000                 # OpenAI PCM 輸出：24 kHz, 16-bit signed little-endian, mono
PARA_GAP = 0.6               # 段落之間的靜音（秒）
MAX_CHARS = 1200             # 單次送出的字數上限，太長會自動在句號切開

ZH_INSTRUCTIONS = (
    "你是一位溫和、清楚的英文老師，正在為國小高年級到國中的學生錄製單字課程講解。"
    "用台灣華語（不是中國大陸口音）說中文，語速適中、自然，像在和學生面對面說話，不要像播新聞。"
    "遇到英文單字和英文句子時，用清楚、自然的美式英語發音，英文句子稍微放慢。"
    "提問的地方語氣上揚，像在邀請學生想一想。"
)
EN_INSTRUCTIONS = (
    "Read this English example sentence clearly and naturally in General American English, "
    "slightly slower than normal conversation, for young learners of English."
)

PAUSE_RE = re.compile(r'〔停頓\s*(\d+(?:\.\d+)?)\s*秒〕')
EN_RE = re.compile(r'\*(.+?)\*')


def load_segments():
    pack = json.loads(CONTENT.read_text(encoding='utf-8'))
    for u in pack['units']:
        for s in u['segments']:
            yield u['unit'], s


def plan(script, split_english):
    """把一段講解稿切成要送出的片段與靜音：[('tts', text, instructions) | ('gap', seconds)]"""
    items = []
    for i, para in enumerate(script):
        if i and not (items and items[-1][0] == 'gap'):
            items.append(('gap', PARA_GAP))
        parts = PAUSE_RE.split(para)          # 文字, 秒數, 文字, 秒數, ...
        for k, part in enumerate(parts):
            if k % 2 == 1:
                items.append(('gap', float(part)))
                continue
            text = part.strip()
            if not text:
                continue
            if split_english:
                runs = EN_RE.split(text)      # 中文, 英文, 中文, ...
                for j, run in enumerate(runs):
                    run = run.strip()
                    if not run:
                        continue
                    if j % 2 == 1:
                        items.append(('tts', run, EN_INSTRUCTIONS))
                    else:
                        items.extend(('tts', c, ZH_INSTRUCTIONS) for c in chunk(run))
            else:
                items.extend(('tts', c, ZH_INSTRUCTIONS) for c in chunk(EN_RE.sub(r'\1', text)))
    return merge_tts(items)


def chunk(text):
    if len(text) <= MAX_CHARS:
        return [text]
    out, buf = [], ''
    for sent in re.split(r'(?<=[。！？!?])', text):
        if len(buf) + len(sent) > MAX_CHARS and buf:
            out.append(buf)
            buf = ''
        buf += sent
    if buf:
        out.append(buf)
    return out


def merge_tts(items):
    """相鄰、同一組 instructions 的文字片段合併成一次 API 呼叫（語調比較連貫）。"""
    merged = []
    for it in items:
        if (merged and it[0] == 'tts' and merged[-1][0] == 'tts' and merged[-1][2] == it[2]
                and len(merged[-1][1]) + len(it[1]) < MAX_CHARS):
            merged[-1] = ('tts', merged[-1][1] + ' ' + it[1], it[2])
        else:
            merged.append(it)
    return merged


def silence(seconds):
    return b'\x00\x00' * int(RATE * seconds)


def tts_pcm(client, text, instructions, model, voice, speed, retries=4):
    for attempt in range(retries):
        try:
            kwargs = dict(model=model, voice=voice, input=text, response_format='pcm')
            if model.startswith('gpt-'):
                kwargs['instructions'] = instructions
            if speed != 1.0:
                kwargs['speed'] = speed
            with client.audio.speech.with_streaming_response.create(**kwargs) as resp:
                return resp.read()
        except Exception as e:                      # 網路或限流錯誤：等一下再試
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt * 3
            print(f'    API 錯誤：{e}；{wait} 秒後重試', file=sys.stderr)
            time.sleep(wait)


def pcm_to_mp3(pcm, path, bitrate):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate)
    enc.set_in_sample_rate(RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm) + enc.flush()
    tmp = path.with_suffix('.mp3.part')
    tmp.write_bytes(data)
    tmp.replace(path)


def main():
    ap = argparse.ArgumentParser(description='用 OpenAI TTS 產生詞族地圖的講解音檔')
    ap.add_argument('--only', nargs='*', help='只產生這些段落，例如 --only w1-s1 w4-s2；也可以寫 w13 代表整個單元')
    ap.add_argument('--force', action='store_true', help='已經有的音檔也重新產生')
    ap.add_argument('--dry-run', action='store_true', help='只顯示要送出的文字，不呼叫 API')
    ap.add_argument('--list', action='store_true', help='列出所有段落和音檔狀態')
    ap.add_argument('--split-english', action='store_true', help='英文例句單獨產生，用英文的 instructions')
    ap.add_argument('--model', default='gpt-4o-mini-tts')
    ap.add_argument('--voice', default='marin', help='例如 marin、cedar、coral、sage、nova')
    ap.add_argument('--speed', type=float, default=1.0, help='0.25–4.0，預設 1.0')
    ap.add_argument('--bitrate', type=int, default=64, help='mp3 位元率 kbps，語音用 64 就夠')
    args = ap.parse_args()

    segs = list(load_segments())
    if args.only:
        want = set(args.only)
        segs = [(u, s) for u, s in segs if s['id'] in want or s['id'].split('-')[0] in want]
        if not segs:
            sys.exit('找不到指定的段落。用 --list 看所有段落 id。')

    if args.list:
        for u, s in segs:
            f = OUT_DIR / f"{s['id']}.mp3"
            print(f"{s['id']:8}  W{u:<3} {s['title']:<18} {'✓ ' + str(f.stat().st_size // 1024) + ' KB' if f.exists() else '—'}")
        return

    client = None
    if not args.dry_run:
        if not os.environ.get('OPENAI_API_KEY'):
            sys.exit('請先設定環境變數 OPENAI_API_KEY。')
        try:
            from openai import OpenAI
            import lameenc  # noqa: F401
        except ImportError:
            sys.exit('請先安裝：pip install openai lameenc')
        client = OpenAI()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    done = skipped = 0
    for u, s in segs:
        out = OUT_DIR / f"{s['id']}.mp3"
        if out.exists() and not args.force and not args.dry_run:
            skipped += 1
            continue
        items = plan(s['script'], args.split_english)
        calls = sum(1 for it in items if it[0] == 'tts')
        print(f"[W{u}] {s['id']} {s['title']}（{calls} 次 API 呼叫）")
        if args.dry_run:
            for it in items:
                print(f"    {'〔靜音 %.1f 秒〕' % it[1] if it[0] == 'gap' else ('EN│' if it[2] is EN_INSTRUCTIONS else 'ZH│') + it[1]}")
            continue
        pcm = bytearray(silence(0.3))
        for it in items:
            pcm += silence(it[1]) if it[0] == 'gap' else tts_pcm(client, it[1], it[2], args.model, args.voice, args.speed)
        pcm += silence(0.5)
        pcm_to_mp3(bytes(pcm), out, args.bitrate)
        print(f"    → {out.relative_to(ROOT)}  {len(pcm) / 2 / RATE:.0f} 秒")
        done += 1
    if not args.dry_run:
        print(f'完成：產生 {done} 個，略過已存在的 {skipped} 個。')


if __name__ == '__main__':
    main()
