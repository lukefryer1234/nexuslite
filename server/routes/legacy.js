/**
 * Legacy Routes - Compatibility with Bot Nexus endpoint patterns
 * Maps /api/mafia, /api/nickcar, /api/killskill, /api/travel to scheduler service
 */

const express = require('express');
const globalPasswordManager = require('../config/GlobalPasswordManager');
const Logger = require('../config/Logger');

const logger = new Logger('Legacy');

function createLegacyRoutes(schedulerService) {
    const router = express.Router();

    // Script type mapping - both legacy 'mafia' and new 'crime' map to 'crime' script
    const scriptTypes = {
        mafia: 'crime',   // Legacy endpoint
        crime: 'crime',   // New endpoint
        nickcar: 'nickcar', 
        killskill: 'killskill',
        travel: 'travel'
    };

    // Create routes for each legacy endpoint
    Object.entries(scriptTypes).forEach(([legacyName, scriptType]) => {
        
        // Start script
        router.post(`/${legacyName}/start`, async (req, res) => {
            try {
                const { chain, keystore, walletId, password, ...config } = req.body;
                const effectiveWalletId = walletId || keystore;
                
                // Use provided password or fall back to masterPassword from global unlock
                const effectivePassword = password || globalPasswordManager.masterPassword;
                
                if (!effectivePassword) {
                    return res.status(400).json({ error: 'No password provided and server is not unlocked' });
                }
                
                logger.info(`Starting ${scriptType} for ${effectiveWalletId}`, { chain });
                
                await schedulerService.start(scriptType, chain, {
                    chain,
                    walletId: effectiveWalletId,
                    keystore: keystore || effectiveWalletId,
                    password: effectivePassword,
                    ...config
                });
                
                res.json({ success: true, message: `${scriptType} started` });
            } catch (err) {
                logger.error(`Start ${scriptType} error`, { error: err.message });
                res.status(500).json({ error: err.message });
            }
        });

        // Stop script  
        router.post(`/${legacyName}/stop`, async (req, res) => {
            try {
                const { chain, walletId } = req.body;
                
                logger.info(`Stopping ${scriptType} for ${walletId}`, { chain });
                
                schedulerService.stop(scriptType, chain, walletId);
                res.json({ success: true, stopped: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Get status
        router.get(`/${legacyName}/status`, (req, res) => {
            try {
                const status = schedulerService.getStatus(scriptType);
                res.json(status || { running: false, wallets: { pls: [], bnb: [] } });
            } catch (err) {
                res.json({ running: false, wallets: { pls: [], bnb: [] } });
            }
        });

        // Get logs
        router.get(`/${legacyName}/logs`, (req, res) => {
            try {
                const logs = schedulerService.getLogs(scriptType);
                res.json({ logs: logs || [] });
            } catch (err) {
                res.json({ logs: [] });
            }
        });
    });

    return router;
}

module.exports = { createLegacyRoutes };
