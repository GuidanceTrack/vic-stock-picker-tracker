import { useState, useEffect } from 'react';
import VICLeaderboard from './components/VICLeaderboard';
import CookieInput from './components/CookieInput';
import ScrapeProgress from './components/ScrapeProgress';
import { checkCookies, getScrapeStatus, startScrape } from './services/api';

// App modes
const MODE = {
    LOADING: 'loading',
    COOKIE_INPUT: 'cookie_input',
    SCRAPING: 'scraping',
    LEADERBOARD: 'leaderboard',
};

function App() {
    const [mode, setMode] = useState(MODE.LOADING);
    const [error, setError] = useState(null);

    // Check initial state on mount
    useEffect(() => {
        async function checkInitialState() {
            try {
                // Check if backend is running
                const cookieStatus = await checkCookies();

                if (!cookieStatus.hasCookies) {
                    // No cookies, need to input them
                    setMode(MODE.COOKIE_INPUT);
                    return;
                }

                // Check if scrape is in progress
                const scrapeStatus = await getScrapeStatus();

                if (scrapeStatus.is_running) {
                    setMode(MODE.SCRAPING);
                } else if (scrapeStatus.database?.counts?.authorsWithMetrics > 0) {
                    // Have data, show leaderboard
                    setMode(MODE.LEADERBOARD);
                } else {
                    // Have cookies but no data, might need to scrape
                    setMode(MODE.LEADERBOARD);
                }
            } catch (err) {
                console.error('Error checking initial state:', err);
                // Backend might not be running - show cookie input anyway
                setError('Cannot connect to backend. Make sure the Flask server is running on localhost:5000');
                setMode(MODE.COOKIE_INPUT);
            }
        }

        checkInitialState();
    }, []);

    // Handle cookie submission
    const handleCookiesSubmitted = (cookies) => {
        setMode(MODE.SCRAPING);
    };

    // Handle scrape completion
    const handleScrapeComplete = () => {
        setMode(MODE.LEADERBOARD);
    };

    // Handle starting a new scrape from leaderboard
    const handleStartScrape = async () => {
        try {
            await startScrape();
            setMode(MODE.SCRAPING);
        } catch (err) {
            console.error('Error starting scrape:', err);
            setError('Failed to start scrape. Make sure you have valid cookies.');
        }
    };

    // Render based on mode
    switch (mode) {
        case MODE.LOADING:
            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-600">Connecting to backend...</p>
                    </div>
                </div>
            );

        case MODE.COOKIE_INPUT:
            return (
                <>
                    {error && (
                        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg shadow-lg z-50">
                            {error}
                        </div>
                    )}
                    <CookieInput onCookiesSubmitted={handleCookiesSubmitted} />
                </>
            );

        case MODE.SCRAPING:
            return <ScrapeProgress onComplete={handleScrapeComplete} />;

        case MODE.LEADERBOARD:
        default:
            return <VICLeaderboard useLocalApi={true} onStartScrape={handleStartScrape} />;
    }
}

export default App;
