# ExcelJS 瀏覽器版重新打包

移除 ExcelJS 的 CSV 功能（其相依 dayjs）與 core-js，產生 `vendor/exceljs.custom.min.js`，並一併輸出 `globalThis.JSZip`。

```
npm install exceljs@4.4.0 jszip@3.10.1 esbuild buffer events process readable-stream
node build.mjs
cp exceljs.custom.min.js ../../vendor/
```
