# -*- coding: utf-8 -*-
"""內容包共用的寫法。

講解稿慣例：
  *English sentence*   英文例句（畫面斜體，語音用英文唸）
  〔停頓 N 秒〕          語音停頓
  {{surface|lemma}}    短文裡可以點的字（只用在 passage）
"""

def mcq(q, options, answer, explain=''):
    return {'type': 'mcq', 'q': q, 'options': options, 'answer': answer, 'explain': explain}

def tf(q, answer, explain=''):
    return {'type': 'mcq', 'q': q, 'options': ['對', '錯'], 'answer': 0 if answer else 1, 'explain': explain}

def open_q(q, ref):
    return {'type': 'open', 'q': q, 'ref': ref}

def seg(sid, title, minutes, slides, script, checks=(), passage=None, free=None):
    """free：免費版要換掉的欄位，例如 {'script': [...]}。"""
    d = {'id': sid, 'title': title, 'minutes': minutes, 'audio': f'audio/{sid}.mp3',
         'slides': slides, 'script': script, 'checks': list(checks)}
    if passage: d['passage'] = passage
    if free: d['free'] = free
    return d

def unit(n, stage, title, morphemes, task, segments, test=None, free_task=None):
    u = {'unit': n, 'stage': stage, 'title': title, 'morphemes': morphemes, 'task': task, 'segments': segments}
    if test: u['test'] = test
    if free_task: u['free_task'] = free_task
    return u

COURSE_TASK_TAIL = '第三，挑一個你最拿不準的字，按「提問」，寫下你不確定的地方；也到班級牆看看同學問了什麼。下週的直播，老師會一題一題回答大家的提問。'
FREE_TASK_TAIL = '拿不準的字，先標成「待確認」，拆法會保留在地圖上。'
