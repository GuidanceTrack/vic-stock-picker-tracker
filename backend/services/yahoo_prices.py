"""
Yahoo Finance price fetching service using yfinance
"""

import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import time


class YahooFinanceService:
    """Service for fetching stock prices from Yahoo Finance"""

    def __init__(self, rate_limit_delay=0.5):
        """
        Initialize the service.

        Args:
            rate_limit_delay: Seconds to wait between API calls
        """
        self.rate_limit_delay = rate_limit_delay
        self._cache = {}  # Simple in-memory cache

    def get_current_price(self, ticker: str) -> Optional[float]:
        """
        Get the current price for a ticker.

        Args:
            ticker: Stock ticker symbol

        Returns:
            Current price or None if not available
        """
        try:
            # Check cache first (valid for 5 minutes)
            cache_key = f"current_{ticker}"
            cached = self._cache.get(cache_key)
            if cached and (datetime.now() - cached['time']).seconds < 300:
                return cached['price']

            time.sleep(self.rate_limit_delay)

            stock = yf.Ticker(ticker)
            info = stock.info

            # Try different price fields
            price = (
                info.get('currentPrice') or
                info.get('regularMarketPrice') or
                info.get('previousClose')
            )

            if price:
                self._cache[cache_key] = {'price': price, 'time': datetime.now()}

            return price

        except Exception as e:
            print(f"Error fetching current price for {ticker}: {e}")
            return None

    def get_historical_price(self, ticker: str, date: datetime) -> Optional[float]:
        """
        Get the historical closing price for a ticker on a specific date.

        Args:
            ticker: Stock ticker symbol
            date: Date to get price for

        Returns:
            Closing price on that date or nearest trading day, None if unavailable
        """
        try:
            # Check cache
            cache_key = f"hist_{ticker}_{date.strftime('%Y-%m-%d')}"
            cached = self._cache.get(cache_key)
            if cached:
                return cached['price']

            time.sleep(self.rate_limit_delay)

            stock = yf.Ticker(ticker)

            # Fetch data for a range around the date (to handle weekends/holidays)
            start_date = date - timedelta(days=7)
            end_date = date + timedelta(days=7)

            history = stock.history(start=start_date, end=end_date)

            if history.empty:
                return None

            # Find the closest date to the target
            target_date = date.date() if hasattr(date, 'date') else date

            # Try to get exact date or nearest before
            for idx in history.index:
                idx_date = idx.date() if hasattr(idx, 'date') else idx
                if idx_date <= target_date:
                    price = history.loc[idx, 'Close']
                    self._cache[cache_key] = {'price': float(price), 'time': datetime.now()}
                    return float(price)

            # If no date before, get the first available
            if not history.empty:
                price = history.iloc[0]['Close']
                self._cache[cache_key] = {'price': float(price), 'time': datetime.now()}
                return float(price)

            return None

        except Exception as e:
            print(f"Error fetching historical price for {ticker} on {date}: {e}")
            return None

    def get_prices_batch(self, tickers: List[str]) -> Dict[str, Optional[float]]:
        """
        Get current prices for multiple tickers.

        Args:
            tickers: List of ticker symbols

        Returns:
            Dict mapping ticker to price (None if unavailable)
        """
        results = {}

        for ticker in tickers:
            results[ticker] = self.get_current_price(ticker)

        return results

    def update_all_prices(self, db, max_age_hours=24):
        """
        Update all stale prices in the database.

        Args:
            db: Database instance
            max_age_hours: Max age of prices before refresh

        Returns:
            Dict with counts of updated/failed tickers
        """
        tickers = db.get_tickers_needing_update(max_age_hours)
        print(f"Found {len(tickers)} tickers needing price update")

        updated = 0
        failed = 0

        for ticker in tickers:
            price = self.get_current_price(ticker)

            if price:
                db.update_price(ticker, price, fetch_failed=False)
                updated += 1
            else:
                db.update_price(ticker, None, fetch_failed=True)
                failed += 1

        return {
            'updated': updated,
            'failed': failed,
            'total': len(tickers)
        }

    def fetch_historical_for_idea(self, ticker: str, posted_date: datetime) -> Optional[float]:
        """
        Fetch the historical price at recommendation for an idea.
        This is the price the author likely referenced when posting.

        Args:
            ticker: Stock ticker
            posted_date: Date the idea was posted

        Returns:
            Price at recommendation or None
        """
        return self.get_historical_price(ticker, posted_date)

    def fetch_prices_for_ideas(self, ideas: List[dict], db, progress_callback=None):
        """
        Fetch and store historical prices for a batch of ideas.

        Args:
            ideas: List of idea dicts with 'id', 'ticker', 'posted_date'
            db: Database instance
            progress_callback: Optional callback(idea_id, price)

        Returns:
            Dict with success/failure counts
        """
        success = 0
        failed = 0

        for i, idea in enumerate(ideas):
            ticker = idea.get('ticker')
            posted_date = idea.get('posted_date')
            idea_id = idea.get('id')

            if not ticker or not posted_date:
                failed += 1
                continue

            # Parse date if string
            if isinstance(posted_date, str):
                try:
                    posted_date = datetime.fromisoformat(posted_date.replace('Z', '+00:00'))
                except ValueError:
                    posted_date = datetime.strptime(posted_date, '%Y-%m-%d')

            price = self.get_historical_price(ticker, posted_date)

            if price:
                db.update_idea_price(idea_id, price)
                success += 1
            else:
                # Mark as failed with -1
                db.update_idea_price(idea_id, -1)
                failed += 1

            if progress_callback:
                progress_callback(idea_id, price)

            print(f"[{i + 1}/{len(ideas)}] {ticker}: ${price:.2f}" if price else f"[{i + 1}/{len(ideas)}] {ticker}: FAILED")

        return {
            'success': success,
            'failed': failed,
            'total': len(ideas)
        }
