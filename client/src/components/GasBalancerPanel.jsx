/**
 * GasBalancerPanel - Panel for gas balance management
 * 
 * Shows gas balances and allows manual/automatic balancing
 * between wallets on PLS and BNB chains.
 */

import React, { useState, useEffect, useCallback } from 'react';
import './GasBalancerPanel.css';

// Default thresholds
const DEFAULT_THRESHOLDS = {
    pls: { min: 1000, target: 5000 },
    bnb: { min: 0.005, target: 0.01 }
};

// Simple toast replacement (logs to console, could be upgraded later)
const useToast = () => ({
    success: (msg) => console.log('✅', msg),
    error: (msg) => console.error('❌', msg),
    info: (msg) => console.log('ℹ️', msg)
});

export default function GasBalancerPanel({ wallets = [] }) {
    const toast = useToast();
    const [expanded, setExpanded] = useState(false);
    const [balances, setBalances] = useState({ pls: [], bnb: [] });
    const [loading, setLoading] = useState(false);
    const [balancing, setBalancing] = useState({ pls: false, bnb: false });
    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const [editingThresholds, setEditingThresholds] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [message, setMessage] = useState(null); // For inline status messages

    // Load thresholds from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('gas_balancer_thresholds');
        if (saved) {
            try {
                setThresholds(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved thresholds');
            }
        }
    }, []);

    // Fetch balances
    const fetchBalances = useCallback(async () => {
        if (wallets.length === 0) return;
        
        setLoading(true);
        try {
            // Fetch PLS balances
            const plsRes = await fetch('/api/gas-balance/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallets, chain: 'pulsechain' })
            });
            const plsData = await plsRes.json();
            
            // Fetch BNB balances
            const bnbRes = await fetch('/api/gas-balance/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallets, chain: 'bnb' })
            });
            const bnbData = await bnbRes.json();
            
            setBalances({
                pls: plsData.success ? plsData.balances : [],
                bnb: bnbData.success ? bnbData.balances : []
            });
        } catch (err) {
            console.error('Failed to fetch balances:', err);
        } finally {
            setLoading(false);
        }
    }, [wallets]);

    useEffect(() => {
        if (expanded) {
            fetchBalances();
        }
    }, [expanded, fetchBalances]);

    // Save thresholds to backend and localStorage
    const saveThresholds = async () => {
        setSavingConfig(true);
        try {
            // Save to localStorage for persistence
            localStorage.setItem('gas_balancer_thresholds', JSON.stringify(thresholds));
            
            // Update backend config
            await fetch('/api/gas-balance/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    minBalance: thresholds.pls.min,
                    targetBalance: thresholds.pls.target
                })
            });
            
            toast.success('Thresholds saved!');
            setEditingThresholds(false);
        } catch (err) {
            toast.error('Failed to save thresholds');
        } finally {
            setSavingConfig(false);
        }
    };

    // Auto-balance chain
    const handleBalance = async (chain) => {
        const chainKey = chain === 'pulsechain' ? 'pls' : 'bnb';
        setBalancing(prev => ({ ...prev, [chainKey]: true }));
        
        try {
            toast.info(`Checking ${chainKey.toUpperCase()} balances...`);
            const res = await fetch('/api/gas-balance/auto-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallets, chain })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.transfers?.length > 0) {
                    toast.success(`Transferred ${chainKey.toUpperCase()} to ${data.transfers.length} wallet(s)`);
                } else {
                    toast.info(`All ${chainKey.toUpperCase()} balances OK`);
                }
                fetchBalances(); // Refresh balances
            } else {
                toast.error(data.error || `${chainKey.toUpperCase()} balance check failed`);
            }
        } catch (err) {
            toast.error('Network error');
        } finally {
            setBalancing(prev => ({ ...prev, [chainKey]: false }));
        }
    };

    // Format balance for display
    const formatBalance = (balance, chain) => {
        if (balance === undefined || balance === null) return '...';
        if (chain === 'pls') {
            if (balance >= 1000) return balance.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return balance.toFixed(2);
        }
        return balance.toFixed(4);
    };

    // Get low balance wallets using current thresholds
    const lowBalanceCount = {
        pls: balances.pls.filter(b => b.balance < thresholds.pls.min).length,
        bnb: balances.bnb.filter(b => b.balance < thresholds.bnb.min).length
    };

    const hasLowBalance = lowBalanceCount.pls > 0 || lowBalanceCount.bnb > 0;

    return (
        <div className={`gas-balancer-panel ${expanded ? 'expanded' : ''} ${hasLowBalance ? 'warning' : ''}`}>
            {/* Main Row */}
            <div className="panel-main" onClick={() => setExpanded(!expanded)}>
                <div className="panel-info">
                    <span className="panel-icon">⛽</span>
                    <div className="panel-text-container">
                        <span className="panel-label">Gas Balancer</span>
                        <span className="panel-status">
                            {hasLowBalance 
                                ? `⚠️ ${lowBalanceCount.pls + lowBalanceCount.bnb} wallets low` 
                                : wallets.length > 0 
                                    ? `${wallets.length} wallets monitored`
                                    : 'Select wallets above'
                            }
                        </span>
                    </div>
                </div>
                
                <div className="panel-badges">
                    <span className="badge pls">💜 PLS</span>
                    <span className="badge bnb">💛 BNB</span>
                    <button 
                        className="refresh-btn"
                        onClick={(e) => { e.stopPropagation(); fetchBalances(); }}
                        disabled={loading}
                        title="Refresh balances"
                    >
                        {loading ? '⏳' : '🔄'}
                    </button>
                </div>
                
                <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="panel-details">
                    {/* Thresholds Config */}
                    <div className="thresholds-section">
                        <div className="thresholds-header">
                            <span className="section-label">⚙️ Thresholds</span>
                            {!editingThresholds ? (
                                <button 
                                    className="edit-btn"
                                    onClick={() => setEditingThresholds(true)}
                                >
                                    ✏️ Edit
                                </button>
                            ) : (
                                <div className="edit-actions">
                                    <button 
                                        className="save-btn"
                                        onClick={saveThresholds}
                                        disabled={savingConfig}
                                    >
                                        {savingConfig ? '⏳' : '💾'} Save
                                    </button>
                                    <button 
                                        className="cancel-btn"
                                        onClick={() => setEditingThresholds(false)}
                                    >
                                        ✖️
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="thresholds-grid">
                            {/* PLS Thresholds */}
                            <div className="threshold-card pls">
                                <span className="chain-label">💜 PLS</span>
                                <div className="threshold-inputs">
                                    <div className="input-group">
                                        <label>Min</label>
                                        {editingThresholds ? (
                                            <input
                                                type="number"
                                                value={thresholds.pls.min}
                                                onChange={(e) => setThresholds(prev => ({
                                                    ...prev,
                                                    pls: { ...prev.pls, min: parseFloat(e.target.value) || 0 }
                                                }))}
                                            />
                                        ) : (
                                            <span className="value">{thresholds.pls.min.toLocaleString()}</span>
                                        )}
                                    </div>
                                    <div className="input-group">
                                        <label>Target</label>
                                        {editingThresholds ? (
                                            <input
                                                type="number"
                                                value={thresholds.pls.target}
                                                onChange={(e) => setThresholds(prev => ({
                                                    ...prev,
                                                    pls: { ...prev.pls, target: parseFloat(e.target.value) || 0 }
                                                }))}
                                            />
                                        ) : (
                                            <span className="value">{thresholds.pls.target.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* BNB Thresholds */}
                            <div className="threshold-card bnb">
                                <span className="chain-label">💛 BNB</span>
                                <div className="threshold-inputs">
                                    <div className="input-group">
                                        <label>Min</label>
                                        {editingThresholds ? (
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={thresholds.bnb.min}
                                                onChange={(e) => setThresholds(prev => ({
                                                    ...prev,
                                                    bnb: { ...prev.bnb, min: parseFloat(e.target.value) || 0 }
                                                }))}
                                            />
                                        ) : (
                                            <span className="value">{thresholds.bnb.min}</span>
                                        )}
                                    </div>
                                    <div className="input-group">
                                        <label>Target</label>
                                        {editingThresholds ? (
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={thresholds.bnb.target}
                                                onChange={(e) => setThresholds(prev => ({
                                                    ...prev,
                                                    bnb: { ...prev.bnb, target: parseFloat(e.target.value) || 0 }
                                                }))}
                                            />
                                        ) : (
                                            <span className="value">{thresholds.bnb.target}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Balance List */}
                    {wallets.length > 0 && (
                        <div className="balance-grid">
                            <div className="balance-header">
                                <span>Wallet</span>
                                <span>PLS</span>
                                <span>BNB</span>
                            </div>
                            {wallets.map(wallet => {
                                const plsBal = balances.pls.find(b => b.wallet === wallet);
                                const bnbBal = balances.bnb.find(b => b.wallet === wallet);
                                const plsLow = plsBal && plsBal.balance < thresholds.pls.min;
                                const bnbLow = bnbBal && bnbBal.balance < thresholds.bnb.min;
                                
                                return (
                                    <div key={wallet} className="balance-row">
                                        <span className="wallet-name">{wallet}</span>
                                        <span className={`balance pls ${plsLow ? 'low' : ''}`}>
                                            {loading ? '...' : formatBalance(plsBal?.balance, 'pls')}
                                        </span>
                                        <span className={`balance bnb ${bnbLow ? 'low' : ''}`}>
                                            {loading ? '...' : formatBalance(bnbBal?.balance, 'bnb')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="panel-actions">
                        <button 
                            className="action-btn refresh"
                            onClick={fetchBalances}
                            disabled={loading || wallets.length === 0}
                        >
                            {loading ? '⏳' : '🔄'} Refresh
                        </button>
                        <button 
                            className="action-btn pls"
                            onClick={() => handleBalance('pulsechain')}
                            disabled={balancing.pls || wallets.length === 0}
                        >
                            {balancing.pls ? '⏳' : '💜'} Balance PLS
                        </button>
                        <button 
                            className="action-btn bnb"
                            onClick={() => handleBalance('bnb')}
                            disabled={balancing.bnb || wallets.length === 0}
                        >
                            {balancing.bnb ? '⏳' : '💛'} Balance BNB
                        </button>
                    </div>

                    {wallets.length === 0 && (
                        <div className="warning-message">
                            ⚠️ Select wallets above to use gas balancer
                        </div>
                    )}

                    <div className="info-note">
                        ℹ️ Transfers from main wallet when balance drops below minimum
                    </div>
                </div>
            )}
        </div>
    );
}
