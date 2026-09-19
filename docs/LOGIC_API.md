# FarmLogic / FarmData API（給 UI 建置者）

> 以 `index.html` 內 `<script id="farm-logic">`（`window.FarmLogic`）與 `<script id="farm-data">`（`window.FarmData`）的**原始碼實際行為**為準；與規格不符處集中在文末〈與規格不符〉。
> 讀完本文件不必再翻原始碼。所有範例的數值都是實際執行過的（`packs: ng-kano`，`T0 = 1789795800000`）。

## 0. 先看這一頁（慣例與最常踩的坑）

| 項目 | 規則 |
|---|---|
| 金額 | 整數「最小貨幣單位」。NGN：₦1；INR：paise（₹1 = 100）。 |
| 重量 | 整數公克。 |
| 單價 | 整數「最小貨幣單位 / 公斤」（`priceMinorPerKg`）。 |
| 時間 | epoch ms（number）。純函式**不讀時鐘**，`now` 一律由呼叫者傳入。 |
| 除法 | 全部走 `roundDiv`（四捨五入，0.5 遠離 0）；沒有浮點金額。 |
| `pack` 參數 | 收 pack id 字串（`'ng-kano'`、`'in-bihar'`）**或** pack 物件。未知 id → **丟 `Error('UNKNOWN_PACK')`**（唯一會丟的「正常」情況，UI 不該讓它發生）。 |
| 失敗回傳 | 使用者輸入造成的失敗回 `{ ok:false, error:'CODE' }`，不丟例外。成功物件都帶 `ok:true`。 |
| 會丟例外的情形 | ① 未知 pack id；② 未知 `cropId` 給 `lossBps / respondMsFor / leaseMs` 這類直接查表的函式（TypeError）；未知 `grade` 給 `gradeAdjust / normalizeToGradeA` 不會丟，但回 `NaN`；③ 必要的物件參數傳 `null/undefined`（如 `makeChange` 沒給 `denominations`）。這些是程式錯誤，不是輸入錯誤。 |
| 純度 | 不改輸入物件（`applyAction` 內部先 `clone`）。同輸入必得同輸出。 |

### 0.1 回傳形狀速查（**數字 vs 物件**，最容易寫錯）

| 直接回傳 number / string / null | 回傳 `{ok, …}` 物件 |
|---|---|
| `roundDiv`（不合法→`NaN`）、`roundToStep`（不合法→`null`）、`fmtMoney`（非整數→`'—'`）、`fmtKg`（非整數→`'—'`）、`fmtClock`（不合法→`'--:--'`）、`fmtTpl`、`cellWidth`、`truncateCells` | `toGrams`→`{ok,grams}`、`perKgFromPerContainer`→`{ok,priceMinorPerKg}`、`perContainerFromPerKg`→`{ok,pricePerContainerMinor}` |
| `luhnCheckDigit`（number\|null）、`makeListingCode`（string\|null）、`dealCode`（string\|null） | `lineTotal`→`{ok,totalMinor}`、`feeOf`→`{ok,feeMinor}` |
| `distanceKm`（number\|null）、`freightMinor`、`freightPerKg`、`lossBps`、`gradeAdjust`、`normalizeToGradeA` | `gapBand`、`weighCompare`、`blindResolve`、`quoteVerdict`、`referencePrice`、`dealSheet`、`basket`、`externalPrice`、`exitPrice*`、`defaultLimits`、`openingLadder`、`suggestCounter`… |
| `freshnessOf`（'fresh'\|'aging'\|'old'\|'stale'）、`renderPhrase`、`phraseRefCheck`（'supports'\|'unsupported'\|'stale'） | **沒有 `ok` 的物件**：`agoParts`、`displayPrice`、`magnitudeGuard`、`detectUnitSlip`、`resealBounds`、`sealedGuard`、`rankOfOffer`、`reputationView`、`expireIfDue`、`changedFields`（陣列）、`applySequence` |
| `isDue`（boolean）、`visibleTo`（boolean）、`respondMsFor / leaseMs`（ms number）、`phrasesFor`（id 陣列）、`rankListings / rankWants`（陣列）、`lastPrices`（`{S,B}`）、`weightedQuantile`（number）、`makePrng`（函式） | `verifyListingCode`、`parseDealCode`、`bufferValue`、`containerGrams`、`unitMismatch`、`makeChange`、`feeCliff`、`knockAllowed`（失敗時 `{ok:false, reason}`，注意是 `reason` 不是 `error`） |

### 0.2 十個 gotcha

1. **`applyAction` 的 `ctx.respondMs` 必須由呼叫者算好**（`FarmLogic.respondMsFor(pack, cropId)`）。漏傳→`proposal.respondBy` 變 `NaN`，`isDue` 永遠 `false`，單子**永不逾期**。
2. **`applyAction` 的 `ctx.sheetCtx` 必須有 `cropId / originMarketId / buyerMarketId`**。漏傳 `cropId`→ ACCEPT 回 `UNKNOWN_CROP`。
3. **逾期不會自己轉狀態**：`applyAction` 遇到逾期單只回 `{ok:false,error:'EXPIRED'}`；要轉成 `EXPIRED` 狀態並產生 `RELEASE_STOCK`，呼叫者必須另外呼叫 `expireIfDue(offer, now)`（伺服器 `tick` 的工作）。
4. **`dealSheet` 沒給 `originMarketId/buyerMarketId`（或兩者相同，包含兩個都是未知字串）→ `km=0`，運費 0、腐損 0，不報錯。** 只有「兩個不同 id 且查無距離」才回 `UNKNOWN_MARKET_PAIR`。UI 要自己保證市場 id 存在。
5. **`sellerPocketPerKgMinor` 可以是負的**（`delivery:'deliver'` 且量小：1 kg × ₦450、送 Dawanau→Sabon Gari，運費最低 ₦3,000 → 落袋價 `-2550`）。UI 顯示要處理負值（建議提示「運費大於貨款」）。`cashRoundingMinor` 也可為負（往下進位）。
6. **`bufferValue` 不限制長度**：`bufferPush` 預設 `maxLen=8` 才是防線；不經 `bufferPush` 直接餵長字串會得 `scaled` 超過 2^53 仍回 `ok:true`。
7. **`truncateCells` 以 UTF-16 code unit 切**：含 emoji（代理對）時可能切在一對中間。作物 `emoji` 欄位請勿餵給它。
8. **`fmtMoney/fmtKg` 收到非整數（含 `NaN`、`null`）回 `'—'`**，`fmtClock` 回 `'--:--'`；不會出現 `NaN` 字串，但也不會報錯，資料缺漏會被悄悄畫成破折號。
9. **`renderPhrase` 對非 `zh` 的任何語言一律回英文**（`ph[lang] || ph.en`），未知 id 回 `#n（更新後可見）` / `#n (update to view)`。
10. **`gapBand`（DECLINE 存進 `offer.gapBand` 的）多一個 `ok:true` 欄位**：`{ok:true, level, gapBps}`；`level ∈ overlap|small|medium|large`。

---

## 1. 基礎與格式化

### `roundDiv(n, d) → number`
整數除法，四捨五入、0.5 遠離 0。`n`、`d` 必須是有限整數且 `d>0`，否則回 `NaN`（**不丟例外，也不是 `ok:false`**）。
`roundDiv(5,2)===3`、`roundDiv(-5,2)===-3`、`roundDiv(5,0)` → `NaN`。

### `roundToStep(minor, step, mode) → number | null`
把整數進位到 `step` 的倍數。`mode`：`'nearest'`（預設；恰好一半往上）、`'down'`、`'up'`。負數：`'nearest'` 對稱（0.5 遠離 0）；`'down'`＝向 −∞（floor）、`'up'`＝向 +∞（ceil）。`minor`/`step` 非整數或 `step<=0` → `null`。
`roundToStep(57332,5,'nearest')===57330`；`roundToStep(-7,5)===-5`。

