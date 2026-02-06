/**
 * Settings Routes - User configuration persistence
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
    rpcUrls: {
        pls: 'https://rpc.pulsechain.com',
        bnb: 'https://bsc-dataseed.binance.org'
    },
    gas: {
        pls: { maxGwei: 50, defaultGwei: 30 },
        bnb: { maxGwei: 5, defaultGwei: 3 }
    }
};

// Track recent gas failures for warning display
let recentGasFailures = [];
const MAX_FAILURES_TRACKED = 10;

// Fetch live gas price from RPC
async function fetchGasPrice(rpcUrl) {
    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_gasPrice',
                params: [],
                id: 1
            }),
            signal: AbortSignal.timeout(5000)
        });
        const data = await response.json();
        if (data.result) {
            // Convert hex wei to gwei
            const weiPrice = parseInt(data.result, 16);
            return weiPrice / 1e9; // Convert to gwei
        }
    } catch (err) {
        console.error(`Failed to fetch gas price from ${rpcUrl}:`, err.message);
    }
    return null;
}

// Check for gas warnings
function checkGasWarnings(config, livePrices) {
    const warnings = [];
    
    // Check if live price exceeds configured max
    if (livePrices.pls && config.pls.maxGwei > 0 && livePrices.pls > config.pls.maxGwei) {
        warnings.push({
            chain: 'pls',
            type: 'exceeds_max',
            message: `PLS gas (${livePrices.pls.toFixed(1)} gwei) exceeds max (${config.pls.maxGwei} gwei)`
        });
    }
    
    if (livePrices.bnb && config.bnb.maxGwei > 0 && livePrices.bnb > config.bnb.maxGwei) {
        warnings.push({
            chain: 'bnb',
            type: 'exceeds_max',
            message: `BNB gas (${livePrices.bnb.toFixed(1)} gwei) exceeds max (${config.bnb.maxGwei} gwei)`
        });
    }
    
    // Check for recent failures
    const recentFailTime = Date.now() - 5 * 60 * 1000; // Last 5 minutes
    const recentFails = recentGasFailures.filter(f => f.time > recentFailTime);
    if (recentFails.length > 0) {
        warnings.push({
            chain: 'all',
            type: 'recent_failures',
            message: `${recentFails.length} transaction(s) failed due to gas in last 5 min`,
            failures: recentFails
        });
    }
    
    return warnings;
}

// Load settings from file
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        }
    } catch (err) {
        console.error('Failed to load settings:', err.message);
    }
    return DEFAULT_SETTINGS;
}

// Save settings to file
function saveSettings(settings) {
    try {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (err) {
        console.error('Failed to save settings:', err.message);
        return false;
    }
}

// Get all settings
router.get('/', (req, res) => {
    res.json(loadSettings());
});

// Update settings
router.post('/', (req, res) => {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...req.body };
    
    if (saveSettings(newSettings)) {
        res.json({ success: true, settings: newSettings });
    } else {
        res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
});

// Get RPC URLs specifically
router.get('/rpc', (req, res) => {
    const settings = loadSettings();
    res.json(settings.rpcUrls || DEFAULT_SETTINGS.rpcUrls);
});

// Update RPC URLs
router.post('/rpc', (req, res) => {
    const { pls, bnb } = req.body;
    const currentSettings = loadSettings();
    
    currentSettings.rpcUrls = {
        pls: pls || currentSettings.rpcUrls?.pls || DEFAULT_SETTINGS.rpcUrls.pls,
        bnb: bnb || currentSettings.rpcUrls?.bnb || DEFAULT_SETTINGS.rpcUrls.bnb
    };
    
    if (saveSettings(currentSettings)) {
        res.json({ success: true, rpcUrls: currentSettings.rpcUrls });
    } else {
        res.status(500).json({ success: false, error: 'Failed to save RPC settings' });
    }
});

// ===== GAS SETTINGS ROUTES =====

// Get gas configuration with live prices
router.get('/gas', async (req, res) => {
    try {
        const settings = loadSettings();
        const gasConfig = settings.gas || DEFAULT_SETTINGS.gas;
        const rpcUrls = settings.rpcUrls || DEFAULT_SETTINGS.rpcUrls;
        
        // Fetch live gas prices in parallel
        const [plsPrice, bnbPrice] = await Promise.all([
            fetchGasPrice(rpcUrls.pls),
            fetchGasPrice(rpcUrls.bnb)
        ]);
        
        const livePrices = {
            pls: plsPrice,
            bnb: bnbPrice
        };
        
        const warnings = checkGasWarnings(gasConfig, livePrices);
        
        res.json({
            success: true,
            config: gasConfig,
            live: livePrices,
            warnings: warnings
        });
    } catch (err) {
        console.error('Error fetching gas settings:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update gas configuration
router.post('/gas', (req, res) => {
    const { pls, bnb } = req.body;
    const currentSettings = loadSettings();
    
    currentSettings.gas = {
        pls: {
            maxGwei: pls?.maxGwei ?? currentSettings.gas?.pls?.maxGwei ?? DEFAULT_SETTINGS.gas.pls.maxGwei,
            defaultGwei: pls?.defaultGwei ?? currentSettings.gas?.pls?.defaultGwei ?? DEFAULT_SETTINGS.gas.pls.defaultGwei
        },
        bnb: {
            maxGwei: bnb?.maxGwei ?? currentSettings.gas?.bnb?.maxGwei ?? DEFAULT_SETTINGS.gas.bnb.maxGwei,
            defaultGwei: bnb?.defaultGwei ?? currentSettings.gas?.bnb?.defaultGwei ?? DEFAULT_SETTINGS.gas.bnb.defaultGwei
        }
    };
    
    if (saveSettings(currentSettings)) {
        res.json({ success: true, gas: currentSettings.gas });
    } else {
        res.status(500).json({ success: false, error: 'Failed to save gas settings' });
    }
});

// Record a gas failure (called from scripts when tx fails)
router.post('/gas/failure', (req, res) => {
    const { chain, wallet, error, txType } = req.body;
    
    recentGasFailures.push({
        chain,
        wallet,
        error,
        txType,
        time: Date.now()
    });
    
    // Keep only the most recent failures
    if (recentGasFailures.length > MAX_FAILURES_TRACKED) {
        recentGasFailures = recentGasFailures.slice(-MAX_FAILURES_TRACKED);
    }
    
    res.json({ success: true, recorded: true });
});

// Clear gas failure warnings
router.post('/gas/clear-warnings', (req, res) => {
    recentGasFailures = [];
    res.json({ success: true, cleared: true });
});

// Export for use in other modules
router.getRpcUrls = () => {
    const settings = loadSettings();
    return settings.rpcUrls || DEFAULT_SETTINGS.rpcUrls;
};

router.getGasConfig = () => {
    const settings = loadSettings();
    return settings.gas || DEFAULT_SETTINGS.gas;
};

module.exports = router;

