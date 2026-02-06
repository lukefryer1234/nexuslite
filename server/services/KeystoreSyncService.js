/**
 * KeystoreSyncService - Auto-sync keystores from Foundry and watch for changes
 * Ensures Nexus Lite always has all keystores and scripts running
 */

const fs = require('fs');
const path = require('path');

class KeystoreSyncService {
    /**
     * @param {Object} deps
     * @param {Object} deps.schedulerService - ScriptSchedulerService
     * @param {Object} deps.globalPasswordManager - GlobalPasswordManager
     * @param {Object} deps.logger - Logger
     * @param {Object} deps.io - Socket.IO instance (optional)
     */
    constructor({ schedulerService, globalPasswordManager, logger, io }) {
        this.scheduler = schedulerService;
        this.passwordManager = globalPasswordManager;
        this.logger = logger;
        this.io = io;
        
        // Foundry keystore (source of truth)
        this.foundryKeystorePath = path.join(require('os').homedir(), '.foundry', 'keystores');
        
        // Nexus Lite server keystore (local copy)
        this.serverKeystorePath = process.env.KEYSTORE_PATH || 
                                  path.join(__dirname, '..', 'keystores');
        
        // Track known keystores
        this.knownKeystores = new Set();
        
        // Scripts to auto-start
        this.scriptTypes = ['crime', 'nickcar', 'killskill', 'travel'];
        this.chains = ['pls', 'bnb'];
        
        // File watchers
        this.watchers = [];
        
        // Sync interval (check every 30 seconds)
        this.syncInterval = null;
        this.syncIntervalMs = 30000;
    }

    /**
     * Initialize - sync keystores and start watching
     */
    async initialize() {
        this.logger.info('KeystoreSyncService: Initializing...');
        
        // Ensure server keystore directory exists
        if (!fs.existsSync(this.serverKeystorePath)) {
            fs.mkdirSync(this.serverKeystorePath, { recursive: true });
            this.logger.info('Created server keystore directory', { path: this.serverKeystorePath });
        }
        
        // Initial sync from Foundry
        await this.syncFromFoundry();
        
        // Load current keystores
        this.loadKnownKeystores();
        
        // Start file watcher on Foundry directory
        this.startWatcher();
        
        // Start periodic sync (backup in case watcher misses something)
        this.startPeriodicSync();
        
        this.logger.info('KeystoreSyncService: Initialized', {
            foundryPath: this.foundryKeystorePath,
            serverPath: this.serverKeystorePath,
            keystores: Array.from(this.knownKeystores)
        });
    }

    /**
     * Sync keystores from Foundry to server directory
     */
    async syncFromFoundry() {
        try {
            if (!fs.existsSync(this.foundryKeystorePath)) {
                this.logger.warn('Foundry keystore directory not found', { path: this.foundryKeystorePath });
                return { synced: 0, errors: [] };
            }
            
            const foundryFiles = fs.readdirSync(this.foundryKeystorePath)
                .filter(f => !f.startsWith('.') && fs.statSync(path.join(this.foundryKeystorePath, f)).isFile());
            
            let synced = 0;
            const errors = [];
            
            for (const file of foundryFiles) {
                const srcPath = path.join(this.foundryKeystorePath, file);
                const destPath = path.join(this.serverKeystorePath, file);
                
                try {
                    // Check if file exists and is different
                    const srcStat = fs.statSync(srcPath);
                    let needsCopy = !fs.existsSync(destPath);
                    
                    if (!needsCopy) {
                        const destStat = fs.statSync(destPath);
                        needsCopy = srcStat.mtime > destStat.mtime || srcStat.size !== destStat.size;
                    }
                    
                    if (needsCopy) {
                        fs.copyFileSync(srcPath, destPath);
                        synced++;
                        this.logger.info('Synced keystore from Foundry', { file });
                    }
                } catch (err) {
                    errors.push({ file, error: err.message });
                    this.logger.error('Error syncing keystore', { file, error: err.message });
                }
            }
            
            if (synced > 0) {
                this.logger.info('Keystore sync complete', { synced, total: foundryFiles.length });
            }
            
            return { synced, errors };
        } catch (err) {
            this.logger.error('Error during keystore sync', { error: err.message });
            return { synced: 0, errors: [{ error: err.message }] };
        }
    }

    /**
     * Load known keystores from server directory
     */
    loadKnownKeystores() {
        try {
            if (!fs.existsSync(this.serverKeystorePath)) return;
            
            const files = fs.readdirSync(this.serverKeystorePath)
                .filter(f => !f.startsWith('.') && fs.statSync(path.join(this.serverKeystorePath, f)).isFile());
            
            for (const file of files) {
                this.knownKeystores.add(file);
            }
        } catch (err) {
            this.logger.error('Error loading known keystores', { error: err.message });
        }
    }

