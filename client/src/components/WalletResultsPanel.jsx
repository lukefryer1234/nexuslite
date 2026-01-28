import React, { useMemo } from 'react';
import './WalletResultsPanel.css';

/**
 * WalletResultsPanel - Shows per-wallet statistics and results
 * Displays success/fail counts, last activity, and status for each wallet
 */
export default function WalletResultsPanel({ logs, wallets, selectedWallet, onWalletSelect }) {
    // Calculate stats per wallet from logs
    const walletStats = useMemo(() => {
        const stats = {};
        
        // Initialize stats for all wallets
        for (const wallet of wallets) {
            stats[wallet] = {
                name: wallet,
                crimeSuccess: 0,
                crimeFail: 0,
                nickcarSuccess: 0,
                nickcarFail: 0,
                killskillSuccess: 0,
                killskillFail: 0,
                travelSuccess: 0,
                travelFail: 0,
                lastActivity: null,
                lastMessage: ''
            };
        }
        
        // Parse logs for stats
        for (const log of logs) {
            const walletId = log.walletId;
            if (!walletId || !stats[walletId]) continue;
            
            const text = log.text || '';
            const channel = log.channel || '';
            const time = log.time;
            
            // Update last activity
            if (!stats[walletId].lastActivity || time > stats[walletId].lastActivity) {
                stats[walletId].lastActivity = time;
                stats[walletId].lastMessage = text.split('\n')[0].substring(0, 50);
            }
            
            // Count successes and failures
            if (channel === 'crime') {
                if (text.includes('executed successfully')) stats[walletId].crimeSuccess++;
                if (text.includes('failed') || text.includes('cooldown')) stats[walletId].crimeFail++;
            }
            if (channel === 'nickcar') {
                if (text.includes('successfully')) stats[walletId].nickcarSuccess++;
                if (text.includes('failed')) stats[walletId].nickcarFail++;
            }
            if (channel === 'killskill') {
                if (text.includes('successfully') || text.includes('Training')) stats[walletId].killskillSuccess++;
                if (text.includes('failed') || text.includes('jail')) stats[walletId].killskillFail++;
            }
            if (channel === 'travel') {
                if (text.includes('successfully') || text.includes('arrived')) stats[walletId].travelSuccess++;
                if (text.includes('failed')) stats[walletId].travelFail++;
            }
        }
        
        return Object.values(stats);
    }, [logs, wallets]);

    const formatTime = (timestamp) => {
        if (!timestamp) return 'No activity';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    return (
        <div className="wallet-results-panel">
            <div className="panel-header">
                <h3>📊 Wallet Results</h3>
                <select 
                    value={selectedWallet || 'all'} 
                    onChange={(e) => onWalletSelect(e.target.value === 'all' ? null : e.target.value)}
                    className="wallet-filter"
                >
                    <option value="all">All Wallets</option>
                    {wallets.map(w => (
                        <option key={w} value={w}>{w}</option>
                    ))}
                </select>
            </div>
            
            <div className="wallet-cards">
                {walletStats
                    .filter(w => !selectedWallet || w.name === selectedWallet)
                    .map(wallet => (
                    <div key={wallet.name} className="wallet-card">
                        <div className="wallet-name">{wallet.name}</div>
                        <div className="wallet-stats">
                            <div className="stat-row">
                                <span className="stat-label">🔫 Crime</span>
                                <span className="stat-success">{wallet.crimeSuccess} ✓</span>
                                <span className="stat-fail">{wallet.crimeFail} ✗</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">🚗 Nick Car</span>
                                <span className="stat-success">{wallet.nickcarSuccess} ✓</span>
                                <span className="stat-fail">{wallet.nickcarFail} ✗</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">🎯 Kill Skill</span>
                                <span className="stat-success">{wallet.killskillSuccess} ✓</span>
                                <span className="stat-fail">{wallet.killskillFail} ✗</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">✈️ Travel</span>
                                <span className="stat-success">{wallet.travelSuccess} ✓</span>
                                <span className="stat-fail">{wallet.travelFail} ✗</span>
                            </div>
                        </div>
                        <div className="wallet-last-activity">
                            <span className="time">{formatTime(wallet.lastActivity)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
