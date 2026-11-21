# -*- coding: utf-8 -*-
"""第四階段　用（W13–W15）"""
from cbase import seg, unit, mcq, tf, open_q

STAGE = '用'

SCIENCE = {
  'title': 'A World Too Small to See',
  'subject': '自然',
  'paras': [
    'For thousands of years, people could not see the tiny living things around them. That changed with the {{invention|invention}} of the {{microscope|microscope}}. Through its lens, early scientists saw a whole world of cells moving inside a single drop of water.',
    'Today we know that every living thing is built from cells. The {{structure|structure}} of a cell is surprisingly {{complex|complex}}. Each part has a special {{function|function}}: some parts store information, while others {{produce|produce}} energy.',
    'Cells also make copies of themselves. This process is called {{reproduction|reproduction}}. When a cell divides, its information is {{transmitted|transmit}} to two new cells. Without this {{biological|biological}} process, no plant or animal could grow.',
    'Some changes are even more {{dramatic|dramatic}}. During its life, a caterpillar goes through a complete {{transformation|transformation}}. Its body is broken down and {{constructed|construct}} again in a new form, and a butterfly appears.',
    'Scientists are still {{discovering|discover}} how these processes work. Each new {{observation|observation}} adds a small piece to a very large picture.',
  ]}

SOCIAL = {
  'title': 'A City Without Smoke',
  'subject': '社會',
  'paras': [
    'Fifty years ago, the air in many large cities was grey with smoke. Factories burned coal, and old buses filled the streets with black clouds. For most people, this was simply part of city life.',
    'Things began to change when citizens started to ask hard questions. Doctors {{reported|report}} that more children were having breathing problems. Newspapers printed photos of the {{pollution|pollution}}, and public {{awareness|awareness}} grew quickly.',
    'The city government faced a difficult choice. Closing factories would cause {{unemployment|unemployment}}, but doing nothing seemed {{irresponsible|irresponsible}}. After a long {{discussion|discussion}}, leaders made an {{agreement|agreement}} with local companies to {{reduce|reduce}} their {{emissions|emission}} step by step.',
    'The biggest change came in {{transportation|transportation}}. The city built new train lines and made buses electric. At first, some people were {{disappointed|disappointed}} because the {{construction|construction}} caused traffic jams. Many later admitted that the results were worth the wait.',
    'Today, the city is often used as an {{international|international}} example. Its story shows that a city can grow and stay clean at the same time, if people are willing to see the problem from a new {{perspective|perspective}}.',
  ]}

