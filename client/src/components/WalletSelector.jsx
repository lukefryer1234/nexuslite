import React, { useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import './WalletSelector.css';

/**
 * WalletSelector - Compact, reusable wallet selection component
 * 
 * UPDATED: Now selects by wallet NAME (not address) so wallets work before unlocking
 * 
 * Props:
 * @param {Array} wallets - Array of wallet objects {name, address, hasAddress}
 * @param {string} mode - 'single' for dropdown, 'multi' for checkboxes
 * @param {boolean} compact - Inline style for headers (default: true)
 * @param {boolean} showCount - Show "3/5" count badge
 * @param {Object} selectedWallet - Currently selected wallet (single mode)
 * @param {Set} selectedWallets - Set of selected wallet NAMES (multi mode)
 * @param {Function} onSelect - Called with wallet name (single mode)
 * @param {Function} onToggle - Called with wallet NAME (multi mode)
 * @param {Function} onSelectAll - Select all wallets (multi mode)
 * @param {Function} onDeselectAll - Deselect all (multi mode)
 * @param {boolean} loading - Show loading state
 */
export default function WalletSelector({
    wallets = [],
    mode = 'multi',
    compact = true,
    showCount = true,
    selectedWallet = null,
    selectedWallets = new Set(),
    onSelect = () => { },
    onToggle = () => { },
    onSelectAll = () => { },
    onDeselectAll = () => { },
    loading = false
}) {
    const [expanded, setExpanded] = usePersistentState('nexus_wallet_selector_expanded', false);

    const selectedCount = mode === 'multi' ? selectedWallets.size : (selectedWallet ? 1 : 0);
    const totalCount = wallets.length;

    // Single select dropdown mode
    if (mode === 'single') {
        return (
            <div className={`wallet-selector single ${compact ? 'compact' : ''}`}>
                <select
                    className="wallet-dropdown"
                    value={selectedWallet?.name || ''}
                    onChange={(e) => onSelect(e.target.value)}
                    disabled={loading}
                >
                    <option value="">All Wallets</option>
                    {wallets.map(w => (
                        <option key={w.name} value={w.name}>
                            {w.name} {!w.hasAddress ? '(🔒)' : ''}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    // Multi-select mode
    return (
        <div className={`wallet-selector multi ${compact ? 'compact' : ''} ${expanded ? 'expanded' : ''}`}>
            {/* Header toggle button */}
            <button
                className="wallet-toggle-btn"
                onClick={() => setExpanded(!expanded)}
                disabled={loading}
            >
                <span className="wallet-icon">👛</span>
                {showCount && (
                    <span className="wallet-count">
                        {selectedCount}/{totalCount}
                    </span>
                )}
                <span className="toggle-arrow">{expanded ? '▲' : '▼'}</span>
            </button>

            {/* Expanded selector panel */}
            {expanded && (
                <div className="wallet-panel">
                    <div className="wallet-actions">
                        <button onClick={onSelectAll} className="action-btn">All</button>
                        <button onClick={onDeselectAll} className="action-btn">None</button>
                    </div>

                    {wallets.length === 0 && (
                        <div className="wallet-warning">
                            No wallets found. Add keystores in Dashboard.
                        </div>
                    )}

                    <div className="wallet-list">
                        {wallets.map(w => (
                            <label
                                key={w.name}
                                className={`wallet-item ${selectedWallets.has(w.name) ? 'selected' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedWallets.has(w.name)}
                                    onChange={() => onToggle(w.name)}
                                />
                                <span className="wallet-name">
                                    {w.name}
                                    {!w.hasAddress && <span className="lock-icon"> 🔒</span>}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
