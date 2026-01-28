import React, { useState, useEffect, useCallback } from 'react';
import API_BASE from '../config/api';
import './CooldownTracker.css';

/**
 * CooldownTracker - Centralized cooldown monitoring for all wallets
 * Displays real-time cooldown status for crime, nick car, kill skill, travel
 */
export default function CooldownTracker({ wallets = [] }) {
    const [cooldowns, setCooldowns] = useState({});
    const [loading, setLoading] = useState(false);
    const [chain, setChain] = useState('pulsechain');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Cooldown definitions
    const cooldownTypes = [
        { key: 'crime', label: 'Crime', icon: '🔫', duration: 15 },
        { key: 'nickCar', label: 'Nick Car', icon: '🚗', duration: 30 },
        { key: 'killSkill', label: 'Kill Skill', icon: '🎯', duration: 45 },
        { key: 'travel', label: 'Travel', icon: '✈️', duration: 60 }
    ];

    const fetchCooldowns = useCallback(async () => {
        if (!wallets || wallets.length === 0) return;
        
        setLoading(true);
        const results = {};

        for (const wallet of wallets) {
            // Skip if wallet has no address
            if (!wallet || !wallet.address) continue;
            
            try {
                const res = await fetch(`${API_BASE}/api/game/cooldowns/${wallet.address}?chain=${chain}`);
                if (res.ok) {
                    const data = await res.json();
                    results[wallet.address] = {
                        ...data.cooldowns,
                        name: wallet.name || wallet.address.slice(0, 8)
                    };
                }
            } catch (err) {
                console.error(`Failed to fetch cooldowns for ${wallet.address}:`, err);
            }
        }

        setCooldowns(results);
        setLastUpdate(new Date());
        setLoading(false);
    }, [wallets, chain]);

    // Initial fetch and refresh timer
    useEffect(() => {
        fetchCooldowns();
        
        if (autoRefresh) {
            const interval = setInterval(fetchCooldowns, 30000); // Refresh every 30 seconds
            return () => clearInterval(interval);
        }
    }, [fetchCooldowns, autoRefresh]);

    const formatTime = (seconds) => {
        if (seconds <= 0) return 'READY';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const getStatusClass = (seconds) => {
        if (seconds <= 0) return 'ready';
        if (seconds < 60) return 'soon';
        return 'waiting';
    };

    const getTotalReady = (address) => {
        const cd = cooldowns[address];
        if (!cd) return 0;
        return cooldownTypes.filter(t => (cd[t.key]?.secondsRemaining || 0) <= 0).length;
    };

    return (
        <div className="cooldown-tracker">
            <div className="tracker-header">
                <h2>⏱️ Cooldown Tracker</h2>
                <div className="tracker-controls">
                    <select value={chain} onChange={(e) => setChain(e.target.value)}>
                        <option value="pulsechain">PulseChain</option>
                        <option value="bnb">BNB Chain</option>
                    </select>
                    <label className="auto-refresh">
                        <input 
                            type="checkbox" 
                            checked={autoRefresh} 
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                    <button onClick={fetchCooldowns} disabled={loading}>
                        {loading ? '⏳' : '🔄'} Refresh
                    </button>
                    {lastUpdate && (
                        <span className="last-update">
                            Updated: {lastUpdate.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="tracker-legend">
                {cooldownTypes.map(t => (
                    <span key={t.key} className="legend-item">
                        {t.icon} {t.label} ({t.duration}m)
                    </span>
                ))}
            </div>

            {/* Wallet Grid */}
            <div className="wallet-grid">
                {Object.entries(cooldowns).map(([address, cd]) => (
                    <div key={address} className="wallet-card">
                        <div className="wallet-header">
                            <span className="wallet-name">{cd.name}</span>
                            <span className="ready-count">{getTotalReady(address)}/4 ready</span>
                        </div>
                        <div className="cooldown-row">
                            {cooldownTypes.map(t => {
                                const remaining = cd[t.key]?.secondsRemaining || 0;
                                return (
                                    <div 
                                        key={t.key} 
                                        className={`cooldown-cell ${getStatusClass(remaining)}`}
                                        title={`${t.label}: ${formatTime(remaining)}`}
                                    >
                                        <span className="cd-icon">{t.icon}</span>
                                        <span className="cd-time">{formatTime(remaining)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {(!wallets || wallets.length === 0) && (
                <div className="no-wallets">
                    <p>No wallets configured. Add wallets in the Foundry section.</p>
                </div>
            )}
        </div>
    );
}
