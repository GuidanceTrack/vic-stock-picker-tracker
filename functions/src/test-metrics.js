/**
 * Test script for performance calculator
 *
 * Run with: npm run test:metrics
 */

import {
    calculateAuthorMetrics,
    calculateAllAuthorMetrics,
    getLeaderboard
} from './services/performance-calculator.js';
import { getAllAuthors } from './services/firebase.js';

async function testMetricsCalculator() {
    console.log('=== Testing Performance Calculator ===\n');

    // Test 1: Get all authors
    console.log('Test 1: Getting all authors from Firestore...');
    const authors = await getAllAuthors();
    console.log(`  Found ${authors.length} authors\n`);

    if (authors.length === 0) {
        console.log('  No authors found. Run "npm run seed" first.');
        return;
    }

    // Test 2: Calculate metrics for first author
    const testAuthor = authors[0].username;
    console.log(`Test 2: Calculating metrics for ${testAuthor}...`);

    try {
        const metrics = await calculateAuthorMetrics(testAuthor);

        if (metrics) {
            console.log('  Metrics:');
            console.log(`    Total Picks: ${metrics.totalPicks}`);
            console.log(`    Valid Picks: ${metrics.validPicks}`);
            console.log(`    XIRR (1yr): ${metrics.xirr1yr !== null ? metrics.xirr1yr + '%' : 'N/A'}`);
            console.log(`    XIRR (3yr): ${metrics.xirr3yr !== null ? metrics.xirr3yr + '%' : 'N/A'}`);
            console.log(`    XIRR (5yr): ${metrics.xirr5yr !== null ? metrics.xirr5yr + '%' : 'N/A'}`);
            console.log(`    Best Pick: ${metrics.bestPickTicker || 'N/A'} (${metrics.bestPickReturn !== null ? metrics.bestPickReturn + '%' : 'N/A'})`);
            console.log('  ✓ Author metrics calculation works\n');
        } else {
            console.log('  No metrics calculated (no ideas or prices)\n');
        }
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}\n`);
    }

    // Test 3: Calculate all author metrics
    console.log('Test 3: Calculating metrics for all authors...');
    try {
        const result = await calculateAllAuthorMetrics();
        console.log(`  Processed: ${result.processed}`);
        console.log(`  Failed: ${result.failed}`);
        console.log('  ✓ All metrics calculation works\n');
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}\n`);
    }

    // Test 4: Get leaderboard
    console.log('Test 4: Getting leaderboard...');
    try {
        const leaderboard = await getLeaderboard('xirr5yr', 10);

        if (leaderboard.length > 0) {
            console.log('  Top performers by 5yr XIRR:');
            for (const entry of leaderboard) {
                const xirr = entry.xirr5yr !== null ? `${entry.xirr5yr}%` : 'N/A';
                console.log(`    #${entry.rank} ${entry.username}: ${xirr} (${entry.totalPicks} picks)`);
            }
            console.log('  ✓ Leaderboard query works\n');
        } else {
            console.log('  No leaderboard entries yet\n');
        }
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}\n`);
    }

    console.log('=== Performance Calculator Tests Complete ===');
}

testMetricsCalculator().catch(console.error);
