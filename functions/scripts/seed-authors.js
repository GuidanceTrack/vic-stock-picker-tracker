/**
 * Seed script - Add initial authors to the database
 *
 * Run with: npm run seed
 *
 * This script populates the authors collection with initial
 * VIC members to start the scraping queue.
 *
 * HOW TO FIND AUTHOR INFO:
 * 1. Go to any VIC idea page
 * 2. Click on the author's name
 * 3. The URL will be: /member/{username}/{userId}
 * 4. Add both values to the SEED_AUTHORS array below
 */

import { addAuthor, getAllAuthors } from '../src/services/firebase.js';

// ============================================
// ADD YOUR VIC AUTHORS HERE
// ============================================
// Format: { username: 'their_username', vicUserId: 'their_user_id' }
//
// Find these by visiting an author's profile on VIC.
// The URL looks like: https://valueinvestorsclub.com/member/USERNAME/USER_ID

const SEED_AUTHORS = [
    // Real VIC authors (found from public search results)
    { username: 'michael99', vicUserId: '1219' },
    { username: 'charlie479', vicUserId: '1180' },
    { username: 'mack885', vicUserId: '2190' },
    { username: 'devo791', vicUserId: '1925' },
    { username: 'Motherlode', vicUserId: '108010' },
    { username: 'newman9', vicUserId: '36430' },
    { username: 'JackBlack', vicUserId: '25973' },
    { username: 'onodacapital', vicUserId: '149079' },
    { username: 'falcon44', vicUserId: '42407' },
    { username: 'rosco37', vicUserId: '25436' },
];

async function seedAuthors() {
    console.log('=== Seeding Authors ===\n');

    if (SEED_AUTHORS.length === 0) {
        console.log('No authors to seed!');
        console.log('\nTo add authors:');
        console.log('1. Open this file: functions/scripts/seed-authors.js');
        console.log('2. Add VIC authors to the SEED_AUTHORS array');
        console.log('3. Run this script again: npm run seed');
        console.log('\nHow to find author info:');
        console.log('- Go to any VIC author profile');
        console.log('- URL format: /member/{username}/{userId}');
        console.log('- Example: /member/valuehunter92/25973');
        process.exit(0);
    }

    console.log(`Adding ${SEED_AUTHORS.length} authors...\n`);

    let added = 0;
    let errors = 0;

    for (const author of SEED_AUTHORS) {
        try {
            await addAuthor(author);
            added++;
        } catch (error) {
            console.error(`Failed to add ${author.username}:`, error.message);
            errors++;
        }
    }

    console.log(`\n=== Seeding Complete ===`);
    console.log(`Added: ${added}`);
    console.log(`Errors: ${errors}`);

    // Show current state
    console.log('\n=== Current Authors in Database ===');
    const allAuthors = await getAllAuthors();

    if (allAuthors.length === 0) {
        console.log('No authors found in database.');
    } else {
        allAuthors.forEach((author, i) => {
            const scraped = author.lastScrapedAt
                ? `last scraped: ${author.lastScrapedAt.toDate().toLocaleDateString()}`
                : 'never scraped';
            console.log(`${i + 1}. ${author.username} (${scraped})`);
        });
    }

    process.exit(0);
}

// Run seeder
seedAuthors().catch(error => {
    console.error('Seed script failed:', error);
    process.exit(1);
});
