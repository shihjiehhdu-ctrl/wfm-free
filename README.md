# 我的詞族地圖・免費版　部署說明

架構與 ORF 相同：**Netlify 放網頁，Google 試算表＋Apps Script 當後端**。

```
site/            ← 整個資料夾拖進 Netlify
  index.html     App（課程／採集／地圖／詞性表／複習）
  apply.html     家長申請頁（申請後寄 token）
  config.js      設定：API_URL
  api.js         後端呼叫（API_URL 留空＝預覽模式）
  app.js, app.css
  content/free.json   內容包：W1、W4、W9、W13 的講解、檢核、短文、詞素、詞表
  audio/         放 TTS 產生的 mp3（檔名見 tts/00-檔名清單.tsv）
  netlify.toml
backend/Code.gs  Apps Script 後端
tts/             23 段語音稿：.txt（純文字）與 .ssml（含停頓與英文語音標記）
build/           內容包的原始檔（content_free.py、key.json）
```

## 一、建立後端（Google 試算表）

1. 新增一個 Google 試算表，例如「我的詞族地圖・免費版」。
2. 「擴充功能 → Apps Script」，把 `backend/Code.gs` 全部貼上，存檔。
3. 修改檔案最上方的 `APP_URL`，填 Netlify 網址（第二步完成後再回來改也可以）。如果想在有人申請時收到通知，填 `NOTIFY_EMAIL`。
4. 「部署 → 新增部署作業 → 網頁應用程式」：執行身分「我」，存取權「所有人」。第一次會要求授權（試算表、寄信），請同意。
5. 複製網頁應用程式網址（結尾是 `/exec`）。用無痕視窗打開，看到 `{"ok":true,"service":"wordfamilymap-free"}` 就是成功。

試算表會自動建立三個工作表：

| 工作表 | 內容 |
| --- | --- |
| 學生 | 一個孩子一列：token、家長、信箱、孩子、年級、iEnglish 等級、申請時間、最後使用、字數、課程進度、狀態 |
| 紀錄 | 一個字一列：單字、拆法、零件的意思、在句子裡的意思、原句、出處、透明度、詞性、詞族、單元、詞表比對 |
| 申請記錄 | 每一次送出申請（包括重寄）的原始紀錄 |

- 停用某個 token：把「學生」工作表的「狀態」改成 `停用`。
- 同一個信箱＋同一個孩子名字再申請一次，會重寄同一個 token，不會重複建立。
- 修改 Code.gs 之後，要到「部署 → 管理部署作業 → 編輯 → 版本：新版本 → 部署」，網址不變。

## 二、部署網頁（Netlify）

1. 打開 `site/config.js`，把 `API_URL` 換成上面的 `/exec` 網址。
2. 把整個 `site` 資料夾拖到 Netlify（Sites → Add new site → Deploy manually）。
3. 拿到網址後，回到 Code.gs 把 `APP_URL` 改成這個網址，重新部署新版本。
4. 用 `apply.html` 申請一次，確認收到信、連結可以登入。

`API_URL` 留空時是**預覽模式**：不連後端，資料只存在那台裝置，token 輸入 `DEMO01` 就能試用，申請頁也會直接顯示假的 token。

## 三、語音檔（TTS）

- `tts/` 裡有 23 段語音稿，每段一個 `.txt` 和一個 `.ssml`。
  - `.txt`：純文字，〔停頓 N 秒〕保留在文字中，可以依你的 TTS 工具手動處理。
  - `.ssml`：停頓已轉成 `<break time="Ns"/>`，英文例句包在 `<lang xml:lang="en-US">` 裡，支援 SSML 的工具（Azure、Google Cloud TTS 等）可以直接用。
- 產生的 mp3 依清單命名（例如 `w1-s1.mp3`），放進 `site/audio/`，重新部署即可。
- 還沒有 mp3 的段落，App 會自動改用瀏覽器內建語音朗讀（中文用 zh-TW，英文例句用 en-US），學生也可以展開「講解文字」自己讀。

### 用 OpenAI TTS 自動產生

`tools/make_audio.py` 會直接讀 `site/content/free.json`，產生所有段落的 mp3，放進 `site/audio/`。

```
pip install openai lameenc
export OPENAI_API_KEY=sk-...          # Windows：set OPENAI_API_KEY=sk-...
python3 tools/make_audio.py --only w1-s1   # 先做一段試聽，滿意再全部產生
python3 tools/make_audio.py                # 產生所有還沒有的音檔
```

- 〔停頓 N 秒〕會變成真正的靜音，段落之間也會留 0.6 秒。
- 已經有的音檔會略過；修改講解稿後，用 `--only w4-s2 --force` 重做那一段。
- 換聲音：`--voice cedar`（預設 marin）；調語速：`--speed 0.95`。
- 英文例句聽起來不夠清楚時，加上 `--split-english`：英文句子會分開產生，用另一組英文朗讀指示。
- `--dry-run` 只顯示會送出的文字，不花費 API 額度；`--list` 看哪些段落已經有音檔。
- API key 只放在你自己電腦的環境變數，不要寫進程式或 commit 到 GitHub。

## 四、內容修改

講解稿、檢核題、詞素和詞表都在 `build/content_free.py`。修改後執行：

```
python3 build/content_free.py
```

會重新產生 `site/content/free.json` 和 `tts/` 的語音稿。內容包有版本號（`version`），之後課程版與進階版用同一種格式，只是單元更多。

## 五、用「版本」欄切換免費版與課程版

網頁程式只有一份。每個孩子看到哪個版本，由試算表「學生」工作表的 **版本** 欄決定：

| 版本 | 說明 |
| --- | --- |
| `free` | 免費版（申請時自動填入） |
| `course` | 課程版：同時在 **班級代碼** 欄填上班級代碼 |
| `advanced` | 進階版（之後開放） |

- 改完之後，孩子下次登入（或重新整理頁面）就會生效，原本記錄的字全部保留。
- 每個版本開放哪些功能、載入哪一份內容包，在 Code.gs 最上方的 `TIERS` 設定。
- 課程版的提問、班級牆這些動作，後端會用 `requireFeature_()` 再檢查一次版本，不只靠網頁上的開關。
- 課程版的內容包 `content/course.json` 還沒建立；在那之前，課程版的孩子會先看到免費版的內容。
- 預覽模式可以輸入 `DEMOC1` 看課程版的介面。

## 六、和課程版、進階版的關係

- 每個字的資料結構（Entry）與原型相同，加上 `tier:'free'`。升級時沿用同一個 token 與同一份紀錄，不需要搬資料。
- 課程版要加的是：班級代碼、老師代碼、班級牆（提問）與老師後台。後端只需要新增 action，不用改 `login` 和 `sync`。
- 免費版的 W9 單元任務段落已經改寫成自學版本（不提班級牆與直播），其他講解內容與課程版相同。

## 七、隱私

- 試算表只存家長姓名、信箱、孩子暱稱、年級、iEnglish 等級，以及孩子記錄的單字。
- 孩子的紀錄只有你（試算表擁有者）看得到；App 本身不顯示其他學生的資料。
