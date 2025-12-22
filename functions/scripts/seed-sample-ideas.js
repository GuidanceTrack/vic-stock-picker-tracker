/**
 * Seed Sample Ideas Script
 *
 * Creates sample ideas with real tickers for testing the data pipeline.
 * This allows us to test price fetching and XIRR calculation without
 * needing the VIC scraper to work.
 *
 * Run with: npm run seed:ideas
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
if (getApps().length === 0) {
    const serviceAccountPath = join(__dirname, '../service-account-key.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// Sample ideas with real tickers and realistic historical prices
const sampleIdeas = [
    // Michael99's ideas
    {
        authorUsername: 'michael99',
        vicIdeaId: '1001001',
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        ideaUrl: 'https://valueinvestorsclub.com/idea/AAPL/1001001',
        postedDate: new Date('2022-01-15'),
        positionType: 'long',
        priceAtRec: 172.50,
        isContestWinner: true
    },
    {
        authorUsername: 'michael99',
        vicIdeaId: '1001002',
        ticker: 'GOOGL',
        companyName: 'Alphabet Inc',
        ideaUrl: 'https://valueinvestorsclub.com/idea/GOOGL/1001002',
        postedDate: new Date('2022-06-20'),
        positionType: 'long',
        priceAtRec: 112.25,
        isContestWinner: false
    },
    {
        authorUsername: 'michael99',
        vicIdeaId: '1001003',
        ticker: 'MSFT',
        companyName: 'Microsoft Corp',
        ideaUrl: 'https://valueinvestorsclub.com/idea/MSFT/1001003',
        postedDate: new Date('2023-03-10'),
        positionType: 'long',
        priceAtRec: 255.00,
        isContestWinner: false
    },
    // Charlie479's ideas
    {
        authorUsername: 'charlie479',
        vicIdeaId: '1002001',
        ticker: 'BRK.B',
        companyName: 'Berkshire Hathaway',
        ideaUrl: 'https://valueinvestorsclub.com/idea/BRK-B/1002001',
        postedDate: new Date('2021-09-01'),
        positionType: 'long',
        priceAtRec: 275.50,
        isContestWinner: false
    },
    {
        authorUsername: 'charlie479',
        vicIdeaId: '1002002',
        ticker: 'JPM',
        companyName: 'JPMorgan Chase',
        ideaUrl: 'https://valueinvestorsclub.com/idea/JPM/1002002',
        postedDate: new Date('2022-10-15'),
        positionType: 'long',
        priceAtRec: 115.00,
        isContestWinner: true
    },
    {
        authorUsername: 'charlie479',
        vicIdeaId: '1002003',
        ticker: 'V',
        companyName: 'Visa Inc',
        ideaUrl: 'https://valueinvestorsclub.com/idea/V/1002003',
        postedDate: new Date('2023-01-20'),
        positionType: 'long',
        priceAtRec: 215.00,
        isContestWinner: false
    },
    // Mack885's ideas
    {
        authorUsername: 'mack885',
        vicIdeaId: '1003001',
        ticker: 'CROX',
        companyName: 'Crocs Inc',
        ideaUrl: 'https://valueinvestorsclub.com/idea/CROX/1003001',
        postedDate: new Date('2021-03-15'),
        positionType: 'long',
        priceAtRec: 72.00,
        isContestWinner: true
    },
    {
        authorUsername: 'mack885',
        vicIdeaId: '1003002',
        ticker: 'META',
        companyName: 'Meta Platforms',
        ideaUrl: 'https://valueinvestorsclub.com/idea/META/1003002',
        postedDate: new Date('2022-11-01'),
        positionType: 'long',
        priceAtRec: 98.00,
        isContestWinner: false
    },
    {
        authorUsername: 'mack885',
        vicIdeaId: '1003003',
        ticker: 'NVDA',
        companyName: 'NVIDIA Corp',
        ideaUrl: 'https://valueinvestorsclub.com/idea/NVDA/1003003',
        postedDate: new Date('2023-05-01'),
        positionType: 'long',
        priceAtRec: 280.00,
        isContestWinner: false
    },
    // Devo791's ideas (some shorts)
    {
        authorUsername: 'devo791',
        vicIdeaId: '1004001',
        ticker: 'TSLA',
        companyName: 'Tesla Inc',
        ideaUrl: 'https://valueinvestorsclub.com/idea/TSLA/1004001',
        postedDate: new Date('2022-01-01'),
        positionType: 'short',
        priceAtRec: 380.00,
        isContestWinner: false
    },
    {
        authorUsername: 'devo791',
        vicIdeaId: '1004002',
        ticker: 'AMZN',
        companyName: 'Amazon.com Inc',
        ideaUrl: 'https://valueinvestorsclub.com/idea/AMZN/1004002',
        postedDate: new Date('2023-02-15'),
        positionType: 'long',
        priceAtRec: 100.00,
        isContestWinner: false
    },
    // Motherlode's ideas
    {
        authorUsername: 'Motherlode',
        vicIdeaId: '1005001',
        ticker: 'UNH',
        companyName: 'UnitedHealth Group',
        ideaUrl: 'https://valueinvestorsclub.com/idea/UNH/1005001',
        postedDate: new Date('2022-04-01'),
        positionType: 'long',
        priceAtRec: 510.00,
        isContestWinner: false
    },
    {
        authorUsername: 'Motherlode',
        vicIdeaId: '1005002',
        ticker: 'HD',
        companyName: 'Home Depot',
        ideaUrl: 'https://valueinvestorsclub.com/idea/HD/1005002',
        postedDate: new Date('2022-08-10'),
        positionType: 'long',
        priceAtRec: 290.00,
        isContestWinner: true
    }
];

async function seedSampleIdeas() {
    console.log('=== Seeding Sample Ideas ===\n');

    const batch = db.batch();
    let count = 0;

    for (const idea of sampleIdeas) {
        const docRef = db.collection('ideas').doc(idea.vicIdeaId);

        batch.set(docRef, {
            ...idea,
            postedDate: Timestamp.fromDate(idea.postedDate),
            scrapedAt: Timestamp.now(),
            marketCapAtRec: null
        });

        console.log(`  Adding: ${idea.ticker} by ${idea.authorUsername}`);
        count++;
    }

    await batch.commit();

    console.log(`\n✓ Seeded ${count} sample ideas`);
    console.log('\nAuthors with ideas:');

    // Count ideas per author
    const authorCounts = {};
    for (const idea of sampleIdeas) {
        authorCounts[idea.authorUsername] = (authorCounts[idea.authorUsername] || 0) + 1;
    }

    for (const [author, count] of Object.entries(authorCounts)) {
        console.log(`  - ${author}: ${count} ideas`);
    }

    console.log('\nNow run:');
    console.log('  npm run update:prices   # Fetch current prices');
    console.log('  npm run update:metrics  # Calculate XIRR metrics');
}

seedSampleIdeas().then(() => {
    console.log('\nDone!');
    process.exit(0);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
