# 交接說明（2026-09-19）

> **舊版交接紀錄**：其中的議價、成交帳本、收藏與數字選品已於目前版本移除。
> 現行產品架構與驗證方式請先讀 [`ARCHITECTURE.md`](ARCHITECTURE.md) 和根目錄 `README.md`。

Mizani 是 CloudMosa Cloud Phone 競賽（主題 3：農產品即時價格）的參賽作品：給肯亞–烏干達邊境 Busia 的小商販和農夫用的按鍵機 App。這份文件讓接手的人在十分鐘內知道東西在哪、怎麼跑、哪些已經驗證、哪些還沒。

## 〇、這個 repo 裡有兩條線，先分清楚

| | Mizani（Next.js 版） | 同一張單 OneSlip（單檔版） |
| --- | --- | --- |
| 程式 | `app/`、`public/`、`server/`、`tools/` | 根目錄的 `index.html`（一個檔） |
| 文件 | 本檔、`README.md`、`CLAUDE.md`、`docs/ARCHITECTURE.md`、`docs/mizani-architecture.html` | `docs/SPEC.md`（建置規格）、`docs/LOGIC_API.md` |
| 測試 | `npm test`（Vitest，只跑 `app/` 底下） | `cd tests && npm install && npm test`（無頭 Chrome，需要本機有 Chrome） |
| 部署 | **GitHub Actions 建置並發佈的就是這一版** | 不會被建置流程帶上線，要看就直接用瀏覽器開 `index.html` |
| 拍照辨識模型 | 有（本次加入） | 沒有 |

兩條線來自同一天的兩個工作階段，解的是同一題，資料模型和畫面不共用。要合併還是擇一，由團隊決定；在那之前改其中一條不會影響另一條。`archive/` 是更早的單檔原型，僅供參考。

團隊 9/19 的討論整理在 `docs/meeting-notes-2026-09-19.md`，原始逐字稿在 `docs/transcript-2026-09-19.md`（機器轉錄，有錯字）。

## 一、先跑起來

```bash
npm install        # 會自動把 ONNX Runtime 的 wasm 複製到 public/ort/
npm run dev        # http://localhost:3000
npm test           # 38 個單元測試（議價引擎、可信度引擎、辨識排序）
npm run typecheck && npm run lint
```

桌面瀏覽器會看到手機外框和可點的鍵盤；視窗寬度 330px 以下（實機、Cloud Phone 模擬器）自動全螢幕。網址加 `?bare=1` 強制全螢幕、`?size=qq` 看 128×160。

按鍵：`1`–`9` 選品項或輸入數字、方向鍵＋`Enter`、`Esc`（或 `Q`）左軟鍵、`F12`（或 `W`）右軟鍵、`*` 釘選、`#` 換幣別。

## 二、東西在哪

| 位置 | 內容 |
| --- | --- |
| `app/lib/` | 純邏輯，不碰 React：`money.ts` 議價引擎、`trust.ts` 回報可信度、`vision.ts` 拍照辨識、`api.ts` 資料介面、`seed.ts` 示意資料、`catalog.ts` 品項／市場／單位 |
| `app/core/` | 平台層：按鍵對應、畫面堆疊（掛在 History API）、`navigator.hasFeature` 偵測、設定、斷線快取、i18n |
| `app/screens/` | 一個畫面一個檔，對應團隊討論的 D1–D15（對照表在 `docs/ARCHITECTURE.md`） |
| `public/models/` | MobileCLIP-S0 影像模型（22.9 MB）、18 個品項的文字向量、Apple 授權聲明 |
| `server/` | 同一個辨識模型的 API 版（FastAPI，`POST /v1/recognize`），附 Dockerfile |
| `tools/vision/` | 重建品項文字向量、把模型權重壓成 fp16 的腳本 |
| `.github/workflows/deploy.yml` | push 到 `main`：型別檢查 → lint → 測試 → 靜態匯出 → 發佈到 `gh-pages` 分支 |
| `CLAUDE.md` | 給 AI 助手看的專案規則，人也值得讀：平台限制都寫在裡面 |

完整設計（會議整理、Busia 場景、畫面草圖、系統架構、資料模型、API）在 `docs/mizani-architecture.html`。

**App 怎麼操作**（每個畫面的截圖、按鍵、兩分鐘示範腳本、常見問題）在 [`docs/USER_MANUAL.md`](USER_MANUAL.md)。截圖是用無頭 Chrome 自動操作 App 逐頁截的，放在 `docs/manual/`。

## 三、已經驗證的

