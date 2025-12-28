/**
 * Hook for fetching author details from local Flask API
 * Replaces useAuthor.js for local scraper architecture
 */

import { useState, useEffect } from 'react';
import { getAuthorWithIdeas } from '../services/api';

/**
 * Hook for fetching author details with their ideas
 * @param {string} username - Author username
 */
export function useLocalAuthor(username) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!username) {
            setData(null);
            setLoading(false);
            return;
        }

        let isMounted = true;

        async function fetchAuthor() {
            setLoading(true);
            setError(null);

            try {
                const result = await getAuthorWithIdeas(username);

                if (isMounted) {
                    setData(result);
                }
            } catch (err) {
                console.error(`Error fetching author ${username}:`, err);
                if (isMounted) {
                    setError(err);
                    setData(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchAuthor();

        return () => {
            isMounted = false;
        };
    }, [username]);

    return { data, loading, error };
}

export default useLocalAuthor;
