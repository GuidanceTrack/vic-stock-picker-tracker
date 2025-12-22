/**
 * Price Service - Yahoo Finance Integration
 *
 * Fetches current and historical stock prices using yahoo-finance2 library.
 * Handles edge cases like ticker changes, delistings, and stock splits.
 */

import yahooFinance from 'yahoo-finance2';
import { db, Timestamp } from './firebase.js';

// Ticker mapping for renamed/merged companies
const TICKER_MAPPINGS = {
    // Add mappings as we discover them
    // 'OLD_TICKER': 'NEW_TICKER'
};

/**
 * Get the correct ticker (handles renames/mergers)
 */
function resolveTicket(ticker) {
    return TICKER_MAPPINGS[ticker.toUpperCase()] || ticker.toUpperCase();
}

/**
 * Get current price for a single ticker
 */
export async function getCurrentPrice(ticker) {
    const resolvedTicker = resolveTicket(ticker);

    try {
        const quote = await yahooFinance.quote(resolvedTicker);

        if (!quote || !quote.regularMarketPrice) {
            console.warn(`No price data for ${ticker}`);
            return null;
        }

        return {
            ticker: resolvedTicker,
            originalTicker: ticker,
            price: quote.regularMarketPrice,
            previousClose: quote.regularMarketPreviousClose,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            marketState: quote.marketState,
            currency: quote.currency,
            fetchedAt: new Date()
        };
    } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error.message);
        return null;
    }
}

/**
 * Get historical price on a specific date
 * Uses adjusted close to account for splits and dividends
 */
export async function getPriceOnDate(ticker, date) {
    const resolvedTicker = resolveTicket(ticker);
    const targetDate = new Date(date);

    // Fetch a few days before and after to handle weekends/holidays
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 5);

    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 5);

    try {
        const history = await yahooFinance.historical(resolvedTicker, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1d'
        });

        if (!history || history.length === 0) {
            console.warn(`No historical data for ${ticker} around ${date}`);
            return null;
        }

        // Find closest date to target
        let closest = history[0];
        let minDiff = Math.abs(new Date(history[0].date) - targetDate);

        for (const day of history) {
            const diff = Math.abs(new Date(day.date) - targetDate);
            if (diff < minDiff) {
                minDiff = diff;
                closest = day;
            }
        }

        return {
            ticker: resolvedTicker,
            date: closest.date,
            open: closest.open,
            high: closest.high,
            low: closest.low,
            close: closest.close,
            adjClose: closest.adjClose,
            volume: closest.volume
        };
    } catch (error) {
        console.error(`Error fetching historical price for ${ticker}:`, error.message);
        return null;
    }
}

/**
 * Batch fetch current prices for multiple tickers
 */
export async function getCurrentPrices(tickers) {
    const results = {};
    const errors = [];

    // Process in batches of 10 to avoid rate limiting
    const batchSize = 10;

    for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map(async (ticker) => {
                const result = await getCurrentPrice(ticker);
                if (result) {
                    return { ticker, result };
                } else {
                    errors.push(ticker);
                    return null;
                }
            })
        );

        for (const item of batchResults) {
            if (item) {
                results[item.ticker] = item.result;
            }
        }

        // Small delay between batches
        if (i + batchSize < tickers.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return { prices: results, errors };
}

/**
 * Update prices collection in Firestore for all tracked tickers
 */
export async function updateAllPrices() {
    console.log('=== Updating All Prices ===');

    // Get all unique tickers from ideas collection
    const ideasSnapshot = await db.collection('ideas').get();
    const tickers = [...new Set(
        ideasSnapshot.docs
            .map(doc => doc.data().ticker)
            .filter(ticker => ticker) // Filter out null/undefined
    )];

    console.log(`Found ${tickers.length} unique tickers to update`);

    const { prices, errors } = await getCurrentPrices(tickers);

    // Save to Firestore
    const batch = db.batch();

    for (const [ticker, priceData] of Object.entries(prices)) {
        const docRef = db.collection('prices').doc(ticker);
        batch.set(docRef, {
            ticker: priceData.ticker,
            currentPrice: priceData.price,
            previousClose: priceData.previousClose,
            change: priceData.change,
            changePercent: priceData.changePercent,
            currency: priceData.currency,
            lastUpdated: Timestamp.now()
        }, { merge: true });
    }

    await batch.commit();

    console.log(`Updated ${Object.keys(prices).length} prices`);
    if (errors.length > 0) {
        console.log(`Failed to fetch: ${errors.join(', ')}`);
    }

    return {
        updated: Object.keys(prices).length,
        failed: errors.length,
        errors
    };
}

/**
 * Get price for a ticker from Firestore cache
 */
export async function getCachedPrice(ticker) {
    const doc = await db.collection('prices').doc(ticker.toUpperCase()).get();
    return doc.exists ? doc.data() : null;
}

/**
 * Get all cached prices from Firestore
 */
export async function getAllCachedPrices() {
    const snapshot = await db.collection('prices').get();
    const prices = {};

    snapshot.docs.forEach(doc => {
        prices[doc.id] = doc.data();
    });

    return prices;
}

export default {
    getCurrentPrice,
    getPriceOnDate,
    getCurrentPrices,
    updateAllPrices,
    getCachedPrice,
    getAllCachedPrices
};
