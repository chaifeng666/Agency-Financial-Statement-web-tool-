/* 第 2 版：可編修資料模型（系統值 → 編修 → 重算 → 回寫） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const flat = s => (s == null ? '' : String(s)).replace(/[\s　ˉ]/g, '');
  const isNum = v => typeof v === 'number' && isFinite(v);
  const numOf = v => { if (isNum(v)) return v; if (v == null) return null; const t = String(v).replace(/,/g, '').trim(); if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null; return Number(t); };
  const blank = v => v == null || flat(v) === '';
  const TGT = /合計|小計|比較增減|預決算比較|比率|%|％|=|總計|總值/;
  const clone = a => a.map(r => (r ? r.slice() : []));
  const key = (r, c) => r + ',' + c;

  // ---------- 由系統檔建立模型 ----------
  function fromSys(XLSX, Pub, ws, spec) {
    const t = Pub.extract(XLSX, ws, { no: spec.no });
    const g = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const ncol = Math.max(0, ...g.map(r => (r ? r.length : 0)));
    g.forEach(r => { while (r.length < ncol) r.push(null); });
    const L = t.layout;
    const cols = [...new Set(t.fields.map(f => f.c))].sort((a, b) => a - b);
    const labelOf = {}; t.fields.forEach(f => { labelOf[(f.which === 2 ? 'b' : 'a') + f.c] = f.label; });
    // 資料列
    const rows = [];
    t.recRows.forEach((rr, i) => {
      rows.push({ r: rr.r, line: 1, rec: i });
      if (rr.r2 != null) rows.push({ r: rr.r2, line: 2, rec: i });
    });
    const notesStart = (() => { let m = -1; t.recRows.forEach(rr => { m = Math.max(m, rr.r2 != null ? rr.r2 : rr.r); }); return m + 1; })();
    const m = {
      no: spec.no, name: spec.name, kind: 'sys', spec, ws, sys: clone(g), grid: clone(g), ncol, cols, labelOf,
      merges: (ws['!merges'] || []).map(x => ({ s: { r: x.s.r, c: x.s.c }, e: { r: x.e.r, c: x.e.c } })),
      wsCols: ws['!cols'], wsRows: ws['!rows'], layout: L, meta: t.meta, twoLine: t.twoLine, rows, recs: t.recRows, notesStart,
      accountCol: (t.fields.find(f => f.isAccount) || t.fields.find(f => f.kind === 'text') || {}).c,
      numCols: [...new Set(t.fields.filter(f => f.kind === 'number').map(f => f.c))].sort((a, b) => a - b),
      edits: {}, computed: {}, info: {}
    };
    analyze(m);
    return m;
  }

  // ---------- 結構分析：層級、合計、欄位公式（以系統值驗證） ----------
  function analyze(m) {
    const g = m.sys, rows = m.rows;
    const recs = m.recs.map((rr, i) => ({ i, r: rr.r, r2: rr.r2 }));
    // 層級
    recs.forEach(rc => {
      const v = String(g[rc.r][m.accountCol] == null ? '' : g[rc.r][m.accountCol]);
      const ind = (v.match(/^ˉ+/) || v.match(/^　+/) || [''])[0].length;
      const lab = recs.length ? flat(g[rc.r].filter(x => typeof x === 'string').join('|')) : '';
      rc.indent = ind; rc.total = /合計|總計|總值/.test(lab) ? 'total' : (/小計/.test(lab) ? 'subtotal' : null);
      rc.label = lab; rc.cap = /\*/.test(v) || /資本門/.test(flat(g[rc.r].map(x => (typeof x === 'string' ? x : '')).join('')));
      rc.hasNum = m.numCols.some(c => isNum(g[rc.r][c]) || (rc.r2 != null && isNum(g[rc.r2][c])));
    });
    const hier = recs.some(rc => rc.indent > 0);
    // 父子
    recs.forEach((rc, k) => {
      rc.parent = null; rc.children = [];
      if (!hier || rc.total) return;
      for (let j = k - 1; j >= 0; j--) { const p = recs[j]; if (p.total) continue; if (p.indent < rc.indent) { rc.parent = j; break; } }
    });
    recs.forEach((rc, k) => { if (rc.parent != null) recs[rc.parent].children.push(k); });
    recs.forEach(rc => { let a = rc, guard = 0; while (a.parent != null && guard++ < 20) { if (recs[a.parent].cap) rc.cap = true; a = recs[a.parent]; } });
    m.recInfo = recs; m.hier = hier;
    const val = (r, c) => numOf(g[r][c]);
    const lines = m.twoLine ? [1, 2] : [1];
    const rowOf = (rc, line) => (line === 1 ? rc.r : rc.r2);
    // 1) 欄位公式（只學習標題含 合計／增減／比率／% 的欄）
    const terms = []; lines.forEach(l => m.numCols.forEach(c => terms.push({ l, c })));
    const usable = recs.filter(rc => rc.hasNum);
    const tv = (rc, t) => { const r = rowOf(rc, t.l); return r == null ? null : val(r, t.c); };
    const formulas = [];
    // 欄名中的 (n) 標記，例：合計(1)、歲入實現數(1)、材料(4)
    const markers = {};
    lines.forEach(l => m.numCols.forEach(c => {
      const lab = flat(m.labelOf[(l === 2 ? 'b' : 'a') + c] || '').replace(/（/g, '(').replace(/）/g, ')');
      const mm = lab.match(/\((\d)\)(?:=|$)/) || lab.match(/\((\d)\)(?!.*\(\d\))/);
      if (mm && !/\(\d\)[-－+＋/／]\(\d\)/.test(lab.replace(/^.*?=/, 'X='))) (markers[mm[1]] = markers[mm[1]] || []).push({ l, c });
      else if (mm) { const own = lab.match(/\((\d)\)=/); if (own) (markers[own[1]] = markers[own[1]] || []).push({ l, c }); }
    }));
    const parseExpr = lab => {
      const L2 = flat(lab).replace(/（/g, '(').replace(/）/g, ')').replace(/－/g, '-').replace(/＋/g, '+').replace(/／/g, '/');
      const expr = L2.includes('=') ? L2.split('=').pop() : (L2.match(/(\(\d\)([+\-/]\(\d\))+)/) || [])[1];
      if (!expr || !/^(\(\d\)[+\-/]?)+(%)?$/.test(expr.replace(/%$/, '') + (expr.endsWith('%') ? '%' : ''))) return null;
      const parts = expr.replace(/%$/, '').match(/[+\-/]?\(\d\)/g); if (!parts) return null;
      if (parts.length === 2 && parts[1][0] === '/') return { ratio: [parts[0].replace(/\D/g, ''), parts[1].replace(/\D/g, '')] };
      return { terms: parts.map(p => [p[0] === '-' ? -1 : 1, p.replace(/\D/g, '')]) };
    };
    lines.forEach(l => m.numCols.forEach(c => {
      const lab = m.labelOf[(l === 2 ? 'b' : 'a') + c] || '';
      if (!TGT.test(lab)) return;
      const target = { l, c };
      const rs = usable.filter(rc => rowOf(rc, l) != null && tv(rc, target) != null);
      if (rs.length < 2) return;
      const others = terms.filter(t => !(t.l === l && t.c === c) && (t.c < c || (t.l !== l && t.c <= c)));
      const ok = (fn) => rs.every(rc => { const v = fn(rc); return v != null && Math.abs(v - tv(rc, target)) <= 0.5; });
      // 先用欄名上的算式
      const px = parseExpr(lab);
      if (px) {
        const pick = n => (markers[n] || []).filter(t => !(t.l === l && t.c === c));
        if (px.ratio) { const A = pick(px.ratio[0])[0], B = pick(px.ratio[1])[0]; if (A && B) { formulas.push({ target, type: 'ratio', a: A, b: B, from: 'label' }); return; } }
        if (px.terms) {
          const ts = []; let okm = true; px.terms.forEach(([sg, n]) => { const cs = pick(n); if (!cs.length) okm = false; cs.forEach(t => ts.push([sg, t])); });
          if (okm && ok(rc => ts.reduce((s, [sg, t]) => { const v = tv(rc, t); return s == null || v == null ? (v == null ? s : s) : s + sg * v; }, 0))) { formulas.push({ target, type: 'sum', terms: ts, from: 'label' }); return; }
        }
      }
      // 同一上層欄名下的「合計／小計」＝其兄弟欄加總（如 決算數／合計(2) ＝ 實現數＋應收數＋保留數）
      const segs = flat(lab).split('／');
      if (segs.length > 1 && /合計|小計/.test(segs[segs.length - 1])) {
        const P0 = segs.slice(0, -1).join('／') + '／';
        const sib = others.filter(t => { const tl = flat(m.labelOf[(t.l === 2 ? 'b' : 'a') + t.c] || ''); return tl.indexOf(P0) === 0 && !/合計|小計/.test(tl.slice(P0.length)) && tl.split('／').length === segs.length; });
        if (sib.length >= 2 && ok(rc => sib.reduce((s2, t) => { const v = tv(rc, t); return s2 + (v || 0); }, 0))) { formulas.push({ target, type: 'sum', terms: sib.map(t => [1, t]), from: 'group' }); return; }
      }
      // 比率
      if (/比率|%|％/.test(lab)) {
        const pref = t => (/合計\s*\(1\)|合計\(1\)/.test(m.labelOf[(t.l === 2 ? 'b' : 'a') + t.c] || '') ? 0 : /合計/.test(m.labelOf[(t.l === 2 ? 'b' : 'a') + t.c] || '') ? 1 : 2);
        const ob = others.slice().sort((x, y) => pref(x) - pref(y));
        for (const a of others) for (const b of ob) {
          if (a === b) continue;
          let used = 0;
          const good = rs.every(rc => { const A = tv(rc, a), B = tv(rc, b), T = tv(rc, target); if (A == null || B == null) return false; if (!B) return T === 0 || T == null; used++; return Math.abs(A / B * 100 - T) <= 0.006 + Math.abs(T) * 1e-9; });
          if (good && used >= 2) { formulas.push({ target, type: 'ratio', a, b }); return; }
        }
        return;
      }
      // 「合計」＝前面各「小計」欄加總
      if (/^合計/.test(flat(lab))) {
        const subs = formulas.filter(f => f.target.l === l && /小計/.test(flat(m.labelOf[(l === 2 ? 'b' : 'a') + f.target.c] || ''))).map(f => f.target);
        if (subs.length >= 2 && ok(rc => subs.reduce((s2, t) => s2 + (tv(rc, t) || 0), 0))) { formulas.push({ target, type: 'sum', terms: subs.map(t => [1, t]), from: 'subtotals' }); return; }
      }
      // 連續欄全加：上一個公式欄之後到本欄之前的同列數字欄
      {
        const prevT = Math.max(-1, ...formulas.filter(f => f.target.l === l).map(f => f.target.c));
        const run = m.numCols.filter(cc => cc > prevT && cc < c).map(cc => ({ l, c: cc }));
        if (run.length >= 2 && run.length <= 20 && ok(rc => run.reduce((s2, t) => s2 + (tv(rc, t) || 0), 0))) { formulas.push({ target, type: 'sum', terms: run.map(t => [1, t]), from: 'run' }); return; }
      }
      const nz = t => rs.some(rc => (tv(rc, t) || 0) !== 0);
      const cand = others.filter(nz);
      const signs2 = [[1, 1], [1, -1], [-1, 1]];
      for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) for (const s of signs2) {
        const fn = rc => { const A = tv(rc, cand[i]), B = tv(rc, cand[j]); return A == null || B == null ? null : s[0] * A + s[1] * B; };
        if (ok(fn)) { formulas.push({ target, type: 'sum', terms: [[s[0], cand[i]], [s[1], cand[j]]] }); return; }
      }
      const signs3 = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]];
      for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) for (let k = j + 1; k < cand.length; k++) for (const s of signs3) {
        const fn = rc => { const A = tv(rc, cand[i]), B = tv(rc, cand[j]), C = tv(rc, cand[k]); return A == null || B == null || C == null ? null : s[0] * A + s[1] * B + s[2] * C; };
        if (ok(fn)) { formulas.push({ target, type: 'sum', terms: [[s[0], cand[i]], [s[1], cand[j]], [s[2], cand[k]]] }); return; }
      }
      // 多項加總（如 #8 (9)=(1)-(2)+(3)+…）：目標欄左側所有欄位之一組帶號加總
      const left = cand.filter(t => t.l === l && t.c < c);
      if (left.length >= 4 && left.length <= 10) {
        for (let mask = 0; mask < (1 << left.length); mask++) {
          const fn = rc => { let s = 0; for (let q = 0; q < left.length; q++) { const v = tv(rc, left[q]); if (v == null) return null; s += (mask >> q & 1 ? -1 : 1) * v; } return s; };
          if (ok(fn)) { formulas.push({ target, type: 'sum', terms: left.map((t, q) => [mask >> q & 1 ? -1 : 1, t]) }); return; }
        }
      }
    }));
    m.formulas = formulas;
    const fTarget = {}; formulas.forEach(f => { fTarget[f.target.l + ':' + f.target.c] = f; });
    m.fTarget = fTarget;
    // 2) 層級加總（每欄驗證）
    const sumCols = [];
    lines.forEach(l => m.numCols.forEach(c => {
      if (fTarget[l + ':' + c]) return;
      const parents = recs.filter(rc => rc.children.length && rowOf(rc, l) != null);
      if (!parents.length) return;
      const good = parents.every(p => { const s = p.children.reduce((a, k) => a + (tv(recs[k], { l, c }) || 0), 0); const v = tv(p, { l, c }); return v != null && Math.abs(s - v) <= 0.5; });
      if (good) sumCols.push({ l, c });
    }));
    m.sumCols = sumCols;
    // 3) 合計列：多種候選集合，以系統值驗證
    const leaves = recs.filter(rc => !rc.total && rc.hasNum && !rc.children.length).map(rc => rc.i);
    const topOf = k => { let a = recs[k], g2 = 0; while (a.parent != null && g2++ < 30) a = recs[a.parent]; return a.i; };
    const descOf = k => { const out = []; const walk = j => recs[j].children.forEach(ch => { out.push(ch); walk(ch); }); walk(k); return out; };
    const sumCandCols = lines.flatMap(l => m.numCols.filter(c => !fTarget[l + ':' + c]).map(c => ({ l, c })));
    recs.forEach((rc, k) => {
      if (!rc.total || !rc.hasNum) return;
      const lab = rc.label;
      const capF = /資本門/.test(lab) ? (x => recs[x].cap) : (/經常門/.test(lab) ? (x => !recs[x].cap) : null);
      const f = arr => (capF ? arr.filter(capF) : arr);
      const prevTotal = (() => { for (let j = k - 1; j >= 0; j--) if (recs[j].total) return j; return -1; })();
      const nextTotal = (() => { for (let j = k + 1; j < recs.length; j++) if (recs[j].total) return j; return recs.length; })();
      const prevNon = (() => { for (let j = k - 1; j >= 0; j--) if (!recs[j].total) return j; return -1; })();
      const cands = [];
      if (/經資門/.test(lab)) { const two = []; for (let j = k - 1; j >= 0 && two.length < 2; j--) if (recs[j].total && /經常門|資本門/.test(recs[j].label)) two.push(j); if (two.length === 2) cands.push(['tot', two]); }
      if (prevNon >= 0) cands.push(['leaf', f(descOf(topOf(prevNon)).filter(x => leaves.includes(x)))]);
      cands.push(['leaf', f(leaves.filter(x => x > prevTotal && x < k))]);
      cands.push(['leaf', f(leaves.filter(x => x > k && x < nextTotal))]);
      cands.push(['leaf', f(leaves.slice())]);
      const subs = []; for (let j = k - 1; j >= 0; j--) { if (recs[j].total === 'total') break; if (recs[j].total === 'subtotal' && !/經常門|資本門|經資門/.test(recs[j].label)) subs.push(j); }
      if (subs.length) cands.push(['tot', subs]);
      const tops = recs.filter(x => !x.total && x.parent == null && x.hasNum && x.i < k && x.i > prevTotal).map(x => x.i);
      cands.push(['leaf', f(tops)]);
      for (const [kind, set] of cands) {
        if (!set.length) continue;
        const good = sumCandCols.every(t => { const v = tv(rc, t); if (v == null) return true; const s = set.reduce((a, j) => a + (tv(recs[j], t) || 0), 0); return Math.abs(s - v) <= 0.5; });
        if (good) { rc.sumOf = set; rc.sumKind = kind; break; }
      }
      if (!rc.sumOf) rc.unverified = true;
    });
    // 計算格與可編修格
    m.computed = {};
    recs.forEach(rc => lines.forEach(l => {
      const r = rowOf(rc, l); if (r == null) return;
      m.numCols.forEach(c => {
        if (fTarget[l + ':' + c]) m.computed[key(r, c)] = 'formula';
        else if (rc.children.length && sumCols.some(t => t.l === l && t.c === c)) m.computed[key(r, c)] = 'sum';
        else if (rc.total && rc.sumOf) m.computed[key(r, c)] = 'total';
        else if (rc.total) m.computed[key(r, c)] = 'locked';
      });
    }));
    m.info = { formulas: formulas.length, sumCols: sumCols.length, totals: recs.filter(x => x.total && x.sumOf).length, totalsUnverified: recs.filter(x => x.unverified).length };
  }

  // ---------- 重算 ----------
  function recompute(m) {
    if (m.kind !== 'sys') return;
    const g = m.grid, recs = m.recInfo;
    const lines = m.twoLine ? [1, 2] : [1];
    const rowOf = (rc, l) => (l === 1 ? rc.r : rc.r2);
    const get = (rc, t) => { const r = rowOf(rc, t.l); return r == null ? 0 : (numOf(g[r][t.c]) || 0); };
    const set = (rc, t, v) => { const r = rowOf(rc, t.l); if (r == null) return; const old = g[r][t.c]; if (old == null && v === 0) return; g[r][t.c] = Math.round(v * 100) / 100; };
    const applyFormulas = (filter) => m.formulas.forEach(f => recs.forEach(rc => {
      if (!filter(rc)) return; const r = rowOf(rc, f.target.l); if (r == null || !rc.hasNum) return;
      if (f.type === 'ratio') { const A = get(rc, f.a), B = get(rc, f.b); const old = g[r][f.target.c]; g[r][f.target.c] = B ? Math.round(A / B * 10000) / 100 : (old == null || old === '' ? old : null); }
      else set(rc, f.target, f.terms.reduce((s, [sg, t]) => s + sg * get(rc, t), 0));
    }));
    for (let pass = 0; pass < 3; pass++) {
      applyFormulas(rc => !rc.total);
      const order = recs.filter(rc => rc.children.length).sort((a, b) => b.indent - a.indent);
      order.forEach(p => m.sumCols.forEach(t => set(p, t, p.children.reduce((s, k) => s + get(recs[k], t), 0))));
      applyFormulas(rc => rc.children.length > 0);
      recs.forEach(rc => {
        if (!rc.sumOf) return;
        lines.forEach(l => m.numCols.forEach(c => { if (m.fTarget[l + ':' + c]) return; const t = { l, c }; set(rc, t, rc.sumOf.reduce((s, j) => s + get(recs[j], t), 0)); }));
      });
      applyFormulas(rc => !!rc.total);
    }
  }

  // ---------- 編修 ----------
  function editable(m, r, c) {
    if (m.kind !== 'sys') return true;
    if (r < m.layout.D || r >= m.notesStart) return false;
    if (!m.cols.includes(c)) return false;
    const k = m.computed[key(r, c)];
    return !k;
  }
  function setCell(m, r, c, v) {
    const isN = m.numCols && m.numCols.includes(c);
    let nv = v;
    if (isN) { const t = String(v).replace(/,/g, '').trim(); nv = t === '' ? null : (isFinite(Number(t)) ? Number(t) : v); }
    m.grid[r][c] = nv;
    const sv = m.sys[r][c];
    const same = (sv == null || sv === '') && (nv == null || nv === '') || String(sv) === String(nv) || (numOf(sv) != null && numOf(sv) === numOf(nv));
    if (same) delete m.edits[key(r, c)]; else m.edits[key(r, c)] = { sys: sv, cur: nv };
    recompute(m);
    // 計算格若因編修而與系統值不同，也記錄
    Object.keys(m.computed).forEach(k => {
      const [rr, cc] = k.split(',').map(Number); const a = m.sys[rr][cc], b = m.grid[rr][cc];
      if ((numOf(a) || 0) !== (numOf(b) || 0)) m.edits[k] = { sys: a, cur: b, auto: true }; else if (m.edits[k] && m.edits[k].auto) delete m.edits[k];
    });
  }
  function resetCell(m, r, c) { setCell(m, r, c, m.sys[r][c] == null ? '' : m.sys[r][c]); }
  function resetAll(m) { if (m.kind === 'sys') { m.grid = clone(m.sys); m.edits = {}; } else if (m.sysRows) { m.rows = clone(m.sysRows); } }

  // 回寫成 SheetJS 工作表（供勾稽、推算、公告檔使用）
  function toWs(XLSX, m) {
    const ws = XLSX.utils.aoa_to_sheet(m.grid.map(r => r.map(v => (v === '' ? null : v))));
    ws['!merges'] = m.merges; if (m.wsCols) ws['!cols'] = m.wsCols; if (m.wsRows) ws['!rows'] = m.wsRows;
    return ws;
  }

  // ---------- 手填表 ----------
  function manual(spec, rows) {
    const n = spec.cols || spec.manualCols || (spec.header ? spec.header[spec.header.length - 1].length : 3);
    return { no: spec.no, name: spec.name, kind: 'manual', spec, ncol: n, rows: rows || [], numCols: spec.numCols || [], edits: {} };
  }
  function manualRecalc(m) {
    const fs = m.spec.formulas || [];
    m.rows.forEach(row => fs.forEach(([t, op, a, b, c]) => {
      const n = i => numOf(row[i]) || 0;
      if (op === '+') row[t] = n(a) + n(b) + (c != null ? n(c) : 0);
      else if (op === '-') row[t] = n(a) - n(b);
      else if (op === '%') row[t] = n(b) ? Math.round(n(a) / n(b) * 10000) / 100 : null;
    }));
  }
  function manualFormulaCols(m) { return (m.spec.formulas || []).map(f => f[0]); }

  function editSummary(models) {
    const out = [];
    models.forEach(m => {
      if (m.kind === 'sys') Object.keys(m.edits).forEach(k => { const e = m.edits[k]; const [r, c] = k.split(',').map(Number); out.push({ no: m.no, name: m.name, r, c, sys: e.sys, cur: e.cur, auto: !!e.auto, label: (m.labelOf['a' + c] || m.labelOf['b' + c] || '') }); });
    });
    return out;
  }

  return { fromSys, recompute, editable, setCell, resetCell, resetAll, toWs, manual, manualRecalc, manualFormulaCols, editSummary, numOf, flat };
});