    /**
     * Start watching Foundry directory for new keystores
     */
    startWatcher() {
        try {
            if (!fs.existsSync(this.foundryKeystorePath)) {
                this.logger.warn('Cannot watch Foundry directory - does not exist');
                return;
            }
            
            const watcher = fs.watch(this.foundryKeystorePath, (eventType, filename) => {
                if (!filename || filename.startsWith('.')) return;
                
                this.logger.debug('Foundry keystore change detected', { eventType, filename });
                
                // Debounce - wait a bit for file to be fully written
                setTimeout(() => {
                    this.handleKeystoreChange(filename);
                }, 1000);
            });
            
            watcher.on('error', (err) => {
                this.logger.error('Watcher error', { error: err.message });
            });
            
            this.watchers.push(watcher);
            this.logger.info('File watcher started for Foundry keystores');
        } catch (err) {
            this.logger.error('Error starting file watcher', { error: err.message });
        }
    }

    /**
     * Handle a keystore file change
     */
    async handleKeystoreChange(filename) {
        const srcPath = path.join(this.foundryKeystorePath, filename);
        const destPath = path.join(this.serverKeystorePath, filename);
        
        try {
            // Check if file exists (might be a delete)
            if (!fs.existsSync(srcPath)) {
                this.logger.info('Keystore removed from Foundry', { filename });
                // Broadcast wallet update to clients
                this.broadcastWalletUpdate('removed', filename);
                // Optionally remove from server too (uncomment if desired)
                // if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                return;
            }
            
            // Sync the file
            fs.copyFileSync(srcPath, destPath);
            this.logger.info('Synced new/updated keystore', { filename });
            
            // Check if this is a new keystore
            if (!this.knownKeystores.has(filename)) {
                this.knownKeystores.add(filename);
                this.logger.info('New keystore detected', { filename });
                
                // Broadcast wallet update to clients
                this.broadcastWalletUpdate('added', filename);
                
                // Auto-start scripts for new wallet
                await this.startScriptsForWallet(filename);
            }
        } catch (err) {
            this.logger.error('Error handling keystore change', { filename, error: err.message });
        }
    }

    /**
     * Broadcast wallet update to all connected clients
     */
    broadcastWalletUpdate(action, walletName) {
        if (this.io) {
            this.io.emit('wallets:updated', {
                action,
                wallet: walletName,
                timestamp: Date.now(),
                wallets: this.getKeystores()
            });
            this.logger.info('Broadcast wallet update', { action, walletName });
        }
    }

    /**
     * Start all scripts for a wallet
     */
    async startScriptsForWallet(keystore) {
        // Wait for password if not unlocked
        if (!this.passwordManager.isUnlocked) {
            this.logger.warn('Skipping auto-start - password not unlocked', { keystore });
            return { success: false, error: 'Password not unlocked' };
        }
        
        const password = this.passwordManager.masterPassword;
        const results = { started: [], failed: [] };
        
        for (const scriptType of this.scriptTypes) {
            for (const chain of this.chains) {
                try {
                    // Check if already running
                    const status = this.scheduler.getStatus(scriptType, chain, keystore);
                    if (status.running) continue;
                    
                    const result = this.scheduler.start(scriptType, chain, {
                        keystore,
                        walletId: keystore,
                        password
                    });
                    
                    if (result.success) {
                        results.started.push({ scriptType, chain });
                    } else {
                        results.failed.push({ scriptType, chain, error: result.error });
                    }
                    
                    // Small delay
                    await new Promise(r => setTimeout(r, 50));
                } catch (err) {
                    results.failed.push({ scriptType, chain, error: err.message });
                }
            }
        }
        
        this.logger.info('Auto-started scripts for new wallet', {
            keystore,
            started: results.started.length,
            failed: results.failed.length
        });
        
        return { success: true, results };
    }

    /**
     * Start periodic sync (backup for file watcher)
     */
    startPeriodicSync() {
        this.syncInterval = setInterval(async () => {
            const { synced } = await this.syncFromFoundry();
            
            // Check for new keystores
            if (synced > 0) {
                this.checkForNewKeystores();
            }
        }, this.syncIntervalMs);
    }

    /**
     * Check for new keystores and start scripts
     */
    async checkForNewKeystores() {
        try {
            const files = fs.readdirSync(this.serverKeystorePath)
                .filter(f => !f.startsWith('.') && fs.statSync(path.join(this.serverKeystorePath, f)).isFile());
            
            for (const file of files) {
                if (!this.knownKeystores.has(file)) {
                    this.knownKeystores.add(file);
                    this.logger.info('Discovered new keystore', { file });
                    await this.startScriptsForWallet(file);
                }
            }
        } catch (err) {
            this.logger.error('Error checking for new keystores', { error: err.message });
        }
    }

    /**
     * Get list of all known keystores
     */
    getKeystores() {
        return Array.from(this.knownKeystores);
    }

    /**
     * Stop all watchers and intervals
     */
    stop() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.logger.info('KeystoreSyncService stopped');
    }
}

module.exports = KeystoreSyncService;
