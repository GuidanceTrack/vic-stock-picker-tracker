import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { searchAuthors } from '../services/firestore';

/**
 * Hook to fetch and subscribe to leaderboard data
 * @param {string} sortBy - Field to sort by (xirr5yr, xirr3yr, xirr1yr)
 * @param {number} limitCount - Max number of results
 * @param {string} searchTerm - Optional search term to filter by username
 */
export function useLeaderboard(sortBy = 'xirr5yr', limitCount = 50, searchTerm = '') {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // If searching, use the search function instead of real-time listener
        if (searchTerm && searchTerm.trim() !== '') {
            searchAuthors(searchTerm, limitCount)
                .then((results) => {
                    // Sort search results by the selected XIRR field
                    const sorted = results.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
                    setData(sorted);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Error searching authors:', err);
                    setError(err);
                    setLoading(false);
                });

            // No cleanup needed for one-time fetch
            return;
        }

        // Default: real-time listener for leaderboard
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
    }, [sortBy, limitCount, searchTerm]);

    return { data, loading, error };
}
