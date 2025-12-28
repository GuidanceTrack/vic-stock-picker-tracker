"""Scraper package for VIC website"""

from .base import BaseScraper
from .latest_ideas import LatestIdeasScraper
from .idea_detail import IdeaDetailScraper
from .author_history import AuthorHistoryScraper

__all__ = ['BaseScraper', 'LatestIdeasScraper', 'IdeaDetailScraper', 'AuthorHistoryScraper']