W13 = unit(13, STAGE, '自然科學文本', [],
  '在你的自然科課本或科普讀物裡，找 5 到 8 個至少有 3 個零件的字，採集時把「學科」標成「自然」。至少有 1 個是「過程名詞」（例如 reproduction），把它還原成一個簡單的句子。',
  [
  seg('w13-s0', '第四階段：用', 3,
    ['拆｜轉｜根｜→ 用', '這週｜自然科學文本', '新功能｜採集時可以標「學科」'],
    ['歡迎來到最後一個階段：用。前十二週，你學了二十幾個字首、二十幾個字尾，還有十幾個字根。這個階段，我們要把它們帶進真正的學科文章。',
     '這週是自然科學。下週是社會科。最後一週，你要用自己的地圖，寫一段自己的文字。',
     '從這週開始，採集的時候可以標「學科」：自然或社會。你的地圖，會開始看得出哪些詞素在哪一種文章裡特別常出現。'],
    []),

  seg('w13-s1', '由外往內拆', 6,
    ['trans + form + ation｜先拆字尾，再拆字首，最後看字根', 're + pro + duc + tion｜兩個字首也沒關係', 'bio + log + ical｜希臘詞素＋字尾'],
    ['科學文章裡的字，常常有三個、四個零件。拆這種字，有一個好用的順序：由外往內。',
     '先看最後面的字尾，它告訴你詞性。transformation 的 -ation，告訴你這是一個名詞，而且是一個過程。',
     '再看最前面的字首。trans 是跨越。拿掉頭和尾，中間剩下 form，形狀。所以 transformation 是「從一個形狀跨到另一個形狀的過程」，也就是轉變、變態。',
     '〔停頓 1 秒〕再拆一個：reproduction。字尾 -tion，名詞；最前面 re，再一次；接著 pro，向前；中間是 duc，帶領。「再一次帶出來的過程」，也就是繁殖、複製。',
     'biological：字尾 -ical，形容詞；前面 bio 是生命，log 是學問。「跟研究生命有關的」，生物的。',
     '由外往內拆，可以讓你不被長字嚇到。先知道它是什麼詞性，再一塊一塊往裡面看。'],
    [mcq('由外往內拆時，第一步看什麼？', ['字根', '字尾，它告訴你詞性', '字典'], 1),
     open_q('用由外往內的方法，拆開 microscopic。', '字尾 -ic（形容詞）→ micro（小）→ scop（看）：「要用來看小東西的」，極小的、顯微鏡才看得到的。')]),

  seg('w13-s2', '讀一篇科學短文', 7,
    ['A World Too Small to See｜點文章裡的字，可以直接採集'],
    ['現在，請你讀一篇短文：A World Too Small to See。文章裡有一些字被標了出來，你可以點它們，直接放進「採集」，原句也會一起帶過去。',
     '讀的時候，不要一遇到長字就停。先讀完整段，再回頭用由外往內的方法拆字。',
     '〔停頓 1 秒〕讀完以後，回答下面的題目。'],
    [mcq('根據文章，reproduction 指的是什麼？', ['細胞複製自己的過程', '顯微鏡的發明', '毛毛蟲變成蝴蝶'], 0),
     mcq('文中 *Its body is broken down and constructed again* 的 constructed 是什麼意思？', ['被破壞', '被重新建造', '被觀察'], 1),
     open_q('從文章裡挑一個至少有 3 個零件的字，用由外往內的方法拆開它。', '例如 transformation：-ation（名詞）→ trans（跨越）→ form（形狀）：從一種形狀轉變成另一種形狀的過程。')],
    passage=SCIENCE),

  seg('w13-s3', '科學喜歡過程名詞', 6,
    ['Cells reproduce.｜→ the reproduction of cells', 'People observe.｜→ an observation', '看到過程名詞｜還原成「什麼東西做了什麼」'],
    ['科學文章很喜歡把一個過程，打包成一個名詞。這是第八週學過的技巧，現在我們在科學文章裡用它。',
     '*Cells reproduce.* 細胞繁殖。打包以後，變成 the reproduction of cells。*Scientists observe the cells.* 打包以後，變成 an observation。',
     '為什麼科學要這樣寫？因為打包以後，過程可以變成句子的主詞，被拿來討論。*Reproduction is essential for all living things.* 這句話在談的，是繁殖這件事本身。',
     '〔停頓 1 秒〕讀科學文章時，遇到 -tion、-ment、-ance 結尾的過程名詞，就停下來還原：什麼東西，做了什麼？',
     '*The transformation of a caterpillar takes about two weeks.* 還原：A caterpillar transforms. It takes about two weeks. 毛毛蟲會變態，這需要大約兩週。'],
    [open_q('把 *The transformation of a caterpillar takes about two weeks.* 還原成簡單的句子。', 'A caterpillar transforms (into a butterfly). This takes about two weeks.'),
     mcq('*Scientists observe the cells.* 打包成名詞是？', ['an observer', 'an observation', 'observable'], 1)]),

  seg('w13-s4', '科學文章裡的詞素地圖', 4,
    ['bio geo micro tele｜科學專用', 'struct form duc tion｜到處都有', '採集時標「自然」'],
    ['回頭看看這篇科學短文，你會發現兩種詞素。',
     '一種是科學專用的，例如 bio、micro、log，它們幾乎只出現在科學文章裡。另一種是到處都有的，例如 struct、form、duc，還有 -tion、-al 這些字尾。',
     '〔停頓 1 秒〕這週採集的時候，記得把學科標成「自然」。過幾週，你可以在地圖上看到：你的自然科詞彙，是由哪些零件組成的。'],
    []),

  seg('w13-s5', '本週任務', 3,
    ['找｜5–8 個至少 3 個零件的字，從自然科文本', '標｜學科：自然', '還原｜至少 1 個過程名詞'],
    ['這週的任務：在你的自然科課本或科普讀物裡，找五到八個至少有三個零件的字，用由外往內的方法拆開，學科標成「自然」。',
     '其中至少一個是過程名詞，例如 reproduction 或 evaporation。在「在這句話裡的意思」那一欄，把它還原成一個簡單的句子：什麼東西，做了什麼。'],
    []),
  ])

