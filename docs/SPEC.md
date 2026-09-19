# 同一張單 OneSlip — MVP 建置規格 v1

> 主題三「農產品即時價格」・買賣雙方媒合＋議價平台・CloudMosa Cloud Phone 按鍵機・單檔 `index.html`
> 讀者：接手的工程師（先做 Logic，再做 UI）。**讀完這份就能開工，不需再問產品負責人**；規格沒寫死的細節請自行決定，記在 `docs/LOGIC_API.md` 或 README。

## 0. 怎麼用這份規格（先讀）

| 交付物（都在 `/private/tmp/claude-501/-Users-lidahuang-Desktop-Projects/44dec0f7-2d00-4390-8998-f6f613a9fba9/scratchpad/`） | 用途 |
|---|---|
| `farm-spec.md`（本檔） | 產品、資料模型、公式、狀態機、API、畫面、驗收 |
| `farm-worked-examples.json` | **276 個** 輸入→預期輸出案例。預期值全部由 node 執行參考實作算出（非心算）。執行方式見 §17.2 |
| `farm-src/farm-data.js` | **參考資料檔**（兩個地區包、短語、品級卡、i18n 起手表、螢幕尺寸表）。可整段貼進 `<script id="farm-data">`。由 `farm-src/build-data.js` 產生 |
| `farm-src/farm-logic.js` | **參考純函式庫**（`window.FarmLogic`）。可整段貼進 `<script id="farm-logic">`。已通過全部 worked examples 與 `prop-check.js` 亂數檢查 |
| `farm-src/load.js`, `gen-examples.js`, `verify-examples.js`, `prop-check.js`, `golden-g1.js` | 載入方式（與 `tests/lib.mjs` 的 `loadLogic()` 同構；已用真的 `loadLogic()` 驗證過全部案例）、案例產生器、案例重跑器、性質/亂數檢查、黃金路徑 G1 的數字重現腳本。規格本身由 `build-spec.js` 從 `md/part*.md`＋資料表組出（表格與數字皆由資料/函式產生） |

**建置者 1（Logic）**：先把 `farm-data.js`、`farm-logic.js` 原封放入 `index.html` 對應 `<script id>`，寫 `tests/logic.test.mjs` 跑全部案例，再補文件與你自己的性質測試。你可以重構，但案例必須全綠；若你認為某案例與規格公式衝突，以**本規格公式**為準並列入 `specConflicts`（參考實作＝公式的可執行版本，兩者刻意一致）。
**建置者 2（UI）**：實作 `farm-transport`（Transport＋MockServer）與 `farm-ui`（畫面、鍵盤、雙手機外殼、Demo 面板、`window.FarmApp`）。**第 15 章的「黃金路徑」是驗收合約**（兩支手機只用鍵盤，共 51 鍵（成交前 44 鍵）走完 貼單→媒合→議價→成交→行情回寫；逐鍵表見 §15.1）。

優先級標記：**P0**＝沒有就不算完成；**P1**＝應完成，時間不夠先砍 P2 再砍 P1；**P2**＝加分/可只寫進文件。

### 0.1 一頁摘要

- **一句話**：買賣雙方看**同一張單**——同一組公斤數、同一個單價、同一份參考價、同一個成交明細；各自在自己的手機上有**只存本機的私人議價教練**。
- **不是聊天室**：溝通只有 ①五格報價（單價/公斤/品級/交貨/付款）②約 12 句編號短語（各自語言顯示）③數字。沒有自由文字、沒有連結、沒有圖片。
- **價值主張（寫在簡報上的版本）**：「讓你在議價當下手上有退場價、可信參考價與同一張算式」，**不是**「幫你賣更高」（證據見 §1.3）。
- **雙邊產生資料**：雙方確認的成交價 → 回寫成參考價帶（資料飛輪）；冷啟動時參考價來自模擬外部源並**明確標示**。
- **平台事實內建**：沒有推播（→收件匣＋敲門簡訊模擬）、沒有背景執行（→狀態常駐伺服器、手機是可丟棄的遙控器）、畫面更新計費（→無動畫、一鍵一次重繪、本機計算不打 API）、沒有離線模式（→只說「資料已載入的這次連線內可本機計算」）。

## 1. 產品概念

### 1.1 名稱與定位

- **中文名**：同一張單　**英文名**：OneSlip（7 字元，符合上架「名稱少於 10 字元」建議）
- **Tagline**：買賣雙方看同一張單 / Both sides, one slip
- **定位**：給小農、小販與中盤商/餐廳/加工廠的「議價與成交單」工具。先幫你**算清楚**（單位、總價、手續費、運費、腐損、找零），再幫你**談清楚**（結構化報價、教練、封存議價、雙盲秤貨），最後把成交價**記下來變成大家的參考價**。

### 1.2 與 v0「賣不賣？」的差異

| v0 | 本版 |
|---|---|
| 單邊查價、賣/等/別賣燈號 | 雙邊媒合＋議價；燈號**砍掉**（見 §3.3） |
| 沒有數量×單價 | 單位換算→總價→手續費→實收/要付→找零，全整數運算 |
| 無限動畫、離線模式 | 零動畫、零 transition、無離線模式宣稱 |
| 群眾回報成交價（自願） | 只有**雙方確認**的成交才回寫（去頭尾加權中位數＋新鮮度） |
| 單機 | 真實產品一支手機；Demo 並排兩支＋共用模擬伺服器（Demo 工具，不是產品） |

### 1.3 我們對「雙邊平台值不值得做」的判斷（誠實版，簡報可直接用）

**結論：值得，但只有在「單邊就有用、雙邊有加成」的版本才是淨加分。** 證據：Jensen 2007（Kerala 漁民）、Aker 2010（Niger 穀物商）、Courtois & Subervie 2015（迦納 Esoko，玉米約 +10%、花生約 +7%，準實驗）顯示資訊在「能換市場或面對面議價有可信替代選項」時有用；Fafchamps & Minten 2012（印度 SMS，無顯著平均效果）與 Mitra 等 2018（西孟加拉馬鈴薯：價格追隨批發價但平均農場價不變）顯示**只推送行情沒用**。Esoko/eNAM/Twiga 的教訓：買方不上線、付費者錯位、資料成本、資產過重、信用與付款。因此本版：

1. **單邊工具撐得住自己**（不需對方裝 App）：參考價帶、算錢/找零/多品項、喊價檢查、量具校準、私人教練。這是冷啟動入口，也是 Demo 中「單機打開不是空的」的保證。
2. **雙邊層只做一條深的主線**：貼單→媒合→五格議價→同一張成交單→行情回寫；其餘擴充功能只留「小而準」的（封存議價、雙盲秤貨、履約點、熟人先看窗）。
3. **買方有自己的理由**（§3.2）：落地價/淨利排序、訂單釘（貨源）、熟人先看（不被陌生買家比價）、貨單「租約」確認（少白跑）、賣方履約點。買方從資訊不對稱獲利，所以**不把「揭露行情」當買方賣點**；行情是成交的副產品。
4. **誠實限制**：沒有證據顯示「結構化議價減少糾紛」或「能抬高實收價」——文案只寫「建議」「估」「模擬」；不宣稱降低詐騙率；不託管款項、不阻止私下成交。

### 1.4 評分對照（給簡報與自我檢查）

| 評分項 | 本版怎麼拿分 |
|---|---|
| 創意 15 | 「同一張單」共同算式＋私人教練（底價只存本機）；用**外部退場價**當議價力來源；跨語言結構化短語；按鍵機專屬的一鍵一重繪與數字鍵 USSD 式輸入 |
| 技術深度 30 | 純函式庫＋合法轉移表狀態機（CAS 版本、冪等鍵、回合/期限/最後價）；Transport 介面可換 fetch；混亂面板（丟包/逾時/拔電池）；參考價（加權中位數＋新鮮度衰減＋來源標記＋降級階梯）；資料驅動地區包；worked examples＋CI 路徑 |
| 完成度 30 | 兩支手機完整跑通主線；每畫面有載入/錯誤/空/過期狀態；雙尺寸雙語言；測試掛勾與 E2E；單檔可雙擊開 |
| 實用價值 25 | 直擊「秤/單位/資訊不對稱/現金找零/手續費斷崖」；買賣雙方各自的教練；成交價回寫；誠實標示；可延伸到真實資料源 |

## 2. 角色與情境

### 2.1 角色

| 角色 | 是誰 | Demo 中 | 要什麼 |
|---|---|---|---|
| **賣方 S** | 小農/小販（Kano：Amina 番茄農；Bihar：Sunita 馬鈴薯農） | 左手機 A | 議價當下有退場價與可信參考價、算清楚、少被少秤、快速成交 |
| **買方 B** | 中盤商/攤商/餐廳（Kano：Musa；Bihar：Arun） | 右手機 B | 穩定貨源、少白跑、落地價與淨利、信得過的賣方、不被陌生人比價 |
| **模擬買賣方（bots）** | 熟人圈其他買方、種子賣方 | 伺服器內，事件流標「模擬」 | 讓 Demo 有競爭與資料；**可關閉**（`bots` 開關） |
| **場邊買家（無 App）** | 站在攤位前喊價的人 | 不存在於系統 | 賣方用**喊價檢查**（單機）輸入對方喊價得到判斷 |

### 2.2 四個情境（S1 是驗收主線）

- **S1 完整成交（雙機）**：Amina 貼單 126 kg 番茄 ₦470 → Musa 在「找貨」看到（熟人先看）→ 用開價階梯出價 ₦440＋短語「價錢太高了」→ Amina 收件匣看到（開 App 才看到）→ 教練建議 ₦455 → 還價 → Musa 接受並輸入總額末兩碼 → Amina 確認 → 成交，行情帶 n=4→5、中位數 ₦450→₦455。
- **S2 競爭與搶量（雙機＋bots）**：快轉 12 分鐘，熟人 Hauwa 對同一張單出 60 kg ₦430；Amina 還價 ₦450 被接受（5 分鐘後）；剩 66 kg。Musa 之前的 126 kg 報價此時**不能再被接受**（`OVER_STOCK`），Amina 改還 66 kg。Musa 只看到「你目前排第 2/2」，看不到別人的價。
- **S3 買方入口（訂單釘）**：Musa 釘「番茄 100 kg 願付 ₦445 收貨市場 Sabon Gari」→ Amina 在「誰要買」依**落袋價**排序看到 → 一鍵認領（出報價）→ 走同一條議價/成交路。
- **S4 場邊喊價（單機）**：買家站在攤位前喊 ₦380/kg。Amina 用「喊價檢查」輸入 380 → 「低於價帶 14%」＋「建議還價」＋「別處淨得 ₦448」。對方沒有 App，一樣有用。

## 3. MVP 範圍決策

### 3.1 功能與優先級

首頁數字鍵 1–9 各對應一個入口（賣方與買方首頁不同，見 §10.4）。

| ID | 功能 | 來源候選 | P | 賣方鍵 | 買方鍵 |
|---|---|---|---|---|---|
| F1 | 貼單與單碼卡（作物→數量/單位→單價→品級→熟人先看；5 碼單碼含 Luhn 檢查碼；24h/租約） | C01＋C10 租約 | P0 | 1 | — |
| F2 | 找貨：媒合清單依**淨利**排序（落地價、淨利、運費、腐損） | C12 落地價 | P0 | — | 1 |
| F3 | 訂單釘（買方）＋誰要買（賣方，依落袋價排序） | C08 | P0 | 3 | 2 |
| F4 | 收件匣＋五格議價（回合/期限/最後價/重開）＋冪等/CAS | C02＋C19 | P0 | 2 | 3 |
| F5 | 議價教練：外部退場價、私人底價/目標（**只存本機**）、開價階梯、建議還價 | C04 | P0 | (串在 F4) | (串在 F4) |
| F6 | 同一張成交單：單位換算→總價→手續費→實收/要付、回讀末兩碼、位數守門、手續費斷崖提示 | C14＋C12 | P0 | (串在 F4) | (串在 F4) |
| F7 | 共同參考價帶（成交回寫、來源/新鮮度/樣本數） | C16 | P0 | 4 | 4 |
| F8 | 算錢（單位換算、找零、多品項清單）＋喊價檢查（單機入口）＋單位陷阱偵測 | C12＋C18 精簡＋C04 | P0（多品項 P1） | 5, 6 | 5, 6 |
| F9 | 結構化短語（跨語言，12 句） | C05 | P0 | (串在 F4) | (串在 F4) |
| F10 | 熟人先看窗（30 分）＋熟人圈＋履約點三點 | C07＋C15 精簡 | P1 | 8 | 8 |
| F11 | 封存議價（盲議價，中點成交）＋雙盲秤貨 | C03＋C13 精簡 | P1 | (串在 F4) | (串在 F4) |
| F12 | 韌性：待送件匣、冪等重送、混亂面板（丟包/逾時/拔電池）、敲門簡訊「電信層」模擬 | C19＋C20 精簡 | P1 | 首頁橫幅 | 首頁橫幅 |
| F13 | 租約續約（貨單開機第一屏「還全有/賣一部分/賣完」） | C10 精簡 | P1 | 7 | — |
| F14 | 單位握手（賣方與買方各自校準的容器差 >10% 紅字＋總額差） | C13 精簡 | P1 | 9→校準 | 9→校準 |
| F15 | 雙尺寸/雙語/雙地區/Demo 面板/引導劇本 | — | P0（劇本 P1） | — | — |
| F16 | 聯絡揭露（tel:/顯示號碼，雙方同意）、BroadcastChannel 兩分頁、Worker 版伺服器 | C20、C19 | P2 | — | — |

### 3.2 買方為什麼要用（規格層級的回答）

1. **落地價與淨利排序**（F2）：他看到的不是「誰最便宜」，而是「扣掉運費、腐損、手續費、和我自己市場的行情後我賺多少」——Kaduna 那張標價較低的貨，落地後反而比 Dawanau 近的那張貴（種子資料裡就是這樣）。
2. **訂單釘**（F3）：掛一張單讓賣方來找他，省去每天一家家打電話；賣方端只看到「願付價」，**不看到他的上限**。
3. **熟人先看窗**（F10）：老賣家的貨他 30 分鐘內先看，不被陌生買家比價；他只會看到自己排第幾，看不到別人的價。
4. **租約確認**（F13）：貨單顯示「N 分前由賣家確認」，減少白跑與殭屍貼單。
5. **履約點**（F10）與**雙盲秤貨**（F11）：量準/準時/履約三點；秤貨兩份讀數同時翻牌。
6. **揭露設定**：買方的私人上限、教練數字不上傳；成交價回寫只保留「價格＋公斤＋時間」，不含姓名（k 匿名門檻 n≥3 才成為價帶）。

> 誠實：沒有任何證據顯示買方會因此天天上線。我們的做法是把冷啟動壓到「1 賣方＋3 老買家」（§18），並在 Demo 內把 bots 標成「模擬」。

### 3.3 被推翻/砍掉/延後的候選（`parkedIdeas`）

對候選排名做了以下**推翻**（原因：評審一致指出範圍爆炸與買方動機；一人 1–2 天只能做一條深的主線）：

| 候選 | 決定 | 理由 |
|---|---|---|
| C08 訂單釘（排名 #3） | **升為與 C01 並列的入口** | 買方評審：這是唯一直接給買方貨源的功能；放寬價目表砍掉（全池本機重算量大） |
| C07 熟人圈先報價（排名 #1） | 降為「可見性規則」（F10），不做獨立流程 | 工程：只是貨單的 audience 旗標＋30 分窗；bots 自動回價要虛擬時鐘 |
| C12 落袋價/落地價（#2） | 保留，**砍賒帳資金成本、預付鎖價** | 奈及利亞錢包費率無來源；保留手續費斷崖（尼日 ₦10,000 的 +₦50 印花稅是真實斷崖，標「草案」） |
| C18 亮牌面/障眼閘（#5） | **延後**；只留找零、多品項、「形狀不只靠顏色」 | LSK 連按 400 ms 與按住 OK 未驗證；Cloud Phone 雲端渲染往返延遲使門檻失準 |
| C10 降價鐘 | **砍** | 會教買方等著壓價、與議價中價格衝突；租約續約保留為 F13 |
| C09 集貨拼車、C06 開市鐘 | **砍**（因此**不實作** `splitFreight`/拼車分攤，worked examples 也沒有） | 多賣方聚合/密封+作息對齊是 eNAM 死因；兩支手機演不出 |
| C19 的「碰頭窗＋短輪詢」 | **砍**（MVP 沒有任何輪詢；一律「打開/手動更新才讀」） | 輪詢對按鍵機流量與電力的影響只是推論、需實測；正式版若加：預設關閉、明示「短輪詢會增加流量」、越南低階機不啟用 |
| C11 賣/等/別賣燈號 | **砍** | 燈幾乎永遠是「賣」、有責任風險、v0 舊點子；不做 → worked examples 不含燈號案例 |
| C17 報價紅旗/放貨防線 | 只留「位數守門」與「短語行情查核章」 | 按住 OK 的 repeat 未實測；分批放貨對易腐貨不適用 |
| C14 爭議梯/驗貨扣價階梯 | **延後** | 各為獨立狀態機；只留成交單＋回讀＋位數守門 |
| C13 六合一 | 只留單位握手（F14）＋雙盲秤貨（F11）；實付率/雙讀提示延後 | 買方無誘因用實付率（農夫武器）；範圍過大 |
| C20 號碼閘 | 電信層面板模擬＋敲門簡訊（F12）；聯絡揭露 P2 | SMS 通道費用/sender ID/tel: 版本皆未證實 |
| C03 封存議價（composite 3.28，多數評審 maybe） | **保留為 P1 選配** | 理由：需求明列盲議價；它是「手機拿不到對方欄位」的最佳展示；狀態機小（純函式 ~40 行）。主流程仍是公開五格議價 |
| C05 話術鍵（賣方評審 cut） | **保留** | 硬需求：雙方不同語言仍能溝通；縮到 12 句、查表 |
| C15 私下成交對帳 | 只留履約點三點；「談成了嗎？」單鍵回報 P2 | 沒人願意記帳；樣本必<5 |

## 4. 平台限制清單（設計與驗收都要對照；V=已驗證 / U=未驗證）

| # | 限制 | 狀態 | 本版做法 |
|---|---|---|---|
| 1 | LSK＝`Escape`（keyCode 27），是唯一收得到的軟鍵；RSK 不是鍵盤事件，是 `window` 的 `back` 事件（`preventDefault()` 可覆寫，預設等同 `history.back()`，無上一頁時等同 `window.close()`） | V | LSK＝選項選單；RSK＝刪一位/返回。桌機以 `Backspace` 模擬 `back`，並接受 `SoftLeft`/`SoftRight` 鍵名（KaiOS 與測試 harness 使用） |
| 2 | 官方按鍵表沒有 Backspace/Delete/C；實機是否有實體鍵會送出 Backspace | U | 兩者都處理，走同一個 `onBack()` |
| 3 | `*`＝`NumpadMultiply`（106）；本 repo harness 送 `key:'*', keyCode:170`；實際 `e.key` 字串未逐字確認 | U | 判斷 STAR：`e.key==='*'` 或 keyCode ∈ {106,170} 或 `e.code==='NumpadMultiply'` |
| 4 | `#` 與 `3` 共用 keyCode 51 | V | **`#` 無獨立功能**；`keyCode===51` 一律當 `3`。不依賴 `#` |
| 5 | `<input>` 只觸發 input/change、不送 keydown（2024 部落格） | V(舊) | **不使用 `<input>`**；數字用自己的緩衝區畫在 `div` |
| 6 | 螢幕 QQVGA 128×160 與 QVGA 240×320；字級 QVGA 內文 16pt / QQVGA 12pt；安全邊距 8/4pt；itel NEO R60+ 實際解析度未在文件出現 | V/U | 兩套版面；先以 128×160 設計。越南 Viettel Sumo 為 128×160、client 2.5.0（無 tel:） |
| 7 | 沒有游標模式證據；焦點自己管；格狀用 Z 字導覽；清單支援 `KeyboardEvent.repeat` | V | 自製焦點；九宮格 Z 字（左右換行接續） |
| 8 | 流量來自**畫面渲染**而非資料抓取；1 MB JSON≠1 MB 使用者流量；「動畫＝花錢」是**推論**不是官方原文 | V/推論 | 零 `animation`/`transition`；一鍵至多一次 DOM 重繪；行情整包載入後本機計算；marquee 不用；文案不寫「官方說動畫花錢」 |
| 9 | 最高約 20 FPS、client↔server↔app 兩次往返，不適合即時 | V | 「即時」＝時間戳＋手動更新；**無 ticker**；無倒數跳動（期限是「打開時才判定」） |
| 10 | 沒有推播、沒有背景執行、沒有 Service Worker/離線 | V | 非同步收件匣＋未讀數＋開啟/手動更新；敲門簡訊（平台外）只在正式版，MVP 用「電信層」面板模擬。**不做離線模式** |
| 11 | `prefers-color-scheme` 永遠 `light`，`prefers-reduced-motion` 永遠 `no-preference` | V | 高對比自己做開關（設定畫面，預設深色高對比） |
| 12 | localStorage 5 MB、使用者「Clear Data」會清空；離開 App 快取很快清除 | V | 只存偏好/私人底價/校準/待送件匣；每次讀寫 `try/catch`；沒有也能跑 |
| 13 | fetch/CORS 與 Chrome 相同；請求由資料中心（新加坡/美/南非/西班牙）發出，IP 在 `X-Forwarded-For` | V | Serverless 需正確 CORS；市場由使用者選，不由 IP 推斷；Geolocation 在 R60+ 實機可用（2026-09-19 確認），Near me 畫面使用，失敗時退回使用者選的市場 |
| 14 | `navigator.hasFeature('TelScheme'\|'SmsScheme'\|'Vibrate')` 回 Promise，名稱區分大小寫；`tel:` 需 client ≥3.1.2 這個版本號**未重新查證** | V(偵測)/U(版本) | 聯絡揭露一律先偵測，false 時「大字顯示號碼 10 分鐘供抄寫」；`try/catch` |
| 15 | 外部連結、`target=_blank`、`window.open`、下載、相機在真機的行為 | U | MVP 不用任何外連/下載/相機 |
| 16 | 奈及利亞是否販售、itel NEO R60+ 是否在官方裝置清單 | U | 簡報寫「奈及利亞為**潛在**市場」；已證實市場：印度、越南、非洲（南非 Vodacom、馬達加斯加）——所以**第二個地區包選印度 Bihar** |
| 17 | 上架：HTTPS 網址、名稱 <10 字元、512×512 PNG 圖示；審核 | V | README 要寫部署；圖示不在本 MVP |
| 18 | 模擬器無法用相機/麥克風/檔案上傳；Screen Wake Lock 支援 | V | 不用；Wake Lock 不用（P2 可 try/catch 加） |

## 5. 架構（單檔、四個 script、一條信任邊界）

### 5.1 檔案配置（`index.html`）

```
<style>                      單一樣式表（CSS 變數；無 animation/transition；系統字型，不載外部資源）
<div id="app">               Demo 外殼：雙手機、Demo 列、事件流面板、電信層面板
<script id="farm-data">      window.FarmData   純資料（地區包、短語、品級卡、i18n、尺寸表）              ← farm-src/farm-data.js
<script id="farm-logic">     window.FarmLogic  純函式；不碰 DOM、不用 Date.now/計時器/structuredClone  ← farm-src/farm-logic.js
<script id="farm-transport"> Transport 介面＋MockServer＋MockPriceSource＋Bots＋MockSms；不碰 DOM（日後可丟進 Worker）
<script id="farm-ui">        手機狀態機、畫面表、鍵盤、render、Demo 面板、window.FarmApp
```

- `tests/lib.mjs` 的 `loadLogic()` 只執行 `farm-data` 與 `farm-logic` 兩段，沙盒只有 `console, Math, Date, JSON, Number, String, Array, Object, Map, Set, Intl`（外加 vm 內建的 `parseInt`、`RegExp`…）與 `window`（＝沙盒自身）。**所以兩段不得用 `document`、`localStorage`、`setTimeout`、`structuredClone`、`performance`、`TextEncoder`。**
- 依賴方向：`farm-ui → farm-transport → farm-logic → farm-data`，不得反向。`farm-transport` 只透過 `FarmLogic.*` 做任何金額/狀態/排序計算；**UI 也用同一批函式做本機預覽**（編輯報價時即時顯示總價/落地價），因此兩支手機與伺服器對同一組輸入必得同一個數字（驗收 H-03）。
- 目標大小：< 400 KB（`farm-data.js` 約 49 KB）。

