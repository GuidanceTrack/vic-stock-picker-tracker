# VIC Leaderboard - Codebase Architecture Review

This document provides a comprehensive overview of the VIC Leaderboard codebase architecture for onboarding new contributors.

## Project Overview

**VIC Stock-Picking Tracker** is a web application that tracks and ranks Value Investors Club (VIC) members by their stock-picking quality. The system calculates simulated buy-and-hold returns (XIRR) for member recommendations and displays them on a public leaderboard.

**Important:** This tracks *hypothetical* returns based on recommendations, not actual trading performance.

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + Vite | 19.2 / 7.2 |
| **Styling** | Tailwind CSS | 4.1 |
| **Backend** | Firebase Cloud Functions | Node.js 20+ |
| **Database** | Firebase Firestore | - |
| **Scraping** | Playwright | 1.40 |
| **Financial Data** | yahoo-finance2 | 2.11 |
| **Metrics** | XIRR calculation | - |
| **Hosting** | Vercel (frontend), GCP (functions) | - |

## Directory Structure

```
Vic-Leaderboard/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx            # App entry point
│   │   ├── App.jsx             # Root component
│   │   ├── firebase.js         # Firebase client initialization
│   │   ├── components/
│   │   │   ├── VICLeaderboard.jsx  # Main leaderboard UI
│   │   │   └── Pagination.jsx      # Pagination controls component
│   │   ├── hooks/
│   │   │   ├── useLeaderboard.js   # Real-time leaderboard data
│   │   │   ├── usePaginatedLeaderboard.js  # Paginated data with cursor caching
│   │   │   └── useAuthor.js        # Author details + ideas
│   │   └── services/
│   │       └── firestore.js        # Firestore query functions
│   ├── dist/                   # Build output
│   └── package.json
│
├── functions/                  # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.js           # Function entry points
│   │   ├── run-daily-scrape.js
│   │   ├── scraper/
│   │   │   ├── session-manager.js    # VIC session handling
│   │   │   ├── author-scraper.js     # Profile scraping
│   │   │   ├── idea-scraper.js       # Idea page scraping
│   │   │   └── rate-limiter.js       # Request throttling
│   │   ├── services/
│   │   │   ├── firebase.js           # Firestore operations
│   │   │   ├── price-service.js      # Yahoo Finance integration
│   │   │   └── performance-calculator.js  # XIRR calculation
│   │   └── scripts/
│   │       ├── migrate-username-lower.js  # Migration for search field
│   │       └── import/
│   │           └── import-vic-data.js # Dataset import
│   ├── config/
│   │   └── scrape-config.json   # Rate limits, selectors
│   ├── session/                 # Persisted browser session
│   └── package.json
│
├── firebase/                   # Firebase configuration
│   ├── firebase.json
│   ├── firebase-config.json
│   ├── firestore.rules
│   └── firestore.indexes.json
│
├── docs/                       # Documentation
│   ├── README.md
│   ├── codebase-review.md      # This file
│   └── authentication-findings.md
│
├── data/                       # Data directory
│   └── README.md               # Links to VIC dataset
│
├── firebase.json               # Root Firebase config
├── .firebaserc                 # Project reference
└── PLAN.md                     # Implementation plan
```

## Database Schema (Firestore)

### Collections

**`authors`** - VIC members being tracked
```javascript
{
  username: string,       // VIC username
  vicUserId: string,      // VIC internal ID
  discoveredAt: timestamp,
  lastScrapedAt: timestamp
}
```

**`ideas`** - Stock recommendations
```javascript
{
  authorUsername: string,
  vicIdeaId: string,
  ticker: string,
  postedDate: timestamp,
  priceAtRec: number,      // Price at recommendation
  positionType: 'long' | 'short',
  marketCapAtRec: number
}
```

**`prices`** - Current stock prices
```javascript
{
  ticker: string,
  currentPrice: number,
  lastUpdated: timestamp
}
```

**`authorMetrics`** - Calculated performance metrics
```javascript
{
  username: string,
  usernameLower: string,   // Lowercase username for case-insensitive search
  xirr5yr: number,
  xirr3yr: number,
  xirr1yr: number,
  totalPicks: number,
  winRate: number,
  bestPick: string
}
```

