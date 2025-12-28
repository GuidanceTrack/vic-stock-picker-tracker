/**
 * Hook for tracking scrape status from local Flask API
 */

import { useState, useEffect, useCallback } from 'react';
import { getScrapeStatus } from '../services/api';

/**
 * Hook for tracking the scraping process status
 * @param {boolean} enabled - Whether to poll for status updates
 * @param {number} pollInterval - Polling interval in milliseconds
 */
export function useScrapeStatus(enabled = true, pollInterval = 2000) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStatus = useCallback(async () => {
        try {
            const result = await getScrapeStatus();
            setStatus(result);
            setError(null);
        } catch (err) {
            console.error('Error fetching scrape status:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (enabled) {
            fetchStatus();
        }
    }, [enabled, fetchStatus]);

    // Polling when scrape is running
    useEffect(() => {
        if (!enabled || !status?.is_running) {
            return;
        }

        const interval = setInterval(fetchStatus, pollInterval);

        return () => clearInterval(interval);
    }, [enabled, status?.is_running, pollInterval, fetchStatus]);

    return {
        status,
        loading,
        error,
        refresh: fetchStatus,
        isRunning: status?.is_running || false,
        currentStep: status?.current_step || null,
        progress: status?.progress || 0,
        currentItem: status?.current_item || null,
    };
}

export default useScrapeStatus;
