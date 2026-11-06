// Drives the web-mobile build in headless Chrome: serves build/web-mobile, captures console errors and screenshots.
// Usage: node run.mjs <buildDir> <outDir> [steps.json]
// steps: [{ "wait": ms } | { "click": [x, y] } (design coords 853×1844) | { "drag": [[x1,y1],[x2,y2]] } | { "shot": "name" } | { "eval": "js" }]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [buildDir, outDir, stepsFile] = process.argv.slice(2);
const steps = stepsFile ? JSON.parse(fs.readFileSync(stepsFile, 'utf8')) : [{ wait: 8000 }, { shot: 'start' }];
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.cconb': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const file = path.join(buildDir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const W = 390, H = 844; // phone viewport; the game fits width, so 1 design px = W/853 css px
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const log = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn' || /^[(UI|Guide|Puzzle)]/.test(m.text())) { log.push(`[${m.type()}] ${m.text()}`); console.log(`[${m.type()}] ${m.text()}`); } });
page.on('pageerror', e => log.push('[pageerror] ' + e.message));
await page.goto(`http://localhost:${port}/index.html`);
const scale = W / 853;
const toCss = ([x, y]) => [x * scale, (y - 1844 / 2) * scale + H / 2]; // design y measured from top, canvas centered
for (const step of steps) {
  if (step.wait) await new Promise(r => setTimeout(r, step.wait));
  if (step.click) { const [x, y] = toCss(step.click); await page.touchscreen.tap(x, y); await new Promise(r => setTimeout(r, 600)); }
  if (step.dragEval) { try { step.drag = await page.evaluate(step.dragEval); } catch (e) { console.log("dragEval failed", e.message.slice(0, 200)); step.drag = null; } }
  if (step.drag) {
    const [a, b] = step.drag.map(toCss);
    const client = await page.target().createCDPSession();
    const touch = (type, p) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y: p[1] }] });
    await touch('touchStart', a);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10]);
    await touch('touchEnd', b);
    await new Promise(r => setTimeout(r, 600));
  }
  if (step.eval) { const r = '[eval] ' + JSON.stringify(await page.evaluate(step.eval)); log.push(r); console.log(r); }
  if (step.shot) await page.screenshot({ path: path.join(outDir, step.shot + '.png') });
}
fs.writeFileSync(path.join(outDir, 'console.log'), log.join('\n'));
console.log(log.slice(0, 40).join('\n') || 'no console errors');
await browser.close();
server.close();
