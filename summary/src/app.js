(function () {
  'use strict';
  const E = window.SumEngine, $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (window.pdfjsLib) { try { pdfjsLib.GlobalWorkerOptions.workerSrc = ''; } catch (e) { } }
  const ST = { pdf: null, priorDesc: {}, files: {}, sys: {}, X: null, E: null, G: null };

  /* ---------- 步驟切換 ---------- */
  function go(n) {
    if (n >= 3 && !ST.X) n = 2;
    document.querySelectorAll('section.step').forEach(s => s.hidden = s.id !== 's' + n);
    document.querySelectorAll('nav.steps button').forEach(b => { if (b.dataset.step == n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    if (n === 3) render3(); if (n === 4) render4(); if (n === 5) render5();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('nav.steps button').forEach(b => b.addEventListener('click', () => go(+b.dataset.step)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => go(+b.dataset.goto)));
  const done = n => { const b = document.querySelector(`nav.steps button[data-step="${n}"]`); if (b) b.classList.add('done'); };

  function dropZone(el, cb) {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', async e => {
      e.preventDefault(); el.classList.remove('over');
      const out = []; const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      if (items.length) {
        const walk = ent => new Promise(res => {
          if (ent.isFile) ent.file(f => { out.push(f); res(); });
          else { const rd = ent.createReader(); const all = []; const next = () => rd.readEntries(es => { if (!es.length) Promise.all(all.map(walk)).then(res); else { all.push(...es); next(); } }); next(); }
        });
        await Promise.all(items.map(walk));
      } else out.push(...e.dataTransfer.files);
      cb(out);
    });
  }
  function save(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  /* ---------- 步驟 1：PDF ---------- */
  async function loadPdf(file) {
    const msg = $('#pdfMsg'); msg.hidden = false; msg.className = 'msg'; msg.textContent = '讀取中…';
    try {
      const pages = await PdfRef.readPdf(new Uint8Array(await file.arrayBuffer()), window.CMAPS, (p, n) => { msg.textContent = `讀取中… ${p}/${n} 頁`; });
      const A = PdfRef.analyze(pages);
      if (A.error) { msg.className = 'msg warn'; msg.textContent = A.error; return; }
      ST.pdf = A; ST.pdf.file = file.name; ST.priorDesc = E.priorDescFromText(A.part12);
      msg.textContent = `已讀取「${file.name}」，共 ${pages.length} 頁。總說明在 PDF 第 ${A.sumFrom}～${A.sumTo} 頁（印刷頁碼＝PDF 頁－${A.offset}）。`;
      renderPdf(); done(1);
    } catch (err) { msg.className = 'msg warn'; msg.textContent = '無法讀取 PDF：' + err.message; }
  }
  function renderPdf() {
    const A = ST.pdf; $('#pdfOut').hidden = false;
    const found = A.nums.filter(n => n.hits.length).length;
    $('#pdfStats').innerHTML = [[A.nums.length, '總說明數字'], [found, '在書表中找到'], [A.nums.length - found, '未直接出現（計算值）'], [Object.keys(ST.priorDesc).length, '擷取科目內容說明']]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    $('#pdfTbl').innerHTML = '<thead><tr><th>序</th><th>總說明段落</th><th>前後文</th><th class="n">數值</th><th>出現書表（印刷頁／PDF頁）</th><th>該列</th></tr></thead><tbody>' +
      A.nums.map((n, i) => {
        const h = n.hits;
        const t = h.length ? h.map(x => `${esc(x.table || '（未對到目次）')} <span class="muted small">p.${x.printed}／PDF ${x.pdf}</span>`).join('<br>') : '<span class="pill mute">未直接出現</span>';
        const l = h.map(x => esc(x.label || x.line)).join('<br>');
        return `<tr><td>${i + 1}</td><td>${esc(n.sec)}</td><td>${esc(n.ctx)}</td><td class="n">${esc(n.val)}${n.kind === '%' ? '%' : ''}</td><td>${t}</td><td class="small">${l}</td></tr>`;
      }).join('') + '</tbody>';
    $('#tocTbl').innerHTML = '<thead><tr><th>表名</th><th class="n">印刷頁</th><th class="n">PDF 頁</th></tr></thead><tbody>' +
      A.toc.entries.map(e => `<tr><td>${esc(e.name)}</td><td class="n">${e.from}${e.to !== e.from ? '－' + e.to : ''}</td><td class="n">${e.from + A.offset}${e.to !== e.from ? '－' + (e.to + A.offset) : ''}</td></tr>`).join('') + '</tbody>';
    $('#pdfText').innerHTML = esc(A.part12).replace(/(\(\d+\)|[一二三]、)/g, '<br>$1');
  }
  $('#pdfIn').addEventListener('change', e => { if (e.target.files[0]) loadPdf(e.target.files[0]); });
  dropZone($('#pdfDrop'), fs => { const f = fs.find(x => /\.pdf$/i.test(x.name)); if (f) loadPdf(f); });
  $('#pdfXlsx').addEventListener('click', () => {
    const A = ST.pdf; const rows = [['序', '總說明段落', '前後文', '數值', '類別', '書表', '印刷頁', 'PDF頁', '該列（列名）', '該列文字']];
    A.nums.forEach((n, i) => { if (!n.hits.length) rows.push([i + 1, n.sec, n.ctx, n.val, n.kind, '未直接出現（計算值）', '', '', '', '']); n.hits.forEach(h => rows.push([i + 1, n.sec, n.ctx, n.val, n.kind, h.table, h.printed, h.pdf, h.label, h.line])); });
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [6, 24, 24, 16, 6, 30, 8, 8, 30, 60].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, '總說明參考位置');
    const t = [['表名', '印刷起頁', '印刷迄頁', 'PDF起頁', 'PDF迄頁']].concat(A.toc.entries.map(e => [e.name, e.from, e.to, e.from + A.offset, e.to + A.offset]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t), '目次');
    save('總說明參考書表位置.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  /* ---------- 步驟 2：系統產製表件 ---------- */
  async function loadXls(files) {
    const list = files.filter(f => /\.xlsx?$/i.test(f.name));
    for (const f of list) {
      try {
        const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: true });
        const c = E.classify(f.name, rows);
        ST.files[f.name] = { file: f.name, rows, ...c, used: false };
      } catch (err) { ST.files[f.name] = { file: f.name, error: err.message }; }
    }
    pickSys(); renderFiles();
  }
  function pickSys() {
    ST.sys = {}; const years = {};
    Object.values(ST.files).forEach(f => { f.used = false; if (f.year) years[f.year] = (years[f.year] || 0) + 1; });
    const yr = +$('#year').value || +Object.keys(years).sort((a, b) => years[b] - years[a])[0] || null;
    if (yr && !$('#year').value) $('#year').value = yr;
    Object.values(ST.files).forEach(f => {
      if (!f.no || !E.TABLES[f.no] || f.error) return; if (yr && f.year && f.year !== yr) return;
      const cur = ST.sys[f.no]; if (!cur || (f.stamp || '') > (cur.stamp || '')) ST.sys[f.no] = f;
    });
    Object.values(ST.sys).forEach(f => f.used = true);
    if (!$('#agency').value && ST.sys['1']) {
      const t = ST.sys['1'].rows.slice(0, 3).map(r => (r || []).map(E.flat).join('')).join('');
      const m = t.match(/^(.*?)歲入來源/); if (m && m[1]) $('#agency').value = m[1];
    }
  }
  function renderFiles() {
    const rows = Object.keys(E.TABLES).map(no => {
      const t = E.TABLES[no], f = ST.sys[no];
      return `<tr><td class="n">${no}</td><td>${esc(t.name)}</td><td>${t.need ? '必要' : '選用'}</td><td class="small">${f ? esc(f.file) : '—'}</td><td>${f ? '<span class="pill ok">已載入</span>' : (t.need ? '<span class="pill bad">缺少</span>' : '<span class="pill mute">未載入</span>')}</td></tr>`;
    });
    const others = Object.values(ST.files).filter(f => !f.used).map(f => `<tr><td class="n">${f.no || ''}</td><td colspan="2" class="muted">${f.error ? '讀取失敗：' + esc(f.error) : (f.no && E.TABLES[f.no] ? '同表號較舊或年度不同，未採用' : '總說明不需要此表')}</td><td class="small">${esc(f.file)}</td><td><span class="pill mute">略過</span></td></tr>`);
    $('#fileTbl').innerHTML = '<thead><tr><th class="n">表號</th><th>表名</th><th>需要性</th><th>採用檔案</th><th>狀態</th></tr></thead><tbody>' + rows.join('') + others.join('') + '</tbody>';
    const miss = Object.keys(E.TABLES).filter(no => E.TABLES[no].need && !ST.sys[no]);
    const w = $('#xlsWarn'); w.hidden = !miss.length || !Object.keys(ST.files).length;
    w.textContent = miss.length ? '缺少必要表件：' + miss.map(n => n + ' ' + E.TABLES[n].name).join('、') + '。仍可擷取，但相關段落不會產生。' : '';
    $('#go3').disabled = !Object.keys(ST.sys).length;
  }
  $('#xlsIn').addEventListener('change', e => loadXls([...e.target.files]));
  $('#dirIn').addEventListener('change', e => loadXls([...e.target.files]));
  dropZone($('#xlsDrop'), loadXls);
  $('#year').addEventListener('change', () => { pickSys(); renderFiles(); });
  $('#go3').addEventListener('click', () => {
    const sys = {}; Object.keys(ST.sys).forEach(k => sys[k] = { rows: ST.sys[k].rows, file: ST.sys[k].file });
    ST.X = E.extract(sys); ST.E = E.defaults(ST.X, opts()); done(2); go(3);
  });
  const opts = () => ({ year: +$('#year').value || 0, agency: $('#agency').value.trim(), threshold: +$('#th').value || 20, priorDesc: ST.priorDesc });
  $('#th').addEventListener('change', () => { if (ST.X) regen(); });
  $('#agency').addEventListener('change', () => { if (ST.X) regen(); });
  function regen() { ST.G = E.generate(ST.X, ST.E, opts()); return ST.G; }

  /* ---------- 步驟 3 ---------- */
  function render3() {
    const G = regen(); const ck = E.checks(ST.X); const bad = ck.filter(c => !c.ok).length;
    $('#ckStats').innerHTML = [[G.refs.length, '引用數字'], [ck.length - bad, '檢核相符'], [bad, '檢核不符'], [G.todo.length, '待補充文字']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('') +
      (ST.X.warn.length ? `<div class="msg warn" style="flex-basis:100%">${ST.X.warn.map(esc).join('<br>')}</div>` : '');
    $('#ckTbl').innerHTML = '<thead><tr><th>檢核項目</th><th class="n">左式</th><th class="n">右式</th><th>結果</th><th>資料來源</th></tr></thead><tbody>' +
      ck.map(c => `<tr><td>${esc(c.name)}</td><td class="n">${E.N(c.a)}</td><td class="n">${E.N(c.b)}</td><td>${c.ok ? '<span class="pill ok">相符</span>' : '<span class="pill bad">不符</span>'}</td><td class="small">${esc(c.note)}</td></tr>`).join('') + '</tbody>';
    $('#refTbl').innerHTML = '<thead><tr><th>序</th><th>段落</th><th>項目</th><th class="n">數值</th><th>來源書表</th><th>儲存格：列 × 欄</th><th>計算方式</th></tr></thead><tbody>' +
      G.refs.map((r, i) => `<tr><td>${i + 1}</td><td class="small">${esc(r.sec)}</td><td>${esc(r.item)}</td><td class="n">${esc(r.val)}</td><td class="small">${r.src.map(s => esc(s.table)).join('<br>')}</td><td class="small">${r.src.map(s => `<span class="mono">${esc(s.cell)}</span> ${esc(s.row)} × ${esc(s.col)}（${E.N(s.value)}）`).join('<br>')}</td><td class="small">${esc(r.how)}</td></tr>`).join('') + '</tbody>';
    done(3);
  }

  /* ---------- 步驟 4 ---------- */
  function previewHtml(G) {
    return G.doc.map(b => {
      if (b.t === 'title') return `<p class="t">${esc(b.s)}</p>`;
      if (b.t === 'sub') return `<p class="s">${esc(b.s)}</p>`;
      if (b.t === 'h1') return `<p class="h1">${esc(b.s)}</p>`;
      if (b.t === 'h2') return `<p class="h2">${esc(b.s)}</p>`;
      return `<p class="i${b.indent}">${b.runs.map(([k, t]) => k === 'h' ? `<mark>${esc(t)}</mark>` : esc(t)).join('')}</p>`;
    }).join('');
  }
  function render4() {
    const X = ST.X, D = ST.E, f = []; const info = X.info;
    const area = (id, val, rows) => `<textarea data-k="${id}" rows="${rows || 3}">${esc(val)}</textarea>`;
    if (info.exp) {
      const all = []; info.exp.plans.forEach(p => { if (p.items.length) p.items.forEach(i => all.push(i)); else all.push(p); });
      const resP = all.filter(p => X.V[p.key + '_res']);
      if (resP.length) {
        f.push('<h3>保留原因（自歲出保留分析表摘要）</h3>');
        resP.forEach(p => {
          const r = info.res && info.res[p.code];
          f.push(`<div class="fld"><span class="k">${esc(p.name)}　保留 ${E.N(X.V[p.key + '_res'])} 元</span>${area('reserve.' + p.code, D.reserve[p.code] || '')}` +
            (r ? `<details><summary>保留分析表原文（${r.reasons.length} 筆）</summary><div class="small">${r.reasons.map(x => `<p><span class="mono">${esc(x.cell)}</span> ${esc(x.type)} ${E.N(x.amt)} 元：${esc(x.text)}</p>`).join('')}</div></details>` : '') + '</div>');
        });
      }
      const r1 = all.filter(p => X.V[p.key + '_r1'] > 0);
      if (r1.length) {
        f.push('<h3>動支第一預備金用途</h3>');
        r1.forEach(p => f.push(`<div class="fld"><span class="k">${esc(p.name)}　動支 ${E.N(X.V[p.key + '_r1'])} 元</span><input type="text" data-k="r1.${p.code}" value="${esc(D.r1[p.code] || '')}" placeholder="例：辦理○○案所需經費（將接在「動支第一預備金係」之後）"></div>`));
      }
    }
    if (info.bs) {
      f.push('<h3>平衡表科目內容說明</h3><p class="small muted">預設' + (Object.keys(ST.priorDesc).length ? '取自上年度 PDF 總說明，其餘' : '') + '沿用 113 年度文字。以「係」開頭。</p>');
      info.bs.groups.filter(g => /^[12]/.test(g.code)).forEach(g => g.accts.filter(a => X.V[a.key] || (a.dep && X.V[a.dep])).forEach(a =>
        f.push(`<div class="fld"><span class="k">${esc(a.name)}</span><input type="text" data-k="desc.${esc(a.name)}" value="${esc(D.desc[a.name] || '')}"></div>`)));
      regen();
      const flagged = (ST.G.variance || []).filter(v => v.flag === '須說明');
      f.push(`<h3>平衡表變動原因（門檻 ${opts().threshold}%）</h3>`);
      info.bs.groups.filter(g => /^[12]/.test(g.code)).forEach(g => {
        f.push(`<div class="fld"><span class="k">${esc(g.name)}　比較層級</span><select data-k="lv.${g.code}"><option value="acct"${D.varLevel[g.code] !== 'group' ? ' selected' : ''}>逐科目</option><option value="group"${D.varLevel[g.code] === 'group' ? ' selected' : ''}>科目群總額</option></select></div>`);
      });
      if (!flagged.length) f.push('<p class="small muted">本年度無須說明之變動。</p>');
      flagged.forEach(v => {
        const a = info.bs.groups.flatMap(g => g.accts).find(x => v.name.replace('(淨額)', '') === x.name) || info.bs.groups.find(g => g.name === v.name);
        if (!a) return;
        f.push(`<div class="fld"><span class="k">${esc(v.name)}　${v.d > 0 ? '增加' : '減少'} ${E.N(Math.abs(v.d))} 元${v.p === null ? '' : `（${Math.abs(v.p).toFixed(2)}%）`}</span>${area('why.' + a.code, D.varWhy[a.code] || '', 2)}<span class="src">預設句依變動表增加數、減少數、折舊變動數產生；保持原樣時 Word 會標註「請確認」。</span></div>`);
      });
    }
    f.push('<h3>三、重要施政計畫執行成果之說明</h3>');
    f.push(`<div class="fld">${area('part3', D.part3, 8)}<span class="src">每行一段。</span>${ST.pdf && ST.pdf.part3 ? '<div class="row"><button class="btn" type="button" id="usePrior3">帶入上年度文字作為範本</button></div>' : ''}</div>`);
    $('#editForm').innerHTML = f.join('');
    const upd = el => {
      const [grp, ...rest] = el.dataset.k.split('.'); const key = rest.join('.');
      if (grp === 'reserve') D.reserve[key] = el.value; else if (grp === 'r1') D.r1[key] = el.value; else if (grp === 'desc') D.desc[key] = el.value;
      else if (grp === 'why') D.varWhy[key] = el.value; else if (grp === 'lv') { D.varLevel[key] = el.value; render4(); return; } else if (grp === 'part3') D.part3 = el.value;
      $('#preview4').innerHTML = previewHtml(regen());
    };
    $('#editForm').querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => upd(el)));
    const b = $('#usePrior3'); if (b) b.addEventListener('click', () => { const t = $('#editForm [data-k="part3"]'); t.value = ST.pdf.part3; upd(t); });
    $('#preview4').innerHTML = previewHtml(regen()); done(4);
  }

  /* ---------- 步驟 5 ---------- */
  function render5() {
    const G = regen(); $('#preview5').innerHTML = previewHtml(G);
    const m = $('#todoMsg'); m.hidden = !G.todo.length; m.innerHTML = G.todo.length ? `尚有 ${G.todo.length} 處待補充（Word 中以黃底紅字標示）：<br>` + G.todo.map((t, i) => `${i + 1}. ${esc(t)}`).join('<br>') : '';
  }
  const fname = s => `${opts().year || ''}年度${s}`;
  $('#dl1').addEventListener('click', () => { save(fname('總說明.docx'), E.summaryDocx(regen()), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); done(5); });
  $('#dl2').addEventListener('click', () => { const G = regen(); save(fname('總說明_數字來源說明.docx'), E.sourceDocx(G, ST.X, opts()), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); });
  $('#dl3').addEventListener('click', () => {
    const G = regen(); const rows = [['序', '段落', '項目', '總說明數值', '來源書表', '來源檔案', '儲存格', '列', '欄', '書表值', '計算方式']];
    G.refs.forEach((r, i) => r.src.forEach((s, j) => rows.push([j ? '' : i + 1, j ? '' : r.sec, j ? '' : r.item, j ? '' : r.val, s.table, s.file, s.cell, s.row, s.col, s.value, j ? '' : r.how])));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [5, 22, 28, 16, 26, 40, 8, 30, 26, 16, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, '數字來源');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['檢核項目', '左式', '右式', '結果', '來源']].concat(E.checks(ST.X).map(c => [c.name, c.a, c.b, c.ok ? '相符' : '不符', c.note]))), '表間檢核');
    save(fname('總說明_數字來源.xlsx'), XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  go(1);
})();
