# 我的詞族地圖・正式版

一份程式，三個版本：**免費版、課程版、進階版**。架構和 ORF 一樣：Netlify 放網頁，Google 試算表＋Apps Script 當後端。

```
site/                 ← Netlify 發布的資料夾
  index.html          學生 App：課程／採集／地圖／詞性表／複習／班級牆
  teacher.html        老師後台：回答提問、直播展示、第 16 場回顧
  apply.html          家長申請頁（申請後寄登入碼）
  config.js           設定：API_URL（唯一需要填的地方）
  api.js              後端呼叫；API_URL 留空＝預覽模式
  app.js, app.css, teacher.js
  content/course.json 課程版內容包（W1–W15）
  content/free.json   免費版內容包（W1、W4、W9、W14）
  audio/              放 mp3（檔名見 tts/00-檔名清單.tsv）
  netlify.toml
backend/Code.gs       Apps Script 後端
build/                內容的原始檔（改講解內容在這裡）
tts/                  96 段語音稿：.txt 與 .ssml
tools/make_audio.py   用 OpenAI 或 ElevenLabs 產生 mp3
tests/                後端模擬測試、預覽模式端對端測試
```

> 這一版是**重新建置**的完整版本，檔案結構和免費版相同，但每個檔案都換新了。更新 GitHub 時，`site/config.js` 的 `API_URL` 和 `backend/Code.gs` 的 `APP_URL` 要重新填一次。

---

## 一、三個版本怎麼切換

網頁程式完全相同，版本由試算表「學生」工作表的兩個欄位決定：

| 版本欄 | 班級代碼欄 | 學生看到的 |
| --- | --- | --- |
| `free` | （空白） | 免費版：W1、W4、W9、W14；班級牆和提問會出現，但是灰色的 |
| `course` | 例如 `CLASS-A` | 課程版：15 週依開課日期逐週開放；可以提問、看班級牆 |
| `advanced` | （空白） | 進階版：15 週全部開放；沒有老師，班級牆和提問先關閉（之後接 AI 助教） |

- 家長申請時填了**有效的班級代碼**，會自動開成 `course`；沒填就是 `free`。
- 要升級或降級，直接改「版本」欄，學生下次打開 App 就生效，紀錄不會搬動。
- `course` 但班級代碼找不到（或班級停用），會自動當成免費版。

## 二、建立後端（Google 試算表）

1. 新增一個 Google 試算表。
2. 「擴充功能 → Apps Script」，把 `backend/Code.gs` 全部貼上，存檔。
3. 修改最上方的 `APP_URL`（Netlify 網址，第三步完成後再回來填也可以）和 `NOTIFY_EMAIL`（可留空）。
4. 在 Apps Script 編輯器上方選 `testSetup`，按「執行」：會建立五個工作表，並要求授權（試算表、寄信），請同意。
5. 「部署 → 新增部署作業 → 網頁應用程式」：執行身分「我」，存取權「所有人」。複製結尾是 `/exec` 的網址。
6. 用無痕視窗打開那個網址，看到 `{"ok":true,"service":"wordfamilymap",...}` 就成功了。
7. 之後改了 Code.gs，要「部署 → 管理部署作業 → 編輯 → 版本：新版本 → 部署」，網址不變。

### 工作表

| 工作表 | 內容 |
| --- | --- |
| 學生 | 一個孩子一列：token、家長、信箱、暱稱、年級、程度、最後使用、字數、課程進度、狀態、**版本**、**班級代碼**、提問暱稱 |
| 紀錄 | 一個字一列：單字、拆法、零件的意思、在句子裡的意思、原句、出處、學科、透明度、詞性、詞族、單元、詞表比對、老師判定 |
| 班級 | 一個班一列：班級代碼、班級名稱、老師名稱、**老師代碼**、開課日期、直播時段、開放週次、內容包、狀態 |
| 提問 | 學生的提問：暱稱、週次、單字、拆法、原句、兩種意思、不確定的地方、狀態、判定、老師說明、回應 |
| 申請記錄 | 每一次送出申請的原始資料 |

### 開一個班

在「班級」工作表新增一列（或執行 `addDemoClass` 產生範例）：

- **班級代碼**：給家長填在申請頁，例如 `SAT-AM`。
- **老師代碼**：登入老師後台用，請設一組別人猜不到的碼（例如 `T7KQ2M`），不要給學生。
- **開課日期**：W1 的那一天。之後每滿 7 天自動多開一週。
- **開放週次**：填數字會蓋過日期計算，例如填 `5` 就是開到 W5。想提前或暫停進度時用。
- **狀態**：填 `停用` 就關閉這個班。

## 三、部署網頁（Netlify＋GitHub Desktop）

1. 把整個專案（包含 `site/`）放進你的 GitHub repository。
2. 打開 `site/config.js`，把 `API_URL` 換成上面的 `/exec` 網址。
3. Netlify → Site configuration → Build & deploy：**Base directory 填 `site`**，Publish directory 留空（`site/netlify.toml` 已經設定好）。Base directory 沒設是之前 404 的原因。
4. GitHub Desktop：Commit → Push，Netlify 會自動重新部署。
5. 用 `apply.html` 申請一次，確認收到信、連結可以登入。

