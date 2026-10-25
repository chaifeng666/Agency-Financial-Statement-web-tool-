/* 決算書表套版核心邏輯（瀏覽器與 Node 共用）
 * 依賴：SheetJS（讀 .xls）、ExcelJS（讀範本樣式、寫 .xlsx）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 小工具 ----------
  const norm = s => (s == null ? '' : String(s)).replace(/[\s　ˉ_]/g, '');
  const isNum = v => typeof v === 'number' && isFinite(v);
  const toNum = v => {
    if (isNum(v)) return v;
    if (v == null) return null;
    const s = String(v).replace(/[,\s]/g, '');
    if (s === '' || s === '-') return s === '-' ? 0 : null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  };
  const fmt = n => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  // ExcelJS 儲存格值 → 純文字／數字
  const plain = v => {
    if (v == null) return v;
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(t => t.text).join('');
      if ('result' in v) return v.result;
      if (v.text != null) return v.text;
    }
    return v;
  };

  // 表號清單（依 112 年範本）
  const TABLES = [
    ['1', '歲入來源別決算表'], ['2', '歲出政事別決算表'], ['3', '歲出機關別決算表'],
    ['4', '以前年度歲出政事別轉入數決算表'], ['5', '以前年度歲出機關別轉入數決算表'],
    ['6', '歲出用途別決算分析表'], ['7', '歲出用途別決算累計表'], ['8', '繳付公庫數分析表'],
    ['9', '公庫撥入數分析表'], ['10', '歲入餘絀（或減免、註銷）分析表'], ['10-1', '本頁空白'],
    ['11', '歲出保留分析表'], ['12', '歲出賸餘（或減免、註銷）分析表'], ['13', '人事費分析表'],
    ['14', '增購及汰換車輛明細表'], ['15', '補、捐（獎）助經費報告表'], ['16', '委託辦理計畫（事項）經費報告表'],
    ['17', '出國計畫執行情形報告表'], ['18', '歲出按職能及經濟性綜合分類表'], ['19', '廣告宣傳（另行 PDF）'],
    ['20', '平衡表'], ['21', '收入支出表'], ['22-36', '平衡表各科目明細表'],
    ['37', '長期投資、固定資產、遞耗資產及無形資產變動表'], ['38', '決算與會計收支對照表'],
    ['39', '現金出納表'], ['40', '國有財產目錄總表']
  ];
  // 處理方式：sys=系統檔＋範本格式；copy=照抄範本；derive=推算；judge12=判斷有無
  const MODE = { '10-1': 'copy', '19': 'copy', '12': 'judge12', '38': 'derive' };

  // ---------- 步驟一：表名分析 ----------
  function parseSysName(name) {
    const m = String(name).match(/^(\d{2,3})_(\d+)_(.+?)_(\d{14})/);
    if (!m) return null;
    return { year: +m[1], no: m[2], title: m[3].replace(/^(決算編[制製]|決算書表編製|決算書表)[-_]?/, ''), stamp: m[4] };
  }
  function sheetNo(title) {
    const m = String(title).match(/^(\d+(?:-\d+)?)\./);
    return m ? m[1] : null;
  }
  function templateYear(tplWb) {
    for (const ws of tplWb.worksheets) {
      let y = null;
      ws.eachRow({ includeEmpty: false }, row => row.eachCell(c => {
        const pv = plain(c.value); const m = !y && typeof pv === 'string' && pv.trim().match(/^(\d{2,3})年度$/);
        if (m) y = +m[1];
      }));
      if (y) return y;
    }
    return null;
  }

  function analyze(XLSX, tplWb, sysFiles /* [{name, sheet(SheetJS ws)}] */) {
    const tplSheets = {};
    tplWb.worksheets.forEach(ws => { const n = sheetNo(ws.name); if (n) (tplSheets[n] = tplSheets[n] || []).push(ws.name); });
    const sys = {};
    let year = null;
    const details = [];
    sysFiles.forEach(f => {
      const p = parseSysName(f.name);
      if (!p) return;
      year = year || p.year;
      const rec = Object.assign({ file: f.name, ws: f.sheet }, p);
      if (/科目明細表/.test(p.title)) details.push(rec); else sys[p.no] = rec;
    });
    // 明細表：以總計金額對應 #20 平衡表科目，找出科目名稱與範本工作表
    const g20 = sys['20'] ? grid(XLSX, sys['20'].ws) : null;
    details.forEach(d => {
      const g = grid(XLSX, d.ws); const r = findRow(g, 3, /^總計$/); let tot = null;
      if (r >= 0) for (let c = g[r].length - 1; c >= 0; c--) if (isNum(g[r][c])) { tot = g[r][c]; break; }
      d.total = tot; d.subject = null;
      if (g20 && tot != null) for (const row of g20) for (const [lc, vc] of [[0, 1], [3, 4]]) {
        if (!d.subject && row && toNum(row[vc]) === tot && /^\d{6}/.test(norm(row[lc]))) d.subject = norm(row[lc]).replace(/^\d{6}/, '');
      }
      d.tplSheet = null;
      if (d.subject) tplWb.worksheets.forEach(ws => { const n = parseInt(sheetNo(ws.name), 10); if (n >= 22 && n <= 36 && ws.name.indexOf(d.subject) >= 0) d.tplSheet = ws.name; });
    });
    const rows = TABLES.map(([no, title]) => {
      let tpl = [];
      if (no === '22-36') { for (let i = 22; i <= 36; i++) tpl = tpl.concat(tplSheets[String(i)] || []); }
      else tpl = tplSheets[no] || [];
      let status, note = '';
      if (MODE[no] === 'copy') { status = 'copy'; note = '固定頁，照抄範本'; }
      else if (MODE[no] === 'derive') { status = 'derive'; note = '依各表數字自動推算'; }
      else if (MODE[no] === 'judge12') { status = 'judge'; note = '依 #4 減免（註銷）數判斷有無'; }
      else if (no === '22-36') {
        const ok = details.filter(d => d.tplSheet);
        status = ok.length ? 'partial' : 'skip';
        note = (ok.length ? '有系統檔：' + ok.map(d => d.tplSheet + '（' + fmt(d.total) + '）').join('、') + '；其餘不輸出' : '本年度不輸出') +
          (details.length > ok.length ? `；${details.length - ok.length} 個明細表對不到科目` : '');
      } else if (sys[no]) status = 'ok';
      else { status = 'missing'; note = '缺系統檔'; }
      return { no, title, tpl, sys: sys[no] ? sys[no].file : (no === '22-36' ? Object.keys(sys).filter(k => +k >= 22 && +k <= 36).map(k => sys[k].file).join('\n') : ''), status, note };
    });
    rows.forEach(r => { if (r.no === '22-36') r.sys = details.map(d => d.file).join('\n'); });
    return { rows, sys, details, tplYear: templateYear(tplWb), year };
  }

  // ---------- 取值工具 ----------
  function grid(XLSX, ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }); }
  function findRow(g, col, re, from) {
    for (let r = from || 0; r < g.length; r++) if (g[r] && re.test(norm(g[r][col]))) return r;
    return -1;
  }
  function pick(g, col, re, vcol, from) {
    if (!g) return null;
    const r = findRow(g, col, re, from);
    return r < 0 ? null : toNum(g[r][vcol]);
  }

  // ---------- 步驟二：勾稽 ----------
  function runChecks(XLSX, sys, details) {
    const G = {};
    Object.keys(sys).forEach(k => { G[k] = grid(XLSX, sys[k].ws); });
    const out = [];
    const eq = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 0.5);
    const add = (id, group, title, items, ok, extra) => out.push({ id, group, title, items, ok, extra: extra || '' });
    const need = (...ks) => ks.filter(k => !G[k]);

    // A1
    (function () {
      const miss = need('1', '8', '21', '39');
      const a = pick(G['1'], 4, /^合計$/, 8), b = pick(G['8'], 0, /^合計$/, 9), c = pick(G['21'], 0, /^繳付公庫數$/, 1), d = pick(G['39'], 0, /本年度歲入$/, 1);
      add('A1', '歲入', '#1 歲入實現數 ＝ #8 繳付公庫數 ＝ #21 繳付公庫數 ＝ #39 本年度歲入',
        [['#1', a], ['#8', b], ['#21', c], ['#39', d]], !miss.length && eq(a, b) && eq(b, c) && eq(c, d), miss.length ? '缺 #' + miss.join('、#') : '');
    })();
    // A2
    (function () {
      const pairs = [['稅課收入', '稅課收入'], ['罰款及賠償收入', '罰款及賠償收入'], ['規費收入', '規費收入'], ['財產收入', '財產收益'], ['捐獻及贈與收入', '捐獻及贈與收入'], ['其他收入', '其他收入']];
      const items = []; let ok = !!(G['1'] && G['21']);
      pairs.forEach(([a, b]) => {
        let v1 = null;
        if (G['1']) for (let r = 0; r < G['1'].length; r++) { const row = G['1'][r]; if (row && norm(row[0]) && new RegExp(a + '$').test(norm(row[4]))) { v1 = toNum(row[8]); break; } }
        const v2 = pick(G['21'], 0, new RegExp('^' + b + '$'), 1);
        if (v1 == null && v2 == null) return;
        items.push([a + '／' + b, (v1 || 0), (v2 || 0)]);
        if (!eq(v1 || 0, v2 || 0)) ok = false;
      });
      add('A2', '歲入', '#1 各款決算數 ＝ #21 對應收入科目', items.map(i => [i[0], i[1], i[2]]), ok);
    })();
    // A3
    (function () {
      const g10 = G['10'], g1 = G['1']; const items = []; let ok = !!(g10 && g1); let cy = null; const yr = sys['1'] ? sys['1'].year : null;
      if (ok) for (let r = 0; r < g10.length; r++) {
        const row = g10[r]; if (!row) continue;
        const y = toNum(row[0]); if (y && y > 50 && y < 300) cy = y;
        const m = norm(row[1]).match(/^(\d{10})-\d/); if (!m || cy !== yr) continue;
        const v10 = toNum(row[2]);
        let v1 = null;
        for (let k = 0; k < g1.length; k++) { const x = g1[k]; if (x && norm(x[4]).indexOf(m[1]) >= 0) { v1 = toNum(x[12]); break; } }
        items.push([norm(row[1]).replace(/^\d{10}-\d/, ''), v10, v1]);
        if (!eq(v10, v1)) ok = false;
      }
      add('A3', '歲入', '#10 各節餘絀數 ＝ #1 預決算比較增減數', items, ok && items.length > 0, items.length ? '' : '無可比對資料');
    })();
    // B1
    (function () {
      const r2 = G['2'] ? findRow(G['2'], 4, /^合計$/) : -1, r3 = G['3'] ? findRow(G['3'], 4, /^合計$/) : -1;
      const a1 = r2 >= 0 ? toNum(G['2'][r2][10]) : null, a2 = r2 >= 0 ? toNum(G['2'][r2][11]) : null;
      const b1 = r3 >= 0 ? toNum(G['3'][r3][10]) : null, b2 = r3 >= 0 ? toNum(G['3'][r3][11]) : null;
      add('B1', '歲出', '#2 政事別合計 ＝ #3 機關別合計（實現數、保留數）', [['實現數', a1, b1], ['保留數', a2, b2]], eq(a1, b1) && eq(a2, b2));
    })();
    // B2
    (function () {
      const r2 = G['2'] ? findRow(G['2'], 4, /^合計$/) : -1;
      const real = r2 >= 0 ? toNum(G['2'][r2][10]) : null, keep = r2 >= 0 ? toNum(G['2'][r2][11]) : null;
      const r9 = pick(G['9'], 0, /^本年度$/, 1), u9 = pick(G['9'], 0, /^本年度$/, 10);
      const k11 = G['11'] ? (pick(G['11'], 1, /^經資門小計$/, 4) || 0) : null;
      add('B2', '歲出', '#9 本年度歲出實現數 ＝ #2 實現數；#9 未撥入數 ＝ #2 保留數 ＝ #11 經資門小計',
        [['實現數 #2／#9', real, r9], ['保留數 #2／#9', keep, u9], ['保留數 #2／#11', keep, k11]], eq(real, r9) && eq(keep, u9) && eq(keep, k11));
    })();
    // B3
    (function () {
      const g6 = G['6'], g3 = G['3']; let v6 = null, v3 = null;
      if (g6) { let r = -1; for (let k = g6.length - 1; k >= 0; k--) if (g6[k] && /^合計$/.test(norm(g6[k][4]))) { r = k; break; } if (r >= 0) v6 = toNum(g6[r][14]); }
      if (g3) {
        const rt = findRow(g3, 4, /^合計$/); const rs = findRow(g3, 4, /^統籌科目小計$/);
        if (rt >= 0) v3 = toNum(g3[rt][10]) + toNum(g3[rt][11]) - (rs >= 0 ? toNum(g3[rs][10]) + toNum(g3[rs][11]) : 0);
      }
      add('B3', '歲出', '#6 用途別合計 ＝ #3 合計（實現＋保留）扣除統籌科目', [['決算數', v6, v3]], eq(v6, v3));
    })();
    // B4
    (function () {
      let v4 = null; const g4 = G['4'];
      if (g4) { const r = findRow(g4, 5, /^合計$/); if (r >= 0) v4 = (toNum(g4[r][8]) || 0) + (toNum((g4[r + 1] || [])[8]) || 0); }
      const v9 = pick(G['9'], 0, /^一、以前年度應付\(保留\)數$/, 1), v39 = pick(G['39'], 0, /以前年度歲出撥款$/, 1);
      add('B4', '歲出', '#4 以前年度實現數 ＝ #9 以前年度應付保留數 ＝ #39 以前年度歲出撥款', [['#4', v4], ['#9', v9], ['#39', v39]], eq(v4, v9) && eq(v9, v39));
    })();
    // B5
    (function () {
      const v13 = pick(G['13'], 0, /^合計$/, 4); let v6 = null; const g6 = G['6'];
      if (g6) for (let k = g6.length - 1; k >= 0; k--) if (g6[k] && /^合計$/.test(norm(g6[k][4]))) { v6 = toNum(g6[k][5]); break; }
      add('B5', '歲出', '#13 人事費決算數 ＝ #6 人事費', [['人事費', v13, v6]], eq(v13, v6));
    })();
    // B6
    (function () {
      let v18 = null; const g18 = G['18'];
      if (g18) { const r = findRow(g18, 0, /^總計$/); if (r >= 0) { const row = g18[r]; for (let c = row.length - 1; c >= 0; c--) if (isNum(row[c])) { v18 = row[c]; break; } } }
      let v2 = null; const g2 = G['2'];
      if (g2) { const r = findRow(g2, 4, /^合計$/); if (r >= 0) v2 = toNum(g2[r][10]) + toNum(g2[r][11]); }
      const k = v2 == null ? null : Math.round(v2 / 1000);
      add('B6', '歲出', '#18 職能別總計（千元）≒ #2 決算合計 ÷ 1000（容許四捨五入差 ±5 千元）', [['千元', v18, k]], v18 != null && k != null && Math.abs(v18 - k) <= 5);
    })();
    // B7
    (function () {
      let v = null; const g4 = G['4'];
      if (g4) { const r = findRow(g4, 5, /^合計$/); if (r >= 0) v = (toNum(g4[r][7]) || 0) + (toNum((g4[r + 1] || [])[7]) || 0); }
      add('B7', '歲出', '#4 本年度減免（註銷）數 → 判斷 #12 有無', [['減免（註銷）數', v]], v != null, v == null ? '缺 #4' : (v === 0 ? '本年度無賸餘，#12 輸出「本年度無」' : '本年度有減免（註銷）數，#12 需人工編製'));
    })();
    // C1
    (function () {
      const a = pick(G['20'], 0, /^1資產$/, 1), l = pick(G['20'], 3, /^2負債$/, 4), e = pick(G['20'], 3, /^3淨資產$/, 4);
      add('C1', '財務', '#20 資產 ＝ 負債 ＋ 淨資產', [['資產', a], ['負債＋淨資產', l == null || e == null ? null : l + e]], eq(a, (l || 0) + (e || 0)) && l != null);
    })();
    // C2
    (function () {
      const a = pick(G['9'], 0, /^合計$/, 9), b = pick(G['21'], 0, /^公庫撥入數$/, 1), c = pick(G['39'], 0, /\(五\)\.公庫撥入數$/, 1);
      add('C2', '財務', '#9 公庫撥入合計 ＝ #21 公庫撥入數 ＝ #39 公庫撥入數', [['#9', a], ['#21', b], ['#39', c]], eq(a, b) && eq(b, c));
    })();
    // C3
    (function () {
      const a = pick(G['20'], 0, /專戶存款$/, 1), a0 = pick(G['20'], 0, /專戶存款$/, 2);
      const b = pick(G['39'], 0, /^二、本期結存$/, 1), b0 = pick(G['39'], 0, /^一、上期結存$/, 1);
      add('C3', '財務', '#20 專戶存款本年／上年 ＝ #39 本期結存／上期結存', [['本年度', a, b], ['上年度', a0, b0]], eq(a, b) && eq(a0, b0));
    })();
    // C4
    (function () {
      const names = ['土地', '土地改良物', '房屋建築及設備', '機械及設備', '交通及運輸設備', '雜項設備', '購建中固定資產', '電腦軟體'];
      const items = []; let ok = !!(G['37'] && G['20']);
      names.forEach(n => {
        const v37 = pick(G['37'], 0, new RegExp('^' + n + '$'), 6);
        const cost = pick(G['20'], 0, new RegExp('^\\d{6}' + n + '$'), 1);
        const dep = pick(G['20'], 0, new RegExp('累計折舊─' + n + '$'), 1);
        if (v37 == null && cost == null) return;
        const v20 = (cost || 0) + (dep || 0);
        items.push([n, v37, v20]); if (!eq(v37 || 0, v20)) ok = false;
      });
      add('C4', '財務', '#37 各資產期末帳面 ＝ #20 成本 − 累計折舊', items, ok);
    })();
    // C5
    (function () {
      const a = pick(G['40'], 0, /^總值$/, 4), b = pick(G['37'], 0, /^小計$/, 6);
      add('C5', '財務', '#40 國有財產總值 ＝ #37 固定資產小計', [['總值', a, b]], eq(a, b));
    })();
    // C6
    (function () {
      const i = pick(G['21'], 0, /^收入$/, 1), e = pick(G['21'], 0, /^支出$/, 1), s = pick(G['21'], 0, /^收支餘絀$/, 1);
      add('C6', '財務', '#21 收支餘絀 ＝ 收入 − 支出', [['收支餘絀', s, i == null || e == null ? null : i - e]], eq(s, i - e));
    })();
    // C7
    (function () {
      const n1 = pick(G['20'], 3, /^3淨資產$/, 4), n0 = pick(G['20'], 3, /^3淨資產$/, 5);
      const s = pick(G['21'], 0, /^收支餘絀$/, 1), o = pick(G['39'], 0, /其他影響非流動資產之項目$/, 1) || 0, rf = pick(G['39'], 0, /退還以前年度歲入繳庫數\(-\)$/, 1) || 0;
      const d = n1 == null || n0 == null ? null : n1 - n0;
      add('C7', '財務', '#20 淨資產增減 ＝ #21 收支餘絀 ＋ #39 其他影響非流動資產項目 ＋ 退還以前年度歲入', [['淨資產增減', d, s == null ? null : s + o + rf]], eq(d, s + o + rf));
    })();
    // C8
    (function () {
      const items = []; let ok = true;
      const l21 = pick(G['21'], 0, /^財產損失$/, 1), l39 = pick(G['39'], 0, /財產交易利益\(損失\)$/, 1);
      items.push(['財產損失', l21 || 0, -(l39 || 0)]); if (!eq(l21 || 0, -(l39 || 0))) ok = false;
      const d21 = pick(G['21'], 0, /^折舊、折耗及攤銷$/, 1), d39 = pick(G['39'], 0, /折舊、折耗及攤銷\(-\)$/, 1);
      items.push(['折舊', d21 || 0, -(d39 || 0)]); if (!eq(d21 || 0, -(d39 || 0))) ok = false;
      (details || []).forEach(dt => {
        items.push(['明細表 ' + (dt.subject || '（未對應）') + '／#20', dt.total, dt.subject ? dt.total : null]); if (!dt.subject) ok = false;
      });
      add('C8', '財務', '#21 財產損失、折舊 ＝ #39 對應數；明細表總計 ＝ #20 科目餘額', items, ok && !!G['21'] && !!G['39']);
    })();
    return out;
  }

  // ---------- #38 推算 ----------
  function derive38(XLSX, sys, unmetAsset /* 未達財產標準數，null=自動 */) {
    const G = {}; Object.keys(sys).forEach(k => { G[k] = grid(XLSX, sys[k].ws); });
    const g1 = G['1'], g6 = G['6'], g3 = G['3'], g21 = G['21'], g39 = G['39'], g11 = G['11'], g2 = G['2'];
    const inc = n => { if (!g1) return 0; for (const row of g1) if (row && norm(row[0]) && new RegExp(n + '$').test(norm(row[4]))) return toNum(row[8]) || 0; return 0; };
    const a21 = n => (g21 ? pick(g21, 0, new RegExp('^' + n + '$'), 1) : null) || 0;
    let r6 = -1; if (g6) for (let k = g6.length - 1; k >= 0; k--) if (g6[k] && /^合計$/.test(norm(g6[k][4]))) { r6 = k; break; }
    const c6 = c => (r6 >= 0 ? toNum(g6[r6][c]) || 0 : 0);
    let pool = 0; if (g3) { const rs = findRow(g3, 4, /^統籌科目小計$/); if (rs >= 0) pool = (toNum(g3[rs][10]) || 0) + (toNum(g3[rs][11]) || 0); }
    const R = {
      revTax: inc('稅課收入'), revFine: inc('罰款及賠償收入'), revFee: inc('規費收入'), revProp: inc('財產收入'),
      revBiz: inc('營業盈餘及事業收入'), revDon: inc('捐獻及贈與收入'), revOth: inc('其他收入'),
      treasuryIn: a21('公庫撥入數'),
      expPer: c6(5) + pool, expBiz: c6(6) + c6(10), expSub: c6(7) + c6(12), expEq: c6(11), expDebt: c6(8),
      pay: a21('繳付公庫數'), accPer: a21('人事支出'), accBiz: a21('業務支出'), accSub: a21('獎補助支出'),
      accLoss: a21('財產損失'), accInvLoss: a21('投資損失'), accInt: a21('利息費用及手續費'), accDep: a21('折舊、折耗及攤銷'), accOth: a21('其他支出'),
      pool
    };
    R.revTotal = R.revTax + R.revFine + R.revFee + R.revProp + R.revBiz + R.revDon + R.revOth;
    R.expTotal = R.expPer + R.expBiz + R.expSub + R.expEq + R.expDebt;
    let exp2 = null; if (g2) { const r = findRow(g2, 4, /^合計$/); if (r >= 0) exp2 = toNum((g2[r + 1] || [])[11]); }
    R.expTotalSys = exp2;
    R.accIncome = a21('收入'); R.accExpense = a21('支出'); R.accSurplus = a21('收支餘絀');
    // 調整數
    R.adjPer = R.accPer - R.expPer; R.adjBiz = R.accBiz - R.expBiz; R.adjSub = R.accSub - R.expSub; R.adjEq = -R.expEq; R.adjDebt = R.accInt - R.expDebt;
    R.adjExp = R.pay + R.adjPer + R.adjBiz + R.adjSub + R.adjEq + R.accLoss + R.accInvLoss + R.adjDebt + R.accDep + R.accOth;
    R.adjRev = R.treasuryIn;
    R.surplusBud = R.revTotal - R.expTotal; R.adjSurplus = R.adjRev - R.adjExp;
    // 業務費調整明細
    R.keepThisYear = g11 ? (pick(g11, 1, /^經常門小計$/, 3) || 0) : 0;
    let prevPaid = 0; if (g39) { const r = findRow(g39, 0, /以前年度轉入實現數$/); if (r >= 0) { const r2 = findRow(g39, 0, /\(2\)\.其他$/, r + 1); if (r2 >= 0) prevPaid = toNum(g39[r2][1]) || 0; } }
    R.prevPaid = prevPaid;
    R.unmetAuto = R.adjBiz + R.keepThisYear - R.prevPaid;
    R.unmet = unmetAsset == null || unmetAsset === '' ? R.unmetAuto : Number(unmetAsset);
    R.bizDiff = R.unmet - R.keepThisYear + R.prevPaid - R.adjBiz;
    R.checks = [
      ['歲入＋調整數 ＝ #21 收入', R.revTotal + R.adjRev, R.accIncome],
      ['歲出＋調整數 ＝ #21 支出', R.expTotal + R.adjExp, R.accExpense],
      ['用途別歲出合計 ＝ #2 決算合計(2)', R.expTotal, R.expTotalSys],
      ['業務費調整明細 ＝ 業務費調整數', R.unmet - R.keepThisYear + R.prevPaid, R.adjBiz],
      ['收支餘絀 ＝ #21 收支餘絀', R.surplusBud + R.adjSurplus, R.accSurplus]
    ];
    const f = fmt;
    const L = ['備註:'];
    L.push(`1.歲入調整數${f(R.adjRev)}元=本年度累計實支數${f(R.treasuryIn)}元。`);
    L.push(`2.歲出調整數${f(R.adjExp)}元，係以下各項調整數增減互抵結果：`);
    let i = 1; const it = s => L.push(`(${i++}).${s}`);
    if (R.pay) it(`繳付公庫數調整數${f(R.pay)}元=本年度累計實收數${f(R.pay)}元`);
    if (R.adjPer) it(`人事支出調整數${f(R.adjPer)}元。`);
    if (R.adjBiz) it(`業務支出調整數${f(R.adjBiz)}元=購置設備及電腦軟體未達財產標準${f(R.unmet)}元-本年度申請預算保留數${f(R.keepThisYear)}元+本年度支付以前年度保留數${f(R.prevPaid)}元。`);
    if (R.adjSub) it(`獎補助支出調整數${f(R.adjSub)}元。`);
    if (R.adjEq) it(`設備及投資${f(R.adjEq)}元。`);
    if (R.accLoss) it(`財產損失調整數${f(R.accLoss)}元=報廢財產帳面殘值數${f(R.accLoss)}元。`);
    if (R.accDep) it(`折舊、折耗及攤銷調整數${f(R.accDep)}元=本年度提列折舊及攤銷累計數${f(R.accDep)}元。`);
    L.push(`3.累計餘絀調整數${f(R.adjSurplus)}元=歲入調整數${f(R.adjRev)}元-歲出調整數${f(R.adjExp)}元。`);
    R.note = L.join('\n');
    // 表格列（對應範本 #38 第 2–22 列）
    const d = v => (v ? v : '-');
    R.rows = [
      ['歲入', R.revTotal, R.adjRev, R.revTotal + R.adjRev, '收入'],
      ['ˉ', '-', R.treasuryIn, R.treasuryIn, 'ˉ公庫撥入數'],
      ['ˉ稅課收入', d(R.revTax), '-', d(R.revTax), 'ˉ稅課收入'],
      ['ˉ罰款及賠償收入', d(R.revFine), '-', d(R.revFine), 'ˉ罰款及賠償收入'],
      ['ˉ規費收入', d(R.revFee), '-', d(R.revFee), 'ˉ規費收入'],
      ['ˉ財產收入', d(R.revProp), '-', d(R.revProp), 'ˉ財產收益'],
      ['ˉ營業盈餘及事業收入', d(R.revBiz), '-', d(R.revBiz), 'ˉ投資收益'],
      ['ˉ捐獻及贈與收入', d(R.revDon), '-', d(R.revDon), 'ˉ捐獻及贈與收入'],
      ['ˉ其他收入', d(R.revOth), '-', d(R.revOth), 'ˉ其他收入'],
      ['歲出', R.expTotal, R.adjExp, R.expTotal + R.adjExp, '支出'],
      ['ˉ', '-', d(R.pay), d(R.pay), 'ˉ繳付公庫數'],
      ['ˉ人事費', d(R.expPer), d(R.adjPer), d(R.accPer), 'ˉ人事支出'],
      ['ˉ業務費', d(R.expBiz), d(R.adjBiz), d(R.accBiz), 'ˉ業務支出'],
      ['ˉ獎補助費', d(R.expSub), d(R.adjSub), d(R.accSub), 'ˉ獎補助支出'],
      ['ˉ設備及投資', d(R.expEq), d(R.adjEq), '-', 'ˉ'],
      ['ˉ', '-', d(R.accLoss), d(R.accLoss), 'ˉ財產損失'],
      ['ˉ', '-', d(R.accInvLoss), d(R.accInvLoss), 'ˉ投資損失'],
      ['ˉ債務費', d(R.expDebt), d(R.adjDebt), d(R.accInt), 'ˉ利息費用及手續費'],
      ['ˉ', '-', d(R.accDep), d(R.accDep), 'ˉ折舊、折耗及攤銷'],
      ['ˉ', '-', d(R.accOth), d(R.accOth), 'ˉ其他支出'],
      ['歲計餘絀', R.surplusBud, R.adjSurplus, R.surplusBud + R.adjSurplus, '收支餘絀']
    ];
    return R;
  }

  // ---------- 步驟三：套格式產生 ----------
  function yearReplacer(fromY, toY) {
    const dy = toY - fromY;
    const f = s => typeof s !== 'string' ? s : s.replace(/(\d{2,3})(年)/g, (m, y, t) => {
      const n = +y; return (n >= fromY - 3 && n <= fromY) ? String(n + dy).padStart(y.length, '0') + t : m;
    });
    return v => {
      if (v && typeof v === 'object' && v.richText) { v.richText.forEach(t => { t.text = f(t.text); }); return v; }
      return f(v);
    };
  }
  function colLetter(n) { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

  function copySheetMeta(src, dst, rep, lastRow) {
    dst.properties = Object.assign({}, clone(src.properties));
    dst.views = clone(src.views);
    const ps = clone(src.pageSetup) || {};
    if (ps.printArea && lastRow) ps.printArea = String(ps.printArea).replace(/(\$?[A-Z]+\$?)(\d+)$/, (m, c) => c + lastRow);
    dst.pageSetup = ps;
    const hf = clone(src.headerFooter) || {};
    Object.keys(hf).forEach(k => { if (typeof hf[k] === 'string') hf[k] = rep(hf[k]); });
    dst.headerFooter = hf;
    (src.columns || []).forEach((c, i) => { if (c && c.width) dst.getColumn(i + 1).width = c.width; if (c && c.hidden) dst.getColumn(i + 1).hidden = true; });
  }

  function copyWholeSheet(src, dst, rep) {
    copySheetMeta(src, dst, rep, null);
    src.eachRow({ includeEmpty: true }, (row, r) => {
      const d = dst.getRow(r); if (row.height) d.height = row.height;
      row.eachCell({ includeEmpty: true }, (c, ci) => { const x = d.getCell(ci); x.value = rep(clone(c.value)); x.style = clone(c.style); });
    });
    (src.model.merges || []).forEach(m => { try { dst.mergeCells(m); } catch (e) { } });
  }

  function rowKind(vals) {
    const t = vals.map(norm).join('|');
    if (/合計|小計|總計|總值/.test(t)) return 'total';
    if (/^備註|^\|*備註/.test(t)) return 'note';
    const hasNum = vals.some(isNum), hasText = vals.some(v => typeof v === 'string' && norm(v));
    if (!hasNum && !hasText) return 'blank';
    if (hasNum && !hasText) return 'line2';
    return 'normal';
  }

  // 產生單張：系統檔數值＋範本格式
  function buildFromSys(XLSX, sysWs, tplWs, dst, rep) {
    const g = grid(XLSX, sysWs);
    const S = g.length;
    const T = tplWs.rowCount;
    const tplVals = []; for (let r = 1; r <= T; r++) { const row = tplWs.getRow(r); const a = []; row.eachCell({ includeEmpty: true }, (c, ci) => { a[ci - 1] = (c.isMerged && c.master && c.master.address !== c.address) ? null : plain(c.value); }); tplVals.push(a); }
    // 表頭列數：兩邊文字一致（不含數字）的前導列
    let H = 0;
    for (let r = 0; r < Math.min(S, T, 15); r++) {
      const a = (g[r] || []).filter(v => typeof v === 'string' && norm(v) && !/^\d+年度$/.test(norm(v))).map(norm).join('|');
      const b = (tplVals[r] || []).filter(v => typeof v === 'string' && norm(v) && !/^\d+年度$/.test(norm(v))).map(norm).join('|');
      const hasNum = (g[r] || []).some(isNum);
      if (a === b && !hasNum) H = r + 1; else if (r >= 1 && H < r) break;
    }
    const kindsT = tplVals.map(rowKind);
    const mapRow = r => {
      if (r < H || S === T) return Math.min(r, T - 1);
      const k = rowKind(g[r] || []);
      const rel = S - 1 > H ? (r - H) / (S - 1 - H) : 0;
      let best = -1, bestD = 1e9;
      for (let t = H; t < T; t++) {
        if (kindsT[t] !== k) continue;
        const relT = T - 1 > H ? (t - H) / (T - 1 - H) : 0;
        const dd = Math.abs(relT - rel); if (dd < bestD) { bestD = dd; best = t; }
      }
      if (best < 0) best = Math.min(Math.max(H, Math.round(H + rel * (T - 1 - H))), T - 1);
      return best;
    };
    const ncol = Math.max(...g.map(r => (r ? r.length : 0)), tplWs.columnCount);
    const sysRows = sysWs['!rows'] || [];
    for (let r = 0; r < S; r++) {
      const t = mapRow(r);
      const trow = tplWs.getRow(t + 1);
      const drow = dst.getRow(r + 1);
      const sh = sysRows[r] && sysRows[r].hpt, th = trow.height;
      // 表頭沿用範本列高；資料列依系統檔（系統已依當年內容調整），沒有才用範本
      if (r < H) drow.height = th || sh || undefined;
      else drow.height = sh || th || undefined;
      for (let c = 0; c < ncol; c++) {
        const tc = trow.getCell(c + 1), dc = drow.getCell(c + 1);
        const st = clone(tc.style) || {};
        const addr = colLetter(c) + (r + 1); const sc = sysWs[addr];
        let v = g[r] ? g[r][c] : null;
        if (sc && sc.t === 'n' && !st.numFmt && sc.z && sc.z !== 'General') st.numFmt = sc.z;
        if (sc && sc.t === 'n' && st.numFmt === 'General' && sc.z && sc.z !== 'General') st.numFmt = sc.z;
        dc.style = st;
        if (v !== null && v !== undefined && v !== '') dc.value = typeof v === 'string' ? v : v;
      }
    }
    (sysWs['!merges'] || []).forEach(m => {
      try { dst.mergeCells(m.s.r + 1, m.s.c + 1, m.e.r + 1, m.e.c + 1); } catch (e) { }
    });
    copySheetMeta(tplWs, dst, rep, S);
    autoHeights(dst, sysWs['!merges'] || [], H, S, ncol);
    return { H, S, T };
  }

  // 長文字列：依欄寬估算需要的列高（只會放大、不會縮小）
  function textUnits(t) { let u = 0; for (const ch of String(t)) u += ch.charCodeAt(0) > 0x2E80 ? 2 : 1; return u; }
  function autoHeights(ws, merges, H, S, ncol) {
    const colW = c => (ws.getColumn(c + 1).width || 9);
    const span = {}; merges.forEach(m => { if (m.s.r === m.e.r || true) { let w = 0; for (let c = m.s.c; c <= m.e.c; c++) w += colW(c); span[m.s.r + ',' + m.s.c] = { w, rows: m.e.r - m.s.r + 1 }; } });
    for (let r = H; r < S; r++) {
      const row = ws.getRow(r + 1); let need = 0;
      for (let c = 0; c < ncol; c++) {
        const cell = row.getCell(c + 1); const v = cell.value;
        if (typeof v !== 'string' || v.length < 6) continue;
        if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue;
        const wrap = (cell.alignment && cell.alignment.wrapText) || v.indexOf('\n') >= 0;
        if (!wrap) continue;
        const sp = span[r + ',' + c] || { w: colW(c), rows: 1 };
        const fs = (cell.font && cell.font.size) || 10;
        const cap = Math.max(1, sp.w * 1.0 * 11 / fs); // 每列可容納的半形字寬
        let lines = 0; v.split('\n').forEach(seg => { lines += Math.max(1, Math.ceil(textUnits(seg) / cap)); });
        const h = (lines * fs * 1.32 + 4) / sp.rows;
        if (h > need) need = h;
      }
      if (need && need > (row.height || 15)) row.height = Math.min(409, Math.ceil(need));
    }
  }

  function build12(tplWs, dst, rep, hasData) {
    // 只保留表頭（含第 6 列欄名），資料列以「本年度無」取代
    let H = 6;
    for (let r = 1; r <= tplWs.rowCount; r++) { const v = plain(tplWs.getRow(r).getCell(1).value); if (/^\d{2,3}$/.test(String(v || '').trim())) { H = r - 1; break; } }
    copySheetMeta(tplWs, dst, rep, H + 1);
    for (let r = 1; r <= H; r++) {
      const s = tplWs.getRow(r), d = dst.getRow(r); if (s.height) d.height = s.height;
      s.eachCell({ includeEmpty: true }, (c, ci) => { const x = d.getCell(ci); x.value = rep(clone(c.value)); x.style = clone(c.style); });
    }
    (tplWs.model.merges || []).forEach(m => { const mm = m.match(/\d+/g).map(Number); if (Math.max(...mm) <= H) try { dst.mergeCells(m); } catch (e) { } });
    const s = tplWs.getRow(H + 1), d = dst.getRow(H + 1); d.height = 30;
    const last = tplWs.columnCount;
    s.eachCell({ includeEmpty: true }, (c, ci) => { const x = d.getCell(ci); x.style = clone(c.style); });
    d.getCell(1).value = hasData ? '（本年度有減免、註銷數，請依 #4 人工編製）' : '本年度無歲出賸餘（或減免、註銷）數。';
    d.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    const lastCol = Math.max(2, last - 1);
    try { dst.mergeCells(H + 1, 1, H + 1, lastCol); } catch (e) { }
  }

  function build38(tplWs, dst, rep, R) {
    copySheetMeta(tplWs, dst, rep, null);
    for (let r = 1; r <= tplWs.rowCount; r++) {
      const s = tplWs.getRow(r), d = dst.getRow(r); if (s.height) d.height = s.height;
      s.eachCell({ includeEmpty: true }, (c, ci) => { const x = d.getCell(ci); x.style = clone(c.style); x.value = rep(clone(c.value)); });
    }
    (tplWs.model.merges || []).forEach(m => { try { dst.mergeCells(m); } catch (e) { } });
    R.rows.forEach((row, i) => row.forEach((v, j) => { dst.getRow(i + 2).getCell(j + 1).value = v; }));
    dst.getCell('A23').value = R.note;
  }

  function addCheckSheet(wb, checks, R) {
    const ws = wb.addWorksheet('核對結果');
    ws.columns = [{ width: 6 }, { width: 8 }, { width: 60 }, { width: 8 }, { width: 70 }];
    ws.addRow(['編號', '類別', '勾稽規則', '結果', '比對數字']).font = { bold: true };
    checks.forEach(c => {
      if (c.group === '作業紀錄') {
        ws.addRow([]); ws.addRow(['', '作業紀錄', '各步驟確認']).font = { bold: true };
        c.items.forEach(i => { const row = ws.addRow(['', '', i[0]]); row.alignment = { wrapText: true, vertical: 'top' }; });
        return;
      }
      const nums = c.items.map(i => i[0] + '：' + i.slice(1).map(fmt).join(' ／ ')).join('；');
      const row = ws.addRow([c.id, c.group, c.title, c.ok ? '相符' : '不符', nums + (c.extra ? '（' + c.extra + '）' : '')]);
      row.getCell(4).font = { color: { argb: c.ok ? 'FF1B7F3B' : 'FFC0392B' }, bold: true };
      row.alignment = { wrapText: true, vertical: 'top' };
    });
    if (R) {
      ws.addRow([]); ws.addRow(['', '#38', '決算與會計收支對照表推算檢查']).font = { bold: true };
      R.checks.forEach(c => { const ok = Math.abs((c[1] || 0) - (c[2] || 0)) < 0.5; const row = ws.addRow(['', '', c[0], ok ? '相符' : '不符', fmt(c[1]) + ' ／ ' + fmt(c[2])]); row.getCell(4).font = { color: { argb: ok ? 'FF1B7F3B' : 'FFC0392B' }, bold: true }; });
    }
  }

  // 欄寬單位取決於活頁簿預設字型：把範本的預設字型（如新細明體 12）寫回輸出檔
  async function fixDefaultFont(JSZip, outBuf, tplBuf) {
    const tz = await JSZip.loadAsync(tplBuf), oz = await JSZip.loadAsync(outBuf);
    const ts = await tz.file('xl/styles.xml').async('string');
    let os = await oz.file('xl/styles.xml').async('string');
    const tf = ts.match(/<fonts[^>]*>\s*(<font>[\s\S]*?<\/font>|<font\/>)/);
    if (tf) {
      const f0 = tf[1].replace(/<scheme val="[^"]*"\/>/, '');
      os = os.replace(/(<fonts[^>]*>\s*)(<font>[\s\S]*?<\/font>)/, (m, a) => a + f0);
      oz.file('xl/styles.xml', os);
    }
    return oz.generateAsync({ type: typeof Buffer !== 'undefined' && typeof window === 'undefined' ? 'nodebuffer' : 'arraybuffer', compression: 'DEFLATE' });
  }

  async function generate(XLSX, ExcelJS, tplWb, analysis, opts) {
    opts = opts || {};
    const rep = yearReplacer(analysis.tplYear, analysis.year);
    const out = new ExcelJS.Workbook();
    out.creator = '決算書表套版工具';
    const log = [];
    const R = opts.r38 || derive38(XLSX, analysis.sys, opts.unmet);
    const no12 = opts.no12;
    for (const ws of tplWb.worksheets) {
      const no = sheetNo(ws.name); if (!no) continue;
      const n = parseInt(no, 10);
      const name = ws.name;
      if (n >= 22 && n <= 36) {
        const det = (analysis.details || []).find(d => d.tplSheet === name);
        if (det) { const d = out.addWorksheet(name); const info = buildFromSys(XLSX, det.ws, ws, d, rep); log.push([name, '系統檔＋範本格式', info]); }
        else log.push([name, '略過（本年度不輸出）']);
        continue;
      }
      if (MODE[no] === 'copy') { const d = out.addWorksheet(name); copyWholeSheet(ws, d, rep); log.push([name, '照抄範本']); continue; }
      if (no === '12') { const d = out.addWorksheet(name); build12(ws, d, rep, !no12); log.push([name, no12 ? '本年度無' : '待人工編製']); continue; }
      if (no === '38') { const d = out.addWorksheet(name); build38(ws, d, rep, R); log.push([name, '自動推算']); continue; }
      const s = analysis.sys[no];
      if (!s) { const d = out.addWorksheet(name); copyWholeSheet(ws, d, rep); log.push([name, '缺系統檔，暫用範本（請注意）']); continue; }
      const d = out.addWorksheet(name);
      const info = buildFromSys(XLSX, s.ws, ws, d, rep);
      log.push([name, '系統檔＋範本格式', info]);
    }
    if (opts.checks && opts.withCheckSheet !== false) addCheckSheet(out, opts.checks, R);
    let buf = await out.xlsx.writeBuffer();
    if (opts.JSZip && opts.tplBuf) buf = await fixDefaultFont(opts.JSZip, buf, opts.tplBuf);
    return { buf, log, R };
  }

  return { TABLES, analyze, runChecks, derive38, generate, parseSysName, fmt, norm };
});
