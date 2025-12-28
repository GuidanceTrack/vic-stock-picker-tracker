# VIC Leaderboard - Codebase Architecture Review

*Last updated: December 28, 2025*

This document provides a comprehensive overview of the VIC Leaderboard codebase architecture for onboarding new contributors.

## Project Overview

**VIC Stock-Picking Tracker** is a web application that tracks and ranks Value Investors Club (VIC) members by their stock-picking quality. The system calculates simulated buy-and-hold returns (XIRR) for member recommendations and displays them on a public leaderboard.

**Important:** This tracks *hypothetical* returns based on recommendations, not actual trading performance.

## Two Deployment Modes

The project supports two deployment architectures:

| Mode | Backend | Database | Use Case |
|------|---------|----------|----------|
| **Cloud** | Firebase Cloud Functions | Firestore | Public deployment, automated scraping |
| **Local** | Python Flask | SQLite | Personal use, manual cookie input |

---

## Technology Stack

### Cloud Mode (Firebase)

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + Vite | 19.2 / 7.2 |
| **Styling** | Tailwind CSS | 4.1 |
| **Backend** | Firebase Cloud Functions | Node.js 20+ |
| **Database** | Firebase Firestore | - |
| **Scraping** | Playwright | 1.40 |
| **Financial Data** | yahoo-finance2 | 2.11 |
| **Hosting** | Vercel (frontend), GCP (functions) | - |

### Local Mode (Flask)

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + Vite | 19.2 / 7.2 |
| **Styling** | Tailwind CSS | 4.1 |
| **Backend** | Python Flask | 3.0+ |
| **Database** | SQLite + SQLAlchemy | 2.0+ |
| **Scraping** | Selenium + webdriver-manager | 4.15+ |
| **Financial Data** | yfinance | 0.2.30+ |
| **XIRR** | pyxirr | 0.9+ |

---

## Directory Structure

```
Vic-Leaderboard/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx            # App entry point
│   │   ├── App.jsx             # Root component with mode switching
│   │   ├── firebase.js         # Firebase client initialization
│   │   ├── components/
│   │   │   ├── VICLeaderboard.jsx  # Main leaderboard UI (supports both modes)
│   │   │   ├── Pagination.jsx      # Pagination controls
│   │   │   ├── CookieInput.jsx     # Cookie paste form (local mode)
│   │   │   └── ScrapeProgress.jsx  # Scraping progress (local mode)
│   │   ├── hooks/
│   │   │   ├── useLeaderboard.js   # Firestore leaderboard data
│   │   │   ├── usePaginatedLeaderboard.js  # Firestore pagination
│   │   │   ├── useAuthor.js        # Firestore author details
│   │   │   ├── useLocalLeaderboard.js  # Flask API leaderboard
│   │   │   ├── useLocalAuthor.js       # Flask API author details
│   │   │   └── useScrapeStatus.js      # Flask API scrape progress
│   │   └── services/
│   │       ├── firestore.js        # Firestore query functions
│   │       └── api.js              # Flask API client
│   └── package.json
│
├── backend/                     # Python Flask backend (local mode)
│   ├── app.py                  # Flask server, API routes
│   ├── requirements.txt        # Python dependencies
│   ├── scraper/
│   │   ├── __init__.py         # Module exports
│   │   ├── base.py             # Selenium setup, cookie handling
│   │   ├── latest_ideas.py     # Scrape VIC ideas feed
│   │   ├── idea_detail.py      # Scrape idea pages for prices
│   │   └── author_history.py   # Scrape author profiles
│   ├── services/
│   │   ├── __init__.py         # Module exports
│   │   ├── yahoo_prices.py     # yfinance wrapper
│   │   └── xirr_calculator.py  # pyxirr wrapper
│   ├── db/
│   │   ├── __init__.py         # Module exports
│   │   ├── models.py           # SQLAlchemy models
│   │   └── database.py         # DB connection, queries
│   ├── vic_scraper.db          # SQLite database (auto-created)
│   └── README.md               # Setup instructions
│
├── functions/                  # Firebase Cloud Functions (cloud mode)
│   ├── index.js               # Root function entry point
│   ├── src/
│   │   ├── index.js           # Function exports
│   │   ├── run-daily-scrape.js
│   │   ├── update-prices.js
│   │   ├── update-metrics.js
│   │   ├── test-*.js          # Test scripts
│   │   ├── scraper/
│   │   │   ├── session-manager.js    # VIC session handling
│   │   │   ├── author-scraper.js     # Profile scraping
│   │   │   ├── idea-scraper.js       # Idea page scraping
│   │   │   ├── rate-limiter.js       # Request throttling
│   │   │   └── save-session.js       # Session persistence
│   │   ├── services/
│   │   │   ├── firebase.js           # Firestore operations
│   │   │   ├── price-service.js      # Yahoo Finance integration
│   │   │   └── performance-calculator.js  # XIRR calculation
│   │   └── scripts/
│   │       ├── migrate-username-lower.js
│   │       ├── check-session-health.js
│   │       ├── debug-motherlode.js
│   │       └── test-auto-refresh.js
│   ├── scripts/                # Utility scripts
│   │   ├── seed-authors.js
│   │   ├── seed-sample-ideas.js
│   │   ├── fetch-historical-prices.js
│   │   ├── mark-inactive-authors.js
│   │   ├── test-import.js
│   │   └── import/
│   │       ├── import-vic-data.js
│   │       └── README.md
│   ├── config/                 # Configuration files
│   └── package.json
│
├── sirindudler-watchlist/      # Reference implementation for scraping
│   └── code/
│       └── VIC_postFinder.py   # Original author scraping code
│
├── docs/                       # Documentation
│   ├── codebase-review.md      # This file
│   ├── authentication-findings.md
│   ├── plan.md                 # Development planning notes
│   └── README.md               # Documentation index
│
├── data/                       # Data directory
│   └── README.md               # Links to VIC dataset
│
├── firebase/                   # Firebase configuration
│
├── vic-leaderboard.jsx         # Legacy standalone component
│
└── firebase.json               # Root Firebase config
```

