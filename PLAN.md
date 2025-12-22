# VIC Stock-Picking Tracker - Implementation Plan

## Project Overview

Build a web application that tracks and ranks Value Investors Club members by their **stock-picking quality** (not actual trading performance). The app will scrape VIC for historical stock picks, fetch price data, calculate **simulated buy-and-hold returns** (XIRR), and display a leaderboard with clear disclaimers that these are hypothetical returns, not actual trading results.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VIC LEADERBOARD                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    GOOGLE CLOUD (Free Tier)                          │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │  │
│  │  │   Cloud     │    │   Cloud     │    │   Cloud     │              │  │
│  │  │  Scheduler  │───▶│  Functions  │───▶│  Firestore  │              │  │
│  │  │ (3 jobs)    │    │ (scraper,   │    │ (database)  │              │  │
│  │  │             │    │  prices,    │    │             │              │  │
│  │  └─────────────┘    │  metrics)   │    └──────┬──────┘              │  │
│  │                     └─────────────┘           │                      │  │
│  └───────────────────────────────────────────────│──────────────────────┘  │
│                                                  │                          │
│         ┌────────────────┐                       │                          │
│         │  VIC Website   │                       │                          │
│         │  (1 scrape/day)│                       │                          │
│         └───────┬────────┘                       │                          │
│                 │                                │                          │
│                 ▼                                ▼                          │
│         ┌────────────────┐              ┌──────────────────────────────┐   │
│         │ Yahoo Finance  │              │         FRONTEND             │   │
│         │ (price data)   │              │                              │   │
│         └────────────────┘              │  - React + Vite + Tailwind   │   │
│                                         │  - Hosted on Vercel (free)   │   │
│                                         │  - Reads directly from       │   │
│                                         │    Firestore                 │   │
│                                         └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema

### Tech Choice: Firebase Firestore
- Free tier: 1GB storage, 50K reads/day, 20K writes/day
- Real-time sync capabilities
- No server management
- Familiar to the team

### Collections Structure

```javascript
// Collection: authors
{
    "authors/{username}": {
        "username": "ValueHunter92",
        "vicUserId": "25973",
        "profileUrl": "https://valueinvestorsclub.com/member/ValueHunter92/25973",
        "discoveredAt": Timestamp,
        "lastScrapedAt": Timestamp  // round-robin: oldest gets scraped next
    }
}

// Collection: ideas
{
    "ideas/{vicIdeaId}": {
        "authorUsername": "ValueHunter92",
        "vicIdeaId": "1871818862",
        "ticker": "CROX",
        "companyName": "Crocs Inc",
        "ideaUrl": "https://valueinvestorsclub.com/idea/CROX/1871818862",
        "postedDate": Timestamp,
        "positionType": "long",  // 'long' or 'short'
        "priceAtRec": 62.50,
        "marketCapAtRec": 4500000000,
        "isContestWinner": false,
        "scrapedAt": Timestamp
    }
}

// Collection: prices
{
    "prices/{ticker}": {
        "ticker": "CROX",
        "currentPrice": 257.30,
        "lastUpdated": Timestamp,
        // Subcollection for historical prices if needed
        "history": {
            "{date}": {
                "open": 255.00,
                "close": 257.30,
                "adjustedClose": 257.30
            }
        }
    }
}

// Collection: authorMetrics (cached calculations)
{
    "authorMetrics/{username}": {
        "username": "ValueHunter92",
        "xirr1yr": 18.7,
        "xirr3yr": 31.2,
        "xirr5yr": 28.4,
        "totalPicks": 47,
        "winRate": 72,
        "avgHoldingPeriodDays": 420,
        "bestPickTicker": "CROX",
        "bestPickReturn": 312,
        "calculatedAt": Timestamp
    }
}

// Collection: scrapeLog
{
    "scrapeLog/{autoId}": {
        "authorUsername": "ValueHunter92",  // null for general scrapes
        "jobType": "daily_scrape",  // 'daily_scrape', 'price_update', 'metrics_calc'
        "status": "success",  // 'pending', 'success', 'failed'
        "startedAt": Timestamp,
        "completedAt": Timestamp,
        "itemsProcessed": 5,
        "errorMessage": null
    }
}
```

