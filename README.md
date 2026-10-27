# 機關決算書表編製工具（整合版）

單一 HTML 檔、在瀏覽器離線執行的決算書表編製工具。讀取會計系統產製的各表 `.xls`，參考以往年度定稿（PDF 或 `.xlsx`），完成表名對照、內容編修、表間勾稽、#12／#38 推算，並產出：

- **列印版面**：A4 對頁書表（左頁標題靠右、右頁靠左、本頁空白、連續頁碼），可直接列印或存成 PDF
- **Excel**：依格式規格產生，或套用以往年度定稿 `.xlsx` 的格式
- **對外公告檔**：每表一個 XML（英文標籤）＋ MD，附 SHA-256 雜湊；出國人員姓名可遮蔽
- **格式 1～5**：封面、封底、目次、總說明、歲入來源別決算表（MD）

## 兩個版本

| 版本 | 檔案 | 適用 |
|---|---|---|
| **完整版** | [`index.html`](index.html) | 全套：範本 PDF／xlsx、格式編修、內容編修、18 條勾稽、#12／#38、列印版面、Excel、公告檔、格式 1～5 |
| **簡易版** | [`simple.html`](simple.html) | 只處理**有上傳的系統產製書表**，同樣參考範本 PDF／xlsx：載入 → 表名對照 → 格式編修（對照範本頁面）→ 內容編修 → 列印版面／Excel（依規格或套範本 xlsx） |

兩個版本都只處理有上傳系統檔的書表；沒有上傳的表不進入後續步驟。步驟一可用「一次選取全部檔案」同時多選系統檔與範本檔（或整個資料夾），工具依檔名與副檔名自動分類。

**線上使用**（需先在 Settings → Pages 啟用，見下方）：
- 完整版：<https://chaifeng666.github.io/Agency-Financial-Statement-web-tool-/>
- 簡易版：<https://chaifeng666.github.io/Agency-Financial-Statement-web-tool-/simple.html>

**離線使用**：下載 `index.html` 或 `simple.html`，用 Chrome 或 Edge 開啟即可。

> 所有檔案只在瀏覽器內處理，不會上傳到任何伺服器；工具本身不連網。

## 決算書表工作台（輕量版）

[`workbench/`](workbench/) 是另一個獨立的輕量工具，上方選單有：作業流程圖、生成總說明、生成目次、各書表格式調整。只需載入系統產製 `.xls`，不需範本 PDF。

- 線上：<https://chaifeng666.github.io/Agency-Financial-Statement-web-tool-/workbench/>
- 說明：[workbench/README.md](workbench/README.md)

## 作業步驟（完整版；簡易版為 1→2→3→4→7）

| 步驟 | 內容 |
|---|---|
| 1 載入檔案 | 系統產製 `.xls`（必要）；範本 PDF、範本 `.xlsx`、格式規格檔（選用） |
| 2 表名對照 | 每張表的來源（系統檔／手填／推算／文字）、範本頁次與工作表 |
| 3 格式編修 | 只列有上傳的書表；載入範本 PDF 時，下方同時顯示該表在範本中的頁面供對照；可改對頁／單頁、左右頁標題、各欄寬度（mm）、標題／表頭／內文字級、表格左邊界、手填表表頭，即時預覽；可匯出規格檔明年沿用 |
| 4 編修內容 | 系統值可改，合計、小計、比較增減、比率自動重算；手填表、總說明草稿、#41；可匯出／匯入編修檔 |
| 5 內容核對 | 18 條表間勾稽（使用編修後數字） |
| 6 #12、#38 | 依 #4 判斷 #12；#38 決算與會計收支對照表推算 |
| 7 產出 | 列印版面、Excel、公告檔 |
| 8 格式 1～5 | 依「中央政府決算書表之格式」產生 MD，逐一確認 |

另有「列印版面」分頁可全頁檢視、縮放、跳表、列印，並可開啟以前下載的列印版面檔。

## 總說明產生工具

[`summary-tool.html`](summary-tool.html)：單一 HTML、離線執行，專做決算書的**總說明**。

| 步驟 | 內容 |
|---|---|
| 1 上年度決算書（選用） | 上傳上年度定稿 PDF，列出總說明每個金額、比率出現在哪張書表、印刷頁／PDF 頁、哪一列，可匯出 Excel；擷取上年度科目內容說明與施政成果文字 |
| 2 匯入系統產製表件 | 任一年度 `.xls`（可選整個資料夾），依檔名辨識表號，同表號取最新 |
| 3 數據與檢核 | 每個數字的來源儲存格；表間檢核（歲入加總、繳付公庫數、實現＋保留、庫撥數、保留分析表、資產＝負債＋淨資產） |
| 4 文字編修 | 保留原因（自歲出保留分析表摘要）、動支第一預備金用途、科目內容說明、平衡表變動原因（門檻可調）、施政成果；即時預覽 |
| 5 產生 Word | 總說明 `.docx`（A4 直式、標楷體）、數字來源說明 `.docx`（A4 橫式）、數字來源 Excel |

書表沒有的文字以黃底紅字標示待補。原始碼在 `summary/src/`，修改後執行 `python3 summary/build.py`。

