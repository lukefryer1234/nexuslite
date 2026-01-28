/**
 * Wallet Routes - Balance checking and native coin transfers
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const globalPasswordManager = require('../config/GlobalPasswordManager');
const Logger = require('../config/Logger');
const logger = new Logger('Wallet');

// RPC URLs for each chain
const RPC_URLS = {
    pls: 'https://rpc.pulsechain.com',
    bnb: 'https://bsc-dataseed.binance.org'
};

// Get balance for an address on both chains
router.get('/balance/:address', async (req, res) => {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x')) {
        return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
    const results = {
        pulsechain: { success: false, balance: '0', raw: '0' },
        bnb: { success: false, balance: '0', raw: '0' }
    };

    // Fetch PulseChain balance
    try {
        const { stdout } = await execAsync(
            `${foundryBin}/cast balance ${address} --rpc-url ${RPC_URLS.pls}`,
            { timeout: 10000 }
        );
        const raw = stdout.trim();
        const wei = BigInt(raw);
        const whole = wei / BigInt(10 ** 18);
        const frac = (wei % BigInt(10 ** 18)).toString().padStart(18, '0').slice(0, 4);
        results.pulsechain = {
            success: true,
            balance: `${whole}.${frac} PLS`,
            raw
        };
    } catch (err) {
        results.pulsechain = { success: false, error: 'RPC error', balance: '0', raw: '0' };
    }

    // Fetch BNB balance
    try {
        const { stdout } = await execAsync(
            `${foundryBin}/cast balance ${address} --rpc-url ${RPC_URLS.bnb}`,
            { timeout: 10000 }
        );
        const raw = stdout.trim();
        const wei = BigInt(raw);
        const whole = wei / BigInt(10 ** 18);
        const frac = (wei % BigInt(10 ** 18)).toString().padStart(18, '0').slice(0, 4);
        results.bnb = {
            success: true,
            balance: `${whole}.${frac} BNB`,
            raw
        };
    } catch (err) {
        results.bnb = { success: false, error: 'RPC error', balance: '0', raw: '0' };
    }

    res.json(results);
});

// Transfer native coins from one wallet to another
router.post('/transfer', async (req, res) => {
    const { fromWallet, toAddress, chain, amount } = req.body;

    if (!fromWallet || !toAddress || !chain || !amount) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: fromWallet, toAddress, chain, amount' 
        });
    }

    if (!['pls', 'bnb'].includes(chain)) {
        return res.status(400).json({ success: false, error: 'Invalid chain. Use pls or bnb' });
    }

    if (!globalPasswordManager.isUnlocked) {
        return res.status(401).json({ success: false, error: 'Global password not unlocked' });
    }

    const password = globalPasswordManager.getWalletPassword(fromWallet);
    if (!password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Password not stored for this wallet. Please test/unlock the wallet first.' 
        });
    }

    const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
    const rpcUrl = RPC_URLS[chain];

    try {
        // Convert amount to wei (amount is in ether)
        const amountFloat = parseFloat(amount);
        if (isNaN(amountFloat) || amountFloat <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        // Use cast to send the transaction
        // cast send <TO> --value <AMOUNT>ether --account <WALLET> --password <PASSWORD> --rpc-url <RPC>
        const cmd = `${foundryBin}/cast send "${toAddress}" --value ${amount}ether --account "${fromWallet}" --password "${password}" --rpc-url "${rpcUrl}"`;
        
        logger.info('Executing transfer', { fromWallet, toAddress, chain, amount });
        
        const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
        
        // Parse transaction hash from output
        const txHashMatch = stdout.match(/transactionHash\s+([0-9a-fA-Fx]+)/i) || 
                           stdout.match(/(0x[a-fA-F0-9]{64})/);
        const txHash = txHashMatch ? txHashMatch[1] : null;

        logger.info('Transfer successful', { fromWallet, toAddress, chain, amount, txHash });

        res.json({
            success: true,
            txHash,
            message: `Sent ${amount} ${chain.toUpperCase() === 'PLS' ? 'PLS' : 'BNB'} to ${toAddress}`,
            output: stdout
        });
    } catch (err) {
        logger.error('Transfer failed', { error: err.message, fromWallet, toAddress, chain, amount });
        res.status(500).json({ 
            success: false, 
            error: err.message || 'Transaction failed'
        });
    }
});

module.exports = router;
