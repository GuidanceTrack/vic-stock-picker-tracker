import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_DIR = join(__dirname, '../../session');
const COOKIES_FILE = join(SESSION_DIR, 'cookies.json');
const STORAGE_FILE = join(SESSION_DIR, 'storage.json');

async function testAutoRefresh() {
    console.log('\n' + '='.repeat(70));
    console.log('TESTING AUTOMATIC SESSION REFRESH');
    console.log('='.repeat(70) + '\n');

    console.log('📋 Test Plan:');
    console.log('  1. Load expired cookies (including valid remember_web_* token)');
    console.log('  2. Navigate to VIC with Playwright');
    console.log('  3. Check if we can access member content');
    console.log('  4. Check if vic_session was automatically refreshed\n');

    console.log('⏳ Loading current session (with expired vic_session)...\n');

    let browser;
    try {
        // Read current cookies
        const cookiesBefore = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
        const storage = JSON.parse(readFileSync(STORAGE_FILE, 'utf8'));

        const vicSessionBefore = cookiesBefore.find(c => c.name === 'vic_session');
        const rememberTokenBefore = cookiesBefore.find(c => c.name.startsWith('remember_web_'));

        console.log('Before navigation:');
        console.log(`  • vic_session: ${vicSessionBefore ? 'Present (EXPIRED)' : 'Missing'}`);
        console.log(`  • remember_web_*: ${rememberTokenBefore ? 'Present (valid for 399 days)' : 'Missing'}`);
        console.log(`  • Total cookies: ${cookiesBefore.length}\n`);

        // Launch browser
        console.log('🚀 Launching browser...');
        browser = await chromium.launch({
            headless: false,  // Show browser so you can see what happens
            slowMo: 500       // Slow down so we can observe
        });

        // Create context with stored session
        console.log('📂 Creating browser context with stored session...');
        const context = await browser.newContext({ storageState: storage });
        const page = await context.newPage();

        // Navigate to VIC homepage
        console.log('🌐 Navigating to VIC homepage...\n');
        await page.goto('https://valueinvestorsclub.com', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Wait a bit for any cookies to be set
        await page.waitForTimeout(2000);

        // Check what's on the page
        console.log('🔍 Checking page content...\n');

        const pageTitle = await page.title();
        console.log(`Page Title: ${pageTitle}`);

        // Check for Cloudflare
        const pageContent = await page.content();
        const hasCloudflare = pageContent.includes('Checking your browser') ||
                             pageContent.includes('Just a moment') ||
                             await page.$('#challenge-running');

        if (hasCloudflare) {
            console.log('❌ CLOUDFLARE CHALLENGE DETECTED');
            console.log('   The site is blocking automated access.\n');
            await browser.close();
            return;
        }

        // Check for login indicators
        const logoutButton = await page.$('a[href*="logout"]');
        const loginButton = await page.$('a[href*="login"]');

        console.log('\nAuthentication Status:');
        if (logoutButton) {
            console.log('  ✓ Logout button found - USER IS LOGGED IN!');
        } else {
            console.log('  ✗ No logout button found');
        }

        if (loginButton) {
            console.log('  ✗ Login button visible - NOT LOGGED IN');
        } else {
            console.log('  ✓ No login button (good sign)');
        }

        // Get updated cookies after navigation
        const cookiesAfter = await context.cookies();
        const vicSessionAfter = cookiesAfter.find(c => c.name === 'vic_session');
        const rememberTokenAfter = cookiesAfter.find(c => c.name.startsWith('remember_web_'));

        console.log('\n📊 Cookie Comparison:\n');
        console.log('Cookie                 Before          After');
        console.log('-'.repeat(70));

        // vic_session comparison
        const vicBefore = vicSessionBefore ?
            `Expired (${new Date(vicSessionBefore.expires * 1000).toLocaleTimeString()})` :
            'Missing';
        const vicAfter = vicSessionAfter ?
            `Present (expires ${new Date(vicSessionAfter.expires * 1000).toLocaleTimeString()})` :
            'Missing';
        console.log(`vic_session            ${vicBefore.padEnd(15)} ${vicAfter}`);

        // remember_web_* comparison
        console.log(`remember_web_*         ${rememberTokenBefore ? 'Present' : 'Missing'}         ${rememberTokenAfter ? 'Present' : 'Missing'}`);

        console.log(`Total cookies          ${cookiesBefore.length}               ${cookiesAfter.length}\n`);

        // Check if vic_session was refreshed
        const sessionRefreshed = vicSessionAfter &&
                                (!vicSessionBefore || vicSessionAfter.value !== vicSessionBefore.value);

        console.log('='.repeat(70));
        if (sessionRefreshed) {
            console.log('\n✅ SUCCESS! Session was automatically refreshed!');
            console.log('   The remember_web_* token triggered a new vic_session cookie.');
            console.log('   New vic_session expires: ' + new Date(vicSessionAfter.expires * 1000).toLocaleString());

            const newExpiresIn = (vicSessionAfter.expires - Date.now() / 1000) / 3600;
            console.log(`   Valid for: ${newExpiresIn.toFixed(1)} hours\n`);

            // Save the new session
            console.log('💾 Saving refreshed session...');
            const newStorage = await context.storageState();
            writeFileSync(COOKIES_FILE, JSON.stringify(cookiesAfter, null, 2));
            writeFileSync(STORAGE_FILE, JSON.stringify(newStorage, null, 2));
            console.log('   ✓ New session saved to files\n');

            console.log('🎉 CONCLUSION: Your remember token allows automatic session refresh!');
            console.log('   This means the scraper should work as long as you have the remember token.');
            console.log('   The remember token is valid for 399 days.\n');

        } else if (logoutButton && !vicSessionAfter) {
            console.log('\n🤔 INTERESTING: Logged in but no vic_session cookie?');
            console.log('   VIC might be using a different cookie for authentication.');
            console.log('   This could still work - the remember token might be all we need!\n');

        } else {
            console.log('\n❌ Session NOT automatically refreshed');
            console.log('   The expired vic_session was not renewed.');

            if (loginButton) {
                console.log('   You appear to be logged out.');
                console.log('   The remember token alone is not enough.\n');
                console.log('💡 RECOMMENDATION: Implement automatic login or use stealth plugins');
            } else {
                console.log('   Unclear status - might need manual verification.\n');
            }
        }

        // Keep browser open for 10 seconds so you can see the page
        console.log('⏸️  Browser will stay open for 10 seconds so you can verify visually...');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('\n❌ Error during test:', error.message);
        console.error(error.stack);
    } finally {
        if (browser) {
            await browser.close();
            console.log('\n🔒 Browser closed.');
        }
    }

    console.log('='.repeat(70) + '\n');
}

// Run the test
testAutoRefresh();
