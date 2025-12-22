/**
 * Test script for the VIC scraper
 *
 * Run with: npm run test:scrape
 *
 * This script tests the scraper locally without affecting production data.
 */

import { chromium } from 'playwright';
import {
    createAuthenticatedContext,
    isLoggedIn,
    hasStoredSession
} from './scraper/session-manager.js';
import { scrapeAuthorProfile, buildProfileUrl } from './scraper/author-scraper.js';
import { scrapeIdeaPage } from './scraper/idea-scraper.js';

// Test author - you'll need to replace with a real VIC author
const TEST_AUTHOR = {
    username: 'test_author',      // Replace with real username
    vicUserId: '12345'            // Replace with real user ID
};

async function runTests() {
    console.log('=== VIC Scraper Test Suite ===\n');

    // Test 1: Check session
    console.log('Test 1: Checking for stored session...');
    if (!hasStoredSession()) {
        console.log('FAIL: No session found.');
        console.log('Run "npm run save-session" to log in to VIC first.\n');
        process.exit(1);
    }
    console.log('PASS: Session file exists\n');

    // Launch browser
    console.log('Launching browser...');
    const browser = await chromium.launch({
        headless: false,  // Show browser for debugging
        slowMo: 500       // Slow down for visibility
    });

    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();

    try {
        // Test 2: Verify login
        console.log('Test 2: Verifying login status...');
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
            console.log('FAIL: Not logged in. Session may have expired.');
            console.log('Run "npm run save-session" to log in again.\n');
            await browser.close();
            process.exit(1);
        }
        console.log('PASS: Logged in successfully\n');

        // Test 3: Build profile URL
        console.log('Test 3: Building profile URL...');
        const profileUrl = buildProfileUrl(TEST_AUTHOR.username, TEST_AUTHOR.vicUserId);
        console.log(`URL: ${profileUrl}`);
        console.log('PASS: URL built correctly\n');

        // Test 4: Navigate to VIC homepage
        console.log('Test 4: Navigating to VIC homepage...');
        await page.goto('https://valueinvestorsclub.com', { waitUntil: 'networkidle' });
        console.log('PASS: Homepage loaded\n');

        // Test 5: Take screenshot for debugging
        console.log('Test 5: Taking screenshot...');
        await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
        console.log('PASS: Screenshot saved to test-screenshot.png\n');

        // If you have a real test author, uncomment these tests:
        /*
        // Test 6: Scrape author profile
        console.log('Test 6: Scraping author profile...');
        const ideas = await scrapeAuthorProfile(page, TEST_AUTHOR);
        console.log(`Found ${ideas.length} ideas`);
        if (ideas.length > 0) {
            console.log('First idea:', JSON.stringify(ideas[0], null, 2));
        }
        console.log('PASS: Profile scraped\n');

        // Test 7: Scrape an idea page
        if (ideas.length > 0) {
            console.log('Test 7: Scraping idea page...');
            const ideaDetails = await scrapeIdeaPage(page, ideas[0].ideaUrl);
            console.log('Idea details:', JSON.stringify(ideaDetails, null, 2));
            console.log('PASS: Idea page scraped\n');
        }
        */

        console.log('=== All Tests Passed ===');

    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        // Keep browser open for inspection
        console.log('\nBrowser will close in 10 seconds...');
        console.log('(Check the screenshot at test-screenshot.png)\n');
        await new Promise(r => setTimeout(r, 10000));
        await browser.close();
    }
}

// Run tests
runTests().catch(console.error);