### Firebase Security Rules (Basic)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for leaderboard data
    match /authorMetrics/{doc} {
      allow read: if true;
      allow write: if false;  // Only backend writes
    }
    match /authors/{doc} {
      allow read: if true;
      allow write: if false;
    }
    match /ideas/{doc} {
      allow read: if true;
      allow write: if false;
    }
    // Prices and logs are internal
    match /prices/{doc} {
      allow read, write: if false;
    }
    match /scrapeLog/{doc} {
      allow read, write: if false;
    }
  }
}
```

---

## Phase 2: Scraper Module

### Tech Choice: Node.js with Playwright
- Playwright handles JavaScript-rendered pages
- Can reuse logged-in session
- Built-in waiting and retry mechanisms

### Directory Structure

```
/scraper
  /src
    index.js              # Main entry point
    session-manager.js    # Handle VIC login session
    author-scraper.js     # Scrape author profile pages
    idea-scraper.js       # Scrape individual idea pages
    rate-limiter.js       # Ensure respectful scraping
    parser.js             # Extract data from HTML
  /config
    scrape-config.json    # Rate limits, selectors, etc.
```

### Scraping Strategy

#### Step 1: Session Setup (One-time, manual)
```javascript
// User logs into VIC in Playwright browser
// Session cookies saved to file
// Reused for subsequent scrapes
```

#### Step 2: Discover Authors
```
Sources for author discovery:
1. Idea pages → extract author name/link
2. Search results
3. Manual seed list of known good authors
```

#### Step 3: Daily Scrape Job (ONCE PER DAY TOTAL)
```
To be respectful to VIC's servers, we run ONE scrape job per day.

Each daily job picks ONE author from the queue and scrapes:
1. Their profile page (list of ideas)
2. Any new idea pages we haven't seen before

This means:
- 1 author fully scraped per day
- ~30 authors/month, ~365 authors/year
- Very gentle on VIC servers

URL Patterns:
- Profile: https://valueinvestorsclub.com/member/{username}/{user_id}
- Idea: https://valueinvestorsclub.com/idea/{COMPANY_NAME}/{idea_id}

Extract from profile:
- List of ideas (ticker, date, long/short, contest winner)
- Idea URLs for detailed scraping

Extract from idea page:
- Full ticker symbol
- Price at recommendation
- Market cap at recommendation

Schedule: Once daily at 2:00 AM ET via Google Cloud Scheduler
```

### Scraper Code Outline

```javascript
// author-scraper.js
async function scrapeAuthorProfile(page, authorUrl) {
    await page.goto(authorUrl);

    const ideas = await page.$$eval('.idea-row', rows => {
        return rows.map(row => ({
            ticker: row.querySelector('.ticker')?.textContent,
            date: row.querySelector('.date')?.textContent,
            type: row.classList.contains('short') ? 'short' : 'long',
            isWinner: row.querySelector('.winner-badge') !== null,
            ideaUrl: row.querySelector('a')?.href
        }));
    });

    return ideas;
}
```

---

## Phase 3: Price Service

### Tech Choice: Yahoo Finance API (yfinance via python or yahoo-finance2 for Node.js)

### Functionality

```javascript
// price-service.js

// Get historical price for a specific date
async function getPriceOnDate(ticker, date) {
    // Returns adjusted close price
    // Handles stock splits automatically
}

// Get current price
async function getCurrentPrice(ticker) {
    // Returns latest price
}

// Batch update all tracked tickers
async function updateAllPrices() {
    // Run daily
    // Fetches current price for all tickers in ideas table
}
```

### Handling Edge Cases

| Issue | Solution |
|-------|----------|
| Ticker changed (merger, rename) | Map old ticker to new via lookup table |
| Company delisted | Mark as delisted, use last known price |
| Stock splits | Use adjusted close price |
| International tickers | Add exchange suffix (e.g., `.L` for London) |

---

## Phase 4: Performance Calculator

### XIRR Calculation

XIRR (Extended Internal Rate of Return) accounts for the timing of cash flows.

```javascript
// performance-calculator.js
const { xirr } = require('xirr');

