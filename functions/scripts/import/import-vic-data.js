/**
 * Import VIC_IDEAS.sql data into Firestore
 *
 * This script parses the PostgreSQL dump and imports:
 * - Authors (from users table)
 * - Ideas (from ideas + companies tables)
 *
 * Run with: node scripts/import/import-vic-data.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../../service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// File paths
const SQL_FILE = path.join(__dirname, '../../../data/VIC_IDEAS.sql');

// Data storage
const users = new Map(); // user_link -> username
const companies = new Map(); // ticker -> company_name
const ideas = [];

// Stats
const stats = {
  usersProcessed: 0,
  companiesProcessed: 0,
  ideasProcessed: 0,
  authorsCreated: 0,
  ideasCreated: 0,
  errors: []
};

/**
 * Parse a tab-separated COPY line
 */
function parseCopyLine(line) {
  return line.split('\t').map(field => {
    if (field === '\\N') return null;
    if (field === 't') return true;
    if (field === 'f') return false;
    return field;
  });
}

/**
 * Extract username and vicUserId from user_link
 * Example: "/member/JackBlack/3246868" -> { username: "JackBlack", vicUserId: "3246868" }
 */
function parseUserLink(userLink) {
  if (!userLink) return null;
  const match = userLink.match(/\/member\/([^\/]+)\/(\d+)/);
  if (!match) return null;
  return {
    username: match[1],
    vicUserId: match[2]
  };
}

/**
 * Parse timestamp to Firestore Timestamp
 */
function parseTimestamp(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + ' UTC'); // VIC timestamps are in UTC
  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Read and parse the SQL file
 */
async function parseSqlFile() {
  console.log('📖 Reading SQL file:', SQL_FILE);
  console.log('');

  const fileStream = fs.createReadStream(SQL_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentSection = null;

  for await (const line of rl) {
    // Detect section starts
    if (line.startsWith('COPY public.users')) {
      currentSection = 'users';
      console.log('📊 Parsing users table...');
      continue;
    } else if (line.startsWith('COPY public.companies')) {
      currentSection = 'companies';
      console.log('📊 Parsing companies table...');
      continue;
    } else if (line.startsWith('COPY public.ideas')) {
      currentSection = 'ideas';
      console.log('📊 Parsing ideas table...');
      continue;
    } else if (line === '\\.') {
      // End of COPY section
      if (currentSection === 'users') {
        console.log(`   ✓ Parsed ${users.size} users`);
      } else if (currentSection === 'companies') {
        console.log(`   ✓ Parsed ${companies.size} companies`);
      } else if (currentSection === 'ideas') {
        console.log(`   ✓ Parsed ${ideas.length} ideas`);
      }
      currentSection = null;
      continue;
    }

    // Parse data lines
    if (currentSection === 'users') {
      const [userLink, username] = parseCopyLine(line);
      if (userLink && username) {
        users.set(userLink, username);
        stats.usersProcessed++;
      }
    } else if (currentSection === 'companies') {
      const [ticker, companyName] = parseCopyLine(line);
      if (ticker) {
        companies.set(ticker, companyName);
        stats.companiesProcessed++;
      }
    } else if (currentSection === 'ideas') {
      const [id, link, ticker, userLink, date, isShort, isContestWinner] = parseCopyLine(line);
      if (id && userLink && ticker && date) {
        const userInfo = parseUserLink(userLink);
        if (userInfo) {
          ideas.push({
            vicIdeaId: id,
            authorUsername: userInfo.username,
            authorVicUserId: userInfo.vicUserId,
            ticker: ticker,
            companyName: companies.get(ticker) || ticker,
            postedDate: parseTimestamp(date),
            positionType: isShort ? 'short' : 'long',
            isContestWinner: isContestWinner || false
          });
          stats.ideasProcessed++;
        }
      }
    }
  }

  console.log('');
  console.log('✅ SQL file parsed successfully!');
  console.log(`   Users: ${stats.usersProcessed}`);
  console.log(`   Companies: ${stats.companiesProcessed}`);
  console.log(`   Ideas: ${stats.ideasProcessed}`);
  console.log('');
}

/**
 * Import authors to Firestore
 */
async function importAuthors() {
  console.log('👥 Importing authors to Firestore...');

  // Get unique authors from ideas
  const authorMap = new Map();
  for (const idea of ideas) {
    if (!authorMap.has(idea.authorUsername)) {
      authorMap.set(idea.authorUsername, {
        username: idea.authorUsername,
        vicUserId: idea.authorVicUserId,
        profileUrl: `https://valueinvestorsclub.com/member/${idea.authorUsername}/${idea.authorVicUserId}`,
        discoveredAt: admin.firestore.Timestamp.now(),
        lastScrapedAt: null
      });
    }
  }

  console.log(`   Found ${authorMap.size} unique authors`);

  // Batch write authors
  let batch = db.batch();
  let batchCount = 0;
  let totalCount = 0;

  for (const [username, authorData] of authorMap) {
    const authorRef = db.collection('authors').doc(username);
    batch.set(authorRef, authorData, { merge: true });
    batchCount++;
    totalCount++;

    // Firestore batch limit is 500
    if (batchCount === 500) {
      await batch.commit();
      console.log(`   ✓ Imported ${totalCount} authors...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  stats.authorsCreated = totalCount;
  console.log(`   ✅ Imported ${totalCount} authors total`);
  console.log('');
}

/**
 * Import ideas to Firestore
 */
async function importIdeas() {
  console.log('💡 Importing ideas to Firestore...');
  console.log(`   Total ideas to import: ${ideas.length}`);

  let batch = db.batch();
  let batchCount = 0;
  let totalCount = 0;

  for (const idea of ideas) {
    const ideaRef = db.collection('ideas').doc(idea.vicIdeaId);

    const ideaData = {
      authorUsername: idea.authorUsername,
      vicIdeaId: idea.vicIdeaId,
      ticker: idea.ticker,
      companyName: idea.companyName,
      ideaUrl: `https://valueinvestorsclub.com/idea/${idea.companyName.replace(/\s+/g, '_')}/${idea.vicIdeaId}`,
      postedDate: idea.postedDate,
      positionType: idea.positionType,
      isContestWinner: idea.isContestWinner,
      priceAtRec: null, // Will be filled later if we scrape
      marketCapAtRec: null, // Will be filled later if we scrape
      scrapedAt: null
    };

    batch.set(ideaRef, ideaData, { merge: true });
    batchCount++;
    totalCount++;

    // Firestore batch limit is 500
    if (batchCount === 500) {
      await batch.commit();
      console.log(`   ✓ Imported ${totalCount} / ${ideas.length} ideas (${Math.round(totalCount/ideas.length*100)}%)`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  stats.ideasCreated = totalCount;
  console.log(`   ✅ Imported ${totalCount} ideas total`);
  console.log('');
}

/**
 * Main import function
 */
async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('VIC IDEAS SQL IMPORT');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Step 1: Parse SQL file
    await parseSqlFile();

    // Step 2: Import authors
    await importAuthors();

    // Step 3: Import ideas
    await importIdeas();

    // Summary
    console.log('='.repeat(70));
    console.log('✅ IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log('');
    console.log('Summary:');
    console.log(`  Authors imported: ${stats.authorsCreated}`);
    console.log(`  Ideas imported: ${stats.ideasCreated}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: npm run update:prices  (fetch current stock prices)');
    console.log('  2. Run: npm run update:metrics (calculate XIRR for all authors)');
    console.log('');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run import
main();