### 5.2 信任邊界（評審一開 DevTools 會看的地方）

```
 phone A (farm-ui state)                      Transport                    MockServer (farm-transport)
 ├ view state, buffers, cache  ── JSON ───►  request({method,path,body})  ├ users, listings, wants, offers
 ├ private: floor/target/calib (localStorage)                 (deep clone   ├ sealed values, phone numbers
 └ never receives: other side's sealed value,  ◄── JSON ──   both ways)    ├ idempotency table, event log
   phone numbers, other users' data                                         └ clock, PRNG, bots, SMS outbox
```

- **所有跨手機資料只走 Transport**。`LocalTransport`（預設）：伺服器在同一個 JS 環境，但**請求與回應都經 `JSON.parse(JSON.stringify(x))` 深拷貝**，手機端拿不到伺服器物件參考。回應是「視圖（projection）」，**不含對方的私密欄位**（封存值、電話、對方底價——後者根本不存在於伺服器）。
- 私人議價數字（底價/上限/目標）只在 `localStorage['oneslip:v1:<phone>:limits']`，**不在任何 API 的 body 裡**。驗收 I-01：掃描 `server.getState()` 的 JSON，找不到這些值。
- P2 選配：`?worker=1` 把 `farm-data + farm-logic + farm-transport` 三段文字組成 Blob Worker（真的序列化邊界）；此模式下 `server.getState()` 回 Promise。`?tab=A|B` 用 `BroadcastChannel('oneslip-net')`：第一個分頁當 leader（持有 MockServer），follower 分頁把 request 廣播給 leader 並等回應（leader 關閉則伺服器狀態消失，README 註明）。

### 5.3 Transport 介面（正式版換成 `fetch` 即可）

```js
// farm-transport
interface Transport {
  request(req: {method:'GET'|'POST'|'DELETE', path:string, body?:any, userId:string, idemKey?:string, ifNoneMatch?:string}):
    Promise<{status:number, body:any, etag?:string, serverNow:number, replayed?:boolean}>;
  clockNow(): number;              // 手機端對「伺服器現在時間」的同步估計（正式版＝Date.now()+由回應 Date 標頭估的偏差）
  onClock?(cb:()=>void): void;     // 僅 Demo：快轉時通知手機重繪「x 分前」
}
// 應用層錯誤：resolve 且 status>=400，body={error:'CODE', offer?:{...現況}}
// 網路層錯誤：reject {code:'NETWORK_DOWN'|'TIMEOUT'|'SERVER_BUSY', retryable:true}
```

正式版對映：`request` → `fetch(BASE+path, {method, headers:{Authorization, 'Idempotency-Key', 'If-None-Match'}, body})`，`status/body/etag` 直接取自 Response，`serverNow` 取自回應標頭 `Date` 或 body。**UI 只認這個介面。**

### 5.4 時間與決定性

- **虛擬時鐘**：`MockServer.now()` 在 `clock.mode='manual'`（預設）時**不會自己走**，只由 `advance(ms)`（Demo 列「快轉」鈕、`FarmApp.server.advance`）推進。所有期限/租約/熟人窗/新鮮度都吃這個時間；純函式一律收 `now` 參數。`?clock=real` 改為 `Date.now()`（僅人工展示用）。
- 每個 `reset(seed)` 的起始時刻＝地區包的 `startLocal`（06:30 當地時間，日期 2026-09-19）：`ng-kano` T0＝`1789795800000`（05:30Z）。
- **決定性**：伺服器內所有隨機（網路 flaky 抽籤）用 `FarmLogic.makePrng(seed)`；bots 用固定延遲，不抽籤。同 seed＝同結果。
- 不得在任何地方用 `Math.random()`（Demo 面板的自動播放也不行）。

### 5.5 render 管線與流量約束

`state → view(JSON) → DOM`：每支手機一個 `render(phone)`；按鍵處理器只改 state 並 `scheduleRender(phone)`（`Promise.resolve().then(flush)` 合併，**一個按鍵至多一次 DOM 寫入**：用一次 `innerHTML=` 或 `replaceChildren`）。網路回應在 30 ms 內回來就**不畫「傳送中」**（先延遲 30 ms 再決定要不要畫載入狀態），所以 `ok` 網路下一鍵一次重繪。所有文字經跳脫函式（即使目前只有結構化輸入）。

---

## 6. 資料模型

> 金額＝**最小貨幣單位整數**（NGN：₦1；INR：paise）；重量＝**整數公克**；價格＝**每公斤的最小貨幣單位整數**；時間＝epoch ms。以下 `id` 是伺服器產生的字串。

```ts
type Role = 'S' | 'B';                       // Seller / Buyer
type Grade = 'A' | 'B' | 'C';                // A 最好
type Terms = { grams:int; priceMinorPerKg:int; grade:Grade; delivery:'pickup'|'deliver'; payment:string /*pack.payments[].id*/ };

interface User    { id; name; role:Role; marketId; stallCode:'4 碼'; rep:{deals,weighChecks,weighOk,onTime,ghosts}; smsOptIn:boolean; phone:string /*只存伺服器*/; lang?:'zh'|'en'; circle:string[] /*賣方：熟人買方 id*/ }

interface Listing { id; code:'5 碼(4+Luhn)'; sellerId; cropId; marketId /*取貨市場*/; containerId; qtyTenths:int; gramsPerContainer:int /*賣方當下的換算，快照*/;
                    grams:int; soldGrams:int; reservedGrams:int; askMinorPerKg:int; grade:Grade;
                    audience:'trusted'|'public'; trustedOnly:boolean; createdAt; confirmedAt /*租約心跳*/; expiresAt /*=confirmedAt+leaseMs(crop)*/;
                    status:'open'|'sold'|'expired'|'withdrawn'; passes:string[] /*「這次不要」的買方 id，只給賣方看人數*/; ver:int }
                    // remainingGrams = grams - soldGrams - reservedGrams（視圖裡帶出）

interface Want    { id; no:int; buyerId; cropId; marketId /*收貨市場*/; grams; remainingGrams; bidMinorPerKg /*賣方看到的是「願付價」*/; minGrade:Grade;
                    delivery; payment; createdAt; expiresAt; status:'open'|'filled'|'expired'|'withdrawn' }   // 買方私人上限不在這裡

interface Offer   { id:'o<no>'; no:int /*4 位單號，從 4821 起*/; listingId|null; wantId|null; sellerId; buyerId;
                    state:'AWAIT_SELLER'|'AWAIT_BUYER'|'ACCEPTED'|'DEALT'|'DECLINED'|'EXPIRED'; prevState; expiredReason:'respond'|'sheet'|null;
                    turn:int; maxTurns:5; proposal:{by:Role; terms:Terms; final:boolean; phraseId|null; at; respondBy};
                    history:Array<{turn; by:Role|'SYS'; action:'OFFER'|'COUNTER'|'ACCEPT'|'CONFIRM'|'DECLINE'|'REOPEN'|'EXPIRE'|'SEALED_DEAL'; terms?; phraseId?; final?; at; ver; changed?; reason?}>;
                    reopens:int; deal:null|Deal; declineBy:Role|null; gapBand:null|{level:'overlap'|'small'|'medium'|'large'; gapBps}; ver:int /*CAS*/ }
interface Deal    { terms:Terms; sheet:DealSheet /*FarmLogic.dealSheet 的結果，雙方看同一份*/; issuedAt; deadline /*+24h*/; acceptedBy:Role|'SYS'; confirm:{S:boolean;B:boolean}; code?:'6 碼=4 位單號+2 位驗證' }
interface RefTrade{ id; cropId; marketId; at; grams; grade; priceMinorPerKg; priceAEq /*A 級等值*/; sellerId; buyerId; counted:boolean /*同一對 7 天只計 1 筆；false 不進價帶*/; source:'deal'|'seed' }
interface Sealed  { offerId; round:1|2; S:null|{value:int; round}; B:null|{value:int; round}; status:'open'|'resolved'|'gap'|'nodeal'; result?:{price?:int; level?; gapBps?; canReseal?} }   // value 只存伺服器
interface Weigh   { offerId; round:int(1..3); S:null|int; B:null|int /*克*/; status:'open'|'green'|'yellow'|'red'; agreedGrams?:int; result?:WeighCompare }
interface Sms     { id; at; toUserId; toPhone; lang; body; state:'queued'|'delivered' }         // MVP：只進「電信層」面板
interface Event   { seq; at /*伺服器時間*/; kind:'req'|'state'|'sms'|'bot'|'clock'|'error'|'replay'; user?; text; method?; path?; status?; ms? }
interface OutboxItem { idemKey; method; path; body; createdAt; tries; label }                   // localStorage['oneslip:v1:<phone>:outbox']
```

**手機端狀態（`FarmApp.getState(phone)` 的來源）**：`{phone, userId, role, lang, size, packId, screen, stack[], focused, buffer, cursor, overlay, cache:{<key>:{data, fetchedAt, ver}}, net:{status:'ok'|'loading'|'error', lastSyncAt, stale, pending}, outbox[], unread, redraws, requests, limits{cropId→{limit,target}}, calib{containerId→grams}, settings{hc, smsOptIn}}`。

**索引/編號規則**：listing 序號從 7390 起（種子貨單佔 7390、7391），5 碼＝4 位序號＋Luhn 檢查碼（`makeListingCode(7392)==='73924'`）；offer 單號從 4821 起；成交碼 6 碼＝4 位單號＋`(no*37+11)%100` 兩位驗證（`dealCode(4821)==='482188'`）；want 單號從 12 起。

---

## 7. 公式與演算法（**與 `farm-logic.js` 逐條一致**；數值案例見 worked examples）

### 7.1 通則

- 除法一律 `roundDiv(n,d)`＝**四捨五入、0.5 遠離 0**（`floor((2|n|+d)/(2d))`，負數對稱）。沒有任何地方用 `Math.round` 或浮點乘除算金額。
- 邊界：`MAX_GRAMS=100,000,000`（100 噸）、`MAX_PRICE=10,000,000`（最小單位/公斤）→ 乘積 <2^53。超出回 `{ok:false,error:'BAD_GRAMS'|'BAD_PRICE'|'OVERFLOW'}`，**函式對「數值輸入」不丟例外**（傳 `null` 給必要的物件參數屬程式錯誤，可以丟 TypeError）。最小可交易量 `minGrams=1000`（1 kg）。
- 現金進位：`roundToStep(x, cashStep, 'nearest')`（half up）。NGN `cashStep=5`（₦5），INR `cashStep=100`（₹1）。**只有 `payment.cashRounding===true` 的付款方式（現金）才進位**，轉帳/錢包不進位。找零不進位。
- 顯示：`fmtMoney`（NGN `₦18,000`；INR 印度分組 `₹1,23,456.78`、整數不顯示 `.00`）、`fmtKg`（最多兩位小數、去尾零：1130→`1.13`）、時間 `fmtClock(ms, tzOffsetMin)`。

### 7.2 單位

- `containerGrams(pack, containerId, {marketId, cropId, heaped, calib})` 解析順序：**使用者校準（`calib[containerId]` 克）→ `byMarket[marketId]` → `byCrop[cropId]` → 預設 `grams`**；`heaped` 只在該筆有 `heapedGrams` 時生效（校準值不再套堆尖）。回 `{grams, source:'user'|'market'|'crop'|'default', approx, heaped}`。所有預設容器值標 `approx:true`＝畫面一律顯示「約」。
- **同名不同大小**：`mudu` 在 Kano（dawanau/sabongari）平口 1130 g、堆尖 1500 g；在 Kaduna 平口 565 g、堆尖 750 g（Kano mudu 約為 Kaduna 的兩倍，villagemath 摘要；Kaduna 值為推算，皆 **UNVERIFIED**；網路上另有 0.17/0.32 kg 的互相矛盾數字，**不使用**）。
- `toGrams(qtyTenths, gpc)`＝`roundDiv(qtyTenths*gpc,10)`（數量輸入一位小數＝十分之一容器）。`perKgFromPerContainer(p,gpc)`＝`roundDiv(p*1000,gpc)`；反向 `roundDiv(p*gpc,1000)`。
- `unitMismatch(pack, gpcS, gpcB, {qtyTenths, priceMinorPerKg})`：`diffBps=roundDiv((hi-lo)*10000, lo)`；`>1000`→`red`、`>200`→`yellow`、否則 `ok`；帶 `totalDiffMinor`（同量同價下兩種換算的總額差）。
- **談價一律以「公斤＋每公斤價」為準**（Terms 只有 grams/priceMinorPerKg）；容器只是輸入與顯示便利。這就是「單位握手」：任何一邊報「一袋 ₹600」都立刻換成 ₹12/kg。
- **單位陷阱偵測** `detectUnitSlip(pack,{cropId,marketId,typedMinor,refMid})`：對該作物每個非 kg 容器算 `expected=roundDiv(refMid*gpc,1000)`，若 `typed` 落在 `expected` 的 75%–125% 且 `typed>=2*refMid`，回 `{containerId, gramsPerContainer, impliedPerKgMinor}`；取最接近者。畫面：「像是每 quintal 的價？≈ ₹18.00/kg」。（Bihar：₹1,800 per quintal 與 ₹900 per bori 是同一個 ₹18/kg——本功能專打這個陷阱。）
- `magnitudeGuard(pack, price, refMid)`：`price>=5*refMid`→`high`；`price*5<=refMid`→`low`（含等號）；否則 `ok`；無參考價 `na`。畫面：整屏黃底「少/多一個零？」需 OK 才能送出。

### 7.3 總價、實收、找零

```
total          = roundDiv(grams * priceMinorPerKg, 1000)                      // lineTotal
amountDue      = payment.cashRounding ? roundToStep(total, cashStep,'nearest') : total
buyerFee       = feeOf(amountDue, payment.buyerFee)      // 買方多付
sellerFee      = feeOf(amountDue, payment.sellerFee, {bps:userFeeBps})   // 賣方少收
buyerPays      = amountDue + buyerFee
sellerGets     = amountDue - sellerFee
```

- `makeChange(paid, due, denominations)`：`paid<due`→`shortMinor=due-paid`；否則 `change=paid-due`，由大到小貪婪拆面額，**剩下湊不出的零頭放 `remainderMinor`**（例：INR 找 12,250 paise＝₹100＋₹20＋₹2＋剩 50 paise）。
- `basket(pack, lines, paymentId)`：各行 `lineTotal` 加總後才套用現金進位與手續費（**手續費看的是總額**——合併付款可能少付、也可能跨級）。

### 7.4 手續費與斷崖

`feeOf(amount, rule, {bps})`：`rule={tiers:[{upTo|null, fee}], addOn:[{from, fee}], percentBps, minFee, maxFee}`。tiers 取第一個 `amount<=upTo`（**上限含**）的 fee；`addOn` 在 `amount>=from` 時加上；`percentBps`（可被 `opts.bps` 覆蓋；奈及利亞錢包/代理費是**使用者自填**，預設 100 bps＝1% 僅為示意）；最後套 min/max。
NG 銀行轉帳（買方付；來源 CBN 收費指南**草案** 2026-04-21＋₦50 印花稅自 2026-01-01 對 ≥₦10,000 的轉出方；**是否定案 UNVERIFIED**）：`≤5,000→0；5,001–9,999→10；10,000–50,000→60；>50,000→100`。₦5,000 與 ₦50,000 邊界來源含糊，本包定為「上限含」。
`feeCliff(amount, rule, windowBps=300)` → `{above:{atOrBelow, reduceBy, saves}|null, below:{cliffAt, raiseBy, costs}|null}`：`above`＝金額剛好高於某斷崖（在 3% 內）時「再減 reduceBy 可少扣 saves」；`below`＝金額離上方斷崖 3% 內時「加 raiseBy 會多扣 costs」。畫面黃字提示（例：₦10,020→「減 ₦21 可少扣 ₦50」）。未來 Kenya 包（M-Pesa）可直接吃同一個 rule schema（附錄 C）。

### 7.5 運費、腐損、同一張成交單 `dealSheet`

```
km            = distanceKm(originMarket, buyerMarket)            // 對稱表；同市場 0；查無→UNKNOWN_MARKET_PAIR
freight       = km<=0 ? 0 : max(pack.freight.minMinor, roundDiv(grams*km*minorPerTonKm, 1_000_000))
freightPerKg  = roundDiv(freight(typicalLoad=500 kg, km)*1000, typicalLoad)        // 用於「別處」的估算
lossBps       = min(lossCapBps=3000, roundDiv(km*crop.lossBpsPer100km, 100))
lossGrams     = roundDiv(grams*lossBps, 10000)
pickup:  buyerFreight=freight, sellerFreight=0, sellable=grams-lossGrams      // 自取：運費與路途腐損由買方承擔
deliver: buyerFreight=0, sellerFreight=freight, sellable=grams               // 送到：賣方付運費；稱重在交貨點（腐損由秤貨吸收，不另算）
buyerLandedPerKg  = roundDiv((buyerPays + buyerFreight)*1000, sellable)      // 買方「落地價」＝每個可賣公斤的成本
sellerPocketPerKg = roundDiv((sellerGets - sellerFreight)*1000, grams)       // 賣方「落袋價」
readbackRequired  = floor(amountDue / minorPerMajor) >= pack.readbackMinMajor   // NG 50,000；IN 5,000
lastTwo           = pad2( floor(amountDue / minorPerMajor) % 100 )
```

`dealSheet` 另回 `cliff`（買方手續費規則的斷崖）、`magnitude`（若 ctx 帶 `refMid`）。**雙方看到的每一個數字都來自這個函式的同一份輸出（伺服器在 ACCEPT 時算好存進 `offer.deal.sheet`）**；編輯中的預覽由手機本機呼叫同一函式。範例（G1）：126 kg×₦455，現金自取，Dawanau→Sabon Gari＝總價 ₦57,330、運費 ₦3,000（最低運費）、腐損 42 bps＝529 g、買方落地價 ₦481/kg、賣方落袋價 ₦455/kg、需回讀、末兩碼 `30`。

### 7.6 參考價 `ReferencePrice`（共同價帶）

輸入：某作物×市場的成交紀錄 `trades`、外部源 `external`（`PriceSource`）、現在時間 `now`。**價格一律換成 A 級等值**再算（`priceAEq=roundDiv(price*10000, 10000+gradeBps[grade])`；B 級 −6%、C 級 −15% 為**估計**、可調）；畫面顯示某等級時再 `gradeAdjust` 回去。

1. **納入條件**：`t.cropId,marketId` 相同、`t.counted!==false`、`0 <= now - t.at < window`，`window = crop.refWindowDays × 86,400,000 ms`（易腐 3 天、其他 7 天）。
2. **權重（整數）**：`decay = max(50, 1000 - roundDiv(age*1000, window))`（線性衰減，窗內最低 5%）；`sizeKg = clamp(floor(grams/1000), 1, 100)`；`w = decay × sizeKg`。
3. **樣本夠**（納入筆數 `n >= 3`）：依 `priceAEq`（同價再依較新、再依 id）遞增排序，加權分位數 `q(num/den)`＝第一個使 `cumW×den >= totalW×num` 的價格：`mid=q(1/2)`、`low=q(1/5)`、`high=q(4/5)`。若某一買方 id 占總權重 >50%→`concentrated=true` 且 `low×0.95`、`high×1.05`（`roundDiv`）。回 `state:'deals'`、`asOf＝最新一筆時間`、`ageMs=now-asOf`。
4. **樣本不足**（`n<3`）：退回外部源 `state:'external'`：`mid=external.price`；`spread=8%`（`stale`時 ×2＝16%）；`low/high=roundDiv(mid×(1∓spread),10000)`；`dealsN=n`（畫面「(+2 筆成交)」）；`simulated=external.simulated`。
5. **都沒有** → `state:'none'`（畫面「資料太少」）。
6. **新鮮度** `freshnessOf(ageMs)`：`≤6h fresh(●)`、`≤72h aging(◐)`、`≤7d old(○)`、`>7d stale(✕)`。**精度隨年齡降低**（`displayPrice`）：fresh 顯示精確整數；aging 進位到 `display.agingStep`（NG ₦10、IN ₹1）並加「約」；old/stale 只顯示區間與日期（不顯示點值）。符號用**形狀**不只靠顏色。
7. **外部源（模擬 `MockPriceSource` = `externalPrice`）**：`price = roundToStep(roundDiv(series[6]×market.multBps, 10000), priceStep)`；`asOf = T0 - asOfAgoMin`；`trend7dBps=roundDiv((last-first)*10000, first)`。**正式版對映見 §16.3（標 VERIFIED/UNVERIFIED）。**
8. **寫回**：`DEALT` 時伺服器建 `RefTrade`（`marketId＝貨單取貨市場`）；**同一對 (seller,buyer) 在 `dedupePairDays=7` 天內只有第一筆 `counted=true`**（防互刷；只能降低不能根除）。事件流要顯示 `counted:false` 的理由。

### 7.7 退場價（外部選項）、私人限制、開價階梯、建議還價（**教練＝純函式＋本機資料**）

- `exitPriceSeller`（賣方在**其他市場**淨得，換算回取貨點的每公斤價）：
  ```
  gross_m = gradeAdjust(mid_m, grade)                      // mid_m＝該市場 ReferencePrice.mid（A 級基準）
  net0_m  = roundDiv(gross_m*(10000 - lossBps(km)), 10000) - freightPerKg(km)
  net_m   = roundDiv(net0_m*(10000 - exitFrictionBps), 10000)   // exitFrictionBps=500：時間/風險/場租的 5% 折扣，估計
  exit    = max over m != origin of net_m
  ```
- `exitPriceBuyer`（買方「別處買到手」，換算成**在本貨單市場的最高可付價**；買方自己的市場也算一個替代，km=0）：
  ```
  landed_m = roundDiv( roundDiv((gradeAdjust(mid_m)+freightPerKg(m→home))*10000, 10000-lossBps(m→home))*(10000+exitFrictionBps), 10000 )
  walk     = roundDiv(min(landed_m)*(10000-lossBps(origin→home)), 10000) - freightPerKg(origin→home)     // m != origin
  ```
- `defaultLimits`：賣方 `limit(底價)=roundUp(max(exit, band.low_gradeAdj), priceStep)`、`target=roundUp((mid+high)/2)`；買方 `limit(上限)=roundDown(min(walk, band.high_gradeAdj))`、`target=roundDown((low+mid)/2)`。**這些只是預設；使用者可在教練畫面改成自己的數字，只存本機。**
- `openingLadder(role, ref(已調品級), limit)`：買方 `[low, (low+mid)/2, mid]` 向下取 `priceStep` 並夾在上限內；賣方 `[high, (mid+high)/2, mid]` 向上取並夾在底價上；去重。
- `suggestCounter({role, myLast, theirLast, limit, target, turn, maxTurns, concessions})`：
  1. 對方價已優於我上次價或已達目標 → `accept(AT_TARGET)`；
  2. 在限制內且**這是最後機會**（`turn+1>=maxTurns`）→ `accept(LAST_TURN_OK)`；超出限制且最後機會 → `decline(BELOW_LIMIT_FINAL)`；
  3. 否則讓步：`concede=roundDiv(|myLast-theirLast| × ratios[concessions], 10000)`，`ratios=[5000,4000,3000,2500,2000]`（每次讓步遞減）；賣方向下取到 `priceStep` 的**上**倍數、買方向上取到**下**倍數；夾在限制；若結果不比對方價更好→`accept(MET_IN_MIDDLE)`；`reason=SPLIT|AT_LIMIT`；`markFinal=(AT_LIMIT 且 turn+1>=finalFromTurn)`。
  文案只寫「建議」；教練規則是經驗法則，**無實證**。
- `quoteVerdict({role,price,ref,grade})`（喊價檢查）：`position=below|inside|above`（相對調過品級的 `low/high`）、`signal`（賣方 below→caution、above→good；買方相反；inside→fair）、`vsMidBps`。

### 7.8 媒合排序

