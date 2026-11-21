# -*- coding: utf-8 -*-
"""詞素清單與答案表（15 週版）。

MORPHEMES：每個詞素的 id、類型、拼法、意思、所屬週次、錨點詞、陷阱字。
build_key()：從 curated.py（舊的 17 週編號）讀出錨點詞與延伸目標詞，換成 15 週編號，
             產生 key（單字 → 詞素 id）與 traps（陷阱字 → 看起來像的詞素 id）。
"""
import re, importlib.util, pathlib

HERE = pathlib.Path(__file__).resolve().parent

def m(id, t, forms, mean, unit, field, anchors=(), traps=(), label=None, pos=None):
    d = {'id': id, 't': t, 'forms': list(forms), 'mean': mean, 'unit': unit, 'field': field,
         'anchors': list(anchors), 'traps': list(traps)}
    if label: d['label'] = label
    if pos: d['pos'] = pos
    return d

F1, F2, F3 = 'W1 否定與複合字', 'W2 時間與次序字首', 'W3 位置與程度字首'
F4, F5, F6, F7 = 'W4 名詞字尾①', 'W5 名詞字尾②', 'W6 形容詞字尾', 'W7 動詞與副詞字尾'
F9, F10, F11, F12 = 'W9 移動家族', 'W10 感知與表達家族', 'W11 建造與製作家族', 'W12 希臘科學詞素'

