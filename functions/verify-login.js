const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('=== Testing Real Member Access ===\n');

  const browser = await chromium.launch({ headless: false });

  // Load the session that was just "refreshed"
  const storage = JSON.parse(fs.readFileSync('./session/storage.json', 'utf8'));
  const context = await browser.newContext({ storageState: storage });
  const page = await context.newPage();

  console.log('Test 1: Try to access JackBlack profile (member-only page)...');
  await page.goto('https://valueinvestorsclub.com/member/JackBlack/3246868', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'verify-member-access.png' });

  // Check what we see
  const pageContent = await page.content();
  const currentUrl = page.url();

  console.log('Current URL:', currentUrl);
  console.log('Page Title:', await page.title());

  // Check for various indicators
  const hasLoginForm = await page.$('input[type="password"]') !== null;
  const hasLoginButton = await page.$('a[href*="login"]') !== null;
  const hasIdeasTable = pageContent.includes('Recent Ideas') || pageContent.includes('Recommendations');

  console.log('\nPage Analysis:');
  console.log('  Has login form:', hasLoginForm);
  console.log('  Has login button:', hasLoginButton);
  console.log('  Has ideas table:', hasIdeasTable);
  console.log('  Redirected to login?', currentUrl.includes('login'));

  if (currentUrl.includes('login') || hasLoginForm) {
    console.log('\n❌ FAILED: Redirected to login page');
    console.log('   The session refresh did NOT actually log us in.\n');
  } else if (hasIdeasTable) {
    console.log('\n✅ SUCCESS: Member page is accessible!');
    console.log('   We can see member-only content.\n');
  } else {
    console.log('\n⚠️  UNCLEAR: Not on login page, but not seeing expected content.\n');
  }

  console.log('Screenshot saved to verify-member-access.png');
  console.log('Browser will close in 10 seconds...\n');

  await page.waitForTimeout(10000);
  await browser.close();
})();
