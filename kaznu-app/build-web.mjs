// Собирает www/: интерфейс из kaznu-test + backend.js (логика сайта и нативные плагины) одним файлом.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('www', { recursive: true });
await copyFile('../kaznu-test/index.html', 'www/index.html');
await copyFile('../kaznu-test/i18n.js', 'www/i18n.js');
await copyFile('../kaznu-test/design.js', 'www/design.js');
await copyFile('../kaznu-test/lock.js', 'www/lock.js');
await build({
  entryPoints: ['src/backend.js'], bundle: true, format: 'iife', platform: 'browser',
  target: 'chrome100', outfile: 'www/backend.js', minify: true, legalComments: 'none',
  // вместо cheerio — лёгкая прослойка над встроенным разборщиком HTML (быстрее, бандл в разы меньше)
  alias: { cheerio: './src/cheerio-dom.js' },
});
console.log('www готов');
