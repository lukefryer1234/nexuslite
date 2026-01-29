/**
 * Keystore Routes - Foundry keystore management with global password
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const globalPasswordManager = require('../config/GlobalPasswordManager');
const Logger = require('../config/Logger');
const logger = new Logger('Keystore');

// ===== GLOBAL PASSWORD MANAGEMENT =====

// Get status
router.get('/status', (req, res) => {
    res.json(globalPasswordManager.getStatus());
});

// Unlock all keystores with global password
router.post('/unlock-all', async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ success: false, error: 'Password required' });
    }

    try {
        const result = await globalPasswordManager.unlockAll(password);
        logger.info('Global password unlocked', { walletCount: result.unlockedCount });
        res.json(result);
    } catch (err) {
        logger.error('Failed to unlock', { error: err.message });
        res.status(401).json({ success: false, error: err.message });
    }
});

// Lock all - clear passwords from memory
router.post('/lock-all', (req, res) => {
    globalPasswordManager.lockAll();
    logger.info('Locked - passwords cleared from memory');
    res.json({ success: true });
});

// Set or change global password
router.post('/set-password', async (req, res) => {
    const { newPassword, oldPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ success: false, error: 'New password required' });
    }

    try {
        await globalPasswordManager.setGlobalPassword(newPassword, oldPassword);
        logger.info('Global password updated');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ===== KEYSTORE LISTING =====

// List all Foundry keystores with stored password status
router.get('/list', async (req, res) => {
    try {
        const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
        const { stdout } = await execAsync(`${foundryBin}/cast wallet list`);
        // Strip " (Local)" suffix that cast wallet list adds
        const keystoreNames = stdout.trim().split('\n')
            .filter(k => k.length > 0)
            .map(k => k.replace(/ \(Local\)$/, ''));

        const storedWallets = globalPasswordManager.getStoredWallets();
        const isUnlocked = globalPasswordManager.isUnlocked;

        const wallets = keystoreNames.map(name => ({
            name,
            hasStoredPassword: storedWallets.includes(name),
            passwordAvailable: isUnlocked && storedWallets.includes(name)
        }));

        res.json({ 
            success: true, 
            wallets,
            isUnlocked,
            storedCount: storedWallets.length
        });
    } catch (err) {
        logger.error('Failed to list keystores', { error: err.message });
        res.json({ success: false, error: err.message, wallets: [] });
    }
});

// ===== WALLET OPERATIONS =====

// Import existing keystore password into global storage
router.post('/import-password', async (req, res) => {
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).json({ success: false, error: 'Name and password required' });
    }

    try {
        await globalPasswordManager.importKeystorePassword(name, password);
        logger.info('Imported keystore password', { name });
        res.json({ success: true, name });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Create new Foundry keystore from private key
router.post('/create', async (req, res) => {
    const { name, privateKey, password } = req.body;

    if (!name || !privateKey) {
        return res.status(400).json({ success: false, error: 'Name and privateKey required' });
    }

    // Use global password if no specific password provided
    const walletPassword = password || globalPasswordManager.masterPassword;
    if (!walletPassword) {
        return res.status(400).json({ success: false, error: 'Password required (unlock global password first)' });
    }

    try {
        const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
        
        // Clean the private key (add 0x prefix if not present)
        const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        
        // Create keystore using cast wallet import with --private-key
        await execAsync(
            `${foundryBin}/cast wallet import "${name}" --private-key "${cleanKey}" --unsafe-password "${walletPassword}"`,
            { timeout: 30000 }
        );
        
        // Get the address of the new wallet
        const { stdout: addrOut } = await execAsync(
            `${foundryBin}/cast wallet address --account "${name}" --password "${walletPassword}"`
        );
        const address = addrOut.trim();
        
        logger.info('Created new wallet', { name, address });
        res.json({ success: true, name, address });
    } catch (err) {
        logger.error('Failed to create wallet', { error: err.message });
        res.status(400).json({ success: false, error: err.message });
    }
});

// Add new wallet with private key (alias for /create)
router.post('/add', async (req, res) => {
    const { name, privateKey, password } = req.body;

    if (!name || !privateKey) {
        return res.status(400).json({ success: false, error: 'Name and privateKey required' });
    }

    try {
        const result = await globalPasswordManager.addWallet(name, privateKey, password);
        logger.info('Added new wallet', { name, address: result.address });
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Delete a keystore wallet
router.delete('/delete/:name', async (req, res) => {
    const { name } = req.params;
    const fs = require('fs');
    const path = require('path');

    if (!name) {
        return res.status(400).json({ success: false, error: 'Wallet name required' });
    }

    try {
        const keystorePath = process.env.KEYSTORE_PATH || process.env.HOME + '/.foundry/keystores';
        const walletPath = path.join(keystorePath, name);

        // Check if file exists
        if (!fs.existsSync(walletPath)) {
            return res.status(404).json({ success: false, error: `Wallet "${name}" not found` });
        }

        // Delete the keystore file
        fs.unlinkSync(walletPath);
        
        // Also remove from password manager if stored
        try {
            await globalPasswordManager.removeWallet(name);
        } catch (e) { /* ignore if not in password manager */ }

        logger.info('Deleted wallet', { name });
        res.json({ success: true, name });
    } catch (err) {
        logger.error('Failed to delete wallet', { error: err.message });
        res.status(400).json({ success: false, error: err.message });
    }
});


