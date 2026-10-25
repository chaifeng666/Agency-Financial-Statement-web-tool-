/* 範本 PDF 匯入（pdf.js）：核對書表頁次、擷取總說明與立法院決議辦理情形報告表文字 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalPdf = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MM = 25.4 / 72;
  const flat = s => String(s || '').replace(/[\s　ˉ]/g, '');

  async function pageLines(doc, p) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4] * MM, y: (vp.height - it.transform[5]) * MM, s: it.str, w: (it.width || 0) * MM, h: Math.abs(it.transform[3]) }));
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const lines = [];
    items.forEach(it => {
      const L = lines.find(l => Math.abs(l.y - it.y) < 1.6);
      if (L) L.items.push(it); else lines.push({ y: it.y, items: [it] });
    });
    const tidy = t => t.replace(/([\u3000-\u9fff\uff00-\uffef])[ \t]+(?=[\u3000-\u9fff\uff00-\uffef])/g, '$1');
    items.forEach(it => { it.s = tidy(it.s); });
    lines.forEach(l => { l.items.sort((a, b) => a.x - b.x); l.text = tidy(l.items.map(i => i.s).join('')); });
    lines.sort((a, b) => a.y - b.y);
    return { lines, h: vp.height * MM };
  }

  // 依頁首文字辨認每頁屬於哪張表
  async function scan(doc, specTables) {
    const out = [];
    const H = [];
    for (let p = 1; p <= doc.numPages; p++) { const { lines } = await pageLines(doc, p); H.push(lines.slice(0, 4).map(l => flat(l.text))); }
    const match = (heads, k) => heads.some(h => h === k || (h.indexOf(k) === 0 && h.length <= k.length + 2) || (h.length > 6 && k.indexOf(h) === 0));
    for (let p = 1; p <= doc.numPages; p++) {
      const heads = H[p - 1]; const head = heads.join('|');
      let hit = null;
      if (heads.some(h => /目次$/.test(h))) hit = 'toc';
      if (!hit && heads.some(h => h === '總說明')) hit = '0';
      if (!hit && heads.some(h => /明細表$/.test(h) && h.length <= 20)) hit = '22-36';
      if (!hit) {
        const cands = specTables.filter(t => { const keys = [flat((t.titleL || [])[1] || ''), flat(t.name)].filter(k => k.length >= 3); return keys.some(k => match(heads, k)); });
        if (cands.length === 1) hit = cands[0].no;
        else if (cands.length > 1) { const nx = H[p] || []; const c2 = cands.find(t => t.titleR && nx.some(h => h === flat(t.titleR[1]))); hit = (c2 || cands[0]).no; }
      }
      out.push({ p, hit, head: head.slice(0, 60) });
    }
    // 續頁（對頁右頁）沿用前一頁
    for (let i = 1; i < out.length; i++) if (!out[i].hit && out[i - 1].hit && out[i - 1].hit !== 'toc' && !/本頁空白/.test(out[i].head)) out[i].hit = out[i - 1].hit;
    const ranges = {};
    out.forEach(o => { if (!o.hit) return; const r = ranges[o.hit] || (ranges[o.hit] = { from: o.p, to: o.p }); r.to = o.p; });
    return { pages: out, ranges };
  }

  // 依欄界（mm）把每頁文字分欄、組成多筆紀錄
  async function columns(doc, from, to, bounds, opt) {
    opt = opt || {};
    const recs = [];
    let cur = null;
    for (let p = from; p <= to; p++) {
      const { lines } = await pageLines(doc, p);
      for (const l of lines) {
        if (l.y < (opt.top || 0) || l.y > (opt.bottom || 999)) continue;
        if (opt.skip && opt.skip.test(flat(l.text))) continue;
        const cells = bounds.slice(0, -1).map(() => '');
        l.items.forEach(it => { let k = bounds.findIndex((b, i) => i < bounds.length - 1 && it.x >= b - 0.8 && it.x < bounds[i + 1] - 0.8); if (k < 0) k = it.x < bounds[0] ? 0 : bounds.length - 2; cells[k] += it.s; });
        const c = cells.map(s => s.replace(/\s+$/, ''));
        if (!c.some(s => s.trim())) continue;
        if (opt.section && opt.section(c)) { recs.push({ section: c.join('').trim() }); cur = null; continue; }
        if (!cur || opt.isStart(c, cur)) { cur = c.map(s => s.trim()); recs.push({ cells: cur }); }
        else c.forEach((s, i) => { if (s.trim()) cur[i] = cur[i] + (cur[i] && /[A-Za-z0-9]$/.test(cur[i]) && /^[A-Za-z0-9]/.test(s.trim()) ? ' ' : '') + s.trim(); });
      }
    }
    return recs;
  }

  // 立法院決議辦理情形報告表：項次｜內容｜辦理情形
  async function import41(doc, from, to) {
    return columns(doc, from, to, [24.0, 43.9, 115.0, 192], {
      top: 58.5, bottom: 280, skip: /^(決議、附帶決議|辦理情形|項次內容)/,
      section: c => /^[壹貳參肆伍陸柒捌玖拾]、/.test(c[0].trim()) && !c[2].trim() && c.join('').length < 30,
      isStart: c => /^(\(|（)[一二三四五六七八九十]+(\)|）)|^[一二三四五六七八九十]+、/.test(c[1].trim())
    });
  }

  // 總說明：文字段落＋施政計畫分項表
  async function importSummary(doc, from, to) {
    const paras = []; const tables = [];
    let mode = 'text', tableName = '';
    for (let p = from; p <= to; p++) {
      const { lines } = await pageLines(doc, p);
      const isTablePage = lines.some(l => /工作計畫名稱/.test(flat(l.text)) && /重要計畫項目/.test(flat(l.text)));
      if (!isTablePage) {
        for (const l of lines) {
          const t = l.text.trim(); const f = flat(t);
          if (!f || /^\d{1,3}$/.test(f) || /^(行政院主計總處|總說明|中華民國\d+年度)$/.test(f)) continue;
          const start = /^([一二三四五六七八九十]+、|\([一二三四五六七八九十]+\)|（[一二三四五六七八九十]+）|\d+\.(?!\d)|\(\d+\)|[IVX]+\.)/.test(t);
          if (!paras.length || start) paras.push(t); else paras[paras.length - 1] += t;
        }
      } else {
        const nameLine = lines.find(l => /施政計畫分項說明/.test(flat(l.text)));
        if (nameLine) { tableName = flat(nameLine.text); paras.push(nameLine.text.trim()); }
        const recs = await columns(doc, p, p, [15.5, 43.5, 76.0, 121.0, 178.6, 199], {
          top: (lines.find(l => /因應改善|措施/.test(flat(l.text))) || { y: 40 }).y + 2.5, bottom: 280,
          skip: /^(辦理情形|工作計畫名稱|已完成或未完成之說明|措施|\d{1,3})$/,
          isStart: c => /^[一二三四五六七八九十]+、/.test(c[2].trim()) || /^[一二三四五六七八九十]+、/.test(c[0].trim())
        });
        let T = tables.find(t => t.name === tableName);
        if (!T) { T = { name: tableName || '施政計畫分項說明', rows: [] }; tables.push(T); }
        // 跨頁續寫：若本頁第一筆不是新項目，接到上一筆
        recs.forEach((r, i) => {
          if (!r.cells) return;
          const prev = T.rows[T.rows.length - 1];
          if (i === 0 && prev && !/^[一二三四五六七八九十]+、/.test(r.cells[2]) && !r.cells[0]) r.cells.forEach((s, k) => { if (s) prev[k] += s; });
          else T.rows.push(r.cells);
        });
        // 承接上一筆的工作計畫名稱
        let last = ''; T.rows.forEach(r => { if (r[0]) last = r[0]; else r[0] = last; });
      }
    }
    return { paras, tables };
  }

  return { pageLines, scan, import41, importSummary };
});