- 主流程實測：選品項 → 選地區 → 官方價＋回報價 → 輸入數量 → 對方開價的紅黃綠燈、整批差額、建議還價、需求看板上更好的買家 → 成交存帳本，回報人數 7→8、中位數跟著動。
- 需求清單、泡泡地圖（方向鍵跳泡泡、數字鍵直跳）、History、Season、Report、Border & FX 在瀏覽器操作過。
- 防灌水：玉米報 900 被拒收、報 40 被隔離。
- 三種顯示模式：桌面外框、240×320、128×160。
- 拍照辨識：97 張手選的 Wikimedia 照片，在瀏覽器裡實測 top-1 83.5%、**top-3 97.8%**，6 張非農產品全數拒絕，每張約 0.12 秒。模擬 0.08MP 按鍵機相機（320×240、JPEG q55）離線測 top-3 同為 97.8%。
- API 版本機跑過：番茄、omena、玉米正確，人像回空陣列，非圖片回 400。

## 四、還沒驗證的（接手後優先）

1. **Cloud Phone 後台登錄還沒做。** 到 <https://www.cloudphone.tech/my> 用 email 登入，新增 widget：名稱 Mizani、網址填 GitHub Pages 網址、圖示 `public/icon-80.png`（80×80）。然後用後台的模擬器（只支援 Chrome）開。
2. **實機一律沒測過。** 拿到 itel 測試機當天先驗：`navigator.hasFeature('ImageUpload')` 的結果與檔案挑選器能不能直接開相機；左軟鍵是不是 `Escape`、右軟鍵是不是 `back` 事件；`*` 和 `#` 的 `event.key`；16px 字在機上讀不讀得清楚。模擬器不支援上傳檔案，所以拍照辨識只能在實機或一般瀏覽器測。
3. **CloudMosa 的雲端瀏覽器能不能跑 37 MB 的 WASM 模型未知。** 不行的話改走 API：部署 `server/`，建置時設 `NEXT_PUBLIC_VISION_BASE=<網址>`（不是 `NEXT_PUBLIC_API_BASE`，那個是帳號 Worker），前端不用改。
4. 辨識準確率是用網路照片量的，而且那批照片也用來調過品項描述，數字偏樂觀。要用實機拍的照片重量一次（`tools/vision/build_label_embeddings.py --eval <資料夾>`）。
5. 沒在瀏覽器實際操作過的畫面：貼需求、我的帳本、設定（Kiswahili 切換、網路模擬）、`*` 釘選、`#` 換幣別。
6. 所有價格、匯率、需求、季節曲線都是示意資料。真資料來源：KAMIS／KilimoSTAT（肯亞官方日價）、HDX 上的 WFP 月價（肯亞、烏干達）；烏干達的日價來源還沒找到。
7. Kiswahili 字串要請母語者校對；gorogoro、debe、木箱的公斤換算要田調校準。

## 五、容易踩的坑

- **不要換成 Hub 上 11.8 MB 的 int8 量化模型**，實測準確率 0%（這個架構不耐動態量化）。現在用的是「fp16 權重、fp32 運算」，由 `tools/vision/make_fp16_weights.py` 產生。
- **標準 YOLO 不適用**：COCO 的 80 類沒有玉米、豆子、omena、matooke。現在的做法是用文字描述品項，加品項或修誤判只要改 `tools/vision/build_label_embeddings.py` 裡的 `LABELS` 再重跑，不需要訓練資料。
- 常見誤判是外觀相近的：高粱↔小米↔豆子、熟香蕉↔matooke。畫面列前三名讓使用者按數字確認，就是為了吸收這種錯。
- 錢的計算全部是整數、純函式、沒有隨機性，不要把 AI 或浮點數放進 `money.ts`。改 `money.ts` 或 `trust.ts` 一定要補測試——還價公式第一版就是被測試抓到「對方加價、我方要價反而上升」。
- Cloud Phone 的瀏覽器跑在機房，每次畫面更新都花使用者的流量：不要加動畫、轉圈圈、輪詢。
- `#` 和 `3` 共用 keyCode，只能用 `event.key` 判斷。
- 根畫面按右軟鍵會 `window.close()`，但只在 Cloud Phone 上；桌面瀏覽器不會關分頁（`core/router.tsx`）。
- `public/ort/` 是安裝時從 `node_modules` 複製來的，不進 git；`public/_eval/` 是本機測試照片，也不進 git。

## 六、下一步建議

1. 後台登錄＋模擬器跑一輪（上面第四節第 1 點）。
2. 接真資料：先做 KAMIS／WFP 的抓取，寫進 `api.ts` 背後的後端（規劃是 Cloudflare Workers＋D1／KV，端點名稱已經和 `api.ts` 的函式一一對應）。
3. 實機驗證與實機照片的準確率。
4. 簡訊側通道（把價格卡、買家聯絡方式寄到使用者手機），因為 Cloud Phone 沒有離線模式，測試機也不支援 `tel:` 連結。
