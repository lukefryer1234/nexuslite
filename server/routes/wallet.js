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

// Default RPC URLs (will be overridden by settings)
const DEFAULT_RPC_URLS = {
    pls: 'https://rpc.pulsechain.com',
    bnb: 'https://bsc-dataseed.binance.org'
};

// Function to get current RPC URLs from settings
const getRpcUrls = () => {
    try {
        const settingsRoutes = require('./settings');
        return settingsRoutes.getRpcUrls();
    } catch {
        return DEFAULT_RPC_URLS;
    }
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
    const rpcUrls = getRpcUrls();
    try {
        const { stdout } = await execAsync(
            `${foundryBin}/cast balance ${address} --rpc-url ${rpcUrls.pls}`,
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
            `${foundryBin}/cast balance ${address} --rpc-url ${rpcUrls.bnb}`,
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

// MAP contract addresses for each chain
const MAP_CONTRACTS = {
    pls: '0xE571Aa670EDeEBd88887eb5687576199652A714F',
    bnb: '0x1c88060e4509c59b4064A7a9818f64AeC41ef19E'
};

// City names mapping (comprehensive list from game)
const CITY_NAMES = {
    0: 'New York',
    1: 'Chicago',
    2: 'Las Vegas',
    3: 'Detroit',
    4: 'Los Angeles',
    5: 'Miami',
    6: 'Atlantic City',
    7: 'Philadelphia',
    8: 'Boston',
    9: 'San Francisco',
    10: 'Houston',
    11: 'Dallas',
    12: 'Seattle',
    13: 'Denver',
    14: 'Phoenix',
    15: 'Atlanta',
    16: 'New Orleans',
    17: 'Kansas City',
    18: 'St. Louis',
    19: 'Minneapolis',
    20: 'Portland',
    21: 'San Diego',
    22: 'Tampa',
    23: 'Cleveland',
    24: 'Pittsburgh',
    25: 'Baltimore',
    26: 'Washington DC',
    27: 'Nashville',
    28: 'Memphis',
    29: 'Charlotte'
};

// Inventory (ERC1155) contract addresses for checking item ownership
const INVENTORY_CONTRACTS = {
    pls: '0x2c60de22Ec20CcE72245311579c4aD9e5394Adc4',
    bnb: '0x2CB8352Be090846d4878Faa92825188D7bf50654'
};

// Transport item IDs in the ERC1155 inventory contract
// These IDs are specific to the game's inventory system
const TRANSPORT_ITEMS = {
    // Airplane item IDs in the inventory contract (1-5 are plane tickets)
    AIRPLANE: [1, 2, 3, 4, 5],
    // Car/vehicle item IDs in the inventory contract (10-15 are vehicles)
    CAR: [10, 11, 12, 13, 14, 15],
    // Train is always available (no item needed)
    TRAIN: []
};

// Get player's current city on both chains
// The contract uses selector 0x7c5dc38a for getCity(address) - we use raw calldata to ensure correct encoding
router.get('/city/:address', async (req, res) => {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x')) {
        return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
    const results = {
        pls: { success: false, cityId: null, cityName: null },
        bnb: { success: false, cityId: null, cityName: null }
    };

    const rpcUrls = getRpcUrls();
    logger.info('Detecting city for address', { address, rpcUrls });

    // Build raw calldata: selector 0x7c5dc38a + padded address
    const addressPadded = address.toLowerCase().replace('0x', '').padStart(64, '0');
    const calldata = `0x7c5dc38a${addressPadded}`;

    // Query PulseChain
    try {
        const cmd = `${foundryBin}/cast call ${MAP_CONTRACTS.pls} "${calldata}" --rpc-url ${rpcUrls.pls}`;
        logger.debug('PLS city query', { cmd });
        const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
        if (stderr) logger.warn('PLS stderr', { stderr: stderr.substring(0, 200) });
        const cityId = parseInt(stdout.trim(), 16); // cast returns hex for uint256
        logger.info('PLS city detected', { address, cityId, raw: stdout.trim() });
        results.pls = {
            success: true,
            cityId,
            cityName: CITY_NAMES[cityId] || `Unknown (${cityId})`
        };
    } catch (err) {
        // Reverts usually mean player not registered
        const isRevert = err.message?.includes('reverted');
        logger.warn('PLS city detection failed', { 
            address, 
            error: err.message?.substring(0, 150),
            isRevert
        });
        results.pls = { 
            success: false, 
            error: isRevert ? 'Player not registered on PulseChain' : err.message?.substring(0, 100) 
        };
    }

    // Query BNB Chain
    try {
        const cmd = `${foundryBin}/cast call ${MAP_CONTRACTS.bnb} "${calldata}" --rpc-url ${rpcUrls.bnb}`;
        logger.debug('BNB city query', { cmd });
        const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
        if (stderr) logger.warn('BNB stderr', { stderr: stderr.substring(0, 200) });
        const cityId = parseInt(stdout.trim(), 16); // cast returns hex for uint256
        logger.info('BNB city detected', { address, cityId, raw: stdout.trim() });
        results.bnb = {
            success: true,
            cityId,
            cityName: CITY_NAMES[cityId] || `Unknown (${cityId})`
        };
    } catch (err) {
        const isRevert = err.message?.includes('reverted');
        logger.warn('BNB city detection failed', { 
            address, 
            error: err.message?.substring(0, 150),
            isRevert
        });
        results.bnb = { 
            success: false, 
            error: isRevert ? 'Player not registered on BNB Chain' : err.message?.substring(0, 100) 
        };
    }

    logger.info('City detection complete', { address, results });
    res.json(results);
});

// Get player's available transport on both chains
// Uses ERC1155 balanceOf to check inventory for cars/airplane
router.get('/transport/:address', async (req, res) => {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x')) {
        return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const foundryBin = process.env.FOUNDRY_BIN || process.env.HOME + '/.foundry/bin';
    const results = {
        pls: { success: false, hasTrain: true, hasCar: false, hasAirplane: false, bestTransport: 0 },
        bnb: { success: false, hasTrain: true, hasCar: false, hasAirplane: false, bestTransport: 0 }
    };

    const rpcUrls = getRpcUrls();
    logger.info('Detecting transport for address', { address });

    // Build ERC1155 balanceOf(address,uint256) selector: 0x00fdd58e
    const addressPadded = address.toLowerCase().replace('0x', '').padStart(64, '0');

    // Function to check if player owns any item from a list
    const checkItemOwnership = async (chain, itemIds) => {
        const rpc = rpcUrls[chain];
        const contract = INVENTORY_CONTRACTS[chain];
        
        for (const itemId of itemIds) {
            try {
                // balanceOf(address, uint256) selector: 0x00fdd58e
                const itemIdHex = itemId.toString(16).padStart(64, '0');
                const calldata = `0x00fdd58e${addressPadded}${itemIdHex}`;
                const cmd = `${foundryBin}/cast call ${contract} "${calldata}" --rpc-url ${rpc}`;
                const { stdout } = await execAsync(cmd, { timeout: 10000 });
                const balance = parseInt(stdout.trim(), 16);
                if (balance > 0) {
                    logger.debug(`${chain}: Found item ${itemId} with balance ${balance}`);
                    return true;
                }
            } catch (err) {
                // Item check failed, continue to next
            }
        }
        return false;
    };

    // Check PulseChain transport
    try {
        const hasAirplane = await checkItemOwnership('pls', TRANSPORT_ITEMS.AIRPLANE);
        const hasCar = await checkItemOwnership('pls', TRANSPORT_ITEMS.CAR);
        
        // Best transport: 2=airplane, 1=car, 0=train
        let bestTransport = 0; // Train (always available)
        if (hasCar) bestTransport = 1;
        if (hasAirplane) bestTransport = 2;
        
        results.pls = {
            success: true,
            hasTrain: true,
            hasCar,
            hasAirplane,
            bestTransport
        };
        logger.info('PLS transport detected', { address, hasCar, hasAirplane, bestTransport });
    } catch (err) {
        logger.warn('PLS transport detection failed', { address, error: err.message?.substring(0, 150) });
        results.pls.error = err.message?.substring(0, 100);
    }

    // Check BNB Chain transport
    try {
        const hasAirplane = await checkItemOwnership('bnb', TRANSPORT_ITEMS.AIRPLANE);
        const hasCar = await checkItemOwnership('bnb', TRANSPORT_ITEMS.CAR);
        
        // Best transport: 2=airplane, 1=car, 0=train
        let bestTransport = 0; // Train (always available)
        if (hasCar) bestTransport = 1;
        if (hasAirplane) bestTransport = 2;
        
        results.bnb = {
            success: true,
            hasTrain: true,
            hasCar,
            hasAirplane,
            bestTransport
        };
        logger.info('BNB transport detected', { address, hasCar, hasAirplane, bestTransport });
    } catch (err) {
        logger.warn('BNB transport detection failed', { address, error: err.message?.substring(0, 150) });
        results.bnb.error = err.message?.substring(0, 100);
    }

    logger.info('Transport detection complete', { address, results });
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
    const rpcUrls = getRpcUrls();
    const rpcUrl = rpcUrls[chain];

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
