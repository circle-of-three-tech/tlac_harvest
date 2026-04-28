'use client';

import { useEffect, useState } from 'react';
import { WifiOff, HelpCircle, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => window.location.reload();
  const handleGoHome = () => (window.location.href = '/');

  const containerClasses = 'min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-slate-50 px-4';
  const boxClasses = 'text-center max-w-md';
  const iconWrapperClasses = 'mb-6 flex justify-center';
  const iconBoxClasses = 'p-4 bg-orange-100 rounded-full';
  const titleClasses = 'text-3xl font-bold text-slate-900 mb-3';
  const descClasses = 'text-slate-600 mb-6';
  const tipsBoxClasses = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6';
  const buttonContainerClasses = 'flex gap-3';
  const retryButtonClasses = 'flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors';
  const homeButtonClasses = 'flex-1 px-4 py-3 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300 transition-colors';
  const statusClasses = 'mt-6 text-xs text-slate-500';

  return (
    <div className={containerClasses}>
      <div className={boxClasses}>
        <div className={iconWrapperClasses}>
          <div className={iconBoxClasses}>
            <WifiOff className="w-12 h-12 text-orange-600" />
          </div>
        </div>

        <h1 className={titleClasses}>
          {isOnline ? 'Loading...' : "You're Offline"}
        </h1>

        <p className={descClasses}>
          {isOnline
            ? "We're reconnecting you to The Harvest..."
            : 'It looks like your internet connection was lost. You can still view previously loaded content, but some features may be limited.'}
        </p>

        <div className={tipsBoxClasses}>
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 text-left">
              <p className="font-semibold mb-1">Tips:</p>
              <ul className="space-y-1">
                <li>• Check your internet connection</li>
                <li>• Try moving closer to your WiFi router</li>
                <li>• Restart your device</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={buttonContainerClasses}>
          <button
            onClick={handleRetry}
            className={retryButtonClasses}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={handleGoHome}
            className={homeButtonClasses}
          >
            Go Home
          </button>
        </div>

        <div className={statusClasses}>
          {isOnline ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
              Connection restored
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></span>
              Waiting for connection...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
