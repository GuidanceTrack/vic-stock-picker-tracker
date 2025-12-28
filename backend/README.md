# VIC Leaderboard - Local Scraper Backend

A local Python/Flask backend for the VIC Leaderboard that scrapes Value Investors Club data using your own VIC cookies.

## Prerequisites

- Python 3.9+
- Chrome browser installed
- VIC member account

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Start the Flask server:**
   ```bash
   python app.py
   ```

   The API will be available at `http://localhost:5000`

3. **Start the frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## How to Get VIC Cookies

1. Open [valueinvestorsclub.com](https://valueinvestorsclub.com) in Firefox or Chrome
2. Log in to your VIC account (check "Remember me")
3. Install the [Cookie-Editor extension](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)
4. Click the Cookie-Editor icon in your browser toolbar
5. Click "Export" to copy all cookies as JSON
6. Paste the JSON into the cookie input form in the frontend

**Important:** Do not use the browser while the scraper is running. The VIC session can only be active in one place at a time.

## API Endpoints

### Cookie Management
- `POST /api/cookies` - Submit VIC cookies and start scraping
- `GET /api/cookies` - Check if valid cookies are stored

### Scraping
- `POST /api/scrape/start` - Start the scraping process
- `GET /api/scrape/status` - Get current scraping status

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard with pagination
  - Query params: `sort` (xirr5yr, xirr3yr, xirr1yr), `limit`, `offset`
- `GET /api/leaderboard/search?q=<term>` - Search authors by username

### Author Details
- `GET /api/author/<username>` - Get author details with their ideas

### Manual Updates
- `POST /api/update/prices` - Trigger price update
- `POST /api/update/metrics` - Trigger metrics recalculation

## Architecture

```
backend/
├── app.py                    # Flask server, API routes
├── requirements.txt          # Python dependencies
├── scraper/
│   ├── base.py              # Selenium setup, cookie handling
│   ├── latest_ideas.py      # Scrape newly-visible ideas feed
│   ├── idea_detail.py       # Scrape individual idea page for price
│   └── author_history.py    # Scrape author profile (sirindudler adaptation)
├── services/
│   ├── yahoo_prices.py      # yfinance wrapper
│   └── xirr_calculator.py   # pyxirr wrapper
├── db/
│   ├── models.py            # SQLAlchemy models
│   └── database.py          # DB connection, queries
└── vic_scraper.db           # SQLite database file (auto-created)
```

## Database

The backend uses SQLite for local storage. The database file (`vic_scraper.db`) is created automatically on first run.

### Tables
- `authors` - VIC members being tracked
- `ideas` - Stock recommendations
- `prices` - Current stock prices cache
- `author_metrics` - Calculated XIRR metrics
- `scrape_log` - Job execution history
- `cookie_store` - VIC session cookies

## Scraping Process

When you submit cookies and start scraping:

1. **Scrape Latest Ideas** - Gets recent ideas from the VIC ideas feed
2. **Process Ideas** - Adds new ideas to database, identifies new authors
3. **Scrape Author Histories** - For new authors, scrapes their full idea history (past 5 years)
4. **Fetch Historical Prices** - Gets price at recommendation from Yahoo Finance
5. **Update Current Prices** - Fetches current prices for all tickers
6. **Calculate Metrics** - Computes XIRR for all authors

## Rate Limiting

The scraper includes smart rate limiting to avoid detection:
- Base delay: 8-12 seconds between requests
- Jitter: 0-4 seconds random addition
- Longer delay (60-90 seconds) every 5 requests

## Troubleshooting

### "Cannot connect to backend"
Make sure the Flask server is running on port 5000.

### "Cookies are not valid"
The cookies may have expired. Log into VIC again and export fresh cookies.

### "ChromeDriver not found"
The webdriver-manager should handle this automatically. Make sure Chrome is installed.

### Prices show as N/A
Some tickers may be delisted, foreign, or unavailable on Yahoo Finance. This is expected for ~20-50% of small-cap value ideas.
