#!/usr/bin/env python3
"""把 tts/*.txt 的講解稿轉成 mp3，放到 site/audio/。

需要：
    pip3 install lameenc

OpenAI（預設）：
    export OPENAI_API_KEY=sk-...
    python3 tools/make_audio.py

ElevenLabs（用你自己的 clone voice）：
    export ELEVENLABS_API_KEY=...
    （聲音預設是 GHmfFNuBXAsbRXWO5lcA；要換別的聲音，設定 ELEVENLABS_VOICE_ID 或加 --voice）
    python3 tools/make_audio.py --provider elevenlabs

常用選項：
    --only w1-s0,w1-s1     只做這幾段（檔名不含 .mp3）
    --unit 3               只做 W3
    --force                已經有 mp3 的也重做（預設會跳過）
    --dry                  只列出要做哪些檔案，不呼叫 API

金鑰只放在環境變數，不要寫進這個檔案，也不要放上 GitHub。
"""
import argparse, json, os, pathlib, re, sys, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
TTS, OUT = ROOT / 'tts', ROOT / 'site' / 'audio'
ELEVEN_VOICE_ID = 'GHmfFNuBXAsbRXWO5lcA'          # ElevenLabs 預設聲音；環境變數 ELEVENLABS_VOICE_ID 或 --voice 可以覆蓋
ELEVEN_MODEL = 'eleven_v4'                       # 這個 PVC 聲音是為 v4 微調的
ELEVEN_SETTINGS = {'stability': 0.5, 'similarity_boost': 0.75, 'clone_strength': 0.75}   # v4 沒有 style、speed
RATE = 24000                                     # 兩家都用 24 kHz、16-bit、單聲道 PCM
PAUSE = re.compile(r'〔停頓\s*([\d.]+)\s*秒〕')
PARA_GAP = 0.7                                   # 段落之間的停頓（秒）

OPENAI_STYLE = ('用台灣華語、溫和清楚的老師口吻，對小學高年級到國中的學生講解英文字的組成。'
                '語速稍慢；遇到英文單字和英文句子，用自然的美式英語發音唸出來。')

def silence(sec):
    return b'\x00\x00' * int(RATE * sec)

def post(url, headers, body, retries=3):
    data = json.dumps(body).encode('utf-8')
    for k in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:400]
            if e.code in (429, 500, 502, 503) and k < retries - 1:
                time.sleep(4 * (k + 1)); continue
            sys.exit(f'API 錯誤 {e.code}：{msg}')
        except urllib.error.URLError as e:
            if k < retries - 1: time.sleep(4); continue
            sys.exit(f'連不上 API：{e}')

def say_openai(text, prev, nxt, args):
    key = os.environ.get('OPENAI_API_KEY') or sys.exit('請先設定 OPENAI_API_KEY')
    return post('https://api.openai.com/v1/audio/speech',
                {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                {'model': args.model or 'gpt-4o-mini-tts', 'voice': args.voice or 'coral', 'input': text,
                 'instructions': OPENAI_STYLE, 'response_format': 'pcm', 'speed': args.speed})

def say_eleven(text, prev, nxt, args):
    key = os.environ.get('ELEVENLABS_API_KEY') or sys.exit('請先設定 ELEVENLABS_API_KEY')
    voice = args.voice or os.environ.get('ELEVENLABS_VOICE_ID') or ELEVEN_VOICE_ID
    model = args.model or ELEVEN_MODEL
    settings = dict(ELEVEN_SETTINGS)
    if not model.startswith('eleven_v4'):            # 舊模型才有 speed
        settings.pop('clone_strength', None); settings['speed'] = args.speed
    body = {'text': text, 'model_id': model, 'voice_settings': settings}
    if prev: body['previous_text'] = prev[-500:]          # 前後文讓語調接得順
    if nxt: body['next_text'] = nxt[:500]
    return post(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_24000',
                {'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/pcm'}, body)

def pieces(txt):
    """把講解稿切成要唸的片段和停頓：[('say', 文字) | ('gap', 秒)]"""
    out = []
    for para in [p.strip() for p in txt.split('\n\n') if p.strip()]:
        pos = 0
        for m in PAUSE.finditer(para):
            seg = para[pos:m.start()].strip()
            if seg: out.append(('say', seg))
            out.append(('gap', float(m.group(1))))
            pos = m.end()
        seg = para[pos:].strip()
        if seg: out.append(('say', seg))
        out.append(('gap', PARA_GAP))
    return out

def make(name, args, say):
    import lameenc
    txt = (TTS / f'{name}.txt').read_text(encoding='utf-8')
    ps = pieces(txt)
    says = [t for k, t in ps if k == 'say']
    pcm, i = bytearray(silence(0.3)), 0
    for k, v in ps:
        if k == 'gap': pcm += silence(v); continue
        prev = ' '.join(says[:i])[-500:]; nxt = ' '.join(says[i + 1:])[:500]; i += 1
        pcm += say(v, prev, nxt, args)
    enc = lameenc.Encoder()
    enc.set_bit_rate(64); enc.set_in_sample_rate(RATE); enc.set_channels(1); enc.set_quality(2)
    mp3 = enc.encode(bytes(pcm)) + enc.flush()
    (OUT / f'{name}.mp3').write_bytes(mp3)
    return len(pcm) / 2 / RATE

def main():
    ap = argparse.ArgumentParser(description='產生講解語音')
    ap.add_argument('--provider', choices=['openai', 'elevenlabs'], default='openai')
    ap.add_argument('--voice', help='OpenAI 聲音名稱（預設 coral），或 ElevenLabs voice ID')
    ap.add_argument('--model', help='預設 gpt-4o-mini-tts／eleven_v4')
    ap.add_argument('--speed', type=float, default=0.95)
    ap.add_argument('--only', help='逗號分隔的檔名，例如 w1-s0,w1-s1')
    ap.add_argument('--unit', type=int, help='只做某一週，例如 3')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()
    if not args.dry:
        try: import lameenc  # noqa
        except ImportError: sys.exit('請先安裝：pip3 install lameenc')
    OUT.mkdir(parents=True, exist_ok=True)
    names = sorted(p.stem for p in TTS.glob('*.txt'))
    if args.only: names = [n for n in names if n in set(args.only.split(','))]
    if args.unit: names = [n for n in names if re.match(rf'^(free-)?w{args.unit}-', n)]
    todo = [n for n in names if args.force or not (OUT / f'{n}.mp3').exists()]
    print(f'{len(todo)} 個檔案要產生（共 {len(names)} 個，已存在的跳過）')
    if args.dry:
        print('\n'.join(todo)); return
    say = say_openai if args.provider == 'openai' else say_eleven
    for n in todo:
        t0 = time.time()
        sec = make(n, args, say)
        print(f'  {n}.mp3  {sec/60:.1f} 分鐘  （{time.time()-t0:.0f} 秒）')
    print('完成。把 site/audio/ 裡的 mp3 一起上傳到 GitHub，Netlify 重新部署後就會生效。')

if __name__ == '__main__':
    main()