MORPHEMES = [
  # 第一階段　拆
  m('cmp', 'cmp', [], '兩個字拼成一個字', 1, F1, ['classroom', 'homework', 'birthday', 'bedroom', 'supermarket'], ['butterfly'], label='複合字'),
  m('un', 'pre', ['un'], '不、反轉', 1, F1, ['unhappy', 'unable', 'unkind', 'unfair', 'unusual'], ['uncle', 'uniform', 'until', 'understand']),
  m('in', 'pre', ['in', 'im', 'il', 'ir'], '不／進入', 1, F1, ['impolite', 'impossible', 'independent', 'incorrect'], ['important', 'insect', 'interest'], label='in / im / il / ir'),
  m('dis', 'pre', ['dis'], '不、相反、分開', 1, F1, ['disappear', 'dishonest', 'discover'], ['discuss', 'distance']),
  m('mis', 'pre', ['mis'], '錯誤', 1, F1, ['mistake'], ['miss', 'missile']),
  m('non', 'pre', ['non'], '非、不是', 1, F1),
  m('re', 'pre', ['re'], '再、回', 2, F2, ['return', 'review', 'recycle', 'recover'], ['really', 'ready', 'reason', 'restaurant']),
  m('pre', 'pre', ['pre'], '之前', 2, F2, ['prepare'], ['pretty', 'pressure', 'president']),
  m('post', 'pre', ['post'], '之後', 2, F2, [], ['postcard']),
  m('fore', 'pre', ['fore'], '之前', 2, F2, [], ['foreign', 'foreigner']),
  m('ex', 'pre', ['ex', 'ef', 'e'], '向外', 2, F2, ['exit', 'express'], ['excellent', 'expensive', 'exercise'], label='ex-'),
  m('inter', 'pre', ['inter'], '之間、相互', 3, F3, ['internet', 'interview', 'international'], ['interest', 'interesting']),
  m('sub', 'pre', ['sub', 'sup', 'suc', 'suf', 'sus'], '在下', 3, F3, ['subway'], ['subject'], label='sub-'),
  m('super', 'pre', ['super', 'sur'], '在上、超過', 3, F3, ['supermarket']),
  m('trans', 'pre', ['trans'], '跨越', 3, F3),
  m('over', 'pre', ['over'], '過度、在上', 3, F3, ['overpass']),
  m('under', 'pre', ['under'], '不足、在下', 3, F3, ['underline', 'underwear', 'underpass'], ['understand']),
  # 第二階段　轉
  m('tion', 'suf', ['ation', 'ition', 'tion', 'sion', 'ion'], '名詞：動作、結果', 4, F4, ['action', 'decision', 'invitation', 'direction', 'discussion', 'pollution'], ['station', 'question', 'mansion'], label='-tion / -sion', pos='n'),
  m('ment', 'suf', ['ment'], '名詞：動作、結果', 4, F4, ['movement', 'development', 'improvement', 'agreement'], ['comment', 'apartment', 'department'], pos='n'),
  m('ness', 'suf', ['ness'], '名詞：狀態', 4, F4, ['happiness', 'kindness', 'darkness', 'weakness'], ['business'], pos='n'),
  m('ity', 'suf', ['ility', 'ity'], '名詞：性質', 5, F5, ['activity'], ['university', 'city'], label='-ity', pos='n'),
  m('ance', 'suf', ['ance', 'ence', 'ancy', 'ency'], '名詞：狀態、性質', 5, F5, ['difference', 'importance', 'distance', 'silence'], ['finance'], label='-ance / -ence', pos='n'),
  m('er', 'suf', ['er', 'or', 'ist'], '名詞：做這件事的人或工具', 5, F5, ['teacher', 'writer', 'singer', 'visitor', 'actor', 'artist', 'engineer'], ['corner', 'butter', 'mother', 'summer', 'letter', 'flower', 'center'], label='-er / -or / -ist', pos='n'),
  m('al', 'suf', ['ical', 'ial', 'al'], '形容詞：與…有關', 6, F6, ['natural', 'national', 'personal', 'traditional'], ['several', 'final'], label='-al', pos='adj'),
  m('ive', 'suf', ['ative', 'itive', 'ive'], '形容詞：有…傾向', 6, F6, ['active', 'talkative', 'expensive'], ['forgive'], label='-ive', pos='adj'),
  m('ous', 'suf', ['ious', 'ous'], '形容詞：充滿…的', 6, F6, ['dangerous', 'humorous', 'famous', 'nervous'], ['curious'], label='-ous', pos='adj'),
  m('ful', 'suf', ['ful'], '形容詞：充滿', 6, F6, ['careful', 'helpful', 'useful', 'colorful', 'peaceful'], [], pos='adj'),
  m('less', 'suf', ['less'], '形容詞：沒有', 6, F6, ['careless'], ['priceless'], pos='adj'),
  m('able', 'suf', ['able', 'ible'], '形容詞：能被…的', 6, F6, ['comfortable', 'valuable'], [], label='-able / -ible', pos='adj'),
  m('ize', 'suf', ['ize', 'ise'], '動詞：使成為', 7, F7, ['realize'], ['size', 'prize'], label='-ize', pos='v'),
  m('ify', 'suf', ['ify'], '動詞：使…化', 7, F7, [], [], pos='v'),
  m('en', 'suf', ['en'], '動詞：使變得', 7, F7, ['widen', 'shorten', 'deepen', 'frighten'], ['listen', 'kitten', 'dozen'], label='-en', pos='v'),
  m('enp', 'pre', ['en', 'em'], '使…', 7, F7, [], [], label='en- / em-'),
  m('ate', 'suf', ['ate'], '動詞：使、做', 7, F7, ['celebrate', 'create', 'decorate', 'appreciate'], ['considerate'], pos='v'),
  m('ly', 'suf', ['ly'], '副詞：…地', 7, F7, ['usually', 'really', 'finally', 'actually', 'especially'], ['friendly', 'lovely', 'likely'], pos='adv'),
  # 第三階段　根
  m('port', 'root', ['port'], '帶著東西移動', 9, F9, ['report', 'support', 'airport'], ['portion', 'portrait', 'important']),
  m('mit', 'root', ['miss', 'mise', 'mit', 'mis'], '送出', 9, F9, ['promise'], ['miss', 'limit', 'summit', 'vomit', 'imitate'], label='mit / mis'),
  m('duc', 'root', ['duct', 'duce', 'duc'], '引導、帶領', 9, F9, ['introduce', 'produce', 'production', 'education'], ['duck'], label='duc / duct'),
  m('ject', 'root', ['ject'], '丟、拋', 9, F9, ['subject', 'object', 'project', 'reject']),
  m('spec', 'root', ['spect', 'spec', 'spic'], '看', 10, F10, ['special', 'especially', 'respect'], ['spice', 'spicy'], label='spec / spect'),
  m('vis', 'root', ['vis', 'vid'], '看', 10, F10, ['television', 'video', 'visit', 'visitor', 'revise'], ['divide', 'individual', 'vivid'], label='vis / vid'),
  m('dict', 'root', ['dict'], '說', 10, F10, ['dictionary']),
  m('scrib', 'root', ['script', 'scribe', 'scrib'], '寫', 10, F10, ['describe'], [], label='scrib / script'),
  m('aud', 'root', ['aud'], '聽', 10, F10, [], ['fraud', 'applaud']),
  m('struct', 'root', ['struct'], '建造', 11, F11),
  m('fac', 'root', ['fact', 'fect', 'fac', 'fic'], '做', 11, F11, ['fact', 'factory', 'perfect', 'affect', 'difficult'], ['face', 'facial', 'surface', 'fiction'], label='fac / fect / fic'),
  m('form', 'root', ['form'], '形狀', 11, F11, ['form', 'uniform', 'information', 'platform'], ['former']),
  m('tract', 'root', ['tract'], '拉', 11, F11, ['contract']),
  m('bio', 'root', ['bio'], '生命', 12, F12, ['biology']),
  m('geo', 'root', ['geo'], '土地、地球', 12, F12, ['geography'], ['pigeon', 'gorgeous', 'surgeon']),
  m('graph', 'root', ['graph', 'gram'], '寫、畫', 12, F12, ['program', 'kilogram', 'geography'], [], label='graph / gram'),
  m('log', 'root', ['logy', 'log'], '學問、話語', 12, F12, ['biology', 'apologize'], ['slogan'], label='logy / log'),
  m('micro', 'root', ['micro'], '小', 12, F12, ['microwave']),
  m('tele', 'root', ['tele'], '遠', 12, F12, ['telephone', 'television']),
  m('phon', 'root', ['phone', 'phon'], '聲音', 12, F12, ['telephone', 'cellphone'], [], label='phon'),
]