### `fmtMoney(pack, minor, opts?) → string`
`opts.forceDecimals:true` 讓整數也顯示小數（INR `₹18.00`）。NGN：`₦18,000`；INR 印度分組：`₹1,23,456.78`，整數 `₹18`。負數 `-₦5`。非整數→`'—'`。
`fmtMoney('ng-kano',1250000)==='₦1,250,000'`。

### `fmtKg(grams) → string`
公克→公斤，四捨五入到 10 g，最多兩位小數、去尾零。`fmtKg(1130)==='1.13'`、`fmtKg(0)==='0'`、`fmtKg(1005)==='1.01'`、`fmtKg(-1130)==='-1.13'`。非整數→`'—'`。

### `fmtClock(ms, tzOffsetMin?) → 'hh:mm'`
`fmtClock(1789795800000, 60)==='06:30'`。`ms` 非整數→`'--:--'`。用 `Date` 但只讀傳入值（UTC 加偏移）。

### `agoParts(ageMs) → {unit, n}`
`unit ∈ 'now'|'min'|'h'|'d'`（`<60s`→now；`<1h`→min；`<24h`→h；其餘 d；皆無條件捨去）。負值或非整數→`{unit:'now',n:0}`。UI 再映射 `time.now/min/h/d`。

### `fmtTpl(s, params) → string`
把 `{name}`（`\w+`）換成 `params.name`；值為 `null/undefined` 的保留原樣 `{name}`。`fmtTpl('更新 {t}・{n}筆',{t:'06:30',n:5})==='更新 06:30・5筆'`。`params.n===0` 會正確替換成 `0`。

### `cellWidth(str) → number`
顯示寬度（格）：CJK／全形／箭頭／幾何符號／`…`／代理對＝2；`A-Z @ % &`＝1.4；天城文＝1.2；其他＝1；結果向上取到 0.1。`cellWidth('番茄 126kg')===10`、`cellWidth('AAA')===4.2`。

### `truncateCells(str, maxCells) → string`
從頭累加 `cellWidth` 至超過 `maxCells` 前一字。`truncateCells('番茄 126kg ₦470/kg',8)==='番茄 126'`。（emoji 注意見 gotcha 7。）

### `viewLint(view, size) → {ok, issues:string[], rowsUsed}`
`view = {title, rows:[{t, big?}], softkeys:{l,c,r}}`；`size ∈ '240x320'|'128x160'`（`FarmData.sizes` 的鍵）。
檢查：`TITLE_TOO_WIDE`、`ROW_<i>_TOO_WIDE`（`big` 列容量為 `floor(cols/2)`、佔 2 列）、`ROW_<i>_BAD_TEXT`（含 `undefined|NaN|Infinity|[object|{{`）、`TOO_MANY_ROWS:<used>><rows>`、`SOFTKEYS_TOO_WIDE`（三鍵字寬和 > `cols-2`）。未知尺寸→`{ok:false, issues:['UNKNOWN_SIZE']}`（沒有 `rowsUsed`）。
尺寸：`240x320`＝26 欄×12 列；`128x160`＝17 欄×8 列。

---

## 2. 編碼與輸入

### `luhnCheckDigit(payload) → number | null`
`payload` 為數字字串；含非數字→`null`。`luhnCheckDigit('7392')===4`。

### `makeListingCode(seq) → string | null`
`seq` 整數 0..9999 → 5 碼（4 位序號補零＋Luhn）。超出→`null`。`makeListingCode(7392)==='73924'`。
### `verifyListingCode(code) → {ok:true, seq} | {ok:false, error}`
錯誤：`BAD_FORMAT`（非 5 位數字）、`BAD_CHECK_DIGIT`。`verifyListingCode('73924')` → `{ok:true,seq:7392}`。

### `dealCode(offerNo) → string | null`
`offerNo` 0..9999 → 6 碼＝4 位單號＋`(no*37+11)%100`（2 位）。`dealCode(4821)==='482188'`。
### `parseDealCode(code) → {ok:true, offerNo} | {ok:false, error}`
錯誤：`BAD_FORMAT`、`BAD_VERIFIER`。

### `bufferPush(buf, key, opts?) → string`
數字輸入緩衝的**純狀態轉移**。`opts = {maxLen=8, maxDecimals=0}`。`key`：`'0'..'9'`、`'*'`（小數點）、`'BACK'`（刪一位）、`'CLEAR'`（清空）；其他 key 原樣回傳緩衝（**注意：鍵名是 `'BACK'`，不是 `'Backspace'`，UI 要先 normalize**）。
規則：`maxDecimals<=0` 時 `*` 無效；空緩衝按 `*`→`'0.'`（需 `maxLen>=2`）；無前導零（`'0'` 再按 `'5'`→`'5'`；`'0'` 再按 `'0'` 維持 `'0'`）；超過長度/小數位的輸入忽略；只能有一個小數點。
`bufferPush('','*',{maxDecimals:1})==='0.'`。

### `bufferValue(buf, decimals) → {ok:true, scaled} | {ok:false, error}`
`scaled = 值 × 10^decimals`（整數）。錯誤：`EMPTY`（空、僅 `.`、含非法字元）、`TOO_MANY_DECIMALS`、`BAD_NUMBER`。`'5.'` 視為 5。
`bufferValue('12.5',1)` → `{ok:true,scaled:125}`。（長度不設限，見 gotcha 6。）

---

## 3. 單位與容器

### `containerGrams(pack, containerId, opts?) → {ok:true, grams, source, approx, heaped} | {ok:false, error:'UNKNOWN_CONTAINER'}`
`opts = {marketId?, cropId?, heaped?, calib?:{[containerId]:grams}}`。解析順序：使用者校準（`calib[containerId]` 為正整數，`source:'user'`、`approx:false`、`heaped:false`——校準值不再套堆尖）→ `byMarket[marketId]`（`source:'market'`）→ `byCrop[cropId]`（`'crop'`；市場優先於作物）→ 預設（`'default'`）。`heaped:true` 只在該筆有 `heapedGrams` 時生效。`approx = container.approx !== false`（畫面凡 `approx` 一律顯示「約」）。
`containerGrams('ng-kano','mudu',{marketId:'kaduna',heaped:true})` → `{ok:true,grams:750,source:'market',approx:true,heaped:true}`。

### `toGrams(qtyTenths, gramsPerContainer) → {ok:true, grams} | {ok:false, error}`
數量以「十分之一容器」整數輸入（`30`＝3.0 籃）。`grams=roundDiv(qtyTenths*gpc,10)`。錯誤：`BAD_INPUT`（非整數、`qtyTenths<0`、`gpc<=0`）、`OVERFLOW`（`grams>MAX_GRAMS`）。
`toGrams(30,42000)` → `{ok:true,grams:126000}`。

### `perKgFromPerContainer(pricePerContainerMinor, gpc) → {ok:true, priceMinorPerKg} | {ok:false,error:'BAD_INPUT'}`
`roundDiv(p*1000, gpc)`。`perKgFromPerContainer(500,1130)` → `{ok:true,priceMinorPerKg:442}`。
### `perContainerFromPerKg(priceMinorPerKg, gpc) → {ok:true, pricePerContainerMinor} | {ok:false,error:'BAD_INPUT'}`
`roundDiv(p*gpc, 1000)`。`perContainerFromPerKg(455,42000)` → `{ok:true,pricePerContainerMinor:19110}`。
往返：`gpc>=1000` 時 `perKg(perContainer(p))===p` 恰好成立；`gpc<1000`（Kaduna mudu）誤差 ≤ `floor(500/gpc+0.5)`。

