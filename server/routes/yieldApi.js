/**
 * Yield Claim API Routes
 * 
 * Time-based yield claiming with manual override
 * - GET /api/yield/status - Get properties and claim status
 * - POST /api/yield/claim - Claim ready properties
 * - POST /api/yield/claim-all - Force claim all (manual override)
 * - POST /api/yield/config - Update claim interval
 */

const express = require('express');
const router = express.Router();
const yieldClaimManager = require('../services/YieldClaimManager');
const globalPasswordManager = require('../config/GlobalPasswordManager');
const Logger = require('../config/Logger');

const logger = new Logger('YieldAPI');

// Middleware to sync password from global password manager
function syncPassword() {
    const password = globalPasswordManager.masterPassword;
    if (password) {
        yieldClaimManager.setGlobalPassword(password);
    }
    return password;
}

/**
 * GET /api/yield/status/:address
 * Get property yield status for an address
 */
router.get('/status/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const chain = req.query.chain || 'pulsechain';
        
        const status = await yieldClaimManager.getStatus(address, chain);
        
        res.json({
            success: true,
            address,
            chain,
            ...status,
            config: yieldClaimManager.getConfig()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/yield/history
 * Get recent claim history
 */
router.get('/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = yieldClaimManager.getClaimHistory(limit);
        
        res.json({
            success: true,
            count: history.length,
            history
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/yield/config
 * Get current configuration
 */
router.get('/config', (req, res) => {
    res.json({
        success: true,
        config: yieldClaimManager.getConfig()
    });
});

/**
 * POST /api/yield/config
 * Update configuration
 * Body: { claimIntervalHours?: number, enabled?: boolean }
 */
router.post('/config', (req, res) => {
    try {
        const { claimIntervalHours, enabled } = req.body;
        const config = yieldClaimManager.updateConfig({ claimIntervalHours, enabled });
        
        res.json({
            success: true,
            config
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/yield/claim
 * Claim ready properties (based on time interval)
 * Body: { keystoreName: string, address: string, chain?: string }
 */
router.post('/claim', async (req, res) => {
    const password = syncPassword();
    
    try {
        const { keystoreName, address, chain = 'pulsechain' } = req.body;
        
        if (!keystoreName) {
            return res.status(400).json({ success: false, error: 'keystoreName required' });
        }
        
        if (!address) {
            return res.status(400).json({ success: false, error: 'address required' });
        }
        
        if (!password) {
            return res.status(401).json({ 
                success: false, 
                error: 'Password not unlocked. Please unlock the global password first.' 
            });
        }
        
        logger.info(`Claiming ready properties for ${address}`, { chain });
        
        const result = await yieldClaimManager.claimAllReady(
            keystoreName, password, address, chain,
            (msg) => logger.info(msg)
        );
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/yield/claim-all
 * Force claim ALL yield-producing properties (manual override)
 * Body: { keystoreName: string, address: string, chain?: string }
 */
router.post('/claim-all', async (req, res) => {
    const password = syncPassword();
    
    try {
        const { keystoreName, address, chain = 'pulsechain' } = req.body;
        
        if (!keystoreName) {
            return res.status(400).json({ success: false, error: 'keystoreName required' });
        }
        
        if (!address) {
            return res.status(400).json({ success: false, error: 'address required' });
        }
        
        if (!password) {
            return res.status(401).json({ 
                success: false, 
                error: 'Password not unlocked. Please unlock the global password first.' 
            });
        }
        
        logger.info(`FORCE claiming ALL properties for ${address}`, { chain });
        
        const result = await yieldClaimManager.claimAllForce(
            keystoreName, password, address, chain,
            (msg) => logger.info(msg)
        );
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/yield/claim-single
 * Claim a single property
 * Body: { keystoreName: string, cityId: number, tileId: string, chain?: string }
 */
router.post('/claim-single', async (req, res) => {
    const password = syncPassword();
    
    try {
        const { keystoreName, cityId, tileId, chain = 'pulsechain' } = req.body;
        
        if (!keystoreName || cityId === undefined || !tileId) {
            return res.status(400).json({ 
                success: false, 
                error: 'keystoreName, cityId, and tileId required' 
            });
        }
        
        if (!password) {
            return res.status(401).json({ 
                success: false, 
                error: 'Password not unlocked. Please unlock the global password first.' 
            });
        }
        
        logger.info(`Claiming single property`, { cityId, tileId, chain });
        
        const result = await yieldClaimManager.claimProperty(
            keystoreName, password, cityId, tileId, chain,
            (msg) => logger.info(msg)
        );
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
