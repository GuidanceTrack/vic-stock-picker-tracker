# VIC Leaderboard Documentation

This directory contains research findings and implementation plans for the VIC Leaderboard project.

## Active Documents

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

1. Read [authentication-findings.md](./authentication-findings.md) - Explains the research and current approach
2. Run the import script to populate the database
3. Skip the stealth plugin plan (no longer needed)

---

## Project Structure

```
docs/
├── README.md                              ← You are here
├── authentication-findings.md             ← START HERE
└── stealth-plugin-implementation-plan.md  (superseded)
```
