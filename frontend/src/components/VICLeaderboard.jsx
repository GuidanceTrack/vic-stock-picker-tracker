import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ExternalLink, Target, Clock, BarChart3, Info, Loader2, AlertCircle, Search, X, RefreshCw } from 'lucide-react';
import { usePaginatedLeaderboard } from '../hooks/usePaginatedLeaderboard';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAuthor } from '../hooks/useAuthor';
import { useLocalLeaderboard } from '../hooks/useLocalLeaderboard';
import { useLocalAuthor } from '../hooks/useLocalAuthor';
import Pagination from './Pagination';
import CookieModal from './CookieModal';
import { verifyCookies } from '../services/api';

// Custom hook for debouncing
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const XIRRBadge = ({ value }) => {
  if (value === null || value === undefined) {
    return <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-500">N/A</span>;
  }

  const getColor = (val) => {
    if (val >= 25) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (val >= 15) return 'bg-green-100 text-green-800 border-green-300';
    if (val >= 10) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (val >= 0) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getColor(value)}`}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
};

const ReturnBadge = ({ value, type = "long" }) => {
  if (value === null || value === undefined) {
    return <span className="text-xs text-slate-400">N/A</span>;
  }

  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? '+' : ''}{Math.round(value)}%
      {type === "short" && <span className="text-xs opacity-70">(S)</span>}
    </span>
  );
};

const RankBadge = ({ rank, isSearchResult = false }) => {
  if (isSearchResult || rank === null || rank === undefined) {
    return <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm text-slate-400">-</span>;
  }
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">{rank}</span>;
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="animate-spin text-blue-600" size={32} />
    <span className="ml-3 text-slate-600">Loading leaderboard...</span>
  </div>
);

const ErrorMessage = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <AlertCircle className="text-red-500 mb-3" size={40} />
    <h3 className="text-lg font-semibold text-slate-900 mb-1">Failed to load data</h3>
    <p className="text-sm text-slate-600 mb-4">{error?.message || 'An unexpected error occurred'}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <BarChart3 className="text-slate-300 mb-3" size={48} />
    <h3 className="text-lg font-semibold text-slate-900 mb-1">No data yet</h3>
    <p className="text-sm text-slate-600">Leaderboard data will appear here once authors are scraped.</p>
  </div>
);

const ExpandedRow = ({ username, useLocalApi = false }) => {
  // Use local API or Firestore based on prop
  const localAuthor = useLocalAuthor(useLocalApi ? username : null);
  const firestoreAuthor = useAuthor(useLocalApi ? null : username);

  const { data: author, loading, error } = useLocalApi ? localAuthor : firestoreAuthor;

  if (loading) {
    return (
      <tr className="bg-slate-50">
        <td colSpan={8} className="px-4 py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={20} />
            <span className="ml-2 text-sm text-slate-600">Loading recommendations...</span>
          </div>
        </td>
      </tr>
    );
  }

  if (error || !author) {
    return (
      <tr className="bg-slate-50">
        <td colSpan={8} className="px-4 py-4">
          <p className="text-sm text-slate-500 text-center">Could not load recommendations</p>
        </td>
      </tr>
    );
  }

  const ideas = author.ideas || [];

  return (
    <tr className="bg-slate-50">
      <td colSpan={8} className="px-4 py-4">
        <div className="ml-16">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Recent Recommendations</h4>
            <a
              href={`https://valueinvestorsclub.com/member/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View on VIC <ExternalLink size={10} />
            </a>
          </div>
          {ideas.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {ideas.slice(0, 4).map((idea, i) => (
                <div key={idea.id || i} className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-slate-900">{idea.ticker}</span>
                      {idea.positionType === "short" && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">SHORT</span>
                      )}
                    </div>
                    <ReturnBadge value={idea.return} type={idea.positionType} />
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Rec'd: {formatDate(idea.postedDate)}</div>
                    <div>Entry: ${idea.priceAtRec?.toFixed(2) || 'N/A'}</div>
                    <div>Current: ${idea.currentPrice?.toFixed(2) || 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No recommendations found</p>
          )}
          <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Target size={12} />
              {author.totalPicks || ideas.length} total picks analyzed
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
};

// Helper to format Firestore timestamp or date string
function formatDate(date) {
  if (!date) return 'N/A';

  // Handle Firestore Timestamp
  if (date?.toDate) {
    return date.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Handle seconds (Firestore timestamp as object)
  if (date?.seconds) {
    return new Date(date.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Handle string or Date
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function VICLeaderboard({ useLocalApi = false, onStartScrape = null }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const [timeFilter, setTimeFilter] = useState('5yr');
  const [showMethodology, setShowMethodology] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Cookie modal state
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieModalReason, setCookieModalReason] = useState(null);
  const [isVerifyingCookies, setIsVerifyingCookies] = useState(false);

  // Debounce search input to avoid excessive queries
  const debouncedSearch = useDebounce(searchInput, 300);
  const isSearching = debouncedSearch.trim() !== '';

  // Map filter to field name
  const sortField = `xirr${timeFilter}`;

  // Use local API hooks
  const localLeaderboard = useLocalLeaderboard(
    useLocalApi ? sortField : null,
    25,
    useLocalApi ? debouncedSearch : ''
  );

  // Use Firestore hooks (paginated + search)
  const firestorePaginated = usePaginatedLeaderboard(useLocalApi ? null : sortField);
  const firestoreSearch = useLeaderboard(
    useLocalApi ? null : sortField,
    50,
    useLocalApi ? '' : debouncedSearch
  );

  // Select the appropriate data based on mode
  let investors, loading, error, currentPage, totalPages, totalCount, pageSize, goToPage;

  if (useLocalApi) {
    // Local API mode - single hook handles both pagination and search
    investors = localLeaderboard.data;
    loading = localLeaderboard.loading;
    error = localLeaderboard.error;
    currentPage = localLeaderboard.currentPage;
    totalPages = localLeaderboard.totalPages;
    totalCount = localLeaderboard.totalCount;
    pageSize = localLeaderboard.pageSize;
    goToPage = localLeaderboard.goToPage;
  } else {
    // Firestore mode - separate hooks for pagination and search
    if (isSearching) {
      investors = firestoreSearch.data;
      loading = firestoreSearch.loading;
      error = firestoreSearch.error;
      currentPage = 1;
      totalPages = 1;
      totalCount = firestoreSearch.data.length;
      pageSize = 50;
      goToPage = () => {};
    } else {
      investors = firestorePaginated.data;
      loading = firestorePaginated.loading;
      error = firestorePaginated.error;
      currentPage = firestorePaginated.currentPage;
      totalPages = firestorePaginated.totalPages;
      totalCount = firestorePaginated.totalCount;
      pageSize = firestorePaginated.pageSize;
      goToPage = firestorePaginated.goToPage;
    }
  }

  // Handle page change - close expanded row
  const handlePageChange = (page) => {
    setExpandedRow(null);
    goToPage(page);
  };

  // Handle scrape button click - verify cookies first
  const handleScrapeClick = async () => {
    if (!onStartScrape) return;

    setIsVerifyingCookies(true);
    try {
      const result = await verifyCookies();

      if (result.valid) {
        // Cookies are valid, proceed with scrape
        onStartScrape();
      } else {
        // Cookies missing or expired, show modal
        setCookieModalReason(result.reason || 'expired');
        setShowCookieModal(true);
      }
    } catch (err) {
      console.error('Error verifying cookies:', err);
      // On error, assume cookies need refresh
      setCookieModalReason('error');
      setShowCookieModal(true);
    } finally {
      setIsVerifyingCookies(false);
    }
  };

  // Handle successful cookie submission from modal
  const handleCookiesSubmitted = () => {
    setShowCookieModal(false);
    setCookieModalReason(null);
    // Now start the scrape
    if (onStartScrape) {
      onStartScrape();
    }
  };

  // Get last updated date from first investor's calculatedAt
  const lastUpdated = investors[0]?.calculatedAt;
  const lastUpdatedStr = lastUpdated
    ? formatDate(lastUpdated)
    : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">VIC Stock-Picking Tracker</h1>
                <p className="text-xs text-slate-500">Analyzing Value Investors Club Recommendations</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {useLocalApi && onStartScrape && (
                <button
                  onClick={handleScrapeClick}
                  disabled={isVerifyingCookies}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifyingCookies ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Scrape New Ideas
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowMethodology(true)}
                className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <Info size={14} />
                Methodology
              </button>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock size={14} />
                Updated: {lastUpdatedStr}
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setExpandedRow(null); }}
              placeholder="Search by author name..."
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder-slate-400"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setExpandedRow(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            )}
          </div>
          {isSearching && !loading && (
            <p className="text-sm text-slate-500 mt-2">
              {investors.length === 0
                ? `No authors found matching "${debouncedSearch}"`
                : `Found ${investors.length} author${investors.length !== 1 ? 's' : ''} matching "${debouncedSearch}"`}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Sort by Simulated XIRR:</span>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {['1yr', '3yr', '5yr'].map((period) => (
                  <button
                    key={period}
                    onClick={() => { setTimeFilter(period); setExpandedRow(null); }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      timeFilter === period
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {period.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Benchmark: S&P 500 = +12.4% CAGR</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorMessage error={error} onRetry={() => window.location.reload()} />
          ) : investors.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Author</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">5yr XIRR*</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">3yr XIRR*</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">1yr XIRR*</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Picks</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Best Pick</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {investors.map((investor, index) => (
                  <React.Fragment key={investor.id}>
                    <tr
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        expandedRow === investor.username ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setExpandedRow(expandedRow === investor.username ? null : investor.username)}
                    >
                      <td className="px-4 py-4">
                        <RankBadge rank={investor.rank} isSearchResult={isSearching} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-600">
                            {investor.username?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{investor.username}</div>
                            <div className="text-xs text-slate-500">
                              {investor.totalPicks || 0} picks
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <XIRRBadge value={investor.xirr5yr} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <XIRRBadge value={investor.xirr3yr} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <XIRRBadge value={investor.xirr1yr} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-slate-700">{investor.totalPicks || 0}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {investor.bestPickTicker ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="font-mono text-sm font-medium text-slate-900">{investor.bestPickTicker}</span>
                            <ReturnBadge value={investor.bestPickReturn} />
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {expandedRow === investor.username ? (
                          <ChevronUp size={18} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={18} className="text-slate-400" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {expandedRow === investor.username && (
                      <ExpandedRow username={investor.username} useLocalApi={useLocalApi} />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination - hide when searching */}
          {!loading && !error && investors.length > 0 && !isSearching && (
            <div className="border-t border-slate-200 bg-slate-50">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                disabled={loading}
              />
              <div className="text-center text-sm text-slate-500 pb-4">
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount} authors
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 text-center">
            <strong>*Simulated XIRR:</strong> Calculated assuming equal $1 investment at each recommendation date, held until current price.
            This is a <em>hypothetical buy-and-hold simulation</em>, not actual trading performance.
            Authors may have sold at different prices.
          </p>
          <p className="text-xs text-slate-500 text-center mt-2">
            Data sourced from valueinvestorsclub.com | Prices updated daily via Yahoo Finance
          </p>
        </div>
      </main>

      {/* Methodology Modal */}
      {showMethodology && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMethodology(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Methodology</h2>
                <button onClick={() => setShowMethodology(false)} className="text-slate-400 hover:text-slate-600">
                  <ChevronUp size={24} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-700">
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">How We Calculate Returns</h3>
                <p>
                  We simulate a buy-and-hold strategy for each recommendation. On each pick's recommendation date,
                  we assume a hypothetical $1 investment. We then calculate the current value based on today's stock price.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-900 mb-2">XIRR Calculation</h3>
                <p>
                  XIRR (Extended Internal Rate of Return) accounts for the timing of each investment.
                  It answers: "What annualized return would give us these results, given when each investment was made?"
                </p>
              </section>

              <section className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="font-semibold text-amber-800 mb-2">Important Limitations</h3>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>We do NOT track when authors exit positions</li>
                  <li>Returns shown are hypothetical buy-and-hold, not actual trading results</li>
                  <li>An author's real performance could be significantly different</li>
                  <li>This measures stock-picking ability, not trading or portfolio management skill</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-slate-900 mb-2">Data Sources</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Stock recommendations: valueinvestorsclub.com</li>
                  <li>Price data: Yahoo Finance (adjusted for splits/dividends)</li>
                  <li>Updates: Daily at market close</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Cookie Re-entry Modal */}
      <CookieModal
        isOpen={showCookieModal}
        onClose={() => setShowCookieModal(false)}
        onCookiesSubmitted={handleCookiesSubmitted}
        reason={cookieModalReason}
      />
    </div>
  );
}
