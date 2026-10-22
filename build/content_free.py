# -*- coding: utf-8 -*-
"""Build site/content/free.json — the free-tier content pack (W1, W4, W9).

Script conventions (also used by the TTS export):
  *English sentence*   → read in an English voice, shown in italics
  〔停頓 N 秒〕          → a pause of N seconds
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
key = json.loads((ROOT / 'build' / 'key.json').read_text(encoding='utf-8'))

MORPHEMES = [
  # W1
  {'id':'cmp','t':'cmp','forms':[],'label':'複合字','mean':'兩個字拼成一個字','unit':1,'field':'W1 字首與複合字',
   'anchors':['classroom','homework','birthday','bedroom','supermarket'],'traps':['butterfly']},
  {'id':'un','t':'pre','forms':['un'],'mean':'不、反轉','unit':1,'field':'W1 字首與複合字','anchors':['unhappy','unable','unkind','unfair','unusual'],'traps':['uncle','uniform','until','understand']},
  {'id':'in','t':'pre','forms':['in','im','il','ir'],'label':'in / im / il / ir','mean':'不','unit':1,'field':'W1 字首與複合字','anchors':['impolite','impossible','independent','incorrect'],'traps':['important','insect','interest']},
  {'id':'dis','t':'pre','forms':['dis'],'mean':'不、相反、分開','unit':1,'field':'W1 字首與複合字','anchors':['disappear','dishonest','discover'],'traps':['discuss','distance']},
  {'id':'mis','t':'pre','forms':['mis'],'mean':'錯誤','unit':1,'field':'W1 字首與複合字','anchors':['mistake'],'traps':['miss','missile']},
  {'id':'non','t':'pre','forms':['non'],'mean':'非、不是','unit':1,'field':'W1 字首與複合字','anchors':[],'traps':[]},
  # W4
  {'id':'tion','t':'suf','forms':['ation','ition','tion','sion','ion'],'label':'-tion / -sion','mean':'名詞：動作、結果','pos':'n','unit':4,'field':'W4 名詞字尾',
   'anchors':['action','decision','invitation','direction','discussion','pollution'],'traps':['station','question','mansion']},
  {'id':'ment','t':'suf','forms':['ment'],'mean':'名詞：動作、結果','pos':'n','unit':4,'field':'W4 名詞字尾','anchors':['movement'],'traps':['comment','apartment','department']},
  {'id':'ness','t':'suf','forms':['ness'],'mean':'名詞：狀態','pos':'n','unit':4,'field':'W4 名詞字尾','anchors':['happiness','kindness','darkness','weakness'],'traps':['business']},
  # W9
  {'id':'port','t':'root','forms':['port'],'mean':'帶著東西移動','unit':9,'field':'W9 移動家族','anchors':['report','support','airport'],'traps':['portion','portrait','important']},
  {'id':'mit','t':'root','forms':['miss','mise','mit','mis'],'label':'mit / mis','mean':'送出','unit':9,'field':'W9 移動家族','anchors':['promise'],'traps':['miss','limit','summit']},
  {'id':'duc','t':'root','forms':['duct','duce','duc'],'label':'duc / duct','mean':'引導、帶領','unit':9,'field':'W9 移動家族','anchors':['introduce','produce','production','education'],'traps':['duck']},
  {'id':'ject','t':'root','forms':['ject'],'mean':'丟、拋','unit':9,'field':'W9 移動家族','anchors':['subject','object','project','reject'],'traps':[]},
]

COMPOUNDS = {w.replace('+',''): w for w in [
  'class+room','home+work','birth+day','bed+room','air+port','super+market','post+card','break+through','out+come','in+put','over+all',
  'play+ground','basket+ball','foot+ball','week+end','sun+flower','rain+coat','book+store','tooth+brush','note+book','grand+mother','grand+father',
  'some+one','every+one','some+thing','every+thing','some+times','after+noon','down+town','up+stairs','sun+light','moon+light','water+fall','rain+bow','snow+man',
  'news+paper','sea+food','home+town','hand+writing','over+come','out+door','under+ground','work+shop','time+line','frame+work']}
key['traps']['butterfly'] = ['cmp']

def mcq(q, options, answer, explain=''):
    return {'type':'mcq','q':q,'options':options,'answer':answer,'explain':explain}
def tf(q, answer, explain=''):
    return {'type':'mcq','q':q,'options':['對','錯'],'answer':0 if answer else 1,'explain':explain}
def open_q(q, ref):
    return {'type':'open','q':q,'ref':ref}

def seg(sid, title, minutes, slides, script, checks=(), passage=None):
    d = {'id':sid,'title':title,'minutes':minutes,'audio':f'audio/{sid}.mp3','slides':slides,'script':script,'checks':list(checks)}
    if passage: d['passage'] = passage
    return d

W1 = {'unit':1,'stage':'拆','title':'字是拼起來的：複合字與否定字首','morphemes':['cmp','un','in','dis','mis','non'],
 'task':'在書裡找出至少 6 個帶 un、in（im、il、ir）、dis、mis 或 non 的字，再加上 2 個複合字。陷阱字也算數。',
 'segments':[
  seg('w1-s0','開場',3,
   ['W1 字是拼起來的','三件事：認出零件、推出意思、想起家族','四個單元：W1 字首、W4 字尾、W9 字根、W13 用出來'],
   ['歡迎來到「我的詞族地圖」。你已經讀了很多英文書，很多字不用翻譯就懂。這個單元要帶你換一個角度看字：很多英文字，是用零件拼起來的。',
    '學會看零件，你可以做三件事。第一，認出一個長字裡有哪些零件。第二，用零件加上句子，推出它的意思。第三，看到同一個零件，就想起它的一整個家族。',
    '免費版有四個單元：W1 看字首，W4 看字尾，W9 看字根，剛好是一個字的頭、尾和中間；最後的 W13，把三種零件用在學科文章裡。每個單元都一樣：先聽講解，再到你正在讀的書裡找字，把它記到地圖上。〔停頓 1 秒〕我不會給你一張單字表。你找到、你拆開、你確認過的字，才會真的變成你的字。']),
  seg('w1-s1','詞素：字的最小零件',5,
   ['class + room、home + work、birth + day','詞素：一個字裡帶有意思的最小零件','延伸：outcome、input','陷阱字：butterfly'],
   ['先看幾個你早就會的字：classroom、homework、birthday。〔停頓 2 秒〕每一個都是兩個字黏在一起。class 加 room，就是上課的房間：*Our classroom is on the second floor.*',
    '像 class、room 這樣帶著意思、可以和別的零件拼在一起的單位，叫做詞素：一個字裡面，帶有意思的最小零件。兩個完整的字拼成一個字，叫複合字。',
    '複合字在學術文章裡也很常見。換你猜：out 加 come，outcome 是什麼？〔停頓 3 秒〕事情最後「出來」的樣子：*Nobody could predict the outcome of the game.* 那 input 呢？〔停頓 3 秒〕放進來的想法或東西：*The teacher asked for our input on the class trip.*',
    '但不是每個看起來拼得起來的字都能這樣拆。butterfly 裡有 butter，也有 fly，可是牠跟奶油沒有關係：*A butterfly landed on my hand.* 這種字叫陷阱字：長得像，意思卻接不起來。'],
   [mcq('Nobody could predict the outcome of the game. 這裡的 outcome 指的是什麼？',['比賽最後的結果','走出球場','比賽的規則'],0,'out＋come：最後「出來」的樣子。'),
    mcq('下面哪一個是陷阱字，不能照字面拆？',['homework','butterfly','bedroom'],1,'butterfly 和 butter、fly 的意思接不起來。')]),
  seg('w1-s2','un-：不、反過來',5,
   ['unhappy、unkind、unfair','un + 形容詞＝不…','un + 動詞＝把動作反過來：unlock、uncover','陷阱字：uncle、uniform、until、understand'],
   ['字首放在字的前面，像一個開關，會改變後面那個字的方向。第一個字首是 un。',
    '你一定認得 unhappy、unkind、unfair。un 放在形容詞前面，意思是「不」：*It\'s unfair that he got two turns.* 換你猜 unfamiliar。familiar 是熟悉的，那 unfamiliar 呢？〔停頓 3 秒〕還不熟、沒見過的：*The new school felt unfamiliar at first.*',
    'un 還有第二個意思。放在動詞前面，它表示「把動作反過來」。lock 是鎖上，unlock 是把鎖打開：*She unlocked the door with a small key.* cover 是蓋住，uncover 是把蓋子拿掉，讓藏起來的東西露出來：*The reporter uncovered the truth.*',
    'un 的陷阱字特別多：uncle、uniform、until、understand。它們的開頭剛好是 u、n，但都不是「不」。uniform 的 uni 是「一個」，大家穿成一個樣子；understand 也不是「不站著」。'],
   [mcq('She unlocked the door with a small key. 她對門做了什麼？',['把鎖打開','沒有鎖門','鎖了兩次'],0,'un＋動詞：把 lock 這個動作反過來。'),
    mcq('哪一個字的 un「不是」字首？',['unfair','uniform','unkind'],1,'uniform 的 uni 是「一個」。')]),
  seg('w1-s3','in- / im- / il- / ir-：不',6,
   ['incorrect、impossible、impolite、independent','拼法跟著後面的字母變：im + p／b／m，il + l，ir + r','延伸：illegal、irregular、irresponsible、inaccurate','另一個 in＝進入：income、indoor、import','陷阱字：important、insect、interest'],
   ['第二個否定字首是 in。它和 un 一樣是「不」，可是它會換衣服。',
    '先看 incorrect：in 加 correct，不正確。可是 possible 前面不是 in，而是 im：impossible。polite 也一樣：impolite。因為 p 要先把雙唇閉起來，m 也是，im 唸起來比較順。後面是 l 的時候，變成 il：*It is illegal to drive without a license.* 後面是 r 的時候，變成 ir：regular 變 irregular，responsible 變 irresponsible。',
    '所以看到 im、il、ir，先想一想：它是不是 in 換了衣服？',
    '要小心，in 還有另一個意思：「進入、在裡面」。income 是進來的錢，indoor 是在室內：*We played indoor games because it was raining.* 這裡的 in 不是「不」。同一個零件可能有兩種意思，要回到句子裡看。',
    '陷阱字：important、insect、interest。它們開頭有 in 或 im，可是拆不出「不」。important 不是「不重要」，剛好相反。'],
   [mcq('下面哪一個拼法是對的？',['inlegal','illegal','unlegal'],1,'後面是 l，in 換成 il。'),
    mcq('We played indoor games because it was raining. 這裡的 in 是什麼意思？',['不','在裡面','再一次'],1,'in 的第二個意思：在裡面。'),
    tf('important 可以拆成 im＋portant，意思是「不重要的」。',False,'important 是陷阱字。')]),
  seg('w1-s4','dis-、mis-、non-',5,
   ['disappear、dishonest、disagree、dislike','mistake、misunderstand、mislead','nonsense、nonprofit','陷阱字：discuss、distance、miss'],
   ['dis 也是「不」或「相反」，常常放在動詞前面。appear 是出現，disappear 是不見了：*The sun disappeared behind the clouds.* agree 是同意，disagree 呢？〔停頓 2 秒〕*I disagree with you about the movie.*',
    'mis 的意思是「錯」。mistake 是拿錯、弄錯。換你猜 misunderstand：〔停頓 3 秒〕理解錯了：*I think you misunderstood my question.*',
    'non 的意思是「非、不是」。nonsense，沒有道理的話：*Stop talking nonsense.* nonprofit，不是為了賺錢的組織。',
    '陷阱字：discuss、distance 的 dis 不是「不」；miss 的 mis 也不是「錯」，miss 本身就是一個完整的字。'],
   [mcq('I think you misunderstood my question. 發生了什麼事？',['你理解錯了','你沒聽到','你同意了'],0,'mis＋understand：理解錯了。'),
    mcq('哪一個字的 dis「不是」否定的意思？',['disappear','dishonest','discuss'],2,'discuss 是陷阱字。')]),
  seg('w1-s5','單元任務',3,
   ['書 → App 採集 → 地圖','目標：至少 6 個字首字，加上 2 個複合字'],
   ['這個單元的任務：打開你正在讀的書，找出至少 6 個帶 un、in、im、il、ir、dis、mis 或 non 的字，再加上 2 個複合字。找到後，先別急著查字典。',
    '在 App 裡把字拆開。先寫零件的意思，再用你自己的話說它在書裡那一句的意思。可以用英文換句話說，也可以描述句子裡發生了什麼事，不需要找一個中文詞來對譯。',
    '找到陷阱字也算數。把它標成「不能拆」，它會出現在地圖的陷阱區。拆好之後，App 會告訴你這個拆法有沒有在課程詞表裡。'])
 ]}

W4 = {'unit':4,'stage':'轉','title':'名詞字尾：把動作打包成東西','morphemes':['tion','ment','ness'],
 'task':'在書裡找出至少 6 個帶 -tion／-sion、-ment 或 -ness 的名詞，三個字尾都要有；每個字都填上原本的動詞或形容詞當作詞族。',
 'segments':[
  seg('w4-s0','開場',2,
   ['W1：字首改變方向','W4：字尾改變詞性','decide → decision'],
   ['W1 的字首，會改變一個字的方向。這個單元要看字尾。字尾通常不改變意思的核心，卻會改變一個字在句子裡的「工作」，也就是詞性。',
    'decide 是動詞，decision 是名詞。同一個意思，換一個字尾，就能放到句子裡不同的位置：*We decided to stay.* *Staying was a hard decision.*',
    '這個單元看三個名詞字尾：tion、ment、ness。它們把一個動作或一種狀態，打包成一個「東西」。']),
  seg('w4-s1','-tion / -sion',7,
   ['act → action、invite → invitation、decide → decision','拼法：invite 去掉 e；decide 的 d 變 s','延伸：collection、protection、communication、investigation','陷阱字：station、question'],
   ['先看你熟悉的字：act 和 action，invite 和 invitation，decide 和 decision。〔停頓 2 秒〕動詞後面加上 tion 或 sion，就變成名詞。',
    '注意拼法：invite 去掉 e，再加 ation；decide 的 d 變成 s，再加 ion。字尾常讓前面的字小小地變形，但只要認得前面的字，就認得出它。',
    '換你猜。collect 是收集，collection 呢？〔停頓 3 秒〕收集起來的一整批東西：*He has a huge collection of comic books.* protect 是保護，protection 呢？〔停頓 3 秒〕*Sunscreen gives your skin protection from the sun.*',
    '學術文章特別愛這種字：communication、investigation、evaluation。它們看起來很長，拆開以後，前面都是一個動詞：communicate、investigate、evaluate。',
    '陷阱字：station 和 question。它們有 tion，但前面沒有一個動詞。不是每個 tion 都是從動詞變來的。'],
   [mcq('decide 的名詞是哪一個？',['decidetion','decision','decidement'],1,'d 變成 s，再加 ion。'),
    mcq('He has a huge collection of comic books. collection 指的是什麼？',['他收集的一大批漫畫','他正在看漫畫','漫畫的價錢'],0,'collect＋ion：收集起來的東西。'),
    mcq('哪一個字的 tion「不是」從動詞變來的？',['invitation','station','protection'],1,'station 是陷阱字。')]),
  seg('w4-s2','-ment',6,
   ['move → movement','agree → agreement、pay → payment、improve → improvement','develop → development','陷阱字：comment、apartment、department'],
   ['第二個名詞字尾是 ment。move 是動，movement 是動的這件事：*Every movement of the dancer was careful.*',
    'ment 比 tion 好認，因為前面的動詞幾乎不變形。agree，agreement：*The two countries signed an agreement.* pay，payment。換你猜 improve：〔停頓 3 秒〕improvement，變好的那一部分：*Your writing shows a lot of improvement.*',
    'develop 加 ment，是 development：*The development of the town changed the river.* 這種字在自然和社會課本裡到處都是。',
    '陷阱字：comment、apartment、department。拆掉 ment，剩下的部分和整個字的意思接不起來。看到 ment，先檢查前面是不是一個你認得的動詞。'],
   [mcq('Your writing shows a lot of improvement. 這句話在說什麼？',['你的寫作變好了','你寫了很多字','你需要重寫'],0,'improve＋ment：變好的那一部分。'),
    mcq('哪一個不能拆成「動詞＋ment」？',['payment','agreement','apartment'],2,'apartment 是陷阱字。')]),
  seg('w4-s3','-ness',5,
   ['kind → kindness、dark → darkness、weak → weakness','happy → happiness：y 變 i','延伸：illness、awareness','陷阱字：business（語意已漂移）'],
   ['ness 加在形容詞後面，把一種狀態變成名詞。kind 是好心的，kindness 是好心這件事：*Thank you for your kindness.* dark 是暗的，darkness 是一片黑暗：*The room was filled with darkness.*',
    'happy 加 ness 的時候，y 會變成 i：happiness。看到 iness，就想想原本的字是不是 y 結尾。',
    '換你猜：aware 是知道、注意到，awareness 呢？〔停頓 3 秒〕對一件事的注意和了解：*The project raised awareness about plastic waste.*',
    '最有名的陷阱字是 business。它原本真的是 busy 加 ness，忙碌的狀態，可是現在指的是生意和公司：*Her family runs a small business.* 意思已經漂走了，要整個字一起記。'],
   [mcq('happy 加 ness 要怎麼拼？',['happyness','happiness','happness'],1,'y 變成 i。'),
    tf('business 現在的意思就是「很忙的狀態」。',False,'business 拆得開，但語意已經漂移。')]),
  seg('w4-s4','為什麼要把動作打包成名詞',4,
   ['The town developed quickly.','The quick development of the town surprised everyone.','名詞可以被形容，也可以當主詞'],
   ['最後想一個問題：既然有 develop，為什麼還需要 development？',
    '比比看這兩句。*The town developed quickly.* 這是在說一件事。*The quick development of the town surprised everyone.* 這裡，development 變成一個東西，可以被形容，也可以當主詞，後面再接新的訊息。',
    '把動作打包成名詞，一個句子就能裝進更多訊息。這是學術文章最常用的技巧之一。現在你只要先開始注意：書裡的 tion、ment、ness，常常就是一個被打包起來的動作或狀態。'],
   [mcq('The quick development of the town surprised everyone. 是什麼讓大家驚訝？',['the town','the quick development of the town','everyone'],1,'整個名詞片語是主詞。')]),
  seg('w4-s5','單元任務',3,
   ['目標：至少 6 個名詞，三個字尾都要有','每個字填上原本的動詞或形容詞 → 詞性表'],
   ['這個單元的任務：在書裡找出至少 6 個帶 tion、sion、ment 或 ness 的名詞，三個字尾都要有。',
    '每找到一個字，試著找出它原本的動詞或形容詞，填在「歸入詞族」，例如 develop。這樣「詞性表」就會把 develop 和 development 排在一起。',
    '如果拆掉字尾以後，剩下的部分接不起來，像 station，就把它標成「不能拆」。'])
 ]}

W9 = {'unit':9,'stage':'根','title':'字根：移動家族','morphemes':['port','mit','duc','ject'],
 'task':'在書裡找出含有 port、mit／mis、duc、ject 的字，四個家族都要有，至少 6 個字。',
 'segments':[
  seg('w9-s0','開場',2,
   ['W9 移動家族','port、mit、duc、ject','這週的字，不在這張投影片上，在你的書裡'],
   ['前面兩個單元，我們看了字的頭和尾：字首告訴你方向，字尾告訴你詞性。這個單元，我們要打開字的中間，也就是字根。',
    '這個單元的四個字根，都跟「移動」有關：搬東西、送東西、帶路、丟東西。',
    '我只會示範幾個字，剩下的字，要你自己到正在讀的書裡找。']),
  seg('w9-s1','port：帶著東西移動',7,
   ['re port、sup port、air port','port＝帶著東西移動（中文標籤：搬運）','延伸：export、import','半透明：airport','陷阱字：portion、portrait'],
   ['先看三個你一定認得的字：report、support、airport。它們都藏著同一個零件：port。〔停頓 2 秒〕',
    'port 的核心畫面是「帶著東西移動」。我們拆拆看。re 是「回」，report 就是把消息帶回來：*The reporter reported the news.* support 的 sup 是 sub 的變形，「在下面」；從下面撐著、扛著：*Strong legs support your body.*',
    '現在換你猜。ex 是「向外」，那 export 呢？〔停頓 3 秒〕往外搬運，把東西搬出這個國家：*The island exports bananas.* 那 import 呢？〔停頓 3 秒〕往內搬，把東西搬進來：*We import oil from other countries.*',
    'airport 比較特別。這裡的 port 比較接近「港口」，也就是貨物和人進出的地方。它和「搬運」是親戚，但不完全一樣，所以 airport 是半透明的字：拆得開，但要多想一步。',
    '最後兩個陷阱：portion 和 portrait。它們看起來有 port，卻來自別的字根，和搬運無關。聽聽它們在句子裡的樣子：*She ate a small portion of the cake.* *A portrait of the king hangs on the wall.* 遇到這種字，不要硬拆。'],
   [mcq('The island exports bananas. 這座島對香蕉做了什麼？',['把香蕉運出去賣','在港口種香蕉','報告香蕉的數量'],0,'ex＋port：往外搬運。'),
    mcq('下面哪個字的 port「不是」搬運的意思？',['transport','portion','import'],1,'portion 來自不同字根。'),
    open_q('Strong legs support your body. 這裡的 support 和 port 有什麼關係？用一句話說說看。','從下面撐著、扛著。')]),
  seg('w9-s2','mit / mis：送出',7,
   ['pro mise','mit／miss／mis＝送出，一個字根有好幾種拼法','延伸：admit、permit、submit','字尾連動：permit → permission、admit → admission','陷阱字：miss、limit'],
   ['這個字根你其實早就見過，只是它換了衣服：promise。pro 是「向前」，mise 是「送出」：把一句話往前送出去，讓對方收著。*I promise I\'ll call you tonight.*',
    '這個字根有好幾種拼法：mit、miss、mis，都是「送」。看到其中一種，就要想到這個家族。',
    '來試試看。ad 有「往、到」的意思，admit 是把人送進來：*The school admits 200 students each year.* 也可以是把真話送出來、說出口：*He admitted that he was wrong.* per 是「通過」，permit 是讓你送過去、讓你通過：*Phones are not permitted in the exam room.* sub 是「在下面」，submit 是把東西往下交出去，交到老師或評審手上：*Please submit your essay by Friday.*',
    '還記得 W4 嗎？名詞字尾一加，拼法也跟著變。permit 變成名詞是 permission，admit 是 admission，t 變成了 ss。',
    '陷阱字：miss 和 limit。它們的字母裡有 mis 或 mit，但和「送」沒有關係。'],
   [mcq('submit 的 sub 是什麼意思？',['在下面','再一次','向外'],0),
    mcq('permit 的名詞是哪一個？',['permitment','permission','permitness'],1,'t 變成 ss，再加 ion。'),
    mcq('下面哪一個「不屬於」送出家族？',['transmit','mission','limit'],2,'limit 是陷阱字。')]),
  seg('w9-s3','duc / duct：引導',6,
   ['intro duce、pro duce、e duc ation','duc／duce／duct＝引導、帶領','延伸：reduce','陷阱字：duck'],
   ['三個熟悉的字：introduce、produce、education。它們共同的零件是 duc，意思是「引導、帶領」。',
    'introduce，把人帶進來，帶到大家面前：*Let me introduce my friend Amy.* produce，把東西往前帶出來：*This farm produces rice and tea.*',
    'education 最有意思。e 是 ex 的縮短版，「向外」。education 原本的畫面，是把一個人的能力「往外帶出來」。下次有人說 education 就是把知識塞進腦袋，你可以用這個字告訴他：字面上剛好相反。',
    '換你猜：re 是「回」，reduce 是什麼？〔停頓 3 秒〕把東西帶回去、往回縮，讓它變少：*Riding a bike can reduce air pollution.*',
    '這個家族的陷阱很好笑：duck。*The duck is swimming in the pond.* 它和引導沒有關係。'],
   [mcq('Riding a bike can reduce air pollution. 空氣污染會怎麼樣？',['變少','被帶進來','被製造出來'],0,'re＋duce：往回帶，讓它變少。'),
    mcq('education 的 e 是哪個字首的縮短版？',['re','ex','en'],1)]),
  seg('w9-s4','ject：丟',5,
   ['sub ject、ob ject、pro ject、re ject','ject＝丟、拋','延伸：inject','陷阱字總整理：portion、portrait、miss、limit、duck'],
   ['最後一個字根最短：ject，丟。你認得四個有它的字：subject、object、project、reject。',
    'reject 最好懂：丟回去，不收下：*She rejected the offer.* project 是往前丟出去：projector 把畫面丟到前面的牆上；a project 是把想法丟向未來，再一步步做出來。',
    'subject 和 object 是半透明的字。subject 字面是「丟到下面的東西」，object 是「丟在面前的東西」。但聽聽它們現在的用法：*Math is my favorite subject.* *There is a strange object in the sky.* 已經離字面有點遠了。這種字，拆開可以幫你記，但不能只靠拆來猜意思。',
    '換你猜：in 是「進入」，inject 是什麼？〔停頓 3 秒〕把東西丟進去，送進身體裡：*The nurse injected the medicine into my arm.*',
    '最後，把這個單元的陷阱字再看一次：portion、portrait、miss、limit、duck。它們都長得像，但都不是移動家族的成員。'],
   [mcq('She rejected the offer. 她對那個提議做了什麼？',['把它打進去','丟回去，不收下','把它往前投出'],1),
    tf('subject 拆成 sub＋ject 之後，就能直接猜出「科目」的意思。',False,'subject 是半透明的字。')]),
  seg('w9-s5','單元任務',3,
   ['書 → App 採集 → 地圖','目標：至少 6 個字，四個家族都要有'],
   ['這個單元的任務很簡單，但要你自己動手。',
    '第一，打開你正在讀的書，找出含有 port、mit、duc、ject 的字。四個家族都要找到，至少 6 個字。找到後先別急著查字典。',
    '第二，在 App 裡把字拆開，先寫下零件的意思，再用你自己的話說它在書裡那一句的意思。可以用英文換句話說，也可以描述句子裡發生了什麼事，不需要找一個中文詞來對譯。最後判斷它是透明、半透明，還是根本不能拆。',
    '完成以後，打開「地圖」和「詞性表」看看：這些字，全都是你自己從書裡找到的。下一個單元 W13，我們要把三種零件一起用在學科文章裡。'])
 ]}


PASSAGE = [
  'Fifty years ago, the air in our city was dirty. Factories {{produced|produce}} smoke all day, and the {{pollution|pollution}} made many people ill.',
  'The city government made a {{decision|decision}}: it would {{reduce|reduce}} the number of old buses and make a large {{investment|investment}} in clean {{transportation|transportation}}.',
  'At first, many people {{disagreed|disagree}}. They thought the plan was {{impossible|impossible}} and the cost was {{unreasonable|unreasonable}}.',
  'But the {{improvement|improvement}} was {{unexpected|unexpected}}. Within ten years, the smoke had almost {{disappeared|disappear}}, and the city now {{exports|export}} electric buses to other countries.',
  'Its story shows that the {{development|development}} of a city depends on the {{awareness|awareness}} of its people.'
]
plain = lambda t: __import__('re').sub(r'\{\{(.+?)\|.+?\}\}', r'\1', t)

W13 = {'unit':13,'stage':'用','title':'用：在學科文本裡拆字','morphemes':['un','in','dis','tion','ment','ness','port','duc'],
 'task':'找一本自然或社會的課本，或一本知識性的書，找出至少 4 個「零件來自兩個以上單元」的字；再把書裡的一個句子，用名詞字尾改寫成「打包」的版本。',
 'segments':[
  seg('w13-s0','開場',2,
   ['W1 字首＋W4 字尾＋W9 字根','學科文本裡的長字，常常是三種零件疊在一起','這個單元：讀一段短文，把零件用出來'],
   ['前面三個單元，你分別學了字首、字尾和字根。這個單元不學新零件，而是把它們用出來。',
    '在自然和社會的文章裡，長字特別多。它們看起來很嚇人，其實常常只是字首、字根、字尾疊在一起。你已經有足夠的零件，可以拆開它們了。']),
  seg('w13-s1','由外往內拆',6,
   ['步驟一：先找字尾 → 知道詞性','步驟二：再找字首 → 知道方向','步驟三：剩下的就是核心','步驟四：回到句子裡確認','示範：unexpected、transportation、reduction'],
   ['遇到一個很長的字，不要從第一個字母開始猜。試試看「由外往內拆」。',
    '第一步，先看字尾。字尾告訴你這個字在句子裡做什麼工作：tion、ment、ness 結尾，通常是名詞。第二步，看字首。字首告訴你方向：un、in、dis 是「不、相反」，ex 是「向外」。第三步，剩下的部分就是核心。第四步，回到句子裡確認。',
    '來試一個：unexpected。〔停頓 2 秒〕最外面是 un，「不」。裡面是 expected，「預期的」。所以 unexpected 是沒有預期到的：*The improvement was unexpected.* 大家都沒想到會變好這麼快。',
    '再試一個長的：transportation。〔停頓 3 秒〕字尾是 ation，所以它是名詞。中間是 port，帶著東西移動。最前面的 trans 這三個單元沒教過，它的意思是「跨越」；就算不知道，你也能從 port 和句子猜到它和運送有關：*The city made a large investment in clean transportation.*',
    '最後一個：reduction。字尾 tion，是名詞；核心是 duc，帶領；前面的 re 是「回」。往回帶，讓它變少，再打包成名詞，就是「變少這件事」：*The reduction of smoke made the air clean again.*'],
   [mcq('拆一個很長的字時，這個單元建議先看哪裡？',['第一個字母','字尾','字典'],1,'先看字尾，知道它的詞性。'),
    mcq('The improvement was unexpected. 這句話在說什麼？',['大家沒想到會變好','大家早就知道會變好','事情沒有變好'],0,'un＋expected：沒有預期到的。')]),
  seg('w13-s2','讀一段短文',7,
   ['短文：A City Without Smoke','先聽一次，再看畫底線的字','點一下畫底線的字，把它帶到「採集」'],
   ['現在我們來讀一段社會科的短文。先聽一次，不用停下來查字。',
    *['*' + plain(x) + '*' for x in PASSAGE],
    '〔停頓 2 秒〕這段短文裡，畫底線的字都可以用你學過的零件拆開。我們一起看三個。',
    'disagreed：dis 是「相反」，agree 是同意，所以是不同意。*At first, many people disagreed.* 一開始，很多人反對這個計畫。',
    'unreasonable：最外面是 un，裡面是 reasonable，「合理的」。*They thought the cost was unreasonable.* 他們覺得花這麼多錢不合理。',
    'awareness：aware 加 ness，把「注意到、知道」這種狀態打包成名詞。*The development of a city depends on the awareness of its people.* 城市能不能進步，要看大家有沒有意識到問題。',
    '剩下的字，換你自己拆。點一下畫底線的字，它會被帶到「採集」，原句也會一起帶過去。'],
   [mcq('At first, many people disagreed. 一開始大家對這個計畫的態度是？',['反對','支持','不知道'],0,'dis＋agree：不同意。'),
    mcq('短文裡哪一個字「沒有」名詞字尾？',['pollution','investment','unexpected'],2,'unexpected 是形容詞：un＋expected。'),
    open_q('Within ten years, the smoke had almost disappeared. 十年後，城市的天空發生了什麼事？用自己的話說說看。','The smoke was almost gone; the sky became clear.')],
   passage=PASSAGE),
  seg('w13-s3','打包：從句子到名詞',6,
   ['The government decided. → the government\'s decision','Smoke was reduced. → the reduction of smoke','People became aware. → people\'s awareness','打包以後，名詞可以當主詞，句子能裝更多訊息'],
   ['W4 說過，名詞字尾可以把一個動作打包成一個東西。這是學術文章最常見的寫法。現在，我們用短文裡的字練習。',
    '先看一句：*The government decided to buy clean buses.* 把 decided 打包成名詞，就變成 *The government\'s decision to buy clean buses changed the city.* decision 變成了主詞，後面還可以再說它帶來什麼結果。',
    '再一句：*The smoke was reduced.* 打包以後：*The reduction of smoke surprised everyone.*',
    '換你試試：*People became aware of the problem.* 〔停頓 5 秒〕你可以寫成：*People\'s awareness of the problem grew.* 或是 *Awareness of the problem helped the city change.*',
    '打包以後的句子不一定比較好讀，但它比較「學術」，因為它把事情變成可以討論、可以比較的東西。之後在學術讀寫課，你會一直用到這個技巧。'],
   [mcq('The smoke was reduced. 打包成名詞以後是哪一個？',['the reduce of smoke','the reduction of smoke','the reducement of smoke'],1,'reduce 的名詞是 reduction。'),
    open_q('把這一句打包成名詞：The city improved quickly.','The quick improvement of the city … （例如：The quick improvement of the city surprised everyone.）')]),
  seg('w13-s4','單元任務',3,
   ['課本或知識書 → 找 4 個「多零件」的字','改寫一個句子：動詞 → 名詞'],
   ['這個單元的任務有兩部分。',
    '第一，拿出一本自然或社會的課本，或一本知識性的英文書，找出至少 4 個字，它們的零件來自兩個以上的單元，像 unexpected、transportation、disappointment。在 App 裡由外往內拆開，記下原句。',
    '第二，從書裡挑一個句子，用 tion、ment 或 ness 把其中的動作打包成名詞，寫在那個字的「在這句話裡的意思」欄位。',
    '做完以後，打開「地圖」看看：同一個字，可能同時出現在好幾個家族裡。這就是零件的力量。'])
 ]}
key['key']['unreasonable'] = ['un']
key['key']['disappointment'] = ['dis', 'ment']

pack = {'pack':'free','version':'2026.10.2','title':'我的詞族地圖・免費版',
        'units':[W1, W4, W9, W13], 'morphemes':MORPHEMES, 'compounds':COMPOUNDS,
        'key':key['key'], 'traps':key['traps']}
out = ROOT / 'site' / 'content' / 'free.json'
out.write_text(json.dumps(pack, ensure_ascii=False, indent=1), encoding='utf-8')

# ---- TTS export: one plain-text and one SSML file per segment ----
import re
tts = ROOT / 'tts'; tts.mkdir(exist_ok=True)
for f in tts.glob('*'): f.unlink()
lines = ['檔名\t單元\t段落\t約略長度（分）']
for u in pack['units']:
    for s in u['segments']:
        txt = '\n\n'.join(s['script'])
        plain = re.sub(r'\*(.+?)\*', r'\1', txt)
        (tts / f"{s['id']}.txt").write_text(plain + '\n', encoding='utf-8')
        def ssml_para(p):
            p = p.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
            p = re.sub(r'〔停頓 (\d+) 秒〕', r'<break time="\1s"/>', p)
            p = re.sub(r'\*(.+?)\*', r'<lang xml:lang="en-US">\1</lang>', p)
            return f'  <p>{p}</p>'
        ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW">\n' + \
               '\n'.join(ssml_para(p) for p in s['script']) + '\n</speak>\n'
        (tts / f"{s['id']}.ssml").write_text(ssml, encoding='utf-8')
        lines.append(f"{s['id']}.mp3\tW{u['unit']}\t{s['title']}\t{s['minutes']}")
(tts / '00-檔名清單.tsv').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('segments:', sum(len(u['segments']) for u in pack['units']), 'bytes:', out.stat().st_size)