**線上使用**：<https://chaifeng666.github.io/Agency-Financial-Statement-web-tool-/summary-tool.html>

## 教材包

**下載 ZIP**（50 個檔案，8.6 MB；SHA-256 `ef838bb8c7b30fbec165251b92d0fa69b1ef74529dad8580ae444207ef829791`），任選一種：

| 方式 | 網址 | 說明 |
|---|---|---|
| ① GitHub Releases（建議） | <https://github.com/chaifeng666/Agency-Financial-Statement-web-tool-/releases/latest/download/summary-course-kit.zip> | 點了直接下載；`download/` 的 ZIP 更新並合併到 main 後，由 GitHub Actions 自動更新 |
| ② 下載頁（GitHub Pages） | <https://chaifeng666.github.io/Agency-Financial-Statement-web-tool-/download/> | 按「下載 ZIP」 |
| ③ 直接檔案 | <https://github.com/chaifeng666/Agency-Financial-Statement-web-tool-/raw/main/download/%E6%B1%BA%E7%AE%97%E7%B8%BD%E8%AA%AA%E6%98%8E%E7%94%A2%E7%94%9F%E6%95%99%E6%9D%90%E5%8C%85.zip> | 點了直接下載 |

> 在 GitHub 檔案清單點 ZIP 會顯示「We can't show files that are this big right now」，這是預覽限制，不是檔案有問題；請改用上面的網址。解壓後先讀「00_教材清單（請先讀我）.txt」。

[`教材包/決算總說明產生教材包/`](教材包/決算總說明產生教材包)：主計 AI 應用與實作課程案例教材（簡報、Prompt 集與提示語歷程、素材、成果檔、★半成品與題目檔）。檔案清單與 SHA-256 完整性檢查見 [`教材包/決算總說明產生教材包_檔案明細.txt`](教材包/決算總說明產生教材包_檔案明細.txt)。素材取自公開決算書表，含個人資料的明細頁已遮蔽。

## 系統檔命名

`年度_表號_表名_時間戳.xls`，例如 `114_2_決算編制_歲出政事別決算表_20260821232853_….xls`。同表號有多個檔案時取時間最新者。

## 課程教材包

[`決算書表編製工具教材包/`](決算書表編製工具教材包/)：主計 AI 應用與實作課程案例教材，先讀 `00_教材清單（請先讀我）.txt`。

下載：[`download/決算書表編製工具教材包_公開版.zip`](download/決算書表編製工具教材包_公開版.zip)（不含機關資料，SHA-256 `210328e311451d70fd64208ae66bf38acc2c084649b04cd41a983286f8426ff1`）。

| 資料夾 | 內容 |
|---|---|
| 01_簡報 | 教學簡報（15 頁，重點 STEP 5-1～5-6 從零生成 HTML） |
| 02_Prompt | Prompt 集、各流程必用提示語與 UI 操作對照（docx）、生成 HTML 提示語歷程（md）、UI 操作畫面 |
| 03_素材 | 僅素材說明；機關資料（系統產製檔、以往年度定稿、格式規範）不上 GitHub |
| 04_成果檔 | 完整版／簡易版工具、格式規格；114 年度產出不上 GitHub |
| 05_★半成品與題目檔 | 練習格式規格檔；半成品、題目檔、參考解答與練習用系統檔不上 GitHub |

機關資料不上 GitHub；課堂請使用講師提供的完整教材包 zip，並以 `決算書表編製工具教材包_檔案明細.txt` 的 SHA-256 核對。

## 原始碼與建置

```
src/
  shell.html            介面（整合版）
  shell-v1-parts.html   第 1 版介面（建置時取用格式 1～5 的畫面與樣式）
  core.js               表名對照、18 條勾稽、#38 推算、套範本 xlsx
  pub.js                公告檔 XML／MD
  fmt.js                格式 1～5
  model2.js             可編修資料模型與自動重算
  pdfimp.js             範本 PDF 辨識與文字擷取
  sum2.js               總說明草稿
  render2.js            列印版面與依規格 Excel
  spec2.json            內建格式規格（113 年度）
summary/src/            總說明產生工具（engine.js 擷取與產生、pdfref.js 上年度 PDF 分析、app.js 介面）
summary/build.py        組成 summary-tool.html
vendor/                 第三方元件（見 THIRD_PARTY_NOTICES.md）
tools/exceljs-bundle/   ExcelJS 瀏覽器版重新打包腳本
build.py                組成單一檔 index.html（完整版）與 simple.html（簡易版）
```

修改 `src/` 後執行：

```
python3 build.py
```

## 啟用 GitHub Pages

儲存庫 **Settings → Pages → Build and deployment**：Source 選 *Deploy from a branch*，Branch 選 `main`、資料夾 `/ (root)`，存檔後約一分鐘即可用上方網址開啟。

## 元件與資安

未使用中國大陸開發的元件。詳見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

- SheetJS CE 0.20.3（已修正 CVE-2023-30533、CVE-2024-22363）
- PDF.js 3.11.174（已修正 CVE-2024-4367，並以 `isEvalSupported:false` 載入）
- ExcelJS 4.4.0 重新打包，移除 CSV 功能及其 dayjs 相依