W14 = unit(14, STAGE, '社會科文本', [],
  '在社會科課本、新聞或你正在讀的書裡，找 5 到 8 個至少有 3 個零件的字，學科標成「社會」。再找 1 個打包成名詞的句子，把它還原，並寫下「是誰做了什麼」。',
  [
  seg('w14-s0', '這週學什麼', 3,
    ['社會科文本｜新聞、歷史、公民', '由外往內拆｜複習', '打包｜社會科最常見的寫法'],
    ['[課程版]上週我們讀了科學文章。這週換社會科：新聞、歷史、公民，都屬於這一類。',
     '[免費版]這是「用」階段的示範單元。在完整課程裡，前面十三週你會學到所有的字首、字尾和字根；這裡我們先用學過的零件，讀一篇社會科短文，看看它們在真正的文章裡怎麼出現。',
     '社會科文章跟科學文章一樣，很喜歡把事情打包成名詞。可是它打包的，通常不是自然的過程，而是人做的事：決定、討論、協議、抗議。',
     '所以讀社會科文章時，還原的問題要改成：是誰，做了什麼？'],
    []),

  seg('w14-s1', '由外往內拆：社會科的長字', 6,
    ['dis + appoint + ment｜失望', 'ir + respons + ible｜不負責任的', 'mis + under + stand + ing｜誤會'],
    ['先用由外往內的方法，拆幾個社會科常見的長字。',
     'disappointment：字尾 -ment，名詞；字首 dis，不、相反；中間 appoint，指定、約定。「約好的事沒有發生」的那種感覺，就是失望。*The cancelled concert was a big disappointment.*',
     'irresponsible：字尾 -ible，形容詞；字首 ir，不；中間 respons，回應、負責。不負責任的。',
     'misunderstanding：字尾 -ing，名詞；字首 mis，錯誤；中間 understand。誤會。注意，understand 自己是一個語意漂移的字，可是整個字還是可以這樣拆。',
     '〔停頓 1 秒〕unpredictable：字尾 -able，能被…的；字首 un，不；中間 pre 加 dict，事先說。「不能被事先說出來的」，也就是無法預測的。*The weather in the mountains is unpredictable.*',
     '這些字都有四個以上的零件。可是你已經認得每一塊了。'],
    [mcq('unpredictable 是什麼意思？', ['無法預測的', '預測', '可以預測的'], 0),
     open_q('用由外往內的方法，拆開 international。', '-al（形容詞）→ inter（之間）→ nation（國家）：國家之間的、國際的。')]),

  seg('w14-s2', '讀一篇社會科短文', 8,
    ['A City Without Smoke｜點文章裡的字，可以直接採集'],
    ['現在，請你讀一篇短文：A City Without Smoke，一個沒有煙的城市。文章講的是一個城市怎麼解決空氣污染。',
     '跟上週一樣，你可以點文章裡標出來的字，直接放進「採集」。讀的時候，特別留意那些打包成名詞的字：pollution、awareness、agreement、construction。',
     '〔停頓 1 秒〕讀完以後，回答下面的題目。'],
    [mcq('文章裡，城市政府為什麼覺得很難選擇？', ['關工廠會造成失業，不做事又不負責任', '市民不在乎空氣', '工廠太少'], 0),
     mcq('*to reduce their emissions step by step* 是什麼意思？', ['一步一步增加排放', '一步一步減少排放', '馬上停止生產'], 1),
     open_q('文中 *public awareness grew quickly* 是什麼意思？把它還原成一個簡單的句子。', 'People quickly became aware of the problem.（大家很快就意識到污染的問題。）')],
    passage=SOCIAL),

  seg('w14-s3', '打包與還原：是誰做了什麼', 6,
    ['After a long discussion…｜→ They discussed it for a long time.', 'an agreement with local companies｜→ Leaders and companies agreed.', '還原時問：是誰？做了什麼？'],
    ['我們來還原文章裡的幾個打包句子。',
     '*After a long discussion, leaders made an agreement with local companies.* 這句話有兩個打包好的名詞：discussion 和 agreement。',
     '還原：The leaders discussed the problem for a long time. Then they agreed with local companies. 領導者討論了很久，然後和當地的公司達成了協議。',
     '〔停頓 1 秒〕再看一句：*The construction caused traffic jams.* 還原：The city built new train lines. This caused traffic jams. 城市在蓋新的鐵路，造成了塞車。',
     '你發現了嗎？打包句裡，「是誰」常常被藏起來了。construction 沒有告訴你誰在蓋。還原的時候，要從前後文把這個「誰」找回來。',
     '這是讀社會科文章最重要的能力：看出文章背後，是誰做了什麼決定。'],
    [open_q('把 *The construction caused traffic jams.* 還原，並說出「是誰做了什麼」。', 'The city built new train lines, and this caused traffic jams.（城市政府蓋新鐵路，造成塞車。）')]),

  seg('w14-s4', '社會科文章裡的詞素地圖', 4,
    ['un- dis- ir- mis-｜評價與態度', '-tion -ment -ance｜打包人做的事', 'port duc mit spect｜到處都有'],
    ['跟科學文章比起來，社會科文章有兩個特色。',
     '第一，否定字首特別多：unemployment、irresponsible、disappointed。社會科常常在討論問題和評價，所以「不」的字特別多。',
     '第二，名詞字尾打包的，大多是人做的事：discussion、agreement、construction。',
     '〔停頓 1 秒〕這週採集的時候，把學科標成「社會」。到下週，打開你的地圖，比較一下自然和社會的字，是不是由不同的零件組成的。'],
    []),

  seg('w14-s5', '本週任務', 4,
    ['找｜5–8 個至少 3 個零件的字，從社會科文本', '標｜學科：社會', '還原｜1 個打包句，寫出是誰做了什麼'],
    ['這週的任務：在社會科課本、新聞，或你正在讀的書裡，找五到八個至少有三個零件的字，學科標成「社會」。',
     '另外，找一個打包成名詞的句子，抄下來。在「在這句話裡的意思」那一欄，把它還原，並寫下：是誰，做了什麼。',
     '[免費版]你可以先從短文 A City Without Smoke 裡點字採集，再到自己的書裡找。'],
    []),
  ])