### `unitMismatch(pack, gpcSeller, gpcBuyer, opts?) → {ok:true, diffBps, level, sellerGrams, buyerGrams, totalDiffMinor?} | {ok:false,error:'BAD_INPUT'}`
單位握手。`diffBps=roundDiv((hi-lo)*10000, lo)`；`level`：`>1000`→`'red'`、`>200`→`'yellow'`、否則 `'ok'`。`opts={qtyTenths, priceMinorPerKg}` 兩者皆整數時多帶 `totalDiffMinor`（同量同價下兩種換算的總額差）。（`pack` 未使用，但仍請傳。）
`unitMismatch('ng-kano',1130,1500,{qtyTenths:100,priceMinorPerKg:450})` → `{diffBps:3274, level:'red', totalDiffMinor:1665, …}`。

---

## 4. 金額、手續費、成交單

### `lineTotal(grams, priceMinorPerKg) → {ok:true, totalMinor} | {ok:false, error}`
`totalMinor=roundDiv(grams*price, 1000)`。錯誤：`BAD_GRAMS`（非整數、`<0`、`>MAX_GRAMS`）、`BAD_PRICE`（非整數、`<0`、`>MAX_PRICE`）。**允許 0**（`dealSheet` 才要求 ≥ minGrams / ≥ 1）。
`lineTotal(126000,455)` → `{ok:true,totalMinor:57330}`。

### `makeChange(paidMinor, dueMinor, denominations) → {ok:true, shortMinor, changeMinor, breakdown:[{denom,count}], remainderMinor, pieces} | {ok:false,error:'BAD_AMOUNT'}`
`paid<due` → `shortMinor=due-paid`，其餘為 0/空。否則貪婪由大到小拆面額，湊不出的零頭在 `remainderMinor`；`changeMinor=breakdown 合計+remainderMinor`。`denominations` 必須是陣列（不用先排序）。
`makeChange(5000,3770,[1000,500,200,100,50,20,10,5])` → `changeMinor:1230`、breakdown `1000×1,200×1,20×1,10×1`、`pieces:4`。

### `feeOf(amountMinor, rule, opts?) → {ok:true, feeMinor} | {ok:false,error:'BAD_AMOUNT'}`
`rule=null` → 0。`rule={tiers:[{upTo|null, fee}], addOn:[{from, fee}], percentBps, minFee, maxFee}`：`tiers` 取第一個 `amount<=upTo`（上限含；`upTo:null`＝其餘）；`addOn` 在 `amount>=from` 時累加；`percentBps` 可被 `opts.bps` 覆蓋；最後套 `minFee`、`maxFee`。`amountMinor` 必須是 ≥0 整數。
NG 轉帳（買方付）：`≤5,000→0`、`5,001–9,999→10`、`10,000–50,000→60`、`>50,000→100`。

### `feeCliff(amountMinor, rule, windowBps=300) → {ok:true, above, below} | {ok:false,error:'BAD_AMOUNT'}`
`above = {atOrBelow, reduceBy, saves} | null`（金額剛越過某斷崖且在視窗內：再減 `reduceBy` 可少扣 `saves`）；`below = {cliffAt, raiseBy, costs} | null`（離上方斷崖視窗內：加 `raiseBy` 會多扣 `costs`）。`rule` 為 null 或無 tiers/addOn → 兩者皆 null。
`feeCliff(10020, NG轉帳規則)` → `above:{atOrBelow:9999, reduceBy:21, saves:50}, below:null`。

### `distanceKm(pack, a, b) → number | null`
同 id→0（**不驗證 id 是否存在**）；查表鍵為兩 id 字母序以 `|` 連接；查無→`null`。`distanceKm('ng-kano','sabongari','dawanau')===14`。
### `freightMinor(pack, grams, km) → number`
`km<=0`（含 `null`、`undefined`→`null<=0`）→0；否則 `max(minMinor, roundDiv(grams*km*minorPerTonKm, 1e6))`。
### `freightPerKg(pack, km) → number`
以 `typicalLoadGrams`（500 kg）估算：`roundDiv(freightMinor(load,km)*1000, load)`；`km<=0`→0。`freightPerKg('ng-kano',14)===6`。
### `lossBps(pack, cropId, km) → number`
`min(lossCapBps, roundDiv(km*crop.lossBpsPer100km, 100))`。未知作物→TypeError。
### `gradeAdjust(pack, priceMinor, grade) → number`
A 級價→指定品級價：`roundDiv(price*(10000+gradeBps[grade]), 10000)`。`gradeAdjust('ng-kano',457,'B')===430`。
### `normalizeToGradeA(pack, priceMinor, grade) → number`
反向：`roundDiv(price*10000, 10000+gradeBps[grade])`。`normalizeToGradeA('ng-kano',430,'B')===457`。（兩者對未知 grade 會產生 `NaN`，不報錯。）

### `dealSheet(pack, terms, ctx) → sheet | {ok:false,error}` ★同一張成交單
```
terms = { grams, priceMinorPerKg, grade:'A'|'B'|'C', delivery:'pickup'|'deliver', payment:<pack.payments[].id> }
ctx   = { cropId, originMarketId, buyerMarketId, userFeeBps?, refMid? }
```
錯誤（依檢查順序）：`UNKNOWN_CROP`、`BAD_GRAMS`（非整數、`<pack.minGrams`(1000)、`>MAX_GRAMS`；`terms` 為 null 也是這個）、`BAD_PRICE`（非整數、`<1`、`>MAX_PRICE`）、`BAD_GRADE`、`BAD_DELIVERY`、`BAD_PAYMENT`、`UNKNOWN_MARKET_PAIR`、`ALL_LOST`（自取且腐損吃光 → `sellable<=0`）。
成功回傳（全是整數，除註明者）：

| 欄位 | 意義 |
|---|---|
| `terms` | 拷貝後的五格 |
| `totalMinor` | `roundDiv(grams*price,1000)` |
| `amountDueMinor` | 現金（`cashRounding`）進位到 `cashStep`，其餘＝total |
| `cashRoundingMinor` | `due - total`（**可為負**） |
| `buyerFeeMinor` / `sellerFeeMinor` | 手續費（賣方費可由 `ctx.userFeeBps` 覆蓋百分比） |
| `buyerPaysMinor` / `sellerGetsMinor` | `due+buyerFee` / `due-sellerFee` |
| `km`, `freightMinor` | 距離、運費（同市場 0；否則不低於 `freight.minMinor`） |
| `buyerFreightMinor` / `sellerFreightMinor` | 自取＝買方付；送到＝賣方付（互斥） |
| `lossBps`, `lossGrams` | 路途腐損（送到時也會算出，但 `sellable` 不扣） |
| `sellableGrams` | 自取＝`grams-lossGrams`；送到＝`grams` |
| `buyerLandedPerKgMinor` | `roundDiv((buyerPays+buyerFreight)*1000, sellable)` |
| `sellerPocketPerKgMinor` | `roundDiv((sellerGets-sellerFreight)*1000, grams)`（**可為負**） |
| `readbackRequired` | `floor(due/minorPerMajor) >= pack.readbackMinMajor`（NG 50,000；IN 5,000） |
| `lastTwo` | `String(floor(due/minorPerMajor)%100).padStart(2,'0')`（**字串**） |
| `cliff` | 買方手續費規則的 `feeCliff` 結果；買方無手續費→`null` |
| `magnitude` | `ctx.refMid` 有給→`magnitudeGuard` 結果；否則 `null` |

`dealSheet('ng-kano',{grams:126000,priceMinorPerKg:455,grade:'A',delivery:'pickup',payment:'cash'},{cropId:'tomato',originMarketId:'dawanau',buyerMarketId:'sabongari'})` → `totalMinor:57330, freightMinor:3000, lossBps:42, lossGrams:529, buyerLandedPerKgMinor:481, sellerPocketPerKgMinor:455, readbackRequired:true, lastTwo:'30'`。

