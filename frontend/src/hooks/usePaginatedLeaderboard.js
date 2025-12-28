import { useState, useEffect, useCallback, useRef } from 'react';
import { getPaginatedLeaderboard, getAuthorCount } from '../services/firestore';

const PAGE_SIZE = 25;

/**
 * Hook for paginated leaderboard data with cursor caching
 * @param {string} sortBy - Field to sort by (xirr5yr, xirr3yr, xirr1yr)
 */
export function usePaginatedLeaderboard(sortBy = 'xirr5yr') {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(sortBy !== null);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // If sortBy is null, hook is disabled - return empty state
    const isDisabled = sortBy === null;

    // Cache: pageNumber -> last document of that page (cursor for next page)
    const cursorCache = useRef(new Map());
    // Track the current sort field to detect changes
    const lastSortBy = useRef(sortBy);

    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // Reset when sort field changes
    useEffect(() => {
        if (lastSortBy.current !== sortBy) {
            cursorCache.current.clear();
            setCurrentPage(1);
            lastSortBy.current = sortBy;
        }
    }, [sortBy]);

    // Fetch total count on mount
    useEffect(() => {
        if (isDisabled) return;

        const fetchCount = async () => {
            try {
                const count = await getAuthorCount();
                setTotalCount(count);
            } catch (err) {
                console.error('Error fetching author count:', err);
            }
        };
        fetchCount();
    }, [isDisabled]);

    // Fetch page data
    const fetchPage = useCallback(async (pageNum) => {
        setLoading(true);
        setError(null);

        try {
            let cursor = null;

            if (pageNum > 1) {
                // Check if we have the cursor for this page
                cursor = cursorCache.current.get(pageNum - 1);

                if (!cursor) {
                    // Need to fetch pages sequentially to build cursors
                    await fetchPagesUpTo(pageNum - 1);
                    cursor = cursorCache.current.get(pageNum - 1);
                }
            }

            const result = await getPaginatedLeaderboard(sortBy, PAGE_SIZE, cursor);

            // Calculate ranks based on page number
            const baseRank = (pageNum - 1) * PAGE_SIZE;
            const investors = result.data.map((investor, index) => ({
                ...investor,
                rank: baseRank + index + 1
            }));

            // Cache the last document as cursor for next page
            if (result.lastDoc) {
                cursorCache.current.set(pageNum, result.lastDoc);
            }

            setData(investors);
            setCurrentPage(pageNum);
        } catch (err) {
            console.error('Error fetching page:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [sortBy]);

    // Helper to fetch pages sequentially up to a target page
    const fetchPagesUpTo = async (targetPage) => {
        for (let page = 1; page <= targetPage; page++) {
            if (cursorCache.current.has(page)) continue;

            const cursor = page > 1 ? cursorCache.current.get(page - 1) : null;
            const result = await getPaginatedLeaderboard(sortBy, PAGE_SIZE, cursor);

            if (result.lastDoc) {
                cursorCache.current.set(page, result.lastDoc);
            }
        }
    };

    // Fetch first page on mount and when sort changes
    useEffect(() => {
        if (isDisabled) return;
        fetchPage(1);
    }, [sortBy, fetchPage, isDisabled]);

    // Navigation functions
    const goToPage = useCallback((pageNum) => {
        if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
            fetchPage(pageNum);
        }
    }, [fetchPage, totalPages, currentPage]);

    const nextPage = useCallback(() => {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    }, [currentPage, totalPages, goToPage]);

    const prevPage = useCallback(() => {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    }, [currentPage, goToPage]);

    return {
        data,
        loading,
        error,
        currentPage,
        totalPages,
        totalCount,
        pageSize: PAGE_SIZE,
        goToPage,
        nextPage,
        prevPage
    };
}
