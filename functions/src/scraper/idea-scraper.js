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
 * Scrape an individual idea page for detailed information
 *
 * @param {Page} page - Playwright page object
 * @param {string} ideaUrl - Full URL to the idea page
 * @returns {Object} Detailed idea information
 */
export async function scrapeIdeaPage(page, ideaUrl) {
    console.log(`Scraping idea page: ${ideaUrl}`);

    await withRetry(async () => {
        await page.goto(ideaUrl, { waitUntil: 'networkidle', timeout: 30000 });
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    const selectors = config.selectors.idea;

    const ideaDetails = await page.evaluate((sel) => {
        const result = {};

        // Helper to try multiple selectors
        const trySelectors = (selectorStr) => {
            const selectors = selectorStr.split(', ');
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    return el.textContent.trim();
                }
            }
            return null;
        };

        // Extract ticker
        result.ticker = trySelectors(sel.ticker);

        // Extract company name
        result.companyName = trySelectors(sel.companyName);

        // Extract price at recommendation
        const priceText = trySelectors(sel.priceAtRec);
        if (priceText) {
            // Parse price like "$62.50" or "62.50"
            const priceMatch = priceText.replace(/[$,]/g, '').match(/[\d.]+/);
            if (priceMatch) {
                result.priceAtRec = parseFloat(priceMatch[0]);
            }
        }

        // Extract market cap
        const mcapText = trySelectors(sel.marketCap);
        if (mcapText) {
            result.marketCapAtRec = parseMarketCap(mcapText);
        }

        // Extract position type
        const posText = trySelectors(sel.positionType);
        if (posText) {
            result.positionType = posText.toLowerCase().includes('short') ? 'short' : 'long';
        }

        // Extract posted date
        const dateEl = document.querySelector(sel.postedDate.split(', ')[0]);
        if (dateEl) {
            result.postedDate = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
        }

        // Helper function to parse market cap strings
        function parseMarketCap(text) {
            const cleaned = text.replace(/[$,]/g, '').trim().toUpperCase();
            const match = cleaned.match(/([\d.]+)\s*([BMT])?/);

            if (!match) return null;

            let value = parseFloat(match[1]);
            const suffix = match[2];

            if (suffix === 'B') value *= 1e9;
            else if (suffix === 'M') value *= 1e6;
            else if (suffix === 'T') value *= 1e12;

            return value;
        }

        return result;
    }, selectors);

    // Also try to get data from page meta or structured data
    const additionalData = await extractStructuredData(page);

    return {
        ...ideaDetails,
        ...additionalData,
        ideaUrl
    };
}

/**
 * Try to extract data from JSON-LD or meta tags
 */
async function extractStructuredData(page) {
    return page.evaluate(() => {
        const result = {};

        // Try JSON-LD
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd.textContent);
                if (data.datePublished) {
                    result.postedDate = data.datePublished;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        // Try meta tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            const title = ogTitle.getAttribute('content');
            // Title might contain ticker like "CROX - Crocs Inc"
            const tickerMatch = title?.match(/^([A-Z]+)\s*[-–]/);
            if (tickerMatch) {
                result.ticker = tickerMatch[1];
            }
        }

        return result;
    });
}

/**
 * Scrape multiple idea pages with rate limiting
 */
export async function scrapeMultipleIdeas(page, ideas) {
    const results = [];

    for (let i = 0; i < ideas.length; i++) {
        const idea = ideas[i];
        console.log(`Scraping idea ${i + 1}/${ideas.length}: ${idea.ticker}`);

        try {
            const details = await scrapeIdeaPage(page, idea.ideaUrl);

            results.push({
                ...idea,
                ...details
            });

            // Rate limit between requests (except for last one)
            if (i < ideas.length - 1) {
                await waitRandom();
            }
        } catch (error) {
            console.error(`Failed to scrape idea ${idea.vicIdeaId}:`, error.message);
            results.push({
                ...idea,
                scrapeError: error.message
            });
        }
    }

    return results;
}