**`scrapeLog`** - Job execution history
```javascript
{
  authorUsername: string,
  jobType: string,
  status: 'success' | 'failed',
  itemsProcessed: number,
  timestamp: timestamp
}
```

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Scheduler                          │
│  2:00 AM → dailyScrape                                      │
│  6:00 PM → updatePrices                                     │
│  6:30 PM → calculateMetrics                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               Cloud Functions (Backend)                      │
│                                                              │
│  dailyScrape:                                               │
│    Playwright → VIC Website → ideas collection              │
│                                                              │
│  updatePrices:                                              │
│    Yahoo Finance API → prices collection                    │
│                                                              │
│  calculateMetrics:                                          │
│    ideas + prices → XIRR → authorMetrics collection         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Firestore Database                         │
│  authors | ideas | prices | authorMetrics | scrapeLog       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              React Frontend (Vercel)                         │
│                                                              │
│  usePaginatedLeaderboard → cursor-based pagination          │
│  useLeaderboard → real-time updates + search                │
│                                                              │
│  VICLeaderboard → table with search bar & pagination        │
│  Pagination → page numbers, prev/next navigation            │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Frontend

| File | Purpose |
|------|---------|
| `VICLeaderboard.jsx` | Main leaderboard table with expandable rows, search, and pagination |
| `Pagination.jsx` | Reusable pagination controls (page numbers, prev/next buttons) |
| `useLeaderboard.js` | Real-time subscription to authorMetrics + search functionality |
| `usePaginatedLeaderboard.js` | Cursor-based pagination with caching for Firestore |
| `useAuthor.js` | Fetches author details with their ideas |
| `firestore.js` | Query functions for Firestore (getLeaderboard, searchAuthors, pagination) |

### Backend Services

| File | Purpose |
|------|---------|
| `index.js` | Cloud Function entry points |
| `firebase.js` | Firestore read/write operations |
| `price-service.js` | Yahoo Finance integration |
| `performance-calculator.js` | XIRR and metrics calculation |

### Scraper Modules

| File | Purpose |
|------|---------|
| `session-manager.js` | Cookie persistence and session handling |
| `author-scraper.js` | Extracts ideas from member profiles |
| `idea-scraper.js` | Extracts details from idea pages |
| `rate-limiter.js` | Request throttling with exponential backoff |

## External Integrations

### VIC Website
- **Purpose:** Source of member recommendations
- **Method:** Playwright browser automation (HTML scraping)
- **Auth:** Session cookies (expires 3-12 hours)
- **Rate Limiting:** 3-7 second delays between requests

### Yahoo Finance API
- **Library:** `yahoo-finance2`
- **Purpose:** Current and historical stock prices
- **Features:** Handles splits, ticker renames, market hours

### Firebase/GCP
- **Firestore:** NoSQL database with real-time sync
- **Cloud Functions:** Serverless compute
- **Cloud Scheduler:** Cron job triggers

## Key Design Decisions

1. **Round-Robin Scraping** - Selects author with oldest `lastScrapedAt` for fair coverage

2. **Session Persistence** - Saves browser cookies to file for reuse across function invocations

3. **Real-Time Frontend** - Uses Firestore `onSnapshot` for live updates without polling

4. **Client-Side Enrichment** - Frontend calculates returns on-demand when expanding rows

5. **Dataset Import Alternative** - 13,656-idea dataset available to bypass live scraping

6. **Cursor-Based Pagination** - Uses Firestore `startAfter()` with cursor caching for efficient page navigation (25 items/page)

7. **Author Search** - Case-insensitive prefix search using `usernameLower` field with Firestore range queries (`>=` and `<=` operators). Debounced input (300ms) to reduce API calls

## Development Setup

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project access

### Frontend
```bash
cd frontend
npm install
npm run dev      # Development server
npm run build    # Production build
```

### Functions
```bash
cd functions
npm install

# Available scripts
npm run import:vic-data   # Import VIC dataset
npm run seed              # Seed author collection
npm run test:prices       # Test price service
npm run test:metrics      # Test metrics calculation
```

### Deployment
```bash
# Deploy functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

## Configuration Files

| File | Purpose |
|------|---------|
| `firebase.json` | Firebase CLI configuration |
| `firebase-config.json` | Client-side Firebase config |
| `firestore.rules` | Database security rules |
| `scrape-config.json` | CSS selectors and rate limits |
| `.firebaserc` | Project ID mapping |

## Security

- **Firestore Rules:** Public read for leaderboard, backend-only write
- **Sensitive Files:** Service account key and session cookies are gitignored
- **Environment Variables:** Used for Firebase credentials

## Current Status

- [x] Database schema designed and deployed
- [x] Frontend components built
- [x] Backend scraper logic implemented
- [x] Price service integrated
- [x] Metrics calculation (XIRR) implemented
- [x] Cloud Functions deployed
- [x] Real-time frontend hooks working
- [x] Pagination (25 items/page with cursor caching)
- [x] Author search (case-insensitive prefix matching)
- [ ] Data population (pending dataset import)
- [ ] Frontend deployment to Vercel
- [ ] Production launch

## Related Documentation

- [PLAN.md](../PLAN.md) - Detailed implementation plan
- [authentication-findings.md](./authentication-findings.md) - VIC auth research
- [data/README.md](../data/README.md) - Dataset information
