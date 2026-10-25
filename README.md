# 機關決算書表編製工具（整合版）

單一 HTML 檔、在瀏覽器離線執行的決算書表編製工具。讀取會計系統產製的各表 `.xls`，參考以往年度定稿（PDF 或 `.xlsx`），完成表名對照、內容編修、表間勾稽、#12／#38 推算，並產出：

- **列印版面**：A4 對頁書表（左頁標題靠右、右頁靠左、本頁空白、連續頁碼），可直接列印或存成 PDF
- **Excel**：依格式規格產生，或套用以往年度定稿 `.xlsx` 的格式
- **對外公告檔**：每表一個 XML（英文標籤）＋ MD，附 SHA-256 雜湊；出國人員姓名可遮蔽
- **格式 1～5**：封面、封底、目次、總說明、歲入來源別決算表（MD）

**線上使用**：<https://chaifeng666.github.io/Agency-Financial-Statement-web-tool-/>（需在儲存庫 Settings → Pages 啟用，見下方）
**離線使用**：下載 [`index.html`](index.html)，用 Chrome 或 Edge 開啟即可。

> 所有檔案只在瀏覽器內處理，不會上傳到任何伺服器；工具本身不連網。

## 作業步驟

| 步驟 | 內容 |
|---|---|
| 1 載入檔案 | 系統產製 `.xls`（必要）；範本 PDF、範本 `.xlsx`、格式規格檔（選用） |
| 2 表名對照 | 每張表的來源（系統檔／手填／推算／文字）、範本頁次與工作表 |
| 3 格式說明 | 各表對頁或單頁、標題拆法、欄寬（mm）、表頭；可預覽、匯出說明與規格檔 |
| 4 編修內容 | 系統值可改，合計、小計、比較增減、比率自動重算；手填表、總說明草稿、#41；可匯出／匯入編修檔 |
| 5 內容核對 | 18 條表間勾稽（使用編修後數字） |
| 6 #12、#38 | 依 #4 判斷 #12；#38 決算與會計收支對照表推算 |
| 7 產出 | 列印版面、Excel、公告檔 |
| 8 格式 1～5 | 依「中央政府決算書表之格式」產生 MD，逐一確認 |

另有「列印版面」分頁可全頁檢視、縮放、跳表、列印，並可開啟以前下載的列印版面檔。

## 系統檔命名

`年度_表號_表名_時間戳.xls`，例如 `114_2_決算編制_歲出政事別決算表_20260821232853_….xls`。同表號有多個檔案時取時間最新者。

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
vendor/                 第三方元件（見 THIRD_PARTY_NOTICES.md）
tools/exceljs-bundle/   ExcelJS 瀏覽器版重新打包腳本
build.py                組成單一檔 index.html
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