### `basket(pack, lines, paymentId, o?) → {ok:true, lines, totalMinor, amountDueMinor, buyerFeeMinor, sellerFeeMinor, buyerPaysMinor, sellerGetsMinor, cliff} | {ok:false,error}`
多品項合計，**進位與手續費對合計算**。`lines=[{cropId, grams, priceMinorPerKg}]`；`o.userFeeBps` 覆蓋賣方百分比。錯誤：`BAD_PAYMENT`、`EMPTY`（空陣列）、`BAD_GRAMS`/`BAD_PRICE`（附 `line:<index>`）。回傳的 `cliff` 在有買方手續費時是 `{ok:true,above,below}`（含 `ok`），否則 `null`。
（不驗證 `cropId`、不算運費/腐損。）

---

## 5. 參考價（共同價帶）

### `externalPrice(pack, cropId, marketId, t0) → {ok:true, priceMinorPerKg, asOf, series, trend7dBps, label, simulated:true} | {ok:false,error:'NO_SOURCE'}`
模擬 PriceSource：`series` 為 7 日基準價 × `market.multBps` 進位到 `priceStep`；`priceMinorPerKg` 為最後一日；`asOf = t0 - asOfAgoMin*60000`；`trend7dBps=roundDiv((last-first)*10000, first)`；`label = pack.priceSourceLabel`（`{zh,en}` 物件）。作物或市場不存在→`NO_SOURCE`。
`externalPrice('ng-kano','tomato','dawanau',T0)` → `priceMinorPerKg:425, asOf:1789790400000, trend7dBps:-341`。
**這個回傳物件可直接當 `referencePrice` 的 `o.external`。**

### `freshnessOf(pack, ageMs) → 'fresh'|'aging'|'old'|'stale'`
`≤freshHours(6h)`→fresh、`≤agingHours(72h)`→aging、`≤oldHours(168h)`→old、其餘 stale（含端點）。負 age→`'fresh'`；`NaN`→`'stale'`。

### `displayPrice(pack, minor, freshness) → {minor, approx, hidden}`
fresh：精確；aging：進位到 `display.agingStep`、`approx:true`；其他（含 `'none'`）：`{minor:null, approx:true, hidden:true}`（只顯示區間）。

### `weightedQuantile(items, num, den) → number`
`items=[{v,w}]` 需已依 `v` 由小到大排序；回第一個使 `cumW*den >= totalW*num` 的 `v`。空陣列→TypeError。

### `referencePrice(pack, o) → ref | {ok:false,error:'UNKNOWN_CROP'}`
```
o = { cropId, marketId, now, trades:[{id?, cropId, marketId, at, grams, grade?='A', priceMinorPerKg, priceAEq?, buyerId?, counted?}],
      external: {priceMinorPerKg, asOf, simulated?}|null }
```
納入條件：同作物同市場、`counted!==false`、`0 <= now-at < refWindowDays*DAY`。價格換算成 A 級等值（`priceAEq` 有就用）；權重 `= max(decayFloorPermille, 1000-roundDiv(age*1000,window)) × clamp(floor(grams/1000),1,sizeCapKg)`。

| 情況 | 回傳 |
|---|---|
| 納入筆數 `n >= 3`（`ref.minTrades`） | `state:'deals'`，`mid/low/high`＝加權 1/2、1/5、4/5 分位；同一 `buyerId` 權重 >50% → `concentrated:true` 且 `low×0.95`、`high×1.05`；`sourceLabel:'deals'`、`simulated:false`、`asOf`＝最新一筆 |
| `n < 3` 且 `external.priceMinorPerKg` 為整數 | `state:'external'`，`mid=external.price`，`spread=8%`（`stale`時 ×2），`n:0`、`dealsN:n`（畫面「(+n 筆成交)」）、`sourceLabel:'external'`、`simulated: external.simulated !== false`、`asOf=external.asOf` |
| 兩者都沒有 | `state:'none'`：`mid/low/high/ageMs/asOf` 皆 `null`、`freshness:'none'`、`stale:true`、`sourceLabel:'none'` |

共通欄位：`ok:true, state, mid, low, high, n, dealsN, ageMs, freshness, stale, concentrated, asOf, sourceLabel, simulated, gradeBasis:'A'`。**所有價格都是 A 級基準**；顯示某品級時再用 `gradeAdjust`。
`referencePrice` 不驗證 `marketId`；`state:'none'` 仍是 `ok:true`（UI 要看 `state`）。

---

## 6. 守門、單位陷阱、行情查核

### `magnitudeGuard(pack, priceMinorPerKg, refMid) → {level, ratioBps?}`
`price >= refMid*5`→`'high'`；`price*5 <= refMid`→`'low'`（含等號）；否則 `'ok'`；`refMid` 非正整數或 `price` 非整數→`{level:'na'}`（無 `ratioBps`）。`magnitudeGuard('ng-kano',2250,450)` → `{level:'high',ratioBps:50000}`。

### `detectUnitSlip(pack, o) → {suspect: null | {containerId, gramsPerContainer, impliedPerKgMinor}}`
`o={cropId, marketId, typedMinor, refMid}`。對該作物每個非 `kg` 容器算 `expected=roundDiv(refMid*gpc,1000)`；`typed/expected` 落在 75%–125% 且 `typed>=2*refMid` → 疑似「把每容器價打在每 kg 欄」，取最接近者。作物未知或 `refMid` 非正整數→`{suspect:null}`。
`detectUnitSlip('in-bihar',{cropId:'potato',marketId:'hajipur',typedMinor:180000,refMid:1800})` → `suspect:{containerId:'quintal', gramsPerContainer:100000, impliedPerKgMinor:1800}`。

### `quoteVerdict(pack, o) → {ok:true, position:'na',signal:'na'} | {ok:true, position, signal, vsMidBps, outsideBps, low, mid, high}`
`o={role:'S'|'B', priceMinorPerKg, ref(referencePrice 結果), grade?='A'}`。`ref` 為空或 `ref.mid==null`→`na`。`low/mid/high` 已調成該品級。`position ∈ below|inside|above`；`signal`：`inside→'fair'`；賣方 below→`'caution'`、above→`'good'`；買方相反。`outsideBps`＝超出帶邊緣的比例（inside＝0）。

### `phraseRefCheck(pack, o) → 'supports'|'unsupported'|'stale'`
`o={role, priceMinorPerKg, exitMinor, freshness}`。`exitMinor==null` 或 `freshness ∈ stale|none|old` → `'stale'`。買方：`exitMinor < price` → `supports`；賣方：`exitMinor > price` → `supports`；其餘 `unsupported`。

---

## 7. 退場價、私人限制、開價階梯、建議還價（教練）

以下都用「A 級基準的 `mid`」與「每公斤價」；不含網路資料，**私人底價只存本機**。

