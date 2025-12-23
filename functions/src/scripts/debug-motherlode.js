import { chromium } from 'playwright';
import { createAuthenticatedContext, hasStoredSession } from '../scraper/session-manager.js';
import { writeFileSync } from 'fs';

async function debugMotherlode() {
    console.log('\n=== Debugging Motherlode Profile Page ===\n');

    if (!hasStoredSession()) {
        console.log('❌ No session found. Run npm run save-session first.');
        return;
    }

    const browser = await chromium.launch({
        headless: false,  // Show browser
        slowMo: 500
    });

    try {
        const context = await createAuthenticatedContext(browser);
        const page = await context.newPage();

        const profileUrl = 'https://valueinvestorsclub.com/member/Motherlode/108010';
        console.log(`🌐 Navigating to: ${profileUrl}\n`);

        await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for page to fully load
        await page.waitForTimeout(3000);

        console.log('📸 Taking screenshot...');
        await page.screenshot({ path: 'motherlode-debug.png', fullPage: true });
        console.log('   ✓ Screenshot saved to motherlode-debug.png\n');

        // Get page title
        const title = await page.title();
        console.log(`📄 Page Title: ${title}\n`);

        // Check for common elements
        console.log('🔍 Checking for key elements:\n');

        const hasLoginButton = await page.$('a[href*="login"]');
        const hasLogoutButton = await page.$('a[href*="logout"]');
        const hasMemberContent = await page.$('.member-content, .ideas-list, [data-member]');

        console.log(`  Login button:    ${hasLoginButton ? '✗ Found (BAD - means not logged in)' : '✓ Not found (good)'}`);
        console.log(`  Logout button:   ${hasLogoutButton ? '✓ Found (GOOD)' : '✗ Not found (bad)'}`);
        console.log(`  Member content:  ${hasMemberContent ? '✓ Found' : '✗ Not found'}\n`);

        // Look for ideas table with various possible selectors
        console.log('🔍 Looking for ideas table...\n');

        const selectors = [
            '.ideas-table',
            'table.ideas',
            '#ideas-list',
            'table',
            '.idea-row',
            'tr[data-idea-id]',
            '[class*="idea"]',
            '[id*="idea"]'
        ];

        for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
                const count = await page.$$(selector);
                console.log(`  ✓ Found "${selector}": ${count.length} element(s)`);
            } else {
                console.log(`  ✗ Not found: "${selector}"`);
            }
        }

        // Get all tables on the page
        console.log('\n📊 Analyzing all tables on page...\n');
        const tables = await page.$$('table');
        console.log(`  Found ${tables.length} table(s)\n`);

        for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const rows = await table.$$('tr');
            const className = await table.getAttribute('class');
            const id = await table.getAttribute('id');

            console.log(`  Table ${i + 1}:`);
            console.log(`    Class: ${className || 'none'}`);
            console.log(`    ID: ${id || 'none'}`);
            console.log(`    Rows: ${rows.length}`);

            // Get first row's HTML for inspection
            if (rows.length > 0) {
                const firstRowHTML = await rows[0].innerHTML();
                console.log(`    First row preview: ${firstRowHTML.substring(0, 150)}...`);
            }
            console.log('');
        }

        // Save full page HTML for inspection
        console.log('💾 Saving page HTML...');
        const html = await page.content();
        writeFileSync('motherlode-debug.html', html);
        console.log('   ✓ HTML saved to motherlode-debug.html\n');

        // Check for any text mentioning "idea" or "stock"
        console.log('🔍 Searching page for keywords...\n');
        const pageText = await page.textContent('body');

        const hasIdea = pageText.toLowerCase().includes('idea');
        const hasStock = pageText.toLowerCase().includes('stock');
        const hasTicker = pageText.toLowerCase().includes('ticker');
        const hasLong = pageText.toLowerCase().includes('long');
        const hasShort = pageText.toLowerCase().includes('short');

        console.log(`  "idea":   ${hasIdea ? '✓ Found' : '✗ Not found'}`);
        console.log(`  "stock":  ${hasStock ? '✓ Found' : '✗ Not found'}`);
        console.log(`  "ticker": ${hasTicker ? '✓ Found' : '✗ Not found'}`);
        console.log(`  "long":   ${hasLong ? '✓ Found' : '✗ Not found'}`);
        console.log(`  "short":  ${hasShort ? '✓ Found' : '✗ Not found'}\n`);

        console.log('⏸️  Browser will stay open for 30 seconds for manual inspection...');
        console.log('   Check the browser window and the saved files!\n');
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
        console.log('🔒 Browser closed.\n');
    }
}

debugMotherlode();
