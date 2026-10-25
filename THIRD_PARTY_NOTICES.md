# 第三方元件（SBOM）

所有元件內嵌於 `index.html`，原始檔放在 `vendor/`。

| 元件 | 版本 | 授權 | 開發者／維護者 | 檔案 | 用途 |
|---|---|---|---|---|---|
| SheetJS Community Edition | 0.20.3 | Apache-2.0 | SheetJS LLC（美國） | `vendor/xlsx-0.20.3.full.min.js`（SHA-256 `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`），取自 cdn.sheetjs.com | 讀取 .xls |
| PDF.js（pdfjs-dist） | 3.11.174 | Apache-2.0 | Mozilla Foundation（美國） | `vendor/pdf.min.js`、`vendor/pdf.worker.min.js` | 讀取範本 PDF |
| ExcelJS（重新打包，移除 CSV／dayjs／core-js） | 4.4.0 | MIT | exceljs 專案，原作者 Guyon Roche（澳洲） | `vendor/exceljs.custom.min.js` | 讀寫 .xlsx |
| JSZip（含 pako、lie、immediate、setimmediate） | 3.10.1 | MIT 或 GPL-3.0（擇 MIT） | Stuart Knightley（英國）；pako：nodeca | 含於 ExcelJS 打包 | 壓縮檔 |
| saxes／xmlchars | 5.0.1／2.2.0 | ISC／MIT | Louis-Dominique Dubeau（加拿大） | 含於 ExcelJS 打包 | XML 解析 |
| readable-stream、string_decoder、events | 3.6.2、1.3.0、3.3.0 | MIT | Node.js 專案 | 含於 ExcelJS 打包 | 串流 |
| uuid | 8.3.2 | MIT | uuidjs | 含於 ExcelJS 打包 | ExcelJS 相依 |
| buffer、ieee754、safe-buffer、base64-js | 6.0.3、1.2.1、5.2.1、1.5.1 | MIT／BSD-3-Clause | Feross Aboukhadijeh、T. Jameson Little | 含於 ExcelJS 打包 | 瀏覽器 Buffer |
| process、inherits、util-deprecate | 0.11.10、2.0.4、1.0.2 | MIT／ISC | Roman Shtylman、Isaac Schlueter、Nathan Rajlich | 含於 ExcelJS 打包 | 瀏覽器相容 |

各元件依其原授權條款使用；Apache-2.0、MIT、ISC、BSD 條款全文請見各專案原始儲存庫。
