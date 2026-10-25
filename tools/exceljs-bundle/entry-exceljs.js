const Workbook = require('exceljs/lib/doc/workbook');
const Enums = require('exceljs/lib/doc/enums');
const ExcelJS = { Workbook };
Object.keys(Enums).forEach(k => { ExcelJS[k] = Enums[k]; });
globalThis.ExcelJS = ExcelJS;
globalThis.JSZip = require('jszip');
