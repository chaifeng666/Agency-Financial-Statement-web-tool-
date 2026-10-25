/* 決算書表格式 1～5（封面、封底、目次、總說明、歲入來源別決算表）MD 產製 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalFmt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const flat = s => (s == null ? '' : String(s)).replace(/[\s　ˉ]/g, '');
  const num = v => { if (typeof v === 'number') return v; const t = String(v == null ? '' : v).replace(/,/g, '').trim(); if (t === '') return null; const n = Number(t); return isFinite(n) ? n : null; };
  const f0 = v => (v == null || v === '' ? '' : Math.round(v).toLocaleString('en-US'));
  const f2 = v => (v == null || v === '' ? '' : Number(v).toFixed(2));
  const mesc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const pct = (a, b) => (b ? (a / b) * 100 : null);
  const splitName = v => {
    const s = String(v || '');
    const ind = (s.match(/^ˉ+/) || [''])[0].length;
    const t = s.replace(/ˉ/g, '').trim();
    const m = t.match(/^(\d{4,10}(?:-\d)?\*?)\s*\n?\s*([\s\S]+)$/);
    return m ? { code: m[1], name: m[2].replace(/\s*\n\s*/g, ''), ind } : { code: '', name: t.replace(/\s*\n\s*/g, ''), ind };
  };

  // 目次預設分類
  const GROUPS = ['決算報表／主要表', '決算報表／附屬表', '會計報表／主要表', '會計報表／附屬表', '參考表', '不列入'];
  function defaultGroup(no) {
    const n = parseFloat(no);
    if (n >= 1 && n <= 5) return GROUPS[0];
    if (n >= 6 && n <= 18) return GROUPS[1];
    if (n === 19) return GROUPS[5];
    if (n === 20 || n === 21) return GROUPS[2];
    if ((n >= 22 && n <= 36) || n === 37 || n === 39) return GROUPS[3];
    if (n === 38 || n === 40) return GROUPS[4];
    return GROUPS[1];
  }

  // ---------- 自動資料 ----------
  function gather(XLSX, an, R, TABLES) {
    const G = {}; Object.keys(an.sys).forEach(k => { G[k] = XLSX.utils.sheet_to_json(an.sys[k].ws, { header: 1, raw: true, defval: null, blankrows: true }); });
    const y = an.year;
    const D = { year: y, agency: '', ministry: '', unit: '', kuan: '', xiang: '' };
    // 主管、機關、款項號（#3）
    const g3 = G['3'];
    if (g3) for (let r = 0; r < g3.length; r++) {
      const row = g3[r] || [];
      if (!D.ministry && flat(row[0]) && /主管$/.test(flat(row[4]))) { D.kuan = flat(row[0]); D.ministry = splitName(row[4]).name; continue; }
      if (D.ministry && !D.unit && flat(row[1]) && flat(row[4])) { D.xiang = flat(row[1]); D.unit = splitName(row[4]).name; break; }
    }
    // 機關全名：#1 表頭
    const g1 = G['1'];
    if (g1) for (let r = 0; r < 4; r++) { const j = (g1[r] || []).filter(v => typeof v === 'string').map(flat).join(''); if (/院|部|會|處|署|局/.test(j) && !/表$/.test(j) && !/年度|單位/.test(j)) { D.agency = j; break; } }
    D.agency = D.agency || ((D.ministry || '').replace(/主管$/, '') + (D.unit || ''));
    // 歲入（#1）
    D.rev = { rows: [], total: null };
    if (g1) for (const row of g1) {
      if (!row) continue;
      const nm = splitName(row[4]);
      if (/^合計$/.test(flat(row[4]))) D.rev.total = { budget: num(row[7]), final: num(row[11]), diff: num(row[12]), rate: num(row[13]) };
      if (flat(row[2]) && nm.code) D.rev.rows.push({ code: nm.code, name: nm.name, budget: num(row[7]), final: num(row[11]), diff: num(row[12]), rate: num(row[13]) });
    }
    // 歲出（#3）：工作計畫（目）＋統籌科目（款）
    D.exp = { rows: [], total: null };
    if (g3) {
      let inUnit = false;
      for (let r = 0; r < g3.length; r++) {
        const row = g3[r] || []; const nx = g3[r + 1] || [];
        const nm = splitName(row[4]);
        if (/^合計$/.test(flat(row[4]))) { D.exp.total = { budget: num(row[9]), real: num(row[10]), keep: num(row[11]), final: num(nx[11]), diff: num(row[12]), rate: num(row[13]) }; continue; }
        if (flat(row[1]) && nm.code) { inUnit = true; continue; }
        const isPlan = (inUnit && flat(row[2]) && nm.code) || (flat(row[0]) && nm.code && !/主管$/.test(nm.name));
        if (isPlan) D.exp.rows.push({ code: nm.code, name: nm.name, pool: !!flat(row[0]), budget: num(row[9]), real: num(row[10]), keep: num(row[11]), final: num(nx[11]), diff: num(row[12]), rate: num(row[13]) });
      }
    }
    // 以前年度（#5）
    D.prev = { rows: [], total: null };
    const g5 = G['5'];
    if (g5) for (let r = 0; r < g5.length; r++) {
      const row = g5[r] || []; const nx = g5[r + 1] || [];
      const nm = splitName(row[5]);
      const sum = c => (num(row[c]) || 0) + (num(nx[c]) || 0);
      if (/^合計$/.test(flat(row[5]))) { D.prev.total = { inn: sum(6), cancel: sum(7), real: sum(8), adj: sum(9), open: sum(10) }; continue; }
      if (flat(row[3]) && nm.code) D.prev.rows.push({ code: nm.code, name: nm.name, inn: sum(6), cancel: sum(7), real: sum(8), adj: sum(9), open: sum(10) });
    }
    // 平衡表（#20）
    D.bs = { items: [], flagged: [], totals: {} };
    const g20 = G['20'];
    if (g20) for (const row of g20) {
      if (!row) continue;
      [[0, 1, 2], [3, 4, 5]].forEach(([lc, a, b]) => {
        const lab = String(row[lc] || '').replace(/\s*\n\s*/g, '').trim(); const cur = num(row[a]), pri = num(row[b]);
        if (!lab || cur == null || pri == null) return;
        const lf = flat(lab);
        if (/^1資產$/.test(lf)) D.bs.totals.asset = [cur, pri];
        if (/^2負債$/.test(lf)) D.bs.totals.liab = [cur, pri];
        if (/^3淨資產$/.test(lf)) D.bs.totals.net = [cur, pri];
        const m = lf.match(/(\d{6})(.+)$/); if (!m) return;
        const name = lf.replace(/^減：/, '減：').replace(/\d{6}/, '');
        const it = { code: m[1], name, cur, pri, diff: cur - pri, pct: pri ? (cur - pri) / Math.abs(pri) * 100 : null };
        D.bs.items.push(it);
        if (Math.abs(it.diff) >= 5e8 || (it.pct != null && Math.abs(it.pct) >= 20) || (!pri && cur)) D.bs.flagged.push(it);
      });
    }
    // 表件清單（目次用）
    const titles = {}; (TABLES || []).forEach(([n, t]) => { titles[n] = t; });
    D.tables = [];
    (TABLES || []).forEach(([n, t]) => {
      if (n === '22-36') { (an.details || []).filter(d => d.tplSheet).forEach(d => D.tables.push({ no: d.tplSheet.split('.')[0], title: d.subject + '明細表' })); return; }
      if (n === '10-1') return;
      if (an.sys[n] || n === '12' || n === '38' || n === '19') D.tables.push({ no: n, title: t });
    });
    D.R = R;
    return D;
  }

  // ---------- 預設輸入值 ----------
  function defaults(D) {
    const y = D.year;
    const t = D.rev.total || {}, e = D.exp.total || {}, p = D.prev.total || {};
    const plans = D.exp.rows.filter(r => !r.pool);
    const revText = `本年度歲入預算數${f0(t.budget)}元，決算數${f0(t.final)}元，${(t.diff || 0) >= 0 ? '超收' : '短收'}${f0(Math.abs(t.diff || 0))}元，達成率${f2(t.rate)}%。` +
      D.rev.rows.filter(r => r.diff).map(r => `「${r.name}」決算數${f0(r.final)}元，較預算數${r.diff >= 0 ? '增加' : '減少'}${f0(Math.abs(r.diff))}元，主要係（請填原因）。`).join('');
    const expText = `本年度歲出預算數${f0(e.budget)}元，決算數${f0(e.final)}元（實現數${f0(e.real)}元、保留數${f0(e.keep)}元），賸餘${f0(Math.abs(e.diff || 0))}元，執行率${f2(e.rate)}%。` +
      `以前年度保留轉入數${f0(p.inn)}元，本年度實現數${f0(p.real)}元，減免（註銷）數${f0(p.cancel)}元，未結清數${f0(p.open)}元。`;
    const bt = D.bs.totals;
    const big = D.bs.items.filter(i => !/^減：|資產負債淨額/.test(i.name)).sort((a, b) => Math.abs(b.cur) - Math.abs(a.cur)).slice(0, 5);
    const bsText = bt.asset ? `本年度資產總額${f0(bt.asset[0])}元，負債總額${f0(bt.liab ? bt.liab[0] : 0)}元，淨資產${f0(bt.net ? bt.net[0] : 0)}元。重要科目如下：` + big.map(i => `${i.name}${f0(i.cur)}元`).join('、') + '。' : '';
    return {
      v: 1,
      f1: { kx: (D.kuan && D.xiang) ? `${D.kuan}－${D.xiang}` : '', title: '中央政府總決算', unitTitle: `${D.unit || D.agency}單位決算`, from: `${y}年1月1日`, to: `${y}年12月31日`, editor: `${D.unit || D.agency}　編` },
      f2: { acct: '', head: '' },
      f3: { title: `${D.agency}${y}年度單位決算`, start: 1, summaryPages: 1, items: D.tables.map(x => ({ no: x.no, title: x.title, group: defaultGroup(x.no), pages: 1 })) },
      f4: {
        revText, expText, bsText,
        flagged: D.bs.flagged.map(i => ({ name: i.name, cur: i.cur, pri: i.pri, reason: '' })),
        contingentNone: false,
        contingent: [{ item: '', c1: '', c2: '', c3: '', p1: '', p2: '', p3: '', reason: '' }],
        achievements: '',
        plans: plans.map(x => ({ plan: x.name, item: '', content: '', status: '', remedy: '' })),
        rounding: false
      }
    };
  }

  // ---------- MD ----------
  function md1(D, S) {
    const s = S.f1;
    return [
      `<!-- 格式1　決算書封面 -->`,
      `# ${s.title}`,
      `## ${s.unitTitle}`,
      ``,
      `**（${s.kx}）**`,
      ``,
      `**中華民國${D.year}年度**`,
      ``,
      `（${s.from}至${s.to}）`,
      ``,
      `**${s.editor}**`,
      ``,
      `---`,
      ``,
      `**書背**：（${s.kx}）中華民國${D.year}年度　${s.unitTitle}`,
      ``,
      `> 封面用 120～150 磅淺綠色布紋銅版紙（機密件用紅色系），加蓋機關印信；「${s.kx}」為中央政府總預算歲出機關別預算表之款號及項號。`,
      ``
    ].join('\n');
  }
  function md2(D, S) {
    const s = S.f2;
    return [
      `<!-- 格式2　決算書封底 -->`,
      ``, `**主辦會計人員：**${s.acct ? '　' + s.acct : ''}`, ``, ``,
      `**機　關　長　官：**${s.head ? '　' + s.head : ''}`, ``,
      `> 封底應加蓋機關長官及主辦會計人員職名章（得以套印方式處理）；紙質與顏色與封面一致。`, ``
    ].join('\n');
  }
  function tocPages(S) {
    const s = S.f3; let p = +s.start || 1;
    const out = { summary: p }; p += +s.summaryPages || 0;
    const order = it => GROUPS.indexOf(it.group);
    const sorted = s.items.map((it, i) => ({ it, i })).sort((a, b) => order(a.it) - order(b.it) || a.i - b.i);
    out.items = [];
    sorted.forEach(({ it }) => { if (it.group === '不列入') { out.items.push(Object.assign({}, it, { page: null })); return; } out.items.push(Object.assign({}, it, { page: p })); p += +it.pages || 0; });
    return out;
  }
  function md3(D, S) {
    const s = S.f3, tp = tocPages(S);
    const L = [`<!-- 格式3　目次 -->`, `# ${s.title}`, ``, `## 目　　次`, ``, `| 項目 | 頁數 |`, `|---|--:|`, `| 一、總說明 | ${tp.summary} |`];
    const sec = (head, subs) => {
      const any = subs.some(g => tp.items.some(i => i.group === g));
      if (!any) return;
      L.push(`| ${head} | |`);
      subs.forEach(g => {
        const its = tp.items.filter(i => i.group === g); if (!its.length) return;
        const sub = g.split('／')[1];
        if (sub) L.push(`| 　（${sub === '主要表' ? '一' : '二'}）${sub} | |`);
        its.forEach((i, k) => L.push(`| 　　${k + 1}.${mesc(i.title)} | ${i.page} |`));
      });
    };
    sec('二、決算報表', ['決算報表／主要表', '決算報表／附屬表']);
    sec('三、會計報表', ['會計報表／主要表', '會計報表／附屬表']);
    sec('四、參考表', ['參考表']);
    L.push('');
    return L.join('\n');
  }
  function md4(D, S) {
    const s = S.f4, y = D.year;
    const L = [`<!-- 格式4　總說明 -->`, `# ${D.agency}`, `## 總　　說　　明`, `中華民國${y}年度`, ``];
    L.push('### 一、財務報告之簡述', '', '（一）預算執行結果', '', s.revText, '', s.expText, '');
    L.push('**歲入（依來源別子目）**', '', '| 科目 | 預算數 | 決算數 | 比較增減數 | 達成率% |', '|---|--:|--:|--:|--:|');
    D.rev.rows.forEach(r => L.push(`| ${r.code} ${mesc(r.name)} | ${f0(r.budget)} | ${f0(r.final)} | ${f0(r.diff)} | ${f2(r.rate)} |`));
    if (D.rev.total) L.push(`| **合計** | **${f0(D.rev.total.budget)}** | **${f0(D.rev.total.final)}** | **${f0(D.rev.total.diff)}** | **${f2(D.rev.total.rate)}** |`);
    L.push('', '**歲出（依機關別工作計畫）**', '', '| 工作計畫 | 預算數 | 實現數 | 保留數 | 決算數 | 比較增減數 | 執行率% |', '|---|--:|--:|--:|--:|--:|--:|');
    D.exp.rows.forEach(r => L.push(`| ${r.code} ${mesc(r.name)}${r.pool ? '（統籌科目）' : ''} | ${f0(r.budget)} | ${f0(r.real)} | ${f0(r.keep)} | ${f0(r.final)} | ${f0(r.diff)} | ${f2(r.rate)} |`));
    if (D.exp.total) { const e = D.exp.total; L.push(`| **合計** | **${f0(e.budget)}** | **${f0(e.real)}** | **${f0(e.keep)}** | **${f0(e.final)}** | **${f0(e.diff)}** | **${f2(e.rate)}** |`); }
    if (D.prev.rows.length) {
      L.push('', '**以前年度（保留繼續執行部分）**', '', '| 工作計畫 | 轉入數 | 本年度實現數 | 減免（註銷）數 | 未結清數 |', '|---|--:|--:|--:|--:|');
      D.prev.rows.forEach(r => L.push(`| ${r.code} ${mesc(r.name)} | ${f0(r.inn)} | ${f0(r.real)} | ${f0(r.cancel)} | ${f0(r.open)} |`));
      if (D.prev.total) { const p = D.prev.total; L.push(`| **合計** | **${f0(p.inn)}** | **${f0(p.real)}** | **${f0(p.cancel)}** | **${f0(p.open)}** |`); }
    }
    L.push('', '（二）平衡表重要科目之金額及內容', '', s.bsText, '');
    L.push('### 二、財務狀況之分析', '', '（一）平衡表本年度較上年度金額變動達 5 億元或差異達 20％以上之科目', '');
    if (s.flagged.length) {
      L.push('| 科目 | 本年度 | 上年度 | 增減金額 | 增減% | 原因說明 |', '|---|--:|--:|--:|--:|---|');
      s.flagged.forEach(i => { const d = i.cur - i.pri; L.push(`| ${mesc(i.name)} | ${f0(i.cur)} | ${f0(i.pri)} | ${f0(d)} | ${i.pri ? f2(d / Math.abs(i.pri) * 100) : '—'} | ${mesc(i.reason || '（請填原因）')} |`); });
    } else L.push('本年度無變動達 5 億元或差異達 20％以上之科目。');
    L.push('', '（二）未來或有給付責任之揭露說明', '');
    if (s.contingentNone) L.push('本機關無未來或有給付責任。');
    else {
      L.push('單位：新臺幣元', '', '| 項目 | 本年度決算／小計 | 本年度決算／中央政府 | 本年度決算／地方政府 | 上年度決算／小計 | 上年度決算／中央政府 | 上年度決算／地方政府 | 本年度與上年度比較 | 主要增減原因 |', '|---|--:|--:|--:|--:|--:|--:|--:|---|');
      s.contingent.filter(r => r.item).forEach(r => { const c = num(r.c1), p = num(r.p1); L.push(`| ${mesc(r.item)} | ${f0(num(r.c1))} | ${f0(num(r.c2))} | ${f0(num(r.c3))} | ${f0(num(r.p1))} | ${f0(num(r.p2))} | ${f0(num(r.p3))} | ${c != null && p != null ? f0(c - p) : ''} | ${mesc(r.reason)} |`); });
    }
    L.push('', '### 三、重要施政計畫執行成果之說明', '', '（一）已完成施政計畫重點概述', '', s.achievements || '（請填寫，單位決算以一頁為限）', '');
    L.push('（二）施政計畫分項說明', '', '| 工作計畫名稱 | 重要計畫項目 | 實施內容 | 辦理情形／已完成或未完成之說明 | 辦理情形／因應改善措施 |', '|---|---|---|---|---|');
    s.plans.filter(r => r.plan || r.item).forEach(r => L.push(`| ${mesc(r.plan)} | ${mesc(r.item)} | ${mesc(r.content)} | ${mesc(r.status)} | ${mesc(r.remedy)} |`));
    L.push('', '### 四、其他重要說明', '');
    L.push(s.rounding ? '各科（項）目合計數係加總各細目之原值後，再四捨五入至元；至各欄位金額細數之和與總數或略有出入，係四捨五入關係。' : '無。');
    L.push('');
    return L.join('\n');
  }
  function md5(XLSX, an, D) {
    const g = an.sys['1'] ? XLSX.utils.sheet_to_json(an.sys['1'].ws, { header: 1, raw: true, defval: null, blankrows: true }) : [];
    const L = [`<!-- 格式5　歲入來源別決算表 -->`, `# ${D.agency}`, `## 歲入來源別決算表`, '', `經資門分列｜中華民國${D.year}年度｜單位：新臺幣元；％`, '',
      '| 款 | 項 | 目 | 節 | 名稱及編號 | 預算數／原預算數 | 預算數／預算增減數 | 預算數／合計(1) | 決算數／實現數 | 決算數／應收數 | 決算數／保留數 | 決算數／合計(2) | 預決算比較增減數(2)-(1) | 決算數占預算數之比率(2)/(1)% |',
      '|---|---|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|'];
    let started = false;
    for (const row of g) {
      if (!row) continue;
      const nm = splitName(row[4]);
      const hasVal = [5, 6, 7, 8, 9, 10, 11].some(c => typeof row[c] === 'number');
      if (!hasVal) continue;
      started = true;
      const sub = /小計$|^合計$/.test(flat(row[4]));
      const name = nm.code ? `${'　'.repeat(nm.ind)}${nm.code} ${nm.name}` : flat(row[4]);
      const cells = [flat(row[0]), flat(row[1]), flat(row[2]), flat(row[3]), name].concat([5, 6, 7, 8, 9, 10, 11, 12].map(c => f0(num(row[c])))).concat([row[13] == null || row[13] === '' ? '' : f2(num(row[13]))]);
      L.push('| ' + cells.map(c => sub && c ? `**${mesc(c)}**` : mesc(c)).join(' | ') + ' |');
    }
    if (!started) L.push('| | | | | （無資料） | | | | | | | | | |');
    L.push('', '說明：1.表列「預算增減數」如有預算減少數，應於減少數字前註明「－」號。2.屬於資本門性質，應於科目代號標示「*」。3.本表金額表達至元，角位四捨五入。', '');
    return L.join('\n');
  }

  function renderAll(XLSX, an, D, S) {
    return [
      { no: 1, name: '格式1_封面', md: md1(D, S) },
      { no: 2, name: '格式2_封底', md: md2(D, S) },
      { no: 3, name: '格式3_目次', md: md3(D, S) },
      { no: 4, name: '格式4_總說明', md: md4(D, S) },
      { no: 5, name: '格式5_歲入來源別決算表', md: md5(XLSX, an, D) }
    ];
  }
  return { gather, defaults, renderAll, tocPages, GROUPS, f0, f2 };
});
