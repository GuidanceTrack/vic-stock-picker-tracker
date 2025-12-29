const { chromium } = require('playwright');
const fs = require('fs');

// Convert Firefox cookie format to Playwright format
function convertFirefoxCookies(firefoxCookies) {
  return firefoxCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expirationDate || -1,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite || 'Lax'
  }));
}

(async () => {
  console.log('=== COOKIE COMPARISON TEST ===\n');

  // Load both sets of cookies
  const autoRefreshedCookies = JSON.parse(fs.readFileSync('./session/cookies.json', 'utf8'));
  const firefoxCookies = convertFirefoxCookies(JSON.parse(fs.readFileSync('./firefox-cookies.json', 'utf8')));

  const autoVicSession = autoRefreshedCookies.find(c => c.name === 'vic_session');
  const firefoxVicSession = firefoxCookies.find(c => c.name === 'vic_session');

  console.log('Auto-refreshed vic_session value:');
  console.log(autoVicSession.value.substring(0, 80) + '...\n');

  console.log('Firefox (manual login) vic_session value:');
  console.log(firefoxVicSession.value.substring(0, 80) + '...\n');

  console.log('Are they the same?', autoVicSession.value === firefoxVicSession.value ? '✓ YES' : '✗ NO');
  console.log('');

  // Now test if Firefox cookies can access member content
  console.log('=== Testing Firefox Cookies ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Add Firefox cookies
  await context.addCookies(firefoxCookies);

  const page = await context.newPage();

  console.log('Attempting to access JackBlack profile page...');
  await page.goto('https://valueinvestorsclub.com/member/JackBlack/3246868', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const pageTitle = await page.title();
  const pageContent = await page.content();

  console.log('Current URL:', currentUrl);
  console.log('Page Title:', pageTitle);

  const hasLoginButton = await page.$('a[href*="login"]') !== null;
  const hasIdeasTable = pageContent.includes('Recent Ideas') || pageContent.includes('Recommendations') || pageContent.includes('Member since');
  const redirectedToLogin = currentUrl.includes('login');

  console.log('\nResults:');
  console.log('  Redirected to login?', redirectedToLogin);
  console.log('  Has login button?', hasLoginButton);
  console.log('  Has member content?', hasIdeasTable);

  if (!redirectedToLogin && hasIdeasTable) {
    console.log('\n✅ SUCCESS! Firefox cookies grant access to member content!');
  } else if (redirectedToLogin || hasLoginButton) {
    console.log('\n❌ FAILED! Firefox cookies do NOT work - redirected to login.');
  } else {
    console.log('\n⚠️  UNCLEAR - need to check screenshot');
  }

  await page.screenshot({ path: 'firefox-cookies-test.png' });
  console.log('\nScreenshot saved to firefox-cookies-test.png');
  console.log('Browser will close in 10 seconds...\n');

  await page.waitForTimeout(10000);
  await browser.close();
})();
