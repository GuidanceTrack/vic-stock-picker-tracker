/**
 * Hook for fetching leaderboard data from local Flask API
 * Replaces useLeaderboard.js for local scraper architecture
 */

import { useState, useEffect, useCallback } from 'react';
import { getLeaderboard, searchAuthors } from '../services/api';

/**
 * Hook for paginated leaderboard with search
 * @param {string} sortBy - Field to sort by (xirr5yr, xirr3yr, xirr1yr)
 * @param {number} pageSize - Items per page
 * @param {string} searchTerm - Search term for filtering
 */
export function useLocalLeaderboard(sortBy = 'xirr5yr', pageSize = 25, searchTerm = '') {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Fetch data
    const fetchData = useCallback(async () => {
        // Skip if disabled (sortBy is null)
        if (sortBy === null) {
            setData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (searchTerm && searchTerm.trim()) {
                // Search mode
                const results = await searchAuthors(searchTerm);
                setData(results);
                setTotalCount(results.length);
                setTotalPages(1);
            } else {
                // Paginated mode
                const offset = (currentPage - 1) * pageSize;
                const result = await getLeaderboard(sortBy, pageSize, offset);

                setData(result.data);
                setTotalCount(result.total);
                setTotalPages(Math.ceil(result.total / pageSize));
            }
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            setError(err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [sortBy, pageSize, currentPage, searchTerm]);

    // Fetch on mount and when dependencies change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset to page 1 when sort or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [sortBy, searchTerm]);

    // Page navigation
    const goToPage = useCallback((page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    }, [totalPages]);

    const goToNextPage = useCallback(() => {
        goToPage(currentPage + 1);
    }, [currentPage, goToPage]);

    const goToPreviousPage = useCallback(() => {
        goToPage(currentPage - 1);
    }, [currentPage, goToPage]);

    return {
        data,
        loading,
        error,
        currentPage,
        totalPages,
        totalCount,
        pageSize,
        goToPage,
        goToNextPage,
        goToPreviousPage,
        refresh: fetchData,
    };
}

export default useLocalLeaderboard;
