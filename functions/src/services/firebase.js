import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
function initFirebase() {
    if (getApps().length > 0) {
        return getFirestore();
    }

    // Check for service account key
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
        || join(__dirname, '../../service-account-key.json');

    try {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (error) {
        // Fallback: try default credentials (for Cloud Functions environment)
        console.log('No service account file found, using default credentials');
        initializeApp();
    }

    return getFirestore();
}

const db = initFirebase();

// ============ AUTHORS ============

export async function getNextAuthorToScrape() {
    const snapshot = await db.collection('authors')
        .orderBy('lastScrapedAt', 'asc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        // Try to get authors that have never been scraped
        const neverScraped = await db.collection('authors')
            .where('lastScrapedAt', '==', null)
            .limit(1)
            .get();

        if (neverScraped.empty) {
            return null;
        }
        return { id: neverScraped.docs[0].id, ...neverScraped.docs[0].data() };
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function addAuthor(author) {
    const docRef = db.collection('authors').doc(author.username);
    await docRef.set({
        username: author.username,
        vicUserId: author.vicUserId,
        profileUrl: `https://valueinvestorsclub.com/member/${author.username}/${author.vicUserId}`,
        discoveredAt: Timestamp.now(),
        lastScrapedAt: null
    }, { merge: true });

    console.log(`Added/updated author: ${author.username}`);
    return docRef.id;
}

export async function updateAuthorScrapedAt(username) {
    await db.collection('authors').doc(username).update({
        lastScrapedAt: Timestamp.now()
    });
}

export async function getAllAuthors() {
    const snapshot = await db.collection('authors').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============ IDEAS ============

export async function addIdea(idea) {
    const docRef = db.collection('ideas').doc(idea.vicIdeaId);

    // Check if idea already exists
    const existing = await docRef.get();
    if (existing.exists) {
        console.log(`Idea ${idea.vicIdeaId} already exists, skipping`);
        return null;
    }

    await docRef.set({
        authorUsername: idea.authorUsername,
        vicIdeaId: idea.vicIdeaId,
        ticker: idea.ticker,
        companyName: idea.companyName || null,
        ideaUrl: idea.ideaUrl,
        postedDate: idea.postedDate ? Timestamp.fromDate(new Date(idea.postedDate)) : null,
        positionType: idea.positionType || 'long',
        priceAtRec: idea.priceAtRec || null,
        marketCapAtRec: idea.marketCapAtRec || null,
        isContestWinner: idea.isContestWinner || false,
        scrapedAt: Timestamp.now()
    });

    console.log(`Added idea: ${idea.ticker} (${idea.vicIdeaId})`);
    return docRef.id;
}

export async function getIdeasByAuthor(username) {
    const snapshot = await db.collection('ideas')
        .where('authorUsername', '==', username)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function ideaExists(vicIdeaId) {
    const doc = await db.collection('ideas').doc(vicIdeaId).get();
    return doc.exists;
}

// ============ SCRAPE LOG ============

export async function logScrapeStart(authorUsername, jobType = 'daily_scrape') {
    const docRef = await db.collection('scrapeLog').add({
        authorUsername,
        jobType,
        status: 'pending',
        startedAt: Timestamp.now(),
        completedAt: null,
        itemsProcessed: 0,
        errorMessage: null
    });
    return docRef.id;
}

export async function logScrapeComplete(logId, itemsProcessed) {
    await db.collection('scrapeLog').doc(logId).update({
        status: 'success',
        completedAt: Timestamp.now(),
        itemsProcessed
    });
}

export async function logScrapeFailed(logId, errorMessage) {
    await db.collection('scrapeLog').doc(logId).update({
        status: 'failed',
        completedAt: Timestamp.now(),
        errorMessage
    });
}

export { db, Timestamp };
