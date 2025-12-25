/**
 * Fetch Historical Prices Script
 *
 * Fetches historical prices (at recommendation date) for VIC ideas.
 * Designed to be run once per day, processing max 10 ideas per run.
 *
 * Logic:
 * 1. Find first author (alphabetically) who hasn't completed price fetching
 * 2. Get up to 10 of their ideas that don't have priceAtRec yet
 * 3. Fetch historical + current prices from Yahoo Finance
 * 4. Update Firestore
 * 5. Mark author complete when all their ideas are done
 *
 * Run with: npm run fetch:prices
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Max ideas to process per run (respect Yahoo Finance rate limits)
const MAX_IDEAS_PER_RUN = 10;

/**
 * Get historical price on a specific date using Yahoo Finance
 */
async function getPriceOnDate(ticker, date) {
  const yahooFinance = (await import('yahoo-finance2')).default;

  const targetDate = new Date(date);

  // Fetch a few days before and after to handle weekends/holidays
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 5);

  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 5);

  try {
    const history = await yahooFinance.historical(ticker, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d'
    });

    if (!history || history.length === 0) {
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
      date: closest.date,
      open: closest.open,
      close: closest.close,
      adjClose: closest.adjClose,
      volume: closest.volume
    };
  } catch (error) {
    console.error(`  Error fetching historical price for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Get current price for a ticker
 */
async function getCurrentPrice(ticker) {
  const yahooFinance = (await import('yahoo-finance2')).default;

  try {
    const quote = await yahooFinance.quote(ticker);

    if (!quote || !quote.regularMarketPrice) {
      return null;
    }

    return {
      price: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      currency: quote.currency
    };
  } catch (error) {
    console.error(`  Error fetching current price for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Find the next author to process (alphabetically, not yet complete)
 */
async function getNextAuthor() {
  // Get all authors ordered by username
  const snapshot = await db.collection('authors')
    .orderBy('username', 'asc')
    .get();

  // Find first one without pricesFetchedAt
  for (const doc of snapshot.docs) {
    const author = doc.data();
    if (!author.pricesFetchedAt) {
      return { id: doc.id, ...author };
    }
  }

  return null; // All authors complete
}

/**
 * Get ideas for an author that need prices
 * Only includes ideas from the past 5 years (aligns with UI's XIRR window)
 */
async function getIdeasNeedingPrices(authorUsername, limit) {
  const snapshot = await db.collection('ideas')
    .where('authorUsername', '==', authorUsername)
    .get();

  // Calculate 5-year cutoff date
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  // Filter to ideas without priceAtRec (null or undefined, but not -1)
  // AND only ideas from the past 5 years
  const needsPrices = snapshot.docs.filter(doc => {
    const data = doc.data();
    const needsPrice = data.priceAtRec === null || data.priceAtRec === undefined;
    if (!needsPrice) return false;

    const postedDate = data.postedDate?.toDate ? data.postedDate.toDate() : new Date(data.postedDate);
    const isWithinFiveYears = postedDate >= fiveYearsAgo;
    return isWithinFiveYears;
  });

  return needsPrices.slice(0, limit).map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Count remaining ideas for an author
 * Only counts ideas from the past 5 years (aligns with UI's XIRR window)
 */
async function countRemainingIdeas(authorUsername) {
  const snapshot = await db.collection('ideas')
    .where('authorUsername', '==', authorUsername)
    .get();

  // Calculate 5-year cutoff date
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  return snapshot.docs.filter(doc => {
    const data = doc.data();
    const needsPrice = data.priceAtRec === null || data.priceAtRec === undefined;
    if (!needsPrice) return false;

    const postedDate = data.postedDate?.toDate ? data.postedDate.toDate() : new Date(data.postedDate);
    const isWithinFiveYears = postedDate >= fiveYearsAgo;
    return isWithinFiveYears;
  }).length;
}

/**
 * Get total author count
 */
async function getTotalAuthorCount() {
  const snapshot = await db.collection('authors').count().get();
  return snapshot.data().count;
}

/**
 * Get completed author count
 */
async function getCompletedAuthorCount() {
  const snapshot = await db.collection('authors')
    .where('pricesFetchedAt', '!=', null)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Main function
 */
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('FETCH HISTORICAL PRICES');
  console.log('='.repeat(60));
  console.log('');

  // Get next author to process
  const author = await getNextAuthor();

  if (!author) {
    console.log('All authors have been processed!');
    process.exit(0);
  }

  const totalAuthors = await getTotalAuthorCount();
  const completedAuthors = await getCompletedAuthorCount();

  console.log(`Author: ${author.username} (${completedAuthors + 1} of ${totalAuthors})`);

  // Get ideas needing prices
  const ideas = await getIdeasNeedingPrices(author.username, MAX_IDEAS_PER_RUN);

  if (ideas.length === 0) {
    // Author has no ideas needing prices, mark complete
    console.log('No ideas need prices. Marking author complete.');
    await db.collection('authors').doc(author.id).update({
      pricesFetchedAt: admin.firestore.Timestamp.now()
    });
    process.exit(0);
  }

  const totalRemaining = await countRemainingIdeas(author.username);
  console.log(`Ideas to process: ${ideas.length} of ${totalRemaining} remaining (max ${MAX_IDEAS_PER_RUN}/day)`);
  console.log('');

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const postedDate = idea.postedDate?.toDate ? idea.postedDate.toDate() : new Date(idea.postedDate);
    const dateStr = postedDate.toISOString().split('T')[0];

    console.log(`[${i + 1}/${ideas.length}] ${idea.ticker} (${dateStr})`);

    // Fetch historical price
    const historical = await getPriceOnDate(idea.ticker, postedDate);

    // Fetch current price
    const current = await getCurrentPrice(idea.ticker);

    if (historical && historical.adjClose) {
      // Update idea with historical price
      await db.collection('ideas').doc(idea.id).update({
        priceAtRec: historical.adjClose,
        priceAtRecDate: admin.firestore.Timestamp.fromDate(historical.date)
      });

      // Update prices collection with current price
      if (current) {
        await db.collection('prices').doc(idea.ticker).set({
          ticker: idea.ticker,
          currentPrice: current.price,
          previousClose: current.previousClose,
          change: current.change,
          changePercent: current.changePercent,
          currency: current.currency,
          lastUpdated: admin.firestore.Timestamp.now()
        }, { merge: true });
      }

      const currentStr = current ? `$${current.price.toFixed(2)}` : 'N/A';
      console.log(`  Historical: $${historical.adjClose.toFixed(2)} | Current: ${currentStr} ✓`);
      successful++;
    } else {
      // Mark as failed (-1) so we don't retry
      await db.collection('ideas').doc(idea.id).update({
        priceAtRec: -1
      });
      console.log(`  ✗ No data (delisted or too old)`);
      failed++;
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Check if author is complete
  const remainingAfter = await countRemainingIdeas(author.username);

  console.log('');
  console.log('-'.repeat(60));

  if (remainingAfter === 0) {
    // Mark author complete
    await db.collection('authors').doc(author.id).update({
      pricesFetchedAt: admin.firestore.Timestamp.now()
    });
    console.log(`Author: ${author.username} - COMPLETE`);

    // Find next author for info
    const nextAuthor = await getNextAuthor();
    if (nextAuthor) {
      console.log(`Next run: ${nextAuthor.username}`);
    } else {
      console.log('Next run: All authors complete!');
    }
  } else {
    console.log(`Author: ${author.username} - IN PROGRESS (${remainingAfter} ideas remaining)`);
    console.log(`Next run: Continue with ${author.username}`);
  }

  console.log('');
  console.log(`Summary: ${successful} successful, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
