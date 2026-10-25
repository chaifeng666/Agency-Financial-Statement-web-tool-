/* 對外公告檔（XML／MD）產製模組 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalPub = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAC = 'ˉ';
  const clean = s => (s == null ? '' : String(s)).replace(/\r/g, '').trim();
  const flat = s => clean(s).replace(/[\s　ˉ]/g, '');
  const isNumStr = s => /^-?[\d,]+(\.\d+)?$/.test(String(s).trim()) && /\d/.test(String(s));
  const isNumLike = v => (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && isNumStr(v));
  const toNum = v => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '')));
  const blankish = v => v == null || flat(v) === '' || flat(v) === '_' || flat(v) === '-';

  // ---------- 中文欄名 → 英文標籤 ----------
  const DICT = {
    '款': 'Category', '項': 'Item', '目': 'SubItem', '節': 'Detail',
    '名稱及編號': 'Account', '科目': 'Account', '科目名稱': 'AccountName', '科目名稱及編號': 'Account',
    '原預算數': 'OriginalBudget', '預算增減數': 'BudgetChange', '預算追加(減)數': 'SupplementaryBudget',
    '動支第一預備金數': 'FirstReserveFund', '動支第二預備金數': 'SecondReserveFund', '經費流用數': 'Virement',
    '預算調整數': 'BudgetRealignment', '小計': 'Subtotal', '合計(1)': 'BudgetTotal', '合計(2)': 'FinalTotal',
    '合計': 'Total', '實現數': 'Realized', '應收數': 'Receivable', '應付數': 'Payable', '保留數': 'Reserved',
    '預算數': 'Budget', '決算數': 'FinalAccount', '預決算比較增減數(2)-(1)': 'Variance', '預決算比較增減數': 'Variance',
    '決算數占預算數之比率(2)/(1)%': 'ExecutionRate', '決算數占預算數之比率(2)／(1)％': 'ExecutionRate',
    '年度別': 'FiscalYear', '年度': 'FiscalYear', '以前年度轉入數': 'BroughtForward', '本年度減免(註銷)數': 'Cancelled',
    '本年度實現數': 'RealizedThisYear', '本年度調整數': 'AdjustedThisYear', '本年度未結清數': 'Outstanding',
    '人事費': 'Personnel', '業務費': 'Operating', '獎補助費': 'Grants', '債務費': 'DebtService', '設備及投資': 'CapitalOutlay',
    '經常支出': 'Current', '資本支出': 'Capital', '備註': 'Remarks', '說明': 'Description',
    '項目': 'ItemName', '歲入實現數(1)': 'RevenueRealized', '減項：歲入待納庫數(2)': 'RevenuePendingDeposit',
    '以前年度待納庫繳庫數(3)': 'PriorPendingDeposited', '以前年度撥款於本年度繳還數': 'PriorAppropriationReturned',
    '材料(4)': 'Materials', '存出保證金(5)': 'GuaranteeDepositPaid', '其他應收款(6)': 'OtherReceivables',
    '預收款(7)': 'AdvanceReceipts', '剔除經費(8)': 'DisallowedExpenses',
    '繳付公庫數(9)=(1)-(2)+(3)+(4)+(5)+(6)+(7)+(8)': 'PaidToTreasury',
    '歲出實現數(1)': 'ExpenditureRealized', '加項': 'Additions', '預付款(2)': 'Prepayments', '材料(3)': 'Materials',
    '存出保證金(4)': 'GuaranteeDepositPaid', '零用金(5)': 'PettyCash', '退還收入(預收)款(5)': 'RevenueRefunds',
    '減項：以前年度撥款於本年度實現數(7)': 'PriorAppropriationRealized',
    '公庫撥入數(8)=(1)+(2)+(3)+(4)+(5)+(6)-(7)': 'AllocatedFromTreasury', '歲出應付、保留數公庫未撥入數': 'UnallocatedPayableReserved',
    '餘絀數(或減免、註銷數)': 'SurplusDeficit', '金額': 'Amount', '%': 'Percent', '％': 'Percent',
    '餘絀數(或減免、註銷數)原因說明及因應改善措施': 'Explanation',
    '工作計畫名稱及編號': 'WorkProgram', '歲出保留': 'Carryover', '保留原因分析': 'CarryoverAnalysis',
    '經資門': 'CurrentOrCapital', '類型': 'Type', '保留原因說明及相關改善措施': 'Explanation',
    '人事費別': 'PersonnelCategory', '決算數(2)': 'FinalAccount', '比較增減數': 'Variance', '金額(3)=(2)-(1)': 'Amount',
    '員工人數': 'Headcount', '預計數': 'Planned', '實有數': 'Actual',
    '車輛類別型': 'VehicleType', '預算數以前年度轉入數': 'Budget', '原預算數以前年度轉入數': 'OriginalBudget',
    '決算金額(含保留數）(2)': 'FinalAmount', '車輛數': 'Vehicles', '預計購入數': 'PlannedPurchase', '實際購入數': 'ActualPurchase',
    '受補、捐(獎)助單位名稱': 'Recipient', '補、捐(獎)助計畫名稱': 'GrantProgram', '列支科目名稱': 'ChargedAccount',
    '補、捐(獎)助金額': 'GrantAmount', '預算數(1)': 'Budget', '已撥數': 'Disbursed', '未撥數': 'Undisbursed',
    '預決算比較增減數(3)=(1)-(2)': 'Variance', '計畫執行情形': 'Execution', '已完成': 'Completed', '未完成': 'NotCompleted',
    '是否納入受補助單位預算': 'InRecipientBudget', '是': 'Yes', '否': 'No', '計畫未完成原因': 'IncompleteReason',
    '計畫完成結餘款': 'Balance', '收回繳庫日期': 'ReturnDate', '是否派員就地檢查': 'OnSiteInspection',
    '接受委託單位或個人名稱': 'Contractor', '委託辦理事項': 'Commission', '合約金額': 'ContractAmount', '訂約日期': 'ContractDate',
    '完成時間': 'CompletionTime', '預定': 'Planned', '實際': 'Actual', '本期執行數': 'ExecutedThisPeriod', '科目金額': 'AccountAmount',
    '按政府採購法辦理': 'UnderProcurementAct', '有': 'Yes', '無': 'No', '委託辦理事項類別(請勾選)': 'CommissionType',
    '委託研究計畫': 'Research', '民意調查作業': 'Poll', '其他委託事項': 'Other', '行政及政策類': 'Administrative',
    '科學及技術類': 'Scientific', '報告': 'Report', '報告公開日期': 'ReportPublished', '年': 'Year', '月': 'Month', '日': 'Day',
    '評審': 'Review', '委託事項(報告)處理': 'ReportHandling', '存參': 'ForReference', '納入計畫實施': 'Implemented', '其他': 'Other',
    '是否派員就地抽查': 'OnSiteInspection', '經費來源': 'Funding', '出國類別': 'TripType', '工作計畫': 'WorkProgram',
    '用途別科目(二級)': 'ObjectCode', '預算(保留)金額': 'Budget', '決算金額(含保留數)': 'FinalAmount',
    '出國計畫名稱及內容簡述': 'TripPurpose', '起訖日期': 'Period', '地點': 'Location', '國家': 'Country', '城市': 'City',
    '出國人員': 'Travellers', '服務單位(部門)及職稱': 'UnitAndTitle', '姓名': 'Names', '報告提出日期': 'ReportDate',
    '報告建議採納情形': 'Recommendations', '建議項數': 'Proposed', '已採行項數': 'Adopted', '未採行項數': 'NotAdopted', '研議中項數': 'UnderReview',
    '經濟性分類職能別分類': 'Function', '受僱人員報酬': 'Compensation', '商品及勞務購買支出': 'GoodsAndServices', '債務利息': 'Interest',
    '土地租金支出': 'LandRent', '經常移轉': 'CurrentTransfer', '對企業': 'ToEnterprises', '對家庭及民間非營利機構': 'ToHouseholdsNPO',
    '對政府': 'ToGovernment', '對國外': 'ToForeign', '經常支出合計': 'CurrentTotal', '投資及增資': 'Investment',
    '對營業基金': 'ToEnterpriseFunds', '對非營業特種基金': 'ToNonEnterpriseFunds', '對民間企業': 'ToPrivateEnterprises',
    '資本移轉': 'CapitalTransfer', '土地購入': 'LandPurchase', '無形資產購入': 'IntangiblePurchase', '固定資本形成': 'FixedCapitalFormation',
    '住宅': 'Dwellings', '非住宅房屋': 'NonResidential', '營建工程': 'Construction', '運輸工具': 'Transport', '資訊軟體': 'Software',
    '機器及其他設備': 'Machinery', '土地改良': 'LandImprovement', '資本支出合計': 'CapitalTotal', '總計': 'GrandTotal',
    '科目名稱': 'AccountName', '本年度': 'CurrentYear', '上年度': 'PriorYear', '本年度(1)': 'CurrentYear', '上年度(2)': 'PriorYear',
    '比較增減數(3)=(1)-(2)': 'Change',
    '日期': 'Date', '摘要': 'Summary', '取得成本(1)': 'Cost', '以前年度累計折舊(耗)長期投資評價(2)': 'PriorAccumDepreciation',
    '本年度成本變動': 'CostChange', '增加數(3)': 'Increase', '減少數(4)': 'Decrease',
    '本年度累計折舊(耗)長期投資評價變動數(5)': 'DepreciationChange', '期末帳面金額(6)=(1)+(2)+(3)-(4)+(5)': 'BookValue',
    '項目及摘要': 'ItemName', '分類項目': 'Classification', '單位': 'UnitOfMeasure', '數量': 'Quantity', '價值': 'Value',
    '用途別科目名稱及編號': 'ObjectAccount', '工作計畫科目名稱': 'WorkProgram', '用途別科目': 'ObjectAccount',
    '一般行政': 'GeneralAdministration', '其他設備': 'OtherEquipment', '交通及運輸設備': 'TransportEquipment'
  };
  const keyOf = s => flat(s).replace(/／/g, '/').replace(/％/g, '%').replace(/（/g, '(').replace(/）/g, ')').replace(/：/g, ':');
  const DK = {}; Object.keys(DICT).forEach(k => { DK[keyOf(k)] = DICT[k]; });
  const GENERIC = { Payable: 1, Reserved: 1, Subtotal: 1, Total: 1, Amount: 1, Percent: 1, Yes: 1, No: 1, Year: 1, Month: 1, Day: 1, Planned: 1, Actual: 1, Type: 1 };
  function eng(label) { const k = keyOf(label); return DK[k] || DK[k.replace(/\//g, '')] || null; }
  // 文字正規化：中文斷行直接接起來、其餘換成空白；短的中文標籤去掉字間空白（如「總　　計」）
  function normText(v) {
    let s = String(v).replace(/ˉ/g, '').replace(/\r/g, '');
    s = s.replace(/([　-鿿＀-￯])[　 ]*\n[　 ]*(?=[　-鿿＀-￯])/g, '$1').replace(/\s*\n\s*/g, ' ');
    s = s.trim();
    if (/^[一-鿿\s　]+$/.test(s) && s.replace(/[\s　]/g, '').length <= 8) s = s.replace(/[\s　]+/g, '');
    return s;
  }

  // ---------- 表格結構辨識 ----------
  function mergeMap(ws, nrow, ncol) {
    const owner = {}; // "r,c" -> [r0,c0]
    (ws['!merges'] || []).forEach(m => { for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) owner[r + ',' + c] = [m.s.r, m.s.c]; });
    return owner;
  }

  function extract(XLSX, ws, meta) {
    const g = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const nrow = g.length, ncol = Math.max(0, ...g.map(r => (r ? r.length : 0)));
    const cell = (r, c) => (g[r] ? g[r][c] : null);
    const owner = mergeMap(ws, nrow, ncol);
    const val = (r, c) => { const o = owner[r + ',' + c]; return o ? cell(o[0], o[1]) : cell(r, c); };

    // 標題列：前 5 列中含「年度／年 月 日／單位」的最後一列
    let T = -1, agency = '', unit = '', scope = '', dateText = '';
    for (let r = 0; r < Math.min(5, nrow); r++) {
      const texts = (g[r] || []).filter(v => typeof v === 'string' && clean(v)).map(clean);
      const j = texts.join('');
      if (texts.some(t => /^中華民國|^單位[:：]|^\d{2,3}年度$|^\d{2,3}年\d{1,2}月\d{1,2}日$/.test(flat(t)))) {
        T = r;
        texts.forEach(t => { if (/^單位/.test(t)) unit = t.replace(/^單位[:：]/, ''); if (/經資門/.test(t)) scope = t; if (/\d+年(度|\d+月)/.test(t)) dateText = t; });
      }
    }
    for (let r = 0; r <= T; r++) {
      const j = (g[r] || []).filter(v => typeof v === 'string').map(flat).join('');
      if (/院|部|會|處|署|局|府|館|所/.test(j) && !/表$|單位|年度/.test(j) && !agency) agency = j.replace(/^(.+?)\1+$/, '$1');
    }
    // 第一筆資料列
    let D = -1;
    for (let r = T + 1; r < nrow; r++) {
      const row = g[r] || [];
      const yearCell = /^\d{2,3}$/.test(clean(row[0]));
      if (row.some(v => typeof v === 'number') || (yearCell && r > T + 1)) { D = r; break; }
      if (row.some(v => isNumLike(v)) && r > T + 1 && !row.some(v => typeof v === 'string' && /[(（]\d[)）]/.test(v))) { D = r; break; }
    }
    if (D < 0) D = nrow;
    // 若第一筆資料列前一列是只有科目文字（無數字）的資料列，往前補
    for (let r = D - 1; r > T + 1; r--) {
      const row = g[r] || [];
      const txt = row.map(flat).join('');
      if (/^\d{10}-\d|^\d{2}\d{10}/.test(txt) || /\d{10}-\d/.test(txt) && !owner[r + ',4']) D = r; else break;
    }
    const H0 = T + 1; let H1 = D - 1; // 表頭列範圍
    while (H1 > H0 && !(g[H1] || []).some(v => !blankish(v))) H1--;
    // 只有第一欄有字、又沒有合併的列（如現金出納表的「收項」）屬於資料，不是表頭
    while (H1 > H0) {
      const row = g[H1] || []; const ne = row.map((v, c) => (blankish(v) ? -1 : c)).filter(c => c >= 0);
      if (ne.length === 1 && ne[0] === 0 && !owner[H1 + ',0']) { D = H1; H1--; } else break;
    }

    // 資料列：去除間隔列、偵測第二行
    const dataRows = [];
    for (let r = D; r < nrow; r++) {
      const row = g[r] || [];
      const meaningful = row.some(v => !blankish(v));
      dataRows.push({ r, row, meaningful });
    }
    const hasText = row => row.some(v => typeof v === 'string' && !blankish(v) && !isNumStr(v));
    const hasNum = row => row.some(v => isNumLike(v) && !blankish(v));
    let line2 = 0;
    for (let i = 1; i < dataRows.length; i++) if (dataRows[i].meaningful && hasNum(dataRows[i].row) && !hasText(dataRows[i].row) && hasText(dataRows[i - 1].row)) line2++;
    const lastHeaderHasText = H1 >= H0 && (g[H1] || []).some((v, c) => typeof v === 'string' && !blankish(v) && !(owner[H1 + ',' + c] && owner[H1 + ',' + c][0] < H1));
    const twoLine = line2 >= 2 && lastHeaderHasText && H1 - H0 >= 1;

    // 欄名路徑
    const pathFor = (c, rows) => {
      const out = [];
      rows.forEach(r => { const v = val(r, c); const t = clean(v); if (t && !blankish(t) && out[out.length - 1] !== t) out.push(t); });
      return out;
    };
    const hdrRows = []; for (let r = H0; r <= H1; r++) hdrRows.push(r);
    const cols = [];
    for (let c = 0; c < ncol; c++) {
      let p1 = pathFor(c, twoLine ? hdrRows.slice(0, -1) : hdrRows);
      let p2 = null;
      if (twoLine) {
        const o = owner[H1 + ',' + c];
        const fromAbove = o && o[0] < H1;
        const last = clean(val(H1, c));
        if (fromAbove) p2 = p1.slice();
        else if (last && !blankish(last)) p2 = p1.slice(0, -1).concat([last]);
      }
      cols.push({ c, p1, p2 });
    }

    // 合併資料列為紀錄
    const recs = [];
    const notes = [];
    let inNotes = false;
    for (let i = 0; i < dataRows.length; i++) {
      const { r, row, meaningful } = dataRows[i];
      if (!meaningful) continue;
      const first = flat(row.find(v => !blankish(v)));
      if (/^備註/.test(first) || inNotes) {
        inNotes = true;
        const t = row.filter(v => !blankish(v)).map(clean).join(' ');
        if (t && !/^備註[:：]?$/.test(flat(t))) notes.push(t.replace(/^備註[:：]\s*/, ''));
        continue;
      }
      const rec = { r, v1: row, v2: null };
      if (twoLine && dataRows[i + 1] && dataRows[i + 1].meaningful && !hasText(dataRows[i + 1].row) && hasNum(dataRows[i + 1].row)) { rec.v2 = dataRows[i + 1].row; i++; }
      recs.push(rec);
    }

    // 欄位清單（去除全空與重複的欄）
    const fields = [];
    const used = {};
    const hiddenCol = c => { const ci = (ws['!cols'] || [])[c]; return ci && (ci.hidden || (ci.wch != null && ci.wch < 1) || (ci.width != null && ci.width < 1)); };
    const colHasData = (c, which) => recs.some(rc => { const row = which === 2 ? rc.v2 : rc.v1; return row && !blankish(row[c]); });
    const sig = (c, which) => recs.map(rc => { const row = which === 2 ? rc.v2 : rc.v1; return row ? clean(row[c]) : ''; }).join('\u0001');
    const seenSig = {};
    const addField = (c, which, path) => {
      const labeled = path && path.length;
      if (hiddenCol(c)) return;
      if ((!labeled || which === 2) && !colHasData(c, which)) return;
      if (!labeled) path = ['欄' + (c + 1)];
      const s = path.join('/') + '|' + sig(c, which);
      if (seenSig[s]) return; seenSig[s] = 1;
      path = path.map(normText).filter(Boolean); if (!path.length) path = ['欄' + (c + 1)];
      const label = path.join('／');
      let name = eng(path[path.length - 1]);
      if (name && (used[name] || GENERIC[name]) && path.length > 1) { const p = eng(path[path.length - 2]); if (p && p !== name) name = p + name; }
      if (!name) name = ((path.length > 1 && eng(path[path.length - 2])) || 'F') + String(c + 1).padStart(2, '0') + (which === 2 ? 'b' : '');
      const prev = fields[fields.length - 1];
      if (used[name] && prev && prev.label === label) name = 'Sub' + name;
      else if (used[name] && fields.some(f => f.label === label)) name = 'Right' + name; // 左右並列的表（如平衡表）
      let n = name, k = 2; while (used[n]) n = name + '_' + (k++);
      used[n] = 1;
      fields.push({ c, which, label, name: n, hasData: colHasData(c, which) });
    };
    cols.forEach(col => addField(col.c, 1, col.p1));
    if (twoLine) cols.forEach(col => { if (col.p2) addField(col.c, 2, col.p2); });

    // 沒資料、標題又只是其他欄上層分類的欄位（如「工作計畫科目名稱」空欄）拿掉
    for (let k = fields.length - 1; k >= 0; k--) {
      const f = fields[k];
      if (!f.hasData && fields.some(o => o !== f && o.label.indexOf(f.label + '／') === 0)) { fields.splice(k, 1); }
    }
    // 科目編號／名稱拆分、層級
    const records = recs.map(rc => {
      const o = { values: {}, level: null, type: 'detail' };
      fields.forEach(f => {
        const row = f.which === 2 ? rc.v2 : rc.v1;
        const v = row ? row[f.c] : null;
        if (blankish(v)) return;
        o.values[f.name] = v;
      });
      const txt = rc.v1.map(flat).join('|');
      if (/合計|總計|總值/.test(txt)) o.type = 'total'; else if (/小計/.test(txt)) o.type = 'subtotal';
      return o;
    });
    fields.forEach(f => {
      const last = f.label.split('／').pop();
      const isText = !f.hasData ? /^(款|項|目|節)$|名稱|編號|說明|備註|類別|類型|日期|姓名|年度/.test(last) : records.some(rc => { const v = rc.values[f.name]; return typeof v === 'string' && (!isNumStr(v) || /^0\d/.test(v.trim())); });
      f.kind = (isText || (/日期|時間|年度別|^年度$/.test(f.label.replace(/\s/g, '')) && !/金額/.test(f.label))) ? 'text' : 'number';
      if (f.kind === 'text') records.forEach(rc => { if (typeof rc.values[f.name] === 'number') rc.values[f.name] = String(rc.values[f.name]); });
      if (!isText) records.forEach(rc => { if (rc.values[f.name] != null) rc.values[f.name] = toNum(rc.values[f.name]); });
    });
    // 名稱及編號欄：拆成編號與名稱；縮排以 ˉ 或全形空白數判斷
    fields.filter(f => f.kind === 'text').forEach(f => {
      let split = 0;
      records.forEach(rc => {
        const v = rc.values[f.name]; if (typeof v !== 'string') return;
        const ind = (v.match(/^ˉ+/) || v.match(/^　+/) || [''])[0].length;
        const s = v.replace(/ˉ/g, '').replace(/^\s+/, '');
        const m = s.match(/^(\d{4,10}(?:-\d)?\*?)[\s　\/]*\n?[\s　]*([一-鿿A-Za-z][\s\S]*)$/);
        rc.split = rc.split || {};
        if (m && (/\n|　/.test(v.replace(/ˉ/g, '')) || /^\d{10}-\d/.test(m[1]))) { rc.split[f.name] = { code: m[1], name: normText(m[2]), indent: ind }; split++; }
        else rc.split[f.name] = { code: null, name: normText(v), indent: ind };
      });
      if (split >= 2) { f.isAccount = true; const b = f.name.replace(/(Name|Code)$/, '') || 'Account'; f.codeTag = b + 'Code'; f.nameTag = b + 'Name'; }
    });
    // 每筆的層級：取第一個文字欄的縮排
    const firstText = fields.find(f => f.kind === 'text' && f.isAccount) || fields.find(f => f.kind === 'text');
    records.forEach(rc => { const sp = firstText && rc.split && rc.split[firstText.name]; rc.indent = sp && sp.indent ? sp.indent : (sp ? 0 : null); });
    return { meta: Object.assign({ agency, unit, scope, dateText }, meta), fields, records, notes, twoLine, layout: { T, H0, H1, D, nrow, ncol }, recRows: recs.map(rc => ({ r: rc.r, r2: rc.v2 ? rc.r + 1 : null })), cols };
  }

  // ---------- 姓名遮蔽 ----------
  function maskName(n) {
    const a = Array.from(n);
    if (a.length <= 1) return n;
    if (a.length === 2) return a[0] + '○';
    return a[0] + '○'.repeat(a.length - 2) + a[a.length - 1];
  }
  function maskNames(s) { return String(s).split(/([\s　、,，\n]+)/).map(t => (/^[一-鿿]{2,4}$/.test(t) ? maskName(t) : t)).join(''); }

  // ---------- 輸出 ----------
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mesc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const fmtN = (v, dec) => typeof v === 'number' ? v.toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec }) : v;

  function toXML(t) {
    const m = t.meta, L = [];
    L.push('<?xml version="1.0" encoding="UTF-8"?>');
    L.push(`<FinalAccountsTable no="${xesc(m.no)}" title="${xesc(m.title)}" agency="${xesc(m.agency)}" fiscalYear="${xesc(m.year)}"` +
      (m.scope ? ` scope="${xesc(m.scope)}"` : '') + (m.dateText ? ` period="${xesc(m.dateText)}"` : '') +
      ` unit="${xesc(m.unit || '')}" generatedAt="${xesc(m.generatedAt)}">`);
    if (m.statement) { L.push(`  <Statement>${xesc(m.statement)}</Statement>`); L.push('</FinalAccountsTable>'); return L.join('\n') + '\n'; }
    L.push('  <Fields>');
    t.fields.forEach(f => {
      if (f.isAccount) { L.push(`    <Field name="${f.codeTag}" type="text" label="${xesc(f.label)}（編號）"/>`); L.push(`    <Field name="${f.nameTag}" type="text" label="${xesc(f.label)}（名稱）"/>`); }
      else L.push(`    <Field name="${f.name}" type="${f.kind}" label="${xesc(f.label)}"/>`);
    });
    L.push('  </Fields>');
    L.push('  <Records>');
    t.records.forEach((rc, i) => {
      const attrs = [`seq="${i + 1}"`, `type="${rc.type}"`];
      if (rc.indent != null) attrs.push(`level="${rc.indent}"`);
      L.push(`    <Record ${attrs.join(' ')}>`);
      t.fields.forEach(f => {
        if (f.isAccount) {
          const sp = rc.split && rc.split[f.name]; if (!sp || !sp.name && !sp.code) return;
          if (sp.code) L.push(`      <${f.codeTag}>${xesc(sp.code)}</${f.codeTag}>`);
          if (sp.name) L.push(`      <${f.nameTag}>${xesc(sp.name)}</${f.nameTag}>`);
          return;
        }
        const v = rc.values[f.name];
        if (v == null) return;
        const s = typeof v === 'number' ? String(v) : normText(v);
        if (s === '') return;
        L.push(`      <${f.name}>${xesc(s)}</${f.name}>`);
      });
      L.push('    </Record>');
    });
    L.push('  </Records>');
    if (t.notes.length) { L.push('  <Notes>'); t.notes.forEach(n => L.push(`    <Note>${xesc(n)}</Note>`)); L.push('  </Notes>'); }
    L.push('</FinalAccountsTable>');
    return L.join('\n') + '\n';
  }

  function toMD(t) {
    const m = t.meta, L = [];
    L.push(`# ${m.agency} ${m.title}`);
    L.push('');
    L.push([m.dateText || `中華民國${m.year}年度`, m.scope, m.unit ? '單位：' + m.unit : ''].filter(Boolean).join('｜'));
    L.push('');
    if (m.statement) { L.push(m.statement); L.push(''); L.push(`> 資料來源：${m.year}年度決算書表`); return L.join('\n') + '\n'; }
    const cols = [];
    const hdr = f => f.label.split('／').map(x => normText(x)).join('／');
    t.fields.forEach(f => {
      if (f.isAccount) {
        cols.push({ h: hdr(f) + '（編號）', get: rc => { const sp = rc.split && rc.split[f.name]; return sp && sp.code || ''; } });
        cols.push({ h: hdr(f) + '（名稱）', get: rc => { const sp = rc.split && rc.split[f.name]; return sp && sp.name ? '　'.repeat(sp.indent || 0) + sp.name : ''; } });
      }
      else cols.push({ h: hdr(f), num: f.kind === 'number', get: rc => { const v = rc.values[f.name]; if (v == null) return ''; if (typeof v === 'number') return /數量|人數|項數|購入數|^年度|年度別/.test(f.label.replace(/\s/g, '')) ? String(v) : fmtN(v, /%|％|比率/.test(f.label) ? 2 : undefined); const sp = rc.split && rc.split[f.name]; return '　'.repeat(sp ? sp.indent || 0 : 0) + normText(v); } });
    });
    L.push('| ' + cols.map(c => mesc(c.h)).join(' | ') + ' |');
    L.push('|' + cols.map(c => (c.num ? '--:' : '---')).join('|') + '|');
    t.records.forEach(rc => {
      const b = rc.type !== 'detail';
      L.push('| ' + cols.map(c => { const s = String(c.get(rc)); return s && b ? `**${mesc(s.trim())}**` : mesc(s); }).join(' | ') + ' |');
    });
    if (t.notes.length) { L.push(''); L.push('**備註**'); L.push(''); t.notes.forEach(n => L.push('- ' + n.replace(/\n/g, ' '))); }
    L.push('');
    L.push(`> 資料來源：${m.year}年度決算書表（會計系統產製）。產製時間：${m.generatedAt}`);
    return L.join('\n') + '\n';
  }

  // #38 由推算結果組成
  function table38(R, meta) {
    const fields = [
      { name: 'BudgetItem', label: '預算項目', kind: 'text' }, { name: 'FinalAccount', label: '決算數', kind: 'number' },
      { name: 'Adjustment', label: '調整數', kind: 'number' }, { name: 'Accounting', label: '會計收支', kind: 'number' },
      { name: 'AccountingItem', label: '會計科目', kind: 'text' }
    ];
    const records = R.rows.map(r => {
      const o = { values: {}, type: /^(歲入|歲出|歲計餘絀)$/.test(r[0]) ? 'total' : 'detail' };
      fields.forEach((f, i) => { const v = r[i]; if (v === '-' || v === 'ˉ' || v == null || v === '') return; o.values[f.name] = typeof v === 'string' ? v.replace(/ˉ/g, '') : v; if (typeof v === 'string' && /^ˉ/.test(v)) o.indent = 1; });
      return o;
    });
    return { meta, fields, records, notes: R.note.split('\n').filter(s => s && !/^備註/.test(s)), twoLine: false };
  }

  async function sha256Hex(data) {
    const subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : require('crypto').webcrypto.subtle;
    const buf = await subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 主流程：回傳 zip 與檔案清單
  async function build(XLSX, JSZip, an, opts) {
    opts = opts || {};
    const now = opts.now || new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().replace(/\.\d+Z$/, '') + (() => { const o = -now.getTimezoneOffset(); return (o >= 0 ? '+' : '-') + String(Math.floor(Math.abs(o) / 60)).padStart(2, '0') + ':' + String(Math.abs(o) % 60).padStart(2, '0'); })();
    const year = an.year;
    const folder = `${year}年度決算公告`;
    const zip = new JSZip(); const dir = zip.folder(folder);
    const list = [];
    let agency = '';
    const titles = {}; (opts.TABLES || []).forEach(([n, t]) => { titles[n] = t; });
    const items = [];
    Object.keys(an.sys).forEach(no => items.push({ no, src: an.sys[no] }));
    (an.details || []).filter(d => d.tplSheet).forEach(d => items.push({ no: d.tplSheet.split('.')[0], src: d, title: d.subject + '明細表' }));
    items.push({ no: '12' }); items.push({ no: '38' });
    items.sort((a, b) => parseFloat(a.no) - parseFloat(b.no));
    if (opts.include) for (let k = items.length - 1; k >= 0; k--) if (!opts.include.has(String(items[k].no))) items.splice(k, 1);
    const tables = [];
    for (const it of items) {
      const title = it.title || titles[it.no] || (it.src ? it.src.title : '');
      const meta = { no: it.no, title, year, generatedAt: iso };
      let t;
      if (it.no === '12') {
        t = { meta: Object.assign(meta, { statement: opts.no12 ? '本年度無歲出賸餘（或減免、註銷）數。' : '本表另行人工編製。' }), fields: [], records: [], notes: [] };
      } else if (it.no === '38') {
        if (!opts.R) continue;
        t = table38(opts.R, Object.assign(meta, { unit: '新臺幣元' }));
      } else {
        t = extract(XLSX, it.src.ws, meta);
      }
      if (t.meta.agency) agency = agency || t.meta.agency;
      tables.push(t);
    }
    tables.forEach(t => { if (!t.meta.unit && !t.meta.statement) t.meta.unit = t.fields.some(f => /%|％/.test(f.label)) ? '新臺幣元；%' : '新臺幣元';
      if (!t.meta.agency) t.meta.agency = agency; if (!t.meta.dateText && !t.meta.statement) t.meta.dateText = `中華民國${year}年度`; });
    // #17 姓名遮蔽
    if (opts.maskNames !== false) tables.forEach(t => {
      const f = t.fields.find(x => /姓名/.test(x.label));
      if (f) { t.records.forEach(rc => { if (rc.values[f.name]) rc.values[f.name] = maskNames(rc.values[f.name]); }); t.meta.masked = true; }
    });
    for (const t of tables) {
      const base = `${String(t.meta.no).padStart(2, '0')}_${t.meta.title.replace(/[\\/:*?"<>|（）()、，]/g, '')}`;
      const xml = toXML(t), md = toMD(t);
      dir.file(base + '.xml', xml); dir.file(base + '.md', md);
      list.push({ no: t.meta.no, title: t.meta.title, base, records: t.records.length, fields: t.fields.length, masked: !!t.meta.masked, xml, md,
        shaXml: await sha256Hex(xml), shaMd: await sha256Hex(md), statement: t.meta.statement });
    }
    // 索引
    const ix = [];
    ix.push(`# ${agency} ${year}年度決算書表 公告檔目錄`, '', `產製時間：${iso}　共 ${list.length} 張表`, '');
    ix.push('| 表號 | 表名 | 筆數 | XML | MD | XML SHA-256 |', '|---|---|--:|---|---|---|');
    list.forEach(l => ix.push(`| ${l.no} | ${l.title}${l.masked ? '（姓名已遮蔽）' : ''} | ${l.statement ? '—' : l.records} | [${l.base}.xml](${encodeURI(l.base)}.xml) | [${l.base}.md](${encodeURI(l.base)}.md) | \`${l.shaXml}\` |`));
    ix.push('', '各檔 MD 的 SHA-256：', '');
    list.forEach(l => ix.push(`- ${l.base}.md　\`${l.shaMd}\``));
    ix.push('', '> 驗證方式：Windows 可在命令提示字元執行 `certutil -hashfile 檔名 SHA256` 比對。');
    const ixXml = ['<?xml version="1.0" encoding="UTF-8"?>', `<FinalAccountsPackage agency="${xesc(agency)}" fiscalYear="${year}" generatedAt="${iso}" tables="${list.length}">`]
      .concat(list.map(l => `  <Table no="${xesc(l.no)}" title="${xesc(l.title)}" records="${l.statement ? 0 : l.records}" masked="${l.masked}">\n    <File format="xml" name="${xesc(l.base)}.xml" sha256="${l.shaXml}"/>\n    <File format="md" name="${xesc(l.base)}.md" sha256="${l.shaMd}"/>\n  </Table>`))
      .concat(['</FinalAccountsPackage>']).join('\n') + '\n';
    dir.file('index.md', ix.join('\n') + '\n'); dir.file('index.xml', ixXml);
    const isNode = typeof window === 'undefined';
    const buf = await zip.generateAsync({ type: isNode ? 'nodebuffer' : 'blob', compression: 'DEFLATE' });
    return { buf, list, folder, indexMd: ix.join('\n') };
  }

  function candidates(an, TABLES) {
    const titles = {}; (TABLES || []).forEach(([n, t]) => { titles[n] = t; });
    const out = Object.keys(an.sys).map(no => ({ no, title: titles[no] || an.sys[no].title }));
    (an.details || []).filter(d => d.tplSheet).forEach(d => out.push({ no: d.tplSheet.split('.')[0], title: d.subject + '明細表' }));
    out.push({ no: '12', title: titles['12'] }); out.push({ no: '38', title: titles['38'] });
    return out.sort((a, b) => parseFloat(a.no) - parseFloat(b.no));
  }
  return { extract, toXML, toMD, build, maskNames, candidates };
});