W15 = unit(15, STAGE, '統整與產出', [],
  '用你的地圖寫一段 80 到 120 字的英文短文，主題自選（自然或社會）。至少用 5 個你地圖上的字，其中至少 2 個是打包好的名詞。寫完後，把其中 1 個字的拆法和意思記到採集裡，原句就用你自己寫的句子。',
  [
  seg('w15-s0', '最後一週', 2,
    ['回顧｜你的地圖長多大了', '產出｜用地圖寫一段自己的文字'],
    ['最後一週了。這週我們不學新的零件，而是回頭看看你的地圖，然後用它來寫一段自己的文字。',
     '從認得一個字，到能用一個字，是學詞彙最後、也最重要的一步。'],
    []),

  seg('w15-s1', '四個階段，一張地圖', 5,
    ['拆｜字首改變意思', '轉｜字尾改變詞性', '根｜字根是核心', '用｜在學科文章裡由外往內拆、打包、還原'],
    ['我們用一個字，把十五週串起來：transportation。',
     '第一階段「拆」，你認得了 trans，跨越。第二階段「轉」，你知道 -ation 會把動詞變成名詞。第三階段「根」，你認識了中間的 port，帶著東西移動。第四階段「用」，你在社會科文章裡讀到它，知道它打包的是「人和東西被運來運去」這件事。',
     '〔停頓 1 秒〕一個字，四個階段。而你地圖上的每一個字，都經過了同樣的過程：你在書裡遇到它，把它拆開，寫下零件的意思，再回到句子裡確認。'],
    []),

  seg('w15-s2', '幫你的地圖做健康檢查', 5,
    ['最大的家族｜你讀的書，最常用哪個詞素？', '空白的家族｜換一種書讀', '詞性表的空格｜下一個要找的字'],
    ['打開 App 的「地圖」，幫你的地圖做一次健康檢查。',
     '第一，找出最大的家族。它告訴你，你讀的書裡最常出現哪個詞素。',
     '第二，找出空白的家族。如果某個字根一直是空的，可能是因為你讀的書類型比較集中。試著換一種書：小說換成科普，科普換成新聞。',
     '第三，打開詞性表，看看空格。每一個空格，都是你下一個要在書裡找的字。',
     '〔停頓 1 秒〕這張地圖，十五週以後也不會結束。只要你繼續讀，它就會繼續長大。'],
    [open_q('你地圖上最大的家族是哪一個？你覺得為什麼？', '依照自己的地圖回答，例如：-tion 最大，因為我讀很多說明文。')]),

  seg('w15-s3', '用地圖寫作', 6,
    ['選｜5 個地圖上的字', '打包｜至少 2 個名詞', '檢查｜每個字的意思，都放在句子裡說得通嗎？'],
    ['現在，我們來寫作。請你寫一段八十到一百二十字的英文短文，主題自選，可以是自然，也可以是社會。',
     '第一步，打開你的地圖，挑五個你想用的字。第二步，其中至少兩個要是打包好的名詞，例如 pollution、discovery、agreement。',
     '我寫一個例子給你聽。*The construction of the new library took two years. During that time, many students were disappointed because they had no quiet place to study. However, after its completion, the library became the most popular building in town.*',
     '〔停頓 1 秒〕這段話用了 construction、disappointed、completion，每一個都可以拆開。而且 construction 和 completion，都是打包好的名詞。',
     '寫完以後，自己讀一次。每一個你從地圖上拿來的字，放在你的句子裡，意思說得通嗎？如果說不通，回到地圖，看看你當初記下的原句。'],
    [open_q('寫一個句子，用上一個打包好的名詞。', '例如：The discovery of the new medicine saved many lives.')]),

  seg('w15-s4', '十五週之後', 4,
    ['你的能力｜看到長字，能拆、能猜、能確認', '你的地圖｜會跟著你的閱讀繼續長大', '下一步｜更多的閱讀，更大的地圖'],
    ['十五週前，看到一個長長的英文字，你可能只能跳過。現在，你可以把它拆開，猜出它的意思，再回到句子裡確認。',
     '這個能力，不會因為課程結束而消失。你讀得越多，遇到的字越多，你的地圖就越大。',
     '[課程版]最後一次的直播是第十六場：總結。我們會一起看全班的地圖，看看大家最常找到哪些詞素，也回答這一週的提問。',
     '[免費版]如果你想走完完整的十五週，從字首、字尾到字根一步一步建立自己的地圖，可以參加完整的課程。',
     '〔停頓 1 秒〕謝謝你這十五週的努力。繼續讀，繼續拆，繼續把字放回句子裡。'],
    []),

  seg('w15-s5', '最後的任務', 3,
    ['寫｜80–120 字的英文短文', '用｜至少 5 個地圖上的字，2 個打包名詞', '記｜把其中 1 個字，用自己的句子採集'],
    ['最後的任務：用你的地圖，寫一段八十到一百二十字的英文短文。至少用五個地圖上的字，其中至少兩個是打包好的名詞。',
     '寫完以後，挑其中一個字，再採集一次。這一次，原句就用你自己寫的句子。出處可以寫「我的短文」。',
     '這會是你地圖上最特別的一個字：它不只是你讀到的字，也是你會用的字。'],
    []),
  ])

UNITS = [W13, W14, W15]