### `exitPriceSeller(pack, o) → {ok:true, priceMinorPerKg|null, viaMarketId|null, alternatives:[{marketId,km,netMinorPerKg}]}`
`o={cropId, originMarketId, grade?='A', refMidByMarket:{marketId: mid}}`。對每個 ≠origin 且 `refMidByMarket` 有值、有距離的市場算 `net = round((gradeAdjust(mid)*(1-loss) - freightPerKg) * (1-exitFrictionBps))`；`alternatives` 依 net 大→小（同值依 marketId）；`priceMinorPerKg` ＝最高者。無替代→`null`。
### `exitPriceBuyer(pack, o) → {ok:true, priceMinorPerKg|null, viaMarketId|null, alternatives:[{marketId,km,landedPerKgMinor}]} | {ok:false,error:'UNKNOWN_MARKET_PAIR'}`
`o` 另加 `buyerMarketId`。`priceMinorPerKg`＝「在 origin 取貨的最高可付價」（`walk`）；買方自己的市場也是替代（`km=0`）。**`walk` 在遠距離下可能很小甚至 ≤0（例：買方在 Lagos → `276`）；`defaultLimits` 會直接拿去當上限。**
### `defaultLimits(pack, o) → {ok:true, limit, target}`
`o={role:'S'|'B', ref(origin 的 referencePrice), exitMinor?, grade?='A'}`。賣方：`limit=roundUp(max(exit, low), priceStep)`、`target=roundUp((mid+high)/2)`；買方：`limit=roundDown(min(exit, high))`、`target=roundDown((low+mid)/2)`（`low/mid/high` 先調品級）。`ref` 空或 `mid==null`→`{limit:null,target:null}`。
### `openingLadder(pack, o) → {ok:true, rungs:number[]}`
`o={role, ref:{low,mid,high}(已調品級), limit?}`。買方 `[low,(low+mid)/2,mid]` 向下取 `priceStep`、夾在 `≤limit`；賣方 `[high,(mid+high)/2,mid]` 向上取、夾在 `≥limit`；去重。`ref` 空→`rungs:[]`。
### `suggestCounter(pack, o) → {ok:true, advice, reason, priceMinorPerKg|null, markFinal, concedeMinor?}`
`o={role, myLast, theirLast, limit?, target?, turn, maxTurns, finalFromTurn?, concessions?}`。判斷順序：
1. 對方價不劣於我上次價（賣方 `their>=my`、買方 `their<=my`）**或**已達 target → `accept / AT_TARGET`；
2. 在限制內且 `turn+1>=maxTurns` → `accept / LAST_TURN_OK`；超限且最後機會 → `decline / BELOW_LIMIT_FINAL`（`priceMinorPerKg:null`）；
3. 否則讓步 `concede=roundDiv(|my-their|*coachRatiosBps[min(concessions,4)],10000)`，賣方向下、買方向上（各取到 `priceStep` 對己方有利的倍數），夾在 limit；若結果不比對方價更好→`accept / MET_IN_MIDDLE`；否則 `counter`，`reason` 為 `SPLIT` 或（被夾住時）`AT_LIMIT`，`markFinal = AT_LIMIT && turn+1 >= finalFromTurn(3)`。
只是「建議」，UI 文案不得寫成保證。

---

## 8. 媒合

### `visibleTo(pack, listing, buyerId, circleIds, now) → boolean`
`listing.status` 存在且非 `'open'`→false；`expiresAt!=null && now>=expiresAt`→false；`audience==='public'`→true；買方在 `circleIds`→true；否則 `!listing.trustedOnly && now >= createdAt + trustedWindowMin*60000`（含端點）。
### `rankListings(pack, buyer, listings, refsByCrop) → rows[]`
`buyer={marketId, payment?='cash', wantGramsByCrop?}`；`listings[]` 需帶 **`remainingGrams`**（＝grams-soldGrams-reservedGrams，**函式不會自己算**）、`id, cropId, marketId, askMinorPerKg, grade, confirmedAt?`；`refsByCrop[cropId]`＝買方市場的 `referencePrice` 結果。`remainingGrams < minGrams` 的略過；`dealSheet` 失敗的靜默略過。
每列：`{listingId, grams, landedPerKgMinor, anchorPerKgMinor|null, marginPerKgMinor|null, marginTotalMinor|null, freightMinor, lossBps, confirmedAt}`。排序：margin 大→小（`null` 最後）→`confirmedAt` 新→舊→`listingId`。`anchor = gradeAdjust(ref.mid)×(1+resaleUpliftBps)`。
### `rankWants(pack, seller, wants, refAtSeller) → rows[]`
`seller={marketId, stockGrams?}`；`wants[]` 需 `id, cropId, marketId, remainingGrams, bidMinorPerKg, minGrade, delivery, payment, createdAt?`；`refAtSeller[cropId]`＝賣方市場的 ref。每列 `{wantId, grams, pocketPerKgMinor, totalMinor, belowBandBps|null, createdAt}`；依落袋價大→小、先掛單者先、`wantId`。`belowBandBps` 中性標示，非 `null` 時代表 bid 低於價帶下緣的比例。
### `rankOfOffer(myPrice, otherPrices) → {rank, of}`
`rank = 1 + 高於我的價格數`，`of = others+1`。

---

## 9. 議價狀態機

### 9.1 資料形狀
```
Offer = { id, no, listingId|null, wantId|null, sellerId, buyerId,
          state:'AWAIT_SELLER'|'AWAIT_BUYER'|'ACCEPTED'|'DEALT'|'DECLINED'|'EXPIRED',
          prevState, expiredReason:'respond'|'sheet'|null, turn, maxTurns,
          proposal:{by, terms, final, phraseId|null, at, respondBy},
          history:[{turn, by:'S'|'B'|'SYS', action, terms?, phraseId?, final?, at, ver, changed?, reason?}],
          reopens, deal:null|{terms, sheet, issuedAt, deadline, acceptedBy:'S'|'B'|'SYS', confirm:{S,B}},
          declineBy, gapBand:null|{ok,level,gapBps}, ver }
```
不變式：成功轉移後 `ver += 1` 且 `history.length === ver`；`turn` 是已提出的提案數。

### `applyAction(offer0, cmd, ctx) → {ok:true, offer, event, effects} | {ok:false, error, offer}`
```
cmd = { type:'OFFER'|'COUNTER'|'ACCEPT'|'CONFIRM'|'DECLINE'|'REOPEN'|'SEALED_DEAL',
        by:'S'|'B' (SEALED_DEAL 另可 'SYS'), at:<ms>, baseVer, terms?, phraseId?, final?, last2?, meta?, priceMinorPerKg? (僅 SEALED_DEAL) }
ctx = { pack, respondMs, remainingGrams?, listingGrade?, listingOpen?, sheetCtx:{cropId, originMarketId, buyerMarketId, userFeeBps?}, askMinorPerKg? }
```
- `offer0` 為建立前用 `null`。成功的 `offer` 是**新物件**（輸入不被改）。失敗時 `offer` 是**傳入的同一個物件**（`OFFER` 驗證失敗時是 `null`）；狀態一律不變。
- `event = {type, from, to, by, turn, changed?, final?}`（`from` 對 `OFFER` 為 `null`）。
- `effects` 陣列元素：`{type:'RESERVE_STOCK', grams}`、`{type:'RELEASE_STOCK', grams}`、`{type:'RECORD_TRADE', terms, sheet}`。
- `OFFER` 的 `cmd.meta = {id,no,listingId,wantId,sellerId,buyerId}` 直接寫進 offer；`cmd.baseVer` 對 `OFFER` 無作用。
- `ACCEPT`/`SEALED_DEAL`/`CONFIRM` 的 `last2` 是**兩位數字字串**（與 `sheet.lastTwo` 以 `String()` 比較）。

**檢查順序（決定同時多個錯誤時回哪一個）：**
`BAD_ACTOR` → （`OFFER`：`ILLEGAL_STATE`（已有單）→ 條款驗證 `validateTerms`）→ `NOT_FOUND`（offer 為 null）→ `STALE_VERSION`（`cmd.baseVer !== offer.ver`）→ `EXPIRED`（`isDue` 且不是 REOPEN）→ 終態 `ILLEGAL_STATE`（DEALT/DECLINED）→ 已是 `EXPIRED` 狀態且非 REOPEN → `EXPIRED` → 各指令自己的規則。

**轉移表（實際行為）**

