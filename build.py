"""把 src/ 的程式與 vendor/ 的元件組成單一離線 HTML（index.html）。
用法：python3 build.py
"""
import re, json
def rd(p): return open(p, encoding='utf-8').read()
def safe(js): return js.replace('</script', '<\\/script').replace('<!--', '<\\!--')
v1 = rd('src/shell-v1-parts.html')
css1 = v1[v1.index('<style>') + 7:v1.index('</style>')]
f7html = v1[v1.index('    <!-- 步驟 7 -->'):v1.index('  </div>\n</div>\n\n<!-- ================= SOP')]
f7html = f7html.replace('data-step="7"', 'data-step="8"').replace('步驟七　格式', '步驟八　格式').replace('data-back="5"', 'data-back="7"')
js1 = v1[v1.index('// ---- step 7：格式 1～5 ----'):v1.index('\ngo(1);\n})();')]
js1 = js1.replace("$('#to7').onclick = open7; $('#to7b').onclick = open7;", "$('#to7').onclick = () => enter(8);")
js1 = re.sub(r"const dl = .*\n", "", js1)
js1 = re.sub(r"\$\$\('#stepper li\[data-step=\"7\"\]'\).*\n", "", js1)
js1 = js1.replace('go(7)', 'go(8)').replace('confirmStep(7', 'confirmStep(8').replace('S.an,', 'S.anE,').replace('S.an.', 'S.anE.').replace('S.an)', 'S.anE)')
js1 = js1.replace("F7.S = FinalFmt.defaults(F7.D); F7.ok = {};", "F7.S = FinalFmt.defaults(F7.D); F7.ok = {}; fillToc();")
js1 += '''
function fillToc(){ // 用列印版面實際頁數帶入目次
  if (!S.book || !F7.S || !F7.S.f3) return; const st = S.book.starts; const f3 = F7.S.f3;
  f3.start = ctx().startPage; if (st['0']) f3.summaryPages = st['0'].count;
  f3.items.forEach(it => { let s = st[it.no]; if (!s) { const k = Object.keys(st).find(k => k.startsWith('22-36:') && it.title && it.title.indexOf(k.slice(6)) >= 0); s = k && st[k]; } if (s) it.pages = s.count; });
}
'''
assert 'fillToc();' in js1 and 'S.an ' not in js1
h = rd('src/shell.html')
h = h.replace('/*__CSS1__*/', css1).replace('<!--__F7HTML__-->', f7html).replace('/*__F7JS__*/', js1)
spec = json.dumps(json.load(open('src/spec2.json', encoding='utf-8')), ensure_ascii=False)
core = '\n'.join(rd('src/' + f) for f in ['core.js', 'pub.js', 'fmt.js', 'model2.js', 'pdfimp.js', 'sum2.js', 'render2.js'])
rep = {'/*__SPEC__*/': spec.replace('</', '<\\/'), '/*__XLSX__*/': rd('vendor/xlsx-0.20.3.full.min.js'), '/*__EXCELJS__*/': rd('vendor/exceljs.custom.min.js'),
       '/*__PDFJS__*/': rd('vendor/pdf.min.js'), '/*__PDFWORKER__*/': rd('vendor/pdf.worker.min.js'), '/*__CORE__*/': core}
for k, v in rep.items():
    assert k in h, k
    h = h.replace(k, v if k == '/*__SPEC__*/' else safe(v))
open('index.html', 'w', encoding='utf-8').write(h)
print('index.html', len(h) // 1024, 'KB')
# 簡易版：只處理上傳的書表（格式編修 → 內容編修 → 列印版面／Excel）
hs = h.replace('<script id="spec2"', '<script>window.__SIMPLE__ = true;</script>\n<script id="spec2"', 1)
hs = hs.replace('<title>決算書表編製工具（整合版）</title>', '<title>決算書表編製工具（簡易版）</title>', 1)
assert '__SIMPLE__ = true' in hs
open('simple.html', 'w', encoding='utf-8').write(hs)
print('simple.html', len(hs) // 1024, 'KB')
