import * as esbuild from 'esbuild';
import path from 'path';
const stub = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /csv\/csv$/ }, () => ({ path: path.resolve('stub-csv.js') }));
    b.onResolve({ filter: /^(fs|tmp|archiver|unzipper|zlib|crypto|path|os)$/ }, () => ({ path: path.resolve('empty.js') }));
    b.onResolve({ filter: /^stream$/ }, () => ({ path: path.resolve('node_modules/readable-stream/readable-browser.js') }));
    b.onResolve({ filter: /^events$/ }, () => ({ path: path.resolve('node_modules/events/events.js') }));
    b.onResolve({ filter: /^buffer$/ }, () => ({ path: path.resolve('node_modules/buffer/index.js') }));
    b.onResolve({ filter: /^(util|string_decoder)$/ }, a => ({ path: path.resolve('empty.js') }));
  }
};
const r = await esbuild.build({
  entryPoints: ['entry-exceljs.js'], bundle: true, minify: true, format: 'iife', platform: 'browser',
  target: ['es2019'], outfile: 'exceljs.custom.min.js', plugins: [stub], inject: ['shim.js'],
  define: { global: 'globalThis' }, metafile: true, legalComments: 'none'
});
const fs = await import('fs');
fs.writeFileSync('meta.json', JSON.stringify(r.metafile));
console.log('ok', fs.statSync('exceljs.custom.min.js').size);