| 指令 \ 狀態 | 無 | AWAIT_x（我被等） | AWAIT_x（我在等） | ACCEPTED | DEALT/DECLINED | EXPIRED |
|---|---|---|---|---|---|---|
| `OFFER` | ✓→AWAIT_對方（turn 1、ver 1） | `ILLEGAL_STATE` | 〃 | 〃 | 〃 | 〃 |
| `COUNTER` | `NOT_FOUND` | ✓→AWAIT_對方 | `NOT_YOUR_TURN` | `ILLEGAL_STATE` | 〃 | `EXPIRED` |
| `ACCEPT` | `NOT_FOUND` | ✓→ACCEPTED（效果 RESERVE_STOCK；接受方自動確認） | `NOT_YOUR_TURN` | `ILLEGAL_STATE` | 〃 | `EXPIRED` |
| `CONFIRM` | `NOT_FOUND` | `ILLEGAL_STATE` | 〃 | ✓→DEALT（未確認方；已確認→`ALREADY_CONFIRMED`；效果 RECORD_TRADE） | `ILLEGAL_STATE` | `EXPIRED` |
| `DECLINE` | `NOT_FOUND` | ✓→DECLINED | ✓→DECLINED（＝撤回） | ✓→DECLINED 僅未確認方（效果 RELEASE_STOCK；已確認者→`ILLEGAL_STATE`） | `ILLEGAL_STATE` | `EXPIRED` |
| `REOPEN` | `NOT_FOUND` | `ILLEGAL_STATE` | 〃 | 〃 | 〃 | ✓ 一次（否則 `REOPEN_LIMIT`／`LISTING_CLOSED`／`OVER_STOCK`） |
| `SEALED_DEAL` | `NOT_FOUND` | ✓→ACCEPTED（雙方都未確認；價格＝`cmd.priceMinorPerKg`） | ✓（同左） | `ILLEGAL_STATE` | 〃 | `EXPIRED` |
| 其他 `type` | `NOT_FOUND` | `UNKNOWN_ACTION` | 〃 | 〃 | `ILLEGAL_STATE` | `EXPIRED` |

`COUNTER` 額外規則（依序）：對方提案是 `final` → `FINAL_LOCKED`；`turn>=maxTurns` → `MAX_TURNS`（實務上不會出現：第 5 個提案必為 final，會先回 `FINAL_LOCKED`）；條款驗證失敗（`BAD_TERMS/BAD_GRAMS/BAD_PRICE/BAD_GRADE/BAD_DELIVERY/BAD_PAYMENT/GRADE_NOT_OFFERED/OVER_STOCK`）；改 0 格→`NO_CHANGE`；改 >2 格→`TOO_MANY_FIELDS`（`maxChangedFields`）；`cmd.final` 且新回合 `<3` → `FINAL_TOO_EARLY`。新提案 `final = cmd.final || 新回合>=maxTurns(5)`。
`ACCEPT`：`terms.grams > ctx.remainingGrams` → `OVER_STOCK`；`dealSheet` 失敗 → 該錯誤碼；`readbackRequired` 時 `last2` 缺→`READBACK_REQUIRED`、不符→`READBACK_MISMATCH`。`CONFIRM` 同理。
`REOPEN`：`reopens>=maxReopens(1)` → `REOPEN_LIMIT`；`ctx.listingOpen===false` → `LISTING_CLOSED`（`undefined` 視為開）；`expiredReason==='sheet'` 時庫存不足 → `OVER_STOCK`、回 `ACCEPTED`（確認保留、期限重設 +24h、效果 RESERVE_STOCK）；`'respond'` 時回 `prevState` 並重設 `respondBy`。
`DECLINE`：`offer.gapBand = gapBand(賣方最後價（沒提過用 ctx.askMinorPerKg）, 買方最後價)`，任一缺→`null`。

### `isDue(offer, now) → boolean`
`AWAIT_*`：`now > proposal.respondBy`；`ACCEPTED`：`now > deal.deadline`；其他 false。**恰等於期限不算逾期。**
### `expireIfDue(offer, now) → {changed, offer, effects}`
未逾期→`{changed:false, offer:<同一個物件>, effects:[]}`。逾期→新 offer：`state:'EXPIRED'`、`prevState`＝原狀態、`expiredReason`＝`ACCEPTED`?`'sheet'`:`'respond'`、`ver+1`、history 加 `{by:'SYS', action:'EXPIRE', reason}`；原本是 `ACCEPTED` 才有 `RELEASE_STOCK`。
### `applySequence(offer0, cmds, ctx) → {steps, final}`
依序套用（`baseVer` 缺→自動用當前 `offer.ver`）。`steps[i] = {ok:true,type,by,state,turn,ver,final,effects:[type…]} | {ok:false,type,by,error,state}`；`final = {state,turn,ver,price,gapBand,reopens}`，若 offer 仍為 null 則 `final:null`。失敗步驟不改 offer。給測試/示範用，伺服器請用 `applyAction`。
### `changedFields(a, b) → string[]`
比較五格（`FarmLogic.CONST.TERM_FIELDS`）回不同的欄位名。
### `lastPrices(offer) → {S:number|null, B:number|null}`
掃 history 中 `OFFER/COUNTER` 的 `terms.priceMinorPerKg`。
### `gapBand(pack, sellerPrice, buyerPrice) → {ok:true, level, gapBps} | {ok:false,error:'BAD_PRICE'}`
`buyer>=seller`→`{level:'overlap',gapBps:0}`；否則 `gapBps=roundDiv((s-b)*10000,s)`，`<gapSmallBps(500)`→small、`<gapMediumBps(1500)`→medium、其餘 large。`sellerPrice<=0` 或 `buyerPrice<0` 或非整數→`BAD_PRICE`。

---

## 10. 封存議價（P1）與雙盲秤貨（P1）

### `blindResolve(pack, o) → {ok:true, deal:true, priceMinorPerKg, midRaw} | {ok:true, deal:false, gapBps, level, canReseal} | {ok:false,error:'BAD_PRICE'}`
`o={floor, ceiling, round?=1}`，兩者需 ≥1 整數。`ceiling>=floor`→成交價＝中點進位到 `priceStep` 最近倍數再夾回 `[floor,ceiling]`。否則 `level` 同 `gapBand`，`canReseal = level==='small' && round<maxRounds(2)`。
### `resealBounds(pack, o) → {min, max}`
`o={role, prev}`。賣方 `[ceil(prev*0.95), prev]`；買方 `[prev, floor(prev*1.05)]`（`resealMaxConcedeBps=500`）。
### `sealedGuard(pack, value, refMid) → {far:boolean, deviationBps?}`
偏離 `refMid` 超過 `farFromBandBps(2500)` → `far:true`。`refMid` 非正整數→`{far:false}`（無 `deviationBps`）。
### `weighCompare(pack, o) → {ok:true, level, diffGrams, diffBps, agreedGrams|null, diffMinor} | {ok:false,error:'BAD_GRAMS'}`
`o={a,b,priceMinorPerKg?}`，`a,b` 為 >0 整數。`diffBps=roundDiv(|a-b|*10000, roundDiv(a+b,2))`；`<=100`→green、`<=300`→yellow、其餘 red（`agreedGrams:null`，其他等級＝兩讀數平均）。

---

## 11. 履約點、短語、簡訊、時間、亂數

