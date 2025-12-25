/**
 * Performance Calculator - XIRR and Metrics
 *
 * Calculates simulated buy-and-hold returns for VIC authors.
 * Uses XIRR (Extended Internal Rate of Return) to account for timing of picks.
 *
 * IMPORTANT: These are SIMULATED returns, not actual trading performance.
 * Authors may have exited positions at different times.
 */

import xirr from 'xirr';
import { db, Timestamp } from './firebase.js';
import { getAllCachedPrices } from './price-service.js';

/**
 * Calculate XIRR for a set of cash flows
 * Cash flows format: [{ date: Date, amount: number }, ...]
 * Negative amounts = investments (outflows)
 * Positive amounts = returns (inflows)
 */
function calculateXIRR(cashFlows) {
    if (cashFlows.length < 2) {
        return null;
    }

    try {
        // xirr library expects { amount, when } format
        const formatted = cashFlows.map(cf => ({
            amount: cf.amount,
            when: cf.date
        }));

        const result = xirr(formatted);

        // Convert to percentage and cap extreme values
        const percentage = result * 100;

        // Cap at reasonable bounds (-100% to +1000%)
        if (percentage < -100) return -100;
        if (percentage > 1000) return 1000;

        return Math.round(percentage * 10) / 10; // One decimal place
    } catch (error) {
        // XIRR calculation can fail for certain cash flow patterns
        console.warn('XIRR calculation failed:', error.message);
        return null;
    }
}

/**
 * Calculate simple return percentage
 */
