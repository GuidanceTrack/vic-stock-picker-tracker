/**
 * Test script for price service
 *
 * Run with: npm run test:prices
 */

import {
    getCurrentPrice,
    getPriceOnDate,
    getCurrentPrices,
    updateAllPrices
} from './services/price-service.js';

async function testPriceService() {
    console.log('=== Testing Price Service ===\n');

    // Test 1: Get current price for a single ticker
    console.log('Test 1: Getting current price for AAPL...');
    const aaplPrice = await getCurrentPrice('AAPL');
    if (aaplPrice) {
        console.log(`  AAPL: $${aaplPrice.price} (${aaplPrice.changePercent?.toFixed(2)}%)`);
        console.log('  ✓ Single ticker fetch works\n');
    } else {
        console.log('  ✗ Failed to fetch AAPL price\n');
    }

    // Test 2: Get historical price
    console.log('Test 2: Getting historical price for AAPL on 2024-01-15...');
    const historicalPrice = await getPriceOnDate('AAPL', '2024-01-15');
    if (historicalPrice) {
        console.log(`  AAPL on ${historicalPrice.date.toISOString().split('T')[0]}: $${historicalPrice.adjClose?.toFixed(2)}`);
        console.log('  ✓ Historical price fetch works\n');
    } else {
        console.log('  ✗ Failed to fetch historical price\n');
    }

    // Test 3: Batch fetch multiple tickers
    console.log('Test 3: Batch fetching CROX, GOOGL, MSFT...');
    const testTickers = ['CROX', 'GOOGL', 'MSFT'];
    const { prices, errors } = await getCurrentPrices(testTickers);

    for (const ticker of testTickers) {
        if (prices[ticker]) {
            console.log(`  ${ticker}: $${prices[ticker].price}`);
        }
    }

    if (errors.length > 0) {
        console.log(`  Errors: ${errors.join(', ')}`);
    }
    console.log('  ✓ Batch fetch works\n');

    // Test 4: Update all prices from ideas (requires ideas in Firestore)
    console.log('Test 4: Updating all prices from Firestore ideas...');
    try {
        const result = await updateAllPrices();
        console.log(`  Updated: ${result.updated} tickers`);
        if (result.failed > 0) {
            console.log(`  Failed: ${result.failed} (${result.errors.join(', ')})`);
        }
        console.log('  ✓ Update all prices works\n');
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}\n`);
    }

    console.log('=== Price Service Tests Complete ===');
}

testPriceService().catch(console.error);