- **買方找貨** `rankListings(pack, buyer{marketId,payment,wantGramsByCrop}, listings, refsByCrop)`：對每張 `remaining>=1kg` 的貨單，以 `{grams=min(remaining, want), price=ask, grade=貨單品級, pickup, payment=buyer.payment||'cash'}` 算 `dealSheet`（origin＝貨單市場、buyerMarket＝買方市場）；`anchor = roundDiv(gradeAdjust(ref_at_buyer_market.mid, grade) × (10000+resaleUpliftBps), 10000)`（`resaleUpliftBps=500`：批發轉零售加成，**估計、可調**）；`margin = anchor − buyerLandedPerKg`。排序：`margin` 大→小（無參考價者排最後）→`confirmedAt` 新→舊→`id`。
- **賣方誰要買** `rankWants`：以 `{grams=min(want.remaining, 賣方庫存), price=bid, grade=minGrade, delivery, payment=want.payment}` 算 `sellerPocketPerKg`，大→小、同值先掛單者先；`belowBandBps`＝bid 低於（調品級後）價帶下緣的比例，**中性標示**（不寫「壓價」）。
- **可見性** `visibleTo(listing, buyerId, circleIds, now)`：`status==='open'`、`now<expiresAt`；`audience==='public'` 或買方在賣方熟人圈，或（非 `trustedOnly` 且 `now>=createdAt+trustedWindowMin(30)`）。
- `rankOfOffer(myPrice, otherPrices)`＝`1+其他價高於我的數量`（買方只看到「你排第 r/n」）。

### 7.9 封存議價（P1）與雙盲秤貨（P1）

- `blindResolve({floor, ceiling, round})`：`ceiling>=floor`→成交，`mid=roundDiv(floor+ceiling,2)`，**進位到 `priceStep` 最近倍數再夾回 `[floor,ceiling]`**；否則 `gapBps=roundDiv((floor-ceiling)×10000, floor)`，`level=small(<5%)|medium(<15%)|large`，`canReseal = small && round<2`。重封只准往對方方向讓步且最多 5%：`resealBounds`（賣方 `[ceil(prev×0.95), prev]`、買方 `[prev, floor(prev×1.05)]`）。
- 誠實說明（教學屏）：理論上雙方會策略性謊報（Chatterjee–Samuelson），會漏掉差距小的交易，效率數字是推算未實測；**成交價是中點，可反推對方底價**；封存值必須存伺服器（信任錨），正式版需隱私說明。
- `weighCompare({a,b,priceMinorPerKg})`：`avg=roundDiv(a+b,2)`、`diffBps=roundDiv(|a-b|×10000, avg)`；`≤100→green`（採平均）、`≤300→yellow`（顯示差幾公斤＝多少錢）、`>300→red`（重秤，最多 2 次）。只宣稱「兩份獨立讀數」，兩人讀同一把假秤抓不出來。

### 7.10 其他純函式

- **履約點** `reputationView(pack, stats)`：`deals<5`→`{kind:'new', n}`（「新・3 筆」）；否則三點 `weigh=weighOk/weighChecks`、`time=onTime/deals`、`kept=(deals-ghosts)/deals`（四捨五入 %），`>=90→full ●`、`>=70→half ◐`、否則 `empty ○`；`weighChecks=0`→`na`。文案不可指控（「量準 78%」是自己的數據，不寫「愛少秤」）。
- **短語**：`phrasesFor(pack, role, turn)`（P09「最後價」只在 `turn+1>=3` 時可選）、`renderPhrase(id, lang)`（未知 id→`#17（更新後可見）`/`#17 (update to view)`）、`phraseRefCheck({role, price, exitMinor, freshness})`→`supports|unsupported|stale`（P05「別處價格更好」的**行情查核章**：只用公開價帶）。
- **敲門簡訊** `knockAllowed({times, now, lastKnockVer, offerVer})`：同一狀態版本只發一則、每單每 24h 最多 3 則。
- **編碼**：`luhnCheckDigit`、`makeListingCode`、`verifyListingCode`（單碼輸入錯 3 次鎖定由伺服器負責）、`dealCode`、`parseDealCode`。
- **輸入緩衝** `bufferPush(buf,key,{maxLen,maxDecimals})`/`bufferValue(buf,decimals)`：`*`＝小數點（內部存 `.`，空緩衝按 `*` 得 `0.`）；無前導零（`0` 再按 `5`→`5`，`0` 再按 `0` 維持 `0`）；超過小數位/長度忽略；`BACK` 刪一位。
- **版面檢查** `cellWidth`（CJK/全形/箭頭/幾何符號/`…`＝2；`A-Z@%&`＝1.4；天城文 1.2；其餘 1）、`truncateCells`、`viewLint(view,size)`（列數、寬度、`undefined|NaN|Infinity|[object|{{` 文字）。

---

## 8. Offer 狀態機（`FarmLogic.applyAction`；伺服器只是呼叫它並存檔）

### 8.1 狀態與規則

| 狀態 | 意義 | 誰能動 |
|---|---|---|
| `AWAIT_SELLER` / `AWAIT_BUYER` | 等該方回應（提案者是另一方） | 被等的一方：`COUNTER`/`ACCEPT`；任一方：`DECLINE` |
| `ACCEPTED` | 已出成交單、庫存已保留；接受方已自動確認 | 尚未確認的一方：`CONFIRM`/`DECLINE`；到期→`EXPIRED(sheet)` |
| `DEALT` | 雙方確認；伺服器寫入 `RefTrade` | 終態 |
| `DECLINED` | 「先不用」（沒有敵意的「拒絕」）；帶 `gapBand`（差距小/中/大） | 終態 |
| `EXPIRED` | 期限到（`respond`）或成交單 24h 未確認（`sheet`） | `REOPEN`（每單一次） |

- **回合**：`turn` 為已提出的提案數（`OFFER`＝1）。`maxTurns=5`：第 5 個提案**自動是最後價**（`final=true`）；提案者可在 `turn+1>=finalFromTurn(3)` 時主動標 `final`；`final` 之後對方只能 `ACCEPT`/`DECLINE`。
- **一次最多改兩格**：`COUNTER` 的新 `terms` 與 `proposal.terms` 比較五格（grams/price/grade/delivery/payment），改 0 格→`NO_CHANGE`、>2 格→`TOO_MANY_FIELDS`。（短語不算一格。）
- **期限**：`respondBy = at + respondMs(crop)`，易腐 120 分、一般 12 小時、耐放 48 小時；**只在打開/送出時判定**（`now > respondBy` 才算逾期；剛好等於不算），不做跳動倒數。逾時由伺服器 `tick` 或 `expireIfDue` 轉 `EXPIRED`。
- **成交單**：`ACCEPT` 時 `dealSheet` 必須 ok；`readbackRequired` 時 `last2` 必須等於 `sheet.lastTwo`（缺→`READBACK_REQUIRED`，錯→`READBACK_MISMATCH`）；`CONFIRM` 同理。**接受方在 ACCEPT 就算確認過**（不必再按一次）。成交單 TTL＝24 小時（`sheetTtlHours`）。
- **庫存**：`ACCEPT` 時 `grams<=remainingGrams`，否則 `OVER_STOCK`；效果 `RESERVE_STOCK`；`EXPIRE(sheet)`/`DECLINE(ACCEPTED)` 效果 `RELEASE_STOCK`；`CONFIRM→DEALT` 效果 `RECORD_TRADE`（伺服器把 reserved 轉 sold）。
- **CAS**：每個指令帶 `baseVer`；不等於現況→`STALE_VERSION`（回應帶最新 offer 視圖，UI 顯示「對方剛改過，已更新」）。**冪等**：`Idempotency-Key` 相同→回放第一次的結果（`replayed:true`），不重複套用（保存 24 小時）。
- `REOPEN`：`EXPIRED` 且 `reopens<maxReopens(1)` 且貨單仍開；`respond`→回到 `prevState` 並重設期限；`sheet`→回 `ACCEPTED`（確認保留、重新保留庫存，庫存不足→`OVER_STOCK`）。
- `SEALED_DEAL`（系統指令，`by:'SYS'`，僅封存議價重疊時用）：`AWAIT_*`→`ACCEPTED`，價格＝中點，**雙方都還沒確認**（都要在成交單上按確認/回讀）。
- 誰動誰：`OFFER` 由買方（從貨單/「照價要」）或賣方（從訂單釘認領）建立；伺服器規則：封存議價 `open` 期間拒絕 `COUNTER`/`ACCEPT`（`SEALED_OPEN`），`DECLINE` 仍可。

### 8.2 轉移表（✓＝合法；其餘回錯誤碼）

| 指令 \ 狀態 | 無 | AWAIT_x（我被等） | AWAIT_x（我在等） | ACCEPTED | DEALT/DECLINED | EXPIRED |
|---|---|---|---|---|---|---|
| OFFER | ✓→AWAIT_對方 | `ILLEGAL_STATE` | 〃 | 〃 | 〃 | 〃 |
| COUNTER | `NOT_FOUND` | ✓（驗五格/≤2格/回合/final） | `NOT_YOUR_TURN` | `ILLEGAL_STATE` | `ILLEGAL_STATE` | `EXPIRED` |
| ACCEPT | `NOT_FOUND` | ✓→ACCEPTED（回讀/庫存） | `NOT_YOUR_TURN` | `ILLEGAL_STATE` | `ILLEGAL_STATE` | `EXPIRED` |
| CONFIRM | — | `ILLEGAL_STATE` | 〃 | ✓（未確認方；已確認→`ALREADY_CONFIRMED`） | `ILLEGAL_STATE` | `EXPIRED` |
| DECLINE | — | ✓→DECLINED（帶 gapBand） | ✓（＝撤回） | ✓ 僅未確認方（接受方→`ILLEGAL_STATE`） | `ILLEGAL_STATE` | `EXPIRED` |
| REOPEN | — | `ILLEGAL_STATE` | 〃 | 〃 | 〃 | ✓ 一次（否則 `REOPEN_LIMIT`/`LISTING_CLOSED`） |

其他錯誤碼：`BAD_ACTOR`、`BAD_TERMS/BAD_GRAMS/BAD_PRICE/BAD_GRADE/BAD_DELIVERY/BAD_PAYMENT`、`GRADE_NOT_OFFERED`（提案品級比貨單宣稱的更好）、`FINAL_LOCKED`、`FINAL_TOO_EARLY`、`MAX_TURNS`、`UNKNOWN_ACTION`。每個轉移都有 worked example（含非法轉移，非法時**狀態不變**）。

### 8.3 `gapBand`

`gapBps=roundDiv((sellerLast-buyerLast)×10000, sellerLast)`；賣方沒提過價則以貨單要價為賣方價；`buyerLast>=sellerLast`→`overlap`；`<500 bps small`、`<1500 medium`、其餘 `large`。UI 文案「差 8%，可再談」，**不出現「拒絕」**。

---

## 9. Transport / MockServer（`<script id="farm-transport">`）

### 9.1 伺服器內部狀態與生命週期

```
S = { seed, packId, clock:{mode:'manual'|'real', now, t0}, network:{mode:'ok'|'flaky'|'down', latencyMs, okPct, failPct, timeoutAfterApplyPct, timeoutMs},
      users{}, listings{}, wants{}, offers{}, trades[], sealed{}, weigh{}, idem{'<userId>|<key>':{status,body,at}},
      counters{listingSeq:7390, offerNo:4821, wantNo:12, tradeSeq, eventSeq}, sms[], events[], botQueue[], passes{}, knocks{offerId:[times]}, lastSeen{'<userId>|<offerId>':ver}, inboxVer{userId:int},
      flags{bots:true, musaInCircle:true} , prng }
```

- `reset(seed=1, {packId})`：以 `FarmData.packs[packId].seed` 重建全部狀態（種子使用者、熟人圈、種子成交→`RefTrade(source:'seed')`、種子貨單、種子訂單、bots 設定），時鐘設為 T0，`counters` 歸位，事件流清空並寫第一筆 `state: reset seed=1 pack=ng-kano`。**同時**清掉兩支手機的 `oneslip:v1:*` localStorage 私人資料並讓手機回到 `home`（保留各機的語言與尺寸）。`reset` 同步回傳（`FarmApp.server.reset(seed)`）。
- `tick(now)`：**每個請求處理前、以及每次 `advance` 後**執行一次：①所有 offer 跑 `expireIfDue`（效果 `RELEASE_STOCK`；`EXPIRE(sheet)` 時對「沒確認的一方」`ghosts+1`）；②貨單租約到期→`status:'expired'`；③訂單釘到期→`expired`；④處理 `botQueue` 中 `dueAt<=now` 的項目（依 `dueAt`、`seq` 排序）；⑤每個有變動的 offer 讓雙方 `inboxVer+1`。
- `advance(ms)`：`clock.now += ms` → `tick`。Demo 列提供 **+30 分、+2 小時、+1 天**。

### 9.2 身分

`request.userId`（Demo：手機 A/B 各綁一個 user；正式版＝Bearer token，由 SMS OTP 換得）。伺服器**只回該使用者有權看的視圖**；跨人資料（電話、封存值）永不出現在回應。

### 9.3 端點（HTTP 狀態碼語意：200/201 成功、304 未變動、404、403、409 狀態衝突、422 輸入不合、429 頻率限制、503 忙碌）

| 方法 路徑 | 請求 body / query | 成功回應 | 主要錯誤 |
|---|---|---|---|
| `POST /session` | `{packId}` | `200 {user, packVersion, now}` | `404 UNKNOWN_PACK` |
| `GET /pack/:id` | — | `200 {pack}`（`ETag`＝`pack.version`；手機以 `If-None-Match` 快取）。**MVP：UI 直接讀 `FarmData.packs[packId]`**（同一頁面內、不必打 API）；MockServer 仍實作此端點以維持與正式版一致的介面 | 404 |
| `GET /home` | — | `200 {ver, turn:int, confirm:int, unreadInbox:int, leaseAlerts:[{listingId,code,leftMs}], serverNow}` | — |
| `GET /ref?crop=&market=` | — | `200 {ref:ReferencePrice, external:{price,asOf,label,simulated,series[7],trend7dBps}, dealsN}`（`ETag`） | 404 |
| `GET /listings?view=match&crop=<id\|all>` | — | `200 {ver, items:[ListingView]}`（已套 `visibleTo`；**排序由手機用 `rankListings` 做**） | — |
| `GET /listings?view=mine` | — | `200 {ver, items:[ListingView(含 offersCount, passes 人數)]}` | — |
| `POST /listings` | `{cropId, containerId, qtyTenths, gramsPerContainer, grams, askMinorPerKg, grade, audience, trustedOnly?}`＋`Idempotency-Key` | `201 {listing, circleAsked:n}` | 422 `BAD_*`；429 |
| `POST /listings/:id/renew` | `{mode:'full'\|'partial'\|'sold', remainingGrams?}` | `200 {listing}`（`full`＝`confirmedAt=now, expiresAt=now+lease`） | 403/409 |
| `DELETE /listings/:id` | — | `200`（`status:'withdrawn'`；有 ACCEPTED 的 offer 則 409） | 409 |
| `POST /passes` | `{listingId}`（買方「這次不要」） | `200`（賣方看到「N 位熟人不要」） | — |
| `GET /wants?crop=<id>` | — | `200 {ver, items:[WantView]}`（賣方看：全部開放中；`bidMinorPerKg` 是「願付價」） | — |
| `GET /wants?mine=1` | — | `200 {ver, items}` | — |
| `POST /wants` | `{cropId, marketId, grams, bidMinorPerKg, minGrade, delivery, payment, ttlHours(24\|72\|168)}` | `201 {want}` | 422 |
| `DELETE /wants/:id` | — | `200` | 403 |
| `POST /offers` | `{listingId? \| wantId?, terms, phraseId?}`（呼叫者的角色決定 `by`；買方對貨單＝`by:B`，賣方認領訂單釘＝`by:S`；`照價要`＝terms 等於貨單） | `201 {offer:ThreadView}` | 422、409 `OVER_STOCK`/`SOLD_OUT`/`LISTING_CLOSED`、403 |
| `GET /inbox?since=<ver>` | — | `200 {ver, threads:[ThreadSummary]}`；`ver` 相同→`304`（**版本沒變不重繪**） | — |
| `GET /offers/:id` | — | `200 {offer:ThreadView}`（同時更新 `lastSeen`＝未讀歸零） | 404/403 |
| `POST /offers/:id/act` | `{type:'COUNTER'\|'ACCEPT'\|'CONFIRM'\|'DECLINE'\|'REOPEN', baseVer, terms?, phraseId?, final?, last2?}`＋`Idempotency-Key` | `200 {offer, event, refUpdate?:{counted, reason?}}` | 409 `STALE_VERSION`（body 帶最新 offer）、409/422 引擎錯誤碼（§8.2） |
| `POST /offers/:id/knock` | — | `200 {sent:boolean, remaining, reason?:'SAME_STATE'\|'DAILY_LIMIT'\|'NOT_OPTED_IN'}` | 429 |
| `POST /offers/:id/seal` | `{value}`（P1） | `200 {sealed: SealedView}`；雙方都封存後回結果 | 409 `ALREADY_SEALED`/`ILLEGAL_STATE`、422 超出重封範圍 |
| `POST /offers/:id/weigh` | `{grams}`（P1；僅 `DEALT`） | `200 {weigh: WeighView}` | 409、422 |
| `POST /offers/:id/contact` | `{action:'request'\|'consent'\|'decline'}`（P2） | `200 {contact:{state, number?}}`（雙方同意前 `number` 永遠不在回應裡） | — |
| `GET /circle` · `POST /circle` | `{stallCode}`（P2：加熟人；MVP 對方自動同意） | `200 {members:[{id,name,rep:RepView}]}` | 404 |
| `GET /users/:id/rep` | — | `200 {rep:RepView}` | — |
| （Demo 管理，**不在手機側出現**）`POST /_admin/advance {ms}`、`POST /_admin/reset {seed,packId}`、`POST /_admin/network {mode,opts}`、`POST /_admin/flags {bots?,musaInCircle?}`、`GET /_admin/state`、`GET /_admin/events?since=seq`、`POST /_admin/sms/:id/deliver` | | | |

錯誤 body：`{error:'CODE', message?, offer?:ThreadView}`。**錯誤碼→文字**走 i18n `e.<CODE>`。HTTP 對映：`STALE_VERSION、NOT_YOUR_TURN、ILLEGAL_STATE、EXPIRED、ALREADY_CONFIRMED、OVER_STOCK、SOLD_OUT、LISTING_CLOSED、REOPEN_LIMIT、FINAL_LOCKED、MAX_TURNS、SEALED_OPEN、ALREADY_SEALED`→409；`BAD_*、TOO_MANY_FIELDS、NO_CHANGE、GRADE_NOT_OFFERED、READBACK_MISMATCH、READBACK_REQUIRED、FINAL_TOO_EARLY、UNKNOWN_CONTAINER`→422。

### 9.4 視圖（projection）——**手機只拿得到這些**

```ts
ListingView { id, code, sellerId, sellerName, sellerRep:RepView, cropId, marketId, containerId, qtyTenths, gramsPerContainer, grams, remainingGrams,
              askMinorPerKg, grade, audience, createdAt, confirmedAt, expiresAt, status, offersCount?/passesCount?（僅賣方本人）, inCircle:boolean }
WantView    { id, no, buyerName, buyerRep, cropId, marketId, grams, remainingGrams, bidMinorPerKg, minGrade, delivery, payment, createdAt, expiresAt }
ThreadSummary { id, no, counterpartyName, cropId, priceMinorPerKg, grams, state, myTurn:boolean, needsMyConfirm:boolean, respondBy, ver, unread:boolean }
ThreadView  { id, no, listingId, wantId, cropId, originMarketId, buyerMarketId, myRole:Role, counterparty:{id,name,rep:RepView}, state, turn, maxTurns,
              proposal:{by, terms, final, phraseId, at, respondBy}, history[], deal:null|{terms, sheet, confirm:{me,other}, deadline, code?},
              gapBand, rank:null|{rank,of} /*僅買方*/, sealed:null|{status, round, mine:'none'|'sealed', theirs:'none'|'sealed', result?}, weigh:null|{status, mine:boolean, theirs:boolean, result?},
              knockRemaining, ver, serverNow }
RepView     { kind:'new'|'ok', n, dots?:[{key:'weigh'|'time'|'kept', pct, level:'full'|'half'|'empty'|'na'}] }
```

**永遠不出現在任何視圖**：對方的封存值、雙方電話（`contact` 兩邊同意前）、對方的私人底價/上限（伺服器根本沒有）、買方的 `smsOptIn` 細節、他人的收件匣。`sealed.result` 只在雙方都封存後出現（成交時僅含中點價；沒重疊時只含 `level/gapBps/canReseal`）。**驗收 I-02：對兩支手機各做一次 `GET /offers/:id`，掃 JSON 找不到對方的 `value`。**

### 9.5 冪等、版本與快取

- **寫入**（`POST /listings`、`/offers`、`/offers/:id/act`、`/renew`、`/seal`、`/weigh`）必帶 `Idempotency-Key`（手機產生：`<phone>-<counter>-<hash>`）；伺服器存 24 小時。同 key 重送：回放第一次的**同一份回應**，`replayed:true`，事件流記 `kind:'replay'`；**不重複套用**。
- **讀取**：`/inbox` 用 `ver`（每位使用者的單調整數）；`/ref`、`/pack` 用 `ETag`。手機帶 `since`/`If-None-Match`，未變動→`304`，UI **不重繪**，只更新「更新於 hh:mm」。
- **CAS**：`act` 的 `baseVer`；衝突→409 `STALE_VERSION` 並帶最新視圖，UI 顯示一行「對方剛改過，已更新」，回到該張卡（不必重打）。

### 9.6 網路模式（混亂面板）

`FarmApp.server.setNetwork(mode, opts?)`，`mode∈{'ok','flaky','down'}`：

| 模式 | 行為 |
|---|---|
| `ok` | 延遲 0：回應在 microtask 內 resolve（不用 `setTimeout`）。**一鍵一次重繪** |
| `flaky` | 每個請求延遲 `latencyMs`（預設 400）；再用 `prng()` 抽籤：`<okPct(60%)`→正常；`<okPct+failPct(20%)`→回 `503 SERVER_BUSY`（**未套用**）；其餘 20%→**已套用**但等 `timeoutMs`（2000）後對手機 reject `TIMEOUT`（示範冪等：重送同一 key 得到 `replayed:true`）。`opts` 可覆蓋各值（測試用小值） |
| `down` | 延遲 200 ms 後對手機 reject `NETWORK_DOWN`，**伺服器不套用** |

手機端處理（**所有寫入與讀取都要有**）：
- **讀取失敗**：保留快取資料，畫面顯示 `⚠ 連不上・OK 重試`；無快取則整屏空狀態「連不上 · OK 重試 · 返回」；資料年齡超過 30 分（伺服器時鐘）加「資料已 N 小時（舊）」，年齡用 `agoParts`。
- **寫入失敗**：先寫進 `outbox`（localStorage，附 `idemKey`），畫面顯示 `⚠ 沒送出 · OK 重送 · 返回 取消`；OK→用**同一個 idemKey** 重送；成功後顯示「已收到 #4821」。**沒電/關機/拔電池後重開**：首頁頂端橫幅「有 1 件未送出，OK 重送」，**由使用者按 OK 才重放**（誠實承認無背景執行）。
- **載入狀態**：先等 30 ms，仍未回才顯示靜態「傳送中…/讀取中…」（**沒有轉圈動畫**）。
- **拔電池 A/B**（Demo 列）：清掉該手機的記憶體狀態（stack、cache、buffer、overlay、net），保留 localStorage，重新走啟動流程到 `home`。驗收 J-04。

### 9.7 Bots（模擬買賣方；`flags.bots=false` 可關；事件流一律標「模擬買方 <名字>」）

全部用伺服器虛擬時鐘與固定延遲（無亂數）。行為在 `tick` 中觸發：

| bot（NG 包） | 觸發 | 行為 |
|---|---|---|
| `u_hauwa` bidder（熟人） | 對「她有興趣的作物」（tomato/pepper）且對她可見的新貨單，`createdAt + 12 分` | 建立 offer：`price = roundToStep(roundDiv(ask×9200,10000), priceStep, 'down')`（470→₦430）、`grams=min(remaining, 60 kg)`、grade＝貨單、自取、現金、短語 P01 |
| 〃 回應賣方還價 | 賣方 `COUNTER` 後 5 分 | 還價價 `<= maxPrice = roundToStep(roundDiv(ask×9600,10000),priceStep,'down')`（470→₦450）→ `ACCEPT`（帶正確 `last2`）；否則在 `maxPrice` 還一次；再不行 `DECLINE`。賣方接受其提案 → 5 分後自動 `CONFIRM` |
| `u_ibrahim` passer（熟人） | 對 tomato 貨單，`createdAt + 20 分` | 寫入 `passes`（賣方看到「1 位熟人這次不要」），不建 offer |

種子賣方（`s_kabir`、`s_halima`）與種子買方（`u_kresto`、`b_*`）**不主動行動**（只是資料）。IN 包同構（`u_meena` bidder、`u_rakesh` passer）。

### 9.8 簡訊敲門與「電信層」（平台外通道，MVP 只模擬）

