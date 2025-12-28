"""
Database connection and query functions for VIC Leaderboard
"""

import os
from datetime import datetime, timedelta
from sqlalchemy import create_engine, desc, func
from sqlalchemy.orm import sessionmaker, scoped_session
from contextlib import contextmanager

from .models import Base, Author, Idea, Price, AuthorMetrics, ScrapeLog, CookieStore

# Default database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vic_scraper.db')


class Database:
    """Database manager for VIC Leaderboard"""

    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
        self.engine = create_engine(f'sqlite:///{self.db_path}', echo=False)
        self.Session = scoped_session(sessionmaker(bind=self.engine))

    def init_db(self):
        """Create all tables if they don't exist"""
        Base.metadata.create_all(self.engine)

    @contextmanager
    def session_scope(self):
        """Provide a transactional scope for database operations"""
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    # ==================== Author Operations ====================

    def get_or_create_author(self, username):
        """Get existing author or create new one"""
        with self.session_scope() as session:
            author = session.query(Author).filter_by(username=username).first()
            if not author:
                author = Author(
                    username=username,
                    username_lower=username.lower(),
                    discovered_at=datetime.utcnow()
                )
                session.add(author)
                session.flush()  # Get the ID
            return {
                'id': author.id,
                'username': author.username,
                'last_scraped_at': author.last_scraped_at
            }

    def update_author_scraped(self, username):
        """Update the last_scraped_at timestamp for an author"""
        with self.session_scope() as session:
            author = session.query(Author).filter_by(username=username).first()
            if author:
                author.last_scraped_at = datetime.utcnow()

    def get_all_authors(self):
        """Get all authors"""
        with self.session_scope() as session:
            authors = session.query(Author).all()
            return [{'id': a.id, 'username': a.username} for a in authors]

    # ==================== Idea Operations ====================

    def add_idea(self, author_username, ticker, posted_date, position_type='long',
                 price_at_rec=None, company_name=None, vic_idea_id=None, idea_url=None):
        """Add a new idea to the database"""
        with self.session_scope() as session:
            # Get or create author
            author = session.query(Author).filter_by(username=author_username).first()
            if not author:
                author = Author(
                    username=author_username,
                    username_lower=author_username.lower()
                )
                session.add(author)
                session.flush()

            # Check if idea already exists (by vic_idea_id or idea_url)
            if vic_idea_id:
                existing = session.query(Idea).filter_by(vic_idea_id=vic_idea_id).first()
                if existing:
                    return {'id': existing.id, 'exists': True}

            if idea_url:
                existing = session.query(Idea).filter_by(idea_url=idea_url).first()
                if existing:
                    return {'id': existing.id, 'exists': True}

            # Create new idea
            idea = Idea(
                author_id=author.id,
                ticker=ticker.upper(),
                company_name=company_name,
                posted_date=posted_date,
                position_type=position_type,
                price_at_rec=price_at_rec,
                vic_idea_id=vic_idea_id,
                idea_url=idea_url
            )
            session.add(idea)
            session.flush()
            return {'id': idea.id, 'exists': False}

    def get_ideas_for_author(self, author_username, years=5):
        """Get ideas for an author within the past N years"""
        cutoff_date = datetime.utcnow() - timedelta(days=years * 365)

        with self.session_scope() as session:
            author = session.query(Author).filter_by(username=author_username).first()
            if not author:
                return []

            ideas = session.query(Idea).filter(
                Idea.author_id == author.id,
                Idea.posted_date >= cutoff_date
            ).order_by(desc(Idea.posted_date)).all()

            return [{
                'id': i.id,
                'ticker': i.ticker,
                'company_name': i.company_name,
                'posted_date': i.posted_date.isoformat() if i.posted_date else None,
                'position_type': i.position_type,
                'price_at_rec': i.price_at_rec,
                'idea_url': i.idea_url
            } for i in ideas]

    def get_ideas_needing_prices(self, limit=100):
        """Get ideas that need price_at_rec fetched"""
        five_years_ago = datetime.utcnow() - timedelta(days=5 * 365)

        with self.session_scope() as session:
            ideas = session.query(Idea).filter(
                Idea.price_at_rec.is_(None),
                Idea.posted_date >= five_years_ago
            ).limit(limit).all()

            return [{
                'id': i.id,
                'ticker': i.ticker,
                'posted_date': i.posted_date.isoformat() if i.posted_date else None,
                'idea_url': i.idea_url
            } for i in ideas]

    def update_idea_price(self, idea_id, price_at_rec):
        """Update the price_at_rec for an idea"""
        with self.session_scope() as session:
            idea = session.query(Idea).get(idea_id)
            if idea:
                idea.price_at_rec = price_at_rec

    # ==================== Price Operations ====================

    def update_price(self, ticker, current_price, fetch_failed=False):
        """Update or create a price record"""
        with self.session_scope() as session:
            price = session.query(Price).filter_by(ticker=ticker.upper()).first()
            if price:
                price.current_price = current_price
                price.last_updated = datetime.utcnow()
                price.fetch_failed = fetch_failed
            else:
                price = Price(
                    ticker=ticker.upper(),
                    current_price=current_price,
                    fetch_failed=fetch_failed
                )
                session.add(price)

    def get_all_prices(self):
        """Get all current prices as a dict"""
        with self.session_scope() as session:
            prices = session.query(Price).all()
            return {p.ticker: p.current_price for p in prices if p.current_price}

    def get_price(self, ticker):
        """Get current price for a ticker"""
        with self.session_scope() as session:
            price = session.query(Price).filter_by(ticker=ticker.upper()).first()
            return price.current_price if price else None

    def get_tickers_needing_update(self, max_age_hours=24):
        """Get tickers that need price updates"""
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)

        with self.session_scope() as session:
            # Get all unique tickers from ideas
            all_tickers = session.query(Idea.ticker).distinct().all()
            all_tickers = {t[0] for t in all_tickers}

            # Get tickers with recent prices
            recent_prices = session.query(Price.ticker).filter(
                Price.last_updated >= cutoff,
                Price.fetch_failed == False
            ).all()
            recent_tickers = {p[0] for p in recent_prices}

            # Return tickers needing update
            return list(all_tickers - recent_tickers)

    # ==================== Metrics Operations ====================

    def update_author_metrics(self, author_username, xirr_5yr=None, xirr_3yr=None,
                               xirr_1yr=None, total_picks=0, win_rate=None,
                               best_pick_ticker=None, best_pick_return=None):
        """Update or create metrics for an author"""
        with self.session_scope() as session:
            author = session.query(Author).filter_by(username=author_username).first()
            if not author:
                return False

            metrics = session.query(AuthorMetrics).filter_by(author_id=author.id).first()
            if metrics:
                metrics.xirr_5yr = xirr_5yr
                metrics.xirr_3yr = xirr_3yr
                metrics.xirr_1yr = xirr_1yr
                metrics.total_picks = total_picks
                metrics.win_rate = win_rate
                metrics.best_pick_ticker = best_pick_ticker
                metrics.best_pick_return = best_pick_return
                metrics.calculated_at = datetime.utcnow()
            else:
                metrics = AuthorMetrics(
                    author_id=author.id,
                    username=author_username,
                    username_lower=author_username.lower(),
                    xirr_5yr=xirr_5yr,
                    xirr_3yr=xirr_3yr,
                    xirr_1yr=xirr_1yr,
                    total_picks=total_picks,
                    win_rate=win_rate,
                    best_pick_ticker=best_pick_ticker,
                    best_pick_return=best_pick_return
                )
                session.add(metrics)
            return True

    def get_leaderboard(self, sort_by='xirr_5yr', limit=50, offset=0):
        """Get leaderboard data sorted by XIRR"""
        sort_field = getattr(AuthorMetrics, sort_by, AuthorMetrics.xirr_5yr)

        with self.session_scope() as session:
            query = session.query(AuthorMetrics).filter(
                sort_field.isnot(None)
            ).order_by(desc(sort_field))

            total = query.count()
            metrics = query.offset(offset).limit(limit).all()

            return {
                'data': [{
                    'id': m.id,
                    'username': m.username,
                    'xirr5yr': m.xirr_5yr,
                    'xirr3yr': m.xirr_3yr,
                    'xirr1yr': m.xirr_1yr,
                    'totalPicks': m.total_picks,
                    'winRate': m.win_rate,
                    'bestPickTicker': m.best_pick_ticker,
                    'bestPickReturn': m.best_pick_return,
                    'calculatedAt': m.calculated_at.isoformat() if m.calculated_at else None,
                    'rank': offset + i + 1
                } for i, m in enumerate(metrics)],
                'total': total,
                'limit': limit,
                'offset': offset
            }

    def search_authors(self, search_term, limit=20):
        """Search authors by username prefix (case-insensitive)"""
        search_lower = search_term.lower().strip()

        with self.session_scope() as session:
            metrics = session.query(AuthorMetrics).filter(
                AuthorMetrics.username_lower.like(f'{search_lower}%')
            ).limit(limit).all()

            return [{
                'id': m.id,
                'username': m.username,
                'xirr5yr': m.xirr_5yr,
                'xirr3yr': m.xirr_3yr,
                'xirr1yr': m.xirr_1yr,
                'totalPicks': m.total_picks,
                'bestPickTicker': m.best_pick_ticker,
                'bestPickReturn': m.best_pick_return
            } for m in metrics]

    def get_author_with_ideas(self, username):
        """Get author metrics with their ideas"""
        with self.session_scope() as session:
            author = session.query(Author).filter_by(username=username).first()
            if not author:
                return None

            metrics = session.query(AuthorMetrics).filter_by(author_id=author.id).first()
            ideas = session.query(Idea).filter_by(author_id=author.id).order_by(
                desc(Idea.posted_date)
            ).all()

            # Get prices for ideas
            tickers = list(set(i.ticker for i in ideas))
            prices = session.query(Price).filter(Price.ticker.in_(tickers)).all()
            price_map = {p.ticker: p.current_price for p in prices}

            ideas_with_returns = []
            for idea in ideas:
                current_price = price_map.get(idea.ticker)
                return_pct = None

                if current_price and idea.price_at_rec and idea.price_at_rec > 0:
                    if idea.position_type == 'long':
                        return_pct = ((current_price - idea.price_at_rec) / idea.price_at_rec) * 100
                    else:
                        return_pct = ((idea.price_at_rec - current_price) / idea.price_at_rec) * 100

                ideas_with_returns.append({
                    'id': idea.id,
                    'ticker': idea.ticker,
                    'companyName': idea.company_name,
                    'postedDate': idea.posted_date.isoformat() if idea.posted_date else None,
                    'positionType': idea.position_type,
                    'priceAtRec': idea.price_at_rec,
                    'currentPrice': current_price,
                    'return': round(return_pct) if return_pct else None
                })

            result = {
                'username': author.username,
                'totalPicks': len(ideas),
                'ideas': ideas_with_returns
            }

            if metrics:
                result.update({
                    'xirr5yr': metrics.xirr_5yr,
                    'xirr3yr': metrics.xirr_3yr,
                    'xirr1yr': metrics.xirr_1yr,
                    'winRate': metrics.win_rate,
                    'bestPickTicker': metrics.best_pick_ticker,
                    'bestPickReturn': metrics.best_pick_return
                })

            return result

    # ==================== Cookie Operations ====================

    def save_cookies(self, cookies):
        """Save VIC session cookies"""
        with self.session_scope() as session:
            # Clear old cookies
            session.query(CookieStore).delete()

            # Add new cookies
            for cookie in cookies:
                store = CookieStore(
                    cookie_name=cookie.get('name'),
                    cookie_value=cookie.get('value'),
                    domain=cookie.get('domain'),
                    is_valid=True
                )
                session.add(store)

    def get_cookies(self):
        """Get stored VIC cookies"""
        with self.session_scope() as session:
            cookies = session.query(CookieStore).filter_by(is_valid=True).all()
            return [{
                'name': c.cookie_name,
                'value': c.cookie_value,
                'domain': c.domain
            } for c in cookies]

    def has_valid_cookies(self):
        """Check if we have valid cookies stored"""
        with self.session_scope() as session:
            vic_session = session.query(CookieStore).filter_by(
                cookie_name='vic_session',
                is_valid=True
            ).first()
            return vic_session is not None

    # ==================== Scrape Log Operations ====================

    def log_scrape(self, job_type, status, author_username=None,
                   items_processed=0, error_message=None):
        """Log a scrape job execution"""
        with self.session_scope() as session:
            log = ScrapeLog(
                job_type=job_type,
                author_username=author_username,
                status=status,
                items_processed=items_processed,
                error_message=error_message,
                completed_at=datetime.utcnow() if status != 'running' else None
            )
            session.add(log)

    def get_scrape_status(self):
        """Get the current scraping status"""
        with self.session_scope() as session:
            # Get latest log entry
            latest = session.query(ScrapeLog).order_by(
                desc(ScrapeLog.started_at)
            ).first()

            # Get counts
            authors_count = session.query(Author).count()
            ideas_count = session.query(Idea).count()
            metrics_count = session.query(AuthorMetrics).count()

            return {
                'latestJob': {
                    'type': latest.job_type,
                    'status': latest.status,
                    'author': latest.author_username,
                    'itemsProcessed': latest.items_processed,
                    'startedAt': latest.started_at.isoformat() if latest.started_at else None,
                    'completedAt': latest.completed_at.isoformat() if latest.completed_at else None
                } if latest else None,
                'counts': {
                    'authors': authors_count,
                    'ideas': ideas_count,
                    'authorsWithMetrics': metrics_count
                }
            }

    # ==================== Stats ====================

    def get_aggregate_stats(self):
        """Get aggregate statistics"""
        with self.session_scope() as session:
            authors_count = session.query(Author).count()
            ideas_count = session.query(Idea).count()
            metrics_count = session.query(AuthorMetrics).count()

            # Get latest update time
            latest_metrics = session.query(AuthorMetrics).order_by(
                desc(AuthorMetrics.calculated_at)
            ).first()

            return {
                'totalAuthors': authors_count,
                'totalIdeas': ideas_count,
                'authorsWithMetrics': metrics_count,
                'lastUpdated': latest_metrics.calculated_at.isoformat() if latest_metrics else None
            }


# Global database instance
_db = None

def get_db():
    """Get or create the global database instance"""
    global _db
    if _db is None:
        _db = Database()
        _db.init_db()
    return _db
