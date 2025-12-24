# Import Scripts

Scripts for importing external data sources into Firestore.

## VIC Ideas SQL Import

Imports the dschonholtz VIC_IDEAS.sql database dump into Firestore.

**Data source:** https://github.com/dschonholtz/ValueInvestorsClub

### Prerequisites

1. Download `VIC_IDEAS.sql` from Google Drive:
   https://drive.google.com/file/d/1XdHbJu35eyJdMoHMyycudDjyCvrEmIBW/view?usp=sharing

2. Place it in: `Vic-Leaderboard/data/VIC_IDEAS.sql`

3. Ensure Firebase service account key exists:
   `functions/service-account-key.json`

### Usage

```bash
cd functions
npm run import:vic-data
```

### What it does

1. Parses the 194MB SQL file (13,656+ ideas)
2. Extracts:
   - Authors (username, VIC user ID, profile URL)
   - Ideas (ticker, company, date, long/short, contest winner)
3. Imports to Firestore collections:
   - `authors` - Unique VIC members
   - `ideas` - Investment recommendations

### After Import

1. Fetch current prices:
   ```bash
   npm run update:prices
   ```

2. Calculate XIRR metrics:
   ```bash
   npm run update:metrics
   ```

### Data Structure

**Authors Collection:**
- username (doc ID)
- vicUserId
- profileUrl
- discoveredAt
- lastScrapedAt

**Ideas Collection:**
- vicIdeaId (doc ID)
- authorUsername
- ticker
- companyName
- ideaUrl
- postedDate
- positionType (long/short)
- isContestWinner
- priceAtRec (null - to be filled)
- marketCapAtRec (null - to be filled)
- scrapedAt (null - to be filled)