# 只顯示意思、不另成家族的零件（講解裡提到、課程沒有單獨教的）
def d(id, t, forms, mean, label=None, pos=None):
    x = {'id': id, 't': t, 'forms': forms, 'mean': mean, 'display': True}
    if label: x['label'] = label
    if pos: x['pos'] = pos
    return x

EXTRA_DISPLAY = [
  d('pro', 'pre', ['pro'], '向前'), d('con', 'pre', ['con', 'com', 'col', 'cor', 'co'], '一起、完全', 'con / com'),
  d('ad', 'pre', ['ad', 'ac', 'af', 'ap', 'as', 'at'], '往、到', 'ad'), d('per', 'pre', ['per'], '通過、完全'),
  d('ob', 'pre', ['ob', 'op'], '對著、在面前', 'ob'), d('de', 'pre', ['de'], '向下、離開'),
  d('ed', 'suf', ['ed'], '過去式／形容詞'), d('ing', 'suf', ['ing'], '動作進行／名詞化'),
  d('ure', 'suf', ['ure'], '名詞：結果、狀態'), d('scope', 'root', ['scope'], '看、觀察'),
  d('pect', 'root', ['pect'], '看（spect 的變形）'), d('auto', 'pre', ['auto'], '自己'),
  d('intro', 'pre', ['intro'], '向內'), d('contra', 'pre', ['contra'], '相反'), d('manu', 'root', ['manu'], '手'),
  d('infra', 'pre', ['infra'], '在下'), d('anti', 'pre', ['anti'], '對抗'), d('dia', 'pre', ['dia'], '穿過'),
  d('sym', 'pre', ['sym'], '一起'), d('metry', 'root', ['metry'], '測量'), d('abs', 'pre', ['abs'], '離開'),
]