`API_URL` 留空時是**預覽模式**：不連後端、不寄信，資料只存在那台裝置。

- 學生登入碼：`DEMO01`（免費版）、`DEMOC1`（課程版，示範班 DEMO-A，開到 W10）、`DEMOA1`（進階版）
- 老師代碼：`TDEMO`
- 申請頁輸入班級代碼 `DEMO-A` 會開成課程版

## 四、課程版的一週

| 時間 | 學生 | 老師 |
| --- | --- | --- |
| 週間 | 在「課程」聽講解、做檢核；在自己的書裡採集；拿不準的字按「提問」；在「班級牆」按「我也這樣想」 | 在老師後台看提問，寫回答，把要現場講的標成「排入直播」 |
| 直播（60 分） | 前 45 分鐘：老師回答上週的提問；後 15 分鐘：預告這週 | 「直播」分頁 → 選上週 → 開始，全螢幕一題一題講 |
| 直播後 | 自己的紀錄出現「老師確認」或「老師：再看看」 | 講完按 A 標成「已回答」，學生才看得到判定和回答 |

- W1 的直播是開課說明；W15 的提問在**第 16 場**總結直播回答。
- 「第 16 場回顧」只顯示全班合計（最大的家族、最多人找到的字、每週採集數、提問判定），看不到個別學生，可以直接投影。
- 老師後台的「AI 草稿」：在 Apps Script「專案設定 → 指令碼屬性」新增 `OPENAI_API_KEY`（可選 `OPENAI_MODEL`，預設 `gpt-4o-mini`）就會出現。AI 只會收到該題的單字、拆法、原句和學生寫的內容，不會收到姓名或信箱。草稿一定要看過再儲存。

## 五、內容與詞表

- 15 週 × 6 段講解，共 90 段；免費版另有 6 段專用的開場和任務（檔名前面有 `free-`）。
- 每段：投影片重點、講解文字（可以展開閱讀）、檢核題；W13、W14 各有一篇可以點字採集的短文。
- 答案表：499 個目標詞、81 個陷阱字（`build/key.json`；按週整理的清單在 `build/詞表.tsv`，只給老師參考，不發給學生）。
- 學生存檔時，App 會比對答案表，標出「詞表一致」「陷阱字」「再看看」或「待確認」（不在詞表裡的字，照學生自己的判斷記錄）。

### 自己微調講解內容

講解稿都在 `build/units_1.py`（W1–3）、`units_2.py`（W4–8）、`units_3.py`（W9–12）、`units_4.py`（W13–15）。

- `*英文句子*` → 畫面上是英文斜體，語音用英文唸。
- `〔停頓 2 秒〕` → 語音停頓，畫面上不顯示。
- 段落開頭加 `[課程版]` 或 `[免費版]` → 只出現在那個版本。
- 每週任務段（`-s5`）結尾的「提問／班級牆」說明是自動加上的，在 `build/content.py` 的 `course_tail()`。

改完執行：

```
python3 build/content.py
```

會重新產生 `site/content/*.json` 和 `tts/` 的語音稿。改過的段落，要重新產生那幾段的 mp3（見下一節的 `--only`）。

## 六、語音檔

還沒放 mp3 的段落，App 會自動用瀏覽器內建語音朗讀（中文 zh-TW，英文句子 en-US）。

```
cd 專案資料夾
pip3 install lameenc
export OPENAI_API_KEY=sk-...          # 或 ElevenLabs 的兩個變數，見下面
python3 tools/make_audio.py           # 全部 96 段；已經有的 mp3 會跳過
python3 tools/make_audio.py --unit 3  # 只做 W3
python3 tools/make_audio.py --only w1-s2,w1-s3 --force   # 重做這兩段
```

ElevenLabs（clone voice）：

```
export ELEVENLABS_API_KEY=...
export ELEVENLABS_VOICE_ID=...
python3 tools/make_audio.py --provider elevenlabs
```

產生的檔案在 `site/audio/`，一起 commit、push 就好。金鑰只放在終端機的環境變數，不要寫進任何檔案，也不要放上 GitHub。

> **舊的 mp3 不能沿用。** 這一版的講解稿全部重寫了，之前產生的 `w1-*`、`w4-*`、`w9-*`、`w13-*` 檔案內容會對不上，請刪掉後重新產生。原本免費版的 W13（社會科）在正式版變成 **W14**。

## 七、測試

```
node tests/backend.test.js    # 用假的試算表跑 Code.gs 的所有 action
node tests/e2e.test.js        # 預覽模式：免費版、課程版、老師後台、申請頁（需要 playwright）
```

## 八、隱私

- 試算表只有你（擁有者）看得到。學生 App 不會顯示其他學生的紀錄。
- 班級牆只顯示提問時填的暱稱，不顯示登入碼或家長資料。
- 第 16 場回顧只有全班合計。
- 學生可以在「選單」下載自己的備份檔。
