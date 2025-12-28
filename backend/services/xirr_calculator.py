"""
XIRR (Extended Internal Rate of Return) calculator using pyxirr
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import pyxirr


class XIRRCalculator:
    """Calculator for XIRR metrics"""

    def __init__(self):
        pass

    def calculate_xirr(self, cashflows: List[Tuple[datetime, float]]) -> Optional[float]:
        """
        Calculate XIRR for a series of cashflows.

        Args:
            cashflows: List of (date, amount) tuples.
                       Negative = investment (outflow)
                       Positive = return (inflow)

        Returns:
            Annualized return rate as percentage (e.g., 15.5 for 15.5%)
            or None if calculation fails
        """
        if len(cashflows) < 2:
            return None

        try:
            dates = [cf[0] for cf in cashflows]
            amounts = [cf[1] for cf in cashflows]

            # pyxirr returns a decimal (e.g., 0.155 for 15.5%)
            result = pyxirr.xirr(dates, amounts)

            if result is None or result != result:  # NaN check
                return None

            # Convert to percentage
            return round(result * 100, 1)

        except Exception as e:
            print(f"XIRR calculation error: {e}")
            return None

    def calculate_for_ideas(self, ideas: List[dict], current_prices: Dict[str, float],
                            window_years: int = 5) -> Optional[float]:
        """
        Calculate XIRR for a list of ideas within a time window.

        Simulates equal $1 investment in each idea on its posted date,
        with current value based on price change.

        Args:
            ideas: List of idea dicts with 'ticker', 'posted_date', 'price_at_rec', 'position_type'
            current_prices: Dict mapping ticker to current price
            window_years: Only consider ideas from the past N years

        Returns:
            XIRR as percentage or None
        """
        cutoff_date = datetime.now() - timedelta(days=window_years * 365)
        cashflows = []
        today = datetime.now()

        for idea in ideas:
            ticker = idea.get('ticker')
            price_at_rec = idea.get('price_at_rec') or idea.get('priceAtRec')
            position_type = idea.get('position_type') or idea.get('positionType', 'long')

            # Parse posted_date
            posted_date = idea.get('posted_date') or idea.get('postedDate')
            if isinstance(posted_date, str):
                try:
                    posted_date = datetime.fromisoformat(posted_date.replace('Z', '+00:00'))
                except ValueError:
                    try:
                        posted_date = datetime.strptime(posted_date, '%Y-%m-%d')
                    except ValueError:
                        continue

            if not posted_date or posted_date < cutoff_date:
                continue

            if not price_at_rec or price_at_rec <= 0:
                continue

            current_price = current_prices.get(ticker)
            if not current_price:
                continue

            # Calculate return for $1 investment
            if position_type == 'long':
                current_value = current_price / price_at_rec
            else:  # short
                # For shorts, profit when price goes down
                current_value = (2 * price_at_rec - current_price) / price_at_rec
                current_value = max(0, current_value)  # Can't lose more than invested

            # Add cashflows: -$1 at recommendation, +current_value today
            cashflows.append((posted_date, -1.0))
            cashflows.append((today, current_value))

        if len(cashflows) < 2:
            return None

        return self.calculate_xirr(cashflows)

    def calculate_all_metrics(self, ideas: List[dict], current_prices: Dict[str, float]) -> dict:
        """
        Calculate all XIRR metrics for an author's ideas.

        Args:
            ideas: List of idea dicts
            current_prices: Dict mapping ticker to current price

        Returns:
            Dict with xirr_5yr, xirr_3yr, xirr_1yr, total_picks, win_rate, best_pick
        """
        result = {
            'xirr_5yr': self.calculate_for_ideas(ideas, current_prices, window_years=5),
            'xirr_3yr': self.calculate_for_ideas(ideas, current_prices, window_years=3),
            'xirr_1yr': self.calculate_for_ideas(ideas, current_prices, window_years=1),
            'total_picks': 0,
            'win_rate': None,
            'best_pick_ticker': None,
            'best_pick_return': None
        }

        # Calculate stats for 5-year window
        cutoff = datetime.now() - timedelta(days=5 * 365)
        valid_ideas = []

        for idea in ideas:
            posted_date = idea.get('posted_date') or idea.get('postedDate')
            if isinstance(posted_date, str):
                try:
                    posted_date = datetime.fromisoformat(posted_date.replace('Z', '+00:00'))
                except ValueError:
                    continue

            if posted_date and posted_date >= cutoff:
                ticker = idea.get('ticker')
                price_at_rec = idea.get('price_at_rec') or idea.get('priceAtRec')
                position_type = idea.get('position_type') or idea.get('positionType', 'long')
                current_price = current_prices.get(ticker)

                if price_at_rec and price_at_rec > 0 and current_price:
                    if position_type == 'long':
                        return_pct = ((current_price - price_at_rec) / price_at_rec) * 100
                    else:
                        return_pct = ((price_at_rec - current_price) / price_at_rec) * 100

                    valid_ideas.append({
                        'ticker': ticker,
                        'return_pct': return_pct
                    })

        result['total_picks'] = len(valid_ideas)

        if valid_ideas:
            # Win rate
            winners = sum(1 for i in valid_ideas if i['return_pct'] > 0)
            result['win_rate'] = round((winners / len(valid_ideas)) * 100, 1)

            # Best pick
            best = max(valid_ideas, key=lambda x: x['return_pct'])
            result['best_pick_ticker'] = best['ticker']
            result['best_pick_return'] = round(best['return_pct'], 1)

        return result

    def calculate_for_author(self, db, username: str) -> dict:
        """
        Calculate all metrics for an author and store in database.

        Args:
            db: Database instance
            username: Author username

        Returns:
            Calculated metrics dict
        """
        # Get author's ideas
        ideas = db.get_ideas_for_author(username, years=5)

        if not ideas:
            return {'error': 'No ideas found'}

        # Get current prices
        tickers = list(set(idea['ticker'] for idea in ideas))
        prices = {ticker: db.get_price(ticker) for ticker in tickers}
        prices = {k: v for k, v in prices.items() if v}  # Filter None

        # Calculate metrics
        metrics = self.calculate_all_metrics(ideas, prices)

        # Store in database
        db.update_author_metrics(
            username,
            xirr_5yr=metrics['xirr_5yr'],
            xirr_3yr=metrics['xirr_3yr'],
            xirr_1yr=metrics['xirr_1yr'],
            total_picks=metrics['total_picks'],
            win_rate=metrics['win_rate'],
            best_pick_ticker=metrics['best_pick_ticker'],
            best_pick_return=metrics['best_pick_return']
        )

        return metrics

    def update_all_metrics(self, db, progress_callback=None):
        """
        Recalculate metrics for all authors.

        Args:
            db: Database instance
            progress_callback: Optional callback(username, metrics)

        Returns:
            Summary dict with counts
        """
        authors = db.get_all_authors()
        prices = db.get_all_prices()

        success = 0
        failed = 0

        for i, author in enumerate(authors):
            username = author['username']
            print(f"[{i + 1}/{len(authors)}] Calculating metrics for {username}...")

            try:
                ideas = db.get_ideas_for_author(username, years=5)

                if not ideas:
                    failed += 1
                    continue

                metrics = self.calculate_all_metrics(ideas, prices)

                db.update_author_metrics(
                    username,
                    xirr_5yr=metrics['xirr_5yr'],
                    xirr_3yr=metrics['xirr_3yr'],
                    xirr_1yr=metrics['xirr_1yr'],
                    total_picks=metrics['total_picks'],
                    win_rate=metrics['win_rate'],
                    best_pick_ticker=metrics['best_pick_ticker'],
                    best_pick_return=metrics['best_pick_return']
                )

                success += 1

                if progress_callback:
                    progress_callback(username, metrics)

            except Exception as e:
                print(f"Error calculating metrics for {username}: {e}")
                failed += 1

        return {
            'success': success,
            'failed': failed,
            'total': len(authors)
        }