function calculateAuthorXIRR(ideas, currentPrices, years = 5) {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);

    const relevantIdeas = ideas.filter(i =>
        new Date(i.posted_date) >= cutoffDate
    );

    // Create cash flows
    // -1 on recommendation date (investment)
    // +currentValue on today (return)
    const cashFlows = [];

    for (const idea of relevantIdeas) {
        const entryPrice = idea.price_at_rec;
        const currentPrice = currentPrices[idea.ticker];
        const returnMultiple = idea.position_type === 'long'
            ? currentPrice / entryPrice
            : (2 - currentPrice / entryPrice); // short math

        cashFlows.push({
            date: new Date(idea.posted_date),
            amount: -1  // invested $1
        });
        cashFlows.push({
            date: new Date(),
            amount: returnMultiple  // current value
        });
    }

    return xirr(cashFlows);
}
```

### Win Rate Calculation

```javascript
function calculateWinRate(ideas, currentPrices) {
    let wins = 0;

    for (const idea of ideas) {
        const entryPrice = idea.price_at_rec;
        const currentPrice = currentPrices[idea.ticker];

        const isWin = idea.position_type === 'long'
            ? currentPrice > entryPrice
            : currentPrice < entryPrice;

        if (isWin) wins++;
    }

    return (wins / ideas.length) * 100;
}
```

---

## Phase 5: Data Access Layer (No Backend Needed!)

### Why No Separate Backend?

With Firebase Firestore, the frontend can read directly from the database:
- Firestore has built-in security rules
- Real-time listeners for live updates
- No server to maintain
- Lower latency (direct connection)

### Firestore Queries from Frontend

```javascript
// services/firestore.js
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebase';

// Get leaderboard sorted by XIRR
export async function getLeaderboard(sortBy = 'xirr5yr', limitCount = 50) {
    const metricsRef = collection(db, 'authorMetrics');
    const q = query(
        metricsRef,
        orderBy(sortBy, 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        ...doc.data()
    }));
}

// Get single author with their ideas
export async function getAuthorWithIdeas(username) {
    // Get author metrics
    const metricsDoc = await getDoc(doc(db, 'authorMetrics', username));
    const metrics = metricsDoc.data();

    // Get their ideas
    const ideasRef = collection(db, 'ideas');
    const q = query(
        ideasRef,
        where('authorUsername', '==', username),
        orderBy('postedDate', 'desc')
    );
    const ideasSnap = await getDocs(q);
    const ideas = ideasSnap.docs.map(doc => doc.data());

    return { ...metrics, ideas };
}

// Get aggregate stats for banner
export async function getAggregateStats() {
    const statsDoc = await getDoc(doc(db, 'stats', 'aggregate'));
    return statsDoc.data();
    // Note: This doc is updated by the calculateMetrics cloud function
}
```

### Data Shape (What Frontend Receives)

```javascript
// Leaderboard item
{
    "rank": 1,
    "username": "ValueHunter92",
    "xirr5yr": 28.4,
    "xirr3yr": 31.2,
    "xirr1yr": 18.7,
    "totalPicks": 47,
    "winRate": 72,
    "avgHoldingPeriodDays": 420,
    "bestPickTicker": "CROX",
    "bestPickReturn": 312,
    "calculatedAt": Timestamp
}

// Author detail with ideas
{
    "username": "ValueHunter92",
    "xirr5yr": 28.4,
    // ... other metrics
    "ideas": [
        {
            "ticker": "CROX",
            "companyName": "Crocs Inc",
            "postedDate": Timestamp,
            "positionType": "long",
            "priceAtRec": 62.50,
            "currentPrice": 257.30,  // from prices collection
            "return": 312,
            "isContestWinner": true
        }
    ]
}

