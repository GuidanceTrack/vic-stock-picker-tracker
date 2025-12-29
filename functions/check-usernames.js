const { chromium } = require('playwright');

(async () => {
  console.log('Checking if public /ideas/ page shows usernames...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://valueinvestorsclub.com/ideas/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Try to find username/author info
  const pageContent = await page.content();
  const hasAuthorLinks = pageContent.includes('/member/') || pageContent.includes('author');

  // Look for the first idea and check if author is visible
  const firstIdea = await page.$('table tr');
  if (firstIdea) {
    const ideaText = await firstIdea.textContent();
    console.log('Sample idea row text:', ideaText.substring(0, 200));
  }

  console.log('Has member/author links?', hasAuthorLinks);

  await page.screenshot({ path: 'ideas-with-authors.png', fullPage: true });
  console.log('Screenshot saved.');

  await page.waitForTimeout(3000);
  await browser.close();
})();
