"""
Scraper for latest VIC ideas feed
Scrapes newly-visible ideas from the /ideas page
"""

import re
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from .base import BaseScraper


class LatestIdeasScraper(BaseScraper):
    """Scraper for the VIC ideas feed"""

    IDEAS_URL = f'{BaseScraper.VIC_BASE_URL}/ideas'

    def scrape_ideas_page(self, page=1, latest_day_only=True):
        """
        Scrape a page of ideas from the ideas feed.

        Page structure:
        - Date headers: <p class="header"> inside #ideas_body, e.g. "Wednesday, Nov 12, 2025"
        - p.entry-header: <a href="/idea/...">Company</a> TICKER • price • $market_cap
        - p.submitted-by: BY <span title="username">username</span> • <span>Short Idea</span>

        Args:
            page: Page number to scrape (1-indexed)
            latest_day_only: If True, only scrape ideas from the most recent day

        Returns:
            List of idea dicts with: ticker, author, company_name, posted_date, idea_url, position_type
        """
        url = f'{self.IDEAS_URL}?page={page}' if page > 1 else self.IDEAS_URL
        self.navigate(url)

        ideas = []

        try:
            # Wait for the submitted-by elements to load
            self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "p.submitted-by"))
            )

            # Find date headers to determine boundaries
            # VIC uses <p class="header"> inside #ideas_body for date headers like "Wednesday, Nov 12, 2025"
            date_headers = self.driver.find_elements(By.CSS_SELECTOR, "#ideas_body p.header")

            # Filter to only elements that look like date headers (contain day names)
            day_pattern = re.compile(r'(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)', re.IGNORECASE)
            date_headers = [h for h in date_headers if day_pattern.search(h.text)]

            latest_date_text = None
            latest_date = None

            if date_headers:
                latest_date_text = date_headers[0].text.strip()
                latest_date = self._parse_date(latest_date_text)
                print(f"  Latest date on page: {latest_date_text}")

                if len(date_headers) > 1:
                    print(f"  Found {len(date_headers)} date headers total")

            # Find all entry headers (contain company link and ticker)
            entry_headers = self.driver.find_elements(By.CSS_SELECTOR, "p.entry-header")

            # Find all submitted-by elements (contain author)
            submitted_bys = self.driver.find_elements(By.CSS_SELECTOR, "p.submitted-by")

            print(f"  Found {len(entry_headers)} entry headers, {len(submitted_bys)} submitted-by elements")

            if latest_day_only and len(date_headers) >= 2:
                # Get the Y position of the second date header - we only want ideas above it
                second_date_y = date_headers[1].location['y']
                print(f"  Filtering to ideas before second date header (y={second_date_y})")
            else:
                second_date_y = float('inf')  # No filtering

            # Match them by index (they appear in same order)
            for i, (header, author_elem) in enumerate(zip(entry_headers, submitted_bys)):
                try:
                    # Check if this idea is before the second date header
                    if latest_day_only and header.location['y'] >= second_date_y:
                        print(f"  Stopping at idea {i+1} - past first day's ideas")
                        break

                    # Parse entry header: <a>Company</a> TICKER • price • $market_cap
                    company_link = header.find_element(By.TAG_NAME, "a")
                    company_name = company_link.text.strip()
                    idea_url = company_link.get_attribute("href")

                    # Extract ticker from header text
                    # Format: "Company Name TICKER • 54.00 • $910mn"
                    header_text = header.text
                    # Remove company name to get "TICKER • price • market_cap"
                    remaining = header_text.replace(company_name, "").strip()

                    # First word should be ticker
                    ticker_match = re.match(r'^([A-Z0-9]+(?:\s+[A-Z]{2})?)', remaining)
                    ticker = ticker_match.group(1) if ticker_match else ""

                    # Parse author from submitted-by
                    # Format: BY <span title="username">username</span> • Short Idea
                    author_span = author_elem.find_element(By.CSS_SELECTOR, "span[title]")
                    author = author_span.get_attribute("title").strip()

                    # Check for Short Idea
                    author_text = author_elem.text
                    position_type = 'short' if 'Short Idea' in author_text else 'long'

                    if author and ticker:
                        ideas.append({
                            'ticker': ticker.upper(),
                            'author': author,
                            'company_name': company_name,
                            'posted_date': latest_date,
                            'idea_url': idea_url,
                            'position_type': position_type
                        })
                        print(f"  Idea: {company_name} ({ticker}) by {author} [{position_type}]")

                except Exception as e:
                    print(f"  Error parsing idea {i}: {e}")
                    continue

        except Exception as e:
            print(f"Error scraping ideas page {page}: {e}")
            import traceback
            traceback.print_exc()

        return ideas

    def _parse_date(self, date_str):
        """Parse date string to datetime"""
        if not date_str:
            return None

        # Clean up the date string
        date_str = date_str.strip()

        # Remove day of week prefix if present
        date_str = re.sub(r'^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s*',
                          '', date_str, flags=re.IGNORECASE)

        # Try various date formats
        formats = [
            '%b %d, %Y',    # Nov 12, 2025
            '%b %d %Y',     # Nov 12 2025
            '%B %d, %Y',    # November 12, 2025
            '%Y-%m-%d',     # 2025-11-12
            '%m/%d/%Y',     # 11/12/2025
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue

        print(f"Could not parse date: {date_str}")
        return None

    def scrape_latest_day(self):
        """
        Scrape ideas from just the latest day on the /ideas page.

        This is the primary method for daily scraping - gets only the most
        recent day's ideas to keep scraping manageable.

        Returns:
            List of ideas from the latest day
        """
        print("Scraping latest day's ideas...")
        ideas = self.scrape_ideas_page(page=1, latest_day_only=True)
        print(f"Found {len(ideas)} ideas from latest day")
        return ideas

    def scrape_recent_ideas(self, max_pages=5, latest_day_only=False):
        """
        Scrape recent ideas from multiple pages.

        Args:
            max_pages: Maximum number of pages to scrape
            latest_day_only: If True, only get ideas from the latest day (first page only)

        Returns:
            List of all ideas scraped
        """
        if latest_day_only:
            return self.scrape_latest_day()

        all_ideas = []

        for page in range(1, max_pages + 1):
            print(f"Scraping ideas page {page}...")
            ideas = self.scrape_ideas_page(page, latest_day_only=False)

            if not ideas:
                print(f"No more ideas on page {page}, stopping.")
                break

            all_ideas.extend(ideas)
            print(f"Found {len(ideas)} ideas on page {page}")

        return all_ideas

    def get_unique_authors(self, ideas):
        """Get list of unique author usernames from ideas"""
        return list(set(idea['author'] for idea in ideas if idea.get('author')))
