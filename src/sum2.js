/* 總說明：依 113 年度定稿句型，以（編修後）系統數值產生草稿 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinalSum = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const flat = s => (s == null ? '' : String(s)).replace(/[\s　ˉ]/g, '');
  const num = v => { if (typeof v === 'number') return v; const t = String(v == null ? '' : v).replace(/,/g, '').trim(); if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null; return Number(t); };
  const f0 = v => Math.round(v || 0).toLocaleString('en-US');
  const pct = (a, b) => (b ? (Math.round(a / b * 10000) / 100).toFixed(2).replace(/\.00$/, '') : '0');
  const nm = v => { const s = String(v || '').replace(/ˉ/g, '').trim(); const m = s.match(/^(\d{4,10}(?:-\d)?\*?)\s*\n?\s*([\s\S]+)$/); return m ? { code: m[1], name: m[2].replace(/\s+/g, '') } : { code: '', name: s.replace(/\s+/g, '') }; };
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function gen(XLSX, sys) {
    const G = k => (sys[k] ? XLSX.utils.sheet_to_json(sys[k].ws, { header: 1, raw: true, defval: null, blankrows: true }) : null);
    const g1 = G('1'), g3 = G('3'), g5 = G('5'), g9 = G('9'), g20 = G('20');
    const P = [];
    P.push('一、財務報告之簡述', '(一)本年度');
    // 歲入
    if (g1) {
      let tot = null; const subs = [];
      g1.forEach(r => { if (!r) return; if (/^合計$/.test(flat(r[4]))) tot = r; else if (flat(r[2]) && !flat(r[3])) { const n = nm(r[4]); subs.push(n.name + f0(num(r[8])) + '元'); } });
      if (tot) P.push(`1.歲入部分：本年度歲入預算數${f0(num(tot[7]))}元，執行結果，決算實現數${f0(num(tot[8]))}元，占預算數之${pct(num(tot[8]), num(tot[7]))}%，包括${subs.join('、')}，均已全部解繳國庫。`);
    }
    // 歲出
    if (g3) {
      let unit = null, inUnit = false; const plans = []; const pools = [];
      for (let i = 0; i < g3.length; i++) {
        const r = g3[i] || [], r2 = g3[i + 1] || [];
        const n = nm(r[4]);
        if (flat(r[1]) && n.code) { unit = { r, r2, name: n.name }; inUnit = true; continue; }
        if (inUnit && flat(r[2]) && n.code) plans.push({ n, r, r2, items: [] });
        else if (inUnit && flat(r[3]) && n.code && plans.length) plans[plans.length - 1].items.push({ n, r, r2 });
        else if (flat(r[0]) && n.code && !/主管$/.test(n.name)) { inUnit = false; pools.push({ n, r, r2 }); }
      }
      const line = (label, o) => {
        const bud = num(o.r[9]) || 0, real = num(o.r[10]) || 0, keep = num(o.r[11]) || 0, all = num(o.r2[11]) || (real + keep), left = bud - all;
        return `${label}：預算數${f0(bud)}元，執行結果，決算實現數${f0(real)}元，` + (keep ? `保留數${f0(keep)}元，合共${f0(all)}元，` : '') + `占預算數${pct(all, bud)}%，` + (Math.abs(left) < 0.5 ? '無賸餘數。' : `賸餘數${f0(left)}元。`);
      };
      if (unit) {
        const bud = num(unit.r[9]) || 0, real = num(unit.r[10]) || 0, keep = num(unit.r[11]) || 0, all = num(unit.r2[11]) || (real + keep);
        P.push(`2.歲出部分：本年度歲出預算數${f0(bud)}元(不含統籌科目)，執行結果，決算實現數${f0(real)}元，保留數${f0(keep)}元，合共${f0(all)}元，占預算數${pct(all, bud)}%，賸餘數${f0(bud - all)}元。依各工作計畫分述如下：`);
        let k = 1;
        plans.forEach(p => {
          if (p.items.length) { P.push(`(${k++})${p.n.name}`); p.items.forEach((it, j) => P.push(line(`${ROMAN[j] || j + 1}. ${it.n.name}`, it))); }
          else P.push(line(`(${k++})${p.n.name}`, p));
        });
        if (pools.length) {
          P.push(`(${k++})統籌科目`);
          pools.forEach((o, j) => {
            const real = num(o.r[10]) || 0; let pay = null;
            if (g9) { const code = o.n.code.slice(0, 10); g9.forEach(x => { if (x && flat(x[0]).indexOf(code) === 0) pay = num(x[9]); }); }
            P.push(`${ROMAN[j] || j + 1}. ${o.n.name}：庫撥數${f0(pay == null ? real : pay)}元，` + (pay == null || Math.abs(pay - real) < 0.5 ? '與決算實現數相符。' : `決算實現數${f0(real)}元。`));
          });
        }
      }
    }
    // 以前年度
    P.push('(二)以前年度');
    if (g5) {
      const rows = [];
      for (let i = 0; i < g5.length; i++) { const r = g5[i] || [], r2 = g5[i + 1] || []; const n = nm(r[5]); if (flat(r[3]) && n.code) { const s = c => (num(r[c]) || 0) + (num(r2[c]) || 0); rows.push({ n, inn: s(6), cancel: s(7), real: s(8), open: s(10) }); } }
      if (!rows.length) P.push('本年度無以前年度轉入數。');
      rows.forEach((x, i) => P.push(`${i + 1}. ${x.n.name}：保留${f0(x.inn)}元，執行結果，決算實現數${f0(x.real)}元` + (x.cancel ? `，減免(註銷)數${f0(x.cancel)}元` : '') + (x.open ? `，尚未結清數${f0(x.open)}元` : '') + '。'));
    }
    // 平衡表
    const bs = { groups: [], net: null };
    if (g20) {
      let cur = { L: null, R: null };
      g20.forEach(r => {
        if (!r) return;
        [[0, 1, 2, 'L'], [3, 4, 5, 'R']].forEach(([lc, a, b, side]) => {
          const lab = String(r[lc] || '').replace(/\s*\n\s*/g, '').trim(); const v = num(r[a]), pv = num(r[b]);
          const f = flat(lab); if (!f || v == null) return;
          if (/^\d{2}[^\d]/.test(f)) { cur[side] = { code: f.slice(0, 2), name: f.slice(2), v, pv, side, items: [] }; bs.groups.push(cur[side]); }
          else if (/^(減：)?\d{6}/.test(f) && cur[side]) cur[side].items.push({ name: f.replace(/^減：/, '').replace(/^\d{6}/, '').replace(/^累計折舊─/, '累計折舊─'), minus: /^減：/.test(f), v, pv });
          else if (/^3淨資產$/.test(f)) bs.net = { v, pv };
        });
      });
      P.push('(三)平衡表重要科目之金額及內容');
      const sec = (title, side, start) => {
        P.push(title); let k = 1;
        bs.groups.filter(g => g.side === side && !/資產負債淨額/.test(g.name)).forEach(g => {
          const its = g.items.filter(i => !i.minus);
          const body = its.length > 1 ? '，包括' + its.map(i => `${i.name}${f0(i.v)}元`).join('、') : (its.length ? `，係${its[0].name}` : '');
          P.push(`(${k++})${g.name}總額${f0(g.v)}元${body}。`);
        });
      };
      sec('1.資產', 'L'); sec('2.負債', 'R');
      if (bs.net) P.push(`3.淨資產：淨資產總額${f0(bs.net.v)}元，係資產減除負債後之餘額。`);
      // 二、財務狀況之分析
      P.push('二、財務狀況之分析');
      const ana = (title, side) => {
        P.push(title); let k = 1;
        bs.groups.filter(g => g.side === side && !/資產負債淨額/.test(g.name)).forEach(g => {
          const hits = g.items.filter(i => { const d = i.v - i.pv; return Math.abs(d) >= 5e8 || (i.pv ? Math.abs(d / i.pv) >= 0.2 : i.v !== 0); });
          const allZero = g.items.every(i => i.v === i.pv);
          const head = `${k++}. ${g.name}：`;
          if (!hits.length) P.push(head + (allZero ? '本年度較上年度金額無變動。' : '本年度較上年度金額變動未達 20%。'));
          else P.push(head + hits.map(i => { const d = i.v - i.pv; return `${i.minus ? '減：' : ''}${i.name}${f0(i.v)}元，較上年度${d >= 0 ? '增加' : '減少'}${f0(Math.abs(d))}元或${i.pv ? Math.abs(Math.round(d / i.pv * 10000) / 100).toFixed(2) : '—'}%，主要係（請填原因）。`; }).join(''));
        });
      };
      ana('(一)資產', 'L'); ana('(二)負債', 'R');
    }
    return P;
  }

  return { gen };
});
