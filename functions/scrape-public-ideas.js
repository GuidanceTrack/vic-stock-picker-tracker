/**
 * Scrape public VIC ideas page to find recent ideas for specific authors
 * Tests if we can get data without authentication
 */

const { chromium } = require('playwright');

const TARGET_AUTHORS = [
  'AlfredJones!',  // Note: %21 is URL-encoded !
  'Arturo',
  'JackBlack',
  'Akritai',
  'Azalea'
];

async function scrapePublicIdeas() {
  console.log('=== Scraping VIC Public Ideas Page ===\n');

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // Navigate to ideas page
    console.log('Navigating to https://www.valueinvestorsclub.com/ideas ...');
    await page.goto('https://www.valueinvestorsclub.com/ideas', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Take screenshot for debugging
    await page.screenshot({ path: 'public-ideas-page.png', fullPage: true });
    console.log('Screenshot saved: public-ideas-page.png\n');

    // Check for login wall message
    const pageContent = await page.content();
    if (pageContent.includes('not eligible to view')) {
      console.log('⚠️  Login wall detected - checking what IS visible...\n');
    }

    // Try to find any idea entries
    const ideaLinks = await page.$$eval('a[href*="/idea/"]', links =>
      links.map(l => ({ href: l.href, text: l.textContent.trim() }))
    );
    console.log(`Found ${ideaLinks.length} idea links`);
    if (ideaLinks.length > 0) {
      console.log('Sample idea links:', ideaLinks.slice(0, 5));
    }

    // Try to find author/member links
    const memberLinks = await page.$$eval('a[href*="/member/"]', links =>
      links.map(l => ({ href: l.href, text: l.textContent.trim() }))
    );
    console.log(`\nFound ${memberLinks.length} member links`);
    if (memberLinks.length > 0) {
      console.log('Member links:', memberLinks.slice(0, 10));
    }

    // Try to find table rows or list items that might contain ideas
    const tableRows = await page.$$('table tr');
    console.log(`\nFound ${tableRows.length} table rows`);

    // Look for any ticker symbols (usually uppercase 1-5 letters)
    const tickerPattern = await page.$$eval('*', elements => {
      const tickers = [];
      elements.forEach(el => {
        const text = el.textContent;
        const matches = text.match(/\b[A-Z]{1,5}\b/g);
        if (matches) {
          matches.forEach(m => {
            if (!tickers.includes(m) && m.length >= 2) {
              tickers.push(m);
            }
          });
        }
      });
      return tickers.slice(0, 20);
    });
    console.log('\nTickers found on page:', tickerPattern);

    // Check if there's a way to filter or search
    const searchInput = await page.$('input[type="search"], input[placeholder*="search"]');
    console.log('\nSearch input available:', !!searchInput);

    // Try navigating to an older ideas view (90+ days old should be public)
    console.log('\n--- Trying to access older ideas ---');

    // Look for pagination or date filters
    const paginationLinks = await page.$$eval('a[href*="page="], a[href*="offset="]', links =>
      links.map(l => l.href)
    );
    console.log('Pagination links:', paginationLinks.slice(0, 5));

    // Try direct URL patterns for older ideas
    console.log('\n--- Testing direct idea access ---');

    // Try to access a specific old idea (these should be public)
    const testIdeaUrls = [
      'https://www.valueinvestorsclub.com/ideas/archive',
      'https://www.valueinvestorsclub.com/ideas?sort=oldest',
      'https://www.valueinvestorsclub.com/ideas?days=90'
    ];

    for (const url of testIdeaUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        const content = await page.content();
        const hasIdeas = content.includes('/idea/') || content.includes('member/');
        console.log(`${url}: ${hasIdeas ? '✅ Has idea/member links' : '❌ No ideas visible'}`);
      } catch (e) {
        console.log(`${url}: ❌ Error - ${e.message}`);
      }
    }

    // Now try to find a specific author's page
    console.log('\n--- Testing author profile access ---');
    for (const author of TARGET_AUTHORS.slice(0, 2)) {
      const encodedAuthor = encodeURIComponent(author);
      // VIC member URLs are like /member/username/userid
      // We need to find the user ID - let's try searching
      const searchUrl = `https://www.valueinvestorsclub.com/ideas?q=${encodedAuthor}`;
      try {
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 10000 });
        await page.screenshot({ path: `search-${author.replace('!', '')}.png` });

        const memberLinks = await page.$$eval('a[href*="/member/"]', links =>
          links.map(l => ({ href: l.href, text: l.textContent.trim() }))
        );
        console.log(`Search for "${author}": Found ${memberLinks.length} member links`);
        if (memberLinks.length > 0) {
          console.log('  Links:', memberLinks.slice(0, 3));
        }
      } catch (e) {
        console.log(`Search for "${author}": Error - ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== Scrape Complete ===');
}

scrapePublicIdeas().catch(console.error);