---

## Database Schema

### Firestore (Cloud Mode)

**`authors`** - VIC members being tracked
```javascript
{
  username: string,
  vicUserId: string,
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
  priceAtRec: number,
  positionType: 'long' | 'short',
  marketCapAtRec: number
}
```

**`authorMetrics`** - Calculated performance metrics
```javascript
{
  username: string,
  usernameLower: string,
  xirr5yr: number,
  xirr3yr: number,
  xirr1yr: number,
  totalPicks: number,
  winRate: number,
  bestPickTicker: string,
  bestPickReturn: number
}
```

### SQLite (Local Mode)

The local mode uses SQLite with SQLAlchemy ORM. Database file: `backend/vic_scraper.db` (auto-created on first run).

**`authors`** - VIC members being tracked
```python
id: Integer (PK)
username: String(100), unique, indexed
username_lower: String(100), indexed  # Case-insensitive search
vic_user_id: String(50)
discovered_at: DateTime
last_scraped_at: DateTime
no_recent_ideas: Boolean  # True if no ideas in past 5 years
```

**`ideas`** - Stock recommendations
```python
id: Integer (PK)
author_id: Integer (FK → authors.id)
vic_idea_id: String(50), unique
ticker: String(20), indexed
company_name: String(200)
posted_date: DateTime, indexed
position_type: String(10)  # 'long' or 'short'
price_at_rec: Float
market_cap_at_rec: Float
idea_url: String(500)
scraped_at: DateTime
```

**`prices`** - Current stock price cache
```python
id: Integer (PK)
ticker: String(20), unique, indexed
current_price: Float
last_updated: DateTime
fetch_failed: Boolean  # True if ticker couldn't be fetched
```

**`author_metrics`** - Calculated XIRR performance
```python
id: Integer (PK)
author_id: Integer (FK → authors.id), unique
username: String(100), indexed  # Denormalized
username_lower: String(100), indexed
xirr_5yr: Float
xirr_3yr: Float
xirr_1yr: Float
total_picks: Integer
win_rate: Float
best_pick_ticker: String(20)
best_pick_return: Float
calculated_at: DateTime
```

**`scrape_log`** - Job execution history
```python
id: Integer (PK)
job_type: String(50)  # 'ideas', 'author', 'prices', 'metrics'
author_username: String(100)
status: String(20)  # 'success', 'failed', 'partial'
items_processed: Integer
error_message: Text
started_at: DateTime
completed_at: DateTime
```

**`cookie_store`** - VIC session cookies
```python
id: Integer (PK)
cookie_name: String(100)
cookie_value: Text
domain: String(100)
expires_at: DateTime
created_at: DateTime
is_valid: Boolean
```