- 伺服器在**輪到對方**的狀態轉移（`OFFER/COUNTER/ACCEPT`）後，若對方 `smsOptIn` 且 `knockAllowed`，就產生 `Sms{state:'queued'}`；`POST /offers/:id/knock` 是手動「敲一下」。內文（依收件人語言）：`OneSlip：單 #4821 有新動作，請打開 App 輸入 4821。簡訊內的連結請勿點。`——**不含價格、姓名、連結**。
- **電信層面板**（Demo，位於兩支手機之間）：列出每則簡訊全文、收件人、時間、狀態；按 [模擬收到] 才把手機外框的信封角標 +1（明示這是**平台外通道**，Cloud Phone 沒有推播，簡訊也不會在 App 內出現）。誰付費、sender ID、退訂規範、按鍵機是否收得到皆**未證實**（§16）。
- 聯絡揭露（P2）：P12「請打電話給我」→ `contact request`；對方 `consent` 後才回 `number`；手機先 `await navigator.hasFeature('TelScheme')`（`try/catch`），true→「OK 撥打」，false→大字顯示號碼＋「請抄寫，10 分鐘後隱藏」。

### 9.9 履約點更新（伺服器）

`DEALT`：雙方 `deals+1`、`onTime+1`；`EXPIRE(sheet)`：沒確認的一方 `ghosts+1`；秤貨完成：雙方 `weighChecks+1`，`green` 時雙方 `weighOk+1`。**同一對 7 天只計 1 次履約點**（與行情去重同一規則）。

### 9.10 S1 事件序列（事件流面板必須能看到的東西；`bots` 開、時鐘不快轉）

```
06:30 SRV  state   reset seed=1 pack=ng-kano
06:30 A    req     POST /session 200
06:30 A    req     POST /listings 201  → L7392 code=73924 (open, trusted, circleAsked=3)   ┐ 手機 A：貼單
06:30 SRV  state   listing 73924 tomato 126kg ask ₦470 A trusted-window until 07:00        ┘
06:30 B    req     GET /listings?view=match&crop=all 200 (2 items)                           ← 買方找貨（熟人先看）
06:30 B    req     POST /offers 201  → o4821 AWAIT_SELLER (₦440 P01)                         ┐ 手機 B：出價
06:30 SRV  state   offer#4821 ∅ → AWAIT_SELLER (OFFER by B)                                  │
06:30 SRV  sms     queued → u_amina "OneSlip：單 #4821 有新動作…" (平台外，需 [模擬收到])    ┘
06:30 A    req     GET /inbox 200 ver=3                                                      ← 賣方「打開才看到」
06:30 A    req     GET /offers/o4821 200
06:30 A    req     POST /offers/o4821/act COUNTER 200 (₦455)                                 ┐ 手機 A：還價
06:30 SRV  state   offer#4821 AWAIT_SELLER → AWAIT_BUYER (COUNTER by S, turn 2)              │
06:30 SRV  sms     queued → u_musa "…"                                                        ┘
06:30 B    req     GET /inbox 200 · GET /offers/o4821 200
06:30 B    req     POST /offers/o4821/act ACCEPT last2=30 200                                ┐ 手機 B：接受
06:30 SRV  state   offer#4821 AWAIT_BUYER → ACCEPTED (sheet ₦57,330, stock reserved 126kg)   ┘
06:30 A    req     POST /offers/o4821/act CONFIRM last2=30 200                               ┐ 手機 A：確認
06:30 SRV  state   offer#4821 ACCEPTED → DEALT                                               │
06:30 SRV  state   trade t9 tomato@dawanau ₦455 126kg counted=true → ref n=4→5 mid ₦450→₦455 ┘
```

（時間欄是伺服器**虛擬時間**：黃金路徑不快轉，所以全部停在 06:30；事件流以 `seq` 排序。若中途按「快轉」，時間欄與各筆期限會照虛擬時鐘變動。）

### 9.11 `FarmApp.server` 對映

`getState()`＝`JSON.parse(JSON.stringify(S))` 去掉 `prng` 與函式（含 `users[].phone`、`sealed` 原值——這是**伺服器**視角）；`reset(seed)`；`setNetwork(mode, opts)`；額外（測試可用、非必要）：`advance(ms)`、`now()`、`setBots(bool)`、`setMusaInCircle(bool)`、`events(sinceSeq)`。

---

## 10. 手機 UI（`<script id="farm-ui">`）

### 10.1 按鍵正規化（`normalizeKey(e)`；桌機與實機同一條路）

測試 harness（`tests/lib.mjs`）在 `document.body` 上依序送 `keydown`＋`keyup`，事件只有 `key`、`keyCode`、`which`（**沒有 `code`**），`SoftLeft/SoftRight` 的 `keyCode` 是 0。監聽 **`keydown`**（`document` 上，`e.repeat` 保留給連按），依序判斷（先到先贏）：

| 邏輯鍵 | 條件 |
|---|---|
| `STAR` | `e.key==='*'` 或 `keyCode∈{106,170}` 或 `e.code==='NumpadMultiply'`（必須早於數字判斷，因為 Shift+8 的 `keyCode` 是 56） |
| `OK` | `e.key==='Enter'` 或 `keyCode===13` |
| `UP/DOWN/LEFT/RIGHT` | `e.key` 為 `ArrowUp/Down/Left/Right` 或 `keyCode` 38/40/37/39 |
| `LSK` | `e.key∈{'Escape','SoftLeft'}` 或 `keyCode===27` |
| `RSK` | `e.key∈{'Backspace','SoftRight'}` 或 `keyCode===8`；另外 `window.addEventListener('back', e=>{ if(onBack(focusPhone)) e.preventDefault(); })`（回傳 true＝已處理，否則放行給平台，在 Demo 裡放行＝什麼都不做） |
| 數字 `0–9` | `e.key` 為 `0–9`，或 `keyCode` 48–57/96–105；**`keyCode===51`（含 `e.key==='#'`）一律當 `3`——`#` 沒有獨立功能** |
| `Tab`（僅桌機） | 切換焦點手機（`preventDefault`）；不進入手機邏輯 |
| 其他 | 忽略；`ctrlKey/metaKey/altKey` 一律不處理、不 `preventDefault`（讓瀏覽器快捷鍵正常） |

已處理的鍵 `preventDefault()`。**兩支手機的鍵盤路由**：`document` 上單一監聽器，依 `FarmApp` 的「目前焦點手機」分派；點擊某支手機外殼或按 `Tab` 切換；焦點手機有 **3 px 亮黃外框**與外殼標籤「⌨ 鍵盤在此」。`FarmApp.focus('B')` 直接設定。無焦點手機時（如單機模式隱藏了 B）按鍵給可見的那支。

桌機鍵盤對應（給人手操作，寫進 README 與 Demo 面板說明）：`Enter`＝OK、方向鍵、`0–9`、`*`＝`Shift+8` 或數字鍵盤 `*`、`Esc`＝LSK、`Backspace`＝RSK、`Tab`＝切換手機。每支手機下方另有可點擊的 12 鍵＋方向＋軟鍵**虛擬鍵盤**（呼叫同一個 `dispatch(phone, logicalKey)`；P1）。

**防連按**：預設關閉（`settings.antiTapMs=0`）；400 ms 門檻**未經實機驗證**（雲端渲染往返會讓門檻失準），只作為設定選項保留，不作為安全機制——真正的守門是「回讀末兩碼」與「位數守門」。

### 10.2 導覽模型

- 每支手機有 `stack:[{screen, params, state}]`；`push`、`replace`（換掉頂端）、`reset(home)`、`pop`。`home` 是根。
- **RSK 規則（`onBack`）**：①有 overlay（選單/確認/守門）→ 關閉 overlay；②有數字緩衝區且非空 → 刪一位；③畫面在子模式（如 sheet 的回讀輸入）→ 退出子模式；④`pop`；⑤在 `home` → 無動作（顯示一行「(實機：離開 App)」，**Demo 中絕不 `window.close()`**）。
- **深度上限**：從任一畫面（含子模式）連按 RSK **至多 3 次**回到 `home`（keypad-flow 驗證者會 BFS 驗證，並用全部 21 個 harness 鍵測每個畫面不會死路/卡輸入框）。做法：精靈壓成「作物格→表單→確認」三層；`sheet` 用 `replace` 取代 `thread`；`editOffer`／照價要／認領送出後堆疊重設為 `[home, inbox, thread]`；`postDone`、`wantDone` 之後 `reset` 成 `[home, done]`。
- 重新進入畫面時還原焦點列（記在 `state.cursor`）。焦點永遠只有一個。
- **overlay 種類**：`menu`（LSK；項目編號 1–9 **固定不隨情境重排**，此刻不適用的項目反灰且不可選，數字直選、↑↓＋OK、LSK 或 RSK 關閉；例：`editOffer` 選單第 4 項永遠是「送出」）、`confirm`（兩行問句，OK＝是、RSK＝否）、`guard`（整屏黃底警示，OK＝仍要送、RSK＝回去改）、`failure`（寫入失敗：OK 重送、RSK 取消）。狀態列（toast）不是 overlay：只是內容區底部一行，**不設計時器**，下一次狀態改變就換掉。
- 「無效鍵」：什麼都不做（不震動、不報錯）；只有明確的 UX 訊息才顯示一行（例如「一次最多改兩格」）。

### 10.3 版面與 view model

尺寸表（`FarmData.sizes`）：

```json
{
 "240x320": {
  "w": 240,
  "h": 320,
  "cols": 26,
  "rows": 12,
  "font": 16,
  "lineH": 22,
  "pad": 8,
  "titleH": 26,
  "softH": 26
 },
 "128x160": {
  "w": 128,
  "h": 160,
  "cols": 17,
  "rows": 8,
  "font": 12,
  "lineH": 16,
  "pad": 4,
  "titleH": 16,
  "softH": 16
 }
}
```


- **`cols/rows` 是「格」數**：半形數字/小寫＝1、CJK/箭頭/●○■▲✔✖＝2、大寫＝1.4（見 `cellWidth`）。內容區列數＝`rows`（不含標題列與軟鍵列）。**大字列**（`big:true`）佔 2 列、可用格數減半；放不下時自動改一般字級。
- 字型：系統字型堆疊（`Roboto, system-ui, "Noto Sans TC", "PingFang TC", sans-serif`），**不載入任何外部字型/圖片**；豪薩語特殊字母（ɗ ƙ ɓ ʼ）與天城文在 Cloud Phone 的字型涵蓋度**未驗證**，作物本地名預設顯示**羅馬拼寫**（`names.local`），天城文 `localNative` 只在設定開「顯示原文」時出現。
- 顏色用 CSS 變數：預設深色高對比（背景 `#0d1410`、文字 `#f4f4f4`、焦點列反白 `#ffd23f`/黑字）；設定可切「亮底高對比」。**任何狀態都要有形狀或文字**（不只靠顏色）：●輪到你/新鮮、○等對方/過舊、◐略舊、✔成交、✖結束/過期、▲警示、■注意、✕資料失效。對比度目標 WCAG AA 4.5:1。
- **全域防呆 CSS**：`*{animation:none!important;transition:none!important}`；無 `@keyframes`、無 `marquee`、無 `<video>`、無外部請求。

**View model（`FarmApp.getView(phone)` 回傳，也是 render 的唯一輸入）**

```ts
View = { phone:'A'|'B', screen:string /*data-view*/, title:string, sys:string /*標題列右側：時鐘＋網路符號*/,
         rows: Array<{t:string, cls?:'focus'|'dim'|'ok'|'warn'|'bad', big?:boolean, cells?:Array<{t:string, focus?:boolean}>}>,
         softkeys:{l:string, c:string, r:string}, focus:number|null, buffer:string|null,
         overlay:null|{type:'menu'|'confirm'|'guard'|'failure', title?:string, rows:string[], selected?:number},
         size:'240x320'|'128x160', cols:number, rowsMax:number, lang:'zh'|'en',
         status:{net:'ok'|'loading'|'error', stale:boolean, updatedAt:number|null} }
```

`t` 是**已翻譯、已截斷到 `cols` 格**的字串；九宮格列用 `cells`（每格獨立焦點）。`screenText(phone)`＝`[title, ...rows(含 overlay), softkeys].join('\n')`。**每個畫面都要為 L 與 S 各有一套 rows 模板**（S 用簡稱 i18n key `<key>.s`，≤2 個 CJK 字或 ≤4 個小寫英文字母），S 版可以省略次要資訊，但**不得省略：主要數字、資料時間戳/模擬標記、錯誤/過期提示**。

**DOM 合約**（harness 與 verifier 依賴）：

```html
<div id="screen-A" class="screen" data-phone="A" data-view="home" data-size="240x320" data-lang="zh" data-role="S" data-net="ok" data-focused="true">
  <div class="bar"><span class="title">…</span><span class="sys">…</span></div>
  <div class="body"><div class="row focus">…</div>…</div>
  <div class="soft"><span class="l"></span><span class="c"></span><span class="r"></span></div>
</div>
```

`#screen-A` 尺寸恰為所選解析度（240×320 或 128×160），`overflow:hidden`；每列 `white-space:nowrap; overflow:hidden`；`.body` 高度＝`rows×lineH`。**任一列 `scrollWidth>clientWidth` 或 `.body.scrollHeight>clientHeight` 都算失敗**（`FarmApp.lint(phone)` 要同時做 `viewLint` 與這項 DOM 量測）。

### 10.4 首頁（`home`）——九格＝數字鍵 1–9

| 鍵 | 賣方（手機 A，Amina） | 買方（手機 B，Musa） |
|---|---|---|
| 1 | 貼單 `postCrop` | 找貨 `matchList` |
| 2 | 收件匣 `inbox`（角標＝輪到我＋待確認） | 釘訂單 `wantCrop` |
| 3 | 誰要買 `wantList` | 收件匣 `inbox` |
| 4 | 行情 `ref` | 行情 `ref` |
| 5 | 算錢 `calc` | 算錢 `calc` |
| 6 | 喊價檢查 `quoteCheck`（單機入口） | 報價檢查 `quoteCheck` |
| 7 | 我的貨 `myListings`（租約） | 我的訂單 `myWants` |
| 8 | 熟人 `circle`（含履約點） | 熟人 `circle` |
| 9 | 設定 `settings` | 設定 `settings` |
| 0 | 更新（重新讀 `/home`） | 同左 |
| * | （無功能） | （無功能） |

- 列（L）：頂端 1–2 列**待辦橫幅**（有才顯示，且成為第一個焦點停靠點，OK 開啟對應畫面）：`⚠ 有 N 件未送出 OK 重送`（→`outbox`）、`● N 張待你回覆`（→`inbox`）、`▲ 貨單 73924 剩 1 小時 OK 續約`（→`listingDetail`）；接著 3 列九宮格（每列 3 格，格內容「數字＋2–3 字」，L 例：`1貼單 2收件匣 3誰要買`），最後一列「更新 06:30 · 模擬」。S：格用 2 字簡稱、橫幅濃縮為一列、頁尾只留時間。
- 焦點：Z 字（LEFT/RIGHT ±1 並跨列接續；UP/DOWN ±3）；OK 開啟焦點格；數字鍵直接開啟。LSK 選單：1 語言、2 設定、3 資料來源說明、4 更新。
- 進入首頁自動 `GET /home`（帶 `If-None-Match`/`ver`；未變動不重繪）。

### 10.5 畫面目錄與每個畫面的按鍵表

記號：`↑↓←→`、`OK`、`LSK`（＝選項選單）、`RSK`（＝刪一位/返回，見 10.2）、`0-9`、`*`。**每個畫面都要有：載入態、錯誤態（重試）、空狀態、資料過期提示（只要畫面的資料來自伺服器）**。深度＝從 `home` 起算的 RSK 次數。

#### 啟動：`regionPick`（第一次啟動；`?pack=` 或 localStorage 已有選擇時跳過）
- 目的：選地區包（資料驅動；加一國只需加一個 pack）。列：兩個地區名（`FarmData.packOrder`）＋「示範資料為模擬」。
- 鍵：`1/2` 或 ↑↓＋OK 選定 → `server.reset(seed, {packId})`，**兩支手機都直接進 `home`**（先選的那支決定地區；另一支的選擇畫面被略過）。RSK 無動作。
- 之後可在 `settings → 地區` 切換（會重置示範，先 `confirm`）。

#### `cropGrid`（`postCrop`/`wantCrop` 共用；深度 1）
- 目的：作物 3×3（數字鍵＝作物序 `crop.key`）。列：3 列格（`1番茄 2辣椒 3洋蔥`…）＋頁尾焦點作物全名＋本地名（「番茄 Tomato・Tumatir」）。
- 鍵：`1–9` 直接選＋`push(postForm|wantForm,{cropId})`；↑↓←→ 移動（Z 字）；OK 選焦點；RSK 返回。空狀態：無。

#### `postForm`（賣方；深度 2；**F1 核心**）
- 列（L，焦點列由 `↑↓` 或 OK 依序移動）：`r0 數量`（緩衝，一位小數，最長 6 字元）／`r1 單位` ◀▶（`crop.containers`；顯示「約 42kg」，有校準顯示「我的 42kg」）／`r2 單價/kg`（緩衝；小數位＝幣別 `decimals`；旁邊顯示價帶「₦440–457 ●」）／`r3 品級` ◀▶／`r4 熟人先看` ◀▶（開/關）／`r5 ▶ 下一步`／`r6` 即時「＝126 kg × ₦470 ＝ ₦59,220」（呼叫 `toGrams`＋`lineTotal`）／`r7` 提示或警告（單位陷阱、位數守門、缺欄位）／`r8` 品級卡一行（`FarmData.gradeCards`，如「A 級：抽10顆，壞/軟 ≤1」）。S：`r0–r5` 用簡稱＋`r6`，其餘進 LSK 選單。
- 鍵：數字/`*` 進入焦點列的緩衝（數量列允許 `*`；單價列在 INR 允許 `*`）；**OK**：提交緩衝並移到下一列，在 `r5` 上＝驗證後 `push(postReview)`；◀▶：在列舉列切換值，在**單價列＝±`priceStep`**（重複鍵 ≥5 次改用 `priceStepBig`；緩衝為空時從行情中位或上次值起算）；在數量列＝±1 個容器；↑↓ 換列（提交緩衝）；RSK 刪一位/返回 `cropGrid`；LSK 選單：1 清除此欄、2 用行情中位當單價、3 平口/尖頂（僅有 `heapedGrams` 的容器）、4 顯示品級卡。
- 守門：數量/單價任一為空→狀態列「請填單價」並停在該列；`magnitudeGuard`≠ok 或 `detectUnitSlip` 命中→`guard` overlay（「少/多一個零？」或「像是每 quintal 的價？≈ ₹18.00/kg」）。上次的值**不預填**（避免帶錯價），但價格列以價帶中位作為灰色提示。

#### `postReview`（賣方；深度 3）
- 列：作物＋品級＋公斤／每 kg 價／（大字）總價／「熟人先看 30 分」與「有效 6 小時（到 12:30）」／價帶比較（「高於價帶 3%」中性用語）／「OK 送出・返回 修改」。
- 鍵：OK→`POST /listings`（`idemKey`；成功後 `reset` 成 `[home, postDone]`，失敗→`failure` overlay）；RSK 返回 `postForm`。

#### `postDone`
- 列：（大字）`73924`／「貨單已貼」／「已問 3 位熟人」／「有效到 12:30」／「念這個碼給買方」。OK 或 RSK→`home`。

#### `myListings`（賣方；深度 1）
- 列：每張貨單一列 `73924 番茄 126kg ₦470 ●1`（●＝有待處理報價數）＋租約剩餘（「剩 5 小時」，以伺服器時鐘算；<1 小時改 ▲）。空狀態：「還沒貼單」。
- 鍵：↑↓ 選；OK→`listingDetail(owner)`；LSK：1 更新。

#### `listingDetail`（買方檢視／賣方擁有者；深度 2）
- **買方**列：賣方名＋履約點 `●●○`／作物 品級 公斤 市場／「要價 ₦470/kg ＝ ₦59,220」／「我的落地 ₦496/kg 淨利 +₦8」／價帶「₦440–457 ●」／（單位握手，有差才顯示）「賣≈42 我≈40 kg/籃 差 5%」（>10% 紅字＋「總額差 ₦x」）／品級卡一行（「A 級：抽10顆，壞/軟 ≤1」）／「N 分前由賣家確認」（租約新鮮度）／提示列「1 照價要 2 我出價 3 這次不要」。
  鍵：`1` 照價要→`POST /offers`（terms＝貨單條件；成功後堆疊重設為 `[home, inbox, thread]`）；`2` 我出價→`push(editOffer,{mode:'new'})`；`3` 這次不要→`POST /passes`，狀態列「已告知賣方」並返回；`4` 賣方信譽→`push(rep)`；OK＝`2`；LSK：1 更新。
- **賣方擁有者**列：狀態（開/已售/過期）、剩餘公斤、報價數、`passes` 人數（「1 位熟人這次不要」）、租約剩餘。鍵：`1` 還全有（`renew full`）、`2` 賣了一部分（狀態列出現數字緩衝「剩幾公斤 ___」，OK 送 `renew partial`）、`3` 賣完了（`confirm`→`renew sold`）；LSK：1 看報價（`push(inbox)`）、2 撤單（`confirm`）。

#### `matchList`（買方；深度 1；**F2 核心**）
- 列：標題列下第一列「作物：◀ 全部 ▶」；其後每張貨單一列（L：`● 番茄 126kg ₦470 +₦8`，●＝熟人先看單；淨利為負顯示 `淨-₦4` 並用 ▲）；底部狀態列「更新 06:30 · 模擬」。排序＝`rankListings` 預設「單公斤淨利」；LSK：1 更新、2 改依「總淨利」、3 只看熟人。
- 鍵：↑↓ 選（連按加速）；OK→`push(listingDetail)`；◀▶ 切作物篩選；`1–9` 直接篩該作物、`0` 全部；RSK 返回。
- 空狀態：「目前沒有符合的貨單」＋「回首頁按 2 釘訂單，讓賣方來找你」。過期/失敗：見 10.7。

#### `wantForm`（買方；深度 2）
- 列：`r0 公斤`（緩衝）／`r1 願付價/kg`（緩衝，旁顯價帶；**說明「賣方看到的是願付價，不是你的上限」**）／`r2 最低品級` ◀▶／`r3 交貨` ◀▶／`r4 付款` ◀▶／`r5 有效` ◀▶（1/3/7 天）／`r6 ▶ 送出`／`r7` 即時「我付 ₦44,500・落地 ₦…」。收貨市場＝買方的登記市場（設定可改，MVP 不在此畫面選）。
- 鍵同 `postForm`（OK 逐列；`r6` OK→`POST /wants`→`reset [home, wantDone]`）。守門：`magnitudeGuard`、公斤>庫存上限不檢查。

#### `wantDone` / `myWants`
- `wantDone`：（大字）`#12`／「訂單釘已掛」／「剩 100kg・3 天後到期」。
- `myWants`（深度 1）：每張一列 `#12 番茄 100kg ₦445 剩3天`＋認領數；OK→`inbox`（篩該單）；LSK：1 撤單（`confirm`）。

#### `wantList`（賣方；深度 1；**F3**）
- 列：作物篩選列（`1–9` 直選、`0` 全部、◀▶）；每張訂單一列（L：`K餐館 番茄 100kg 落袋₦445`；bid 低於價帶下緣加中性標記「↓價帶」）。排序＝`rankWants`。空狀態：「目前沒有人在買這個」＋「按 4 看行情」。
- 鍵：↑↓；OK→`push(wantDetail)`；RSK 返回；LSK：1 更新。

#### `wantDetail`（賣方；深度 2）
- 列：買方名＋履約點／作物 公斤 收貨市場／「願付 ₦445/kg（最低 B 級・自取・現金）」／「我的落袋 ₦445/kg」／價帶／（若低於價帶）「低於價帶下緣 2%」（中性）／提示「1 照價供貨 2 我還價」。
- 鍵：`1` 照價供貨→`confirm`（「以 ₦445 供貨 100kg？」）→`POST /offers {wantId, terms＝訂單條件}`→堆疊重設為 `[home, inbox, thread]`；`2` 我還價→`push(editOffer,{mode:'claim'})`；OK＝`2`；RSK 返回。

