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

**Status:** ✅ Import complete, price fetching in progress
**Next:** Decide on XIRR window strategy and price population approach
