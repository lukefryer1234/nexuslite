import React, { useState, useEffect, useCallback } from 'react';
import API_BASE from '../config/api';
import './TravelSettingsPanel.css';

// City options (based on game cities)
const CITIES = [
    { id: 0, name: 'Chicago' },
    { id: 1, name: 'Detroit' },
    { id: 2, name: 'New York' },
    { id: 3, name: 'Las Vegas' },
    { id: 4, name: 'Philadelphia' },
    { id: 5, name: 'Baltimore' },
    { id: 6, name: 'Palermo' },
    { id: 7, name: 'Naples' }
];

// Travel types (vehicles)
const TRAVEL_TYPES = [
    { id: 0, name: 'Train', icon: '🚂', duration: '4h' },
    { id: 1, name: 'Car', icon: '🚗', duration: '2h' },
    { id: 2, name: 'Airplane', icon: '✈️', duration: '1h' }
];

const DEFAULT_WALLET_SETTINGS = {
    pls: { startCity: 0, endCity: 2, travelType: 2 },
    bnb: { startCity: 0, endCity: 2, travelType: 2 }
};

const STORAGE_KEY = 'travelSettings_perWallet';

/**
 * TravelSettingsPanel - Per-wallet travel configuration
 * 
 * @param {Object} props
 * @param {Object[]} props.wallets - Array of wallet objects {name, address} or wallet names
 * @param {function} props.onSettingsChange - Callback when any setting changes
 */
