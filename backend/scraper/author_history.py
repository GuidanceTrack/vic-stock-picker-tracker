"""
Scraper for VIC author/member profile pages
Adapted from sirindudler/ValueInvestorsClub_Watchlist/code/VIC_postFinder.py
"""

import re
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from .base import BaseScraper


class AuthorHistoryScraper(BaseScraper):
    """Scraper for VIC author profile and idea history"""

    SEARCH_URL = f'{BaseScraper.VIC_BASE_URL}/search'

    def search_member(self, username):
        """
        Search for a member and navigate to their profile.
        Based on sirindudler's VIC_postFinder.py

        Args:
            username: VIC username to search for

        Returns:
            List of idea dicts from the author's profile, or None if not found
        """
        try:
            search_url = f"{self.SEARCH_URL}/{username}"
            self.navigate(search_url)

            # Click on member link (from sirindudler's XPath)
            try:
                member_link = self.wait.until(
                    EC.element_to_be_clickable((
                        By.XPATH,
                        '/html/body/div[2]/table[1]/tbody/tr[2]/td/div/div/a'
                    ))
                )
                member_link.click()
                self.smart_delay()
            except Exception:
                # Try alternative selector
                member_link = self.wait.until(
                    EC.element_to_be_clickable((
                        By.XPATH,
                        "//a[contains(@href, '/member/')]"
                    ))
                )
                member_link.click()
                self.smart_delay()

            # Now we should be on the member's profile page
            return self._parse_member_ideas_table(username)

        except Exception as e:
            print(f"Error searching for member {username}: {e}")
            return None

    def _parse_member_ideas_table(self, username):
        """
        Parse the ideas table from a member's profile page.
        Based on sirindudler's table parsing logic.

        Returns:
            List of idea dicts
        """
        ideas = []

        try:
            # Wait for the ideas table (sirindudler's selector)
            table = self.wait.until(
                EC.presence_of_element_located((
                    By.CSS_SELECTOR,
                    "table.table.itable.box-shadow"
                ))
            )

            # Find all post rows (skip header row)
            rows = table.find_elements(By.TAG_NAME, "tr")[1:]

            for row in rows:
                try:
                    idea = self._parse_idea_row(row, username)
                    if idea:
                        ideas.append(idea)
                except Exception as e:
                    print(f"Error processing row: {e}")
                    continue

        except Exception as e:
            print(f"Error parsing ideas table for {username}: {e}")

        return ideas

    def _parse_idea_row(self, row, username):
        """
        Parse a single row from the member's ideas table.
        Adapted from sirindudler's row parsing.

        Returns:
            Dict with idea data or None
        """
        try:
            # Get columns (using sirindudler's class selector)
            cols = row.find_elements(By.CLASS_NAME, "col-xs-12")

            if len(cols) < 2:
                # Try alternative: direct td elements
                cols = row.find_elements(By.TAG_NAME, "td")

            if len(cols) < 2:
                return None

            # Extract title and ticker from first column
            title_div = None
            title_element = None
            title = ""
            ticker = ""
            idea_url = ""

            try:
                title_div = cols[0].find_element(By.CLASS_NAME, "vich1")
                title_element = cols[0].find_element(By.TAG_NAME, "a")
                title = title_element.text.strip()
                idea_url = title_element.get_attribute("href")

                # Extract ticker (last word, excluding S and W tags per sirindudler)
                text_parts = title_div.text.split()
                if text_parts:
                    last_word = text_parts[-1]
                    if last_word not in ['S', 'W']:
                        ticker = last_word
            except Exception:
                # Fallback: try simpler parsing
                try:
                    link = cols[0].find_element(By.TAG_NAME, "a")
                    title = link.text.strip()
                    idea_url = link.get_attribute("href")
                    # Try to get ticker from text
                    text = cols[0].text
                    words = text.split()
                    ticker = words[-1] if words else ""
                except Exception:
                    pass

            # Extract date from second column
            date_str = cols[1].text.strip() if len(cols) > 1 else ""
            posted_date = self._parse_date(date_str)

            # Determine position type
            position_type = 'long'
            row_text = row.text.lower()
            if 'short' in row_text:
                position_type = 'short'

            if not ticker or not posted_date:
                return None

            return {
                'author': username,
                'ticker': ticker.upper(),
                'title': title,
                'idea_url': idea_url,
                'posted_date': posted_date,
                'position_type': position_type
            }

        except Exception as e:
            print(f"Error in _parse_idea_row: {e}")
            return None

    def _parse_date(self, date_str):
        """Parse date string to datetime"""
        if not date_str:
            return None

        # Clean up the date string
        date_str = date_str.strip()

        # Try various date formats
        formats = [
            '%b %d, %Y',    # Dec 28, 2025
            '%B %d, %Y',    # December 28, 2025
            '%Y-%m-%d',     # 2025-12-28
            '%m/%d/%Y',     # 12/28/2025
            '%d %b %Y',     # 28 Dec 2025
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # Try to extract date with regex
        patterns = [
            r'(\w{3})\s+(\d{1,2}),\s+(\d{4})',  # Dec 28, 2025
            r'(\d{4})-(\d{2})-(\d{2})',          # 2025-12-28
        ]

        for pattern in patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    if '-' in pattern:
                        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                except Exception:
                    continue

        print(f"Could not parse date: {date_str}")
        return None

    def scrape_author(self, username, years=5):
        """
        Scrape all ideas for an author, filtering to recent years.

        Args:
            username: VIC username
            years: Only return ideas from the past N years

        Returns:
            List of idea dicts within the time window
        """
        ideas = self.search_member(username)

        if not ideas:
            return []

        # Filter to ideas within the time window
        cutoff = datetime.now().replace(year=datetime.now().year - years)
        filtered = [
            idea for idea in ideas
            if idea.get('posted_date') and idea['posted_date'] >= cutoff
        ]

        print(f"Found {len(ideas)} total ideas for {username}, {len(filtered)} within {years} years")
        return filtered

    def scrape_authors_batch(self, usernames, years=5, progress_callback=None):
        """
        Scrape ideas for multiple authors.

        Args:
            usernames: List of VIC usernames
            years: Only return ideas from past N years
            progress_callback: Optional callback(username, ideas) for progress

        Returns:
            Dict mapping username to list of ideas
        """
        results = {}

        for i, username in enumerate(usernames):
            print(f"Scraping author {i + 1}/{len(usernames)}: {username}")

            ideas = self.scrape_author(username, years)
            results[username] = ideas

            if progress_callback:
                progress_callback(username, ideas)

        return results
