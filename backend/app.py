"""
Flask API server for VIC Leaderboard Local Scraper
"""

import json
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

from db import get_db
from scraper import LatestIdeasScraper, IdeaDetailScraper, AuthorHistoryScraper
from services import YahooFinanceService, XIRRCalculator

app = Flask(__name__)
CORS(app)  # Allow all origins for local development

# Global state for scraping progress
scrape_state = {
    'is_running': False,
    'current_step': None,
    'progress': 0,
    'total': 0,
    'current_item': None,
    'errors': [],
    'started_at': None,
    'completed_at': None
}


# ==================== Health Check ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    db = get_db()
    stats = db.get_aggregate_stats()
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'stats': stats
    })


# ==================== Cookie Management ====================

@app.route('/api/cookies', methods=['POST'])
def submit_cookies():
    """
    Submit VIC cookies and optionally start scraping.

    Body: { cookies: [...], startScrape: boolean }
    """
    data = request.get_json()

    if not data or 'cookies' not in data:
        return jsonify({'error': 'No cookies provided'}), 400

    cookies = data['cookies']

    # Validate cookies - must have vic_session
    vic_session = next((c for c in cookies if c.get('name') == 'vic_session'), None)
    if not vic_session:
        return jsonify({'error': 'Missing vic_session cookie'}), 400

    # Save cookies to database
    db = get_db()
    db.save_cookies(cookies)

    # Verify authentication
    try:
        with AuthorHistoryScraper(cookies=cookies, headless=True) as scraper:
            is_auth = scraper.is_authenticated()
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to verify cookies: {str(e)}'
        }), 400

    if not is_auth:
        return jsonify({
            'success': False,
            'error': 'Cookies are not valid for authenticated access'
        }), 401

    # Start scraping if requested
    if data.get('startScrape'):
        start_scrape_thread()

    return jsonify({
        'success': True,
        'authenticated': True,
        'message': 'Cookies saved successfully'
    })


@app.route('/api/cookies', methods=['GET'])
def check_cookies():
    """Check if valid cookies are stored"""
    db = get_db()
    has_cookies = db.has_valid_cookies()
    return jsonify({
        'hasCookies': has_cookies
    })


# ==================== Scraping ====================

@app.route('/api/scrape/start', methods=['POST'])
def start_scrape():
    """Start the scraping process"""
    if scrape_state['is_running']:
        return jsonify({
            'error': 'Scrape already in progress',
            'status': scrape_state
        }), 409

    start_scrape_thread()

    return jsonify({
        'success': True,
        'message': 'Scraping started'
    })


@app.route('/api/scrape/status', methods=['GET'])
def get_scrape_status():
    """Get current scraping status"""
    db = get_db()
    db_status = db.get_scrape_status()

    return jsonify({
        **scrape_state,
        'database': db_status
    })


def start_scrape_thread():
    """Start the scraping process in a background thread"""
    thread = threading.Thread(target=run_scrape_process, daemon=True)
    thread.start()


