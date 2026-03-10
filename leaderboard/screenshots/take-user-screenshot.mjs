import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Use the invite ID from memory as a known user
const userId = 'c31ded64-5e05-4f6b-b38c-1f738878eddc';
const url = `http://localhost:3066/users/${userId}`;
console.log(`Screenshotting ${url}`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({
  path: '/Users/nicola/Proj/academic-layout-c/leaderboard/screenshots/user-profile.png',
  fullPage: true
});
console.log('Done!');
await browser.close();