// Aggregate stats (for banner)
{
    "activeInvestors": 487,
    "totalRecommendations": 3241,
    "avgXirr5yr": 18.7,
    "avgWinRate": 64,
    "lastUpdated": Timestamp
}
```

---

## Phase 6: Frontend

### Tech Choice: React + Vite + Tailwind CSS
The existing `vic-leaderboard.jsx` provides the UI template.

### Directory Structure

```
/frontend
  /src
    /components
      Leaderboard.jsx     # Main table (from existing file)
      AuthorRow.jsx       # Individual row + expansion
      StatsBar.jsx        # Top metrics banner
      FilterBar.jsx       # Sorting/filtering controls
      XIRRBadge.jsx       # Performance badge component
      ReturnBadge.jsx     # Return indicator
    /hooks
      useLeaderboard.js   # Fetch leaderboard data
      useAuthor.js        # Fetch single author
    /services
      api.js              # API client
    App.jsx
    main.jsx
  index.html
  vite.config.js
  tailwind.config.js
```

### Migration from Mock Data to Firestore

Current JSX uses `mockInvestors` array. We'll replace with Firestore:

```javascript
// hooks/useLeaderboard.js
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useLeaderboard(sortBy = 'xirr5yr', limitCount = 50) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
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
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [sortBy, limitCount]);

    return { data, loading, error };
}
```

```javascript
// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

---

## Phase 7: Scheduler / Orchestration

### Tech Choice: Google Cloud Scheduler + Cloud Functions
- Free tier: 3 jobs, 3 million invocations/month
- No server to manage
- Reliable, managed execution

### Daily Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Daily Scrape | 2:00 AM ET | Scrape ONE author (profile + their ideas) |
| Price Update | 6:00 PM ET | Fetch current prices for all tickers |
| Metrics Recalc | 6:30 PM ET | Recalculate XIRR, win rate for all authors |

**Note:** We intentionally limit to ONE scrape per day total to be respectful to VIC servers.

### Google Cloud Setup

```bash
# 1. Create Cloud Functions for each job

# Daily scrape function
gcloud functions deploy dailyScrape \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1

# Price update function
gcloud functions deploy updatePrices \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1

# Metrics calculation function
gcloud functions deploy calculateMetrics \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1
```

```bash
# 2. Create Cloud Scheduler jobs

# Daily scrape at 2:00 AM ET (7:00 AM UTC)
gcloud scheduler jobs create http daily-scrape \
  --schedule="0 7 * * *" \
  --uri="https://us-central1-PROJECT.cloudfunctions.net/dailyScrape" \
  --http-method=POST \
  --time-zone="America/New_York"

# Price update at 6:00 PM ET (11:00 PM UTC)
gcloud scheduler jobs create http price-update \
  --schedule="0 23 * * 1-5" \
  --uri="https://us-central1-PROJECT.cloudfunctions.net/updatePrices" \
  --http-method=POST \
  --time-zone="America/New_York"

# Metrics recalc at 6:30 PM ET (11:30 PM UTC)
gcloud scheduler jobs create http metrics-recalc \
  --schedule="30 23 * * 1-5" \
  --uri="https://us-central1-PROJECT.cloudfunctions.net/calculateMetrics" \
  --http-method=POST \
  --time-zone="America/New_York"
```

### Cloud Function Example

