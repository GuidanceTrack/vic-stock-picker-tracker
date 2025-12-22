import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { waitRandom, withRetry } from './rate-limiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '../../config/scrape-config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

/**
 * Build author profile URL
 */
export function buildProfileUrl(username, userId) {
    return config.urls.memberProfile
        .replace('{username}', username)
        .replace('{userId}', userId);
}

/**
 * Scrape an author's profile page to get their list of ideas
 *
 * @param {Page} page - Playwright page object
 * @param {Object} author - Author object with username and vicUserId
 * @returns {Array} List of ideas found on the profile
 */
export async function scrapeAuthorProfile(page, author) {
    const profileUrl = buildProfileUrl(author.username, author.vicUserId);
    console.log(`Scraping author profile: ${profileUrl}`);

    await withRetry(async () => {
        await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Extract ideas from the profile page (VIC-specific selectors)
    const ideas = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('table tr');

        // Skip header row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];

            try {
                // Get idea ID from bookmark span with data-iid attribute
                const bookmark = row.querySelector('[data-iid]');
                const ideaId = bookmark ? bookmark.getAttribute('data-iid') : null;
                if (!ideaId) continue;

                // Get link to idea page
                const link = row.querySelector('a[href*="/idea/"]');
                const ideaUrl = link ? link.href : null;
                const companyName = link ? link.textContent.trim() : null;

                // Get ticker - it appears right after the company name link
                // The structure is: <a>COMPANY NAME</a> TICKER
                // Find the parent span (vich1) or container that has both
                let ticker = null;
                const tickerContainer = row.querySelector('.vich1, .col-sm-2');
                if (tickerContainer && companyName) {
                    const containerText = tickerContainer.textContent.trim();
                    // Remove the company name to get just the ticker
                    const afterCompany = containerText.replace(companyName, '').trim();
                    // The ticker is the first word/token after removing company name
                    const tickerMatch = afterCompany.match(/^([A-Z0-9.]+)/);
                    if (tickerMatch) {
                        ticker = tickerMatch[1].toUpperCase();
                    }
                }
                // Fallback: try to extract from URL (e.g., /idea/ZILLOW_GROUP_INC/123)
                if (!ticker && ideaUrl) {
                    // Not reliable, skip this fallback
                }

                // Check for short indicator - look for badge with 'S' or short-related classes
                const shortBadge = row.querySelector('.badge-danger, .short-badge, [class*="short"]');
                const rowHtml = row.innerHTML;
                // Look for the small 'S' badge that indicates short position
                const hasShortBadge = rowHtml.includes('badge') && rowHtml.includes('>S<');
                const isShort = shortBadge !== null || hasShortBadge;

                // Get date from cells - look for date pattern like "Sep 28, 2025"
                let dateStr = null;
                const allCells = row.querySelectorAll('td');
                allCells.forEach(c => {
                    const text = c.textContent.trim();
                    const dateMatch = text.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/);
                    if (dateMatch) {
                        dateStr = dateMatch[0];
                    }
                });

                // Check for contest winner badge
                const winnerBadge = row.querySelector('.winner, .contest-winner, .winner-badge, [class*="winner"]');
                const isContestWinner = winnerBadge !== null;

                if (ticker && ideaId) {
                    results.push({
                        ticker,
                        companyName,
                        ideaUrl,
                        vicIdeaId: ideaId,
                        postedDate: dateStr,
                        positionType: isShort ? 'short' : 'long',
                        isContestWinner
                    });
                }
            } catch (err) {
                // Skip rows that can't be parsed
            }
        }

        return results;
    });

    console.log(`Found ${ideas.length} ideas for ${author.username}`);

    // Add author username to each idea
    return ideas.map(idea => ({
        ...idea,
        authorUsername: author.username
    }));
}

/**
 * Scrape profile and return only new ideas (not already in database)
 */
export async function scrapeNewIdeas(page, author, existingIdeaIds) {
    const allIdeas = await scrapeAuthorProfile(page, author);

    const newIdeas = allIdeas.filter(idea =>
        !existingIdeaIds.includes(idea.vicIdeaId)
    );

    console.log(`${newIdeas.length} new ideas (${allIdeas.length - newIdeas.length} already exist)`);

    return newIdeas;
}
