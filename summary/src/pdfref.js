/* 上年度決算書 PDF：擷取目次、總說明，找出總說明各數字在哪些書表出現 */
(function (root) {
  'use strict';
  const CJK = /[㐀-鿿]/;
  async function readPdf(buf, cmaps, onProgress) {
    class CMapFactory { async fetch({ name }) {
      const b64 = cmaps[name]; if (!b64) throw new Error('缺少 CMap：' + name);
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return { cMapData: u, compressionType: 1 };
    } }
    const doc = await pdfjsLib.getDocument({ data: buf, CMapReaderFactory: CMapFactory, disableFontFace: true, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p); const tc = await pg.getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || i.height || 10 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      items.forEach(it => {
        let L = lines.find(l => Math.abs(l.y - it.y) <= Math.max(2, it.h * 0.3));
        if (!L) { L = { y: it.y, items: [] }; lines.push(L); }
        L.items.push(it);
      });
      lines.forEach(L => {
        L.items.sort((a, b) => a.x - b.x); let t = '', end = null;
        L.items.forEach(it => { if (end !== null && it.x - end > it.h * 0.35) t += ' '; t += it.s; end = it.x + it.w; });
        L.text = t.replace(/\s+/g, ' ').trim();
      });
      lines.sort((a, b) => b.y - a.y);
      pages.push({ no: p, lines: lines.map(l => ({ y: l.y, text: l.text })) });
      if (onProgress) onProgress(p, doc.numPages);
    }
    return pages;
  }

  function parseToc(pages) {
    const tp = pages.find(p => p.lines.slice(0, 6).some(l => /目\s*次/.test(l.text)));
    if (!tp) return { page: null, entries: [] };
    const entries = [];
    tp.lines.forEach(l => {
      const t = l.text.replace(/\s+/g, '');
      const m = t.match(/^(?:[一二三四五六七八九十]+、)?(?:\([一二三四五]\))?(?:\d+\.)?(.+?)-{2,}(\d+)(?:[－\-–~～](\d+))?$/);
      if (m) entries.push({ name: m[1].replace(/^[\d.]+/, ''), from: +m[2], to: +(m[3] || m[2]) });
    });
    return { page: tp.no, entries };
  }

  function analyze(pages) {
    const toc = parseToc(pages);
    const sumEntry = toc.entries.find(e => /總說明/.test(e.name));
    let start = pages.findIndex(p => p.no !== toc.page && p.lines.slice(0, 5).some(l => /總\s*說\s*明/.test(l.text)));
    if (start < 0) return { error: '找不到「總說明」頁。', toc };
    const offset = pages[start].no - (sumEntry ? sumEntry.from : 1);
    const sumTo = sumEntry ? sumEntry.to + offset : pages[start].no;
    const sumPages = pages.filter(p => p.no >= pages[start].no && p.no <= sumTo);
    const fullText = sumPages.map(p => p.lines.filter(l => !/^\d{1,3}$/.test(l.text.trim())).map(l => l.text).join('')).join('').replace(/\s+/g, '');
    const cut = fullText.search(/三、重要施政計畫/);
    const part12 = cut > 0 ? fullText.slice(0, cut) : fullText;
    let part3 = cut > 0 ? fullText.slice(cut) : '';
    const c2 = part3.search(/\(二\)施政計畫分項說明/); if (c2 > 0) part3 = part3.slice(0, c2);
    part3 = part3.replace(/^三、重要施政計畫執行成果之說明/, '').replace(/(\([一二三四五六]\))/g, '\n$1').replace(/(\d{1,2}\.)(?=[^\d])/g, '\n$1').trim();

    const tableOf = printed => { const e = toc.entries.find(x => !/總說明/.test(x.name) && printed >= x.from && printed <= x.to); return e ? e.name : ''; };
    const tablePages = pages.filter(p => p.no > sumTo);
    const labelOf = (page, line) => {
      const cj = line.text.split(' ').filter(t => CJK.test(t)).join(' ');
      if (cj) return cj;
      const idx = page.lines.indexOf(line);
      for (let k = idx + 1; k < Math.min(page.lines.length, idx + 3); k++) { const t = page.lines[k].text.split(' ').filter(x => CJK.test(x)).join(' '); if (t && !/[\d,]{5,}/.test(page.lines[k].text)) return t; }
      const prev = pages.find(p => p.no === page.no - 1);
      if (prev) {
        let best = null; prev.lines.forEach(l => { const d = Math.abs(l.y - line.y); if (d < 4 && (!best || d < best.d)) best = { l, d }; });
        if (best) { const t = best.l.text.split(' ').filter(x => CJK.test(x) || /^\d{10}/.test(x.replace(/ˉ/g, ''))).join(' '); if (t) return t + '（左頁）'; }
      }
      return '';
    };
    const nums = []; const re = /(\d{1,3}(?:,\d{3})+|\d+)(?=元)|(\d+(?:\.\d+)?)(?=%)/g; let m;
    const secRe = /(\(\d+\)|[IVX]+\.|\d+\.|\([一二三四]\)|[一二三]、)([^\d，。；：(（]{2,18})/g;
    while ((m = re.exec(part12))) {
      const val = m[1] || m[2]; const kind = m[1] ? '元' : '%';
      if (kind === '元' && !/,/.test(val) && +val < 100) continue;
      const before = part12.slice(Math.max(0, m.index - 40), m.index);
      const ctx = (before.split(/[，。；：、)]/).pop() || '').replace(/[\d,]+元?$/, '').slice(-14);
      let sec = ''; secRe.lastIndex = 0; let s; const head = part12.slice(0, m.index);
      const from = Math.max(0, head.length - 400); const tail = head.slice(from); while ((s = secRe.exec(tail))) sec = (s[1] + s[2]).replace(/本年度.*$/, '');
      const esc = val.replace(/[.,]/g, x => '\\' + x);
      const rx = new RegExp('(^|[^\\d,.])' + esc + '(?![\\d,]|\\.\\d)');
      const hits = [];
      for (const pg of tablePages) {
        const ms = pg.lines.filter(ln => rx.test(ln.text));
        if (ms.length) {
          const ln = ms.find(l => /合\s*計|總\s*計/.test(l.text + labelOf(pg, l))) || ms[0];
          const printed = pg.no - offset; hits.push({ table: tableOf(printed), printed, pdf: pg.no, label: labelOf(pg, ln), line: ln.text.slice(0, 90) });
        }
        if (hits.length >= 6) break;
      }
      nums.push({ val, kind, ctx, sec, hits });
    }
    return { toc, offset, sumFrom: pages[start].no, sumTo, part12, part3, nums, fullText };
  }
  root.PdfRef = { readPdf, analyze };
})(typeof self !== 'undefined' ? self : this);