---

## Architecture & Data Flow

### Cloud Mode (Firebase)

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
│  Playwright → VIC Website → Firestore                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Firestore Database                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              React Frontend (Vercel)                         │
│  useLeaderboard / usePaginatedLeaderboard                   │
└─────────────────────────────────────────────────────────────┘
```

### Local Mode (Flask)

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         React Frontend (localhost:5173)             │   │
│  │  1. Cookie input form                               │   │
│  │  2. Scrape progress indicator                       │   │
│  │  3. Leaderboard display                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python Flask Backend (localhost:5000)        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Flask API   │  │  Scraper     │  │  XIRR Calculator │   │
│  │  /api/*      │  │  (Selenium)  │  │  (pyxirr)        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SQLite Database (local)                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Components

| File | Purpose | Mode |
|------|---------|------|
| `VICLeaderboard.jsx` | Main leaderboard with expandable rows, search, pagination | Both |
| `Pagination.jsx` | Page navigation controls | Both |
| `CookieInput.jsx` | Cookie paste form with instructions | Local |
| `ScrapeProgress.jsx` | Real-time scraping progress | Local |

### Hooks

| Hook | Purpose | Mode |
|------|---------|------|
| `useLeaderboard.js` | Real-time Firestore subscription | Cloud |
| `usePaginatedLeaderboard.js` | Cursor-based pagination | Cloud |
| `useAuthor.js` | Author details from Firestore | Cloud |
| `useLocalLeaderboard.js` | Flask API leaderboard | Local |
| `useLocalAuthor.js` | Flask API author details | Local |
| `useScrapeStatus.js` | Flask API scrape progress polling | Local |

---

## Local Mode API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with stats |
| `/api/cookies` | POST | Submit VIC cookies, start scraping |
| `/api/cookies` | GET | Check if valid cookies stored |
| `/api/scrape/start` | POST | Start scraping process |
| `/api/scrape/status` | GET | Get scraping progress |
| `/api/leaderboard` | GET | Paginated leaderboard (`sort`, `limit`, `offset`) |
| `/api/leaderboard/search` | GET | Search authors (`q`, `limit`) |
| `/api/author/<username>` | GET | Author details with ideas |
| `/api/update/prices` | POST | Trigger price update |
| `/api/update/metrics` | POST | Trigger metrics recalculation |

---

## Development Setup

### Local Mode (Recommended for personal use)

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

### Cloud Mode

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Functions:**
```bash
cd functions
npm install
firebase deploy --only functions
```

---

## Key Design Decisions

1. **Dual Architecture** - Supports both cloud (Firebase) and local (Flask) deployments
2. **Cookie-Based Auth** - Local mode uses Cookie-Editor JSON export for VIC authentication
3. **Smart Rate Limiting** - 8-12 second delays with jitter, longer pauses every 5 requests
4. **5-Year Window** - Only fetches prices for ideas within past 5 years (matches UI display)
5. **Conditional Hooks** - Frontend hooks accept `null` to disable, avoiding unnecessary API calls
6. **sirindudler Adaptation** - Author scraping based on proven VIC_postFinder.py code

---

## Current Status

### Completed
- [x] Cloud mode (Firebase) fully implemented
- [x] Local mode (Flask) fully implemented
- [x] Frontend supports both modes via `useLocalApi` prop
- [x] Cookie input with Cookie-Editor JSON format support
- [x] Scrape progress tracking with real-time updates
- [x] XIRR calculation (1yr, 3yr, 5yr windows)
- [x] Author search (case-insensitive prefix matching)
- [x] Pagination (25 items/page)
- [x] Cloud Functions deployed to GCP
- [x] Cloud Scheduler automation configured
- [x] Data import scripts for VIC dataset
- [x] Historical price fetching utilities
- [x] Session health monitoring scripts

### In Progress
- [ ] Production data population
- [ ] Frontend deployment to Vercel

---

## Related Documentation

- [authentication-findings.md](./authentication-findings.md) - VIC auth research & local architecture design
- [plan.md](./plan.md) - Development planning notes and implementation details
- [README.md](./README.md) - Documentation index
- [backend/README.md](../backend/README.md) - Local mode setup instructions
- [data/README.md](../data/README.md) - Dataset information
- [functions/scripts/import/README.md](../functions/scripts/import/README.md) - Data import guide