// Get all wallet addresses at once (for auto-loading)
router.get('/addresses', async (req, res) => {
    if (!globalPasswordManager.isUnlocked) {
        return res.status(401).json({ success: false, error: 'Global password not unlocked' });
    }

    const storedWallets = globalPasswordManager.getStoredWallets();
    const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
    const addresses = {};

    for (const name of storedWallets) {
        const password = globalPasswordManager.getWalletPassword(name);
        if (password) {
            try {
                const { stdout } = await execAsync(
                    `${foundryBin}/cast wallet address --account "${name}" --password "${password}"`,
                    { timeout: 10000 }
                );
                addresses[name] = stdout.trim();
            } catch (err) {
                logger.warn('Failed to get address', { name, error: err.message });
            }
        }
    }

    res.json({ success: true, addresses });
});

// Get wallet address
router.get('/address/:name', async (req, res) => {
    const { name } = req.params;
    
    if (!globalPasswordManager.isUnlocked) {
        return res.status(401).json({ success: false, error: 'Global password not unlocked' });
    }

    const password = globalPasswordManager.getWalletPassword(name);
    if (!password) {
        return res.status(400).json({ success: false, error: 'Password not stored for this wallet' });
    }

    try {
        const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
        const { stdout } = await execAsync(
            `${foundryBin}/cast wallet address --account "${name}" --password "${password}"`
        );
        const address = stdout.trim();
        res.json({ success: true, address });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Failed to get address' });
    }
});

// Remove wallet password from storage (doesn't delete keystore)
router.delete('/remove/:name', async (req, res) => {
    const { name } = req.params;

    try {
        await globalPasswordManager.removeWallet(name);
        logger.info('Removed wallet password', { name });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Test wallet connection (get balances)
router.post('/test/:name', async (req, res) => {
    const { name } = req.params;

    if (!globalPasswordManager.isUnlocked) {
        return res.status(401).json({ success: false, error: 'Global password not unlocked' });
    }

    const password = globalPasswordManager.getWalletPassword(name);
    if (!password) {
        return res.status(400).json({ success: false, error: 'Password not stored for this wallet' });
    }

    const results = {
        wallet: name,
        address: null,
        pulsechain: { success: false, balance: null },
        bnb: { success: false, balance: null }
    };

    try {
        const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
        
        // Get address
        const { stdout: addressOut } = await execAsync(
            `${foundryBin}/cast wallet address --account "${name}" --password "${password}"`
        );
        results.address = addressOut.trim();

        // Check PulseChain balance
        try {
            const { stdout: plsBalance } = await execAsync(
                `${foundryBin}/cast balance ${results.address} --rpc-url https://rpc.pulsechain.com`
            );
            const plsWei = plsBalance.trim();
            const plsEth = (BigInt(plsWei) / BigInt(10 ** 18)).toString();
            results.pulsechain = { success: true, balance: `${plsEth} PLS`, raw: plsWei };
        } catch (plsError) {
            results.pulsechain = { success: false, error: 'RPC error' };
        }

        // Check BNB balance
        try {
            const { stdout: bnbBalance } = await execAsync(
                `${foundryBin}/cast balance ${results.address} --rpc-url https://bsc-dataseed.binance.org`
            );
            const bnbWei = bnbBalance.trim();
            const bnbEth = (BigInt(bnbWei) / BigInt(10 ** 18)).toString();
            results.bnb = { success: true, balance: `${bnbEth} BNB`, raw: bnbWei };
        } catch (bnbError) {
            results.bnb = { success: false, error: 'RPC error' };
        }

        res.json({ success: true, results });
    } catch (err) {
        res.json({ success: false, error: 'Invalid password or keystore not found' });
    }
});

module.exports = router;
