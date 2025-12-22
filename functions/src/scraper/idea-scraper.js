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

    // Extract idea details from VIC idea page
    const ideaDetails = await page.evaluate(() => {
        const result = {};

        // Extract ticker from page title (format: "Value Investors Club / COMPANY (TICKER)")
        const title = document.title;
        const tickerMatch = title.match(/\(([A-Z0-9.]+)\)$/);
        if (tickerMatch) {
            result.ticker = tickerMatch[1];
        }

        // Extract company name from h1 or title
        const h1 = document.querySelector('h1');
        if (h1) {
            result.companyName = h1.textContent.trim();
        }

        // Find the stats table and extract Price and Market Cap
        // The structure is: <td>Price:</td><td></td><td>79.49</td>
        const rows = document.querySelectorAll('table tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                const label = cells[0]?.textContent?.trim();

                if (label === 'Price:') {
                    const priceText = cells[2]?.textContent?.trim();
                    if (priceText) {
                        const price = parseFloat(priceText.replace(/[$,]/g, ''));
                        if (!isNaN(price)) {
                            result.priceAtRec = price;
                        }
                    }
                }

                if (label?.includes('Market Cap')) {
                    const mcapText = cells[2]?.textContent?.trim();
                    if (mcapText) {
                        const mcap = parseFloat(mcapText.replace(/[$,]/g, ''));
                        if (!isNaN(mcap)) {
                            // Value is in millions, convert to actual value
                            result.marketCapAtRec = mcap * 1e6;
                        }
                    }
                }
            }
        });

        // Check for short position in the page
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('short position') || pageText.includes('position: short')) {
            result.positionType = 'short';
        }

        return result;
    });

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