```javascript
// functions/dailyScrape.js
const functions = require('@google-cloud/functions-framework');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { scrapeNextAuthor } = require('./scraper');

initializeApp();
const db = getFirestore();

functions.http('dailyScrape', async (req, res) => {
    try {
        // Get next author to scrape (oldest lastScrapedAt or never scraped)
        const authorsRef = db.collection('authors');
        const snapshot = await authorsRef
            .orderBy('lastScrapedAt', 'asc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            res.json({ message: 'No authors to scrape' });
            return;
        }

        const author = snapshot.docs[0].data();

        // Log job start
        await db.collection('scrapeLog').add({
            authorUsername: author.username,
            jobType: 'daily_scrape',
            status: 'pending',
            startedAt: new Date()
        });

        // Run scraper
        const result = await scrapeNextAuthor(author);

        // Update author's lastScrapedAt
        await authorsRef.doc(author.username).update({
            lastScrapedAt: new Date()
        });

        res.json({
            success: true,
            author: author.username,
            ideasScraped: result.ideasCount
        });

    } catch (error) {
        console.error('Scrape failed:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

## Implementation Order

### Step 1: Firebase Setup ✅ (Completed Dec 21, 2025)
- [x] Create Firebase project in console → `vic-leaderboard`
- [x] Enable Firestore database → `nam5` region (US)
- [x] Set up security rules → Deployed to production
- [x] Get Firebase config keys → Saved to `firebase/firebase-config.json`

**Files created:**
- `firebase/.firebaserc` - Project alias configuration
- `firebase/firebase.json` - Firebase project config
- `firebase/firestore.rules` - Security rules (public read, no public write)
- `firebase/firestore.indexes.json` - Index configuration
- `firebase/firebase-config.json` - SDK config keys
- `frontend/.env.example` - Environment template for frontend

### Step 2: Local Scraper Development ✅ (Completed Dec 22, 2025)
- [x] Set up /functions folder with Node.js
- [x] Create Playwright session manager
- [x] Build author profile scraper
- [x] Build idea page scraper
- [x] Test locally on 1-2 authors

**What was done:**

1. **Created `/functions` folder structure:**
   ```
   functions/
   ├── package.json              # Dependencies: playwright, firebase-admin
   ├── .env.example              # Template for credentials
   ├── .gitignore                # Excludes secrets & session files
   ├── service-account-key.json  # Firebase Admin credentials (gitignored)
   ├── config/
   │   └── scrape-config.json    # Rate limits, URLs, CSS selectors
   ├── session/
   │   ├── cookies.json          # VIC login cookies (gitignored)
   │   └── storage.json          # Playwright storage state
   ├── scripts/
   │   └── seed-authors.js       # Populate initial author queue
   └── src/
       ├── index.js              # Main orchestrator (dailyScrape function)
       ├── test-scraper.js       # Test script
       ├── services/
       │   └── firebase.js       # Firestore CRUD operations
       └── scraper/
           ├── session-manager.js # VIC login & cookie handling
           ├── save-session.js    # Interactive login script
           ├── author-scraper.js  # Scrape author profiles
           ├── idea-scraper.js    # Scrape individual ideas
           └── rate-limiter.js    # Delays between requests (3-7s random)
   ```

2. **Installed dependencies:**
   - `playwright` - Browser automation for scraping
   - `firebase-admin` - Server-side Firestore access
   - Installed Chromium browser for Playwright

3. **VIC Session Management:**
   - Cloudflare blocks automated logins (CAPTCHA)
   - Solution: Manual login via Firefox → export cookies via Cookie-Editor extension
   - Cookies saved to `functions/session/cookies.json`
   - Session tested and working

4. **Seeded 10 real VIC authors to Firestore:**
   - michael99, charlie479, mack885, devo791, Motherlode
   - newman9, JackBlack, onodacapital, falcon44, rosco37
   - Found via web search of public VIC member URLs

5. **Test Results:**
   - Successfully accessed `michael99` profile page with saved cookies
   - Scraped 17 ideas from their profile
   - Extracted: ticker, ideaId, URL for each idea

**Note on VIC scraping policy:**
- `robots.txt` allows all crawling (no restrictions)
- Cloudflare protection blocks automated logins
- Workaround: Use manually-exported browser cookies

### Step 3: Data Pipeline ✅ (Completed Dec 22, 2025)
- [x] Integrate Yahoo Finance price fetching
- [x] Build XIRR calculation logic
- [x] Seed Firestore with sample ideas (13 ideas across 5 authors)
- [x] Verify data structure works

**What was done:**

1. **Created Price Service** (`functions/src/services/price-service.js`):
   - Uses `yahoo-finance2` for fetching stock prices
   - `getCurrentPrice(ticker)` - get latest price
   - `getPriceOnDate(ticker, date)` - get historical price
   - `updateAllPrices()` - batch update all tickers from ideas collection
   - Prices cached in Firestore `prices` collection

2. **Created Performance Calculator** (`functions/src/services/performance-calculator.js`):
   - Uses `xirr` package for XIRR calculation
   - `calculateAuthorMetrics(username)` - calculate metrics for one author
   - `calculateAllAuthorMetrics()` - calculate for all authors
   - `getLeaderboard(sortBy, limit)` - retrieve sorted leaderboard
   - Results saved to Firestore `authorMetrics` collection

3. **Created Test/Update Scripts**:
   - `npm run test:prices` - test price fetching
   - `npm run test:metrics` - test metrics calculation
   - `npm run update:prices` - update all prices from Yahoo Finance
   - `npm run update:metrics` - recalculate all author metrics
   - `npm run seed:ideas` - seed sample ideas for testing

4. **Verified End-to-End Pipeline**:
   - Sample ideas seeded with real tickers (AAPL, GOOGL, MSFT, etc.)
   - Prices fetched successfully from Yahoo Finance
   - XIRR calculated correctly for all authors
   - Leaderboard shows ranked results:
     - #1 mack885: 33.5% XIRR (3 picks)
     - #2 charlie479: 29.2% XIRR (3 picks)
     - #3 michael99: 23.7% XIRR (3 picks)
     - #4 devo791: 13.2% XIRR (2 picks)
     - #5 Motherlode: -2.4% XIRR (2 picks)

### Step 4: Frontend Integration
- [x] Set up Vite + React + Tailwind project *(prototype created)*
- [ ] Add Firebase SDK to frontend
- [ ] Migrate vic-leaderboard.jsx to use Firestore
- [ ] Add loading states and error handling
- [ ] Deploy to Vercel (free)

### Step 5: Cloud Functions
- [ ] Deploy scraper as Cloud Function
- [ ] Deploy price updater as Cloud Function
- [ ] Deploy metrics calculator as Cloud Function
- [ ] Test each function manually

### Step 6: Automation
- [ ] Set up Google Cloud Scheduler
- [ ] Configure daily scrape job (2 AM)
- [ ] Configure price update job (6 PM)
- [ ] Configure metrics recalc job (6:30 PM)
- [ ] Monitor for a week to ensure stability

---

## File Structure (Current)

```
vic-leaderboard/
├── PLAN.md                    # This file (project documentation)
├── .gitignore                 # Excludes secrets, node_modules, session files
├── vic-leaderboard.jsx        # Original UI reference
│
├── /firebase                  # Firebase configuration (✅ created Dec 21)
│   ├── .firebaserc            # Firebase project settings
│   ├── firebase.json          # Firebase config
│   ├── firebase-config.json   # SDK config keys
│   ├── firestore.rules        # Security rules
│   └── firestore.indexes.json # Index configuration
│
├── /functions                 # Scraper & Cloud Functions (✅ created Dec 22)
│   ├── package.json           # Dependencies: playwright, firebase-admin
│   ├── package-lock.json
│   ├── .env.example           # Template for credentials
│   ├── .gitignore             # Excludes service account, session, etc.
│   ├── service-account-key.json  # Firebase Admin key (gitignored!)
│   │
│   ├── /config
│   │   └── scrape-config.json # Rate limits, URLs, CSS selectors
│   │
│   ├── /session               # VIC login session (gitignored!)
│   │   ├── cookies.json       # Exported from Firefox Cookie-Editor
│   │   └── storage.json       # Playwright storage state
│   │
│   ├── /scripts
│   │   ├── seed-authors.js       # Populate initial author queue
│   │   └── seed-sample-ideas.js  # Seed sample ideas for testing
│   │
│   └── /src
│       ├── index.js              # Main entry: dailyScrape(), scrapeAuthor()
│       ├── run-daily-scrape.js   # Run daily scrape script
│       ├── test-scraper.js       # Test scraper connectivity
│       ├── test-prices.js        # Test price service
│       ├── test-metrics.js       # Test metrics calculator
│       ├── update-prices.js      # Update all prices script
│       ├── update-metrics.js     # Update all metrics script
│       │
│       ├── /scraper
│       │   ├── session-manager.js    # Cookie/session handling
│       │   ├── save-session.js       # Interactive login helper
│       │   ├── author-scraper.js     # Scrape author profile pages
│       │   ├── idea-scraper.js       # Scrape individual idea pages
│       │   └── rate-limiter.js       # Random delays (3-7s)
│       │
│       └── /services
│           ├── firebase.js           # Firestore CRUD operations
│           ├── price-service.js      # Yahoo Finance price fetching
│           └── performance-calculator.js  # XIRR & metrics
│
├── /frontend                  # React UI (✅ prototype created Dec 21)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── .env.example           # Firebase client config template
│   └── /src
│       ├── App.jsx
│       ├── main.jsx
│       └── /components
│           └── VICLeaderboard.jsx  # Main leaderboard component
│
└── /scripts                   # (planned - not yet created)
    └── backfill-prices.js     # Backfill historical prices
