import { chromium } from 'playwright';

const BASE = 'http://localhost:3066';
const OUT = new URL('./screenshots/', import.meta.url).pathname;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const pages = [
  { url: '/', file: 'homepage.png' },
  { url: '/challenges', file: 'challenges.png' },
];

// Get a challenge slug and user ID
const metadata = await page.goto(`http://localhost:3001/api/metadata`).then(async r => {
  try { return await r?.json(); } catch { return null; }
}).catch(() => null);

if (metadata) {
  const slug = Object.keys(metadata)[0];
  if (slug) {
    pages.push({ url: `/challenges/${slug}`, file: 'challenge-detail.png' });
  }
}

const scoring = await page.goto(`http://localhost:3001/api/scoring`).then(async r => {
  try { return await r?.json(); } catch { return null; }
}).catch(() => null);

if (scoring && scoring[0]) {
  const userId = scoring[0].playerId;
  pages.push({ url: `/users/${userId}`, file: 'user-profile.png' });
}

for (const { url, file } of pages) {
  console.log(`Screenshotting ${url} → ${file}`);
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  console.log(`  ✓ saved`);
}

await browser.close();
console.log('Done!');
