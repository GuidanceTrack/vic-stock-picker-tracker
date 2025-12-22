/**
 * Update prices script
 *
 * Fetches current prices for all tickers in the ideas collection
 * and saves them to the prices collection.
 *
 * Run with: npm run update:prices
 */

import { updateAllPrices } from './services/price-service.js';

async function main() {
    console.log('Starting price update...\n');

    try {
        const result = await updateAllPrices();

        console.log('\n=== Summary ===');
        console.log(`Updated: ${result.updated} tickers`);
        console.log(`Failed: ${result.failed} tickers`);

        if (result.errors.length > 0) {
            console.log('\nFailed tickers:');
            for (const ticker of result.errors) {
                console.log(`  - ${ticker}`);
            }
        }

        console.log('\nPrice update complete!');
        process.exit(0);
    } catch (error) {
        console.error('Price update failed:', error);
        process.exit(1);
    }
}

main();