function calculateSimpleReturn(entryPrice, currentPrice, positionType) {
    if (!entryPrice || !currentPrice || entryPrice === 0) {
        return null;
    }

    if (positionType === 'short') {
        // Short: profit when price goes down
        return ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    // Long: profit when price goes up
    return ((currentPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Calculate metrics for a single author
 */
export async function calculateAuthorMetrics(username) {
    // Get all ideas for this author
    const ideasSnapshot = await db.collection('ideas')
        .where('authorUsername', '==', username)
        .get();

    if (ideasSnapshot.empty) {
        return null;
    }

    const ideas = ideasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Get current prices
    const prices = await getAllCachedPrices();

    // Filter ideas that have both entry price and current price
    const validIdeas = ideas.filter(idea => {
        const priceData = prices[idea.ticker?.toUpperCase()];
        return idea.priceAtRec && priceData?.currentPrice;
    });

    if (validIdeas.length === 0) {
        return {
            username,
            usernameLower: username.toLowerCase(),
            totalPicks: ideas.length,
            validPicks: 0,
            xirr1yr: null,
            xirr3yr: null,
            xirr5yr: null,
            bestPick: null,
            calculatedAt: Timestamp.now()
        };
    }

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const fiveYearsAgo = new Date(now);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    // Calculate returns for each idea
    const ideasWithReturns = validIdeas.map(idea => {
        const priceData = prices[idea.ticker.toUpperCase()];
        const currentPrice = priceData.currentPrice;
        const entryPrice = idea.priceAtRec;
        const positionType = idea.positionType || 'long';

        const returnPct = calculateSimpleReturn(entryPrice, currentPrice, positionType);

        // Get posted date
        let postedDate;
        if (idea.postedDate?.toDate) {
            postedDate = idea.postedDate.toDate();
        } else if (idea.postedDate) {
            postedDate = new Date(idea.postedDate);
        }

        return {
            ...idea,
            currentPrice,
            returnPct,
            postedDate
        };
    });

    // Build cash flows for XIRR calculation
    // Each idea: invest $1 on posted date, get back (1 + return) today
    function buildCashFlows(ideas, cutoffDate = null) {
        const flows = [];

        for (const idea of ideas) {
            if (!idea.postedDate) continue;
            if (cutoffDate && idea.postedDate < cutoffDate) continue;

            const entryPrice = idea.priceAtRec;
            const currentPrice = idea.currentPrice;
            const positionType = idea.positionType || 'long';

            // Calculate return multiple
            let returnMultiple;
            if (positionType === 'short') {
                returnMultiple = entryPrice / currentPrice; // Short: inverse
            } else {
                returnMultiple = currentPrice / entryPrice; // Long: direct
            }

            // Investment (outflow)
            flows.push({
                date: idea.postedDate,
                amount: -1
            });

            // Current value (inflow)
            flows.push({
                date: now,
                amount: returnMultiple
            });
        }

        return flows;
    }

    // Calculate XIRR for different time periods
    const xirr1yr = calculateXIRR(buildCashFlows(ideasWithReturns, oneYearAgo));
    const xirr3yr = calculateXIRR(buildCashFlows(ideasWithReturns, threeYearsAgo));
    const xirr5yr = calculateXIRR(buildCashFlows(ideasWithReturns, fiveYearsAgo));

    // Find best pick
    const sortedByReturn = [...ideasWithReturns].sort((a, b) =>
        (b.returnPct || -Infinity) - (a.returnPct || -Infinity)
    );
    const bestPick = sortedByReturn[0];

    return {
        username,
        usernameLower: username.toLowerCase(),
        totalPicks: ideas.length,
        validPicks: validIdeas.length,
        xirr1yr,
        xirr3yr,
        xirr5yr,
        bestPickTicker: bestPick?.ticker || null,
        bestPickReturn: bestPick?.returnPct ? Math.round(bestPick.returnPct) : null,
        calculatedAt: Timestamp.now()
    };
}

/**
 * Calculate and save metrics for all authors
 */
export async function calculateAllAuthorMetrics() {
    console.log('=== Calculating All Author Metrics ===');

    // Get all authors
    const authorsSnapshot = await db.collection('authors').get();
    const authors = authorsSnapshot.docs.map(doc => doc.id);

    console.log(`Processing ${authors.length} authors`);

    const results = {
        processed: 0,
        failed: 0,
        errors: []
    };

    // Process each author
    for (const username of authors) {
        try {
            const metrics = await calculateAuthorMetrics(username);

            if (metrics) {
                // Save to authorMetrics collection
                await db.collection('authorMetrics').doc(username).set(metrics);
                results.processed++;
                console.log(`Calculated metrics for ${username}: XIRR5yr=${metrics.xirr5yr}%`);
            }
        } catch (error) {
            console.error(`Failed to calculate metrics for ${username}:`, error.message);
            results.failed++;
            results.errors.push({ username, error: error.message });
        }
    }

    // Update aggregate stats
    await updateAggregateStats();

    console.log(`=== Metrics Calculation Complete ===`);
    console.log(`Processed: ${results.processed}, Failed: ${results.failed}`);

    return results;
}

/**
 * Update aggregate stats for the leaderboard banner
 */
async function updateAggregateStats() {
    const metricsSnapshot = await db.collection('authorMetrics').get();

    if (metricsSnapshot.empty) {
        return;
    }

    const metrics = metricsSnapshot.docs.map(doc => doc.data());

    // Calculate averages
    const validXirr5yr = metrics.filter(m => m.xirr5yr !== null).map(m => m.xirr5yr);
    const avgXirr5yr = validXirr5yr.length > 0
        ? validXirr5yr.reduce((a, b) => a + b, 0) / validXirr5yr.length
        : null;

    const totalPicks = metrics.reduce((sum, m) => sum + (m.totalPicks || 0), 0);

    await db.collection('stats').doc('aggregate').set({
        activeInvestors: metrics.length,
        totalRecommendations: totalPicks,
        avgXirr5yr: avgXirr5yr ? Math.round(avgXirr5yr * 10) / 10 : null,
        lastUpdated: Timestamp.now()
    });
}

/**
 * Get leaderboard data (sorted by XIRR)
 */
export async function getLeaderboard(sortBy = 'xirr5yr', limitCount = 50) {
    const validSortFields = ['xirr5yr', 'xirr3yr', 'xirr1yr', 'totalPicks', 'bestPickReturn'];

    if (!validSortFields.includes(sortBy)) {
        sortBy = 'xirr5yr';
    }

    const snapshot = await db.collection('authorMetrics')
        .orderBy(sortBy, 'desc')
        .limit(limitCount)
        .get();

    return snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        ...doc.data()
    }));
}

export default {
    calculateAuthorMetrics,
    calculateAllAuthorMetrics,
    getLeaderboard
};