def run_scrape_process():
    """Main scraping process - runs in background thread"""
    global scrape_state

    db = get_db()
    cookies = db.get_cookies()

    if not cookies:
        scrape_state['errors'].append('No cookies available')
        return

    scrape_state['is_running'] = True
    scrape_state['started_at'] = datetime.utcnow().isoformat()
    scrape_state['errors'] = []

    try:
        # Step 1: Scrape latest ideas
        scrape_state['current_step'] = 'scraping_ideas'
        scrape_state['progress'] = 0

        with LatestIdeasScraper(cookies=cookies, headless=True) as scraper:
            ideas = scraper.scrape_latest_day()

        scrape_state['progress'] = 100
        db.log_scrape('ideas', 'success', items_processed=len(ideas))

        # Step 2: Process each idea and collect unique authors
        scrape_state['current_step'] = 'processing_ideas'
        scrape_state['total'] = len(ideas)
        scrape_state['progress'] = 0

        authors_to_scrape = set()

        for i, idea in enumerate(ideas):
            scrape_state['current_item'] = idea.get('ticker')
            scrape_state['progress'] = int((i / len(ideas)) * 100)

            # Add idea to database (will skip if already exists)
            db.add_idea(
                author_username=idea['author'],
                ticker=idea['ticker'],
                posted_date=idea['posted_date'],
                position_type=idea.get('position_type', 'long'),
                company_name=idea.get('company_name'),
                idea_url=idea.get('idea_url')
            )

            # Always scrape author's history to check for new ideas
            authors_to_scrape.add(idea['author'])

        # Step 3: Scrape author histories for ALL authors from today's ideas
        scrape_state['current_step'] = 'scraping_authors'
        scrape_state['total'] = len(authors_to_scrape)
        scrape_state['progress'] = 0

        with AuthorHistoryScraper(cookies=cookies, headless=True) as scraper:
            for i, username in enumerate(authors_to_scrape):
                scrape_state['current_item'] = username
                scrape_state['progress'] = int((i / len(authors_to_scrape)) * 100)

                author_ideas = scraper.scrape_author(username, years=5)

                new_ideas_count = 0
                for idea in author_ideas:
                    result = db.add_idea(
                        author_username=username,
                        ticker=idea['ticker'],
                        posted_date=idea['posted_date'],
                        position_type=idea.get('position_type', 'long'),
                        idea_url=idea.get('idea_url')
                    )
                    if not result.get('exists'):
                        new_ideas_count += 1

                db.update_author_scraped(username)
                db.log_scrape('author', 'success', author_username=username,
                              items_processed=new_ideas_count)
                print(f"  Author {username}: {new_ideas_count} new ideas (of {len(author_ideas)} total)")

        # Step 4: Fetch prices for ideas needing them
        scrape_state['current_step'] = 'fetching_prices'
        scrape_state['progress'] = 0

        ideas_needing_prices = db.get_ideas_needing_prices(limit=100)
        scrape_state['total'] = len(ideas_needing_prices)

        price_service = YahooFinanceService()

        for i, idea in enumerate(ideas_needing_prices):
            scrape_state['current_item'] = idea['ticker']
            scrape_state['progress'] = int((i / len(ideas_needing_prices)) * 100)

            if idea['posted_date']:
                posted_date = datetime.fromisoformat(idea['posted_date'])
                price = price_service.get_historical_price(idea['ticker'], posted_date)
                db.update_idea_price(idea['id'], price if price else -1)

        # Step 5: Update current prices
        scrape_state['current_step'] = 'updating_prices'
        scrape_state['progress'] = 0

        price_result = price_service.update_all_prices(db, max_age_hours=24)
        scrape_state['progress'] = 100

        # Step 6: Calculate metrics
        scrape_state['current_step'] = 'calculating_metrics'
        scrape_state['progress'] = 0

        xirr_calc = XIRRCalculator()
        metrics_result = xirr_calc.update_all_metrics(db)
        scrape_state['progress'] = 100

        db.log_scrape('metrics', 'success', items_processed=metrics_result['success'])

        scrape_state['current_step'] = 'complete'
        scrape_state['completed_at'] = datetime.utcnow().isoformat()

    except Exception as e:
        scrape_state['errors'].append(str(e))
        db.log_scrape('scrape', 'failed', error_message=str(e))

    finally:
        scrape_state['is_running'] = False


# ==================== Leaderboard ====================

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """
    Get leaderboard data with pagination.

    Query params:
        sort: Field to sort by (xirr_5yr, xirr_3yr, xirr_1yr)
        limit: Number of results (default 25)
        offset: Offset for pagination (default 0)
    """
    sort_by = request.args.get('sort', 'xirr_5yr')
    limit = int(request.args.get('limit', 25))
    offset = int(request.args.get('offset', 0))

    # Map frontend field names to database fields
    field_map = {
        'xirr5yr': 'xirr_5yr',
        'xirr3yr': 'xirr_3yr',
        'xirr1yr': 'xirr_1yr'
    }
    sort_by = field_map.get(sort_by, sort_by)

    db = get_db()
    result = db.get_leaderboard(sort_by=sort_by, limit=limit, offset=offset)

    return jsonify(result)


@app.route('/api/leaderboard/search', methods=['GET'])
def search_leaderboard():
    """
    Search authors by username.

    Query params:
        q: Search term
        limit: Number of results (default 20)
    """
    search_term = request.args.get('q', '')
    limit = int(request.args.get('limit', 20))

    if not search_term:
        return jsonify({'data': []})

    db = get_db()
    results = db.search_authors(search_term, limit=limit)

    return jsonify({'data': results})


# ==================== Author Details ====================

@app.route('/api/author/<username>', methods=['GET'])
def get_author(username):
    """Get author details with their ideas"""
    db = get_db()
    result = db.get_author_with_ideas(username)

    if not result:
        return jsonify({'error': 'Author not found'}), 404

    return jsonify(result)


# ==================== Manual Operations ====================

@app.route('/api/update/prices', methods=['POST'])
def update_prices():
    """Manually trigger price update"""
    db = get_db()
    price_service = YahooFinanceService()
    result = price_service.update_all_prices(db)

    return jsonify({
        'success': True,
        **result
    })


@app.route('/api/update/metrics', methods=['POST'])
def update_metrics():
    """Manually trigger metrics recalculation"""
    db = get_db()
    xirr_calc = XIRRCalculator()
    result = xirr_calc.update_all_metrics(db)

    return jsonify({
        'success': True,
        **result
    })


# ==================== Startup ====================

def init_app():
    """Initialize the application"""
    db = get_db()
    db.init_db()
    print("Database initialized")


if __name__ == '__main__':
    init_app()
    print("Starting VIC Leaderboard API server...")
    print("API running at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