```

---

## Open Questions / Decisions Needed

1. **Hosting**: ✅ DECIDED
   - Frontend: Vercel (free)
   - Backend/Scheduler: Google Cloud Functions + Scheduler (free tier)
   - Database: Firebase Firestore (free tier)

2. **Author Discovery**: Start with manual list or auto-discover from public ideas?
   - Recommendation: Start with manual list of 20-30 known active authors
   - Can expand later by scraping idea pages for new author names

3. **Position Closing**: How to handle when an author "closes" a position?
   - Option A: Assume still holding unless they post an update
   - Option B: Use fixed evaluation periods (1yr, 3yr, 5yr snapshots) ← RECOMMENDED
   - This avoids complexity of tracking follow-up posts

4. **Delisted Stocks**: How to handle companies that got acquired or delisted?
   - Options: Use acquisition price, last traded price, or mark as "special situation"
   - Need a manual review process for these edge cases

5. **International Stocks**: VIC has non-US stocks. Include them or US-only initially?
   - Recommendation: US-only initially, simpler for Yahoo Finance
   - Can add international later with exchange suffixes (.L, .TO, etc.)

6. **Scraping Frequency**: ✅ DECIDED
   - ONE scrape per day total (not per author)
   - Very respectful to VIC servers
   - ~365 author refreshes per year

---

## Success Metrics

- [ ] 50+ authors tracked with accurate XIRR calculations
- [ ] Daily automated price updates working
- [ ] Leaderboard loads in < 1 second
- [ ] Scraper runs reliably without getting blocked
- [ ] Data accuracy verified against manual spot-checks

---

## ✅ RESOLVED: Fundamental Data Limitation

### The Problem

VIC authors are **not required to disclose when they exit positions**. This means:

1. We don't know when authors sold their positions
2. We can only measure "buy and hold forever" returns
3. This can **unfairly punish good traders**:
   - Author recommends stock at $50
   - Stock rises to $100, author sells (smart exit, +100% actual return)
   - Stock crashes to $25
   - Our leaderboard shows: **-50%** (punishes them!)
   - Author's real return: **+100%** (they did great!)

### What We CAN Measure

- Stock-picking ability (do their picks tend to go up?)
- Fixed-period returns (1yr, 3yr after recommendation)
- "Buy and hold simulation" performance

### What We CANNOT Measure

- Author's actual trading performance
- Exit timing skill
- Real portfolio returns

### Decision Made (Dec 21, 2025)

**Option 1: Proceed with transparency** ✅

We will build this as a **"Stock-Picking Tracker"** (not a "Performance Tracker") with clear disclaimers:

1. **Framing**: The app tracks stock-picking quality, NOT actual trading performance
2. **No exit scraping**: We will NOT attempt to scrape comments/follow-ups for exit mentions
3. **Still a leaderboard**: We keep the leaderboard format to rank authors by simulated returns
4. **Clear disclaimers throughout the UI**:
   - Prominent warning banner on every page
   - XIRR columns marked with asterisks (*)
   - "Simulated" language used consistently
   - Methodology modal explaining limitations
   - Footer disclaimer on all pages

### UI Prototype Status (Dec 21, 2025)

**Prototype running at:** `http://localhost:5174` (frontend folder)

