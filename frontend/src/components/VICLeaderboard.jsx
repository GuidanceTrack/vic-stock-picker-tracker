import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ExternalLink, Target, Clock, BarChart3, AlertTriangle, Info } from 'lucide-react';

// Mock data - this would come from your scraper + database
const mockInvestors = [
  {
    id: 1,
    username: "ValueHunter92",
    xirr5yr: 28.4,
    xirr3yr: 31.2,
    xirr1yr: 18.7,
    totalPicks: 47,
    winRate: 72,
    avgHoldingPeriod: "14 months",
    lastActive: "2 days ago",
    bestPick: { name: "CROX", return: 312 },
    recentPicks: [
      { ticker: "CROX", date: "2021-03-15", priceAtRec: 62.50, currentPrice: 257.30, return: 312, type: "long" },
      { ticker: "GOOGL", date: "2022-08-10", priceAtRec: 118.20, currentPrice: 178.50, return: 51, type: "long" },
      { ticker: "META", date: "2022-11-01", priceAtRec: 96.40, currentPrice: 585.00, return: 507, type: "long" },
      { ticker: "PYPL", date: "2023-05-20", priceAtRec: 62.80, currentPrice: 68.20, return: 9, type: "long" },
    ]
  },
  {
    id: 2,
    username: "DeepValueDan",
    xirr5yr: 24.1,
    xirr3yr: 22.8,
    xirr1yr: 29.3,
    totalPicks: 89,
    winRate: 68,
    avgHoldingPeriod: "18 months",
    lastActive: "1 week ago",
    bestPick: { name: "NVDA", return: 485 },
    recentPicks: [
      { ticker: "NVDA", date: "2020-06-01", priceAtRec: 37.50, currentPrice: 219.50, return: 485, type: "long" },
      { ticker: "AAPL", date: "2023-01-15", priceAtRec: 135.20, currentPrice: 228.80, return: 69, type: "long" },
      { ticker: "COST", date: "2023-09-01", priceAtRec: 565.00, currentPrice: 920.50, return: 63, type: "long" },
    ]
  },
  {
    id: 3,
    username: "ContrarianKing",
    xirr5yr: 21.7,
    xirr3yr: 19.4,
    xirr1yr: 24.1,
    totalPicks: 62,
    winRate: 65,
    avgHoldingPeriod: "22 months",
    lastActive: "3 days ago",
    bestPick: { name: "AMD", return: 198 },
    recentPicks: [
      { ticker: "AMD", date: "2022-10-15", priceAtRec: 58.20, currentPrice: 173.50, return: 198, type: "long" },
      { ticker: "DIS", date: "2023-11-01", priceAtRec: 82.50, currentPrice: 108.20, return: 31, type: "long" },
      { ticker: "INTC", date: "2024-08-15", priceAtRec: 19.80, currentPrice: 24.50, return: 24, type: "long" },
    ]
  },
  {
    id: 4,
    username: "SmallCapSteve",
    xirr5yr: 19.8,
    xirr3yr: 17.2,
    xirr1yr: 15.4,
    totalPicks: 124,
    winRate: 58,
    avgHoldingPeriod: "11 months",
    lastActive: "5 days ago",
    bestPick: { name: "SMCI", return: 892 },
    recentPicks: [
      { ticker: "SMCI", date: "2022-01-10", priceAtRec: 42.50, currentPrice: 421.80, return: 892, type: "long" },
      { ticker: "BOOT", date: "2023-06-20", priceAtRec: 78.20, currentPrice: 165.40, return: 112, type: "long" },
      { ticker: "CELH", date: "2024-01-05", priceAtRec: 52.80, currentPrice: 28.50, return: -46, type: "long" },
    ]
  },
  {
    id: 5,
    username: "QualityCompounder",
    xirr5yr: 18.2,
    xirr3yr: 20.5,
    xirr1yr: 22.8,
    totalPicks: 31,
    winRate: 81,
    avgHoldingPeriod: "36 months",
    lastActive: "2 weeks ago",
    bestPick: { name: "MSFT", return: 156 },
    recentPicks: [
      { ticker: "MSFT", date: "2021-05-01", priceAtRec: 252.40, currentPrice: 645.80, return: 156, type: "long" },
      { ticker: "V", date: "2022-03-15", priceAtRec: 212.50, currentPrice: 318.20, return: 50, type: "long" },
      { ticker: "UNH", date: "2023-04-01", priceAtRec: 498.20, currentPrice: 585.40, return: 18, type: "long" },
    ]
  },
  {
    id: 6,
    username: "TurnaroundTom",
    xirr5yr: 15.4,
    xirr3yr: 12.8,
    xirr1yr: 8.2,
    totalPicks: 78,
    winRate: 52,
    avgHoldingPeriod: "9 months",
    lastActive: "1 day ago",
    bestPick: { name: "GM", return: 87 },
    recentPicks: [
      { ticker: "GM", date: "2023-01-20", priceAtRec: 34.50, currentPrice: 64.50, return: 87, type: "long" },
      { ticker: "F", date: "2023-08-10", priceAtRec: 12.20, currentPrice: 10.80, return: -11, type: "long" },
      { ticker: "WBD", date: "2024-05-01", priceAtRec: 8.50, currentPrice: 12.20, return: 44, type: "long" },
    ]
  },
  {
    id: 7,
    username: "DividendDave",
    xirr5yr: 12.8,
    xirr3yr: 11.5,
    xirr1yr: 14.2,
    totalPicks: 56,
    winRate: 75,
    avgHoldingPeriod: "48 months",
    lastActive: "4 days ago",
    bestPick: { name: "O", return: 45 },
    recentPicks: [
      { ticker: "O", date: "2021-09-01", priceAtRec: 68.50, currentPrice: 99.20, return: 45, type: "long" },
      { ticker: "JNJ", date: "2022-12-15", priceAtRec: 178.20, currentPrice: 158.50, return: -11, type: "long" },
      { ticker: "PG", date: "2023-07-01", priceAtRec: 152.80, currentPrice: 172.40, return: 13, type: "long" },
    ]
  },
  {
    id: 8,
    username: "ShortSeller99",
    xirr5yr: 11.2,
    xirr3yr: 14.8,
    xirr1yr: 19.5,
    totalPicks: 43,
    winRate: 61,
    avgHoldingPeriod: "8 months",
    lastActive: "6 days ago",
    bestPick: { name: "CVNA", return: 245 },
    recentPicks: [
      { ticker: "CVNA", date: "2022-08-01", priceAtRec: 52.80, currentPrice: 18.50, return: 245, type: "short" },
      { ticker: "GME", date: "2023-03-15", priceAtRec: 22.40, currentPrice: 28.10, return: -25, type: "short" },
      { ticker: "BYND", date: "2023-11-01", priceAtRec: 12.80, currentPrice: 5.20, return: 59, type: "short" },
    ]
  },
];

