const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('http://localhost:3031');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-homepage.png', fullPage: true });

  await page.goto('http://localhost:3031/challenges');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/02-challenges.png', fullPage: true });

  try {
    const link = await page.$('a[href*="/challenges/"]');
    if (link) {
      const href = await link.getAttribute('href');
      console.log('challenge href:', href);
      await page.goto('http://localhost:3031' + href);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'screenshots/03-challenge-detail.png', fullPage: true });
      
      // Get user link from this page
      const userLink = await page.$('a[href*="/users/"]');
      if (userLink) {
        const userHref = await userLink.getAttribute('href');
        await page.goto('http://localhost:3031' + userHref);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'screenshots/04-user-profile.png', fullPage: true });
      }
    }
  } catch(e) { console.log('error', e.message); }

  await browser.close();
})();
