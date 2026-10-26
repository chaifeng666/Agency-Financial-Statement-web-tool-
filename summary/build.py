"""建置「總說明產生工具」單一 HTML：python summary/build.py → summary-tool.html"""
import json, base64, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
cm = {os.path.basename(f)[:-6]: base64.b64encode(open(f, 'rb').read()).decode() for f in sorted(glob.glob(os.path.join(ROOT, 'vendor/pdfjs-cmaps/*.bcmap')))}
html = rd('summary/src/shell.html')
for k, v in {'/*__XLSX__*/': rd('vendor/xlsx-0.20.3.full.min.js'), '/*__PDFJS__*/': rd('vendor/pdf.min.js'), '/*__PDFWORKER__*/': rd('vendor/pdf.worker.min.js'),
             '/*__CMAPS__*/': json.dumps(cm), '/*__ENGINE__*/': rd('summary/src/engine.js'), '/*__PDFREF__*/': rd('summary/src/pdfref.js'), '/*__APP__*/': rd('summary/src/app.js')}.items():
    assert k in html, k
    html = html.replace(k, v.replace('</script', '<\\/script'))
out = os.path.join(ROOT, 'summary-tool.html'); open(out, 'w', encoding='utf-8').write(html)
print(out, len(html) // 1024, 'KB,', len(cm), 'CMaps')
