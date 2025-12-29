# VIC Leaderboard Documentation

This directory contains research findings and implementation plans for the VIC Leaderboard project.

## Active Documents

### [codebase-review.md](./codebase-review.md)
**Status:** ✅ Current (Dec 24, 2025)

Complete architecture overview of the VIC Leaderboard project. **Start here if you're new to the codebase.**

**Covers:**
- Technology stack and directory structure
- Database schema and data flow
- Core components and their responsibilities
- Development setup and deployment

### [authentication-findings.md](./authentication-findings.md)
**Status:** ✅ Current (Dec 24, 2025)

Comprehensive research on VIC authentication, cookie behavior, and scraping approaches.

**Key findings:**
- Cloudflare is NOT blocking Playwright (empirically proven)
- Cookie authentication expires every 3-12 hours
- Remember tokens create unauthenticated sessions
- Better solution: Import 13,656-idea dataset instead of scraping

**Next steps:**
```bash
cd functions
npm run import:vic-data  # Import existing VIC dataset
```

## Superseded Documents

### [stealth-plugin-implementation-plan.md](./stealth-plugin-implementation-plan.md)
**Status:** ⚠️ Superseded (Dec 24, 2025)

Original plan to implement stealth plugins to bypass Cloudflare.

**Why superseded:** Empirical testing proved Cloudflare wasn't the issue - kept for historical reference.

---

## Quick Start

If you're new to this project:

1. Read [codebase-review.md](./codebase-review.md) - Architecture overview and development setup
2. Read [authentication-findings.md](./authentication-findings.md) - Research on VIC scraping approach
3. Run the import script to populate the database

---

## How to Use the App

### 1. Install Dependencies

Some packages need to be installed from the terminal before running the app:

**Backend (Python):**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend (Node.js):**
```bash
cd frontend
npm install
```

### 2. Start the Servers

You need to run the backend and frontend in **two separate terminals**:

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```
This starts the Flask server on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
This starts the React app on http://localhost:5173

### 3. Browser Setup (Firefox)

Before using the app, you need to set up cookie authentication:

1. **Login to VIC** - Open Firefox and login to [valueinvestorsclub.com](https://valueinvestorsclub.com)
2. **Install Cookie-Editor** - Install the [Cookie-Editor](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/) extension for Firefox
3. **Export Cookies** - Click the Cookie-Editor icon and select "Export" → "Export as JSON"

### 4. Using the App

1. Open http://localhost:5173 in your browser
2. On first boot, the app will prompt you to paste your VIC cookies
3. Paste the JSON you exported from Cookie-Editor and submit
4. The leaderboard will load after scraping completes
5. To refresh data later, click the "Scrape New Ideas" button (you may need to re-export fresh cookies if they've expired)

> **Note:** VIC cookies typically expire after 3-12 hours, so you may need to re-login and export fresh cookies periodically.

---

## Project Structure

```
docs/
├── README.md                              ← You are here
├── codebase-review.md                     ← START HERE (architecture overview)
├── authentication-findings.md             ← Research findings
└── stealth-plugin-implementation-plan.md  (superseded)
```
