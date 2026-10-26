/* 總說明產生工具 — 資料擷取、文字產生、Word 輸出（不依賴 DOM，可於 Node 測試） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SumEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const flat = s => (s == null ? '' : String(s)).replace(/[\s　ˉ_]/g, '');
  const num = v => {
    if (typeof v === 'number') return v;
    const t = String(v == null ? '' : v).replace(/,/g, '').trim();
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : 0;
  };
  const N = v => Math.round(v || 0).toLocaleString('en-US');
  const P = v => (Math.round(v * 100) / 100 === 100 ? '100' : (Math.round(v * 100) / 100).toFixed(2));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const parseName = v => {
    const s = String(v == null ? '' : v).replace(/ˉ/g, '');
    const m = s.match(/(\d{10})(-\d)?\*?/);
    const name = (m ? s.slice(m.index + m[0].length) : s).replace(/[\s　]/g, '');
    return { code: m ? m[1] : '', name };
  };

  /* 系統產製表號 */
  const TABLES = {
    '1': { name: '歲入來源別決算表', need: true, re: /歲入來源別決算表/ },
    '2': { name: '歲出政事別決算表', need: false, re: /歲出政事別決算表/ },
    '3': { name: '歲出機關別決算表', need: true, re: /歲出機關別決算表/ },
    '4': { name: '以前年度歲出政事別轉入數決算表', need: false, re: /以前年度歲出政事別轉入數決算表/ },
    '5': { name: '以前年度歲出機關別轉入數決算表', need: false, re: /以前年度歲出機關別轉入數決算表/ },
    '8': { name: '繳付公庫數分析表', need: true, re: /繳付公庫數分析表/ },
    '9': { name: '公庫撥入數分析表', need: true, re: /公庫撥入數分析表/ },
    '11': { name: '歲出保留分析表', need: false, re: /歲出保留分析表/ },
    '20': { name: '平衡表', need: true, re: /^平衡表$/ },
    '37': { name: '長期投資、固定資產、遞耗資產及無形資產變動表', need: false, re: /無形資產變動表/ }
  };

  /* 依檔名或表頭辨識；回傳 {no, year, stamp} */
  function classify(fileName, rows) {
    const base = fileName.replace(/\.[^.]+$/, '');
    let no = null, year = null, stamp = '';
    const m = base.match(/^(\d{2,3})_(\d{1,3})_/);
    if (m) { year = +m[1]; no = m[2]; }
    const st = base.match(/_(\d{14})_/); if (st) stamp = st[1];
    const head = (rows || []).slice(0, 8).map(r => (r || []).map(flat).join('')).join('|');
    if (!no || !TABLES[no]) {
      for (const k in TABLES) if (TABLES[k].re.test(head) || TABLES[k].re.test(flat(base))) { no = k; break; }
      if (!no && /科目名稱/.test(head) && /本年度/.test(head) && /上年度/.test(head) && /資產/.test(head)) no = '20';
    }
    if (!year) { const y = head.match(/中華民國(\d{2,3})年/); if (y) year = +y[1]; }
    return { no, year, stamp };
  }

  const A1 = (r, c) => { let s = '', n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s + (r + 1); };
  function findCol(rows, re, maxRow = 9, fallback = -1) {
    for (let r = 0; r < Math.min(maxRow, rows.length); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) if (re.test(flat(row[c]))) return c;
    }
    return fallback;
  }

  /* ===== 擷取 ===== */
  function extract(sys) {
    // sys: { no: {rows, file} }
    const V = {}, S = {}, warn = [], info = {};
    const put = (key, no, r, c, rowLabel, colLabel, val) => {
      const t = sys[no]; const v = val !== undefined ? val : num((t.rows[r] || [])[c]);
      V[key] = v;
      S[key] = { file: t.file, table: TABLES[no].name, no, cell: A1(r, c), row: rowLabel, col: colLabel, value: v };
      return v;
    };
    const has = no => !!sys[no];

    // --- 歲入 ---
    if (has('1')) {
      const g = sys['1'].rows; info.rev = { items: [] };
      g.forEach((r, i) => {
        if (!r) return;
        if (flat(r[4]) === '合計') {
          put('rev_b', '1', i, 7, '合計', '預算數合計(1)'); put('rev_a', '1', i, 8, '合計', '決算數-實現數'); put('rev_p', '1', i, 13, '合計', '決算數占預算數之比率');
        } else if (flat(r[2]) && !flat(r[3])) {
          const n = parseName(r[4]); const k = 'rev_i' + info.rev.items.length;
          put(k, '1', i, 8, (n.code ? n.code + ' ' : '') + n.name, '決算數-實現數');
          info.rev.items.push({ key: k, name: n.name });
        }
      });
      if (V.rev_b === undefined) warn.push('歲入來源別決算表找不到「合計」列。');
    } else warn.push('未載入歲入來源別決算表（1）。');

    if (has('8')) {
      const g = sys['8'].rows; const c = findCol(g, /^繳付公庫數/, 9, 9);
      const i = g.findIndex(r => r && flat(r[0]) === '合計');
      if (i >= 0) put('rev_paid', '8', i, c, '合計', '繳付公庫數');
    }

    // --- 歲出（機關別）---
    if (has('3')) {
      const g = sys['3'].rows; info.exp = { plans: [], pools: [] };
      let inUnit = false;
      const lineKeys = (k, i, label) => {
        put(k + '_ob', '3', i, 5, label, '原預算數');
        put(k + '_add', '3', i, 6, label, '預算追加(減)數');
        put(k + '_r2', '3', i, 7, label, '動支第二預備金數');
        put(k + '_r1', '3', i + 1, 6, label, '動支第一預備金數');
        put(k + '_fl', '3', i + 1, 7, label, '經費流用數');
        put(k + '_b', '3', i, 9, label, '預算數合計(1)');
        put(k + '_a', '3', i, 10, label, '決算數-實現數');
        put(k + '_res', '3', i, 11, label, '決算數-保留數');
        put(k + '_t', '3', i + 1, 11, label, '決算數合計(2)');
        put(k + '_d', '3', i, 12, label, '預決算比較增減數');
        put(k + '_p', '3', i, 13, label, '決算數占預算數之比率');
      };
      for (let i = 0; i < g.length; i++) {
        const r = g[i] || []; const n = parseName(r[4]);
        if (!n.code) continue;
        const label = n.code + ' ' + n.name;
        if (flat(r[1])) { inUnit = true; info.exp.unit = n.name; lineKeys('exp', i, label); continue; }
        if (inUnit && flat(r[2])) { const k = 'pl' + info.exp.plans.length; lineKeys(k, i, label); info.exp.plans.push({ key: k, code: n.code, name: n.name, items: [] }); continue; }
        if (inUnit && flat(r[3]) && info.exp.plans.length) {
          const p = info.exp.plans[info.exp.plans.length - 1]; const k = p.key + 'i' + p.items.length;
          lineKeys(k, i, label); p.items.push({ key: k, code: n.code, name: n.name }); continue;
        }
        if (flat(r[0]) && !/主管$/.test(n.name)) {
          inUnit = false; const k = 'po' + i;
          put(k + '_a', '3', i, 10, label, '決算數-實現數');
          let pool = info.exp.pools.find(x => x.name === n.name);
          if (!pool) { pool = { name: n.name, codes: [], keys: [] }; info.exp.pools.push(pool); }
          pool.codes.push(n.code); pool.keys.push(k);
        }
      }
      if (V.exp_b === undefined) warn.push('歲出機關別決算表找不到機關列（項級）。');
    } else warn.push('未載入歲出機關別決算表（3）。');

    // --- 公庫撥入（統籌科目庫撥數）---
    if (has('9') && info.exp) {
      const g = sys['9'].rows; const c = findCol(g, /^公庫撥入數/, 9, 9);
      info.exp.pools.forEach(pool => {
        pool.paidKeys = [];
        pool.codes.forEach(code => {
          const i = g.findIndex(r => r && /^\d{10}/.test(flat(r[0])) && flat(r[0]).startsWith(code));
          if (i >= 0) { const k = 'kb' + code; put(k, '9', i, c, code + ' ' + pool.name, '公庫撥入數'); pool.paidKeys.push(k); }
        });
      });
    }

    // --- 歲出保留分析表：原因 ---
    if (has('11')) {
      const g = sys['11'].rows; info.res = {};
      const rc = findCol(g, /保留原因說明/, 9, 9);
      let cur = null;
      for (let i = 0; i < g.length; i++) {
        const r = g[i] || []; const n = parseName(r[1]);
        if (n.code && /^\d{2,3}$/.test(flat(r[0]))) { cur = info.res[n.code] = { name: n.name, row: i, reasons: [] }; put('rs' + n.code, '11', i, 3, n.code + ' ' + n.name, '保留數'); }
        else if (/小計|合計/.test(flat(r[1]))) cur = null;
        if (cur && flat(r[rc])) cur.reasons.push({ type: flat(r[rc - 2]), amt: num(r[rc - 1]), text: String(r[rc]).trim(), cell: A1(i, rc) });
      }
    }

    // --- 以前年度（機關別優先，否則政事別）---
    const pno = has('5') ? '5' : (has('4') ? '4' : null);
    if (pno) {
      const g = sys[pno].rows; info.prev = { items: [], year: null, no: pno };
      for (let i = 0; i < g.length; i++) {
        const r = g[i] || [];
        if (!info.prev.year && /^\d{2,3}$/.test(flat(r[0]))) info.prev.year = +flat(r[0]);
        if (flat(r[5]) === '合計') {
          put('pr_in', pno, i + 1, 6, '合計', '以前年度轉入數-保留數'); put('pr_x', pno, i + 1, 7, '合計', '本年度減免(註銷)數-保留數');
          put('pr_a', pno, i + 1, 8, '合計', '本年度實現數-保留數'); put('pr_left', pno, i + 1, 10, '合計', '本年度未結清數-保留數');
          put('pr_in_pay', pno, i, 6, '合計', '以前年度轉入數-應付數');
        }
        const n = parseName(r[5]);
        if (n.code && flat(r[3])) {
          const k = 'pi' + info.prev.items.length; const lb = n.code + ' ' + n.name;
          put(k + '_in', pno, i + 1, 6, lb, '以前年度轉入數-保留數'); put(k + '_x', pno, i + 1, 7, lb, '本年度減免(註銷)數-保留數'); put(k + '_a', pno, i + 1, 8, lb, '本年度實現數-保留數');
          info.prev.items.push({ key: k, name: n.name, code: n.code });
        }
      }
    }

    // --- 平衡表 ---
    if (has('20')) {
      const g = sys['20'].rows; const list = [];
      [[0, 1, 2], [3, 4, 5]].forEach(([cn, cc, cp]) => {
        for (let i = 0; i < g.length; i++) {
          const r = g[i] || [];
          const raw = String(r[cn] == null ? '' : r[cn]); const f = flat(raw);
          if (!f || /^合計$/.test(f) || /科目名稱/.test(f)) continue;
          const contra = /^減[:：]/.test(f);
          const m = f.replace(/^減[:：]/, '').match(/^(\d+)(.+)$/); if (!m) continue;
          const code = m[1], name = m[2];
          const k = 'bs' + code;
          put(k, '20', i, cc, code + ' ' + name, '本年度'); put(k + 'P', '20', i, cp, code + ' ' + name, '上年度');
          list.push({ key: k, code, name, contra });
        }
      });
      // 組成科目群
      const groups = []; let cur = null, top = {};
      list.forEach(it => {
        if (it.code.length === 1) { top[it.code] = it; return; }
        if (it.code.length === 2) { cur = { key: it.key, code: it.code, name: it.name, accts: [] }; groups.push(cur); return; }
        if (!cur || !it.code.startsWith(cur.code)) return;
        if (it.contra && cur.accts.length) { cur.accts[cur.accts.length - 1].dep = it.key; return; }
        cur.accts.push({ key: it.key, code: it.code, name: it.name, dep: null });
      });
      info.bs = { groups, top };
      const remark = g.map(r => (r || []).map(x => String(x == null ? '' : x)).join('')).find(s => /保證品/.test(s));
      if (remark) info.bs.remark = remark.trim();
    } else warn.push('未載入平衡表（20）。');

    // --- 變動表 ---
    if (has('37')) {
      const g = sys['37'].rows; info.chg = {};
      const ci = findCol(g, /^增加數/, 9, 3), cd = findCol(g, /^減少數/, 9, 4), cp = findCol(g, /^本年度累計折舊/, 9, 5);
      g.forEach((r, i) => {
        const nm = flat((r || [])[0]); if (!nm || i < 5) return;
        const k = 'cg' + i;
        put(k + 'i', '37', i, ci, nm, '本年度成本變動-增加數'); put(k + 'd', '37', i, cd, nm, '本年度成本變動-減少數'); put(k + 'p', '37', i, cp, nm, '本年度累計折舊變動數');
        info.chg[nm] = k;
      });
    }
    return { V, S, info, warn };
  }

  /* ===== 檢核 ===== */
  function checks(X) {
    const { V, info } = X; const out = [];
    const ck = (name, a, b, note) => out.push({ name, a, b, ok: Math.abs((a || 0) - (b || 0)) < 0.5, note });
    if (info.rev && V.rev_a !== undefined) {
      ck('歲入各目實現數加總＝合計實現數', info.rev.items.reduce((s, i) => s + V[i.key], 0), V.rev_a, '歲入來源別決算表');
      if (V.rev_paid !== undefined) ck('繳付公庫數＝歲入實現數', V.rev_paid, V.rev_a, '繳付公庫數分析表 vs 歲入來源別決算表');
    }
    if (info.exp && V.exp_b !== undefined) {
      ck('機關歲出 實現＋保留＝決算合計(2)', V.exp_a + V.exp_res, V.exp_t, '歲出機關別決算表');
      ck('各工作計畫實現數加總＝機關實現數', info.exp.plans.reduce((s, p) => s + V[p.key + '_a'], 0), V.exp_a, '歲出機關別決算表');
      info.exp.pools.forEach(p => {
        if (p.paidKeys && p.paidKeys.length) ck(`${p.name} 庫撥數＝實現數`, p.paidKeys.reduce((s, k) => s + V[k], 0), p.keys.reduce((s, k) => s + V[k + '_a'], 0), '公庫撥入數分析表 vs 歲出機關別決算表');
      });
      if (info.res) {
        const all = []; info.exp.plans.forEach(p => { all.push(p); p.items.forEach(i => all.push(i)); });
        Object.keys(info.res).forEach(code => {
          const p = all.find(x => x.code === code);
          if (p) ck(`${info.res[code].name} 保留數（保留分析表＝機關別）`, V['rs' + code], V[p.key + '_res'], '歲出保留分析表 vs 歲出機關別決算表');
          const sumR = info.res[code].reasons.reduce((s, r) => s + r.amt, 0);
          if (sumR) ck(`${info.res[code].name} 保留原因金額加總＝保留數`, sumR, V['rs' + code], '歲出保留分析表');
        });
      }
    }
    if (info.prev && V.pr_in !== undefined) ck('以前年度保留 轉入－註銷－實現＝未結清', V.pr_in - V.pr_x - V.pr_a, V.pr_left || 0, '以前年度轉入數決算表');
    if (info.bs) {
      const t = info.bs.top; if (t['1'] && t['2'] && t['3']) ck('資產＝負債＋淨資產', V[t['1'].key], V[t['2'].key] + V[t['3'].key], '平衡表');
      info.bs.groups.forEach(gp => ck(`${gp.name}＝所屬科目（淨額）加總`, gp.accts.reduce((s, a) => s + V[a.key] + (a.dep ? V[a.dep] : 0), 0), V[gp.key], '平衡表'));
    }
    return out;
  }

  /* ===== 預設文字 ===== */
  const DEFAULT_DESC = {
    '專戶存款': '係各項保管款及代收款收取之數', '土地': '係本總處辦公房屋用地等', '土地改良物': '係本總處中部辦公室停車場等',
    '房屋建築及設備': '係本總處辦公房屋建築及其附屬之設備', '機械及設備': '係電腦及印表機等設備', '交通及運輸設備': '係公務車輛及傳真機等設備',
    '雜項設備': '係辦公事務設備等', '購建中固定資產': '係本總處未完工程等', '電腦軟體': '係本總處電腦軟體等',
    '存出保證金': '係租用郵局專用信箱鎖鑰押金與有線電視租用數位機上盒保證金', '應付代收款': '係員工薪資代扣勞保、健保、公保、退撫基金及勞工提存金自付額等',
    '存入保證金': '係得標廠商繳納之履約保證金、保固保證金等', '應付保管款': '係本總處聘僱人員提撥之公、自提離職儲金'
  };
  const SOLO = { '電腦軟體': true };

  function reserveSentence(res, nextYear) {
    if (!res || !res.reasons.length) return '';
    const subj = [];
    res.reasons.forEach(rr => {
      const re = /「([^」]+)」(勞務採購案|財物採購案|工程採購案|採購案|出國計畫)?/g; let m; const got = [];
      while ((m = re.exec(rr.text))) { if (m[2]) got.push('「' + m[1] + '」' + m[2]); }
      if (!got.length) { const f = rr.text.match(/「([^」]+)」/); if (f) got.push('「' + f[1] + '」'); }
      const uniq = got.filter((x, i) => got.indexOf(x) === i && !subj.includes(x));
      if (uniq.length && /契約變更/.test(rr.text)) uniq[uniq.length - 1] += '(含契約變更)';
      uniq.forEach(x => { if (!subj.some(s => s.startsWith(x.replace('(含契約變更)', '')))) subj.push(x); });
    });
    if (!subj.length) return '';
    return `上項保留數係辦理${subj.join('及')}，經以支出保留數轉入 ${nextYear} 年度繼續執行。`;
  }

  function netOf(V, a, P) { return V[a.key + (P || '')] + (a.dep ? V[a.dep + (P || '')] : 0); }
  function plainName(n) { return n.replace(/^\d+/, ''); }

  function varianceDefault(X, acct) {
    const { V, info } = X; if (!info.chg) return '';
    const k = info.chg[acct.name]; if (!k) return '';
    const inc = V[k + 'i'], dec = V[k + 'd'], dep = V[k + 'p'];
    if (/購建中/.test(acct.name)) {
      const parts = [];
      if (dec) parts.push(`上年度未完工程${N(dec)}元於本年度完工轉列固定資產`);
      if (inc) parts.push(`本年度新增未完工程${N(inc)}元`);
      return parts.length ? '主要係' + parts.join('，') : '';
    }
    const d = netOf(V, acct) - netOf(V, acct, 'P');
    const p = [`主要係本年度增加${N(inc)}元`];
    const sub = []; if (dec) sub.push(`減少${N(dec)}元`); if (dep) sub.push(`提列折舊${N(Math.abs(dep))}元`);
    return p[0] + (sub.length ? `，扣除${sub.join('及')}後` : '，') + `淨${d >= 0 ? '增加' : '減少'}所致`;
  }

  /* 可編修欄位（預設值）*/
  function defaults(X, opts) {
    const { info } = X; const ny = (opts.year || 0) + 1; const E = { reserve: {}, r1: {}, desc: {}, varWhy: {}, varLevel: {}, part3: '' };
    if (info.exp) {
      const all = []; info.exp.plans.forEach(p => { all.push(p); p.items.forEach(i => all.push(i)); });
      all.forEach(p => { if (info.res && info.res[p.code]) E.reserve[p.code] = reserveSentence(info.res[p.code], ny); E.r1[p.code] = ''; });
    }
    if (info.bs) {
      info.bs.groups.forEach(g => {
        E.varLevel[g.code] = /^16/.test(g.code) ? 'group' : 'acct';
        g.accts.forEach(a => { E.desc[a.name] = (opts.priorDesc && opts.priorDesc[a.name]) || DEFAULT_DESC[a.name] || ''; E.varWhy[a.code] = varianceDefault(X, a); });
      });
    }
    return E;
  }

  /* ===== 產生總說明 ===== */
  function generate(X, E, opts) {
    const { V, S, info } = X; const Y = opts.year, NY = Y + 1;
    const doc = [], refs = [];
    const H = t => ['h', t];
    const R = (sec, item, val, keys, how) => { refs.push({ sec, item, val, keys: keys.filter(k => S[k]), how: how || '直接取數' }); return val; };
    const T = (t, s) => doc.push({ t, s });
    const Pp = (runs, indent = 1) => doc.push({ t: 'p', runs: runs.map(r => Array.isArray(r) ? r : ['n', r]), indent });
    const todo = [];
    const mark = (s) => { todo.push(s); return H(`【${s}】`); };

    T('title', opts.agency || '機關'); T('title', '總　說　明'); T('sub', `中華民國 ${Y} 年度`);
    T('h1', '一、財務報告之簡述'); T('h2', '(一)本年度');
    // 歲入
    if (info.rev && V.rev_b !== undefined) {
      T('h2', '1. 歲入部分'); const s = '一(一)1 歲入部分';
      const items = info.rev.items.filter(i => V[i.key]);
      const lst = items.map((i, n) => `${n === items.length - 1 && n > 0 ? '及' : (n ? '、' : '')}${i.name}${R(s, i.name, N(V[i.key]), [i.key])}元`).join('');
      const paid = V.rev_paid !== undefined ? (V.rev_paid === V.rev_a ? '，均已全部解繳國庫。' : `，已解繳國庫${N(V.rev_paid)}元。`) : '。';
      if (V.rev_paid !== undefined) R(s, '繳付公庫數（解繳國庫）', N(V.rev_paid), ['rev_paid'], V.rev_paid === V.rev_a ? '繳付公庫數＝歲入實現數，故寫「均已全部解繳國庫」' : '繳付公庫數');
      Pp([`本年度歲入預算數${R(s, '歲入預算數', N(V.rev_b), ['rev_b'])}元，執行結果，決算實現數${R(s, '決算實現數', N(V.rev_a), ['rev_a'])}元，占預算數之${R(s, '占預算數比率(%)', P(V.rev_a / V.rev_b * 100), ['rev_a', 'rev_b', 'rev_p'], '實現數÷預算數×100')}%，${items.length ? '包括' + lst : ''}${paid}`]);
    }
    // 歲出
    if (info.exp && V.exp_b !== undefined) {
      T('h2', '2. 歲出部分'); let s = '一(一)2 歲出部分';
      const tot = V.exp_a + V.exp_res, left = V.exp_b - tot;
      Pp([`本年度歲出預算數${R(s, '歲出預算數(不含統籌科目)', N(V.exp_b), ['exp_b'])}元(不含統籌科目)，執行結果，決算實現數${R(s, '決算實現數', N(V.exp_a), ['exp_a'])}元，` +
        (V.exp_res ? `保留數${R(s, '保留數', N(V.exp_res), ['exp_res'])}元，合共${R(s, '合共', N(tot), ['exp_t'], '實現數＋保留數')}元，` : '') +
        `占預算數${R(s, '占預算數比率(%)', P(tot / V.exp_b * 100), ['exp_p'], '(實現＋保留)÷預算×100')}%，` +
        (Math.abs(left) < 0.5 ? '無賸餘數。' : `賸餘數${R(s, '賸餘數', N(left), ['exp_d'], '預算－實現－保留')}元。`) + '依各工作計畫分述如下：']);
      const reserveUsers = [];
      const allP = []; info.exp.plans.forEach(p => { if (p.items.length) p.items.forEach(i => allP.push(i)); else allP.push(p); });
      allP.forEach(p => { if (V[p.key + '_r1'] > 0) reserveUsers.push(p); });
      const line = (label, p, indent) => {
        const k = p.key; s = '一(一)2 ' + label; const b = V[k + '_b'], a = V[k + '_a'], res = V[k + '_res'];
        const adj = [];
        if (V[k + '_add']) adj.push(`預算追加${V[k + '_add'] < 0 ? '減' : ''}${R(s, '預算追加(減)數', N(Math.abs(V[k + '_add'])), [k + '_add'])}元`);
        if (V[k + '_r2']) adj.push(`動支第二預備金${R(s, '動支第二預備金', N(V[k + '_r2']), [k + '_r2'])}元`);
        if (V[k + '_r1'] > 0) adj.push(`動支第一預備金${R(s, '動支第一預備金', N(V[k + '_r1']), [k + '_r1'])}元`);
        if (V[k + '_fl']) adj.push(`經費流用${V[k + '_fl'] > 0 ? '增列' : '減列'}${R(s, '經費流用數', N(Math.abs(V[k + '_fl'])), [k + '_fl'])}元`);
        let t = `${label}：預算數`;
        t += adj.length ? `${R(s, '原預算數', N(V[k + '_ob']), [k + '_ob'])}元，${adj.join('、')}，合共${R(s, '預算數合計', N(b), [k + '_b'], '原預算數＋預算增減數')}元` : `${R(s, '預算數', N(b), [k + '_b'])}元`;
        t += `，執行結果，決算實現數${R(s, '決算實現數', N(a), [k + '_a'])}元`;
        if (res) t += `，保留數${R(s, '保留數', N(res), [k + '_res'], '保留原因見歲出保留分析表')}元，合共${R(s, '合共', N(a + res), [k + '_t'], '實現數＋保留數')}元`;
        const lf = b - a - res;
        t += `，占預算數${R(s, '占預算數比率(%)', P((a + res) / b * 100), [k + '_p'], '(實現＋保留)÷預算×100')}%，` + (Math.abs(lf) < 0.5 ? '無賸餘數。' : `賸餘數${R(s, '賸餘數', N(lf), [k + '_d'], '預算－實現－保留')}元。`);
        const runs = [t];
        if (res && E.reserve[p.code]) runs.push(E.reserve[p.code]);
        else if (res) runs.push(mark(`請補充${p.name}保留原因`));
        if (V[k + '_r1'] > 0) runs.push(E.r1[p.code] ? `動支第一預備金係${E.r1[p.code].replace(/^係/, '').replace(/。$/, '')}。` : mark(`請補充${p.name}動支第一預備金之用途`));
        Pp(runs, indent);
      };
      let n = 1;
      info.exp.plans.forEach(p => {
        const lab = `(${n++})${p.name}`;
        if (/第一預備金/.test(p.name)) {
          s = '一(一)2 ' + lab; const k = p.key; const used = -V[k + '_r1'];
          let t = `${lab}：原預算數${R(s, '原預算數', N(V[k + '_ob']), [k + '_ob'])}元，`;
          if (used > 0) t += `動支${R(s, '動支數', N(used), [k + '_r1'], '動支第一預備金數取絕對值')}元(${reserveUsers.map(u => `${u.name}${N(V[u.key + '_r1'])}元`).join('、')})，` + (V[k + '_b'] ? `餘${R(s, '未動支數', N(V[k + '_b']), [k + '_b'], '原預算－動支')}元未動支，悉數列為賸餘數。` : '已全數動支。');
          else t += '均未動支，悉數列為賸餘數。';
          Pp([t]); return;
        }
        if (p.items.length) { T('h2', lab); p.items.forEach((it, j) => line(`${ROMAN[j]}. ${it.name}`, it, 2)); }
        else line(lab, p, 1);
      });
      if (info.exp.pools.length) {
        T('h2', `(${n++})各統籌科目`); s = '一(一)2 各統籌科目';
        info.exp.pools.forEach((pl, j) => {
          const act = pl.keys.reduce((a, k) => a + V[k + '_a'], 0);
          const pk = pl.paidKeys || [];
          const paid = pk.length ? pk.reduce((a, k) => a + V[k], 0) : null;
          const keys = pk.concat(pl.keys.map(k => k + '_a'));
          if (paid !== null) Pp([`${ROMAN[j]}. ${pl.name}：庫撥數${R(s, pl.name + ' 庫撥數', N(paid), keys, pk.length > 1 ? '各科目公庫撥入數加總，與機關別決算表實現數核對' : '公庫撥入數，與機關別決算表實現數核對')}元` + (paid === act ? '，與決算實現數同。' : `，決算實現數${N(act)}元。`)], 2);
          else Pp([`${ROMAN[j]}. ${pl.name}：決算實現數${R(s, pl.name + ' 實現數', N(act), pl.keys.map(k => k + '_a'))}元。`], 2);
        });
      }
    }
    // 以前年度
    if (info.prev && V.pr_in) {
      T('h2', '(二)以前年度'); const s = '一(二)以前年度'; const x = V.pr_x, left = V.pr_left;
      Pp([`以前年度歲出保留${R(s, '以前年度歲出保留', N(V.pr_in), ['pr_in'])}元，執行結果，決算實現數${R(s, '決算實現數', N(V.pr_a), ['pr_a'])}元，` +
        (x ? `註銷數${R(s, '註銷數', N(x), ['pr_x'])}元，` : '無註銷數，') + (left ? `未結清數${R(s, '未結清數', N(left), ['pr_left'])}元，` : '') + '分述如下：']);
      info.prev.items.forEach((it, j) => {
        const k = it.key;
        Pp([`${j + 1}. ${it.name}：保留${R(s, it.name + ' 保留', N(V[k + '_in']), [k + '_in'])}元，執行結果，決算實現數${R(s, it.name + ' 實現數', N(V[k + '_a']), [k + '_a'])}元` + (V[k + '_x'] ? `，註銷數${R(s, it.name + ' 註銷數', N(V[k + '_x']), [k + '_x'])}元` : '') + '。']);
      });
    }
    // 平衡表
    if (info.bs) {
      T('h2', '(三)平衡表重要科目之金額及內容');
      const tops = [['1', '資產'], ['2', '負債']]; let ti = 1;
      tops.forEach(([tc, tn]) => {
        const gs = info.bs.groups.filter(g => g.code[0] === tc && V[g.key]);
        if (!gs.length) return;
        T('h2', `${ti++}. ${tn}`); const s = '一(三) ' + tn;
        gs.forEach((g, gi) => {
          const accts = g.accts.filter(a => netOf(V, a));
          let t = `(${gi + 1})${g.name}總額${R(s, g.name + '總額', N(V[g.key]), [g.key])}元`;
          const amt = a => R(s, `${a.name}${a.dep ? '(淨額)' : ''}`, N(netOf(V, a)), a.dep ? [a.key, a.dep] : [a.key], a.dep ? '原值＋累計折舊' : '直接取數');
          const desc = a => (E.desc[a.name] || '').trim();
          if (accts.length === 1) {
            const a = accts[0], d = desc(a); amt(a);
            if (SOLO[a.name] && d) t += `，${d}`;
            else t += `，係${a.name}` + (d ? `，${d.replace(/^係/, '為')}` : '');
            t += '。';
          } else if (accts.length > 1) {
            t += '，包括' + accts.map(a => { const d = desc(a); return `${a.name}${amt(a)}元` + (d ? `，${d}` : ''); }).join('；') + '。';
          } else t += '。';
          Pp([t], 2);
        });
      });
      const t3 = info.bs.top['3'];
      if (t3) Pp([`${ti}. ${t3.name.replace(/^\d+/, '')}：${t3.name.replace(/^\d+/, '')}總額${R('一(三) 淨資產', '淨資產總額', N(V[t3.key]), [t3.key, info.bs.top['1'] && info.bs.top['1'].key, info.bs.top['2'] && info.bs.top['2'].key].filter(Boolean), '＝資產－負債')}元，係資產減除負債後之餘額。`]);

      // 二、財務狀況之分析
      T('h1', '二、財務狀況之分析'); Pp(['平衡表變動情形分析：'], 0);
      const TH = (opts.threshold || 20);
      const variance = [];
      [['1', '(一)資產'], ['2', '(二)負債']].forEach(([tc, tn]) => {
        const gs = info.bs.groups.filter(g => g.code[0] === tc && (V[g.key] || V[g.key + 'P']));
        if (!gs.length) return; T('h2', tn);
        gs.forEach((g, gi) => {
          const s = '二 ' + tn + ' ' + g.name; const lv = E.varLevel[g.code] || 'acct';
          const units = lv === 'group' ? [{ name: g.name, cur: V[g.key], prev: V[g.key + 'P'], keys: [g.key, g.key + 'P'], code: g.code, acct: null }]
            : g.accts.map(a => ({ name: a.name, cur: netOf(V, a), prev: netOf(V, a, 'P'), keys: a.dep ? [a.key, a.dep, a.key + 'P', a.dep + 'P'] : [a.key, a.key + 'P'], code: a.code, acct: a, net: !!a.dep }))
              .filter(u => u.cur || u.prev);
          const runs = [`${gi + 1}. ${g.name}：`]; let flagged = 0, allZero = true;
          units.forEach(u => {
            const d = u.cur - u.prev, p = u.prev ? d / Math.abs(u.prev) * 100 : null;
            const flag = d === 0 ? '無變動' : (p === null || Math.abs(p) >= TH ? '須說明' : '未達門檻');
            variance.push({ group: g.name, name: u.name + (u.net ? '(淨額)' : ''), cur: u.cur, prev: u.prev, d, p, flag, keys: u.keys });
            if (d !== 0) allZero = false;
            if (flag === '須說明') {
              flagged++;
              runs.push(`${u.name}${R(s, u.name + ' 本年度', N(u.cur), u.keys.slice(0, u.net ? 2 : 1), u.net ? '原值＋累計折舊' : '直接取數')}元，較上年度${d > 0 ? '增加' : '減少'}${R(s, u.name + ' 增減數', N(Math.abs(d)), u.keys, '本年度－上年度')}元` + (p === null ? '' : `或${R(s, u.name + ' 增減比率(%)', Math.abs(p).toFixed(2), u.keys, '增減數÷上年度×100')}%`) + '，');
              const why = (E.varWhy[u.code] || '').trim(); const def = u.acct ? varianceDefault(X, u.acct) : '';
              if (why) { runs.push(why.replace(/[。；]$/, '')); if (why === def) runs.push(mark(`${u.name}變動原因為自動產生，請確認或補充主要項目`)); }
              else runs.push(mark(`請補充${u.name}變動原因`));
              runs.push('；');
            }
          });
          if (flagged) { const last = runs.pop(); if (last !== '；') runs.push(last); }
          const rest = units.length - flagged;
          if (!flagged) runs.push(allZero ? '本年度較上年度金額無變動。' : `本年度較上年度金額變動${units.length > 1 ? '均' : ''}未達 ${TH}%。`);
          else if (rest > 0) runs.push(`；其餘科目本年度較上年度金額變動未達 ${TH}%。`);
          else runs.push('。');
          Pp(runs, 1);
        });
      });
      X.variance = variance;
    }
    // 三
    T('h1', '三、重要施政計畫執行成果之說明');
    const p3 = (E.part3 || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (p3.length) p3.forEach(s => Pp([s], 1));
    else Pp([mark('本段為施政計畫執行成果之文字敘述，系統產製書表無相關資料，請依本年度施政計畫執行情形撰寫')], 1);

    // 合併相鄰一般文字
    doc.forEach(b => { if (b.t !== 'p') return; const o = []; b.runs.forEach(r => { if (o.length && o[o.length - 1][0] === 'n' && r[0] === 'n') o[o.length - 1][1] += r[1]; else o.push(r.slice()); }); b.runs = o; });
    refs.forEach(r => { r.src = r.keys.map(k => S[k]); });
    return { doc, refs, todo, variance: X.variance || [] };
  }

  /* ===== 上年度總說明之科目內容（自 PDF 文字）===== */
  function priorDescFromText(text) {
    const out = {}; const t = text.replace(/\s+/g, '');
    Object.keys(DEFAULT_DESC).forEach(name => {
      let m = t.match(new RegExp(name + '[\\d,]+元，(係[^；。]+)'));
      if (!m) { m = t.match(new RegExp('係' + name + '(?:[\\d,]+元)?，為([^；。]+)')); if (m) m = [0, '係' + m[1]]; }
      if (m) out[name] = m[1];
    });
    return out;
  }

  /* ===== Word（.docx）輸出：自建 OOXML ＋ 不壓縮 ZIP ===== */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function run(text, o = {}) {
    let pr = '';
    if (o.b) pr += '<w:b/><w:bCs/>';
    if (o.color) pr += `<w:color w:val="${o.color}"/>`;
    if (o.sz) pr += `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`;
    if (o.hl) pr += '<w:highlight w:val="yellow"/>';
    return `<w:r>${pr ? '<w:rPr>' + pr + '</w:rPr>' : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }
  function para(runsXml, o = {}) {
    let pr = '';
    if (o.keepNext) pr += '<w:keepNext/>';
    pr += `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}" w:line="${o.line || 400}" w:lineRule="auto"/>`;
    if (o.left || o.first) pr += `<w:ind w:left="${o.left || 0}" w:firstLine="${o.first || 0}"/>`;
    if (o.jc) pr += `<w:jc w:val="${o.jc}"/>`;
    return `<w:p><w:pPr>${pr}</w:pPr>${runsXml}</w:p>`;
  }
  function tableXml(widths, header, rows) {
    const b = '<w:top w:val="single" w:sz="4" w:color="808080"/><w:left w:val="single" w:sz="4" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:color="808080"/><w:right w:val="single" w:sz="4" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:color="808080"/>';
    const cell = (c, w, o = {}) => {
      const lines = Array.isArray(c) ? c : [c];
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}</w:tcPr>` +
        lines.map(l => para(run(l, { sz: 20, b: o.b }), { line: 280, jc: o.jc })).join('') + '</w:tc>';
    };
    const hdr = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${header.map((h, i) => cell(h, widths[i], { b: true, fill: 'DCE6F1', jc: 'center' })).join('')}</w:tr>`;
    const body = rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => c && c.v !== undefined ? cell(c.v, widths[i], c) : cell(c, widths[i])).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b2) => a + b2, 0)}" w:type="dxa"/><w:tblBorders>${b}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${hdr}${body}</w:tbl>` + para('', { line: 240 });
  }
  function docxFiles(bodyXml, landscape) {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const pg = landscape ? '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="567" w:footer="567" w:gutter="0"/>'
      : '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1247" w:bottom="1134" w:left="1247" w:header="567" w:footer="567" w:gutter="0"/>';
    return {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
      'word/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="標楷體" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="400" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
      'word/footer1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${W}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`,
      'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${bodyXml}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/>${pg}</w:sectPr></w:body></w:document>`
    };
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(); const parts = [], central = []; let off = 0;
    Object.keys(files).forEach(name => {
      const data = enc.encode(files[name]), nm = enc.encode(name), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nm, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + data.length;
    });
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
    end.setUint32(12, csize, true); end.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; all.forEach(b => { out.set(b, p); p += b.length; });
    return out;
  }

  function summaryDocx(G) {
    let x = '';
    G.doc.forEach(b => {
      if (b.t === 'title') x += para(run(b.s, { b: true, sz: 32 }), { jc: 'center', after: 60 });
      else if (b.t === 'sub') x += para(run(b.s, { sz: 26 }), { jc: 'center', after: 240 });
      else if (b.t === 'h1') x += para(run(b.s, { b: true, sz: 26 }), { before: 200, keepNext: true });
      else if (b.t === 'h2') x += para(run(b.s), { left: 240, keepNext: true });
      else x += para(b.runs.map(([k, t]) => k === 'h' ? run(t, { hl: true, color: 'C00000' }) : run(t)).join(''), { jc: 'both', left: 240 + b.indent * 360, first: b.indent ? 480 : 0 });
    });
    if (G.todo.length) x += para(run('註：黃底紅字為系統產製書表無法提供、需人工補充或確認之文字，定稿前請刪除。', { sz: 20, color: '595959' }), { before: 360 });
    return zip(docxFiles(x, false));
  }
  function sourceDocx(G, X, opts) {
    let x = para(run(`${opts.agency || ''} ${opts.year} 年度總說明　數字來源說明`, { b: true, sz: 32 }), { jc: 'center', after: 120 });
    const h = s => para(run(s, { b: true, sz: 26 }), { before: 240, after: 120, keepNext: true });
    const p = (s, o = {}) => para(run(s, { sz: o.sz || 22, color: o.color }), { after: 60, left: o.left || 0 });
    x += h('一、資料來源及判讀方式');
    x += p('1. 數字一律取自系統產製書表，以「儲存格位址：列 × 欄」標示來源，可直接開啟原檔核對。');
    x += p('2. 本年度與上年度比較取平衡表「本年度」「上年度」欄；固定資產以「原值＋累計折舊」之淨額計算。');
    x += p('3. 比率以(實現數＋保留數)÷預算數×100 計算，四捨五入至小數第 2 位。');
    x += p('4. 引用之系統產製檔案：');
    const files = []; Object.values(X.S).forEach(s => { if (!files.includes(s.file)) files.push(s.file); });
    files.sort().forEach(f => { x += p('・' + f, { sz: 18, color: '404040', left: 480 }); });
    x += h('二、總說明數字對照表');
    x += tableXml([600, 3000, 1800, 3400, 3000, 2600], ['序', '段落／項目', '總說明數值', '來源書表', '儲存格：列 × 欄（書表值）', '計算方式'],
      G.refs.map((r, i) => [{ v: String(i + 1), jc: 'center' }, [r.sec, r.item], { v: r.val, jc: 'right' }, r.src.map(s => s.table), r.src.map(s => `${s.cell}：${s.row} × ${s.col}（${N(s.value)}）`), r.how]));
    if (G.variance.length) {
      x += h(`三、平衡表變動分析（門檻 ${opts.threshold || 20}%）`);
      x += tableXml([2000, 3400, 2300, 2300, 2000, 1400, 1000], ['科目群', '科目', '本年度', '上年度', '增減數', '增減比率', '判定'],
        G.variance.map(v => [v.group, v.name, { v: N(v.cur), jc: 'right' }, { v: N(v.prev), jc: 'right' }, { v: N(v.d), jc: 'right' }, { v: v.p === null ? '—' : v.p.toFixed(2) + '%', jc: 'right' }, { v: v.flag, jc: 'center', b: v.flag === '須說明', fill: v.flag === '須說明' ? 'FFF2CC' : '' }]));
    }
    const ck = checks(X);
    x += h('四、表間檢核');
    x += tableXml([5200, 2600, 2600, 1200, 2800], ['檢核項目', '左式', '右式', '結果', '資料來源'], ck.map(c => [c.name, { v: N(c.a), jc: 'right' }, { v: N(c.b), jc: 'right' }, { v: c.ok ? '相符' : '不符', jc: 'center', b: !c.ok }, c.note]));
    x += h('五、須人工補充或確認事項');
    if (G.todo.length) G.todo.forEach((t, i) => { x += p(`${i + 1}. ${t}`); }); else x += p('無。');
    return zip(docxFiles(x, true));
  }

  return { flat, num, N, P, TABLES, classify, extract, checks, defaults, generate, priorDescFromText, reserveSentence, summaryDocx, sourceDocx, varianceDefault, DEFAULT_DESC };
});