#### `inbox`（雙方；深度 1；**F4 核心；「打開才看到」**）
- 列：第一列標題資訊（「收件匣 3」＋數字跳轉緩衝「#4821」若正在輸入）；每張單一列：`{符號}{單號} {對方名} {作物} {價}`（L 例：`●4821 Musa 番茄 ₦440`；S：`●4821 Musa ₦440`；名字取第一個字詞並截斷）。符號：`●` 輪到我、`▲` 待我確認成交、`○` 等對方、`✔` 成交、`✖` 先不用/期限到；**未讀**在符號後加 `+`。排序：輪到我（依 `respondBy` 由近到遠）→待我確認→等對方→成交（新→舊）→已結束。
- 鍵：↑↓ 選；OK→開啟（`push(thread)`）；**數字鍵累積 4 位單號**（標題列顯示 `#48__`），OK 在滿 4 位時直接開該單（找不到→狀態列「找不到單號」；不足 4 位→「請輸入 4 位單號」，不做別的事）；RSK 先刪單號緩衝；LSK：1 更新、2 只看輪到我、3 顯示已結束。
- 進入時 `GET /inbox?since=ver`；`304`＝不重繪。空狀態：「收件匣是空的」。

#### `thread`（雙方；深度 2；**議價卡**）
- 列（L，順序固定）：`0` 狀態符號＋`#4821`＋對方名＋履約點／`1` 作物 品級 交貨 付款／`2`「對方報價 ₦455/kg × 126kg」（或「你的報價」）／`3`（大字）`= ₦57,330`／`4` **買方**「落地 ₦481/kg　淨利 +₦23」｜**賣方**「落袋 ₦455/kg」／`5`「第 2/5 回・期限 08:30」（最後價加「最後價」）／`6` 短語（依**我的語言**渲染，附 `[#1]`，含行情查核章）／`7` **教練行（私人，只在本機算）**：賣方「底價 ₦450・建議 ₦455」、買方「上限 ₦455・建議 ₦445」／`8` 買方「你排 2/2」／`9` 警告（位數守門、單位差）／`10`「更新 06:35 · 模擬」／`11` 鍵提示。S：`0`、`2`、`3`、`4`、`5`、教練建議一列。
- 鍵（依狀態）：
  - **輪到我**（`AWAIT_我`）：`1`/OK 接受→`replace(sheet,{intent:'accept'})`；`2` 還價→`push(editOffer,{mode:'counter'})`；`3` 教練→`push(coach)`；`4` 封存議價（P1；`turn<maxTurns` 且非 final）→`push(sealed)`；`5` 更新；`6` 對方信譽→`push(rep)`；`0` 先不用→`confirm` 後 `DECLINE`。
  - **等對方**：`3` 教練；`5` 更新；`6` 信譽；`8` 敲一下→`POST /knock`（狀態列「已敲・今天還可敲 2 次」，誠實加「對方不一定會看到」）；`0` 撤回（`DECLINE`）。
  - **ACCEPTED**：我尚未確認→`1`/OK `replace(sheet,{intent:'confirm'})`；我已確認→顯示「等對方確認」，`1` 看成交單。
  - **DEALT**：`1` 看成交單；`2` 秤貨（P1）→`push(weigh)`；`6` 信譽。**DECLINED**：顯示 `gapBand`（「差 8%，可再談」）。**EXPIRED**：`1` 重開（`REOPEN`）。
  - RSK 返回 `inbox`（買方由 `listingDetail` 進來時，堆疊已 `replace`，返回到 `listingDetail`）。
- 錯誤：`STALE_VERSION`→用回應視圖更新並顯示「對方剛改過，已更新」；其他錯誤碼顯示 `e.<CODE>`。

#### `editOffer`（雙方；深度 3；**五格報價**；`mode: new|counter|claim`）
- 列（L）：`r0 單價/kg`（緩衝；旁顯價帶；已改時顯示 `▲+5`/`▼-10` 差額——**形狀不只靠顏色**）／`r1 理由`（◀▶ 在「（無）」與 `phrasesFor(role,turn)` 之間切換，顯示**我的語言**文字）／`r2 公斤`／`r3 品級` ◀▶／`r4 交貨` ◀▶／`r5 付款` ◀▶／`r6 ▶ 送出`／`r7`（大字）即時總價與（買方）落地價/（賣方）落袋價／`r8` 「改了 1/2 格」＋位數守門/單位差提示；焦點在品級列時 `r8` 改顯示該品級的品級卡文字。
- **一次最多改兩格**：改第 3 格時該格不接受輸入，狀態列「一次最多改兩格」（`FarmLogic.changedFields` 即時判斷；短語不算）。`grade` 選項不得好於貨單品級。
- 鍵：數字/`*`→焦點列緩衝（單價/公斤）；◀▶＝單價列 ±`priceStep`（重複鍵加速）、列舉列切換；OK 提交並下移，`r6` 上 OK＝送出；↑↓ 換列；RSK 刪一位/放棄（有改動→`confirm`）。**LSK 選單**：1 開價階梯（overlay 列出 `openingLadder` 三個價，`1–3` 直選並填入單價列）、2 用教練建議價、3 標「最後價」（`turn+1>=3` 才出現）、4 送出、5 還原。
- 送出：新單→`POST /offers`；還價→`POST /offers/:id/act COUNTER {baseVer,...}`；成功→堆疊**重設為 `[home, inbox, thread]`**（讓「從議價卡按 RSK 回到收件匣」永遠成立，深度 ≤2）；送出前先過 `guard`（`magnitudeGuard`）。失敗→`failure` overlay（見 10.7）。

#### `coach`（雙方；深度 3；**私人**）
- 列：`0` 行情 ₦440–457（n=4 剛剛 ●）／`1`「別處淨得 ₦448（Sabon Gari）」（賣方）或「別處買到手 ₦504」（買方）／`2` 我的底價/上限 ₦450「（只存本機）」／`3` 我的目標 ₦455／`4`「對方 ₦440　我上次 ₦470」／`5` **建議**：「還價 ₦455（讓 ₦15）」或「可以接受」「建議先不用」（`suggestCounter`）／`6` 開價階梯（僅第一次出價時）／`7`「這些數字只在你的手機」。
- 鍵：`1` 改底價/上限（列內緩衝，OK 存 `localStorage['oneslip:v1:<phone>:limits']`）；`2` 改目標；`3` 用建議價→`replace(editOffer)` 並把價填入；RSK 返回。**預設值**＝`defaultLimits(exit…)`（**教練文案只寫「建議」；規則是經驗法則無實證**）。

#### `sheet`（雙方；深度 2；**同一張明細，F6 核心**；`intent: accept|confirm|view`）
- 列（L）：`0`（大字）`126kg × ₦455`／`1`（大字）`₦57,330`／`2` 現金・自取・A 級／`3` 賣方「你實收 ₦57,330」｜買方「你要付 ₦57,330」（手續費另列：「手續費 ₦0」；有斷崖提示時加一行黃字「減 ₦21 可少扣 ₦50」）／`4` 買方「落地 ₦481/kg 淨利 +₦23」｜賣方「落袋 ₦455/kg」／`5` 運費 ₦3,000・腐損 0.4%（買方；「約」）／`6` 確認狀態「你 ✔　對方 ○」／`7`（僅 `readbackRequired` 且 intent≠view）「輸入總額末兩碼：3_」／`8`「更新 06:35 · 模擬」。雙方顯示的數字**逐位元相同**（來自 `offer.deal.sheet`；`accept` 前的預覽由本機同函式算，與伺服器結果必須一致）。
- 鍵：數字→回讀緩衝（最多 2 位）；OK：`intent=accept`→`POST act ACCEPT {baseVer,last2}`、`intent=confirm`→`POST act CONFIRM`；需回讀但不足 2 位→狀態列「請輸入末兩碼」；`READBACK_MISMATCH`→「末兩碼不符」；成功後 `intent` 變 `view`，成交時（`DEALT`）顯示「✔ 成交 #482188・行情已更新」與新價帶一行；RSK 刪一位/返回 `inbox`；LSK 選單：1 更新、2 秤貨（DEALT）、3 聯絡（P2）。
- 大額（≥ `readbackMinMajor`）才回讀；小額 OK 一次即成。位數守門：`sheet.magnitude≠ok`→`guard`。

#### `sealed`（雙方；P1；深度 3）
- 三個階段：**教學**（一次性說明：「雙方各封一個數字，重疊就取中點成交；成交價是中點，可反推對方底價；不必先開價」）→**輸入**（大數字框，輸入時以 `●●●●` 遮罩；上方一行價帶；偏離價帶 >25% 黃字提醒；預填**不**帶入教練底價，避免肩後偷看）→**等待/結果**。輸入階段：數字鍵、RSK 刪一位、OK 第一次→「再按 OK 封存」，第二次→`POST /seal`。結果：重疊→「中點 ₦450 → OK 看成交單」（伺服器已 `SEALED_DEAL`，`replace(sheet,{intent:'confirm'})`）；沒重疊→只顯示差距等級；`canReseal`→`1` 再封一次（範圍限 `resealBounds`）；`0` 先不用。
- 錯誤：`ALREADY_SEALED`、超出重封範圍（422，顯示允許區間）。

#### `weigh`（雙方；P1；僅 `DEALT`；深度 3）
- 列：「我看到的秤面 ___ kg」（緩衝，`*` 小數點，最多 2 位小數）→ OK 封存（「已封存，等對方」）→ 雙方都送出後**同時翻牌**：綠「一致，採 126.05 kg」／黃「差 2 kg ＝ ₦910，採平均」／紅「差太多，重秤」（最多重秤 2 次，之後顯示「請改用公秤」文字）。結果列出「按實秤 126.05 kg 應付 ₦57,363」（`dealSheet` 重算）。鍵：數字/`*`/RSK/OK；`1` 重秤（黃/紅）。

#### `ref`（雙方；深度 1；**F7 共同參考價帶**）
- 列：`0` 作物全名＋本地名，右側 ◀ 市場 ▶／`1`「成交 ₦455・5筆・剛剛 ●」（沒有成交時「成交 —・資料太少」，有 `dealsN` 時加「(+2筆成交)」）／`2`「外部 ₦425・模擬・2小時 ◐」／`3`（大字）`₦440–457`／`4`「合理區間・A 級」（有 `concentrated` 加「來源集中」）／`5`「7日 ▼3.4%」／`6`「更新 06:30 · 模擬」。新鮮度符號 ●◐○✕；aging 顯示「約 ₦460」；old/stale 不顯示點值只顯示區間與日期，stale 加整列「資料舊」。
- 鍵：↑↓ 前後作物；`1–9` 直選作物；◀▶ 切市場；OK→**來源卡**（子模式：來源、筆數、視窗天數、最新時間、是否來源集中、「模擬」說明；RSK 退出子模式）；LSK：1 更新、2 只看成交；買賣雙方看**同一組數字**。

#### `calc`（雙方；深度 1；**F8 算錢**）
- 列：`r0 作物` ◀▶（`1–9` 也可直選）／`r1 單位` ◀▶（含 kg；顯示「約 42kg」與 `= 126 kg`）／`r2 數量`（緩衝）／`r3 單價`（緩衝；LSK 可切「每單位價/每 kg 價」）／`r4 付款` ◀▶／`r5`（大字）總價／`r6` 手續費・賣方「你實收」｜買方「你要付」／`r7` 提示：手續費斷崖、單位陷阱（`detectUnitSlip`）、位數守門、容器校準差（`unitMismatch`，>10% 紅字）。
- 鍵：數字/`*`；OK 下移；◀▶；LSK 選單：1 每單位/每公斤價切換、2 **找零**（子模式：「客人給 ___」→「應收 ₦3,770，找 ₦1,230：1000＋200＋20＋10（4 張）；零頭 ₦x 湊不出」）、3 加入清單（多品項，最多 5 行；P1）、4 看清單（各行＋合計；**手續費對合計算**；付款方式可換）、5 清除。
- 空狀態：無。此畫面**完全本機運算**（不打 API）；作物的容器預設值標「約・待校準」。

#### `quoteCheck`（雙方；深度 1；**單機入口**）
- 目的：對方喊價時 3 步內得到判斷（賣方「對方喊 ₦380」、買方「賣方喊 ₦480」）。列：`r0 作物` ◀▶／`r1 對方喊的價`（緩衝；旁邊「每 kg」；若輸入像是每袋/每 quintal 的價→警告列）／`r2` 判斷（`quoteVerdict`：「低於價帶 9% ▲」＋形狀符號）／`r3` 教練：`suggestCounter`（賣方以 `ref.high` 為假想要價、買方以 `ref.low`；`turn=1`）「建議還價 ₦445」／`r4`「別處淨得 ₦448」（賣方；買方顯示「別處買到手 ₦504」）／`r5` 價帶與時間戳。
- 鍵：數字；◀▶ 換作物；OK 下移；RSK。**對方沒裝 App 也有用**（Demo 情境 S4）。

#### `circle`（雙方；P1；深度 1）與 `rep`（深度 2）
- `circle`：賣方「我的老買家（3）」列出名字＋`●●○`；買方「把我當熟人的賣方（1）」。OK→`rep`。（P2：LSK 1 用 4 碼攤位碼新增，對方在 MVP 自動同意。）空狀態：「還沒有熟人」。
- `rep`：姓名、「量準 78% ◐　準時 92% ●　履約 92% ●」、筆數、`n<5` 顯示「新・3 筆」；文案中性，不指控。

#### `settings`（深度 1）／`calib`（深度 2）
- `settings` 列：`語言` ◀▶（zh/en，等同 `FarmApp.setLang`）、`高對比` ◀▶、`地區`（OK→`confirm` 後回 `regionPick` 並重置示範）、`校準容器`（OK→`calib`）、`簡訊敲門` ◀▶（開/關；預設開）、`更新資料`（OK→刷新並顯示同步時間與網路狀態）、`資料來源`（OK→說明：「行情與成交為模擬資料；正式版接 Agmarknet/WFP…（見 README）」）。
- `calib`：容器 ◀▶、「1 個籃 ≈ [42.0] kg」（緩衝，2 位小數）→ OK 存 `localStorage['oneslip:v1:<phone>:calib']`（克，整數）；`*` 小數點；LSK：1 還原預設。

#### `outbox`（深度 1）
- 列：每件未送出 `POST 還價 #4821 ₦455 · 嘗試 2 次`。鍵：OK 重送選取的一件（同 `idemKey`）；`1` 全部重送；`0` 取消選取的一件（`confirm`）；RSK 返回。空狀態：「沒有未送出的」。

### 10.6 每次寫入的固定流程（所有 `POST`）

1. 產生 `idemKey`，把命令寫進 `outbox`（localStorage，try/catch）；2. 30 ms 內未回→畫「傳送中…」；3. 成功→從 `outbox` 移除，狀態列「已收到 #4821」（`replayed:true` 顯示「已送過，不重複」）；4. 網路類失敗→保留在 `outbox`，開 `failure` overlay（OK 重送同 key／RSK 取消）；5. 應用層錯誤（4xx）→從 `outbox` 移除，顯示 `e.<CODE>`，若帶最新 offer 視圖就更新畫面。

### 10.7 載入 / 錯誤 / 空 / 過期（每個資料畫面都要）

- **載入**：進畫面若快取存在→先畫快取，30 ms 後仍未回→頁尾顯示「讀取中…」（靜態）；無快取→內容區「讀取中…」。
- **失敗**：有快取→保留內容＋頁尾「⚠ 連不上・OK 重試」；無快取→內容區「連不上 · OK 重試 · 返回」。**OK 在失敗態＝重試**（覆寫該畫面原本的 OK 行為，直到成功）。
- **過期（stale）**：資料 `fetchedAt` 與伺服器時鐘相差 >30 分→頁尾「資料已 2小時（舊）」並用 `dim`；行情本身 >7 天→整列「資料舊」。頁尾一律含「更新 hh:mm」與「模擬」標記（來源是模擬時）。
- **空**：每個清單有具體文案與下一步提示（見各畫面）。
- **`304`**：不重繪，只在需要時更新頁尾時間（同一次按鍵至多一次 DOM 寫入）。

### 10.8 本機儲存（全部 `try/catch`；沒有也能跑）

`oneslip:v1:pack`（選定地區）、`oneslip:v1:<A|B>:limits`（`{cropId:{limit,target}}`，**私人**）、`:calib`、`:outbox`、`:settings`（`{lang,size,hc,smsOptIn,antiTapMs}`）。兩支手機**必須加 A/B 前綴**（同源共用 localStorage）。`server.reset` 清掉除 `settings` 以外的 `oneslip:v1:*`。清除資料會讓私人底價與待送件匣消失——設定畫面資料來源說明要提。

---

## 11. Demo 外殼（真實產品只有一支手機；雙機是 Demo 工具）

- **版面**：左 A（賣方）、右 B（買方），各有外殼＋標題（「手機 A・賣方 Amina」）、螢幕、虛擬鍵盤（P1）。每支下方有下拉：**語言 zh/en**、**螢幕 240×320 / 128×160**（呼叫 `setLang/setScreenSize`）。焦點手機亮黃外框。**窄視窗（<720 px）**：改單機顯示（預設 A；上方 A/B 分頁切換，`#screen-A` 永遠是 A、`#screen-B` 永遠是 B，未顯示者 `display:none` 但仍運作）；`?phones=1` 強制單機。單機模式下伺服器的 bots 仍運作（展示非同步收件匣）。
- **Demo 列**（頂部，可收合）：地區下拉（切換＝`reset`）、**虛擬時鐘**顯示「伺服器時間 06:30（模擬）」＋ [+30 分][+2 小時][+1 天]、**網路** [ok|flaky|down]、bots [開|關]、「Musa 是 Amina 的熟人」[開|關]、[重置]、**拔電池 A**／**拔電池 B**、[引導劇本 ▶ 下一步][自動播放]、單機/雙機切換、流量計（各機「畫面重繪 N 次」，**明示是估計代理指標，實際計費依畫面更新**）。
- **模擬伺服器事件流面板**（可收合）：每筆 `seq、伺服器時間、誰、種類、文字`；分頁篩選 [全部|API|狀態|簡訊|機器人|錯誤]；API 列格式 `A → POST /offers/o4821/act COUNTER 200 (0 ms)`，狀態列格式 `offer#4821 AWAIT_SELLER → AWAIT_BUYER (COUNTER by S, turn 2)`；`replay`、`stale`、`counted:false` 要看得出來。最多保留 500 筆。
- **電信層面板**（兩機之間）：簡訊清單（全文、收件人、狀態）＋ [模擬收到]；標題寫「平台外通道：Cloud Phone 沒有推播」。
- **引導劇本**：`DEMO_SCRIPT=[{id,label,steps:[{who:'A'|'B'|'SRV', keys?:string[], call?:'advance'|'setNetwork'|..., args?, note}]}]`，「下一步」執行一步、「自動播放」每步間隔 700 ms（此處**可**用 `setTimeout`，它是 Demo 工具不是手機）；**一定經過與真人相同的 `dispatch`**（不得直接改 state）。至少內建 G1（§15.1）與 G2（§15.2）。
- 所有 Demo 專屬 UI 都不得出現在手機螢幕內。

## 12. 測試掛勾（**固定，harness 依賴；缺一不可**）

```js
window.FarmApp = {
  getView(phone),                    // View（§10.3）
  getState(phone),                   // {phone,userId,role,lang,size,packId,screen,stack:[screenId…],focused,buffer,cursor,overlay,net,unread,redraws,requests,outbox,limits,calib,settings,clockNow}
  screenText(phone),                 // #screen-X 的可見文字，列以 '\n' 連接
  setScreenSize(phone, size),        // '240x320' | '128x160'（也接受 'L'|'S'）
  setLang(phone, lang),              // 'zh' | 'en'
  focus(phone),                      // 'A' | 'B'
  server: { getState(), reset(seed), setNetwork('ok'|'flaky'|'down', opts?), advance(ms), now() },   // 後三者之後的為額外
  press(phone, key),                 // 額外：鍵名同 tests/lib.mjs 的 ALL_KEYS（'0'..'9','*','#','ArrowUp'…,'Enter','SoftLeft','SoftRight','Backspace','Escape'）
  lint(phone),                       // 額外：{ok, issues[]}（viewLint＋DOM 量測）
}
```

- `phone` 為 `'A'|'B'`。`#screen-A`/`#screen-B` 見 §10.3 DOM 合約（**含 `data-view`**）。
- 按鍵由 `document`（或 `body`）上的 `keydown` 監聽，依焦點手機分派；harness 每送一鍵會先呼叫 `FarmApp.focus(p)`。
- `reset(seed)` 保留兩機語言/尺寸/焦點，其餘回工廠狀態；同步回傳。`getState(phone).screen` 與 `#screen-X[data-view]` 一致。
- 頁面載入時**不得**有 JS 錯誤、`requestfailed`、`console.error`（harness 的 `open()` 會收集）；沒有外部請求。
- URL 參數：`?pack=ng-kano|in-bihar`（跳過 `regionPick`）、`?phones=1|2`、`?size=240x320|128x160`（兩機）、`?seed=1`、`?clock=manual|real`、`?net=ok|flaky|down`、`?bots=0|1`、`?worker=1`、`?tab=A|B`（後兩者 P2）、`?debug=1`（顯示 lint 訊息）。

---

## 13. 地區設定包（locale pack；資料驅動——**加一個國家只需加一個 pack**）

### 13.1 Schema（`FarmData.packs[id]`；完整實例在 `farm-src/farm-data.js`）

```ts
Pack = {
  id, version, simulated:true, names:{zh,en}, defaultLang:{A,B},
  currency:{code, symbol, minorPerMajor, decimals, grouping:'intl'|'indian', cashStep, denominations:int[], priceStep, priceStepBig},
  tz:{offsetMin,label}, startLocal:{h,m}, readbackMinMajor,
  minGrams, grades:['A','B','C'], gradeBps:{A,B,C}, deliveries:['pickup','deliver'], lossCapBps, resaleUpliftBps,
  markets:[{id, names:{zh,en,local}, multBps}],  distKm:{'a|b':km /*鍵為字母序*/},  freight:{minorPerTonKm, minMinor, typicalLoadGrams},
  crops:[{id, key:1..9, names:{zh,en,local,localNative?,localLang}, perishClass:'perishable'|'normal'|'durable', lossBpsPer100km, leaseHours, refWindowDays, containers:[id…], defaultContainer}],
  prices:{cropId:{series:int[7] /*基準市場 day-6..day0，最小單位/kg*/, asOfAgoMin}}, priceSourceLabel:{zh,en},
  containers:[{id, names, grams, heapedGrams?, byMarket?:{marketId:{grams,heapedGrams?}}, byCrop?:{cropId:{grams}}, approx, note}],
  payments:[{id, names, cashRounding, buyerFee:FeeRule|null, sellerFee:FeeRule|null, meta:{status, source?, asOf?, boundary?, approx}}],
  ref:{…}, negotiation:{…}, display:{agingStep},
  seed:{personas:{A,B}, users[], circle, trades[], listings[], wants[], bots[]}
}
FeeRule = { tiers?:[{upTo:int|null, fee:int}], addOn?:[{from:int, fee:int}], percentBps?:int, userFill?:boolean, minFee?:int, maxFee?:int }
```

共用設定（每個 pack 都有；pack 可覆寫任一鍵）：

```json
{
 "minGrams": 1000,
 "grades": [
  "A",
  "B",
  "C"
 ],
 "gradeBps": {
  "A": 0,
  "B": -600,
  "C": -1500
 },
 "deliveries": [
  "pickup",
  "deliver"
 ],
 "lossCapBps": 3000,
 "resaleUpliftBps": 500,
 "ref": {
  "minTrades": 3,
  "quantiles": {
   "low": [
    1,
    5
   ],
   "mid": [
    1,
    2
   ],
   "high": [
    4,
    5
   ]
  },
  "sizeCapKg": 100,
  "decayFloorPermille": 50,
  "freshHours": 6,
  "agingHours": 72,
  "oldHours": 168,
  "concentrationPct": 50,
  "widenBps": 500,
  "sourceSpreadBps": 800,
  "staleSpreadMult": 2,
  "dedupePairDays": 7
 },
 "negotiation": {
  "maxTurns": 5,
  "finalFromTurn": 3,
  "maxChangedFields": 2,
  "maxReopens": 1,
  "sheetTtlHours": 24,
  "respondMinutesByClass": {
   "perishable": 120,
   "normal": 720,
   "durable": 2880
  },
  "trustedWindowMin": 30,
  "magnitudeFactor": 5,
  "exitFrictionBps": 500,
  "coachRatiosBps": [
   5000,
   4000,
   3000,
   2500,
   2000
  ],
  "smsPerThreadPerDay": 3,
  "blind": {
   "gapSmallBps": 500,
   "gapMediumBps": 1500,
   "resealMaxConcedeBps": 500,
   "maxRounds": 2,
   "farFromBandBps": 2500
  },
  "weigh": {
   "greenBps": 100,
   "yellowBps": 300,
   "maxReweigh": 2
  },
  "reputationMinN": 5
 }
}
```


