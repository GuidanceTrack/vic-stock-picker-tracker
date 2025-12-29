/**
 * Scrape individual VIC idea pages to see if author is visible
 * Also check the archive for older (public) ideas
 */

const { chromium } = require('playwright');

async function scrapeIdeaDetails() {
  console.log('=== Scraping VIC Idea Details ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Test 1: Click into a specific idea to see author
    console.log('--- Test 1: Individual Idea Page ---');
    const testIdeaUrl = 'https://www.valueinvestorsclub.com/idea/AST_SPACEMOBILE_INC/1344683077';
    console.log(`Navigating to: ${testIdeaUrl}`);

    await page.goto(testIdeaUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'idea-detail-page.png', fullPage: true });

    // Look for author info
    const memberLinks = await page.$$eval('a[href*="/member/"]', links =>
      links.map(l => ({ href: l.href, text: l.textContent.trim() }))
    );
    console.log(`Member links on idea page: ${memberLinks.length}`);
    if (memberLinks.length > 0) {
      console.log('Author links:', memberLinks);
    }

    // Look for any text that says "by" or "author" or "posted by"
    const pageText = await page.textContent('body');
    const byMatch = pageText.match(/(?:by|posted by|author:?)\s+(\w+)/i);
    if (byMatch) {
      console.log('Found author reference:', byMatch[0]);
    }

    // Check if we're redirected to login
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    if (currentUrl.includes('login')) {
      console.log('❌ Redirected to login page');
    }

    // Test 2: Check the archive page for public ideas
    console.log('\n--- Test 2: Archive Page ---');
    await page.goto('https://www.valueinvestorsclub.com/ideas/archive', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.screenshot({ path: 'archive-page.png', fullPage: true });

    const archiveMemberLinks = await page.$$eval('a[href*="/member/"]', links =>
      links.map(l => ({ href: l.href, text: l.textContent.trim() }))
    );
    console.log(`Member links on archive: ${archiveMemberLinks.length}`);
    if (archiveMemberLinks.length > 0) {
      console.log('Sample authors:', archiveMemberLinks.slice(0, 10));
    }

    const archiveIdeaLinks = await page.$$eval('a[href*="/idea/"]', links =>
      links.map(l => ({ href: l.href, text: l.textContent.trim() }))
    );
    console.log(`Idea links on archive: ${archiveIdeaLinks.length}`);

    // Test 3: Try an old idea from our database (should be 90+ days old)
    console.log('\n--- Test 3: Old Idea From Database ---');
    // Let's construct a URL for an older idea we might have
    // First check what the archive page shows

    if (archiveIdeaLinks.length > 0) {
      const oldIdeaUrl = archiveIdeaLinks[0].href;
      console.log(`Testing old idea: ${oldIdeaUrl}`);
      await page.goto(oldIdeaUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: 'old-idea-page.png', fullPage: true });

      const oldIdeaMemberLinks = await page.$$eval('a[href*="/member/"]', links =>
        links.map(l => ({ href: l.href, text: l.textContent.trim() }))
      );
      console.log(`Member links on old idea: ${oldIdeaMemberLinks.length}`);
      if (oldIdeaMemberLinks.length > 0) {
        console.log('Author:', oldIdeaMemberLinks);
      }

      // Get the full page content to see structure
      const ideaContent = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('.content') || document.body;
        return main.innerText.substring(0, 2000);
      });
      console.log('\nIdea page content preview:');
      console.log(ideaContent.substring(0, 1000));
    }

    // Test 4: Try direct member profile access
    console.log('\n--- Test 4: Direct Member Profile ---');
    // From the imported data, we should have member IDs
    // Let's try a known pattern - member profiles are /member/username/id

    // Check what's in our authors collection to get VIC user IDs
    const testMemberUrls = [
      'https://www.valueinvestorsclub.com/member/JackBlack',
      'https://www.valueinvestorsclub.com/member/Arturo'
    ];

    for (const url of testMemberUrls) {
      console.log(`\nTrying: ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        const finalUrl = page.url();
        console.log(`Final URL: ${finalUrl}`);

        if (finalUrl.includes('login')) {
          console.log('❌ Requires login');
        } else {
          await page.screenshot({ path: `member-${url.split('/').pop()}.png` });
          const profileText = await page.textContent('body');
          console.log(`Page content preview: ${profileText.substring(0, 300)}`);
        }
      } catch (e) {
        console.log(`Error: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== Done ===');
}

scrapeIdeaDetails().catch(console.error);
