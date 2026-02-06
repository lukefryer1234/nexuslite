/**
 * AutoStartService - Automatically starts all scripts for all keystores on boot
 * Ensures all wallets are running when the server starts
 */

const fs = require('fs');
const path = require('path');

class AutoStartService {
    /**
     * @param {Object} deps - Dependencies
     * @param {Object} deps.schedulerService - ScriptSchedulerService instance
     * @param {Object} deps.globalPasswordManager - GlobalPasswordManager instance
     * @param {Object} deps.logger - Logger instance
     */
    constructor({ schedulerService, globalPasswordManager, logger }) {
        this.scheduler = schedulerService;
        this.passwordManager = globalPasswordManager;
        this.logger = logger;
        
        // Keystore directory path
        this.keystorePath = process.env.KEYSTORE_PATH || 
                           path.join(__dirname, '..', 'keystores');
        
        // Delay before auto-start (ms) - gives time for password unlock
        this.startDelay = parseInt(process.env.AUTOSTART_DELAY_MS) || 5000;
        
        // Scripts to auto-start
        this.scriptTypes = ['crime', 'nickcar', 'killskill', 'travel'];
        
        // Chains to run on
        this.chains = ['pls', 'bnb'];
    }

    /**
     * Get list of keystores from the keystore directory
     */
    getKeystores() {
        try {
            if (!fs.existsSync(this.keystorePath)) {
                this.logger.warn('Keystore directory not found', { path: this.keystorePath });
                return [];
            }
            
            const files = fs.readdirSync(this.keystorePath);
            const keystores = files.filter(f => {
                const fullPath = path.join(this.keystorePath, f);
                // Skip hidden files and directories
                return !f.startsWith('.') && fs.statSync(fullPath).isFile();
            });
            
            this.logger.info('Auto-discovered keystores', { count: keystores.length, keystores });
            return keystores;
        } catch (error) {
            this.logger.error('Error reading keystore directory', { error: error.message });
            return [];
        }
    }

    /**
     * Start all scripts for all wallets
     * @param {boolean} waitForPassword - If true, wait for password to be unlocked
     */
    async startAll(waitForPassword = true) {
        this.logger.info('AutoStartService: Beginning auto-start sequence', { 
            delay: this.startDelay,
            waitForPassword 
        });

        // Wait for the configured delay to allow password unlock
        await new Promise(resolve => setTimeout(resolve, this.startDelay));
        
        // Check if password is available
        if (waitForPassword && !this.passwordManager.isUnlocked) {
            this.logger.warn('AutoStartService: Password not unlocked, waiting...');
            
            // Wait up to 60 seconds for password unlock
            let attempts = 0;
            while (!this.passwordManager.isUnlocked && attempts < 12) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;
            }
            
            if (!this.passwordManager.isUnlocked) {
                this.logger.error('AutoStartService: Password never unlocked, aborting auto-start');
                return { success: false, error: 'Password not unlocked' };
            }
        }
        
        const keystores = this.getKeystores();
        if (keystores.length === 0) {
            this.logger.warn('AutoStartService: No keystores found, nothing to auto-start');
            return { success: false, error: 'No keystores found' };
        }
        
        const results = {
            started: [],
            failed: [],
            skipped: []
        };
        
        // Get the master password
        const password = this.passwordManager.masterPassword;
        
        for (const keystore of keystores) {
            for (const scriptType of this.scriptTypes) {
                for (const chain of this.chains) {
                    try {
                        // Check if already running
                        const status = this.scheduler.getStatus(scriptType, chain, keystore);
                        if (status.running) {
                            results.skipped.push({ keystore, scriptType, chain, reason: 'already running' });
                            continue;
                        }
                        
                        // Start the script
                        const result = this.scheduler.start(scriptType, chain, {
                            keystore,
                            walletId: keystore,
                            password
                        });
                        
                        if (result.success) {
                            results.started.push({ keystore, scriptType, chain });
                            this.logger.debug('Auto-started script', { keystore, scriptType, chain });
                        } else {
                            results.failed.push({ keystore, scriptType, chain, error: result.error });
                            this.logger.warn('Failed to auto-start script', { keystore, scriptType, chain, error: result.error });
                        }
                        
                        // Small delay between starts to avoid overwhelming
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                    } catch (err) {
                        results.failed.push({ keystore, scriptType, chain, error: err.message });
                        this.logger.error('Error during auto-start', { keystore, scriptType, chain, error: err.message });
                    }
                }
            }
        }
        
        this.logger.info('AutoStartService: Auto-start complete', {
            started: results.started.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        });
        
        return { success: true, results };
    }

    /**
     * Start auto-start in background (non-blocking)
     */
    startInBackground() {
        // Run in background after a delay
        setImmediate(() => {
            this.startAll().catch(err => {
                this.logger.error('AutoStartService background error', { error: err.message });
            });
        });
    }
}

module.exports = AutoStartService;
