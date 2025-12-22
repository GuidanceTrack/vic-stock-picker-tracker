import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Get leaderboard sorted by XIRR
 * @param {string} sortBy - Field to sort by (xirr5yr, xirr3yr, xirr1yr)
 * @param {number} limitCount - Max number of results
 */
export async function getLeaderboard(sortBy = 'xirr5yr', limitCount = 50) {
    const metricsRef = collection(db, 'authorMetrics');
    const q = query(
        metricsRef,
        orderBy(sortBy, 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        ...doc.data()
    }));
}

/**
 * Get single author with their ideas
 * @param {string} username - Author username
 */
export async function getAuthorWithIdeas(username) {
    // Get author metrics
    const metricsDoc = await getDoc(doc(db, 'authorMetrics', username));

    if (!metricsDoc.exists()) {
        return null;
    }

    const metrics = metricsDoc.data();

    // Get their ideas (simple query without orderBy to avoid index requirement)
    const ideasRef = collection(db, 'ideas');
    const q = query(
        ideasRef,
        where('authorUsername', '==', username)
    );
    const ideasSnap = await getDocs(q);
    let ideas = ideasSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Sort client-side by postedDate descending
    ideas.sort((a, b) => {
        const dateA = a.postedDate?.seconds || 0;
        const dateB = b.postedDate?.seconds || 0;
        return dateB - dateA;
    });

    // Get current prices for each idea's ticker
    const pricesRef = collection(db, 'prices');
    const tickers = [...new Set(ideas.map(i => i.ticker))];
    const pricePromises = tickers.map(async (ticker) => {
        const priceDoc = await getDoc(doc(db, 'prices', ticker));
        return priceDoc.exists() ? { ticker, ...priceDoc.data() } : null;
    });
    const pricesData = await Promise.all(pricePromises);
    const pricesMap = {};
    pricesData.filter(p => p).forEach(p => {
        pricesMap[p.ticker] = p.currentPrice;
    });

    // Add current prices and calculate returns for each idea
    const ideasWithReturns = ideas.map(idea => {
        const currentPrice = pricesMap[idea.ticker] || null;
        let returnPct = null;

        if (currentPrice && idea.priceAtRec) {
            if (idea.positionType === 'long') {
                returnPct = ((currentPrice - idea.priceAtRec) / idea.priceAtRec) * 100;
            } else {
                returnPct = ((idea.priceAtRec - currentPrice) / idea.priceAtRec) * 100;
            }
        }

        return {
            ...idea,
            currentPrice,
            return: returnPct ? Math.round(returnPct) : null
        };
    });

    return { ...metrics, ideas: ideasWithReturns };
}

/**
 * Get aggregate stats for the leaderboard banner
 */
export async function getAggregateStats() {
    const statsDoc = await getDoc(doc(db, 'stats', 'aggregate'));
    return statsDoc.exists() ? statsDoc.data() : null;
}
