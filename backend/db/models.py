"""
SQLAlchemy database models for VIC Leaderboard
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Author(Base):
    """VIC member/author being tracked"""
    __tablename__ = 'authors'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    username_lower = Column(String(100), index=True)  # For case-insensitive search
    vic_user_id = Column(String(50))  # VIC internal ID if available
    discovered_at = Column(DateTime, default=datetime.utcnow)
    last_scraped_at = Column(DateTime)
    no_recent_ideas = Column(Boolean, default=False)  # True if no ideas in past 5 years

    # Relationships
    ideas = relationship('Idea', back_populates='author', lazy='dynamic')
    metrics = relationship('AuthorMetrics', back_populates='author', uselist=False)

    def __repr__(self):
        return f"<Author(username='{self.username}')>"


class Idea(Base):
    """Stock recommendation/idea"""
    __tablename__ = 'ideas'

    id = Column(Integer, primary_key=True, autoincrement=True)
    author_id = Column(Integer, ForeignKey('authors.id'), nullable=False, index=True)
    vic_idea_id = Column(String(50), unique=True)  # VIC internal idea ID
    ticker = Column(String(20), nullable=False, index=True)
    company_name = Column(String(200))
    posted_date = Column(DateTime, nullable=False, index=True)
    position_type = Column(String(10), default='long')  # 'long' or 'short'
    price_at_rec = Column(Float)  # Price at recommendation time
    market_cap_at_rec = Column(Float)
    idea_url = Column(String(500))
    scraped_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    author = relationship('Author', back_populates='ideas')

    def __repr__(self):
        return f"<Idea(ticker='{self.ticker}', author_id={self.author_id})>"


class Price(Base):
    """Current stock prices cache"""
    __tablename__ = 'prices'

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), unique=True, nullable=False, index=True)
    current_price = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)
    fetch_failed = Column(Boolean, default=False)  # True if ticker couldn't be fetched

    def __repr__(self):
        return f"<Price(ticker='{self.ticker}', price={self.current_price})>"


class AuthorMetrics(Base):
    """Calculated performance metrics for authors"""
    __tablename__ = 'author_metrics'

    id = Column(Integer, primary_key=True, autoincrement=True)
    author_id = Column(Integer, ForeignKey('authors.id'), unique=True, nullable=False)
    username = Column(String(100), index=True)  # Denormalized for quick access
    username_lower = Column(String(100), index=True)

    # XIRR metrics (annualized returns)
    xirr_5yr = Column(Float)
    xirr_3yr = Column(Float)
    xirr_1yr = Column(Float)

    # Statistics
    total_picks = Column(Integer, default=0)
    win_rate = Column(Float)  # Percentage of picks with positive returns

    # Best pick info
    best_pick_ticker = Column(String(20))
    best_pick_return = Column(Float)  # Percentage return

    calculated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    author = relationship('Author', back_populates='metrics')

    def __repr__(self):
        return f"<AuthorMetrics(username='{self.username}', xirr_5yr={self.xirr_5yr})>"


class ScrapeLog(Base):
    """Job execution history"""
    __tablename__ = 'scrape_log'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String(50), nullable=False)  # 'ideas', 'author', 'prices', 'metrics'
    author_username = Column(String(100))  # If applicable
    status = Column(String(20), nullable=False)  # 'success', 'failed', 'partial'
    items_processed = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    def __repr__(self):
        return f"<ScrapeLog(job_type='{self.job_type}', status='{self.status}')>"


class CookieStore(Base):
    """Store for VIC session cookies"""
    __tablename__ = 'cookie_store'

    id = Column(Integer, primary_key=True, autoincrement=True)
    cookie_name = Column(String(100), nullable=False)
    cookie_value = Column(Text, nullable=False)
    domain = Column(String(100))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_valid = Column(Boolean, default=True)

    def __repr__(self):
        return f"<CookieStore(name='{self.cookie_name}')>"
