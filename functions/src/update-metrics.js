/**
 * Update metrics script
 *
 * Calculates XIRR and other metrics for all authors
 * and saves them to the authorMetrics collection.
 *
 * Run with: npm run update:metrics
 */

import { calculateAllAuthorMetrics, getLeaderboard } from './services/performance-calculator.js';

async function main() {
    console.log('Starting metrics calculation...\n');

    try {
        const result = await calculateAllAuthorMetrics();

        console.log('\n=== Summary ===');
        console.log(`Processed: ${result.processed} authors`);
        console.log(`Failed: ${result.failed} authors`);

        if (result.errors.length > 0) {
            console.log('\nErrors:');
            for (const err of result.errors) {
                console.log(`  - ${err.username}: ${err.error}`);
            }
        }

        // Show top 5 leaderboard
        console.log('\n=== Top 5 Leaderboard (by 5yr XIRR) ===');
        const leaderboard = await getLeaderboard('xirr5yr', 5);

        for (const entry of leaderboard) {
            const xirr = entry.xirr5yr !== null ? `${entry.xirr5yr}%` : 'N/A';
            console.log(`#${entry.rank} ${entry.username}: ${xirr} (${entry.totalPicks} picks)`);
        }

        console.log('\nMetrics calculation complete!');
        process.exit(0);
    } catch (error) {
        console.error('Metrics calculation failed:', error);
        process.exit(1);
    }
}

main();
