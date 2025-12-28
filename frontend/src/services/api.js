/**
 * API service for the local Flask backend
 * Replaces Firestore calls for the local scraper architecture
 */

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Make an API request with error handling
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

// ==================== Health Check ====================

export async function checkHealth() {
    return apiRequest('/health');
}

// ==================== Cookie Management ====================

/**
 * Submit VIC cookies and optionally start scraping
 * @param {Array} cookies - Array of cookie objects from Cookie-Editor
 * @param {boolean} startScrape - Whether to start scraping after saving
 */
export async function submitCookies(cookies, startScrape = false) {
    return apiRequest('/cookies', {
        method: 'POST',
        body: JSON.stringify({ cookies, startScrape }),
    });
}

/**
 * Check if valid cookies are stored
 */
export async function checkCookies() {
    return apiRequest('/cookies');
}

// ==================== Scraping ====================

/**
 * Start the scraping process
 */
export async function startScrape() {
    return apiRequest('/scrape/start', { method: 'POST' });
}

/**
 * Get current scraping status
 */
export async function getScrapeStatus() {
    return apiRequest('/scrape/status');
}

// ==================== Leaderboard ====================

/**
 * Get leaderboard with pagination
 * @param {string} sortBy - Field to sort by (xirr5yr, xirr3yr, xirr1yr)
 * @param {number} limit - Number of results per page
 * @param {number} offset - Offset for pagination
 */
export async function getLeaderboard(sortBy = 'xirr5yr', limit = 25, offset = 0) {
    const params = new URLSearchParams({
        sort: sortBy,
        limit: limit.toString(),
        offset: offset.toString(),
    });

    const result = await apiRequest(`/leaderboard?${params}`);

    // Transform to match existing frontend expectations
    return {
        data: result.data.map((item, index) => ({
            id: item.id,
            username: item.username,
            xirr5yr: item.xirr5yr,
            xirr3yr: item.xirr3yr,
            xirr1yr: item.xirr1yr,
            totalPicks: item.totalPicks,
            winRate: item.winRate,
            bestPickTicker: item.bestPickTicker,
            bestPickReturn: item.bestPickReturn,
            calculatedAt: item.calculatedAt,
            rank: item.rank || offset + index + 1,
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
    };
}

/**
 * Search authors by username
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum results
 */
export async function searchAuthors(searchTerm, limit = 20) {
    if (!searchTerm || searchTerm.trim() === '') {
        return [];
    }

    const params = new URLSearchParams({
        q: searchTerm.trim(),
        limit: limit.toString(),
    });

    const result = await apiRequest(`/leaderboard/search?${params}`);
    return result.data;
}

/**
 * Get author details with their ideas
 * @param {string} username - Author username
 */
export async function getAuthorWithIdeas(username) {
    const result = await apiRequest(`/author/${encodeURIComponent(username)}`);

    // Transform ideas to match frontend expectations
    if (result.ideas) {
        result.ideas = result.ideas.map(idea => ({
            id: idea.id,
            ticker: idea.ticker,
            companyName: idea.companyName,
            postedDate: idea.postedDate,
            positionType: idea.positionType,
            priceAtRec: idea.priceAtRec,
            currentPrice: idea.currentPrice,
            return: idea.return,
        }));
    }

    return result;
}

// ==================== Manual Updates ====================

/**
 * Trigger price update
 */
export async function updatePrices() {
    return apiRequest('/update/prices', { method: 'POST' });
}

/**
 * Trigger metrics recalculation
 */
export async function updateMetrics() {
    return apiRequest('/update/metrics', { method: 'POST' });
}

// ==================== Aggregate Stats ====================

/**
 * Get aggregate statistics
 */
export async function getAggregateStats() {
    const health = await checkHealth();
    return health.stats;
}
