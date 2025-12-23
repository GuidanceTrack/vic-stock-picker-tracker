/**
 * Firebase Cloud Functions Entry Point
 *
 * This file defines HTTP-triggered Cloud Functions for:
 * 1. dailyScrape - Scrape one VIC author per day
 * 2. dailyUpdate - Fetch prices AND calculate metrics (combined)
 * 3. updatePrices - Fetch current stock prices (kept for manual triggers)
 * 4. calculateMetrics - Recalculate XIRR and metrics (kept for manual triggers)
 */

const functions = require('firebase-functions');

// Import our async function modules
// Note: We use dynamic imports because our source code uses ES modules

/**
 * Daily Scrape Function
 * Triggered by Cloud Scheduler at 2:00 AM ET
 * Scrapes ONE author (profile + ideas) to be respectful to VIC servers
 */
exports.dailyScrape = functions
    .runWith({
        timeoutSeconds: 540,  // 9 minutes (scraping can be slow)
        memory: '1GB'          // Playwright needs more memory
    })
    .https.onRequest(async (req, res) => {
        try {
            // Dynamic import of ES module
            const { dailyScrape } = await import('./src/index.js');

            console.log('Starting daily scrape...');
            const result = await dailyScrape();

            if (!result.success) {
                res.status(200).json({
                    message: 'No work to do',
                    reason: result.reason
                });
                return;
            }

            res.json({
                success: true,
                author: result.author,
                newIdeas: result.newIdeas,
                totalIdeas: result.totalIdeas,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Daily scrape failed:', error);
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });

/**
 * Update Prices Function
 * Triggered by Cloud Scheduler at 6:00 PM ET
 * Fetches current prices for all tickers in the ideas collection
 */
exports.updatePrices = functions
    .runWith({
        timeoutSeconds: 300,  // 5 minutes
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
        try {
            // Dynamic import of ES module
            const { updateAllPrices } = await import('./src/services/price-service.js');

            console.log('Starting price update...');
            const result = await updateAllPrices();

            res.json({
                success: true,
                updated: result.updated,
                failed: result.failed,
                errors: result.errors,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Price update failed:', error);
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });

/**
 * Calculate Metrics Function
 * Triggered by Cloud Scheduler at 6:30 PM ET
 * Recalculates XIRR and performance metrics for all authors
 */
exports.calculateMetrics = functions
    .runWith({
        timeoutSeconds: 300,  // 5 minutes
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
        try {
            // Dynamic import of ES module
            const { calculateAllAuthorMetrics } = await import('./src/services/performance-calculator.js');

            console.log('Starting metrics calculation...');
            const result = await calculateAllAuthorMetrics();

            res.json({
                success: true,
                processed: result.processed,
                failed: result.failed,
                errors: result.errors,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Metrics calculation failed:', error);
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });

/**
 * Daily Update Function (COMBINED)
 * Triggered by Cloud Scheduler at 6:00 PM ET
 * This function combines price updates and metrics calculation for efficiency
 *
 * Execution order:
 * 1. Update all stock prices from Yahoo Finance
 * 2. Calculate XIRR and metrics for all authors (using fresh prices)
 */
exports.dailyUpdate = functions
    .runWith({
        timeoutSeconds: 300,  // 5 minutes
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
        try {
            console.log('Starting daily update (prices + metrics)...');

            // Step 1: Update prices
            const { updateAllPrices } = await import('./src/services/price-service.js');
            console.log('Step 1/2: Updating prices...');
            const priceResult = await updateAllPrices();
            console.log(`Prices updated: ${priceResult.updated} tickers, ${priceResult.failed} failed`);

            // Step 2: Calculate metrics (uses the fresh prices we just fetched)
            const { calculateAllAuthorMetrics } = await import('./src/services/performance-calculator.js');
            console.log('Step 2/2: Calculating metrics...');
            const metricsResult = await calculateAllAuthorMetrics();
            console.log(`Metrics calculated: ${metricsResult.processed} authors, ${metricsResult.failed} failed`);

            // Return combined results
            res.json({
                success: true,
                prices: {
                    updated: priceResult.updated,
                    failed: priceResult.failed,
                    errors: priceResult.errors
                },
                metrics: {
                    processed: metricsResult.processed,
                    failed: metricsResult.failed,
                    errors: metricsResult.errors
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Daily update failed:', error);
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });
