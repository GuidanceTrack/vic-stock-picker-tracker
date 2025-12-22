/**
 * Run daily scrape script
 *
 * Scrapes ONE author and saves their ideas to Firestore.
 *
 * Run with: npm run scrape
 */

import { dailyScrape } from './index.js';

async function main() {
    console.log('Starting daily scrape...\n');

    try {
        const result = await dailyScrape();

        console.log('\n=== Summary ===');
        console.log(`Success: ${result.success}`);
        if (result.success) {
            console.log(`Author: ${result.author}`);
            console.log(`New ideas scraped: ${result.newIdeas}`);
            console.log(`Total ideas found: ${result.totalIdeas}`);
        } else {
            console.log(`Reason: ${result.reason}`);
        }

        console.log('\nDaily scrape complete!');
        process.exit(0);
    } catch (error) {
        console.error('Daily scrape failed:', error);
        process.exit(1);
    }
}

main();
