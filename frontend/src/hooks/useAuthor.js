import { useState, useEffect } from 'react';
import { getAuthorWithIdeas } from '../services/firestore';

/**
 * Hook to fetch author details with their ideas
 * @param {string} username - Author username to fetch
 */
export function useAuthor(username) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!username) {
            setData(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        getAuthorWithIdeas(username)
            .then(result => {
                if (!cancelled) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    console.error('Error fetching author:', err);
                    setError(err);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [username]);

    return { data, loading, error };
}
