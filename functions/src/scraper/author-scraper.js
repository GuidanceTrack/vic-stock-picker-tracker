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

    const selectors = config.selectors.profile;

    // Extract ideas from the profile page
    const ideas = await page.evaluate((sel) => {
        const results = [];

        // Try multiple possible selectors for idea rows
        const rowSelectors = sel.ideaRow.split(', ');
        let rows = [];

        for (const rowSel of rowSelectors) {
            rows = document.querySelectorAll(rowSel);
            if (rows.length > 0) break;
        }

        console.log(`Found ${rows.length} idea rows`);

        rows.forEach((row, index) => {
            try {
                // Extract ticker
                const tickerSelectors = sel.ticker.split(', ');
                let ticker = null;
                for (const tickerSel of tickerSelectors) {
                    const tickerEl = row.querySelector(tickerSel);
                    if (tickerEl) {
                        ticker = tickerEl.textContent.trim().toUpperCase();
                        break;
                    }
                }

                // Extract idea link
                const linkSelectors = sel.ideaLink.split(', ');
                let ideaUrl = null;
                let ideaId = null;
                for (const linkSel of linkSelectors) {
                    const linkEl = row.querySelector(linkSel);
                    if (linkEl) {
                        ideaUrl = linkEl.href;
                        // Extract idea ID from URL like /idea/COMPANY/123456
                        const match = ideaUrl.match(/\/idea\/[^/]+\/(\d+)/);
                        if (match) {
                            ideaId = match[1];
                        }
                        break;
                    }
                }

                // Extract date
                const dateSelectors = sel.date.split(', ');
                let dateStr = null;
                for (const dateSel of dateSelectors) {
                    const dateEl = row.querySelector(dateSel);
                    if (dateEl) {
                        dateStr = dateEl.textContent.trim();
                        // Also check datetime attribute
                        if (dateEl.getAttribute('datetime')) {
                            dateStr = dateEl.getAttribute('datetime');
                        }
                        break;
                    }
                }

                // Check if short position
                const positionSelectors = sel.positionType.split(', ');
                let positionType = 'long';
                for (const posSel of positionSelectors) {
                    const posEl = row.querySelector(posSel);
                    if (posEl) {
                        const text = posEl.textContent.toLowerCase();
                        if (text.includes('short')) {
                            positionType = 'short';
                        }
                        break;
                    }
                }
                // Also check row classes
                if (row.classList.contains('short')) {
                    positionType = 'short';
                }

                // Check if contest winner
                const winnerSelectors = sel.contestWinner.split(', ');
                let isContestWinner = false;
                for (const winSel of winnerSelectors) {
                    if (row.querySelector(winSel)) {
                        isContestWinner = true;
                        break;
                    }
                }

                if (ticker && ideaId) {
                    results.push({
                        ticker,
                        ideaUrl,
                        vicIdeaId: ideaId,
                        postedDate: dateStr,
                        positionType,
                        isContestWinner
                    });
                }
            } catch (err) {
                console.error(`Error parsing row ${index}:`, err);
            }
        });

        return results;
    }, selectors);

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
