import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Hook to fetch and subscribe to leaderboard data
 * @param {string} sortBy - Field to sort by (xirr5yr, xirr3yr, xirr1yr)
 * @param {number} limitCount - Max number of results
 */
export function useLeaderboard(sortBy = 'xirr5yr', limitCount = 50) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        const metricsRef = collection(db, 'authorMetrics');
        const q = query(
            metricsRef,
            orderBy(sortBy, 'desc'),
            limit(limitCount)
        );

        // Real-time listener - updates automatically when data changes
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const investors = snapshot.docs.map((doc, index) => ({
                    id: doc.id,
                    rank: index + 1,
                    ...doc.data()
                }));
                setData(investors);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching leaderboard:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [sortBy, limitCount]);

    return { data, loading, error };
}