**Tech stack:** React + Vite + Tailwind CSS

#### Current UI Elements:

1. **Header**: "VIC Stock-Picking Tracker" with methodology button
2. **Filter Bar**: Sort by 1yr/3yr/5yr XIRR, benchmark reference (S&P 500)
3. **Leaderboard Table**:
   - Rank (with medals for top 3)
   - Author name + last active
   - 5yr/3yr/1yr XIRR* (asterisk indicates simulated)
   - Total picks count
   - Best pick with return badge
   - Expandable rows showing recent recommendations
4. **Methodology Modal**: Explains XIRR calculation and limitations
5. **Footer Disclaimer**: Clarifies simulated nature of returns

#### Removed Elements (intentionally simplified):

1. ~~Stats Banner~~ - Too much information upfront
2. ~~Amber Warning Banner~~ - Too prominent, footer disclaimer sufficient
3. ~~Win Rate column~~ - Misleading metric (point-in-time snapshot, ignores magnitude)
4. ~~Avg Holding Period~~ - Cannot calculate without exit data

#### Metrics Being Tracked:

| Metric | Description | Status |
|--------|-------------|--------|
| XIRR (1yr/3yr/5yr) | Simulated annualized return assuming buy-and-hold | ✅ Keep |
| Total Picks | Number of recommendations by author | ✅ Keep |
| Best Pick | Highest returning recommendation | ✅ Keep |
| Win Rate | % of picks currently profitable | ❌ Removed |
| Avg Holding Period | Average time positions held | ❌ Removed (no exit data) |