**解析規則**：市場價 = 基準價序列 × `market.multBps`（再進位到 `priceStep`）；容器公斤 = 校準→byMarket→byCrop→預設（§7.2）；手續費規則在 `payments[]`（金額單位＝最小貨幣單位，所以新幣別的 tiers 也要用最小單位）；距離表鍵為兩個市場 id 依字母序以 `|` 相連；運費/腐損公式見 §7.5；所有 `approx:true` 的值畫面一律標「約/估」。

**加一個國家（例如肯亞）的步驟**：①複製一個 pack，改 `id/names/currency/tz/markets/distKm/freight/crops/prices/containers/payments/seed`；②`FarmData.packOrder` 加 id；③（如需）為新的手續費結構補 `FeeRule` 即可（`feeOf` 不必改）；④補 `i18n` 沒有的新字串（作物名放 pack 內，不進 i18n）；⑤跑 `tests`：`logic.test.mjs` 的 pack 結構檢查會驗證每個作物有 `prices`、每個容器/付款/市場引用存在、`distKm` 對稱且涵蓋所有市場對。**不需要改任何程式碼。**附錄 C 附肯亞 M-Pesa 費率（VERIFIED 二手來源）供日後直接用。

### 13.2 地區包 A：奈及利亞・Kano（`ng-kano`，預設，NGN）

**Pack `ng-kano`** — 奈及利亞・Kano / Nigeria · Kano; currency NGN (minorPerMajor 1, cashStep 5, priceStep 5, grouping intl); tz UTC+1; clock starts 06:30 local (epoch 1789795800000); read-back from 50000 major units; freight 180/tonne-km (min 3000/trip, typical load 500 kg).

| # | id | zh | en | local (Latin) | class | loss bps/100 km | lease h | ref window d | containers (default first) | base price @ multBps 10000 | external asOf (ago) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tomato | 番茄 | Tomato | Tumatir | perishable | 300 | 6 | 3 | basket, kg | 450 | 90 min |
| 2 | pepper | 辣椒 | Pepper | Barkono | perishable | 250 | 8 | 3 | basket, kg | 900 | 240 min |
| 3 | onion | 洋蔥 | Onion | Albasa | normal | 100 | 48 | 7 | bag, kg | 520 | 12960 min |
| 4 | maize | 玉米 | Maize | Masara | durable | 20 | 72 | 7 | bag, mudu, kg | 430 | 2880 min |
| 5 | rice | 稻米(帶殼) | Rice (paddy) | Shinkafa | durable | 10 | 72 | 7 | bag, mudu, kg | 900 | 1440 min |
| 6 | sorghum | 高粱 | Sorghum | Dawa | durable | 20 | 72 | 7 | bag, mudu, kg | 400 | 4320 min |
| 7 | millet | 小米 | Millet | Gero | durable | 20 | 72 | 7 | bag, mudu, kg | 440 | 7200 min |
| 8 | cowpea | 豇豆 | Cowpea (beans) | Wake | durable | 15 | 72 | 7 | bag, mudu, kg | 950 | 600 min |
| 9 | groundnut | 花生 | Groundnut | Gyada | normal | 30 | 72 | 7 | bag, mudu, kg | 1000 | 15840 min |

7-day base series (day −6 … day 0, minor units per kg at multBps 10000): tomato: [470, 485, 480, 470, 455, 455, 450]; pepper: [930, 955, 900, 890, 900, 895, 900]; onion: [520, 540, 550, 520, 500, 530, 520]; maize: [470, 465, 455, 430, 415, 425, 430]; rice: [995, 1020, 1015, 975, 960, 940, 900]; sorghum: [420, 395, 380, 400, 385, 395, 400]; millet: [470, 480, 465, 440, 440, 455, 440]; cowpea: [980, 985, 1005, 1065, 1035, 1005, 950]; groundnut: [1050, 1015, 1065, 1035, 995, 1005, 1000]

| market | multBps | names | distance km |
|---|---|---|---|
| dawanau | 9400 | Dawanau 穀物市集 / Dawanau grain market | sabongari:14, kaduna:165, lagos:1000 |
| sabongari | 10000 | Sabon Gari 市集 / Sabon Gari market | dawanau:14, kaduna:160, lagos:990 |
| kaduna | 10900 | Kaduna 市集 / Kaduna market | dawanau:165, sabongari:160, lagos:780 |
| lagos | 13800 | Lagos Mile 12 / Lagos Mile 12 | dawanau:1000, sabongari:990, kaduna:780 |

| container | zh / en / local | default g | heaped g | byMarket | byCrop | note |
|---|---|---|---|---|---|---|
| kg | 公斤 / kg / kilo | 1000 | - | - | - |  |
| basket | 籃 / basket / kwando | 42000 | - | - | - | SIMULATED default; user calibration overrides |
| bag | 袋 / bag / buhu | 100000 | - | - | {"rice":{"grams":50000}} | SIMULATED default (grain 100 kg, paddy 50 kg) |
| mudu | 量杯 mudu / mudu (measure) / mudu | 1130 | 1500 | {"kaduna":{"grams":565,"heapedGrams":750}} | - | Kano mudu ~1.13 kg flat / ~1.5 kg heaped (villagemath summary, UNVERIFIED full text); Kaduna mudu ~half of Kano (derived, UNVERIFIED). Conflicting 0.17/0.32 kg figures NOT used. |

| payment | zh / en | cash rounding | buyer fee rule | seller fee rule | status |
|---|---|---|---|---|---|
| cash | 現金 / Cash | true | - | - | n/a |
| transfer | 銀行轉帳 / Bank transfer | false | `{"tiers":[{"upTo":5000,"fee":0},{"upTo":50000,"fee":10},{"upTo":null,"fee":50}],"addOn":[{"from":10000,"fee":50}]}` | - | CBN fee-guide DRAFT 2026-04-21 + N50 stamp duty on transfers >= N10,000 (payer-borne, from 2026-01-01); final status UNCONFIRMED; tier edges (exactly N5,000 / N50,000) are ambiguous in the source; this pack treats upTo as inclusive |
| agent | 錢包＋代理現金化 / Wallet + agent cash-out | false | - | `{"percentBps":100,"userFill":true}` | UNVERIFIED — no reliable source for OPay/PalmPay/Moniepoint/agent rates; percentage is USER-FILLED, default 1.00% is an ILLUSTRATION |


**種子資料（全部為模擬；明確標示）**

| id | name | role | market | stall code | rep (deals / weighChecks / weighOk / onTime / ghosts) | note |
|---|---|---|---|---|---|---|
| u_amina | Amina Bello | S | dawanau | 2041 | 7 / 6 / 6 / 7 / 0 | PHONE A |
| u_musa | Musa Ibrahim | B | sabongari | 5521 | 12 / 9 / 7 / 11 / 1 | PHONE B |
| u_hauwa | Hauwa Sani | B | sabongari | 3309 | 9 / 6 / 6 / 9 / 0 | mock (bot / seed) |
| u_ibrahim | Ibrahim Lawal | B | sabongari | 7714 | 3 / 1 / 1 / 3 / 0 | mock (bot / seed) |
| u_kresto | K Restaurant | B | sabongari | 6102 | 5 / 4 / 3 / 5 / 0 | mock (bot / seed) |
| s_halima | Halima Yusuf | S | kaduna | 8830 | 4 / 3 / 3 / 4 / 0 | mock (bot / seed) |
| s_kabir | Kabir Aliyu | S | dawanau | 1276 | 15 / 10 / 9 / 14 / 1 | mock (bot / seed) |
| b_yusuf | Yusuf T. | B | sabongari | 9001 | 2 / 0 / 0 / 2 / 0 | mock (bot / seed) |
| b_zainab | Zainab M. | B | sabongari | 9002 | 2 / 0 / 0 / 2 / 0 | mock (bot / seed) |

Circle (seller → trusted buyers): {"u_amina":["u_musa","u_hauwa","u_ibrahim"]}.

| # | crop | market | ago (min) | kg | price/kg | grade | grade-A basis | seller → buyer |
|---|---|---|---|---|---|---|---|---|
| 0 | tomato | dawanau | 40 | 200 | ₦450 | A | ₦450 | s_kabir → b_yusuf |
| 1 | tomato | dawanau | 300 | 120 | ₦440 | A | ₦440 | s_halima → b_zainab |
| 2 | tomato | dawanau | 1200 | 300 | ₦430 | B | ₦457 | s_kabir → u_hauwa |
| 3 | tomato | dawanau | 1800 | 80 | ₦470 | A | ₦470 | s_halima → u_ibrahim |
| 4 | tomato | sabongari | 90 | 150 | ₦480 | A | ₦480 | s_kabir → u_hauwa |
| 5 | tomato | sabongari | 600 | 100 | ₦470 | A | ₦470 | s_halima → u_ibrahim |
| 6 | tomato | sabongari | 1500 | 60 | ₦485 | A | ₦485 | s_kabir → b_zainab |
| 7 | maize | dawanau | 700 | 1000 | ₦405 | B | ₦431 | s_kabir → b_yusuf |
| 8 | maize | dawanau | 2900 | 500 | ₦415 | A | ₦415 | s_kabir → b_zainab |

Seed listings (server creates them at reset; listing sequence starts at 7390, so these get codes 73908 and 73916 and the first player listing gets 73924):

| id | seller | crop | market | qty | kg | ask | grade | audience | age |
|---|---|---|---|---|---|---|---|---|---|
| L-seed-1 | s_halima | tomato | kaduna | 5 basket | 210 | ₦455 | A | public | 50 min |
| L-seed-2 | s_kabir | maize | dawanau | 10 bag | 1000 | ₦445 | B | public | 120 min |

Seed wants (buyer pins):

| id | buyer | crop | market | kg | bid/kg | min grade | delivery | payment | age | valid |
|---|---|---|---|---|---|---|---|---|---|---|
| W-seed-1 | u_kresto | tomato | sabongari | 100 | ₦420 | B | pickup | cash | 30 min | 72 h |
| W-seed-2 | u_hauwa | pepper | sabongari | 60 | ₦880 | A | pickup | cash | 200 min | 72 h |
| W-seed-3 | u_kresto | maize | sabongari | 2000 | ₦425 | B | deliver | transfer | 600 min | 72 h |

Bots: `{"userId":"u_hauwa","kind":"bidder","cropIds":["tomato","pepper"],"firstOfferDelayMin":12,"openBps":9200,"maxBps":9600,"maxGrams":60000,"respondDelayMin":5}`; `{"userId":"u_ibrahim","kind":"passer","cropIds":["tomato"],"passDelayMin":20}`


**啟動時各作物×市場的參考價**（`referencePrice`＠T0；用來驗收 E-01）：

`D` = band from deals, `E` = fallback to the simulated external source. Format: mid [low–high] evidence freshness.

| crop \ market | dawanau | sabongari | kaduna | lagos |
|---|---|---|---|---|
| tomato | D ₦450 [₦440–₦457] n=4 fresh | D ₦480 [₦470–₦480] n=3 fresh | E ₦490 [₦451–₦529] dealsN=0 fresh | E ₦620 [₦570–₦670] dealsN=0 fresh |
| pepper | E ₦845 [₦777–₦913] dealsN=0 fresh | E ₦900 [₦828–₦972] dealsN=0 fresh | E ₦980 [₦902–₦1,058] dealsN=0 fresh | E ₦1,240 [₦1,141–₦1,339] dealsN=0 fresh |
| onion | E ₦490 [₦412–₦568] dealsN=0 stale | E ₦520 [₦437–₦603] dealsN=0 stale | E ₦565 [₦475–₦655] dealsN=0 stale | E ₦720 [₦605–₦835] dealsN=0 stale |
| maize | E ₦405 [₦373–₦437] dealsN=2 aging | E ₦430 [₦396–₦464] dealsN=0 aging | E ₦470 [₦432–₦508] dealsN=0 aging | E ₦595 [₦547–₦643] dealsN=0 aging |
| rice | E ₦845 [₦777–₦913] dealsN=0 aging | E ₦900 [₦828–₦972] dealsN=0 aging | E ₦980 [₦902–₦1,058] dealsN=0 aging | E ₦1,240 [₦1,141–₦1,339] dealsN=0 aging |
| sorghum | E ₦375 [₦345–₦405] dealsN=0 aging | E ₦400 [₦368–₦432] dealsN=0 aging | E ₦435 [₦400–₦470] dealsN=0 aging | E ₦550 [₦506–₦594] dealsN=0 aging |
| millet | E ₦415 [₦382–₦448] dealsN=0 old | E ₦440 [₦405–₦475] dealsN=0 old | E ₦480 [₦442–₦518] dealsN=0 old | E ₦605 [₦557–₦653] dealsN=0 old |
| cowpea | E ₦895 [₦823–₦967] dealsN=0 aging | E ₦950 [₦874–₦1,026] dealsN=0 aging | E ₦1,035 [₦952–₦1,118] dealsN=0 aging | E ₦1,310 [₦1,205–₦1,415] dealsN=0 aging |
| groundnut | E ₦940 [₦790–₦1,090] dealsN=0 stale | E ₦1,000 [₦840–₦1,160] dealsN=0 stale | E ₦1,090 [₦916–₦1,264] dealsN=0 stale | E ₦1,380 [₦1,159–₦1,601] dealsN=0 stale |


### 13.3 地區包 B：印度・Bihar（`in-bihar`，INR；官方已證實 Cloud Phone 有販售的市場）

**Pack `in-bihar`** — 印度・Bihar / India · Bihar; currency INR (minorPerMajor 100, cashStep 100, priceStep 50, grouping indian); tz UTC+5.5; clock starts 06:30 local (epoch 1789779600000); read-back from 5000 major units; freight 400/tonne-km (min 20000/trip, typical load 500 kg).

| # | id | zh | en | local (Latin) | class | loss bps/100 km | lease h | ref window d | containers (default first) | base price @ multBps 10000 | external asOf (ago) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | potato | 馬鈴薯 | Potato | Aloo (आलू) | normal | 60 | 72 | 7 | bori, quintal, kg | 1800 | 300 min |
| 2 | onion | 洋蔥 | Onion | Pyaz (प्याज़) | normal | 80 | 48 | 7 | bori, quintal, kg | 2600 | 1500 min |
| 3 | tomato | 番茄 | Tomato | Tamatar (टमाटर) | perishable | 300 | 6 | 3 | crate, kg | 2400 | 180 min |
| 4 | cauliflower | 花椰菜 | Cauliflower | Gobhi (फूलगोभी) | perishable | 350 | 8 | 3 | crate, kg | 2200 | 4000 min |
| 5 | brinjal | 茄子 | Brinjal (eggplant) | Baingan (बैंगन) | perishable | 250 | 8 | 3 | crate, kg | 2800 | 700 min |
| 6 | maize | 玉米 | Maize | Makka (मक्का) | durable | 20 | 72 | 7 | quintal, bori, kg | 2100 | 2000 min |
| 7 | wheat | 小麥 | Wheat | Gehun (गेहूँ) | durable | 10 | 72 | 7 | quintal, bori, kg | 2500 | 12000 min |
| 8 | rice | 稻米(帶殼) | Rice (paddy) | Dhan (धान) | durable | 10 | 72 | 7 | quintal, bori, kg | 2200 | 1500 min |
| 9 | masoor | 紅扁豆 | Red lentil | Masoor (मसूर) | durable | 10 | 72 | 7 | quintal, bori, kg | 6500 | 5000 min |

7-day base series (day −6 … day 0, minor units per kg at multBps 10000): potato: [2200, 2100, 2000, 1950, 1850, 1800, 1800]; onion: [2600, 2600, 2650, 2550, 2700, 2600, 2600]; tomato: [2800, 2650, 2700, 2550, 2400, 2550, 2400]; cauliflower: [2100, 2100, 2200, 2200, 2100, 2100, 2200]; brinjal: [3150, 3200, 3150, 3000, 2950, 2950, 2800]; maize: [2250, 2300, 2250, 2200, 2100, 2150, 2100]; wheat: [2900, 2850, 2700, 2550, 2650, 2500, 2500]; rice: [2250, 2150, 2050, 2100, 2150, 2150, 2200]; masoor: [6900, 6600, 6900, 6500, 6600, 6600, 6500]

| market | multBps | names | distance km |
|---|---|---|---|
| patna | 10000 | Patna 批發市集 / Patna mandi | hajipur:20, muzaffarpur:75, kolkata:600 |
| hajipur | 9600 | Hajipur 市集 / Hajipur mandi | patna:20, muzaffarpur:55, kolkata:620 |
| muzaffarpur | 9400 | Muzaffarpur 市集 / Muzaffarpur mandi | patna:75, hajipur:55, kolkata:670 |
| kolkata | 12400 | Kolkata 大市集 / Kolkata market | patna:600, hajipur:620, muzaffarpur:670 |

| container | zh / en / local | default g | heaped g | byMarket | byCrop | note |
|---|---|---|---|---|---|---|
| kg | 公斤 / kg / kilo | 1000 | - | - | - |  |
| quintal | 公擔 quintal / quintal / quintal | 100000 | - | - | - | metric quintal = 100 kg (standard definition; not re-verified in this research round) |
| bori | 麻袋 bori / sack (bori) / bori | 50000 | - | - | - | SIMULATED default 50 kg; the classic trap: price per quintal vs per bori differs 2x |
| crate | 塑膠籃 crate / crate / crate | 25000 | - | - | - | SIMULATED default 25 kg |

| payment | zh / en | cash rounding | buyer fee rule | seller fee rule | status |
|---|---|---|---|---|---|
| cash | 現金 / Cash | true | - | - | n/a |
| upi | UPI 轉帳 / UPI transfer | false | - | - | UPI P2P transfers are free (HDFC blog summary, secondary source); the announced MDR on P2M > Rs2,000 from 2026-10-15 is UNVERIFIED and NOT modelled |


**種子資料（全部為模擬）**

| id | name | role | market | stall code | rep (deals / weighChecks / weighOk / onTime / ghosts) | note |
|---|---|---|---|---|---|---|
| u_sunita | Sunita Devi | S | hajipur | 2041 | 6 / 5 / 5 / 6 / 0 | PHONE A |
| u_arun | Arun Kumar | B | patna | 5521 | 14 / 10 / 8 / 13 / 1 | PHONE B |
| u_meena | Meena Traders | B | patna | 3309 | 10 / 7 / 6 / 10 / 0 | mock (bot / seed) |
| u_rakesh | Rakesh Gupta | B | patna | 7714 | 3 / 1 / 1 / 3 / 0 | mock (bot / seed) |
| u_hotel | Hotel Maurya | B | patna | 6102 | 5 / 4 / 4 / 5 / 0 | mock (bot / seed) |
| s_ramesh | Ramesh Prasad | S | muzaffarpur | 8830 | 8 / 6 / 5 / 8 / 0 | mock (bot / seed) |
| s_pooja | Pooja Kumari | S | hajipur | 1276 | 11 / 8 / 7 / 10 / 1 | mock (bot / seed) |
| b_vikas | Vikas S. | B | patna | 9001 | 2 / 0 / 0 / 2 / 0 | mock (bot / seed) |
| b_anita | Anita R. | B | patna | 9002 | 2 / 0 / 0 / 2 / 0 | mock (bot / seed) |

Circle (seller → trusted buyers): {"u_sunita":["u_arun","u_meena","u_rakesh"]}.

| # | crop | market | ago (min) | kg | price/kg | grade | grade-A basis | seller → buyer |
|---|---|---|---|---|---|---|---|---|
| 0 | potato | hajipur | 90 | 500 | ₹17.50 | A | ₹17.50 | s_pooja → b_vikas |
| 1 | potato | hajipur | 400 | 300 | ₹17 | A | ₹17 | s_pooja → b_anita |
| 2 | potato | hajipur | 1300 | 800 | ₹16.50 | B | ₹17.55 | s_ramesh → u_meena |
| 3 | potato | patna | 200 | 400 | ₹18.50 | A | ₹18.50 | s_pooja → u_meena |
| 4 | potato | patna | 900 | 300 | ₹18 | A | ₹18 | s_ramesh → u_rakesh |
| 5 | potato | patna | 1700 | 200 | ₹18.50 | A | ₹18.50 | s_pooja → b_vikas |
| 6 | onion | hajipur | 1000 | 600 | ₹25 | A | ₹25 | s_ramesh → b_anita |

Seed listings (server creates them at reset; listing sequence starts at 7390, so these get codes 73908 and 73916 and the first player listing gets 73924):

| id | seller | crop | market | qty | kg | ask | grade | audience | age |
|---|---|---|---|---|---|---|---|---|---|
| L-seed-1 | s_ramesh | potato | muzaffarpur | 30 bori | 1500 | ₹17.80 | A | public | 60 min |
| L-seed-2 | s_pooja | onion | hajipur | 20 bori | 1000 | ₹26.50 | B | public | 300 min |

Seed wants (buyer pins):

| id | buyer | crop | market | kg | bid/kg | min grade | delivery | payment | age | valid |
|---|---|---|---|---|---|---|---|---|---|---|
| W-seed-1 | u_hotel | potato | patna | 200 | ₹17 | B | pickup | cash | 30 min | 72 h |
| W-seed-2 | u_meena | tomato | patna | 100 | ₹23 | A | pickup | upi | 200 min | 72 h |
| W-seed-3 | u_hotel | maize | patna | 1000 | ₹20.50 | B | deliver | upi | 600 min | 72 h |

Bots: `{"userId":"u_meena","kind":"bidder","cropIds":["potato","tomato"],"firstOfferDelayMin":12,"openBps":9200,"maxBps":9600,"maxGrams":200000,"respondDelayMin":5}`; `{"userId":"u_rakesh","kind":"passer","cropIds":["potato"],"passDelayMin":20}`


**啟動時各作物×市場的參考價**：

`D` = band from deals, `E` = fallback to the simulated external source. Format: mid [low–high] evidence freshness.

| crop \ market | patna | hajipur | muzaffarpur | kolkata |
|---|---|---|---|---|
| potato | D ₹18.50 [₹18–₹18.50] n=3 fresh | D ₹17.50 [₹17–₹17.55] n=3 fresh | E ₹17 [₹15.64–₹18.36] dealsN=0 fresh | E ₹22.50 [₹20.70–₹24.30] dealsN=0 fresh |
| onion | E ₹26 [₹23.92–₹28.08] dealsN=0 aging | E ₹25 [₹23–₹27] dealsN=1 aging | E ₹24.50 [₹22.54–₹26.46] dealsN=0 aging | E ₹32 [₹29.44–₹34.56] dealsN=0 aging |
| tomato | E ₹24 [₹22.08–₹25.92] dealsN=0 fresh | E ₹23 [₹21.16–₹24.84] dealsN=0 fresh | E ₹22.50 [₹20.70–₹24.30] dealsN=0 fresh | E ₹30 [₹27.60–₹32.40] dealsN=0 fresh |
| cauliflower | E ₹22 [₹20.24–₹23.76] dealsN=0 aging | E ₹21 [₹19.32–₹22.68] dealsN=0 aging | E ₹20.50 [₹18.86–₹22.14] dealsN=0 aging | E ₹27.50 [₹25.30–₹29.70] dealsN=0 aging |
| brinjal | E ₹28 [₹25.76–₹30.24] dealsN=0 aging | E ₹27 [₹24.84–₹29.16] dealsN=0 aging | E ₹26.50 [₹24.38–₹28.62] dealsN=0 aging | E ₹34.50 [₹31.74–₹37.26] dealsN=0 aging |
| maize | E ₹21 [₹19.32–₹22.68] dealsN=0 aging | E ₹20 [₹18.40–₹21.60] dealsN=0 aging | E ₹19.50 [₹17.94–₹21.06] dealsN=0 aging | E ₹26 [₹23.92–₹28.08] dealsN=0 aging |
| wheat | E ₹25 [₹21–₹29] dealsN=0 stale | E ₹24 [₹20.16–₹27.84] dealsN=0 stale | E ₹23.50 [₹19.74–₹27.26] dealsN=0 stale | E ₹31 [₹26.04–₹35.96] dealsN=0 stale |
| rice | E ₹22 [₹20.24–₹23.76] dealsN=0 aging | E ₹21 [₹19.32–₹22.68] dealsN=0 aging | E ₹20.50 [₹18.86–₹22.14] dealsN=0 aging | E ₹27.50 [₹25.30–₹29.70] dealsN=0 aging |
| masoor | E ₹65 [₹59.80–₹70.20] dealsN=0 old | E ₹62.50 [₹57.50–₹67.50] dealsN=0 old | E ₹61 [₹56.12–₹65.88] dealsN=0 old | E ₹80.50 [₹74.06–₹86.94] dealsN=0 old |


