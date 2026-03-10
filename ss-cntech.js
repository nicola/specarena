const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3045';
const OUT = '/Users/nicola/Proj/arena-opus/chinese-tech/screenshots';

const pages = [
  { url: '/', name: '01-home' },
  { url: '/challenges', name: '02-challenges' },
  { url: '/challenges/private-set-intersection', name: '03-challenge-detail' },
  { url: '/users/demo', name: '04-user-profile' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const { url, name } of pages) {
    const p = await context.newPage();
    try {
      await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(800);
      await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
      console.log(`OK: ${name}`);
    } catch (e) {
      console.error(`FAIL: ${name} — ${e.message}`);
    }
    await p.close();
  }
  await browser.close();
})();