COMPOUNDS = {w.replace('+', ''): w for w in [
  'class+room', 'home+work', 'birth+day', 'bed+room', 'air+port', 'super+market', 'post+card', 'break+through', 'out+come', 'in+put', 'over+all',
  'play+ground', 'basket+ball', 'foot+ball', 'week+end', 'sun+flower', 'rain+coat', 'book+store', 'tooth+brush', 'note+book', 'grand+mother', 'grand+father',
  'some+one', 'every+one', 'some+thing', 'every+thing', 'some+times', 'after+noon', 'down+town', 'up+stairs', 'sun+light', 'moon+light', 'water+fall', 'rain+bow', 'snow+man',
  'news+paper', 'sea+food', 'home+town', 'hand+writing', 'over+come', 'out+door', 'under+ground', 'work+shop', 'time+line', 'frame+work', 'dead+line', 'mile+stone', 'break+down']}

# 舊 17 週編號的列 → 15 週編號與候選詞素
ROWMAP = {
  1: [['cmp']], 2: [['un'], ['in'], ['dis'], ['mis', 'non']],
  3: [['re'], ['pre'], ['post', 'fore'], ['ex']],
  4: [['inter'], ['sub', 'super'], ['trans'], ['over', 'under']],
  5: [['tion'], ['ment'], ['ness']], 6: [['ity'], ['ance'], ['er']],
  7: [['al'], ['ive'], ['ous'], ['ful', 'less'], ['able']],
  8: [['ize'], ['ify'], ['en', 'enp'], ['ate'], ['ly']],
  11: [['port'], ['mit'], ['duc'], ['ject']],
  12: [['spec'], ['vis'], ['dict'], ['scrib'], ['aud']],
  13: [['struct'], ['fac'], ['form'], ['tract']],
  14: [['bio', 'geo'], ['graph'], ['log'], ['micro', 'tele', 'phon']],
}
DETECT_WEEKS = (9, 16, 17)       # 拼字變化、學科整合字：依拼法自動判斷詞素

MBY = {x['id']: x for x in MORPHEMES}

def matches(word, mid):
    x = MBY[mid]
    if x['t'] == 'cmp':
        return word in COMPOUNDS
    for f in x['forms']:
        if x['t'] == 'pre' and word.startswith(f) and len(word) - len(f) >= 3: return True
        if x['t'] == 'suf' and word.endswith(f) and len(word) - len(f) >= 2: return True
        if x['t'] == 'root' and f in word and len(word) > len(f): return True
    return False

def words_of(cell, derived_only):
    out = []
    cell = re.sub(r'（[^）]*）', ' ', cell)
    for tok in cell.replace('；', ' ').split():
        if '→' in tok: continue
        parts = [p for p in tok.split('>') if re.fullmatch(r'[a-z]+', p)]
        if not parts: continue
        out += parts[1:] if (derived_only and len(parts) > 1) else parts
    return out

def build_key():
    spec = importlib.util.spec_from_file_location('curated', HERE / 'curated.py')
    c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
    key = {}
    def add(w, ids):
        if ids: key[w] = sorted(set(key.get(w, [])) | set(ids))
    for old, (title, rows) in c.W.items():
        if old in ROWMAP:
            for (label, anchors, targets, _), cands in zip(rows, ROWMAP[old]):
                for w in words_of(anchors, True) + words_of(targets, True):
                    hit = [i for i in cands if matches(w, i)] or cands
                    add(w, hit)
        elif old in DETECT_WEEKS:
            for (label, anchors, targets, _) in rows:
                for w in words_of(anchors, True) + words_of(targets, True):
                    add(w, [i for i in MBY if MBY[i]['t'] != 'cmp' and matches(w, i)])
    for x in MORPHEMES:                                   # 錨點詞一定在答案表裡
        for w in x['anchors']:
            if x['t'] != 'cmp': add(w, [x['id']])
    traps = {}
    for x in MORPHEMES:
        for w in x['traps']:
            traps.setdefault(w, []).append(x['id'])
    for w in list(traps):                                 # 陷阱字不放進答案表
        key.pop(w, None)
    return key, traps

if __name__ == '__main__':
    k, t = build_key()
    print(len(k), 'keyed words;', len(t), 'traps')
    for w in ['unhappy', 'enlarge', 'widen', 'transportation', 'misunderstand', 'nonsense', 'postpone', 'forecast', 'biological', 'reproduction', 'decision', 'photography', 'microscope']:
        print(w, k.get(w))