> Bihar 的「單位陷阱」：Sunita 5 袋 bori（50 kg）＝250 kg 馬鈴薯，₹18.50/kg＝₹925/袋（bori）＝₹1,850/quintal。買方報「₹1,850」時，若理解成每 kg（=₹1,850/kg）會被 `magnitudeGuard`（≥5×）與 `detectUnitSlip`（命中 quintal）攔下。250 kg×₹18.50＝₹4,625（低於回讀門檻 ₹5,000，不需回讀；末兩碼仍是 `25`）。

### 13.4 品級卡（只用「可數指標」，文字是引導不是保證）

- perishable: sample 10 pcs; max bad A/B/C = 1/3/5; zh A: 「抽10顆，壞/軟 ≤1」
- normal: sample 10 pcs; max bad A/B/C = 1/2/4; zh A: 「抽10顆，壞/發芽 ≤1」
- durable: sample 100 grains; max bad A/B/C = 2/5/10; zh A: 「抓100粒，壞粒 ≤2」


---

## 14. i18n（繁體中文＋English）

- **範圍**：`FarmData.i18n = {zh:{key:string}, en:{key:string}}`，起手表已含 **206 個 key**（前綴：app, sk, net, time, role, state, home, f, d, g, s, r, c, n, e, m, rep, w），涵蓋軟鍵、網路/時間、狀態、首頁、欄位、成交單、行情、教練、議價、錯誤碼、空狀態、履約點、秤貨。UI 建置者**擴充**其餘畫面字串（建議命名 `scr.<screenId>.<name>`、`menu.<screenId>.<n>`、`hint.<screenId>.<n>`、簡稱 `<key>.s`）。
- **規則**：①程式碼不得出現可見字串常值（除了資料）；`t(key, params)`＝查表＋`FarmLogic.fmtTpl`（`{n}`、`{t}`、`{x}`、`{no}`…）；②**zh 與 en 的 key 集合必須完全相同**（`logic.test.mjs` 做 parity lint；缺 key 在執行期顯示 key 名並記 console.warn，測試視為失敗）；③金額/公斤/時間**不進字串表**，用 `fmtMoney/fmtKg/fmtClock/agoParts`（`agoParts` 回 `{unit,n}`，再映射到 `time.min/h/d`）；④作物名/容器名/市場名在 pack 內（`names.zh/en/local`）；畫面顯示「中文名或英文名（依語言）＋本地名」，放不下只顯示一個；⑤伺服器錯誤碼→`e.<CODE>`；⑥每個字串都要有 S 版（`.s`）或保證在 17 格內。
- **短語**（跨語言溝通的核心）：`FarmData.phrases`（12 句，以 **phraseId** 儲存在 offer 裡）；`renderPhrase(id, lang)` 依**檢視者的語言**顯示，旁邊附 `[#5]` 供雙語者核對；未知 id 顯示 `#17（更新後可見）`；狀態機/角色過濾用 `phrasesFor`。P09 設定 `final`；P05 附行情查核章；P12 觸發聯絡揭露（P2）。**沒有「先匯款」「點連結」之類短語，詐騙話術面積為零。**

| id | roles | zh | en | note |
|---|---|---|---|---|
| P01 | B | 價錢太高了 | The price is too high |  |
| P02 | B | 貨色不夠好 | The quality is not good enough |  |
| P03 | B | 我買得多，請算量大價 | I buy a lot, please give a volume price |  |
| P04 | B | 我付現，馬上付 | I pay cash, right now |  |
| P05 | B/S | 別處價格更好 | I can get a better price elsewhere | attaches a reference-check stamp (phraseRefCheck) |
| P06 | B | 我要先看貨 | I want to see the goods first |  |
| P07 | B/S | 秤要一起看 | Let's read the scale together |  |
| P08 | B/S | 明天再談 | Let's talk tomorrow |  |
| P09 | B/S | 這是我的最後價 | This is my final price | sets the FINAL flag; only offered when the next proposal is round ≥ finalFromTurn |
| P10 | S | 今天剛採收，很新鮮 | Freshly harvested today |  |
| P11 | B | 我可以自己來取貨 | I can pick it up myself |  |
| P12 | B/S | 請打電話給我 | Please call me | opens the contact-consent flow (P2) |


- 翻譯品質：MVP 只有 zh/en。**豪薩語（ha）、奈及利亞皮欽語、印地語、越南語必須由母語者校對後才能放進 UI**（未做；作物本地名僅為羅馬拼寫欄位，標「待母語者校對」）。正式版流程：LLM 在 CI 階段產出候選→回譯比對→字元長度 lint（每行 ≤17 格）→人工核可→簽章發佈；**執行期只查表**（零延遲、零成本、零幻覺）。

---

## 15. 黃金路徑與情境劇本（**驗收合約**；Demo 引導劇本＝這些步驟）

**起始條件**：`?pack=ng-kano`、`FarmApp.server.reset(1)`、A＝zh・240×320、B＝en・240×320、網路 ok、bots 開、「Musa 是 Amina 的熟人」開、時鐘 06:30（**全程不快轉**），兩支手機都在 `home`。鍵名用 harness 名稱（`ArrowDown`、`Enter`＝OK、`Escape`＝LSK、`Backspace`＝RSK）。

### 15.1 G1：貼單→媒合→議價→成交→行情回寫（S1）— 共 51 鍵（成交前 44 鍵）

