/**
 * Mark Inactive Authors Script
 *
 * Pre-processes all authors and marks those who don't have any ideas
 * in the past 5 years. This allows the fetch-prices script to skip them
 * immediately without querying their ideas.
 *
 * Run with: npm run mark:inactive
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Main function
 */
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('MARK INACTIVE AUTHORS (No ideas in past 5 years)');
  console.log('='.repeat(60));
  console.log('');

  // Calculate 5-year cutoff date
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  console.log(`Cutoff date: ${fiveYearsAgo.toISOString().split('T')[0]}`);
  console.log('');

  // Get all authors who haven't been processed yet
  const authorsSnapshot = await db.collection('authors')
    .where('pricesFetchedAt', '==', null)
    .get();

  // Also get authors where pricesFetchedAt doesn't exist
  const authorsSnapshot2 = await db.collection('authors').get();
  const unprocessedAuthors = authorsSnapshot2.docs.filter(doc => {
    const data = doc.data();
    return data.pricesFetchedAt === null || data.pricesFetchedAt === undefined;
  });

  console.log(`Unprocessed authors: ${unprocessedAuthors.length}`);
  console.log('');

  let markedInactive = 0;
  let hasRecentIdeas = 0;
  let processed = 0;

  for (const authorDoc of unprocessedAuthors) {
    const author = authorDoc.data();
    processed++;

    // Get all ideas for this author
    const ideasSnapshot = await db.collection('ideas')
      .where('authorUsername', '==', author.username)
      .get();

    // Check if any ideas are within 5 years
    const hasRecentIdea = ideasSnapshot.docs.some(doc => {
      const data = doc.data();
      const postedDate = data.postedDate?.toDate ? data.postedDate.toDate() : new Date(data.postedDate);
      return postedDate >= fiveYearsAgo;
    });

    if (!hasRecentIdea) {
      // Mark as complete (no recent ideas to process)
      await db.collection('authors').doc(authorDoc.id).update({
        pricesFetchedAt: admin.firestore.Timestamp.now(),
        noRecentIdeas: true  // Flag to indicate why they were marked complete
      });
      markedInactive++;
      process.stdout.write(`\r[${processed}/${unprocessedAuthors.length}] Marked inactive: ${markedInactive} | Has recent: ${hasRecentIdeas}`);
    } else {
      hasRecentIdeas++;
      process.stdout.write(`\r[${processed}/${unprocessedAuthors.length}] Marked inactive: ${markedInactive} | Has recent: ${hasRecentIdeas}`);
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed:     ${processed}`);
  console.log(`Marked inactive:     ${markedInactive} (no ideas in past 5 years)`);
  console.log(`Has recent ideas:    ${hasRecentIdeas} (will need price fetching)`);
  console.log('='.repeat(60));
  console.log('');

  process.exit(0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
