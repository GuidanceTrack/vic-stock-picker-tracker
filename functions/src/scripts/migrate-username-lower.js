/**
 * Migration script to add usernameLower field to existing authorMetrics documents
 *
 * This enables case-insensitive search by username.
 *
 * Run with: node src/scripts/migrate-username-lower.js
 */

import { db } from '../services/firebase.js';

async function migrateUsernameLower() {
    console.log('=== Migrating authorMetrics: Adding usernameLower field ===\n');

    try {
        const snapshot = await db.collection('authorMetrics').get();

        if (snapshot.empty) {
            console.log('No documents found in authorMetrics collection.');
            return;
        }

        console.log(`Found ${snapshot.docs.length} documents to update.\n`);

        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Skip if usernameLower already exists
            if (data.usernameLower) {
                skipped++;
                continue;
            }

            const username = data.username || doc.id;

            try {
                await doc.ref.update({
                    usernameLower: username.toLowerCase()
                });
                updated++;
                console.log(`Updated: ${username}`);
            } catch (error) {
                failed++;
                console.error(`Failed to update ${username}:`, error.message);
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`Updated: ${updated}`);
        console.log(`Skipped (already had field): ${skipped}`);
        console.log(`Failed: ${failed}`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

migrateUsernameLower();
