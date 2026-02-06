/**
 * GasSettingsDropdown - Compact header dropdown for gas price monitoring and settings
 * 
 * Shows live gas prices with quick-edit for max gas limits and warnings
 */

import { useState, useEffect, useCallback } from 'react';
import './GasSettingsDropdown.css';

export default function GasSettingsDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gasData, setGasData] = useState({
        config: {
            pls: { maxGwei: 50, defaultGwei: 30 },
            bnb: { maxGwei: 5, defaultGwei: 3 }
        },
        live: { pls: null, bnb: null },
        warnings: []
    });
    const [editConfig, setEditConfig] = useState(null);

    // Fetch gas data
    const fetchGasData = useCallback(async () => {
        try {
            const res = await fetch('/api/settings/gas');
            const data = await res.json();
            if (data.success) {
                setGasData(data);
                setEditConfig({
                    pls: { ...data.config.pls },
                    bnb: { ...data.config.bnb }
                });
            }
        } catch (err) {
            console.error('Failed to fetch gas data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGasData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchGasData, 30000);
        return () => clearInterval(interval);
    }, [fetchGasData]);

    // Save settings
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings/gas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editConfig)
            });
            const data = await res.json();
            if (data.success) {
                setGasData(prev => ({ ...prev, config: data.gas }));
                setIsOpen(false);
            }
        } catch (err) {
            console.error('Failed to save gas settings:', err);
        } finally {
            setSaving(false);
        }
    };

    // Clear warnings
    const handleClearWarnings = async () => {
        try {
            await fetch('/api/settings/gas/clear-warnings', { method: 'POST' });
            setGasData(prev => ({ ...prev, warnings: [] }));
        } catch (err) {
            console.error('Failed to clear warnings:', err);
        }
    };

    // Format gas price for display
    const formatGas = (gwei) => {
        if (gwei === null || gwei === undefined) return '...';
        if (gwei < 1) return gwei.toFixed(2);
        return Math.round(gwei).toString();
    };

    const hasWarnings = gasData.warnings.length > 0;
    const plsLive = formatGas(gasData.live.pls);
    const bnbLive = formatGas(gasData.live.bnb);

    return (
        <div className="gas-settings-dropdown">
            {/* Header Button */}
            <button 
                className={`gas-btn ${hasWarnings ? 'warning' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Gas Settings"
            >
                <span className="gas-icon">⛽</span>
                <span className="gas-prices">
                    <span className="pls-price">💜 {plsLive}</span>
                    <span className="bnb-price">💛 {bnbLive}</span>
                </span>
                {hasWarnings && <span className="warning-badge">!</span>}
                <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="gas-dropdown-panel">
                    <div className="panel-header">
                        <h3>⛽ Gas Settings</h3>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
                    </div>

                    {loading ? (
                        <div className="loading">Loading gas data...</div>
                    ) : (
                        <>
                            {/* Warnings Banner */}
                            {hasWarnings && (
                                <div className="warnings-section">
                                    {gasData.warnings.map((w, i) => (
                                        <div key={i} className={`warning-item ${w.type}`}>
                                            ⚠️ {w.message}
                                        </div>
                                    ))}
                                    <button className="clear-btn" onClick={handleClearWarnings}>
                                        Clear Warnings
                                    </button>
                                </div>
                            )}

                            {/* PulseChain Settings */}
                            <div className="chain-section pls">
                                <div className="chain-header">
                                    <span className="chain-label">💜 PulseChain</span>
                                    <span className="live-price">
                                        Live: <strong>{plsLive}</strong> gwei
                                    </span>
                                </div>
                                <div className="settings-row">
                                    <label>
                                        <span>Max Gas:</span>
                                        <input
                                            type="number"
                                            value={editConfig?.pls.maxGwei || ''}
                                            onChange={(e) => setEditConfig(prev => ({
                                                ...prev,
                                                pls: { ...prev.pls, maxGwei: parseInt(e.target.value) || 0 }
                                            }))}
                                        />
                                        <span className="unit">gwei</span>
                                    </label>
                                    <label>
                                        <span>Default:</span>
                                        <input
                                            type="number"
                                            value={editConfig?.pls.defaultGwei || ''}
                                            onChange={(e) => setEditConfig(prev => ({
                                                ...prev,
                                                pls: { ...prev.pls, defaultGwei: parseInt(e.target.value) || 0 }
                                            }))}
                                        />
                                        <span className="unit">gwei</span>
                                    </label>
                                </div>
                            </div>

                            {/* BNB Chain Settings */}
                            <div className="chain-section bnb">
                                <div className="chain-header">
                                    <span className="chain-label">💛 BNB Chain</span>
                                    <span className="live-price">
                                        Live: <strong>{bnbLive}</strong> gwei
                                    </span>
                                </div>
                                <div className="settings-row">
                                    <label>
                                        <span>Max Gas:</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editConfig?.bnb.maxGwei || ''}
                                            onChange={(e) => setEditConfig(prev => ({
                                                ...prev,
                                                bnb: { ...prev.bnb, maxGwei: parseFloat(e.target.value) || 0 }
                                            }))}
                                        />
                                        <span className="unit">gwei</span>
                                    </label>
                                    <label>
                                        <span>Default:</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editConfig?.bnb.defaultGwei || ''}
                                            onChange={(e) => setEditConfig(prev => ({
                                                ...prev,
                                                bnb: { ...prev.bnb, defaultGwei: parseFloat(e.target.value) || 0 }
                                            }))}
                                        />
                                        <span className="unit">gwei</span>
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="panel-actions">
                                <button 
                                    className="refresh-btn" 
                                    onClick={fetchGasData}
                                    disabled={loading}
                                >
                                    🔄 Refresh
                                </button>
                                <button 
                                    className="save-btn" 
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? '⏳' : '💾'} Save
                                </button>
                            </div>

                            <div className="info-note">
                                ℹ️ Transactions will fail if network gas exceeds your max
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
