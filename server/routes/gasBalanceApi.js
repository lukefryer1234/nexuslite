/**
 * Gas Balance API Routes
 * 
 * Endpoints for managing automatic gas balance transfers:
 * - GET /api/gas-balance/status - Get current status
 * - POST /api/gas-balance/check - Check and balance wallets
 * - POST /api/gas-balance/transfer - Manual transfer
 * - POST /api/gas-balance/config - Update configuration
 */

const express = require('express');
const router = express.Router();
const gasBalanceManager = require('../services/GasBalanceManager');
const globalPasswordManager = require('../config/GlobalPasswordManager');

// Middleware to sync password from global password manager
function syncPassword() {
    const password = globalPasswordManager.masterPassword;
    if (password) {
        gasBalanceManager.setGlobalPassword(password);
    }
}

/**
 * GET /api/gas-balance/status
 * Get current gas balance status and configuration
 */
router.get('/status', async (req, res) => {
    try {
        const status = gasBalanceManager.getStatus();
        res.json({ success: true, ...status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/enable
 * Enable the gas balancer
 */
router.post('/enable', (req, res) => {
    try {
        syncPassword();
        const result = gasBalanceManager.enable();
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/disable
 * Disable the gas balancer
 */
router.post('/disable', (req, res) => {
    try {
        const result = gasBalanceManager.disable();
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/check
 * Check all wallet balances
 * Body: { wallets: string[], chain?: string }
 */
router.post('/check', async (req, res) => {
    syncPassword(); // Sync password from global manager
    try {
        const { wallets, chain = 'pulsechain' } = req.body;
        
        if (!wallets || !Array.isArray(wallets)) {
            return res.status(400).json({ success: false, error: 'wallets array required' });
        }

        const balances = [];
        for (const wallet of wallets) {
            try {
                const address = await gasBalanceManager.getWalletAddress(wallet);
                const balance = await gasBalanceManager.getBalance(address, chain);
                balances.push({ wallet, address, balance });
            } catch (err) {
                balances.push({ wallet, error: err.message });
            }
        }

        res.json({ success: true, balances, chain });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/auto-balance
 * Check and auto-balance wallets
 * Body: { wallets: string[], chain?: string }
 */
router.post('/auto-balance', async (req, res) => {
    syncPassword(); // Sync password from global manager
    try {
        const { wallets, chain = 'pulsechain' } = req.body;
        
        if (!wallets || !Array.isArray(wallets)) {
            return res.status(400).json({ success: false, error: 'wallets array required' });
        }

        const result = await gasBalanceManager.checkAndBalance(wallets, chain);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/transfer
 * Manual transfer between wallets
 * Body: { fromKeystore: string, toAddress: string, amount: number, chain?: string }
 */
router.post('/transfer', async (req, res) => {
    try {
        const { fromKeystore, toAddress, amount, chain = 'pulsechain' } = req.body;
        
        if (!fromKeystore || !toAddress || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'fromKeystore, toAddress, and amount are required' 
            });
        }

        const result = await gasBalanceManager.transfer(fromKeystore, toAddress, amount, chain);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/config
 * Update configuration
 * Body: { minBalance?: number, targetBalance?: number, maxToTransfer?: number }
 */
router.post('/config', (req, res) => {
    try {
        const { minBalance, targetBalance, maxToTransfer } = req.body;
        const result = gasBalanceManager.updateConfig({ minBalance, targetBalance, maxToTransfer });
        const status = gasBalanceManager.getStatus();
        res.json({ ...result, ...status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/gas-balance/password
 * Set global password for transfers
 * Body: { password: string }
 */
router.post('/password', (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, error: 'password required' });
        }
        gasBalanceManager.setGlobalPassword(password);
        res.json({ success: true, message: 'Password set' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
