import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Database, Search, DollarSign, Calculator } from 'lucide-react';
import { useScrapeStatus } from '../hooks/useScrapeStatus';

const STEP_LABELS = {
    scraping_ideas: { label: 'Scraping Latest Ideas', icon: Search },
    processing_ideas: { label: 'Processing Ideas', icon: Database },
    scraping_authors: { label: 'Scraping Author Histories', icon: Search },
    fetching_prices: { label: 'Fetching Historical Prices', icon: DollarSign },
    updating_prices: { label: 'Updating Current Prices', icon: DollarSign },
    calculating_metrics: { label: 'Calculating XIRR Metrics', icon: Calculator },
    complete: { label: 'Complete', icon: CheckCircle },
};

export default function ScrapeProgress({ onComplete }) {
    const { status, isRunning, currentStep, progress, currentItem, loading, error } = useScrapeStatus(true, 2000);

    // Check if complete
    React.useEffect(() => {
        if (currentStep === 'complete' && onComplete) {
            const timer = setTimeout(onComplete, 2000);
            return () => clearTimeout(timer);
        }
    }, [currentStep, onComplete]);

    if (loading && !status) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    const stepInfo = STEP_LABELS[currentStep] || { label: 'Processing...', icon: Loader2 };
    const StepIcon = stepInfo.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        {currentStep === 'complete' ? (
                            <CheckCircle className="text-white" size={32} />
                        ) : (
                            <Loader2 className="text-white animate-spin" size={32} />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {currentStep === 'complete' ? 'Scraping Complete!' : 'Scraping VIC Data'}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {currentStep === 'complete'
                            ? 'Your leaderboard is ready'
                            : 'This may take several minutes...'}
                    </p>
                </div>

                {/* Current Step */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            currentStep === 'complete' ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                            <StepIcon
                                className={currentStep === 'complete' ? 'text-green-600' : 'text-blue-600'}
                                size={20}
                            />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-slate-900">{stepInfo.label}</p>
                            {currentItem && currentStep !== 'complete' && (
                                <p className="text-sm text-slate-500">
                                    Processing: <span className="font-mono">{currentItem}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {currentStep !== 'complete' && (
                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats */}
                {status?.database?.counts && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <p className="text-2xl font-bold text-slate-900">
                                {status.database.counts.authors || 0}
                            </p>
                            <p className="text-xs text-slate-500">Authors</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <p className="text-2xl font-bold text-slate-900">
                                {status.database.counts.ideas || 0}
                            </p>
                            <p className="text-xs text-slate-500">Ideas</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <p className="text-2xl font-bold text-slate-900">
                                {status.database.counts.authorsWithMetrics || 0}
                            </p>
                            <p className="text-xs text-slate-500">With Metrics</p>
                        </div>
                    </div>
                )}

                {/* Errors */}
                {status?.errors?.length > 0 && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                            <div>
                                <p className="font-medium text-red-900 text-sm">Errors occurred:</p>
                                <ul className="text-xs text-red-700 mt-1 list-disc list-inside">
                                    {status.errors.slice(0, 3).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Leaderboard Button (when complete) */}
                {currentStep === 'complete' && (
                    <button
                        onClick={onComplete}
                        className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                        View Leaderboard
                    </button>
                )}
            </div>
        </div>
    );
}
