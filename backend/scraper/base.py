"""
Base scraper with Selenium setup and cookie handling
Adapted from sirindudler/ValueInvestorsClub_Watchlist
"""

import random
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


class BaseScraper:
    """Base class for VIC scrapers with Selenium and cookie handling"""

    VIC_BASE_URL = 'https://valueinvestorsclub.com'

    def __init__(self, cookies=None, headless=True):
        """
        Initialize the scraper with optional cookies.

        Args:
            cookies: List of cookie dicts with 'name', 'value', 'domain' keys
            headless: Whether to run browser in headless mode
        """
        self.cookies = cookies or []
        self.driver = None
        self.wait = None
        self.headless = headless

        # Rate limiting settings (to avoid detection)
        self.base_delay = random.uniform(8, 12)
        self.jitter = 4
        self.consecutive_requests = 0
        self.max_consecutive = 5

    def start(self):
        """Start the browser and add cookies"""
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-gpu")

        # Use webdriver-manager for automatic ChromeDriver management
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 20)

        # Navigate to VIC first (required before adding cookies)
        self.driver.get(self.VIC_BASE_URL)
        time.sleep(2)

        # Add cookies
        self._add_cookies()

        return self

    def _add_cookies(self):
        """
        Add stored cookies to the browser session.
        Handles Cookie-Editor JSON export format with fields like:
        name, value, domain, hostOnly, path, secure, httpOnly, sameSite, expirationDate
        """
        if not self.cookies:
            return

        for cookie in self.cookies:
            try:
                # Build Selenium-compatible cookie dict
                selenium_cookie = {
                    'name': cookie.get('name'),
                    'value': cookie.get('value'),
                    'domain': cookie.get('domain', '.valueinvestorsclub.com'),
                    'path': cookie.get('path', '/'),
                }

                # Add optional fields if present
                if cookie.get('secure'):
                    selenium_cookie['secure'] = True

                if cookie.get('httpOnly'):
                    selenium_cookie['httpOnly'] = True

                # Handle sameSite (Selenium accepts 'Strict', 'Lax', or 'None')
                same_site = cookie.get('sameSite')
                if same_site and same_site in ['Strict', 'Lax', 'None']:
                    selenium_cookie['sameSite'] = same_site

                # Handle expiry (Selenium uses 'expiry' not 'expirationDate')
                if cookie.get('expirationDate'):
                    selenium_cookie['expiry'] = int(cookie['expirationDate'])

                self.driver.add_cookie(selenium_cookie)
                print(f"Added cookie: {cookie.get('name')}")

            except Exception as e:
                print(f"Warning: Could not add cookie {cookie.get('name')}: {e}")

    def smart_delay(self):
        """
        Implement smart delay between requests to avoid detection.
        Adds longer delay every few requests.
        """
        self.consecutive_requests += 1

        if self.consecutive_requests >= self.max_consecutive:
            # Longer 1-1.5 minute delay every 5 requests
            delay = random.uniform(60, 90)
            self.consecutive_requests = 0
        else:
            # Normal delay with jitter
            delay = self.base_delay + random.uniform(0, self.jitter)

        time.sleep(delay)

    def navigate(self, url):
        """Navigate to a URL with rate limiting"""
        self.driver.get(url)
        self.smart_delay()

    def is_authenticated(self):
        """Check if current session is authenticated"""
        try:
            # Navigate to ideas page and check for login button
            self.driver.get(f'{self.VIC_BASE_URL}/ideas')
            time.sleep(2)

            page_source = self.driver.page_source.lower()

            # If we see member-only content or don't see login button, we're authenticated
            if 'login' in page_source and 'logout' not in page_source:
                return False
            return True
        except Exception:
            return False

    def get_page_source(self):
        """Get current page source"""
        return self.driver.page_source

    def current_url(self):
        """Get current URL"""
        return self.driver.current_url

    def close(self):
        """Close the browser"""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None

    def __enter__(self):
        """Context manager entry"""
        return self.start()

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
        return False
