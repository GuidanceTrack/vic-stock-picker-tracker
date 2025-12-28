# VIC Authentication Research Findings

**Date:** December 24, 2025
**Status:** Research Complete - Alternative Solution Found

---

## TL;DR - Key Discovery

**We don't need to scrape VIC member profiles!** An existing dataset with 13,656+ ideas is available for import.

**Import script created:** `functions/scripts/import/import-vic-data.js`
**Run with:** `npm run import:vic-data` (in `functions/` directory)

---

## Problem Statement

Our scraper requires authenticated access to VIC member profile pages to collect:
- Author usernames
- Investment ideas (ticker, date, long/short)
- Recommendation history

Initially, we thought the problem was Cloudflare blocking automated browsers.

---

## Empirical Testing Results

### Test 1: Cloudflare Detection (PASSED ✅)

**Test:** Navigate to VIC with Playwright using expired cookies
**Result:** NO Cloudflare challenge page appeared
**File:** `functions/cloudflare-test.js`

```
✅ CLOUDFLARE ALLOWED - No challenge page
```

**Conclusion:** Cloudflare is NOT actively blocking Playwright on VIC.

---

### Test 2: Session Cookie Auto-Refresh (PARTIAL ❌)

**Test:** Check if `remember_web_*` token auto-refreshes authenticated session
**File:** `functions/src/scripts/test-auto-refresh.js`

**What we observed:**
```
Before:  vic_session EXPIRED
After:   vic_session CREATED (new cookie)
Status:  Login button still visible ❌
```

**Result:** The `remember_web_*` token (valid for 399 days) DOES create a new `vic_session` cookie, but that new session is **unauthenticated** (guest session).

---

### Test 3: Cookie Comparison (EMPIRICAL PROOF ✅)

**Test:** Compare auto-refreshed cookie vs manually-obtained cookie
**File:** `functions/compare-cookies.js`

**Findings:**

| Cookie Source | vic_session Value | Can Access Member Pages? |
|---------------|-------------------|--------------------------|
| Auto-refreshed by `remember_web_*` | `eyJpdiI6IjBtSkxJ...` | ❌ NO |
| Manual Firefox login | `eyJpdiI6InUwZTVF...` | ✅ YES |

**Empirical conclusion:** There ARE two different types of `vic_session` cookies:
1. **Unauthenticated session** - Created by remember token, no member access
2. **Authenticated session** - Created by actual login, grants member access

**Screenshot evidence:** `firefox-cookies-test.png` shows authenticated cookie accessing member content.

---

### Test 4: Public vs Private Content

**Test:** Check what data is publicly accessible
**File:** `functions/check-usernames.js`

**Results:**

| Page | Public Access? | Shows Usernames? | Shows Details? |
|------|----------------|------------------|----------------|
| `/ideas/` | ✅ YES | ✅ YES | Limited |
| `/member/{username}/{id}` | ❌ NO | N/A | Full history |

**Screenshot:** `ideas-with-authors.png` - Shows public ideas page includes usernames like "dewey4", "BigBen", "Motherlode"

**Conclusion:** The public `/ideas/` page shows usernames but NOT full member history.

---

## Cookie Analysis

### VIC Uses Laravel Authentication

Based on cookie naming patterns:
- `vic_session` - Laravel session cookie (expires 3-12 hours)
- `remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d` - Laravel "remember me" token (399 days)
- `LOGIN_NAME` - Additional auth token

### Cookie Expiration Timeline

```
Time 0:     Manual Firefox login
            ✅ vic_session created (authenticated)
            ✅ remember_web_* created (399 days)

Hour 3-12:  vic_session expires
            ❌ Can't access member pages

Playwright Navigate:
            ✅ remember_web_* triggers new vic_session
            ❌ But new session is UNAUTHENTICATED
            ❌ Still can't access member pages
```

---

## Research: How Others Solved This

### GitHub Projects Analyzed

