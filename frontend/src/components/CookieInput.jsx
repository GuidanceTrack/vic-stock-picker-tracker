import React, { useState } from 'react';
import { Key, AlertCircle, CheckCircle, Loader2, ExternalLink, Cookie, ClipboardPaste } from 'lucide-react';

export default function CookieInput({ onCookiesSubmitted }) {
    const [cookieJson, setCookieJson] = useState('');
    const [status, setStatus] = useState('idle'); // idle, validating, success, error
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('validating');
        setError('');

        try {
            // Parse the JSON
            let cookies;
            try {
                cookies = JSON.parse(cookieJson);
            } catch (parseError) {
                throw new Error('Invalid JSON format. Please paste the exact output from Cookie-Editor.');
            }

            // Validate it's an array
            if (!Array.isArray(cookies)) {
                throw new Error('Expected an array of cookies. Make sure you exported all cookies.');
            }

            // Check for vic_session cookie
            const vicSession = cookies.find(c => c.name === 'vic_session');
            if (!vicSession) {
                throw new Error('Missing vic_session cookie. Make sure you are logged in to VIC and exported all cookies.');
            }

            // Submit to backend
            const response = await fetch('http://localhost:5000/api/cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookies, startScrape: true }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to validate cookies');
            }

            setStatus('success');

            // Notify parent after a brief delay to show success state
            setTimeout(() => {
                onCookiesSubmitted(cookies);
            }, 1500);

        } catch (err) {
            setStatus('error');
            setError(err.message);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setCookieJson(text);
        } catch (err) {
            setError('Could not read from clipboard. Please paste manually.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
                        <Cookie className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">VIC Leaderboard Setup</h1>
                        <p className="text-slate-500">Provide your VIC cookies to start scraping</p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-3">How to get your VIC cookies:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                        <li>
                            Open <a href="https://valueinvestorsclub.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">valueinvestorsclub.com</a> in Firefox or Chrome
                        </li>
                        <li>Log in to your VIC account (make sure "Remember me" is checked)</li>
                        <li>
                            Install the{' '}
                            <a
                                href="https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-blue-600 inline-flex items-center gap-1"
                            >
                                Cookie-Editor extension <ExternalLink size={12} />
                            </a>
                        </li>
                        <li>Click the Cookie-Editor icon in your browser toolbar</li>
                        <li>Click "Export" (as JSON) to copy all cookies</li>
                        <li>Paste the JSON below</li>
                    </ol>
                </div>

                {/* Important Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
                        <div>
                            <h4 className="font-semibold text-amber-900 text-sm">Important</h4>
                            <p className="text-sm text-amber-800">
                                Do not use Firefox while the scraper is running. The session cookie can only be active in one browser at a time.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Cookie Input Form */}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="cookies" className="block text-sm font-medium text-slate-700">
                                Cookie JSON
                            </label>
                            <button
                                type="button"
                                onClick={handlePaste}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                                <ClipboardPaste size={14} />
                                Paste from clipboard
                            </button>
                        </div>
                        <textarea
                            id="cookies"
                            value={cookieJson}
                            onChange={(e) => setCookieJson(e.target.value)}
                            placeholder='[{"name": "vic_session", "value": "...", ...}]'
                            className="w-full h-48 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                            disabled={status === 'validating' || status === 'success'}
                        />
                    </div>

                    {/* Error Message */}
                    {status === 'error' && error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {status === 'success' && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                            <CheckCircle className="text-green-500" size={18} />
                            <p className="text-sm text-green-700">Cookies validated! Starting scraper...</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!cookieJson.trim() || status === 'validating' || status === 'success'}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {status === 'validating' ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Validating cookies...
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle size={20} />
                                Success!
                            </>
                        ) : (
                            <>
                                <Key size={20} />
                                Submit Cookies & Start Scraping
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p className="text-xs text-slate-400 text-center mt-6">
                    Your cookies are stored locally and never sent to any external server.
                </p>
            </div>
        </div>
    );
}
