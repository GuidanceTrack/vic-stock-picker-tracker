import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, Loader2, ExternalLink, Cookie, ClipboardPaste } from 'lucide-react';

export default function CookieModal({ isOpen, onClose, onCookiesSubmitted, reason }) {
    const [cookieJson, setCookieJson] = useState('');
    const [status, setStatus] = useState('idle'); // idle, validating, success, error
    const [error, setError] = useState('');

    if (!isOpen) return null;

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

            // Submit to backend (don't auto-start scrape, let caller decide)
            const response = await fetch('http://localhost:5000/api/cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookies, startScrape: false }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to validate cookies');
            }

            setStatus('success');

            // Notify parent after a brief delay to show success state
            setTimeout(() => {
                onCookiesSubmitted(cookies);
                // Reset state for next time
                setCookieJson('');
                setStatus('idle');
                setError('');
            }, 1000);

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

    const handleClose = () => {
        if (status !== 'validating') {
            setCookieJson('');
            setStatus('idle');
            setError('');
            onClose();
        }
    };

    const getReasonMessage = () => {
        switch (reason) {
            case 'no_cookies':
                return 'No cookies found. Please provide your VIC cookies to start scraping.';
            case 'expired':
                return 'Your VIC cookies have expired. Please provide fresh cookies to continue.';
            case 'error':
                return 'Could not verify cookies. Please provide fresh cookies.';
            default:
                return 'Please provide your VIC cookies to continue.';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    disabled={status === 'validating'}
                >
                    <X size={20} />
                </button>

                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                            <Cookie className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Re-enter VIC Cookies</h2>
                            <p className="text-slate-500 text-sm">{getReasonMessage()}</p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                        <h3 className="font-semibold text-blue-900 mb-2 text-sm">How to get fresh cookies:</h3>
                        <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-800">
                            <li>
                                Open <a href="https://valueinvestorsclub.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">valueinvestorsclub.com</a> and log in
                            </li>
                            <li>Click the Cookie-Editor extension icon</li>
                            <li>Click "Export" (as JSON) to copy all cookies</li>
                            <li>Paste the JSON below</li>
                        </ol>
                    </div>

                    {/* Cookie Input Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="cookies-modal" className="block text-sm font-medium text-slate-700">
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
                                id="cookies-modal"
                                value={cookieJson}
                                onChange={(e) => setCookieJson(e.target.value)}
                                placeholder='[{"name": "vic_session", "value": "...", ...}]'
                                className="w-full h-40 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
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

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={status === 'validating'}
                                className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!cookieJson.trim() || status === 'validating' || status === 'success'}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === 'validating' ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Validating...
                                    </>
                                ) : status === 'success' ? (
                                    <>
                                        <CheckCircle size={18} />
                                        Success!
                                    </>
                                ) : (
                                    'Submit Cookies'
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Footer */}
                    <p className="text-xs text-slate-400 text-center mt-5">
                        Your cookies are stored locally and never sent to any external server.
                    </p>
                </div>
            </div>
        </div>
    );
}
