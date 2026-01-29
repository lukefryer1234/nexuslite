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
    }
};

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

// Export for use in other modules
router.getRpcUrls = () => {
    const settings = loadSettings();
    return settings.rpcUrls || DEFAULT_SETTINGS.rpcUrls;
};

module.exports = router;
