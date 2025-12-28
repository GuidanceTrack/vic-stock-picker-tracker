"""
Scraper for individual VIC idea detail pages
Extracts the "price at recommendation" from the idea page
"""

import re
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from .base import BaseScraper


class IdeaDetailScraper(BaseScraper):
    """Scraper for individual VIC idea pages"""

    def scrape_idea_detail(self, idea_url):
        """
        Scrape details from an individual idea page.

        Args:
            idea_url: Full URL to the idea page

        Returns:
            Dict with: price_at_rec, market_cap, position_type, vic_idea_id
        """
        self.navigate(idea_url)

        result = {
            'price_at_rec': None,
            'market_cap': None,
            'position_type': 'long',
            'vic_idea_id': self._extract_idea_id(idea_url)
        }

        try:
            page_source = self.driver.page_source

            # Extract price at recommendation
            result['price_at_rec'] = self._extract_price(page_source)

            # Extract market cap
            result['market_cap'] = self._extract_market_cap(page_source)

            # Determine position type
            result['position_type'] = self._extract_position_type(page_source)

        except Exception as e:
            print(f"Error scraping idea detail {idea_url}: {e}")

        return result

    def _extract_idea_id(self, url):
        """Extract VIC idea ID from URL"""
        # URLs like: https://valueinvestorsclub.com/idea/TICKER/12345
        match = re.search(r'/idea/[^/]+/(\d+)', url)
        return match.group(1) if match else None

    def _extract_price(self, page_source):
        """Extract price at recommendation from page source"""
        # Common patterns for price on VIC idea pages
        patterns = [
            r'Price:\s*\$?([\d,]+\.?\d*)',
            r'Stock Price:\s*\$?([\d,]+\.?\d*)',
            r'Current Price:\s*\$?([\d,]+\.?\d*)',
            r'price of \$?([\d,]+\.?\d*)',
            r'trading at \$?([\d,]+\.?\d*)',
            r'\$(\d+\.?\d*)\s*per share',
        ]

        for pattern in patterns:
            match = re.search(pattern, page_source, re.IGNORECASE)
            if match:
                try:
                    price_str = match.group(1).replace(',', '')
                    return float(price_str)
                except (ValueError, IndexError):
                    continue

        # Try to find in the summary box
        try:
            summary_box = self.driver.find_element(By.CSS_SELECTOR, ".idea-summary, .summary-box")
            if summary_box:
                text = summary_box.text
                for pattern in patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        price_str = match.group(1).replace(',', '')
                        return float(price_str)
        except Exception:
            pass

        return None

    def _extract_market_cap(self, page_source):
        """Extract market cap from page source"""
        patterns = [
            r'Market Cap:?\s*\$?([\d,]+\.?\d*)\s*([BMK])',
            r'Mkt Cap:?\s*\$?([\d,]+\.?\d*)\s*([BMK])',
            r'market cap(?:italization)? of \$?([\d,]+\.?\d*)\s*([BMK])',
        ]

        for pattern in patterns:
            match = re.search(pattern, page_source, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1).replace(',', ''))
                    suffix = match.group(2).upper()

                    if suffix == 'B':
                        return value * 1_000_000_000
                    elif suffix == 'M':
                        return value * 1_000_000
                    elif suffix == 'K':
                        return value * 1_000
                    return value
                except (ValueError, IndexError):
                    continue

        return None

    def _extract_position_type(self, page_source):
        """Determine if idea is long or short"""
        page_lower = page_source.lower()

        # Check for short indicators
        short_patterns = [
            r'\bshort\b',
            r'short position',
            r'short idea',
            r'sell short',
            r'short sell',
        ]

        for pattern in short_patterns:
            if re.search(pattern, page_lower):
                return 'short'

        return 'long'

    def scrape_ideas_batch(self, idea_urls, update_callback=None):
        """
        Scrape details for multiple ideas.

        Args:
            idea_urls: List of idea URLs to scrape
            update_callback: Optional callback(idea_url, result) for progress

        Returns:
            Dict mapping idea_url to result
        """
        results = {}

        for i, url in enumerate(idea_urls):
            print(f"Scraping idea {i + 1}/{len(idea_urls)}: {url}")
            result = self.scrape_idea_detail(url)
            results[url] = result

            if update_callback:
                update_callback(url, result)

        return results