const XIRRBadge = ({ value }) => {
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
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? '+' : ''}{value}%
      {type === "short" && <span className="text-xs opacity-70">(S)</span>}
    </span>
  );
};

const RankBadge = ({ rank }) => {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">{rank}</span>;
};

const DisclaimerBanner = ({ onDismiss }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-800">
                Stock-Picking Tracker - Not Actual Performance
              </h3>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-amber-700 hover:text-amber-900 text-xs flex items-center gap-1"
              >
                {expanded ? 'Less' : 'More info'}
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Returns shown are <strong>hypothetical buy-and-hold</strong> calculations, not actual trading results.
            </p>
            {expanded && (
              <div className="mt-3 text-xs text-amber-700 space-y-2 border-t border-amber-200 pt-3">
                <p>
                  <strong>What this shows:</strong> If you had bought each stock on the recommendation date and held until today, what would your return be?
                </p>
                <p>
                  <strong>What this does NOT show:</strong> Authors' actual trading performance. VIC members are not required to disclose when they sell positions, so we cannot track real exits.
                </p>
                <p>
                  <strong>Why this matters:</strong> An author could recommend a stock at $50, sell at $100 (+100% real gain), and the stock could later fall to $25. Our tracker would show -50%, even though they actually made +100%.
                </p>
                <p className="font-medium">
                  Use this as a measure of <em>stock-picking quality</em>, not trading skill or actual returns.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function VICLeaderboard() {
  const [expandedRow, setExpandedRow] = useState(null);
  const [timeFilter, setTimeFilter] = useState('5yr');
  const [showMethodology, setShowMethodology] = useState(false);

  const sortedInvestors = [...mockInvestors].sort((a, b) => {
    const key = `xirr${timeFilter}`;
    return b[key] - a[key];
  });

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
              <button
                onClick={() => setShowMethodology(true)}
                className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <Info size={14} />
                Methodology
              </button>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock size={14} />
                Updated: Dec 21, 2025
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Disclaimer Banner */}
      <DisclaimerBanner />

      {/* Stats Banner */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">487</div>
              <div className="text-xs text-slate-500">Authors Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">3,241</div>
              <div className="text-xs text-slate-500">Stock Picks Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">+18.7%</div>
              <div className="text-xs text-slate-500">Avg 5yr Simulated XIRR</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">64%</div>
              <div className="text-xs text-slate-500">Avg Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Sort by Simulated XIRR:</span>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {['1yr', '3yr', '5yr'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimeFilter(period)}
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
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Author</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">5yr XIRR*</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">3yr XIRR*</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">1yr XIRR*</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Picks</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Win Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Best Pick</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedInvestors.map((investor, index) => (
                <React.Fragment key={investor.id}>
                  <tr
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      expandedRow === investor.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setExpandedRow(expandedRow === investor.id ? null : investor.id)}
                  >
                    <td className="px-4 py-4">
                      <RankBadge rank={index + 1} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-600">
                          {investor.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{investor.username}</div>
                          <div className="text-xs text-slate-500">Active {investor.lastActive}</div>
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
                      <span className="text-sm font-medium text-slate-700">{investor.totalPicks}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${investor.winRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{investor.winRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span className="font-mono text-sm font-medium text-slate-900">{investor.bestPick.name}</span>
                        <ReturnBadge value={investor.bestPick.return} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {expandedRow === investor.id ? (
                        <ChevronUp size={18} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-400" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedRow === investor.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="ml-16">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-sm font-semibold text-slate-700">Recent Recommendations</h4>
                            <a
                              href="#"
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              View on VIC <ExternalLink size={10} />
                            </a>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            {investor.recentPicks.map((pick, i) => (
                              <div key={i} className="bg-white rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-bold text-slate-900">{pick.ticker}</span>
                                    {pick.type === "short" && (
                                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">SHORT</span>
                                    )}
                                  </div>
                                  <ReturnBadge value={pick.return} type={pick.type} />
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                  <div>Rec'd: {pick.date}</div>
                                  <div>Entry: ${pick.priceAtRec.toFixed(2)}</div>
                                  <div>Current: ${pick.currentPrice.toFixed(2)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              Avg holding: {investor.avgHoldingPeriod}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target size={12} />
                              {investor.totalPicks} total picks analyzed
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 text-center">
            <strong>*Simulated XIRR:</strong> Calculated assuming equal $1 investment at each recommendation date, held until current price.
            This is a <em>hypothetical buy-and-hold simulation</em>, not actual trading performance.
            Authors may have sold at different prices.
          </p>
          <p className="text-xs text-slate-500 text-center mt-2">
            Data sourced from valueinvestorsclub.com | Prices updated daily via market data APIs
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

              <section>
                <h3 className="font-semibold text-slate-900 mb-2">Win Rate</h3>
                <p>
                  Percentage of picks that are currently profitable (current price {'>'} recommendation price for longs,
                  current price {'<'} recommendation price for shorts).
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
    </div>
  );
}
