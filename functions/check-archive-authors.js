/**
 * Final check - extract all text from archive to find any author patterns
 */

const { chromium } = require('playwright');

async function checkArchiveAuthors() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.valueinvestorsclub.com/ideas', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Get all the idea card/row content
  const ideaCards = await page.$$eval('.idea-row, .idea-card, tr, article, [class*="idea"]', elements =>
    elements.map(el => el.innerText.replace(/\s+/g, ' ').trim()).filter(t => t.length > 50)
  );

  console.log('=== Idea entries found ===\n');

  // Show first 5 entries in full
  ideaCards.slice(0, 5).forEach((card, i) => {
    console.log(`--- Entry ${i + 1} ---`);
    console.log(card.substring(0, 500));
    console.log('\n');
  });

  // Look for any "by" patterns
  const allText = await page.textContent('body');
  const byPatterns = allText.match(/by\s+\w+/gi);
  console.log('=== "by X" patterns found ===');
  console.log([...new Set(byPatterns || [])].slice(0, 20));

  await browser.close();
}

checkArchiveAuthors().catch(console.error);
