/**
 * VIC Leaderboard - Main Scraper Entry Point
 *
 * This module orchestrates the daily scraping process:
 * 1. Get next author to scrape (oldest lastScrapedAt)
 * 2. Scrape their profile page for ideas
 * 3. Scrape any new idea pages for details
 * 4. Save everything to Firestore
 */

import { chromium } from 'playwright';
import {
    getNextAuthorToScrape,
    updateAuthorScrapedAt,
    addIdea,
    getIdeasByAuthor,
    logScrapeStart,
    logScrapeComplete,
    logScrapeFailed
} from './services/firebase.js';
import {
    createAuthenticatedContext,
    isLoggedIn,
    hasStoredSession
} from './scraper/session-manager.js';
import { scrapeAuthorProfile } from './scraper/author-scraper.js';
import { scrapeMultipleIdeas } from './scraper/idea-scraper.js';
import { waitRandom } from './scraper/rate-limiter.js';

/**
 * Main daily scrape function
 * Scrapes ONE author per run (to be gentle on VIC)
 */
export async function dailyScrape() {
    console.log('=== Starting Daily Scrape ===');
    console.log(`Time: ${new Date().toISOString()}`);

    // Check for session
    if (!hasStoredSession()) {
        throw new Error('No stored session found. Run "npm run save-session" first to log in to VIC.');
    }

    // Get next author to scrape
    const author = await getNextAuthorToScrape();

    if (!author) {
        console.log('No authors in queue. Add authors using the seed script.');
        return { success: false, reason: 'no_authors' };
    }

    console.log(`Selected author: ${author.username}`);

    // Start scrape log
    const logId = await logScrapeStart(author.username, 'daily_scrape');

    let browser;
    try {
        // Launch browser
        browser = await chromium.launch({
            headless: true  // Run without visible window
        });

        const context = await createAuthenticatedContext(browser);
        const page = await context.newPage();

        // Verify we're logged in
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
            throw new Error('Session expired. Run "npm run save-session" to log in again.');
        }

        // Get existing ideas for this author
        const existingIdeas = await getIdeasByAuthor(author.username);
        const existingIds = existingIdeas.map(i => i.vicIdeaId);
        console.log(`Author has ${existingIds.length} ideas already in database`);

        // Scrape author profile
        await waitRandom();
        const profileIdeas = await scrapeAuthorProfile(page, author);

        // Filter to only new ideas
        const newIdeas = profileIdeas.filter(idea =>
            !existingIds.includes(idea.vicIdeaId)
        );

        console.log(`Found ${newIdeas.length} new ideas to scrape`);

        // Scrape individual idea pages for details
        let scrapedIdeas = [];
        if (newIdeas.length > 0) {
            await waitRandom();
            scrapedIdeas = await scrapeMultipleIdeas(page, newIdeas);

            // Save ideas to Firestore
            for (const idea of scrapedIdeas) {
                if (!idea.scrapeError) {
                    await addIdea(idea);
                }
            }
        }

        // Update author's lastScrapedAt
        await updateAuthorScrapedAt(author.username);

        // Log success
        await logScrapeComplete(logId, scrapedIdeas.length);

        await browser.close();

        console.log('=== Daily Scrape Complete ===');
        return {
            success: true,
            author: author.username,
            newIdeas: scrapedIdeas.length,
            totalIdeas: profileIdeas.length
        };

    } catch (error) {
        console.error('Scrape failed:', error);
        await logScrapeFailed(logId, error.message);

        if (browser) {
            await browser.close();
        }

        throw error;
    }
}

/**
 * Scrape a specific author (for testing or manual runs)
 */
export async function scrapeAuthor(username, userId) {
    console.log(`=== Scraping Specific Author: ${username} ===`);

    if (!hasStoredSession()) {
        throw new Error('No stored session found. Run "npm run save-session" first.');
    }

    const author = { username, vicUserId: userId };

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await createAuthenticatedContext(browser);
        const page = await context.newPage();

        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
            throw new Error('Session expired. Run "npm run save-session" to log in again.');
        }

        await waitRandom();
        const ideas = await scrapeAuthorProfile(page, author);

        console.log(`Found ${ideas.length} ideas`);

        // Scrape first 3 ideas for details (for testing)
        const testIdeas = ideas.slice(0, 3);
        if (testIdeas.length > 0) {
            await waitRandom();
            const detailedIdeas = await scrapeMultipleIdeas(page, testIdeas);
            console.log('Sample idea details:', JSON.stringify(detailedIdeas[0], null, 2));
        }

        await browser.close();

        return { author: username, ideas };

    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

// Export for Cloud Functions
export { dailyScrape as handler };
