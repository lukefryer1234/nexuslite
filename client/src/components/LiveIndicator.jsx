import React, { useState, useEffect } from 'react';
import './LiveIndicator.css';

/**
 * LiveIndicator - Shows connection status and last update time
 * 
 * @param {Date|string|number} lastUpdated - Last update timestamp
 * @param {number} refreshInterval - Seconds between updates (for showing countdown)
 * @param {string} status - 'live' | 'connecting' | 'paused' | 'error'
 * @param {boolean} showCountdown - Show next refresh countdown
 * @param {boolean} compact - Use compact styling
 */
export default function LiveIndicator({
    lastUpdated,
    refreshInterval = 0,
    status = 'live',
    showCountdown = false,
    compact = false,
    nextRefresh = 0
}) {
    const [secondsAgo, setSecondsAgo] = useState(0);

    // Update "X seconds ago" display
    useEffect(() => {
        if (!lastUpdated) return;

        const update = () => {
            const diff = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);
            setSecondsAgo(Math.max(0, diff));
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    // Format seconds ago
    const formatAgo = (seconds) => {
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    };

    // Format countdown
    const formatCountdown = (seconds) => {
        if (seconds <= 0) return '0s';
        if (seconds < 60) return `${seconds}s`;
        return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };

    // Get status info
    const getStatusInfo = () => {
        switch (status) {
            case 'live':
                return { label: 'Live', color: '#0f0', pulse: true };
            case 'connecting':
                return { label: 'Connecting...', color: '#f1c40f', pulse: true };
            case 'paused':
                return { label: 'Paused', color: '#888', pulse: false };
            case 'error':
                return { label: 'Error', color: '#f55', pulse: false };
            default:
                return { label: 'Unknown', color: '#666', pulse: false };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className={`live-indicator ${compact ? 'compact' : ''} ${status}`}>
            {/* Status dot */}
            <span
                className={`status-dot ${statusInfo.pulse ? 'pulse' : ''}`}
                style={{ '--dot-color': statusInfo.color }}
            />

            {/* Status label or time ago */}
            <span className="status-text" style={{ color: statusInfo.color }}>
                {status === 'live' && lastUpdated ? (
                    secondsAgo <= 5 ? 'Live' : formatAgo(secondsAgo)
                ) : (
                    statusInfo.label
                )}
            </span>

            {/* Countdown to next refresh */}
            {showCountdown && nextRefresh > 0 && status === 'live' && (
                <span className="refresh-countdown">
                    🔄 {formatCountdown(nextRefresh)}
                </span>
            )}
        </div>
    );
}