### `reputationView(pack, s) → {kind:'new', n} | {kind:'ok', n, dots:[{key:'weigh'|'time'|'kept', pct|null, level}]}`
`s={deals,weighChecks,weighOk,onTime,ghosts}`；`deals<reputationMinN(5)` 或 `s` 為空→`new`。`level`：`>=90 full`、`>=70 half`、否則 `empty`；`weighChecks=0`→`weigh` 的 `pct:null, level:'na'`。
### `phrasesFor(pack, role, turn) → string[]`
該角色可附的短語 id（依 `FarmData.phrases` 順序）。P09（`needs:'final'`）只在 `turn+1 >= finalFromTurn(3)` 出現；`turn` 是目前 `offer.turn`。`phrasesFor('ng-kano','B',1)` → `['P01','P02','P03','P04','P05','P06','P07','P08','P11','P12']`。
### `renderPhrase(id, lang) → string`
`renderPhrase('P05','zh')==='別處價格更好'`；未知 id → `'#99（更新後可見）'`（zh）／`'#99 (update to view)'`（其餘語言）。
### `knockAllowed(pack, o) → {ok:true, remaining} | {ok:false, reason:'SAME_STATE'|'DAILY_LIMIT'}`
`o={times:[ms], now, lastKnockVer, offerVer}`。`lastKnockVer===offerVer`（且非 null）→`SAME_STATE`；24 小時內已發 `>=smsPerThreadPerDay(3)` → `DAILY_LIMIT`；否則 `remaining = 3 - 近24h數 - 1`。
### `respondMsFor(pack, cropId) → ms`　／　`leaseMs(pack, cropId) → ms`
回應期限（`respondMinutesByClass[perishClass]`：易腐 2h／一般 12h／耐放 48h）；貨單租約（`leaseHours`，番茄 6h）。未知作物→TypeError。
### `makePrng(seed) → () => number`
mulberry32，回 `[0,1)` 浮點；`seed>>>0`。同種子同序列（`makePrng(42)()===0.6011037519201636`）。

### `FarmLogic.CONST`
`{MAX_GRAMS:100000000, MAX_PRICE:10000000, TERM_FIELDS:['grams','priceMinorPerKg','grade','delivery','payment'], HOUR:3600000, DAY:86400000}`。

---

## 12. `FarmData` 結構

`window.FarmData`（`<script id="farm-data">`，純資料）：

| 鍵 | 型別 | 說明 |
|---|---|---|
| `schemaVersion` | `1` | |
| `packOrder` | `['ng-kano','in-bihar']` | 地區選單順序；第一個是預設 |
| `packs` | `{[id]: Pack}` | 見下 |
| `langs` | `['zh','en']` | |
| `phrases` | `Phrase[12]` | `{id:'P01'..'P12', roles:['B'|'S'…], zh, en, check?:'refCheck', needs?:'final', effect?:'contactRequest'}` |
| `gradeCards` | `{perishable, normal, durable}` | 各 `{sample, maxBad:{A,B,C}, unit:{zh,en}, text:{zh:{A,B,C}, en:{A,B,C}}}`，鍵＝`crop.perishClass` |
| `i18n` | `{zh:{key:string}, en:{key:string}}` | 起手 206 鍵；`zh` 與 `en` 鍵集合必須完全相同 |
| `sizes` | `{'240x320':{w,h,cols:26,rows:12,font,lineH,pad,titleH,softH}, '128x160':{…cols:17,rows:8…}}` | |
| `serverDefaults` | `{network:{ok:{latencyMs}, flaky:{latencyMs,okPct,failPct,timeoutAfterApplyPct,timeoutMs}, down:{latencyMs}}}` | Transport 用 |

**`i18n` 鍵前綴**：`app sk net time role state home f d g s r c n e m rep w`。錯誤碼鍵是 `e.<CODE>`；目前**有**：`STALE_VERSION NOT_YOUR_TURN TOO_MANY_FIELDS FINAL_LOCKED MAX_TURNS EXPIRED OVER_STOCK READBACK_MISMATCH NO_CHANGE ILLEGAL_STATE NETWORK_DOWN TIMEOUT SERVER_BUSY BAD_PRICE BAD_GRAMS GRADE_NOT_OFFERED REOPEN_LIMIT LISTING_CLOSED SOLD_OUT`；狀態機/成交單會回、但**還沒有 `e.*` 鍵**的：`NOT_FOUND FINAL_TOO_EARLY READBACK_REQUIRED ALREADY_CONFIRMED BAD_TERMS BAD_GRADE BAD_DELIVERY BAD_PAYMENT BAD_ACTOR UNKNOWN_ACTION UNKNOWN_CROP UNKNOWN_MARKET_PAIR ALL_LOST`（UI 建置者請補；`tests/props.test.mjs` 以 `STRICT_ERR_KEYS=1` 檢查）。

### Pack（`FarmData.packs['ng-kano' | 'in-bihar']`，兩包欄位完全相同）

| 欄位 | 內容 |
|---|---|
| `id, version, simulated:true` | |
| `names {zh,en}`, `defaultLang {A,B}`, `tz {offsetMin,label}`, `startLocal {h,m}` | NG：WAT +60；IN：IST +330；皆 06:30 開市 |
| `currency` | `{code, symbol, minorPerMajor, decimals, grouping:'intl'|'indian', cashStep, denominations:[大→小], priceStep, priceStepBig}`。NG：`NGN ₦ 1 0 intl 5 [1000…5] 5 50`；IN：`INR ₹ 100 2 indian 100 [50000…100] 50 500` |
| `readbackMinMajor` | NG 50000；IN 5000（單位：主貨幣，即 ₦／₹） |
| `minGrams, grades, gradeBps, deliveries, lossCapBps, resaleUpliftBps` | `1000`、`['A','B','C']`、`{A:0,B:-600,C:-1500}`、`['pickup','deliver']`、`3000`、`500` |
| `markets[]` | `{id, names:{zh,en,local}, multBps}`（各 4 個；NG `dawanau sabongari kaduna lagos`、IN `patna hajipur muzaffarpur kolkata`） |
| `distKm` | `{'a|b': km}`，鍵為兩市場 id **字母序**；4 市場共 6 條 |
| `freight` | `{minorPerTonKm, minMinor, typicalLoadGrams, note}` |
| `crops[]` | `{id, key:1..9, names:{zh,en,local,localLang?}, perishClass:'perishable'|'normal'|'durable', lossBpsPer100km, leaseHours, refWindowDays, containers:[id…], defaultContainer, emoji?}`；NG 9 種（`key` 對應首頁九宮格數字鍵）、IN 9 種 |
| `prices` | `{cropId:{series:[7 個整數], asOfAgoMin}}`（基準市場價，最小單位/kg） |
| `priceSourceLabel` | `{zh,en}` |
| `containers[]` | `{id, names:{zh,en,local}, grams, heapedGrams?, byMarket?:{marketId:{grams,heapedGrams?}}, byCrop?:{cropId:{grams}}, approx, note?}` |
| `payments[]` | `{id, names:{zh,en}, cashRounding:boolean, buyerFee:FeeRule|null, sellerFee:FeeRule|null, meta:{status, …}}`；`FeeRule={tiers?:[{upTo|null,fee}], addOn?:[{from,fee}], percentBps?, userFill?, minFee?, maxFee?}` |
| `ref` | `{minTrades:3, quantiles:{low:[1,5], mid:[1,2], high:[4,5]}, sizeCapKg:100, decayFloorPermille:50, freshHours:6, agingHours:72, oldHours:168, concentrationPct:50, widenBps:500, sourceSpreadBps:800, staleSpreadMult:2, dedupePairDays:7}` |
| `negotiation` | `{maxTurns:5, finalFromTurn:3, maxChangedFields:2, maxReopens:1, sheetTtlHours:24, respondMinutesByClass:{perishable:120,normal:720,durable:2880}, trustedWindowMin:30, magnitudeFactor:5, exitFrictionBps:500, coachRatiosBps:[5000,4000,3000,2500,2000], smsPerThreadPerDay:3, blind:{gapSmallBps:500,gapMediumBps:1500,resealMaxConcedeBps:500,maxRounds:2,farFromBandBps:2500}, weigh:{greenBps:100,yellowBps:300,maxReweigh:2}, reputationMinN:5}` |
| `display` | `{agingStep, staleBanner:true}`（NG `agingStep:10`） |
| `seed` | `{personas:{A:userId,B:userId}, users[], circle:{sellerId:[buyerId…]}, trades[], listings[], wants[], bots[]}`，欄位：`users[] {id,name,role:'S'|'B',marketId,stallCode,rep{deals,weighChecks,weighOk,onTime,ghosts},smsOptIn,phone}`；`trades[] {cropId,marketId,agoMin,grams,price,grade,sellerId,buyerId}`（`price` 是每 kg 最小單位；`agoMin` 相對 T0）；`listings[] {id,sellerId,cropId,marketId,containerId,qtyTenths,askMinorPerKg,grade,audience,ageMin}`；`wants[] {id,buyerId,cropId,marketId,grams,bidMinorPerKg,minGrade,delivery,payment,ageMin,expiresInH}`；`bots[] {userId,kind,cropIds,firstOfferDelayMin,openBps,maxBps,maxGrams,respondDelayMin}` |

