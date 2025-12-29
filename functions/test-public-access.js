const { chromium } = require('playwright');

(async () => {
  console.log('Testing if /ideas/ page is publicly accessible...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(); // No cookies!
  const page = await context.newPage();

  await page.goto('https://valueinvestorsclub.com/ideas/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const hasLoginButton = await page.$('a[href*="login"]') !== null;
  const pageTitle = await page.title();
  const pageContent = await page.content();

  console.log('Current URL:', currentUrl);
  console.log('Page Title:', pageTitle);
  console.log('Has login button:', hasLoginButton);
  console.log('Redirected to login?', currentUrl.includes('login'));
  console.log('Has idea listings?', pageContent.includes('Recent Ideas') || pageContent.includes('investment idea'));

  await page.screenshot({ path: 'public-test.png' });

  console.log('\nScreenshot saved. Browser will close in 5 seconds...');
  await page.waitForTimeout(5000);
  await browser.close();
})();
