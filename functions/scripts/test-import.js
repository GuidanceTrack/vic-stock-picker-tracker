/**
 * Test script to validate import and price fetching
 */

const fs = require('fs');
const readline = require('readline');

async function findRecentIdeas() {
  const rl = readline.createInterface({
    input: fs.createReadStream('c:/Users/garim/Vic-Leaderboard/data/VIC_IDEAS.sql'),
    crlfDelay: Infinity
  });

  let currentSection = null;
  const companies = new Map();
  const ideas = [];

  // Common tickers that should still exist
  const goodTickers = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'JPM', 'V', 'WMT', 'JNJ', 'PG', 'KO', 'PEP', 'DIS', 'NFLX'];

  for await (const line of rl) {
    if (line.startsWith('COPY public.companies')) {
      currentSection = 'companies';
      continue;
    } else if (line.startsWith('COPY public.ideas')) {
      currentSection = 'ideas';
      continue;
    } else if (line === '\\.' || line === '\\.') {
      currentSection = null;
      continue;
    }

    if (currentSection === 'companies') {
      const [ticker, companyName] = line.split('\t');
      if (ticker) companies.set(ticker, companyName);
    } else if (currentSection === 'ideas') {
      const parts = line.split('\t');
      const [id, link, ticker, userLink, date, isShort, isContestWinner] = parts;
      if (id && ticker && date) {
        const year = parseInt(date.substring(0, 4));
        // Look for recent ideas (2018+) with good tickers
        if (year >= 2018 && goodTickers.includes(ticker)) {
          ideas.push({ id, ticker, userLink, date, isShort: isShort === 't', companyName: companies.get(ticker) });
        }
      }
    }
  }

  console.log('=== Recent Ideas with Common Tickers ===\n');
  ideas.slice(0, 5).forEach((idea, i) => {
    const match = idea.userLink ? idea.userLink.match(/\/member\/([^\/]+)\/([\d]+)/) : null;
    const username = match ? match[1] : 'unknown';
    const position = idea.isShort ? 'SHORT' : 'LONG';
    const company = idea.companyName ? idea.companyName.trim() : idea.ticker;
    const dateStr = idea.date.split(' ')[0];
    console.log(`${i+1}. ${idea.ticker} (${company}) - ${dateStr} - ${position} by ${username}`);
  });

  return ideas.slice(0, 2);
}

async function testYahooFinance(ideas) {
  const yahooFinance = (await import('yahoo-finance2')).default;

  console.log('\n=== Testing Yahoo Finance Historical Price Fetch ===\n');

  for (const idea of ideas) {
    const company = idea.companyName ? idea.companyName.trim() : idea.ticker;
    console.log(`Testing: ${idea.ticker} (${company}) on ${idea.date.split(' ')[0]}`);

    const targetDate = new Date(idea.date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 5);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 5);

    try {
      const history = await yahooFinance.historical(idea.ticker, {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d'
      });

      if (history && history.length > 0) {
        // Find closest date
        let closest = history[0];
        let minDiff = Math.abs(new Date(history[0].date) - targetDate);

        for (const day of history) {
          const diff = Math.abs(new Date(day.date) - targetDate);
          if (diff < minDiff) {
            minDiff = diff;
            closest = day;
          }
        }

        console.log(`  ✅ Found price data:`);
        console.log(`     Date: ${closest.date.toISOString().split('T')[0]}`);
        console.log(`     Open: $${closest.open ? closest.open.toFixed(2) : 'N/A'}`);
        console.log(`     Close: $${closest.close ? closest.close.toFixed(2) : 'N/A'}`);
        console.log(`     Adj Close: $${closest.adjClose ? closest.adjClose.toFixed(2) : 'N/A'}`);
      } else {
        console.log(`  ❌ No data found`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function main() {
  const ideas = await findRecentIdeas();
  if (ideas.length > 0) {
    await testYahooFinance(ideas);
  }
}

main().catch(console.error);
