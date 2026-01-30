import React, { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import './CrimeResultsPanel.css';

/**
 * Crime Results Panel - Database-backed crime statistics
 * Uses /api/crime-stats endpoints for stable data
 * Only shows wallets that have active crime automation
 */
export default function CrimeResultsPanel() {
    const TIME_SCALES = [
        { label: '1 Hour', hours: 1 },
        { label: '6 Hours', hours: 6 },
        { label: '12 Hours', hours: 12 },
        { label: '24 Hours', hours: 24 },
        { label: '3 Days', hours: 72 },
        { label: '7 Days', hours: 168 }
    ];

    const [timeScale, setTimeScale] = usePersistentState('nexus_crime_timescale', 24);
    const [summary, setSummary] = useState({ pls: null, bnb: null });
    const [wallets, setWallets] = useState([]);
    const [activeWallets, setActiveWallets] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // First fetch active crime wallets from scripts status
            const statusRes = await fetch('/api/all/status');
            const statusData = await statusRes.json();
            
            // Extract active crime wallet IDs from both chains
            const activeCrimeWallets = new Set();
            if (statusData.crime) {
                // Check pulsechain
                if (statusData.crime.pulsechain) {
                    Object.keys(statusData.crime.pulsechain).forEach(walletId => {
                        if (statusData.crime.pulsechain[walletId]?.running) {
                            activeCrimeWallets.add(walletId);
                        }
                    });
                }
                // Check bnb
                if (statusData.crime.bnb) {
                    Object.keys(statusData.crime.bnb).forEach(walletId => {
                        if (statusData.crime.bnb[walletId]?.running) {
                            activeCrimeWallets.add(walletId);
                        }
                    });
                }
            }
            setActiveWallets(activeCrimeWallets);

            // Fetch summary stats
            const summaryRes = await fetch(`/api/crime-stats/summary?hours=${timeScale}`);
            const summaryData = await summaryRes.json();
            
            if (summaryData.success) {
                setSummary(summaryData.stats || {});
            }

            // Fetch per-wallet stats - show ALL wallets with data, not just active
            const walletsRes = await fetch(`/api/crime-stats/wallets?hours=${timeScale}`);
            const walletsData = await walletsRes.json();
            
            if (walletsData.success) {
                // Show all wallets that have crime data
                setWallets(walletsData.wallets || []);
            }

        } catch (err) {
            console.error('Failed to fetch crime stats:', err);
            setError('Failed to load stats');
        }

        setLoading(false);
    }, [timeScale]);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchStats]);

    // Calculate totals from summary
    const totalStats = {
        total: (summary.pls?.total || 0) + (summary.bnb?.total || 0),
        successes: (summary.pls?.successes || 0) + (summary.bnb?.successes || 0),
        failures: (summary.pls?.failures || 0) + (summary.bnb?.failures || 0),
        mafiaEarned: (summary.pls?.mafiaEarned || 0) + (summary.bnb?.mafiaEarned || 0)
    };

    return (
        <div className="crime-results-panel">
            <div className="crp-header">
                <span className="crp-title">📊 STATISTICS</span>
                <div className="crp-controls">
                    <select 
                        value={timeScale} 
                        onChange={(e) => setTimeScale(parseInt(e.target.value))}
                        className="crp-select"
                    >
                        {TIME_SCALES.map(scale => (
                            <option key={scale.hours} value={scale.hours}>
                                {scale.label}
                            </option>
                        ))}
                    </select>
                    <button className="crp-refresh" onClick={fetchStats} disabled={loading}>
                        {loading ? '...' : '↻'}
                    </button>
                </div>
            </div>

            <div className="crp-body">
                {error && <div className="crp-error">{error}</div>}

                {/* Totals Row */}
                <div className="crp-totals">
                    <span className="crp-stat">
                        <span className="crp-stat-label">Crimes:</span>
                        <span className="crp-stat-value">{totalStats.total}</span>
                    </span>
                    <span className="crp-stat">
                        <span className="crp-stat-label">Success:</span>
                        <span className="crp-stat-value success">{totalStats.successes}</span>
                    </span>
                    <span className="crp-stat">
                        <span className="crp-stat-label">Failed:</span>
                        <span className="crp-stat-value fail">{totalStats.failures}</span>
                    </span>
                    <span className="crp-stat">
                        <span className="crp-stat-label">Rate:</span>
                        <span className="crp-stat-value success">
                            {totalStats.total > 0 ? ((totalStats.successes / totalStats.total) * 100).toFixed(0) : 0}%
                        </span>
                    </span>
                    <span className="crp-stat">
                        <span className="crp-stat-label">$MAFIA:</span>
                        <span className="crp-stat-value mafia">
                            {totalStats.mafiaEarned.toFixed(1)}
                        </span>
                    </span>
                </div>

                {/* Per-Wallet Stats */}
                <div className="crp-wallets">
                    {error ? (
                        <div className="crp-empty crp-error">⚠️ {error} - <button onClick={fetchStats}>Retry</button></div>
                    ) : loading && wallets.length === 0 ? (
                        <div className="crp-empty crp-loading">⏳ Loading crime data...</div>
                    ) : wallets.length === 0 ? (
                        <div className="crp-empty">
                            <div className="crp-empty-icon">📊</div>
                            <div className="crp-empty-text">No crime data in selected time range</div>
                            <div className="crp-empty-hint">Start crime automation to see stats here</div>
                        </div>
                    ) : (
                        wallets.map((wallet) => (
                            <div key={wallet.wallet} className="crp-wallet-group">
                                <div className="crp-wallet-header">
                                    <span className="crp-wallet-name">{wallet.wallet}</span>
                                    {wallet.address && (
                                        <span className="crp-wallet-addr">
                                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                                        </span>
                                    )}
                                </div>
                                
                                {/* PulseChain */}
                                {(wallet.pls?.total > 0 || wallet.pls?.player) && (
                                    <div className="crp-char-row pls">
                                        <div className="crp-char-identity">
                                            <span className="crp-chain-badge pls">💜 PLS</span>
                                            {wallet.pls?.player?.name && (
                                                <span className="crp-player-name">{wallet.pls.player.name}</span>
                                            )}
                                            {wallet.pls?.player && (
                                                <span className="crp-player-level">Lv.{wallet.pls.player.level}</span>
                                            )}
                                        </div>
                                        <div className="crp-char-stats-row">
                                            <span className="crp-stat-item">
                                                <span className="label">Crimes:</span>
                                                <span className="value">{wallet.pls?.total || 0}</span>
                                            </span>
                                            <span className="crp-stat-item success">
                                                <span className="label">✓</span>
                                                <span className="value">{wallet.pls?.successes || 0}</span>
                                            </span>
                                            <span className="crp-stat-item fail">
                                                <span className="label">✗</span>
                                                <span className="value">{wallet.pls?.failures || 0}</span>
                                            </span>
                                            <span className="crp-stat-item mafia">
                                                <span className="label">+$MAFIA:</span>
                                                <span className="value">{(wallet.pls?.mafiaEarned || 0).toFixed(1)}</span>
                                            </span>
                                            <span className="crp-stat-item xp">
                                                <span className="label">+XP:</span>
                                                <span className="value">{wallet.pls?.xpEarned || 0}</span>
                                            </span>
                                        </div>
                                        {wallet.pls?.player && (
                                            <div className="crp-player-stats-row">
                                                <span className="crp-pstat">
                                                    <span className="icon">❤️</span>{wallet.pls.player.health}
                                                </span>
                                                <span className="crp-pstat">
                                                    <span className="icon">🏙️</span>City {wallet.pls.player.city}
                                                </span>
                                                <span className="crp-pstat mafia">
                                                    <span className="icon">💰</span>{parseFloat(wallet.pls.player.mafia || 0).toFixed(1)}
                                                </span>
                                                <span className="crp-pstat">
                                                    <span className="icon">🎯</span>Skill {wallet.pls.player.crimeSkill}
                                                </span>
                                                {wallet.pls.player.travels > 0 && (
                                                    <span className="crp-pstat travel">
                                                        <span className="icon">✈️</span>{wallet.pls.player.travels} travels
                                                    </span>
                                                )}
                                                {wallet.pls.player.inJail && (
                                                    <span className="crp-pstat jail">⛓️ JAIL</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* BNB Chain */}
                                {(wallet.bnb?.total > 0 || wallet.bnb?.player) && (
                                    <div className="crp-char-row bnb">
                                        <div className="crp-char-identity">
                                            <span className="crp-chain-badge bnb">💛 BNB</span>
                                            {wallet.bnb?.player?.name && (
                                                <span className="crp-player-name">{wallet.bnb.player.name}</span>
                                            )}
                                            {wallet.bnb?.player && (
                                                <span className="crp-player-level">Lv.{wallet.bnb.player.level}</span>
                                            )}
                                        </div>
                                        <div className="crp-char-stats-row">
                                            <span className="crp-stat-item">
                                                <span className="label">Crimes:</span>
                                                <span className="value">{wallet.bnb?.total || 0}</span>
                                            </span>
                                            <span className="crp-stat-item success">
                                                <span className="label">✓</span>
                                                <span className="value">{wallet.bnb?.successes || 0}</span>
                                            </span>
                                            <span className="crp-stat-item fail">
                                                <span className="label">✗</span>
                                                <span className="value">{wallet.bnb?.failures || 0}</span>
                                            </span>
                                            <span className="crp-stat-item mafia">
                                                <span className="label">+$MAFIA:</span>
                                                <span className="value">{(wallet.bnb?.mafiaEarned || 0).toFixed(1)}</span>
                                            </span>
                                            <span className="crp-stat-item xp">
                                                <span className="label">+XP:</span>
                                                <span className="value">{wallet.bnb?.xpEarned || 0}</span>
                                            </span>
                                        </div>
                                        {wallet.bnb?.player && (
                                            <div className="crp-player-stats-row">
                                                <span className="crp-pstat">
                                                    <span className="icon">❤️</span>{wallet.bnb.player.health}
                                                </span>
                                                <span className="crp-pstat">
                                                    <span className="icon">🏙️</span>City {wallet.bnb.player.city}
                                                </span>
                                                <span className="crp-pstat mafia">
                                                    <span className="icon">💰</span>{parseFloat(wallet.bnb.player.mafia || 0).toFixed(1)}
                                                </span>
                                                <span className="crp-pstat">
                                                    <span className="icon">🎯</span>Skill {wallet.bnb.player.crimeSkill}
                                                </span>
                                                {wallet.bnb.player.travels > 0 && (
                                                    <span className="crp-pstat travel">
                                                        <span className="icon">✈️</span>{wallet.bnb.player.travels} travels
                                                    </span>
                                                )}
                                                {wallet.bnb.player.inJail && (
                                                    <span className="crp-pstat jail">⛓️ JAIL</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