export default function TravelSettingsPanel({ wallets = [], onSettingsChange }) {
    // Settings keyed by wallet name: { walletName: { pls: {...}, bnb: {...} } }
    const [allSettings, setAllSettings] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [expanded, setExpanded] = useState(false);
    const [detecting, setDetecting] = useState({}); // Track which wallets are detecting

    // Get wallet names (support both string and object format)
    const getWalletName = (wallet) => typeof wallet === 'string' ? wallet : wallet.name;
    
    // Get wallet address - check localStorage if not provided
    const getWalletAddress = (wallet) => {
        if (typeof wallet === 'object' && wallet.address) {
            return wallet.address;
        }
        // Try to get from localStorage
        const name = getWalletName(wallet);
        try {
            const storedAddresses = JSON.parse(localStorage.getItem('keystoreAddresses') || '{}');
            return storedAddresses[name] || null;
        } catch {
            return null;
        }
    };

    // Ensure all wallets have settings
    useEffect(() => {
        if (wallets.length === 0) return;
        
        setAllSettings(prev => {
            const updated = { ...prev };
            let changed = false;
            
            for (const wallet of wallets) {
                const name = getWalletName(wallet);
                if (!updated[name]) {
                    updated[name] = { ...DEFAULT_WALLET_SETTINGS };
                    changed = true;
                }
            }
            
            if (changed) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            }
            
            return updated;
        });
    }, [wallets]);

    // Save to localStorage whenever settings change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
    }, [allSettings]);

    const updateSetting = useCallback((wallet, chain, field, value) => {
        const name = getWalletName(wallet);
        setAllSettings(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                [chain]: {
                    ...(prev[name]?.[chain] || DEFAULT_WALLET_SETTINGS[chain]),
                    [field]: parseInt(value)
                }
            }
        }));
    }, []);

    const getWalletSettings = useCallback((wallet, chain) => {
        const name = getWalletName(wallet);
        return allSettings[name]?.[chain] || DEFAULT_WALLET_SETTINGS[chain];
    }, [allSettings]);

    // Expose getter for parent components
    useEffect(() => {
        if (onSettingsChange) {
            onSettingsChange(allSettings, getWalletSettings);
        }
    }, [allSettings, onSettingsChange, getWalletSettings]);

    // Auto-detect player's current city
    const detectCity = async (wallet) => {
        const name = getWalletName(wallet);
        const address = getWalletAddress(wallet);
        
        if (!address) {
            console.warn('Cannot detect city: no address for wallet', name);
            return;
        }

        setDetecting(prev => ({ ...prev, [name]: true }));

        try {
            const res = await fetch(`${API_BASE}/api/wallet/city/${address}`);
            const data = await res.json();

            // Update start cities based on detected location
            setAllSettings(prev => ({
                ...prev,
                [name]: {
                    ...prev[name],
                    pls: {
                        ...(prev[name]?.pls || DEFAULT_WALLET_SETTINGS.pls),
                        startCity: data.pls?.success ? data.pls.cityId : prev[name]?.pls?.startCity || 0
                    },
                    bnb: {
                        ...(prev[name]?.bnb || DEFAULT_WALLET_SETTINGS.bnb),
                        startCity: data.bnb?.success ? data.bnb.cityId : prev[name]?.bnb?.startCity || 0
                    }
                }
            }));
        } catch (err) {
            console.error('Failed to detect city:', err);
        } finally {
            setDetecting(prev => ({ ...prev, [name]: false }));
        }
    };

    // Detect all cities
    const detectAllCities = async () => {
        for (const wallet of wallets) {
            if (getWalletAddress(wallet)) {
                await detectCity(wallet);
            }
        }
    };

    const renderWalletRow = (wallet) => {
        const name = getWalletName(wallet);
        const address = getWalletAddress(wallet);
        const plsSettings = getWalletSettings(wallet, 'pls');
        const bnbSettings = getWalletSettings(wallet, 'bnb');
        const isDetecting = detecting[name];

        return (
            <div key={name} className="wallet-travel-row">
                <div className="wallet-name">
                    {name}
                    <button
                        className={`detect-btn-large ${isDetecting ? 'detecting' : ''}`}
                        onClick={() => detectCity(wallet)}
                        disabled={isDetecting || !address}
                        title={address ? "Auto-detect current city from blockchain" : "No address found - check Foundry Wallets"}
                    >
                        {isDetecting ? '⏳ Detecting...' : '🔍 Detect'}
                    </button>
                </div>
                
                {/* PulseChain settings */}
                <div className="chain-settings-compact pls">
                    <span className="chain-badge">💜</span>
                    <select
                        value={plsSettings.startCity}
                        onChange={(e) => updateSetting(wallet, 'pls', 'startCity', e.target.value)}
                        title="Start City (PLS)"
                    >
                        {CITIES.map(city => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                        ))}
                    </select>
                    <span className="arrow">↔</span>
                    <select
                        value={plsSettings.endCity}
                        onChange={(e) => updateSetting(wallet, 'pls', 'endCity', e.target.value)}
                        title="Destination (PLS)"
                    >
                        {CITIES.map(city => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                        ))}
                    </select>
                    <select
                        value={plsSettings.travelType}
                        onChange={(e) => updateSetting(wallet, 'pls', 'travelType', e.target.value)}
                        title="Vehicle (PLS)"
                        className="vehicle-select"
                    >
                        {TRAVEL_TYPES.map(type => (
                            <option key={type.id} value={type.id}>
                                {type.icon} {type.name} - {type.duration}
                            </option>
                        ))}
                    </select>
                </div>

                {/* BNB Chain settings */}
                <div className="chain-settings-compact bnb">
                    <span className="chain-badge">💛</span>
                    <select
                        value={bnbSettings.startCity}
                        onChange={(e) => updateSetting(wallet, 'bnb', 'startCity', e.target.value)}
                        title="Start City (BNB)"
                    >
                        {CITIES.map(city => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                        ))}
                    </select>
                    <span className="arrow">↔</span>
                    <select
                        value={bnbSettings.endCity}
                        onChange={(e) => updateSetting(wallet, 'bnb', 'endCity', e.target.value)}
                        title="Destination (BNB)"
                    >
                        {CITIES.map(city => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                        ))}
                    </select>
                    <select
                        value={bnbSettings.travelType}
                        onChange={(e) => updateSetting(wallet, 'bnb', 'travelType', e.target.value)}
                        title="Vehicle (BNB)"
                        className="vehicle-select"
                    >
                        {TRAVEL_TYPES.map(type => (
                            <option key={type.id} value={type.id}>
                                {type.icon} {type.name} - {type.duration}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        );
    };

    return (
        <div className="travel-settings-panel">
            <div 
                className="panel-header" 
                onClick={() => setExpanded(!expanded)}
            >
                <h3>✈️ Travel Settings</h3>
                <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
            </div>
            
            {expanded && (
                <div className="settings-content">
                    {wallets.length === 0 ? (
                        <div className="no-wallets">Select wallets above to configure travel settings</div>
                    ) : (
                        <>
                            <div className="settings-header-row">
                                <div className="col-wallet">
                                    Wallet
                                    <button 
                                        className="detect-all-btn"
                                        onClick={detectAllCities}
                                        title="Auto-detect all cities"
                                    >
                                        🔍 All
                                    </button>
                                </div>
                                <div className="col-chain">💜 PulseChain Route</div>
                                <div className="col-chain">💛 BNB Chain Route</div>
                            </div>
                            {wallets.map(wallet => renderWalletRow(wallet))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// Export constants for use in other components
export { CITIES, TRAVEL_TYPES, DEFAULT_WALLET_SETTINGS };