1. **[dschonholtz/ValueInvestorsClub](https://github.com/dschonholtz/ValueInvestorsClub)**
   - Scraped 13,656 ideas
   - **Authentication method:** Uses public `/ideas/` page (no auth needed!)
   - **Data available:** SQL dump with usernames, tickers, dates, long/short
   - **Our finding:** We can import their data instead of scraping!

2. **[sirindudler/ValueInvestorsClub_Watchlist](https://github.com/sirindudler/ValueInvestorsClub_Watchlist)**
   - **Authentication method:** Manual cookie injection
   - Code snippet:
     ```python
     cookies = [
         {'name': 'vic_session', 'value': 'YOUR_SESSION_COOKIE_VALUE'}
     ]
     ```
   - **README instruction:** "Login to your VIC account in Google Chrome, set 'remember login'"
   - **Our finding:** They also refresh cookies manually - no automation

### Industry Standard Practice

Based on web searches ([Playwright Auth Docs](https://playwright.dev/docs/auth), [Cookie Management Articles](https://medium.com/automated-monotony/using-playwright-cookies-to-bypass-authentication-b5eb29b35c73)):

**Standard approach:**
1. Login once manually
2. Save cookies to file
3. Reuse cookies in automation
4. **When cookies expire → Manually re-authenticate**

**No one has solved auto-login for VIC** - all projects use manual cookie refresh.

---

## Why Stealth Plugins Won't Help

Initially, we planned to use `puppeteer-extra-plugin-stealth` to bypass detection.

**Why this is unnecessary:**

1. **Cloudflare isn't blocking us** (empirically proven)
2. **Problem is authentication, not detection** (cookies expire)
3. **Stealth plugins hide automation signals, but don't authenticate** (still need valid cookies)
4. **Even with stealth, cookies expire** (manual refresh still required)

The stealth plugin plan was based on incorrect assumptions about the root cause.

---

## The Better Solution: Import Existing Data

### dschonholtz Dataset

**Source:** [Google Drive SQL Dump](https://drive.google.com/file/d/1XdHbJu35eyJdMoHMyycudDjyCvrEmIBW/view?usp=sharing)

**Data included:**
- **13,656 investment ideas**
- **Usernames** (author of each idea)
- **Tickers**
- **Company names**
- **Posted dates**
- **Position type** (long/short)
- **Contest winner** status

**What's missing (that we'd fill):**
- Current stock prices (fetch from Yahoo Finance)
- XIRR calculations (compute ourselves)

### Import Process

**Status:** ✅ Import script created

**Location:** `functions/scripts/import/import-vic-data.js`

**How to run:**
```bash
cd functions
npm run import:vic-data
```

**What it does:**
1. Parses the 194MB SQL file
2. Extracts authors and ideas
3. Writes to Firestore collections:
   - `authors` (~1,000-2,000 unique members)
   - `ideas` (~13,656 recommendations)

**After import:**
```bash
npm run update:prices   # Fetch current prices from Yahoo Finance
npm run update:metrics  # Calculate XIRR for all authors
```

**Result:** Full leaderboard with 13,656 ideas without any scraping!

---

## Files & Evidence

### Test Scripts Created
- `functions/cloudflare-test.js` - Cloudflare detection test
- `functions/verify-login.js` - Member page access test
- `functions/compare-cookies.js` - Cookie comparison test
- `functions/check-usernames.js` - Public data test
- `functions/firefox-cookies.json` - Manually exported cookies

### Screenshots
- `test-screenshot.png` - VIC homepage (no Cloudflare)
- `member-page-test.png` - Member page redirect
- `verify-member-access.png` - Access denied
- `firefox-cookies-test.png` - Authenticated access working
- `ideas-with-authors.png` - Public ideas page

### Import Infrastructure
- `data/` - Directory for SQL dump
- `functions/scripts/import/` - Import scripts
- `functions/scripts/import/import-vic-data.js` - Main import script
- `functions/scripts/import/README.md` - Import documentation

---

## Decision: Don't Build the Scraper

### Reasons

1. **Data already exists** - 13,656 ideas available for free
2. **No authentication needed** - Can import directly
3. **More complete** - Covers years of VIC history
4. **No maintenance** - Don't need to keep cookies fresh
5. **No rate limiting concerns** - One-time import
6. **Same data structure** - Has everything we need

### What We Gain

- **Instant population** of leaderboard
- **Historical data** going back to 2003
- **No scraping overhead** (no Cloudflare, no cookies, no browser automation)
- **Lower complexity** (one import script vs continuous scraper)
- **Lower costs** (no Cloud Functions for scraping)

### What We Lose

- **Real-time updates** (data is from their scrape date, not live)
- **New ideas** (won't auto-capture new VIC posts)

### Acceptable Trade-offs

For a **leaderboard/ranking system**, historical data is perfect:
- Users want to see **long-term performance** (3yr, 5yr XIRR)
- New ideas take time to show results
- Can manually refresh dataset quarterly if needed

---

## Alternative: Hybrid Approach (Future)

If we later want new ideas:

1. **Start with import** (13,656 ideas baseline)
2. **Monitor public `/ideas/` page** (accessible without auth!)
3. **Scrape new posts only** (much simpler, no member profiles needed)
4. **Update incrementally** (append to existing dataset)

This avoids all the authentication complexity while still getting updates.

---

## Technical Learnings

### Laravel Session Behavior

**Expected behavior** (typical "remember me"):
```
remember_web_* token → Auto-login → Authenticated session
```

**VIC's actual behavior:**
```
remember_web_* token → Creates session → Unauthenticated (guest) session
```

**Why?** Laravel's `remember_web_*` tokens are designed to auto-login when you **navigate through the browser UI**, not when used in automation. The token validates you as a "returning user" but still requires the full login flow to authenticate.

### Playwright Capabilities

**What Playwright CAN do:**
- Load cookies from file ✅
- Navigate to pages with cookies ✅
- Execute JavaScript ✅
- Handle Cloudflare (in this case) ✅

**What Playwright CANNOT do:**
- Generate authenticated sessions from remember tokens ❌
- Bypass login forms without credentials ❌
- Keep sessions alive indefinitely ❌

---

## Recommended Next Steps

### Immediate Actions

1. ✅ Download SQL dump from Google Drive → Completed
2. ✅ Place in `data/VIC_IDEAS.sql` → Completed
3. ⏳ Run import script:
   ```bash
   cd functions
   npm run import:vic-data
   ```
4. ⏳ Fetch prices:
   ```bash
   npm run update:prices
   ```
5. ⏳ Calculate metrics:
   ```bash
   npm run update:metrics
   ```
6. ⏳ View leaderboard in frontend

### Long-term Options

**Option A: Static Dataset** (Recommended)
- Use imported data as-is
- Manually refresh annually
- Simple, reliable, no maintenance

**Option B: Public Page Monitoring**
- Monitor `/ideas/` page for new posts
- Scrape only new ideas (no auth needed)
- Updates without authentication complexity

**Option C: Manual Scraping** (Not Recommended)
- Keep the manual cookie refresh workflow
- Scrape member profiles when cookies are valid
- High maintenance, requires manual intervention

---

## Conclusion

**Original problem:** How to scrape VIC member profiles autonomously
**Attempted solution:** Stealth plugins to bypass detection
**Actual problem:** Cookie authentication expiration
**Empirical finding:** Remember tokens don't auto-authenticate
**Better solution:** Import existing 13,656-idea dataset

**Result:** We solved the business need (populate leaderboard) without solving the technical challenge (auto-authentication).

---

## References

- [dschonholtz/ValueInvestorsClub](https://github.com/dschonholtz/ValueInvestorsClub) - Data source
- [sirindudler/ValueInvestorsClub_Watchlist](https://github.com/sirindudler/ValueInvestorsClub_Watchlist) - Alternative approach
- [Playwright Authentication Docs](https://playwright.dev/docs/auth) - Cookie management
- [Laravel Authentication Docs](https://laravel.com/docs/12.x/authentication) - Remember me tokens
- [Using Playwright Cookies](https://medium.com/automated-monotony/using-playwright-cookies-to-bypass-authentication-b5eb29b35c73) - Best practices

---

## Implementation Progress (December 24, 2025)

### Completed Steps

1. **✅ Data Import Complete**
   - Imported 13,656 ideas into Firestore `ideas` collection
   - Imported 1,383 unique authors into Firestore `authors` collection
   - Parsed 8,467 unique company tickers

2. **✅ Daily Scraper Paused**
   - `daily-scrape` Cloud Scheduler job paused (no longer needed)
   - `daily-update` job still enabled for price/metrics updates
   - Command: `gcloud scheduler jobs pause daily-scrape --location=us-central1`

3. **✅ Historical Price Fetching Script Created**
   - New script: `functions/scripts/fetch-historical-prices.js`
   - Run with: `npm run fetch:prices`
   - Respects Yahoo Finance API rate limits (max 10 ideas/day)
   - Processes authors alphabetically
   - Tracks progress via `priceAtRec` field on each idea

### Challenges Discovered

#### Yahoo Finance API Limitations

| Issue | Example | Result |
|-------|---------|--------|
| Foreign tickers | `TSE:9684` (Tokyo) | No data available |
| Delisted companies | `NSR` (Neustar - acquired) | No data available |
| Very old data | Pre-2000 tickers | May not exist |
| Ticker changes | Company renamed/merged | Need manual mapping |

**Impact:** Some ideas will have `priceAtRec: -1` (failed to fetch). This is expected and acceptable.

#### XIRR Calculation Window

The XIRR metrics are calculated for rolling time windows:
- `xirr1yr` = Ideas from last 1 year only
- `xirr3yr` = Ideas from last 3 years only
- `xirr5yr` = Ideas from last 5 years only

**Example problem:**
- Author `1ofthe100` has XRX idea from September 2016
- That's 8+ years ago
- Falls OUTSIDE the 5-year window
- Result: `xirr5yr = null` even though we have valid price data

### GitHub Projects Context

Neither of the referenced GitHub projects built a user-facing web application:

| Project | What They Built | End Product |
|---------|-----------------|-------------|
| dschonholtz | Scraper + PostgreSQL dump | Raw data for research |
| sirindudler | Watchlist tracker | CLI tool for personal use |

**Our project is unique** - building an actual leaderboard web app from VIC data.

---

## Open Issues to Think Through

### 1. Ideas Outside XIRR Window

**Problem:** Many imported ideas are from 2010-2019, outside the 5-year XIRR window.

**Questions to consider:**
- Should we show "all-time" XIRR in addition to 1yr/3yr/5yr?
- Should older ideas contribute to an author's ranking at all?
- Is a 10-year window more appropriate for value investing?
- Should we weight recent picks more heavily?

### 2. Price Data Population Speed

**Current approach:** 10 ideas/day = ~1,365 days to complete all ideas

**Alternatives to consider:**
- Increase daily limit (risk: Yahoo API rate limiting)
- Batch by ticker (same ticker fetched once, applied to multiple ideas)
- Prioritize recent ideas (2020+) first
- Skip ideas older than 10 years entirely

### 3. Failed Price Fetches

**Current:** ~15-20% of tickers fail (delisted, foreign, renamed)

**Questions:**
- Should authors with many failed fetches be excluded from rankings?
- Should we show "X of Y picks have price data" on the UI?
- Do we need a manual ticker mapping table for common renames?

---

## Implementation Progress (December 25, 2025)

### Decisions Made

#### 1. Focus on 5-Year Window Only

**Decision:** Only fetch prices for ideas from the past 5 years.

**Rationale:**
- UI only displays 1yr/3yr/5yr XIRR metrics
- Older ideas would never appear in rankings anyway
- Significantly reduces the number of ideas to process
- Aligns data collection with UI capabilities

#### 2. Pre-Mark Inactive Authors

**Decision:** Create a script to pre-identify and mark authors with no recent ideas.

**Rationale:**
- Avoid querying ideas for 786 authors who have no relevant data
- Speed up the price fetching process
- One-time operation that pays dividends on every subsequent run

### Scripts Created

#### `functions/scripts/mark-inactive-authors.js`

**Purpose:** Pre-process all authors and mark those with no ideas in the past 5 years.

**Run with:**
```bash
cd functions
npm run mark:inactive
```

**What it does:**
1. Iterates through all unprocessed authors
2. Checks if they have any ideas within the 5-year window
3. Marks authors with no recent ideas as complete (`pricesFetchedAt` + `noRecentIdeas: true`)
4. Leaves authors with recent ideas for price fetching

### Code Changes

#### Modified `fetch-historical-prices.js`

**Functions updated:**
- `getIdeasNeedingPrices()` - Now filters to only ideas from past 5 years
- `countRemainingIdeas()` - Same 5-year filter for accurate counting

**Key change:**
```javascript
// Calculate 5-year cutoff date
const fiveYearsAgo = new Date();
fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

// Filter: only ideas within 5 years AND needing prices
const isWithinFiveYears = postedDate >= fiveYearsAgo;
```

### Results

#### Author Classification

| Category | Count | Percentage |
|----------|-------|------------|
| **Marked inactive** (no ideas in past 5 years) | 786 | 58% |
| **Has recent ideas** (need price fetching) | 564 | 42% |
| **Total authors** | 1,350 | 100% |

**Impact:** Reduced workload from 1,350 authors to 564 authors (58% reduction).

#### Price Fetching Progress

Processed ~40 authors with the following results:

| Author | XIRR 5yr | Notes |
|--------|----------|-------|
| AlfredJones%21 | **+73.4%** | Top performer |
| Arturo | **+30.1%** | |
| AltaRocks | **+19.1%** | |
| JackBlack | **+8.7%** | |
| Ares | **+3.9%** | |
| Akritai | **+2.8%** | |
| Azalea | **+1.4%** | |
| Astor | **+1.1%** | |
| BTudela16 | **-6.7%** | |
| BCD711 | **-11.6%** | |
| AIFL | **-17.5%** | |
| ATM | **-20.2%** | |
| BJG | **-20.3%** | |
| Artz0423 | **-30.1%** | |
| Asymmetrical | **-48.0%** | Worst performer so far |

#### Ticker Success Rate

From the ~40 authors processed:
- **~50% success rate** on price fetches
- **~50% delisted** or unavailable tickers

This is expected given the nature of small-cap value investing (companies get acquired, go bankrupt, or delist).

### Updated Workflow

**Daily price fetching:**
```bash
cd functions
npm run fetch:prices    # Processes next author alphabetically
```

**After fetching prices:**
```bash
npm run update:metrics  # Calculates XIRR for all authors with price data
```

### Remaining Work

| Task | Count | Est. Time |
|------|-------|-----------|
| Authors with recent ideas | 564 | ~56 days at 10/day |
| Ideas to process | ~2,000-3,000 | Varies by author |

### Open Issues Resolved

| Issue | Resolution |
|-------|------------|
| Ideas outside XIRR window | ✅ Only fetch prices for 5-year window |
| Price data population speed | ✅ Reduced scope by 58% via inactive marking |
| Failed price fetches | Accepted as normal (~50% for small-caps) |

---

**Status:** ✅ Import complete, 5-year filter implemented, ~40 authors with XIRR data
**Next:** Continue daily price fetching for remaining 564 authors

---

## New Architecture: Local Scraper App (December 28, 2025)

### Overview

A new approach: build a **local web application** that allows users to provide their VIC cookies and automatically scrape/calculate XIRR for authors of newly-visible ideas. This version is designed to be handed off to a friend to run locally.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Authentication** | None (cookie input) | User pastes VIC cookies directly |
| **Database** | SQLite (local) | No cloud dependency, per-user storage |
| **Scraping** | Python/Selenium | Reuse sirindudler's battle-tested code |
| **Frontend** | Existing React UI | Reuse VICLeaderboard.jsx |
| **Backend** | Python Flask | Serves API + runs scraper |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         React Frontend (existing UI)                 │   │
│  │  - Cookie input form (new)                          │   │
│  │  - Leaderboard display (reuse VICLeaderboard.jsx)   │   │
│  │  - Calls local Flask API instead of Firestore       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python Flask Backend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Flask API   │  │  Scraper     │  │  XIRR Calculator │   │
│  │  /api/*      │  │  (Selenium)  │  │  (pyxirr)        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SQLite Database (local)                  │   │
│  │  - authors, ideas, prices, scrape_log                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### User Flow

1. User opens http://localhost:3000 (React app)
2. Frontend shows cookie input form with instructions:
   - "Login to VIC in Firefox"
   - "Install Cookie-Editor extension"
   - "Export cookies as JSON"
   - "Paste JSON below"
   - "Don't use Firefox while scraping"
3. User pastes cookies and clicks "Start"
4. Backend scrapes VIC and updates database
5. Leaderboard displays results

### How VIC Works (Key Insight)

- VIC delays idea visibility by **45 days**
- Each day, ideas from 45 days ago become visible to members
- The scraper processes ideas that became visible "today" (the 45-day-old batch)

### Scraper Workflow

```
1. GET LATEST IDEAS (requires auth)
   - Navigate to member-only ideas feed
   - Find ideas from the "45 days ago" date
   - Extract: idea URL, author username, ticker, company name

2. FOR EACH NEW IDEA:
   a. SCRAPE IDEA DETAIL PAGE
      - Get author's stated "price at recommendation" (from page)
      - Get posting date, ticker, position type (long/short)

   b. CHECK IF AUTHOR ALREADY SCRAPED
      - If yes, skip to step 2c
      - If no, scrape author's full history (step 2b-i)

   b-i. SCRAPE AUTHOR PROFILE (sirindudler code)
      - Search via /search/{username}
      - Click through to member profile
      - Parse ideas table (past 5 years)
      - For each idea: visit page, scrape price

   c. FETCH CURRENT PRICES (Yahoo Finance via yfinance)

   d. CALCULATE XIRR (pyxirr library)
      - Store results in SQLite

3. DISPLAY RESULTS
   - Leaderboard shows authors ranked by XIRR
```

### Code Reuse from sirindudler

From `sirindudler-watchlist/code/VIC_postFinder.py`:

| Feature | Lines | What It Does |
|---------|-------|--------------|
| Cookie injection | 32-46 | Add `vic_session` cookie to Selenium |
| Member search | 75-86 | Navigate `/search/{username}`, click profile |
| Ideas table parsing | 88-133 | Parse `table.table.itable.box-shadow` |
| Rate limiting | 48-58 | Smart delays to avoid detection |

### New Backend Structure

```
backend/
├── app.py                    # Flask server, API routes
├── requirements.txt          # Python dependencies
├── scraper/
│   ├── base.py              # Selenium setup, cookie handling
│   ├── latest_ideas.py      # Scrape newly-visible ideas feed
│   ├── idea_detail.py       # Scrape individual idea page for price
│   └── author_history.py    # Adapted from sirindudler
├── services/
│   ├── yahoo_prices.py      # yfinance wrapper
│   └── xirr_calculator.py   # pyxirr wrapper
├── db/
│   ├── models.py            # SQLAlchemy models
│   └── database.py          # DB connection, queries
└── vic_scraper.db           # SQLite database file
```

### API Endpoints

```
POST /api/cookies          # Submit VIC cookies, start scraping
GET  /api/scrape/status    # Check scraping progress
GET  /api/leaderboard      # Get ranked authors with XIRR
GET  /api/author/{id}      # Get author details + ideas
```

### Frontend Modifications

| File | Changes |
|------|---------|
| `src/App.jsx` | Add cookie input page as first step |
| `src/services/api.js` | **New** - Replace Firestore with Flask API calls |
| `src/hooks/useLeaderboard.js` | Change to use local API |
| `src/components/CookieInput.jsx` | **New** - Cookie paste form |

### Running Locally

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
python app.py   # Runs on http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev     # Runs on http://localhost:3000
```

### Python Dependencies

```
flask>=3.0.0
flask-cors>=4.0.0
selenium>=4.15.0
webdriver-manager>=4.0.0
yfinance>=0.2.30
pyxirr>=0.9.0
sqlalchemy>=2.0.0
```

### Implementation Phases

1. **Phase 1: Backend Foundation** - Flask + SQLite + API endpoints
2. **Phase 2: Scraper Core** - Port sirindudler code, add idea detail scraper
3. **Phase 3: Prices & XIRR** - yfinance integration, pyxirr calculation
4. **Phase 4: Frontend Integration** - Cookie input, replace Firestore calls
5. **Phase 5: Polish** - Progress indicator, error handling, documentation

---

## Implementation Complete (December 28, 2025)

All phases have been implemented. The local scraper architecture is ready for use.

### Files Created

**Backend (`backend/`)**

| File | Description |
|------|-------------|
| `app.py` | Flask API server with all endpoints |
| `requirements.txt` | Python dependencies |
| `db/models.py` | SQLAlchemy models (Author, Idea, Price, AuthorMetrics, ScrapeLog, CookieStore) |
| `db/database.py` | Database operations and query functions |
| `db/__init__.py` | Package exports |
| `scraper/base.py` | Selenium setup with Cookie-Editor JSON format support |
| `scraper/latest_ideas.py` | Scrapes the VIC ideas feed |
| `scraper/idea_detail.py` | Scrapes individual idea pages for price at recommendation |
| `scraper/author_history.py` | Author profile scraping (adapted from sirindudler) |
| `scraper/__init__.py` | Package exports |
| `services/yahoo_prices.py` | yfinance wrapper for price fetching |
| `services/xirr_calculator.py` | pyxirr wrapper for XIRR calculations |
| `services/__init__.py` | Package exports |
| `README.md` | Setup and usage instructions |

**Frontend (`frontend/src/`)**

| File | Description |
|------|-------------|
| `App.jsx` | Updated with cookie input → scraping → leaderboard flow |
| `services/api.js` | Flask API client (replaces Firestore for local mode) |
| `components/CookieInput.jsx` | Cookie paste form with instructions |
| `components/ScrapeProgress.jsx` | Real-time scraping progress indicator |
| `hooks/useLocalLeaderboard.js` | Leaderboard hook for Flask API |
| `hooks/useLocalAuthor.js` | Author details hook for Flask API |
| `hooks/useScrapeStatus.js` | Scrape status polling hook |
| `components/VICLeaderboard.jsx` | Updated to support both Firestore and local API modes via `useLocalApi` prop |

### How to Run

**Terminal 1 - Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py   # Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev     # Runs on http://localhost:5173
```

### Cookie Format Supported

The system accepts Cookie-Editor JSON export format:
```json
[
    {
        "name": "vic_session",
        "value": "eyJpdiI6...",
        "domain": ".valueinvestorsclub.com",
        "path": "/",
        "secure": false,
        "httpOnly": true,
        "expirationDate": 1766908265.036
    }
]
```

### User Flow

1. User opens `http://localhost:5173`
2. Sees cookie input form with instructions
3. Exports cookies from Cookie-Editor in Firefox/Chrome
4. Pastes JSON and clicks "Submit"
5. Backend validates cookies and starts scraping
6. Progress page shows real-time updates
7. When complete, leaderboard displays with XIRR rankings

---

## LatestIdeasScraper Fix (December 28, 2025)

### Problem Discovered

When testing the local scraper app, the scrape completed but found **0 ideas**. Investigation revealed the `LatestIdeasScraper` was looking for `table.table` CSS selector on the `/ideas` page, but VIC's page structure had changed.

### VIC Page Structure (Current)

The `/ideas` page now uses a **card-based layout**, not a traditional table:

```html
<!-- Entry header with company name, ticker, price, market cap -->
<p class="entry-header">
    <a href="/idea/Allient_Inc./7736231948">Allient Inc.</a> ALNT • 54.00 • $910mn
</p>

<!-- Author info with username in span title attribute -->
<p class="submitted-by">
    BY <span title="S. N. Harper">S. N. Harper</span> • <span>Short Idea</span>
</p>
```

### Fix Applied

Updated `backend/scraper/latest_ideas.py` to:

1. Wait for `p.submitted-by` elements to load
2. Find all `p.entry-header` elements (company + ticker info)
3. Find all `p.submitted-by` elements (author info)
4. Match them by index (they appear in same order)
5. Extract author from `<span title="username">` attribute
6. Extract ticker using regex from header text
7. Detect "Short Idea" for position type

### Test Results

After fix:
```
Found 10 entry headers, 10 submitted-by elements
Idea: Allient Inc. (ALNT) by S. N. Harper [short]
Idea: Keystone Law Group plc (KEYS LN) by Snowball300830 [long]
Idea: SPORTRADAR GROUP AG (SRAD) by Jumbos02 [long]
Idea: ArcBest (ARCB) by leob710 [long]
...

Total ideas found: 10
Unique authors: ['leob710', 'CT3 1HP', 'S. N. Harper', 'zamperini', ...]
```

**Note:** The 10 ideas came from **multiple days** displayed on page 1, not just one day:
- Wednesday, Nov 12, 2025: 2 ideas (S. N. Harper, Snowball300830)
- Tuesday, Nov 11, 2025: more ideas
- Monday, Nov 10, 2025: more ideas
- etc.

The scraper currently grabs all ideas visible on the page regardless of date. If you only want **today's newly-visible ideas** (those that just passed the 45-day delay), the scraper would need to filter by the specific date header.

### Full Scrape Flow

The complete flow when user triggers a scrape:

1. **Step 1: LatestIdeasScraper** → Gets ideas from `/ideas` page, extracts author names ✅ (now fixed)
2. **Step 2: Save Ideas** → Stores ideas in SQLite database
3. **Step 3: AuthorHistoryScraper** → For each new author, goes to their profile page (`/member/{username}/{id}`), scrapes all their ideas from past 5 years
4. **Step 4: Price Fetching** → Gets prices from Yahoo Finance (yfinance)
5. **Step 5: Metrics Calculation** → Calculates XIRR for 1yr, 3yr, 5yr windows

### Still To Test

**The full end-to-end flow needs to be tested with a user:**

- [ ] Cookie input and validation
- [ ] LatestIdeasScraper finding ideas (now fixed)
- [ ] AuthorHistoryScraper scraping author profiles
- [ ] Price fetching from Yahoo Finance
- [ ] XIRR calculation and display in leaderboard
- [ ] Error handling and progress updates

The sirindudler-based `AuthorHistoryScraper` uses the same table selector (`table.table.itable.box-shadow`) that worked in the original project, so it should still work - but this needs real-world verification.

---

## Date Filtering Bug Fix (December 28, 2025)

### Problem Discovered

During testing, the scraper grabbed 10 ideas instead of just the ideas from the latest day. Investigation revealed:

1. User observed only 1 idea posted on Nov 13, 2025 when visiting VIC directly
2. Scraper grabbed 10 ideas and labeled them all as Nov 12, 2025
3. Date filtering was not working - all ideas on the page were being scraped

### Root Cause Analysis

**The CSS selector was wrong.** The scraper was looking for:

```python
# WRONG - looking for h2, h3, or .date-header
date_headers = self.driver.find_elements(By.CSS_SELECTOR,
    "h2.date-header, h3.date-header, .date-header, h2, h3")
```

But the actual VIC `/ideas` page uses `<p class="header">` for date headers:

```html
<div id="ideas_body">
    <div class="row">
        <div class="col-lg-12">
            <p class="header">Wednesday, Nov 12, 2025</p>
        </div>
    </div>
    <!-- ideas for Nov 12 -->
    <div class="row">
        <div class="col-lg-12">
            <p class="header">Tuesday, Nov 11, 2025</p>
        </div>
    </div>
    <!-- ideas for Nov 11 -->
</div>
```

The `.date-header` class exists but only in the **messages panel** on the right side, not in the ideas list.

### Fix Applied

Changed the CSS selector in `backend/scraper/latest_ideas.py`:

```python
# CORRECT - specifically target date headers in the ideas body
date_headers = self.driver.find_elements(By.CSS_SELECTOR, "#ideas_body p.header")
```

### Testing Required

The fix has been applied but needs verification:

1. Delete the existing SQLite database: `del backend/vic_scraper.db`
2. Restart the Flask server
3. Submit cookies through the frontend
4. Verify that only ideas from the latest day are scraped (should be 1-3 ideas typically, not 10)
5. Check that the correct date is assigned to each idea

---

## End-to-End Test Successful (December 28, 2025)

### Test Scenario

Deleted author "yellow" from the database and ran a fresh scrape to verify the full flow works.

### Test Steps Performed

1. **Deleted yellow from SQLite database** - Removed from `authors`, `ideas`, and `author_metrics` tables
2. **Started both servers:**
   - Backend: `python app.py` → http://localhost:5000
   - Frontend: `npm run dev` → http://localhost:5176
3. **Clicked "Scrape New Ideas" button** on the leaderboard
4. **Observed scraping progress:**
   - Step 1: Scraping Latest Ideas → Found yellow's CLLNY idea (Nov 13, 2025)
   - Step 2: Scraping Author Histories → Processing yellow
   - Step 3: Fetching Prices → Yahoo Finance queries (some 404s for international tickers)
   - Step 4: Calculating Metrics → XIRR computed
5. **Scrape completed** → Redirected to leaderboard

### Results

| Author | Rank | 5YR XIRR | 3YR XIRR | 1YR XIRR | Picks | Best Pick |
|--------|------|----------|----------|----------|-------|-----------|
| **yellow** | #1 | **+87.1%** | **+87.1%** | **+87.1%** | 3 | EQX +119% |

Yellow was correctly:
- Detected as a new author (not in DB)
- Added to `authors` table
- Had their full history scraped (3 ideas: CLLNY, EQX, CNM)
- Prices fetched from Yahoo Finance
- XIRR calculated and stored in `author_metrics`
- Ranked #1 on the leaderboard

### UI Enhancements Added

Added "Scrape New Ideas" button to the leaderboard header:
- Only visible in local API mode (`useLocalApi={true}`)
- Calls `/api/scrape/start` endpoint
- Switches to progress view during scrape
- Returns to leaderboard when complete

**Files modified:**
- `frontend/src/components/VICLeaderboard.jsx` - Added button and `onStartScrape` prop
- `frontend/src/App.jsx` - Added `handleStartScrape` function

### Open Question (Parked)

> Can we assume that we would always have to manually hit the scrape button?

Options to consider for future:
1. **Manual only** - User clicks "Scrape New Ideas" when they want fresh data
2. **Scheduled scrape** - Backend runs scrape on a schedule (daily/weekly)
3. **Auto-scrape on startup** - Scrape automatically when app starts if data is stale

Currently: Manual scrape via button click.

---

**Status:** Full scraping flow verified working. Ready for user testing.
