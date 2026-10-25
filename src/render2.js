/* 第 2 版輸出：A4 對頁列印版面（HTML）＋ 依規格建立的 Excel */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const flat = s => (s == null ? '' : String(s)).replace(/[\s　ˉ]/g, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const numOf = v => { if (typeof v === 'number') return v; const t = String(v == null ? '' : v).replace(/,/g, '').trim(); if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null; return Number(t); };
  const PAGE = { w: 210, h: 297, left: 18.1, width: 173, top: 15, tableTop: 44, bottom: 272 };
  const units = s => { let u = 0; for (const ch of String(s)) u += ch.charCodeAt(0) > 0x2E80 ? 2 : 1; return u; };
  const linesFor = (text, wMM, pt) => { const cap = Math.max(1, (wMM - 1.6) / (pt * 0.3528 * 0.55)); let n = 0; String(text).split('\n').forEach(seg => { n += Math.max(1, Math.ceil(units(seg) / cap)); }); return n; };

  // ---------- 欄位配置：左右頁 ----------
  function layoutCols(spec, cols, wsCols, labelCount) {
    const L = spec.left || [], R = spec.right || [];
    const total = L.length + R.length;
    const sysW = c => { const ci = wsCols && wsCols[c]; return ci ? (ci.wch || ci.width || 8) : 8; };
    const fit = arr => { const s = arr.reduce((a, p) => a + p.w, 0); if (s > PAGE.width + 0.5) arr.forEach(p => { p.w = p.w * PAGE.width / s; }); return arr; };
    if (cols.length === total) return [{ pages: [fit(cols.slice(0, L.length).map((c, i) => ({ c, w: L[i] }))), R.length ? fit(cols.slice(L.length).map((c, i) => ({ c, w: R[i] }))) : null].filter(Boolean) }];
    if (!spec.spread) {
      let w = cols.map(sysW); const s = w.reduce((a, b) => a + b, 0); w = w.map(x => x / s * PAGE.width);
      for (let k = 0; k < 3; k++) { const small = w.map(x => x < 6.5); const fixed = small.filter(Boolean).length * 6.5; const rest = w.reduce((a, x, i) => a + (small[i] ? 0 : x), 0); w = w.map((x, i) => small[i] ? 6.5 : x * (PAGE.width - fixed) / rest); }
      return [{ pages: [cols.map((c, i) => ({ c, w: w[i] }))] }];
    }
    // 寬表：第一欄（科目）每組對頁重印，其餘欄平均分配
    const lab = cols.slice(0, labelCount || 1), rest = cols.slice(labelCount || 1);
    const labW = L.slice(0, lab.length).reduce((a, b) => a + b, 0);
    const nL = Math.max(1, L.length - lab.length), nR = Math.max(1, R.length);
    const spreads = [];
    for (let i = 0; i < rest.length;) {
      const left = rest.slice(i, i + nL); i += left.length;
      const right = rest.slice(i, i + nR); i += right.length;
      const lw = (PAGE.width - labW) / Math.max(nL, left.length);
      const pages = [lab.map((c, k) => ({ c, w: L[k] })).concat(left.map(c => ({ c, w: lw })))];
      if (right.length) pages.push(right.map(c => ({ c, w: PAGE.width / nR })));
      spreads.push({ pages });
    }
    return spreads;
  }

  // ---------- 表頭（依系統檔合併儲存格，切到該頁欄位） ----------
  function headerHTML(grid, merges, H0, H1, pcols) {
    const set = new Set(pcols.map(p => p.c));
    const owner = (r, c) => merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
    let h = '';
    for (let r = H0; r <= H1; r++) {
      h += '<tr>';
      for (let k = 0; k < pcols.length; k++) {
        const c = pcols[k].c; const m = owner(r, c);
        if (m) {
          const firstVisC = pcols.find(p => p.c >= m.s.c && p.c <= m.e.c).c;
          const firstR = Math.max(m.s.r, H0);
          if (r !== firstR || c !== firstVisC) continue;
          const cs = pcols.filter(p => p.c >= m.s.c && p.c <= m.e.c).length;
          const rs = Math.min(m.e.r, H1) - firstR + 1;
          h += `<th colspan="${cs}" rowspan="${rs}">${esc(String(grid[m.s.r][m.s.c] == null ? '' : grid[m.s.r][m.s.c]).trim()).replace(/\n/g, '<br>')}</th>`;
        } else {
          const v = grid[r][c];
          // 同一欄上方已有同一字（系統未合併的直向表頭）→ 併成空白
          h += `<th>${esc(String(v == null ? '' : v).trim()).replace(/\n/g, '<br>')}</th>`;
        }
      }
      h += '</tr>';
    }
    return h;
  }
  function specHeaderHTML(hdr) { return hdr.map(row => '<tr>' + row.map(([t, cs, rs]) => `<th colspan="${cs}" rowspan="${rs}">${esc(t)}</th>`).join('') + '</tr>').join(''); }

  const fmtCell = (v, rate) => {
    const n = numOf(v);
    if (n == null) return esc(String(v == null ? '' : v).replace(/ˉ/g, '　')).replace(/\n/g, '<br>');
    if (typeof v === 'string' && /^0\d/.test(v.trim())) return esc(v.trim());
    return rate ? n.toFixed(2) : Math.round(n).toLocaleString('en-US');
  };

  const PX = 25.4 / 96;
  const isNumCell = v => { if (typeof v === 'string' && /^\s*[-－]\s*$/.test(v)) return true; const n = numOf(v); return n != null && !(typeof v === 'string' && /^0\d/.test(v.trim())); };
  const cellClass = (v, rw, short) => isNumCell(v) ? 'n' : ((rw.center ? 't c' : 't') + (short ? ' k' : ''));
  const rowHTML = (T, rw, pcols, h) => {
    if (rw.section) return `<tr class="sec"${h ? ` style="height:${h.toFixed(2)}mm"` : ''}><td colspan="${pcols.length}">${esc(rw.section)}</td></tr>`;
    return `<tr${h ? ` style="height:${h.toFixed(2)}mm"` : ''}${rw.total ? ' class="tot"' : ''}>` + pcols.map(p => { const v = rw.cells[p.c]; return `<td class="${cellClass(v, rw, p.w < 8)}">${fmtCell(v, T.rateCols.has(p.c))}</td>`; }).join('') + '</tr>';
  };
  const colgroup = pcols => `<colgroup>${pcols.map(p => `<col style="width:${p.w.toFixed(2)}mm">`).join('')}</colgroup>`;
  // 瀏覽器實測列高（mm）；無 DOM 時用估算
  function measure(T, sp) {
    const nR = T.rows.length;
    if (typeof document === 'undefined') {
      const allCols = sp.pages.flat();
      const rowH = T.rows.map(rw => { if (rw.section) return Math.max(7, linesFor(rw.section, PAGE.width, T.bodyPt || 10) * 5.2 + 1.5); let ln = 1; allCols.forEach(p => { const v = rw.cells[p.c]; if (v != null && v !== '' && numOf(v) == null) ln = Math.max(ln, linesFor(String(v).replace(/ˉ/g, '\u3000'), p.w, T.bodyPt || 10)); }); return ln * 4.6 + 1.4; });
      return { headH: T.headerRows * 7.2, rowH, notesH: (T.notes || []).length * 4.6 };
    }
    let host = document.getElementById('bk-measure');
    if (!host) { host = document.createElement('div'); host.id = 'bk-measure'; host.className = 'bk'; host.style.cssText = 'position:absolute;left:-30000px;top:0;visibility:hidden'; host.innerHTML = '<style>' + bookCSS('#bk-measure') + '</style><div class="pg slot" style="height:auto;overflow:visible;margin:0"></div>'; document.body.appendChild(host); }
    const slot = host.querySelector('.slot');
    let headH = 0; const rowH = new Array(nR).fill(0);
    sp.pages.forEach(pcols => {
      slot.innerHTML = `<table class="tb" style="position:static;width:${pcols.reduce((a, p) => a + p.w, 0).toFixed(2)}mm;font-size:${T.bodyPt || 10}pt;--hpt:${T.headPt || 11}pt">${colgroup(pcols)}<thead>${T.headHTML(pcols)}</thead><tbody>${T.rows.map(rw => rowHTML(T, rw, pcols, 0)).join('')}</tbody></table>`;
      const tb = slot.querySelector('table');
      headH = Math.max(headH, tb.tHead.getBoundingClientRect().height * PX);
      [...tb.tBodies[0].rows].forEach((tr, i) => { rowH[i] = Math.max(rowH[i], tr.getBoundingClientRect().height * PX); });
    });
    let notesH = 0;
    if (T.notes && T.notes.length) { slot.innerHTML = `<div class="notes" style="position:static;width:${PAGE.width}mm">${T.notes.map(esc).join('<br>')}</div>`; notesH = slot.firstChild.getBoundingClientRect().height * PX; }
    slot.innerHTML = '';
    return { headH, rowH: rowH.map(h => Math.max(h, 5.2)), notesH };
  }
  // 超過一頁的長列（如立法院決議內容）依句讀切成多列
  function splitText(s, k) {
    s = String(s); if (k <= 1 || s.length < 40) return [s].concat(new Array(Math.max(0, k - 1)).fill(''));
    const out = []; let rest = s;
    for (let i = k; i > 1; i--) {
      const target = Math.round(rest.length / i); let cut = -1;
      for (let d = 0; d < target * 0.4 && cut < 0; d++) { for (const q of [target + d, target - d]) { if (q > 0 && q < rest.length && /[。；;，,\n、]/.test(rest[q - 1])) { cut = q; break; } } }
      if (cut < 0) cut = target;
      out.push(rest.slice(0, cut)); rest = rest.slice(cut).replace(/^\n/, '');
    }
    out.push(rest); return out;
  }
  function splitLong(T, sp, avail) {
    let M = measure(T, sp);
    for (let pass = 0; pass < 3; pass++) {
      const rows = []; let changed = false;
      T.rows.forEach((rw, i) => {
        if (rw.section || M.rowH[i] <= avail) { rows.push(rw); return; }
        const k = Math.ceil(M.rowH[i] / (avail * 0.92)); changed = true;
        const parts = {}; Object.keys(rw.cells).forEach(c => { const v = rw.cells[c]; parts[c] = (v != null && !isNumCell(v)) ? splitText(v, k) : [v].concat(new Array(k - 1).fill('')); });
        for (let j = 0; j < k; j++) rows.push(Object.assign({}, rw, { cells: Object.fromEntries(Object.keys(parts).map(c => [c, parts[c][j]])), cont: j > 0, keepNext: false }));
      });
      if (!changed) break;
      T.rows = rows; M = measure(T, sp);
    }
    return M;
  }

  function tablePages(T, ctx) {
    const out = [];
    const AREA = PAGE.bottom - PAGE.tableTop;
    T.spreads.forEach((sp, si) => {
      const lastSpread = si === T.spreads.length - 1;
      let M = measure(T, sp);
      const avail0 = AREA - M.headH - 0.6;
      if (M.rowH.some(h => h > avail0)) M = splitLong(T, sp, avail0);
      const avail = AREA - M.headH - 0.6;
      const SAFE = 0.3; // 列高取整誤差
      const chunks = []; let cur = [], h = 0;
      T.rows.forEach((rw, i) => {
        const need = M.rowH[i] + SAFE + (rw.keepNext && T.rows[i + 1] ? M.rowH[i + 1] + SAFE : 0);
        if (cur.length && h + need > avail) { chunks.push(cur); cur = []; h = 0; }
        cur.push(i); h += M.rowH[i] + SAFE;
      });
      chunks.push(cur);
      // 備註放最後一頁表下方，放不下就把末幾列移到新頁
      const noteH = lastSpread && T.notes && T.notes.length ? M.notesH + 1.5 : 0;
      if (noteH) { const sum = a => a.reduce((s, i) => s + M.rowH[i], 0); let lastC = chunks[chunks.length - 1]; if (sum(lastC) > avail - noteH) { const moved = []; while (lastC.length > 1 && sum(lastC) > avail - noteH) moved.unshift(lastC.pop()); if (sum(lastC) > avail - noteH || !moved.length) { chunks.push([]); } else chunks.push(moved); } }
      chunks.forEach((ch, ci) => {
        const last = lastSpread && ci === chunks.length - 1;
        const tblH = AREA - (last ? noteH : 0);
        sp.pages.forEach((pcols, pi) => {
          const side = T.isSpread ? (pi === 0 ? 'L' : 'R') : 'S';
          let html = `<div class="pg" data-side="${side}" data-tbl="${esc(T.no)}">` + titleHTML(T, side);
          html += `<table class="tb" style="left:${(T.left || PAGE.left)}mm;top:${PAGE.tableTop}mm;width:${pcols.reduce((a, p) => a + p.w, 0).toFixed(2)}mm;font-size:${T.bodyPt || 10}pt;--hpt:${T.headPt || 11}pt">${colgroup(pcols)}`;
          html += `<thead>${T.headHTML(pcols)}</thead><tbody>` + ch.map(i => rowHTML(T, T.rows[i], pcols, M.rowH[i])).join('');
          const fillH = Math.max(0, tblH - M.headH - ch.reduce((a, i) => a + M.rowH[i], 0) - 0.8);
          html += `<tr class="fill" style="height:${fillH.toFixed(2)}mm"><td colspan="${pcols.length}"></td></tr></tbody></table>`;
          if (last && noteH && side !== 'R') html += `<div class="notes" style="left:${PAGE.left}mm;top:${(PAGE.tableTop + tblH + 1.5).toFixed(2)}mm">${T.notes.map(n => esc(n)).join('<br>')}</div>`;
          html += '</div>';
          out.push({ html, side });
        });
      });
    });
    return out;
  }
  function titleHTML(T, side) {
    const t = T.title, s = T.sub; const tv = T.titlePt ? `;--tpt:${T.titlePt}pt` : '';
    if (side === 'L') return `<div class="ttl r" style="right:${PAGE.w - PAGE.left - PAGE.width}mm${tv}"><div class="ag">${esc(t.L[0])}</div><div class="tn">${esc(t.L[1])}</div></div><div class="sub" style="left:${PAGE.left}mm;width:${PAGE.width}mm"><span>${esc(s.left || '')}</span><span>中華民國</span></div>`;
    if (side === 'R') return `<div class="ttl l" style="left:${PAGE.left}mm${tv}"><div class="ag">${esc(t.R[0])}</div><div class="tn">${esc(t.R[1])}</div></div><div class="sub" style="left:${PAGE.left}mm;width:${PAGE.width}mm"><span>${esc(s.year)}</span><span>${esc(s.unit || '')}</span></div>`;
    return `<div class="ttl c" style="${tv.slice(1)}">${t.lines.map((x, i) => `<div class="${i === 0 ? 'ag' : (i < t.lines.length - 1 || t.lines.length === 2 ? 'tn' : 'yr')}">${esc(x)}</div>`).join('')}</div><div class="sub" style="left:${PAGE.left}mm;width:${PAGE.width}mm"><span>${esc(s.left || '')}</span><span>${esc(s.unit || '')}</span></div>`;
  }

  // 表格左邊界：規格指定 tableLeft，否則單頁表依欄寬總和置中
  function leftOf(sp, spreads) {
    if (sp.tableLeft != null && sp.tableLeft !== '') return +sp.tableLeft;
    const sum = spreads && spreads[0] ? spreads[0].pages[0].reduce((a, p) => a + p.w, 0) : 0;
    return !sp.spread && sum > 0 && sum < PAGE.width - 1 ? PAGE.left + (PAGE.width - sum) / 2 : PAGE.left;
  }
  // ---------- 由模型組出表格定義 ----------
  function fromModel(m, ctx) {
    const sp = m.spec; const g = m.grid; const L = m.layout;
    const rateCols = new Set(m.cols.filter(c => /比率|%|％/.test((m.labelOf['a' + c] || '') + (m.labelOf['b' + c] || ''))));
    const rows = [];
    for (let r = L.D; r < m.notesStart; r++) {
      const row = g[r]; if (!row || !row.some(v => flat(v))) continue;
      const cells = {}; m.cols.forEach(c => { cells[c] = row[c]; });
      const lab = flat(row.filter(v => typeof v === 'string').join(''));
      const info = m.rows.find(x => x.r === r);
      rows.push({ cells, total: /合計|總計|小計/.test(lab), keepNext: !!(info && info.line === 1 && m.recs[info.rec] && m.recs[info.rec].r2 != null), cont: !!(info && info.line === 2) });
    }
    const notes = [];
    for (let r = m.notesStart; r < g.length; r++) { const t = (g[r] || []).filter(v => flat(v)).map(v => String(v).trim()).join(' '); if (t && !/^備註[:：]?$/.test(flat(t))) notes.push(t); else if (t) notes.push('備註：'); }
    const spreads = layoutCols(sp, m.cols, m.wsCols, 1);
    return {
      no: sp.no, isSpread: !!sp.spread, rows, rateCols, notes, spreads, left: leftOf(sp, spreads), headerRows: L.H1 - L.H0 + 1, bodyPt: sp.bodyPt || 10, headPt: sp.headPt || 11, titlePt: sp.titlePt || 0,
      headHTML: pcols => headerHTML(g, m.merges, L.H0, L.H1, pcols),
      title: titles(sp, ctx, m), sub: subs(sp, ctx, m)
    };
  }
  function titles(sp, ctx, m) {
    const ag = ctx.agency;
    if (sp.spread) { const L = sp.titleL || [ag, sp.name], R = sp.titleR || ['', '']; return { L: [L[0], L[1]], R: [R[0], R[1]] }; }
    const name = sp.no === '22-36' && m && m.subject ? m.subject + '明細表' : (sp.titleText || sp.name);
    const date = /^(20|22-36)$/.test(sp.no) ? `中華民國${ctx.year}年12月31日` : `中華民國${ctx.year}年度`;
    return { lines: sp.no === '41' && !sp.titleText ? [ag, '立法院審議通過中央政府總預算案、總決算審核報告', '決議、附帶決議及注意事項辦理情形報告表', date] : [ag].concat(String(name).split('\n'), [date]) };
  }
  function subs(sp, ctx, m) {
    const meta = (m && m.meta) || {};
    const unit = sp.no === '41' ? '' : meta.unit ? '單位:' + meta.unit : (sp.no === '18' ? '單位:新臺幣千元' : '單位:新臺幣元');
    return { left: sp.no === '22-36' ? '公務機關會計' : (meta.scope || ''), unit, year: `${ctx.year}年度` };
  }
  function fromManual(m, ctx) {
    const sp = m.spec; const n = m.ncol; const cols = Array.from({ length: n }, (_, i) => i);
    const rows = m.rows.map(r => r.section != null ? { section: r.section } : { cells: Object.fromEntries(cols.map(c => [c, r[c]])) });
    const spreads = layoutCols(sp, cols, null, 1);
    const rateCols = new Set(); (sp.header[sp.header.length - 1] || []).forEach(() => {});
    return { no: sp.no, isSpread: !!sp.spread, rows, rateCols: new Set((sp.rateCols || []).concat((sp.formulas || []).filter(f => f[1] === '%').map(f => f[0]))), notes: m.notes || [], spreads, headerRows: sp.header.length, bodyPt: sp.bodyPt || (sp.no === '41' ? 12 : 10), headPt: sp.headPt || 11, titlePt: sp.titlePt || 0, left: leftOf(sp, spreads),
      headHTML: pcols => { // 手填表的表頭依欄位切頁
        if (spreads[0].pages.length === 1) return specHeaderHTML(sp.header);
        const set = new Set(pcols.map(p => p.c));
        // 展開表頭格位
        const grid = []; const cells = [];
        sp.header.forEach((row, r) => { grid[r] = grid[r] || []; let c = 0; row.forEach(([t, cs, rs]) => { while (grid[r][c]) c++; cells.push({ t, r, c, cs, rs }); for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { grid[r + i] = grid[r + i] || []; grid[r + i][c + j] = 1; } c += cs; }); });
        let h = '';
        for (let r = 0; r < sp.header.length; r++) {
          h += '<tr>' + cells.filter(x => x.r === r).map(x => { const vis = []; for (let j = 0; j < x.cs; j++) if (set.has(x.c + j)) vis.push(j); if (!vis.length) return ''; return `<th colspan="${vis.length}" rowspan="${x.rs}">${esc(x.t)}</th>`; }).join('') + '</tr>';
        }
        return h;
      },
      title: titles(sp, ctx, m), sub: subs(sp, ctx, m) };
  }

  // ---------- 文字頁（總說明） ----------
  const PLAN_HDR = [[['工作計畫名稱', 1, 1], ['重要計畫項目', 1, 1], ['實施內容', 1, 1], ['已完成或未完成之說明', 1, 1], ['因應改善措施', 1, 1]]];
  const PLAN_W = [27, 31, 44, 55, 26];
  const paraIndent = p => /^[一二三四五六七八九十]+、/.test(p) ? 0 : (/^(\(|（)[一二三四五六七八九十]+(\)|）)/.test(p) ? 1 : (/^\d+\./.test(p) ? 2 : (/^\(\d+\)/.test(p) ? 3 : 4)));
  function measureParas(paras) {
    if (typeof document === 'undefined') return paras.map(p => Math.max(1, Math.ceil(units(p) / (82 - paraIndent(p) * 2))) * 7.2);
    measure({ rows: [], notes: [], headHTML: () => '', rateCols: new Set() }, { pages: [] });
    const slot = document.querySelector('#bk-measure .slot');
    slot.innerHTML = paras.map(p => `<p class="para" style="position:static;padding-left:${paraIndent(p) * 4}mm">${esc(p)}</p>`).join('');
    const h = [...slot.children].map(e => e.getBoundingClientRect().height * PX); slot.innerHTML = ''; return h;
  }
  // 總說明：文字段落（自動分頁）＋施政計畫分項說明表
  function textPages(paras, tables, ctx) {
    const out = []; const maxY = PAGE.bottom - 2;
    let html = '', y = 0, first = true;
    const head = `<div class="ttl c"><div class="ag">${esc(ctx.agency)}</div><div class="tn">總　　說　　明</div><div class="yr">中華民國${esc(ctx.year)}年度</div></div>`;
    const open = () => { html = `<div class="pg" data-side="S" data-tbl="0">` + (first ? head : ''); y = first ? 44 : 22; };
    const close = () => { html += '</div>'; out.push({ html, side: 'S' }); first = false; };
    open();
    const hs = measureParas(paras);
    paras.forEach((p, i) => {
      if (y + hs[i] > maxY && y > 30) { close(); open(); }
      html += `<p class="para" style="top:${y.toFixed(2)}mm;padding-left:${paraIndent(p) * 4}mm">${esc(p)}</p>`; y += hs[i];
    });
    close();
    (tables || []).filter(t => t.rows && t.rows.length).forEach(t => {
      const T = { no: '0', isSpread: false, rows: t.rows.map(r => ({ cells: Object.assign({}, r) })), rateCols: new Set(), notes: [], spreads: [{ pages: [PLAN_W.map((w, c) => ({ c, w }))] }], headerRows: 1, bodyPt: 10, left: 18.1,
        headHTML: () => specHeaderHTML(PLAN_HDR), title: { lines: [ctx.agency, t.name || '施政計畫分項說明', `中華民國${ctx.year}年度`] }, sub: { left: '', unit: '' } };
      tablePages(T, ctx).forEach(pg => out.push(pg));
    });
    return out;
  }

  // ---------- 整本書 ----------
  function book(parts, ctx) {
    // parts: [{kind:'text'|'table', T|paras}]
    const pages = [];
    let pageNo = ctx.startPage || 1;
    const push = pg => { pages.push(pg.html.replace('</div>', '</div>').replace(/<\/div>$/, `<div class="pno">${pageNo}</div></div>`)); pageNo++; };
    const starts = {};
    parts.forEach(pt => {
      const pp = pt.pages;
      if (pp.length && pp[0].side === 'L' && pageNo % 2 === 1) push({ html: '<div class="pg blank"><div class="bl">本 頁 空 白</div></div>' });
      starts[pt.key || pt.no] = { from: pageNo, count: pp.length };
      pp.forEach(push);
    });
    pages.starts = starts;
    return pages;
  }
  const CSS_RULES = `.pg{position:relative;width:210mm;height:297mm;background:#fff;margin:0 auto 6mm;overflow:hidden;font-family:"PMingLiU","新細明體","MingLiU","Noto Serif CJK TC",serif;color:#000;page-break-after:always}
.ttl{position:absolute;top:15mm;font-family:"DFKai-SB","標楷體","BiauKai","Noto Serif CJK TC",serif}
.ttl.r{text-align:right}.ttl.l{text-align:left}.ttl.c{left:0;right:0;text-align:center}
.ttl .ag{font-size:15pt;line-height:1.35}.ttl .tn{font-size:var(--tpt,16.5pt);line-height:1.35}.ttl .yr{font-size:12pt;line-height:1.5}
.sub{position:absolute;top:37.5mm;display:flex;justify-content:space-between;font-family:"DFKai-SB","標楷體","BiauKai",serif;font-size:11.5pt}
.tb{position:absolute;border-collapse:collapse;table-layout:fixed;border:1.2px solid #000}
.tb th{font-family:"DFKai-SB","標楷體","BiauKai",serif;font-weight:normal;font-size:var(--hpt,11pt);border:0.8px solid #000;padding:1mm 0.6mm;text-align:center;vertical-align:middle;line-height:1.25}
.tb thead tr:last-child th{border-bottom:1.2px solid #000}
.tb td{border-left:0.8px solid #000;border-right:0.8px solid #000;padding:0.5mm 0.8mm;vertical-align:top;line-height:1.3;white-space:normal;word-break:break-all;overflow:hidden}
.tb td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.tb td.c{text-align:center}.tb td.k{white-space:nowrap;padding:0.5mm 0;text-align:center;font-size:9pt;overflow:visible}
.tb tr.sec td{font-weight:bold}
.tb tr.fill td{padding:0;border-bottom:1.2px solid #000}
.notes{position:absolute;top:274mm;font-size:9.5pt;line-height:1.35;width:173mm}
.pno{position:absolute;bottom:12mm;left:0;right:0;text-align:center;font-size:11pt}
.blank .bl{position:absolute;top:120mm;left:0;right:0;text-align:center;font-family:"DFKai-SB","標楷體",serif;font-size:48pt}
.para{position:absolute;left:18mm;width:174mm;margin:0;font-size:12pt;line-height:7.2mm;text-align:justify}`;
  function bookCSS(scope) { return CSS_RULES.split('\n').map(r => r.trim() ? r.replace(/(^|\})([^{}@]+)\{/g, (m0, a, sel) => a + sel.split(',').map(x => scope + ' ' + x.trim()).join(',') + '{') : '').join('\n') + `\n${scope} *{box-sizing:border-box}`; }
  const CSS = '@page{size:A4;margin:0}\nbody{margin:0;background:#888}\n@media print{body{background:#fff}.bk .pg{margin:0}}\n' + bookCSS('.bk');
  function htmlDoc(pages, title) { return `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="bk">${pages.join('\n')}</div></body></html>`; }

  // ---------- Excel ----------
  const MM2CH = 1 / 2.12;
  function excelSheet(ExcelJS, wb, name, T, opt) {
    const ws = wb.addWorksheet(name.slice(0, 31), { pageSetup: { paperSize: 9, orientation: 'portrait', margins: { left: 0.6, right: 0.35, top: 0.55, bottom: 0.6, header: 0.3, footer: 0.3 }, scale: 90 } });
    const cols = []; const widths = {}; const breaks = [];
    T.spreads.forEach((sp, si) => sp.pages.forEach((pg, pi) => { pg.forEach(p => { if (!(p.c in widths)) { cols.push(p.c); widths[p.c] = p.w; } }); if (!(si === T.spreads.length - 1 && pi === sp.pages.length - 1)) breaks.push(cols.length); }));
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(1.5, (widths[c] * 96 / 25.4 - 5) / 8); });
    const n = cols.length;
    const kai = { name: '標楷體', size: T.headPt || 11 }, ming = { name: '新細明體', size: T.bodyPt || 10 };
    let r = 1;
    if (T.title.lines) {
      T.title.lines.filter(Boolean).forEach((t, i) => { ws.mergeCells(r, 1, r, n); const cell = ws.getCell(r, 1); cell.value = t; cell.font = { name: '標楷體', size: i === 0 ? 15 : (i === T.title.lines.length - 1 && i > 1 ? 12 : (T.titlePt || 16)) }; cell.alignment = { horizontal: 'center' }; r++; });
      const subRow = ws.getRow(r); subRow.getCell(1).value = T.sub.left || ''; subRow.getCell(n).value = T.sub.unit || ''; subRow.getCell(n).alignment = { horizontal: 'right' }; subRow.font = kai; r++;
    } else {
      // 對頁：左頁標題靠右、右頁標題靠左（同列印版面）
      const nL = T.spreads[0].pages[0].length, hasR = n > nL;
      [0, 1].forEach(i => {
        ws.mergeCells(r, 1, r, nL); const a = ws.getCell(r, 1); a.value = T.title.L[i]; a.font = { name: '標楷體', size: i ? (T.titlePt || 16.5) : 15 }; a.alignment = { horizontal: 'right' };
        if (hasR) { ws.mergeCells(r, nL + 1, r, n); const b = ws.getCell(r, nL + 1); b.value = T.title.R[i]; b.font = { name: '標楷體', size: i ? (T.titlePt || 16.5) : 15 }; b.alignment = { horizontal: 'left' }; }
        r++;
      });
      r++;
      const sr = ws.getRow(r); sr.getCell(1).value = T.sub.left || ''; sr.getCell(nL).value = '中華民國'; sr.getCell(nL).alignment = { horizontal: 'right' };
      if (hasR) { sr.getCell(nL + 1).value = T.sub.year; sr.getCell(n).value = T.sub.unit || ''; sr.getCell(n).alignment = { horizontal: 'right' }; }
      else sr.getCell(nL).value = '中華民國' + T.sub.year + '　' + (T.sub.unit || '');
      sr.font = kai; r++;
    }
    const headStart = r;
    // 表頭：以 HTML 表頭的格位轉成合併儲存格
    const hdr = opt.headerCells(cols);
    hdr.forEach(h => { const rr = headStart + h.r, cc = 1 + h.c; if (h.rs > 1 || h.cs > 1) ws.mergeCells(rr, cc, rr + h.rs - 1, cc + h.cs - 1); const cell = ws.getCell(rr, cc); cell.value = h.t; });
    const hRows = Math.max(1, ...hdr.map(h => h.r + h.rs));
    for (let i = 0; i < hRows; i++) for (let j = 1; j <= n; j++) { const cell = ws.getCell(headStart + i, j); cell.font = kai; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: i === hRows - 1 ? 'medium' : 'thin' } }; }
    r = headStart + hRows;
    const bodyStart = r;
    T.rows.forEach(rw => {
      const row = ws.getRow(r);
      if (rw.section) { ws.mergeCells(r, 1, r, n); row.getCell(1).value = rw.section; row.getCell(1).font = Object.assign({}, ming, { bold: true }); }
      else cols.forEach((c, i) => {
        const v = rw.cells[c]; const cell = row.getCell(i + 1); const nv = numOf(v);
        if (nv != null && !(typeof v === 'string' && /^0\d/.test(v.trim()))) { cell.value = nv; cell.numFmt = T.rateCols.has(c) ? '0.00' : '#,##0;-#,##0;0'; }
        else cell.value = v == null ? null : String(v).replace(/ˉ/g, '　');
        cell.font = ming; cell.alignment = { vertical: 'top', wrapText: true };
      });
      for (let j = 1; j <= n; j++) row.getCell(j).border = { left: { style: 'thin' }, right: { style: 'thin' } };
      r++;
    });
    for (let j = 1; j <= n; j++) { const cell = ws.getCell(r - 1 < bodyStart ? bodyStart : r - 1, j); cell.border = Object.assign({}, cell.border, { bottom: { style: 'medium' } }); }
    (T.notes || []).forEach(t => { ws.getRow(r).getCell(1).value = t; ws.getRow(r).getCell(1).font = { name: '新細明體', size: 9 }; r++; });
    ws.pageSetup.printTitlesRow = `${headStart}:${headStart + hRows - 1}`;
    ws._colBreaks = breaks;
    return ws;
  }
  function excelText(ExcelJS, wb, name, paras, ctx) {
    const ws = wb.addWorksheet(name.slice(0, 31), { pageSetup: { paperSize: 9, orientation: 'portrait', margins: { left: 0.71, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } } });
    ws.getColumn(1).width = 4; ws.getColumn(2).width = 78;
    [[ctx.agency, 15], ['總　　說　　明', 16.5], [`中華民國${ctx.year}年度`, 12]].forEach(([t, sz], i) => { ws.mergeCells(i + 1, 1, i + 1, 2); const c = ws.getCell(i + 1, 1); c.value = t; c.font = { name: '標楷體', size: sz }; c.alignment = { horizontal: 'center' }; });
    paras.forEach((p, i) => { const r = ws.getRow(i + 5); const ind = paraIndent(p); r.getCell(2).value = p; r.getCell(2).font = { name: '新細明體', size: 12 }; r.getCell(2).alignment = { wrapText: true, vertical: 'top', indent: ind }; r.height = Math.max(1, Math.ceil(units(p) / (70 - ind * 2))) * 17; });
    return ws;
  }
  // 依 HTML 表頭邏輯產生 Excel 表頭格位
  function headerCellsFromModel(m) {
    return cols => {
      const out = []; const L = m.layout; const g = m.grid;
      const owner = (r, c) => m.merges.find(x => r >= x.s.r && r <= x.e.r && c >= x.s.c && c <= x.e.c);
      const done = new Set();
      for (let r = L.H0; r <= L.H1; r++) cols.forEach((c, i) => {
        const o = owner(r, c);
        if (o) { const id = o.s.r + ',' + o.s.c; if (done.has(id)) return; done.add(id); const vis = cols.map((cc, k) => (cc >= o.s.c && cc <= o.e.c ? k : -1)).filter(k => k >= 0); const r0 = Math.max(o.s.r, L.H0); out.push({ r: r0 - L.H0, c: vis[0], cs: vis.length, rs: Math.min(o.e.r, L.H1) - r0 + 1, t: String(g[o.s.r][o.s.c] == null ? '' : g[o.s.r][o.s.c]).trim() }); }
        else out.push({ r: r - L.H0, c: i, cs: 1, rs: 1, t: String(g[r][c] == null ? '' : g[r][c]).trim() });
      });
      return out;
    };
  }
  function headerCellsFromSpec(hdr) {
    return cols => { const out = []; const grid = []; hdr.forEach((row, r) => { grid[r] = grid[r] || []; let c = 0; row.forEach(([t, cs, rs]) => { while (grid[r][c]) c++; out.push({ r, c, cs, rs, t }); for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { grid[r + i] = grid[r + i] || []; grid[r + i][c + j] = 1; } c += cs; }); }); return out; };
  }
  // colBreaks 需在存檔後以 JSZip 寫入
  async function injectColBreaks(JSZip, buf, wb) {
    const z = await JSZip.loadAsync(buf);
    // 預設字型改新細明體 12（欄寬單位以此為準）
    const st = await z.file('xl/styles.xml').async('string');
    z.file('xl/styles.xml', st.replace(/(<fonts[^>]*>\s*)(<font>[\s\S]*?<\/font>|<font\/>)/, (m, a) => a + '<font><sz val="12"/><name val="新細明體"/><family val="1"/><charset val="136"/></font>'));
    const sheets = wb.worksheets;
    for (let i = 0; i < sheets.length; i++) {
      const br = sheets[i]._colBreaks; if (!br || !br.length) continue;
      const f = z.file(`xl/worksheets/sheet${i + 1}.xml`); if (!f) continue;
      let x = await f.async('string');
      const xml = `<colBreaks count="${br.length}" manualBreakCount="${br.length}">${br.map(b => `<brk id="${b}" max="1048575" man="1"/>`).join('')}</colBreaks>`;
      x = x.includes('</rowBreaks>') ? x.replace('</rowBreaks>', '</rowBreaks>' + xml) : (x.includes('<drawing') ? x.replace('<drawing', xml + '<drawing') : x.replace('</worksheet>', xml + '</worksheet>'));
      z.file(`xl/worksheets/sheet${i + 1}.xml`, x);
    }
    return z.generateAsync({ type: typeof window === 'undefined' ? 'nodebuffer' : 'arraybuffer', compression: 'DEFLATE' });
  }

  return { leftOf, headerHTML, specHeaderHTML, excelText, PLAN_HDR, PLAN_W, bookCSS, measure, layoutCols, fromModel, fromManual, tablePages, textPages, book, htmlDoc, excelSheet, headerCellsFromModel, headerCellsFromSpec, injectColBreaks, PAGE };
});
