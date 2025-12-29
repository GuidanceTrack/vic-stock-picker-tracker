const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('=== Testing Cloudflare Detection ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync('./session/cookies.json', 'utf8'));
  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log('Test 1: Navigating to VIC homepage with cookies...');
  await page.goto('https://valueinvestorsclub.com', { waitUntil: 'networkidle', timeout: 30000 });

  const pageContent = await page.content();

  // Check for Cloudflare
  if (pageContent.includes('Checking your browser') || pageContent.includes('Just a moment')) {
    console.log('❌ CLOUDFLARE BLOCKED - Challenge page detected\n');
  } else {
    console.log('✅ CLOUDFLARE ALLOWED - No challenge page\n');
  }

  // Check login status
  const loginButton = await page.$('a[href*="login"]');
  const hasLoginButton = loginButton !== null;

  console.log('Login button visible:', hasLoginButton);

  // Try to access a member page
  console.log('\nTest 2: Trying to access a member profile page...');
  await page.goto('https://valueinvestorsclub.com/member/JackBlack/3246868', { waitUntil: 'networkidle', timeout: 30000 });

  const memberPageContent = await page.content();

  if (memberPageContent.includes('Checking your browser') || memberPageContent.includes('Just a moment')) {
    console.log('❌ CLOUDFLARE BLOCKED on member page\n');
  } else if (memberPageContent.includes('login') || memberPageContent.includes('Log in')) {
    console.log('⚠️  Redirected to login - cookies expired\n');
  } else {
    console.log('✅ Member page loaded successfully\n');
  }

  console.log('Taking screenshot of member page...');
  await page.screenshot({ path: 'member-page-test.png' });

  console.log('\n=== Test Complete ===');
  console.log('Browser will close in 5 seconds...\n');

  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