範例（NG 轉帳手續費規則）：`{tiers:[{upTo:5000,fee:0},{upTo:50000,fee:10},{upTo:null,fee:50}], addOn:[{from:10000,fee:50}]}`。`agent` 付款的賣方費 `{percentBps:100, userFill:true}`（使用者可填百分比，用 `ctx.userFeeBps`）。

**加地區包**：複製 pack、改資料、把 id 加進 `packOrder`，不必改邏輯；`tests/props.test.mjs` 的 pack 結構檢查會驗證交叉引用（作物→容器、`prices`、`distKm` 對稱且涵蓋所有市場對、seed 引用）。

---

## 13. 錯誤碼總表（`FarmLogic` 實際會回傳的）

| 來源 | 碼 |
|---|---|
| 輸入/單位 | `BAD_INPUT`（toGrams/perKg/perContainer/unitMismatch）、`OVERFLOW`（toGrams）、`UNKNOWN_CONTAINER`、`BAD_AMOUNT`（makeChange/feeOf/feeCliff）、`BAD_NUMBER`、`EMPTY`、`TOO_MANY_DECIMALS`（bufferValue）；`EMPTY` 另見 `basket`（空陣列） |
| 編碼 | `BAD_FORMAT`、`BAD_CHECK_DIGIT`、`BAD_VERIFIER` |
| 成交單/條款 | `UNKNOWN_CROP`、`BAD_TERMS`、`BAD_GRAMS`、`BAD_PRICE`、`BAD_GRADE`、`BAD_DELIVERY`、`BAD_PAYMENT`、`UNKNOWN_MARKET_PAIR`、`ALL_LOST`、`GRADE_NOT_OFFERED`（提案品級比貨單宣稱的更好）、`OVER_STOCK`、`NO_SOURCE`（externalPrice） |
| 狀態機 | `BAD_ACTOR`、`NOT_FOUND`、`STALE_VERSION`、`EXPIRED`、`ILLEGAL_STATE`、`NOT_YOUR_TURN`、`FINAL_LOCKED`、`MAX_TURNS`、`NO_CHANGE`、`TOO_MANY_FIELDS`、`FINAL_TOO_EARLY`、`READBACK_REQUIRED`、`READBACK_MISMATCH`、`ALREADY_CONFIRMED`、`REOPEN_LIMIT`、`LISTING_CLOSED`、`UNKNOWN_ACTION` |
| 非 `error` 欄位 | `viewLint.issues[]` 字串；`knockAllowed.reason`：`SAME_STATE`、`DAILY_LIMIT` |

不在邏輯層、由伺服器/Transport 回的碼（規格 §9）：`SEALED_OPEN`、`SOLD_OUT`、`NETWORK_DOWN`、`TIMEOUT`、`SERVER_BUSY`、`RATE_LIMITED`…；邏輯層**不會**回它們。

---

## 14. 與規格不符（以原始碼為準）

1. **§7.2 `toGrams / perKgFromPerContainer / perContainerFromPerKg` 寫成純數字公式**，實際回 `{ok, grams}` / `{ok, priceMinorPerKg}` / `{ok, pricePerContainerMinor}` 物件；`lineTotal→{ok,totalMinor}`、`feeOf→{ok,feeMinor}` 亦同。
2. **§7.6 外部源欄位**寫 `external.price`；實作是 `external.priceMinorPerKg`（與 `externalPrice()` 回傳一致，`asOf` 同名）。
3. **§7.1「函式對數值輸入不丟例外」**：未知 pack id 會丟 `Error('UNKNOWN_PACK')`；未知 `cropId` 給 `lossBps / respondMsFor / leaseMs` 丟 TypeError；`gradeAdjust / normalizeToGradeA` 收到未知 grade 回 `NaN` 而不報錯。
4. **§7.1 錯誤碼**列 `BAD_GRAMS|BAD_PRICE|OVERFLOW`；`lineTotal/dealSheet` 超上限回的是 `BAD_GRAMS/BAD_PRICE`，`OVERFLOW` 只有 `toGrams` 會回。`dealSheet` 另會回規格未列的 `UNKNOWN_CROP`、`ALL_LOST`。
5. **§6 `Offer.gapBand:{level,gapBps}`**：實作存進去的是 `gapBand()` 的整個結果，多一個 `ok:true`。
6. **§8.1 `respondBy = at + respondMs(crop)`**：`applyAction` 不自己算，靠 `ctx.respondMs`；漏傳會得 `respondBy: NaN`（序列化成 `null`）而永不逾期。
7. **§8.2 `SEALED_OPEN`**：規格把「封存議價開啟時拒絕 COUNTER/ACCEPT」放在狀態機規則；實作 `applyAction` 沒有這個檢查（應由伺服器層在呼叫前擋）。
8. **§8.2 `MAX_TURNS`**：實務上到不了（第 5 個提案自動 final，先回 `FINAL_LOCKED`）。
9. **§8.2 未列的細節**：`SEALED_DEAL` 除 `'SYS'` 外，`by:'S'|'B'` 也被接受；`OFFER` 不看 `baseVer`；`applyAction` 遇逾期先回 `EXPIRED`（連 `DECLINE` 都是），不會自己轉狀態。
10. **§7.7 `openingLadder(role, ref, limit)`、§7.9 `weighCompare({a,b,priceMinorPerKg})` 等**簽名：實作一律是 `(pack, o)`（附錄 B 的寫法才對）。
11. **§14「伺服器錯誤碼→`e.<CODE>`」**：起手表只涵蓋部分碼，見 §12 的缺鍵清單。

## 15. 已知問題（需別人修，本文件作者未動 `index.html`）

| # | 位置 | 現象 | 嚴重度 |
|---|---|---|---|
| K1 | `bufferValue` | 不限長度：`bufferValue('99999999999999999999',0)` 回 `{ok:true, scaled:1e20}`（超過 2^53 已失準）。只有走 `bufferPush(maxLen)` 才安全。 | 低 |
| K2 | `truncateCells` | 以 code unit 迭代：`truncateCells('😀😀',3)` 的長度為 3，切壞代理對。 | 低（UI 不該餵 emoji） |
| K3 | `dealSheet.sellerPocketPerKgMinor` | 送貨、小量時為負（1 kg×₦450，Dawanau→Sabon Gari：`-2550`）；沒有守門或警示欄位。 | 中（UI 需處理） |
| K4 | `exitPriceBuyer.walk` → `defaultLimits` | 遠距離買方的 `walk` 可以很小（Lagos→Dawanau 番茄：`276` vs 價帶約 `450`），極端組合可能 ≤0，`defaultLimits` 直接當上限。 | 低 |
| K5 | `applyAction` 的 `ctx.respondMs` | 漏傳不報錯、單子永不逾期（見 gotcha 1）。建議缺時回 `BAD_CTX` 或丟例外。 | 低（程式錯誤類） |
| K6 | 錯誤碼 i18n | 見 §12：13 個狀態機/成交單錯誤碼沒有 `e.*` 字串。 | 中（UI 會顯示鍵名） |