| # | 手機 | 按鍵 | 之後畫面（`data-view`）與必須看到的內容（數字為語言中立檢查點） |
|---|---|---|---|
| 1 | A | `1` `1` | `postForm`；標題含「番茄」；單價列提示價帶 `₦440–457`（來源=成交 n=4） |
| 2 | A | `3` `Enter` `Enter` `4` `7` `0` `Enter` `Enter` `Enter` `Enter` | `postReview`；含 `126`（kg）、`₦470`、`₦59,220`；「熟人先看 30 分」「有效 6 小時」 |
| 3 | A | `Enter` `Enter` | 先 `postDone`（大字 `73924`、「已問 3 位熟人」），再回 `home`；`server.getState().listings` 有第 3 張（code `73924`，`grams=126000`，`askMinorPerKg=470`，`audience='trusted'`） |
| 4 | B | `1` `Enter` | `matchList`（三列：番茄 126kg ₦470 淨 +₦8、番茄 210kg ₦455 淨 −₦4、玉米 1000kg ₦445 淨 −₦24；第一列＝ Amina 的單）→ `listingDetail`：`Amina`、`₦470`、`₦59,220`、落地 `₦496`、淨利 `+₦8`、價帶 `₦440–457` |
| 5 | B | `2` | `editOffer`（mode new；單價列顯示 470） |
| 6 | B | `Escape` `1` `1` | 選單→階梯 overlay 列出 `440 / 445 / 450`→選第 1 個：單價列＝`440`，「改了 1/2 格」 |
| 7 | B | `ArrowDown` `ArrowRight` | 理由列＝「The price is too high」（B 是 en） |
| 8 | B | `Escape` `4` | `thread`：`#4821`、`₦440`、`₦55,440`、狀態「等對方」；`server.offers.o4821.state==='AWAIT_SELLER'`；電信層多一則簡訊（給 u_amina） |
| 9 | A | `2` `Enter` | `inbox`（第一列 `●4821 Musa … ₦440` 帶未讀 `+`）→ `thread`：`₦440`、`₦55,440`、**短語以中文顯示「價錢太高了 [#1]」**、教練行「底價 ₦450・建議 ₦455」、Musa 履約點 `◐●●` |
| 10 | A | `2` `4` `5` `5` `Escape` `4` | `editOffer`（counter）→送出→`thread`：`₦455`、`₦57,330`、狀態「等對方」；`o4821.state==='AWAIT_BUYER'`，`turn=2` |
| 11 | B | `Backspace` `Enter` | `inbox`（`●4821 Amina … ₦455`）→ `thread`（en）：`₦455`、`₦57,330`、`Landed ₦481`、`Margin +₦23`、教練「Suggest ₦445」、`You rank 1/1` |
| 12 | B | `1` `3` `0` `Enter` | `sheet`（intent accept）：`126kg × ₦455`、`₦57,330`、`You pay ₦57,330`、提示輸入末兩碼→送出後 `o4821.state==='ACCEPTED'`，`deal.confirm={S:false,B:true}`；畫面「Waiting for other side」；庫存保留 126 kg |
| 13 | A | `Backspace` `Enter` `1` `3` `0` `Enter` | `inbox`（`▲4821 … 待確認`）→ `thread`（狀態「待確認」）→ `sheet`（confirm）→ `o4821.state==='DEALT'`；畫面「✔ 成交 #482188・行情已更新」；`server.trades` 多一筆 `tomato@dawanau ₦455 126000g counted:true` |
| 14 | A | `Backspace` `Backspace` `4` | `ref`：番茄＠Dawanau「成交 ₦455・5筆・剛剛 ●」，區間 `₦440–457`（**n：4→5；中位數 ₦450→₦455**） |
| 15 | B | `Backspace` `Backspace` `4` `ArrowLeft` | `ref`（en）：市場切到 Dawanau，同一組數字（「Deals ₦455 · 5 trades」）——**雙方看到同一份行情** |

**通過條件**：每一步的 `screenText` 含上述數字；`getState(p).screen` 等於所述畫面；全程沒有 JS 錯誤；兩機顯示的成交單數字逐位相同（A 的 `₦57,330 / ₦455 / 126kg` 與 B 相同）；`server.getState()` 掃不到任何底價/上限；一鍵最多一次 DOM 批次。
**數值來源**（可在 node 重現）：`dealSheet('ng-kano', {grams:126000, priceMinorPerKg:455, grade:'A', delivery:'pickup', payment:'cash'}, {cropId:'tomato', originMarketId:'dawanau', buyerMarketId:'sabongari'})` → 總價 57330、落地價 481、落袋價 455、`lastTwo:'30'`；推導見 worked examples `sheet-01`、`sm-01`、`ref-04/05`、`coach-01…09`。

### 15.2 G2：競爭與搶量（S2；接在 G1 第 10 步之後、B 尚未接受之前）

1. `advance(12 分)`：bot Hauwa 建立 `o4822`（60 kg ₦430＝₦25,800）；事件流標「模擬買方 Hauwa」。再 `advance(8 分)`：Ibrahim「這次不要」→ A 的 `myListings` 顯示「1 位熟人這次不要」。
2. A：`Backspace` → `inbox`（第一列 `●4822 Hauwa … ₦430`，其次 `○4821 Musa …`）；`Enter`；`2`；`4` `5` `0`；`Escape` `4`（還價 ₦450，教練建議也是 ₦450）。
3. `advance(5 分)`：Hauwa 接受（總額 ₦27,000，**<₦50,000 不需回讀**）→ `o4822.state==='ACCEPTED'`，庫存保留 60 kg，貨單剩 66 kg。A：`Backspace` `Enter` `1` `Enter` → `DEALT`（該對 7 天內第一筆，`counted:true`）。
4. B：`3` `Enter` `1` `3` `0` `Enter` → 伺服器回 **409 `OVER_STOCK`**：B 回到 `thread`，狀態列「超過剩餘量」（`e.OVER_STOCK`），`o4821` 仍是 `AWAIT_BUYER`；**B 的議價卡在 Hauwa 出價之後顯示「你排 1/2」（自己的 ₦440 高於 Hauwa 的 ₦430），只有名次，看不到 Hauwa 的價**。
5. B：`2`（counter）→ `ArrowDown` `ArrowDown` → 公斤列輸入 `6` `6` → `Escape` `4`（改 1 格：126→66 kg，價 ₦455）→ A 收到並接受（66 kg×₦455＝₦30,030，不需回讀）。

### 15.3 G3：買方入口（S3）

B：`2` `1` `1` `0` `0` `Enter` `4` `4` `5` `Enter` `Enter` `Enter` `Enter` `Enter` `Enter` → `wantDone`（`#12`、「剩 100kg」）。A：`3` → `wantList`（番茄；第一列＝ Musa 的單，**落袋 ₦445**，高於種子單 K Restaurant 的 ₦420）→ `Enter` `1` `Enter`（確認「以 ₦445 供貨 100kg？」）→ `thread`（A 的報價：100 kg×₦445 B 級自取現金＝₦44,500，`AWAIT_BUYER`）→ 之後同 G1。

### 15.4 G4：場邊喊價（S4；單機，不需對方）

A：`6`（喊價檢查；作物預設番茄）`3` `8` `0` → 判斷「低於價帶 14% ▲」（`outsideBps=1364`）、教練「建議還價 ₦450（你的底價）」（`AT_LIMIT`；`suggestCounter` 以價帶上緣 ₦457 當假想要價）、「別處淨得 ₦448」。**驗收：不需要任何 offer 或對方手機**。B 對稱：`6` `4` `8` `0` →「高於價帶 5%（可能付多了）」。

### 15.5 G5：混亂面板

1. `setNetwork('down')`；A 在 G1 第 10 步的還價送出 → `failure` overlay「⚠ 沒送出・OK 重送・返回 取消」；`server.getState()` 沒有新 offer 狀態變化。
2. 「拔電池 A」→ A 重新開機到 `home`；橫幅「⚠ 有 1 件未送出 OK 重送」；`setNetwork('ok')`；A：`Enter`（橫幅）→ `outbox` → `Enter` → 成功「已收到 #4821」。
3. `setNetwork('flaky',{latencyMs:20,timeoutMs:100})`；反覆送出直到出現「已套用但逾時」——重送同一 idemKey 得到**「已送過，不重複」**（`replayed:true`），伺服器只有一筆變更；事件流出現 `replay`。
4. `advance(2 小時)` 不更新：A 的 `ref`/`inbox` 頁尾出現「資料已 2小時（舊）」；按重試/更新後消失。

---

## 16. 正式版架構路徑（規格外的產品路線；簡報用；**MVP 內以模擬呈現**）

### 16.1 架構

```
Cloud Phone 客戶端（雲端渲染，實體按鍵機）
   └─ Widget = 靜態單檔 HTML（HTTPS/CDN；名稱 <10 字元；512×512 PNG 圖示）
         │  fetch（CORS 正確；Idempotency-Key、If-None-Match、Bearer token）
         ▼
Serverless API（例：Cloudflare Workers / AWS Lambda + API Gateway）        ← Transport 同一份路徑/JSON
   ├─ 引擎：`farm-logic.js` 原封在 Node/Worker 內執行（同一份純函式＝同一個數字）
   ├─ 資料：單表 KV/DynamoDB（listings / wants / offers / trades / users / idem / events）；offer 用 `ver` 做條件寫入（CAS）
   ├─ 價格快取：每市場×作物 ≤2 KB JSON，CDN + ETag；排程（cron）每日更新
   ├─ 佇列：SMS 敲門（限流、每單每日 3 則、去重）→ SMS 供應商（**尚未選定**）
   └─ 觀測：結構化事件（等同 Demo 的事件流）、adapter 契約測試
```

- **降級階梯**：`live`（今日資料）→ `cache`（「資料 6 小時前・連不上」）→ `seed`（內建模擬，標「模擬」）。**來源掛掉要標「斷線」，不默默沿用舊值。**
- **無背景執行的對策**：狀態常駐伺服器；手機只是可丟棄的遙控器；所有寫入是「冪等指令＋baseVersion」；待送件匣在 localStorage，重開後由使用者按 OK 才重放。
- **喚醒**：伺服器端**平台外 SMS**（單段、只有「請打開 App，輸入單號」，不含價格/姓名/連結；對方同意才發；每單每日 ≤3 則；同一狀態版本只發一則）。**未證實**：sender ID/退訂規範、誰付費（先由平台吸收並設每筆上限）、按鍵機收得到簡訊（常識推定）、需詢問 CloudMosa 與電信業者。
- **聯絡**：雙方同意後才揭露號碼（只存伺服器）。`navigator.hasFeature('TelScheme')`（**已證實存在**）為 true 才顯示「OK 撥打」；`tel:` 需 client ≥3.1.2 這個版本號**本輪未能重新查證**；越南 Viettel Sumo（client 2.5.0）一律降級成大字顯示號碼。

### 16.2 CI/CD

- CI（GitHub Actions 等）：①**從 `index.html` 抽出 `farm-data`/`farm-logic` 兩段在 Node vm 跑 worked examples＋性質測試**（`tests/logic.test.mjs`）；②headless Chrome 跑 `flow.test.mjs`（雙機 E2E＋混亂網路）；③版面 lint：全部畫面 × 2 尺寸 × 2 角色 × 2 語言跑 `viewLint`＋DOM 量測；④adapter 契約測試（單位換算 quintal→kg、幣別、欄位缺漏）防止單位錯置；⑤靜態檢查：無外部請求、無 infinite animation、檔案 <400 KB；⑥部署：main 合併→上傳靜態檔到 CDN→Serverless 部署→煙霧測試。
- 版本：`pack.version`、`schemaVersion`、伺服器 API 版本標頭；短語新 id 舊客戶端顯示 `#17（更新後可見）`。

### 16.3 真實價格資料源對映（`PriceSource` adapter；**只寫已查證的，其餘標 UNVERIFIED，不得編造欄位**）

| 來源 | 已查證（VERIFIED） | 未查證（UNVERIFIED，上線前必須實測） | 對映到 `external` |
|---|---|---|---|
| **印度 Agmarknet／data.gov.in** 每日 mandi 價 | resource id `9ef84268-d588-465a-a308-a864a43d0070`；欄位 `state, district, market, commodity, variety, grade, arrival_date, min_price, max_price, modal_price`；`GET /resource/{id}`；需 `api-key`（第三方 README 稱公開預設 key 每次最多 10 種商品；**key 放 serverless proxy**） | 單位 ₹/quintal（我的既有認知，本輪檢索文字未出現）、每日更新時間（第三方稱 IST 14:00 後）、瀏覽器直連的 CORS（搜尋結果未提）、授權文字（GODL-India？） | `modal_price`（若確為 ₹/quintal：÷100＝₹/kg，×100＝paise/kg，**數值相同**，例 ₹1,800/quintal＝1,800 paise/kg；**單位確認後才能寫死**）；`asOf=arrival_date`；`min/max` 只當來源自報區間，不進我們的 band |
| **肯亞 KAMIS** | 農業部；宣稱 47 郡各 5 市場；批發/零售/產地價；網站提供 Excel 匯出 | API 規格、授權、更新頻率、CORS | 先以 Excel/CSV 每日匯入到我們的快取 |
| **WFP／HDX 奈及利亞價格** | HDX 有「Nigeria – Food Prices」資料集（maize、rice、beans、fish、sugar 等）；全庫約 98 國；名義每週更新，實際多為月資料 | 授權（我印象是 CC BY-IGO）、是否含 Kano、最後更新日、欄位、CORS | 只當「資料年齡很老」的最後備援；UI 顯示「3 週前」 |
| **WFP DataBridges API** | 有 API（日/週/月序列）與官方 Python client | 認證方式、限流 | serverless 端呼叫，不放前端 |
| **FEWS NET 奈及利亞週價** | HDX 上有資料集（自 2021 起，摘要） | 2026 是否仍更新、市場清單、授權 | 備援 |
| **世界銀行「Nigeria – Monthly food price estimates」** | 73 個市場、2007 至 2026-02、月度估計 | 授權、下載方式 | 只當季節性基準曲線，不當「今天行情」 |
| **FAO FPMA** | 授權 CC BY-NC-SA 3.0 IGO（非商業）；網頁介面，未見公開 API | 更新頻率/單位/粒度 | **不宜當核心來源**（商業化風險） |

- **奈及利亞沒有可靠的每日免費價格 API**：資料年齡（如「3 週前」）必須是一級資訊；最新鮮的一層是**雙方確認的成交價**（本產品的飛輪）。
- adapter 介面：`PriceSource.get({cropId, marketId}) → {priceMinorPerKg, asOf, label, simulated, series?}`；融合＝§7.6（成交優先，外部退場）；**每筆資料都標來源與日期**（同時是防詐騙的信任訊號）。
- **手續費資料**一律版本化資料檔（國家、錢包、`asOf`、`approx`、來源），畫面固定標「近似，以電信商/銀行公告為準」；奈及利亞 OPay/PalmPay/Moniepoint/agent 費率**查不到可靠來源**→使用者自填抽成；印度 UPI P2P 免費、2026-10-15 的新 MDR 只有搜尋摘要（未生效、未驗證）→不建模。

### 16.4 隱私與安全

- 電話、封存值、私人底價/上限不進任何視圖（§9.4）；成交價回寫匿名（不含姓名），價帶要 `n>=3` 才顯示；同一對 7 天只計 1 筆。
- 單碼只揭露貨單不揭露電話；輸入錯 3 次鎖定（伺服器）；短語沒有連結/匯款字樣；簡訊永遠只有「請開 App」。
- 「不宣稱降低詐騙率」；不託管款項、不碰支付；MVP 內所有金額是**示意**。

---

## 17. 驗收與測試

### 17.1 檔案與指令

```
farm-price-mvp/index.html                單檔交付物（四個 script id）
farm-price-mvp/tests/lib.mjs             既有 harness（open()/loadLogic()/suite()）
farm-price-mvp/tests/logic.test.mjs      跑全部 worked examples ＋ 性質測試（金額皆整數、無 NaN/Infinity、容器換算往返、總價單調、非法轉換不改狀態、pack 結構檢查、i18n parity）
farm-price-mvp/tests/flow.test.mjs       G1–G5 雙機 E2E（含 flaky/down、A=zh B=en、兩種尺寸）
farm-price-mvp/docs/LOGIC_API.md         每個 FarmLogic 函式的簽名/回傳/錯誤（附錄 B 為起點）
farm-price-mvp/README.md                 跑法、按鍵表、Demo 劇本、架構圖、正式版路徑、限制與未驗證項、評分對照、如何加地區包
```

`cd tests && node logic.test.mjs && node flow.test.mjs`。

### 17.2 worked examples 怎麼跑

`farm-worked-examples.json`＝`{meta:{runnerContract[], T0, …}, cases:[{id, category, title, fn, args[], expected, note}]}`。Runner：

```js
const L = loadLogic();                                  // tests/lib.mjs
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v==='object') ? Object.keys(v).sort().reduce((o,k)=>{ if(v[k]!==undefined) o[k]=canon(v[k]); return o; },{}) : v;
for (const c of doc.cases) eq(canon(JSON.parse(JSON.stringify(L[c.fn](...JSON.parse(JSON.stringify(c.args)))))), c.expected, c.id);
```

- 比較**與物件鍵順序無關**（`tests/lib.mjs` 的 `eq` 用 `JSON.stringify`，所以兩邊都要先 `canon`）；數字精確比對。
- 類別與數量：units 19、buffer 14、money 23、fees 18、sheet 20、ref 27、match 13、sm 40、coach 30、blind 11、weigh 5、codes 11、rep 4、phrase 10、knock 4、time 3、format 24（共 276 個）。涵蓋：單位換算、輸入緩衝、金額/進位/找零、手續費與斷崖、成交單（含錯誤與 100 噸邊界）、參考價（樣本足/不足/過期/集中/去重/無資料）、媒合排序（同分排序、無參考價、缺貨）、可見性、議價狀態機（合法/非法轉移、逾時、重開、回合上限、最後價、庫存搶量、成交單逾時、封存成交）、教練（退場價、限制、階梯、建議還價各分支、位數守門、單位陷阱、喊價檢查）、盲議價、雙盲秤貨、履約點、短語、敲門、格式、版面 lint、邊界（0、超大、小數、負數、NaN）。**沒有賣/等燈號與拼車分攤的案例（這兩項已砍，見 §3.3）。**
- 重新產生：`cd farm-src && node build-data.js && node gen-examples.js && node verify-examples.js && node prop-check.js`（所有預期值都由 node 執行 `farm-logic.js` 得出）。

### 17.3 驗收清單（每條都能用鍵盤/腳本重現；**失敗＝未完成**）

**A 交付與載入**
- A-01 單檔 `index.html`，雙擊（`file://`）可開；網路面板**零外部請求**（無 CDN/字型/圖片）。
- A-02 `farm-data`、`farm-logic` 兩段可被 `loadLogic()` 在 Node vm 載入，不碰 DOM/`Date.now`/計時器；四個 script id 齊全。
- A-03 載入時無 `pageerror`、`console.error`、`requestfailed`（兩個 `?pack=`、兩種尺寸）。
- A-04 檔案 <400 KB；`FarmApp` 掛勾與 `#screen-A/#screen-B`（含 `data-view/size/lang/role/net/focused`）符合 §10.3、§12。

**B 鍵盤與導覽**
- B-01 §10.1 的鍵正規化（含 harness 事件：`SoftLeft/SoftRight/Escape/Backspace/*/#`、無 `code`、`keyCode` 為 0 的軟鍵）。
- B-02 焦點路由：`Tab`/點擊/`focus()`；按鍵只影響焦點手機（另一支的 `getState` 完全不變）；焦點手機有明顯外框與標籤。
- B-03 從**每個畫面**（含子模式）連按 RSK ≤3 次回 `home`；全部 21 個 harness 鍵在每個畫面都不會丟例外/死路/卡住輸入；`0` 在數字緩衝內可輸入、前導零/超長/`*`/退到空皆正確。
- B-04 `#` 沒有獨立行為（＝`3`）。
- B-05 `ok` 網路下每次按鍵至多一個 DOM 變動批次（MutationObserver）；`304` 不重繪。
- B-06 computed style 與 CSSOM 中沒有 infinite animation、沒有會持續重繪的 transition、沒有 marquee。

**C 版面與可讀性**
- C-01 全部畫面 × {240×320, 128×160} × {賣方, 買方} × {zh, en}：`FarmApp.lint` 全過（無溢出/截字、無 `undefined|NaN|Infinity|[object|{{`）。
- C-02 240×320 內文 ≥12 px；128×160 仍可讀（≥12 px，見尺寸表）；主要數字（總價、單價、末兩碼）用大字。
- C-03 對比 ≥4.5:1；**狀態不只靠顏色**（●○◐▲■✔✖ 形狀＋文字）。
- C-04 即時切換尺寸/語言不丟狀態（同畫面、同緩衝、同焦點）。
- C-05 窄視窗單機顯示；`#screen-A` 永遠是賣方手機；`?phones=1` 有效。

**D 金額與單位**
- D-01 `farm-worked-examples.json` 全過（276）。
- D-02 畫面上每個金額都來自整數運算；亂數/邊界測試無 NaN/Infinity/負的實收；無任何 `Math.round`/浮點金額（靜態檢查）。
- D-03 Kano `mudu` 平口 1.13／堆尖 1.5 kg，Kaduna 約一半；使用者校準覆蓋預設並持久化到 `:calib`；所有預設容器值顯示「約」。
- D-04 Bihar：輸入 ₹1,800 到每 kg 單價（馬鈴薯，行情 ₹17.50）→ `guard`「像是每 quintal 的價？≈ ₹18.00/kg」；₹900 → 每 bori。
- D-05 `calc`：126 kg×₦455 現金＝₦57,330；找零 ₦5,000−₦3,770＝₦1,230＝1000＋200＋20＋10；INR 找零剩 50 paise 零頭要顯示；手續費斷崖 ₦10,020「減 ₦21 可少扣 ₦50」；多品項清單手續費對合計算。
- D-06 兩支手機的成交單數字逐位相同；UI 本機預覽與伺服器 `deal.sheet` 一致（同 terms 同數字）。

**E 參考價**
- E-01 啟動時每個作物×市場的 `state/mid/low/high/n/freshness` 與 §13 表一致（兩個地區包）。
- E-02 `ref` 畫面必有：來源（成交/外部）、筆數、時間、新鮮度形狀、「模擬」標記；`n<3`→外部＋「(+N 筆成交)」；無資料→「資料太少」；stale→「資料舊」且不顯示點值。
- E-03 G1 成交後 `n:4→5`、中位數 `₦450→₦455`；**同一對在 7 天內再成交一筆→`counted:false`，價帶不變，事件流有理由**；`advance(7 天)` 後再成交→`counted:true`。
- E-04 單一買方占權重 >50%→畫面「來源集中」且區間加寬。

**F 媒合與收件匣**
- F-01 `matchList` 依單公斤淨利排序，Kaduna 的低標價貨單排在近的 Dawanau 貨單之後（G1 第 4 步）。
- F-02 熟人先看：Musa 在圈內→立刻看到；把「Musa 是熟人」關掉→看不到；`advance(30 分)`→看到；`trustedOnly` 永遠看不到。
- F-03 收件匣：未讀 `+`、排序規則、4 位單號跳轉、`304` 不重繪、打開才看到新單（不需推播）。
- F-04 `wantList` 依落袋價排序；bid 低於價帶下緣只顯示中性標記。
- F-05 租約：貨單 `advance(5 小時)` 後首頁橫幅「剩 1 小時 OK 續約」；續約（還全有）後 `expiresAt` 重算；超過期限貨單消失於買方找貨。

**G 議價**
- G-01 G1、G2、G3、G4 逐鍵通過（§15）。
- G-02 一次改 3 格被擋（畫面即時＋伺服器 422）；沒改任何格被擋；第 5 回自動最後價；最後價不可還價；`DECLINE` 顯示差距等級而非「拒絕」；`advance` 超過期限→「期限到」；`REOPEN` 一次、第二次被拒。
- G-03 跨語言：B（en）送 P01→A（zh）看「價錢太高了 [#1]」；A 送 P07→B 看「Let's read the scale together [#7]」；`setLang` 即時切換；伺服器資料裡只存 `phraseId`；未知 id 顯示 `#17（更新後可見）`。
- G-04 教練數字與 `FarmLogic` 輸出一致（底價 ₦450、建議 ₦455 / 上限 ₦455、建議 ₦445）；**私人底價/目標只存 `localStorage`，不出現在任何 request body 或 `server.getState()`**。
- G-05 S2：`OVER_STOCK` 只在庫存不足時出現；B 看不到別人的報價（只有名次）。
- G-06 位數守門：₦4,550/kg 需 OK 才能送；回讀：≥₦50,000 必須輸入正確末兩碼，錯誤被拒；小額不需要。
- G-07 冪等/CAS：兩支手機對同一張卡幾乎同時操作→輸家看到「對方剛改過，已更新」，不必重打；重送同 key 不重複套用。

**H 成交單與履約**
- H-01 成交（`DEALT`）寫入 `RefTrade`（含 `priceAEq`、`counted`）；貨單 `soldGrams` 增加、`reservedGrams` 歸零。
- H-02 履約點：`DEALT` 雙方 `deals+1`；成交單逾時→沒確認方 `ghosts+1`；顯示 `n<5→新・n筆`。
- H-03 秤貨（P1）：兩份讀數同時翻牌；綠/黃/紅門檻 1%/3%；重秤最多 2 次；結果重算應付。

**I 隱私與信任邊界**
- I-01 掃描 `server.getState()` 與所有 request body：找不到底價/上限/目標數字（以 G1 的 450/455/445 為探針）。
- I-02 對兩機各做 `GET /offers/:id`：回應中沒有對方的封存值、沒有任何電話。
- I-03 封存議價（P1）：任一方看不到對方數字；兩邊都封存後才有結果；重疊→中點（進位到 ₦5 再夾回）；小差距→可重封一次且限 5%；結果 `SEALED_DEAL` 後雙方仍需在成交單上確認。
- I-04 `Transport` 是唯一跨手機通道：手機端程式碼沒有直接引用伺服器物件（靜態檢查）。

**J 韌性**
- J-01 `down`：讀取→保留快取＋「連不上 OK 重試」；寫入→`failure` overlay＋`outbox`；恢復後 OK 重送成功，**伺服器沒有重複套用**。
- J-02 `flaky`：出現「已套用但逾時」→重送得 `replayed:true`；事件流有 `replay`。
- J-03 資料過期：`advance(2 小時)` 不更新→頁尾「資料已 2小時（舊）」；更新後消失。
- J-04 拔電池：清記憶體、保留 `outbox`/`limits`/`calib`；重開後 `home` 橫幅「有 1 件未送出 OK 重送」；**不自動重放**。
- J-05 `localStorage` 丟例外（禁用/滿）：App 仍可用，只是不記憶（測試以 stub 覆寫 `Storage.prototype` 驗證）。

**K i18n 與地區**
- K-01 zh/en key parity；執行期無缺 key；金額/公斤/時間格式依 pack（NGN 千分位、INR 印度分組與 paise）。
- K-02 兩個地區包都能跑完 G1 同構流程（Bihar：Sunita 5 袋 bori 馬鈴薯 ₹18.50→成交），只差資料；`?pack=` 或 `regionPick` 切換會重置示範。
- K-03 作物本地名（Hausa 羅馬拼寫/Hindi 羅馬拼寫）顯示且不破版；天城文預設不顯示。

**L 誠實與平台**
- L-01 每個資料畫面都有「更新時間＋來源＋模擬」；全站**沒有**「離線模式」字樣與功能；沒有「降低詐騙/提高賣價」之類保證文案（只有「建議/估/約/模擬」）。
- L-02 沒有 `window.close`、外部連結、`<input>`、`target=_blank`、下載、相機；`#` 無獨立功能；沒有 `animation/transition`。
- L-03 電信層面板明示「平台外通道：Cloud Phone 沒有推播」；簡訊內容不含價格/姓名/連結。
- L-04 資料來源說明（設定→資料來源）如實寫：模擬、CBN 草案未定案、奈及利亞錢包費用為自填、Cloud Phone 在奈及利亞是否販售未證實。

**M 文件**
- M-01 README 涵蓋：跑法、按鍵表（桌機/實機）、60 秒 Demo 劇本、架構圖、正式版路徑、限制與未驗證項、評分對照、如何加地區包。
- M-02 `logic.test.mjs`、`flow.test.mjs` 可一鍵執行並全綠；`LOGIC_API.md` 與實作一致。

---

## 18. 冷啟動、防繞過、營運與收費

### 18.1 冷啟動（雙邊平台的第一天）

- **範圍極小**：先在**單一市場×單一作物（番茄）**，**1 個賣方群（20–30 位農民，由既有合作社/熟人介紹）＋5–10 位買方（攤商/餐廳）**起步；貨單先只對熟人開放（熟人先看窗），所以是**放大既有信任**而不是找陌生人配對——「一賣三買就能跑」。
- **買方入口先行**：先招買方（貨源穩定、訂單釘、落地價排序），因為賣方沒有買方每天上線就會流失（eNAM 的教訓）。買方誘因見 §3.2。
- **單邊價值先行**：喊價檢查、算錢/找零、行情帶對**沒有對方 App** 的使用者一樣有用；這是獲客入口，不依賴流動性。
- **第一天的資料很空，要如實顯示**：價帶要 ≥3 筆雙方確認成交（且來源不過度集中）才顯示；否則「資料太少」＋最近的外部資料與日期（奈及利亞外部資料可能是「3 週前」）。Demo 中的種子成交與 bots **全部標「模擬」**，簡報必須說清楚：Demo 證明狀態機與流程通了，**不證明買方會來**。
- **要量測的假設（不是結論）**：貨單→第一個報價的時間；報價→成交轉換；破局率與重議率；買方 7 日回訪；成交價被雙方確認的比例；「結構化報價」對比電話的時間與滿意度。**沒有任何證據顯示「結構化議價減少糾紛」或「資訊抬高實收價」。**

### 18.2 防繞過（不阻止私下成交，讓「記一筆」比「不記」更輕鬆、更有價值）

- 平台**沒有抽成可繞**；價值黏在**成交單（雙方看同一張）、參考價帶（只有雙方確認成交才回寫）、履約點（跨對象累積）、私人教練與退場價**。
- 私下成交後可用 4 位單號/成交碼在**同一張成交單**上補確認（P2 的「談成了嗎？」單鍵回報）；同一對每週只計 1 次履約點——互刷/假帳號只能降低不能根除，**不宣稱解決**。
- 電話號碼只在**雙方同意**後揭露（P2）；但我們接受號碼揭露後仍可能私下成交。
- 競爭對手是電話與 WhatsApp 語音（30 秒談完、免費、可非同步）。平台只在**「比電話更快或更有保障」的場景**取勝：確認貨還在（租約）、算清楚（同一張明細）、有退場價（教練）、留紀錄（成交單）、跨語言（短語）——而不是重做一個聊天室。

### 18.3 營運與收費（**未驗證的商業假設**）

- **不向農民收訂閱、不碰支付/信貸、不抽成交**（抽成最容易被繞過；支付與信貸涉及合規與壞帳）。
- 付費者候選（依 Esoko/Farmerline 教訓「付費者通常是機構」）：①機構買方（餐廳連鎖、加工廠、收購商）的**認證買方方案**（月費，換取貨源儀表與優先看單）；②NGO/政府/開發機構為某作物某區域**贊助**「價格透明＋履約點」公共財；③電信商/錢包的**導流分潤**（與費用透明度功能結合；**是否可行未驗證**）；④匿名價格資料（k 匿名、n≥3）的研究/政策授權（需隱私與授權審查）。
- **公益模式**（建議在競賽簡報主打）：資料公共財＋贊助；買方認證方案補貼營運。
- **CloudMosa 側的變現/上架分潤機制**：本輪未查到，**UNVERIFIED**。

---

## 19. 未決風險與未驗證假設（簡報要誠實列出）

1. **買方是否真的會上線**（流動性）——無證據；Demo 是自導自演，bots 已標模擬。
2. **Cloud Phone 在奈及利亞/itel NEO R60+ 是否販售**——未證實；已證實市場為印度、越南、非洲（南非、馬達加斯加）。Demo 第二個地區選 Bihar 就是為此。
3. **沒有推播＋SMS 通道**：sender ID、退訂規範、費用歸屬、按鍵機收簡訊、對鎖屏預覽洩漏「有大額貨」的風險——皆未確認；MVP 只模擬。
4. **鍵盤行為未在實機/模擬器驗證**：`Backspace` 是否存在、`*` 的 `e.key`、`back` 事件觸發時機、連按/`repeat` 行為、LSK 400 ms；因此 MVP 不把它們當安全機制，全部有降級路徑。
5. **容器公斤數、手續費、運費、腐損係數、品級價差、退場價 5% 折扣、轉售加成 5%、教練讓步比例**皆為**估計/模擬**，畫面一律標「約/估/模擬」；CBN 收費為草案；奈及利亞錢包費率無來源（使用者自填）。
6. **封存議價的策略性謊報與底價可被反推**——已在教學屏說明；只作選配。
7. **雙盲秤貨無法抓出「兩人讀同一把假秤」**；1%/3% 容忍度是預設。
8. **平台不託管款項、無強制力**：付了錢沒收到貨、貨不如描述（按鍵機無相機，品級只能自報）皆未解；只有履約點與抽檢卡輔助。
9. **信譽資料冷啟動**：`n<5` 不顯示；互刷只能降低。
10. **單檔 HTML 的「伺服器」是假的**：`LocalTransport` 只是深拷貝邊界；正式版的信任邊界要靠 Serverless。已提供 Worker 選配與可替換的 fetch 路徑。
11. **字型涵蓋度**（豪薩語特殊字母、天城文）與 Cloud Phone 實際解析度/字級未驗證。
12. **資料來源的 CORS、授權、單位、Kano 覆蓋**未證實（§16.3）；FAO FPMA 為非商業授權。

---

## 附錄 A：worked examples 類別

units 19、buffer 14、money 23、fees 18、sheet 20、ref 27、match 13、sm 40、coach 30、blind 11、weigh 5、codes 11、rep 4、phrase 10、knock 4、time 3、format 24

## 附錄 B：`FarmLogic` 函式清單（起點；細節與行為以 `farm-logic.js` 為準，`LOGIC_API.md` 由建置者 1 補完）

| 函式 | 參數 | 說明 |
|---|---|---|
| `roundDiv` | `n, d` | 整數除法，四捨五入（0.5 遠離 0） |
| `roundToStep` | `minor, step, mode` | 進位到步距（nearest/down/up） |
| `fmtMoney` | `pack, minor, opts` | 格式化金額（千分位/印度分組/paise） |
| `fmtKg` | `grams` | 克→公斤字串（≤2 位小數） |
| `fmtClock` | `ms, tzOffsetMin` | 時間 hh:mm（含時區偏移） |
| `agoParts` | `ageMs` | {unit,n}：now/min/h/d |
| `fmtTpl` | `s, params` | `{k}` 樣板取代 |
| `cellWidth` | `str` | 顯示寬度（格） |
| `truncateCells` | `str, maxCells` | 依格數截斷 |
| `viewLint` | `view, size` | 版面檢查（列數/寬度/壞文字） |
| `luhnCheckDigit` | `payload` | Luhn 檢查碼 |
| `makeListingCode` | `seq` | 序號→5 碼單碼 |
| `verifyListingCode` | `code` | 驗證單碼 |
| `dealCode` | `offerNo` | 單號→6 碼成交碼 |
| `parseDealCode` | `code` | 驗證成交碼 |
| `bufferPush` | `buf, key, opts` | 數字緩衝輸入（`*`＝小數點、無前導零） |
| `bufferValue` | `buf, decimals` | 緩衝→整數（放大 10^decimals） |
| `containerGrams` | `pack, containerId, opts` | 容器公克（校準→市場→作物→預設；平口/尖頂） |
| `toGrams` | `qtyTenths, gramsPerContainer` | 數量（十分之一容器）→克 |
| `perKgFromPerContainer` | `pricePerContainerMinor, gpc` | 每容器價→每 kg 價 |
| `perContainerFromPerKg` | `priceMinorPerKg, gpc` | 每 kg 價→每容器價 |
| `unitMismatch` | `pack, gpcSeller, gpcBuyer, opts` | 兩邊容器換算差距（單位握手） |
| `lineTotal` | `grams, priceMinorPerKg` | 公克×單價→總價（含邊界） |
| `makeChange` | `paidMinor, dueMinor, denominations` | 找零拆面額（含零頭） |
| `feeOf` | `amountMinor, rule, opts` | 手續費（級距/加項/百分比） |
| `feeCliff` | `amountMinor, rule, windowBps` | 手續費斷崖提示（3% 內） |
| `distanceKm` | `pack, a, b` | 市場距離 |
| `freightMinor` | `pack, grams, km` | 運費（含最低運費） |
| `freightPerKg` | `pack, km` | 典型載重的每 kg 運費 |
| `lossBps` | `pack, cropId, km` | 路途腐損 bps |
| `gradeAdjust` | `pack, priceMinor, grade` | A 級價→指定品級價 |
| `normalizeToGradeA` | `pack, priceMinor, grade` | 指定品級價→A 級等值 |
| `dealSheet` | `pack, terms, ctx` | **同一張成交單**（總價/進位/手續費/運費/腐損/落地價/落袋價/回讀/斷崖/守門） |
| `basket` | `pack, lines, paymentId, o` | 多品項合計（手續費對合計算） |
| `externalPrice` | `pack, cropId, marketId, t0` | 模擬 PriceSource |
| `freshnessOf` | `pack, ageMs` | fresh/aging/old/stale |
| `displayPrice` | `pack, minor, freshness` | 依新鮮度降低精度 |
| `weightedQuantile` | `items, num, den` | 整數加權分位數 |
| `referencePrice` | `pack, o` | **參考價帶**（成交加權中位數＋新鮮度；不足→外部；無→none） |
| `magnitudeGuard` | `pack, priceMinorPerKg, refMid` | 位數守門（5 倍） |
| `detectUnitSlip` | `pack, o` | 單位陷阱偵測（每袋/每 quintal 的價打成每 kg） |
| `quoteVerdict` | `pack, o` | 喊價檢查判斷 |
| `exitPriceSeller` | `pack, o` | 賣方外部退場價 |
| `exitPriceBuyer` | `pack, o` | 買方外部退場價（最高可付價） |
| `defaultLimits` | `pack, o` | 預設私人底價/上限與目標 |
| `openingLadder` | `pack, o` | 開價階梯 |
| `suggestCounter` | `pack, o` | 建議還價/接受/先不用 |
| `visibleTo` | `pack, listing, buyerId, circleIds, now` | 熟人先看窗可見性 |
| `rankListings` | `pack, buyer, listings, refsByCrop` | 買方找貨排序（淨利） |
| `rankWants` | `pack, seller, wants, refAtSeller` | 賣方誰要買排序（落袋價） |
| `rankOfOffer` | `myPrice, otherPrices` | 買方名次 |
| `changedFields` | `a, b` | 五格差異 |
| `gapBand` | `pack, sellerPrice, buyerPrice` | 差距小/中/大 |
| `isDue` | `offer, now` | 是否逾期 |
| `expireIfDue` | `offer, now` | 逾期→EXPIRED（含效果） |
| `applyAction` | `offer0, cmd, ctx` | **狀態機**：OFFER/COUNTER/ACCEPT/CONFIRM/DECLINE/REOPEN/SEALED_DEAL |
| `applySequence` | `offer0, cmds, ctx` | 依序套用多個指令（測試/示範） |
| `lastPrices` | `offer` | 雙方最後報價 |
| `blindResolve` | `pack, o` | 封存議價結果 |
| `resealBounds` | `pack, o` | 重封範圍（≤5%） |
| `sealedGuard` | `pack, value, refMid` | 封存值偏離價帶警示 |
| `weighCompare` | `pack, o` | 雙盲秤貨比較（綠/黃/紅） |
| `reputationView` | `pack, s` | 履約點三點 |
| `phrasesFor` | `pack, role, turn` | 可用短語 id |
| `renderPhrase` | `id, lang` | 短語依語言渲染 |
| `phraseRefCheck` | `pack, o` | 行情查核章 |
| `knockAllowed` | `pack, o` | 簡訊敲門限流 |
| `makePrng` | `seed` | mulberry32 種子亂數 |
| `respondMsFor` | `pack, cropId` | 回應期限（依易腐度） |
| `leaseMs` | `pack, cropId` | 租約長度 |

常數 `FarmLogic.CONST`：`MAX_GRAMS`、`MAX_PRICE`、`TERM_FIELDS`、`HOUR`、`DAY`。所有函式需要 pack 者，第一個參數收 pack id 字串或 pack 物件。


## 附錄 C：肯亞（Nakuru）未來地區包種子——M-Pesa 費率（VERIFIED 二手來源，2026；**近似，標 asOf**）

來源：businesstoday.co.ke（2025-12-31），Safaricom 官方頁未能逐格核對；一般慣例是寄款人付轉帳費、收款人付提領費（此點未逐字取得來源）。以下是可直接放進 `payments[]` 的 `FeeRule`（買方付 `send`、賣方付 `withdraw`，單位 KSh，`minorPerMajor=1`）：

```json
{ "id": "mpesa", "cashRounding": false,
  "buyerFee":  { "tiers": [ {"upTo":100,"fee":0}, {"upTo":500,"fee":7}, {"upTo":1000,"fee":13}, {"upTo":1500,"fee":23}, {"upTo":2500,"fee":33}, {"upTo":3500,"fee":53}, {"upTo":5000,"fee":57} ] },
  "sellerFee": { "tiers": [ {"upTo":100,"fee":11}, {"upTo":2500,"fee":29}, {"upTo":3500,"fee":52}, {"upTo":5000,"fee":69} ] },
  "meta": { "status": "secondary source, not checked against Safaricom tariff page", "asOf": "2025-12-31", "approx": true } }
```

以 `FarmLogic.feeOf` 算出的斷崖（node 實測）：KSh 2,500 → 轉帳 33＋提領 29＝**62**；KSh 2,501 → 53＋52＝**105**，**差 43**；`feeCliff(2501)` 回 `above:{atOrBelow:2500, reduceBy:1, saves:20}`（買方那一半）。KSh 100 提領 11（11%）、KSh 500 合計 36（7.2%）。肯亞馬鈴薯依法 50 kg 袋、玉米/豆類常見 90 kg 麻袋（來源見研究）；`gorogoro/debe` 公斤數**未查證**，做成可校準容器。

## 附錄 D：建置者檢查表

- [ ] 先讓 `farm-worked-examples.json` 全綠，再動 UI。
- [ ] 不用 `Math.random`、`Date.now`（除 Transport 的 `?clock=real`）、`structuredClone`、`<input>`、`window.close`、任何外部資源。
- [ ] 每個畫面：L/S 兩套模板、載入/錯誤/空/過期、`viewLint` 全過。
- [ ] 每次寫入都經 outbox＋`Idempotency-Key`；每個讀取都處理 `304`。
- [ ] 私人底價只在 localStorage；伺服器與 API 沒有它。
- [ ] `FarmApp` 掛勾、`data-view`、`Tab` 焦點、單機模式。
- [ ] G1–G5 逐鍵通過；README 寫入 Demo 劇本。