### Resolution

- [x] Decision made on how to proceed
- [x] Plan updated to reflect new framing/disclaimers
- [x] UI prototype created with disclaimer elements
- [x] Simplified UI based on feedback (removed misleading metrics)

---

## 📊 Current Status Summary (Dec 22, 2025)

### What's Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Firebase Project | ✅ Done | `vic-leaderboard` project, Firestore in `nam5` region |
| Security Rules | ✅ Done | Public read, server-only write |
| Scraper Module | ✅ Done | Playwright-based, session working with VIC |
| VIC Session | ✅ Done | Cookies exported from Firefox, tested working |
| Author Seeding | ✅ Done | 10 real VIC authors in Firestore |
| Price Service | ✅ Done | Yahoo Finance integration working |
| XIRR Calculator | ✅ Done | Performance metrics calculating correctly |
| Sample Data | ✅ Done | 13 ideas across 5 authors, all with prices |
| Frontend Prototype | ✅ Done | React + Vite + Tailwind at localhost:5174 |

### What's Next (Step 4: Frontend Integration)

1. **Add Firebase SDK to frontend** - Connect React app to Firestore
2. **Migrate vic-leaderboard.jsx** - Replace mock data with real Firestore data
3. **Add loading states** - Handle async data fetching
4. **Deploy to Vercel** - Production deployment

### Key Files to Know

| File | Purpose |
|------|---------|
| `functions/scripts/seed-authors.js` | Add new authors to scrape queue |
| `functions/scripts/seed-sample-ideas.js` | Add sample ideas for testing |
| `functions/src/index.js` | Main scraper entry point |
| `functions/src/services/price-service.js` | Yahoo Finance price fetching |
| `functions/src/services/performance-calculator.js` | XIRR & metrics calculation |
| `functions/session/cookies.json` | VIC login (refresh if expired) |
| `functions/service-account-key.json` | Firebase Admin auth (never commit!) |

### How to Run

```bash
# Seed authors to Firestore
cd functions && npm run seed

# Seed sample ideas for testing
cd functions && npm run seed:ideas

# Update all prices from Yahoo Finance
cd functions && npm run update:prices

# Calculate metrics for all authors
cd functions && npm run update:metrics

# Test scraper connectivity
cd functions && npm run test:scrape

# Run frontend
cd frontend && npm run dev
```

### Current Leaderboard (Sample Data)

| Rank | Author | 5yr XIRR | Picks |
|------|--------|----------|-------|
| 1 | mack885 | 33.5% | 3 |
| 2 | charlie479 | 29.2% | 3 |
| 3 | michael99 | 23.7% | 3 |
| 4 | devo791 | 13.2% | 2 |
| 5 | Motherlode | -2.4% | 2 |

### Sensitive Files (gitignored)

- `functions/service-account-key.json` - Firebase Admin credentials
- `functions/session/*` - VIC login cookies
- `.env` files - Environment variables
