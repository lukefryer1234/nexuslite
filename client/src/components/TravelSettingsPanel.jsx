import React, { useState, useEffect, useCallback } from 'react';
import API_BASE from '../config/api';
import './TravelSettingsPanel.css';

// City options - only base cities (0-5) where nick car works
// Extended cities (6-29) don't support nick car action
const CITIES = [
    { id: 0, name: 'New York' },
    { id: 1, name: 'Chicago' },
    { id: 2, name: 'Las Vegas' },
    { id: 3, name: 'Detroit' },
    { id: 4, name: 'Los Angeles' },
    { id: 5, name: 'Miami' }
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
    const [saved, setSaved] = useState(false); // Track save button feedback
    
    // Load wallet addresses from localStorage (updated on login)
    const [walletAddresses, setWalletAddresses] = useState(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('keystoreAddresses') || '{}');
            console.log('[TravelSettings] Initial addresses from localStorage:', stored);
            return stored;
        } catch {
            return {};
        }
    });
    
    // Refresh addresses from localStorage when panel expands or wallets change
    useEffect(() => {
        console.log('[TravelSettings] useEffect triggered, expanded:', expanded, 'wallets:', wallets.length);
        if (expanded || wallets.length > 0) {
            try {
                const stored = JSON.parse(localStorage.getItem('keystoreAddresses') || '{}');
                console.log('[TravelSettings] Loaded addresses:', stored);
                console.log('[TravelSettings] Wallet objects received:', wallets.map(w => ({ name: w.name || w, address: w.address })));
                setWalletAddresses(stored);
            } catch {
                // Ignore
            }
        }
    }, [expanded, wallets.length]);

    // Get wallet names (support both string and object format)
    const getWalletName = (wallet) => typeof wallet === 'string' ? wallet : wallet.name;
    
    // Get wallet address - check state first, then wallet object
    const getWalletAddress = (wallet) => {
        const name = getWalletName(wallet);
        // Check our state first (loaded from localStorage)
        if (walletAddresses[name]) {
            return walletAddresses[name];
        }
        // Check if wallet object has address
        if (typeof wallet === 'object' && wallet.address) {
            return wallet.address;
        }
        return null;
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
            console.log('[TravelSettings] Detecting city and transport for', name, 'address:', address);
            
            // Fetch both city and transport in parallel
            const [cityRes, transportRes] = await Promise.all([
                fetch(`${API_BASE}/api/wallet/city/${address}`),
                fetch(`${API_BASE}/api/wallet/transport/${address}`)
            ]);
            
            const cityData = await cityRes.json();
            const transportData = await transportRes.json();
            
            console.log('[TravelSettings] City detection response:', cityData);
            console.log('[TravelSettings] Transport detection response:', transportData);

            // Check if detection was successful
            const plsDetected = cityData.pls?.success;
            const bnbDetected = cityData.bnb?.success;
            
            if (!plsDetected && !bnbDetected) {
                console.warn('[TravelSettings] No cities detected - player may not be registered', {
                    plsError: cityData.pls?.error,
                    bnbError: cityData.bnb?.error
                });
            } else {
                console.log('[TravelSettings] Cities detected:', {
                    pls: plsDetected ? cityData.pls.cityName : 'N/A',
                    bnb: bnbDetected ? cityData.bnb.cityName : 'N/A'
                });
            }

            // Log transport detection
            console.log('[TravelSettings] Transport detected:', {
                pls: transportData.pls?.success ? {
                    hasTrain: transportData.pls.hasTrain,
                    hasCar: transportData.pls.hasCar,
                    hasAirplane: transportData.pls.hasAirplane,
                    best: TRAVEL_TYPES[transportData.pls.bestTransport]?.name
                } : 'N/A',
                bnb: transportData.bnb?.success ? {
                    hasTrain: transportData.bnb.hasTrain,
                    hasCar: transportData.bnb.hasCar,
                    hasAirplane: transportData.bnb.hasAirplane,
                    best: TRAVEL_TYPES[transportData.bnb.bestTransport]?.name
                } : 'N/A'
            });

            // Update start cities and travel types based on detected data
            setAllSettings(prev => ({
                ...prev,
                [name]: {
                    ...prev[name],
                    pls: {
                        ...(prev[name]?.pls || DEFAULT_WALLET_SETTINGS.pls),
                        startCity: cityData.pls?.success ? cityData.pls.cityId : prev[name]?.pls?.startCity || 0,
                        travelType: transportData.pls?.success ? transportData.pls.bestTransport : prev[name]?.pls?.travelType || 0
                    },
                    bnb: {
                        ...(prev[name]?.bnb || DEFAULT_WALLET_SETTINGS.bnb),
                        startCity: cityData.bnb?.success ? cityData.bnb.cityId : prev[name]?.bnb?.startCity || 0,
                        travelType: transportData.bnb?.success ? transportData.bnb.bestTransport : prev[name]?.bnb?.travelType || 0
                    }
                }
            }));
        } catch (err) {
            console.error('[TravelSettings] Failed to detect city/transport:', err);
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

    // Manual save button for user assurance
    const saveSettings = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
        setSaved(true);
        console.log('[TravelSettings] Settings saved manually:', allSettings);
        // Reset saved state after 2 seconds
        setTimeout(() => setSaved(false), 2000);
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
                            
                            {/* Save button section */}
                            <div className="settings-actions">
                                <button
                                    className={`save-settings-btn ${saved ? 'saved' : ''}`}
                                    onClick={saveSettings}
                                >
                                    {saved ? '✓ Saved!' : '💾 Save Settings'}
                                </button>
                                <span className="auto-save-note">
                                    (Settings auto-save on change)
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// Export constants for use in other components
export { CITIES, TRAVEL_TYPES, DEFAULT_WALLET_SETTINGS };
