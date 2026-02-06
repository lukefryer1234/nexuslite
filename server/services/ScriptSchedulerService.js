/**
 * ScriptSchedulerService - Centralized scheduler management
 * Handles crime, nickcar, killskill, and travel schedulers with DI
 * 
 * Multi-wallet support: processes are keyed by [type][chain][walletId]
 */

const { spawn } = require('child_process');
const path = require('path');
const globalLogService = require('./GlobalLogService');

// Scheduler type configurations
// Updated to use local scripts directory for independence
const SCHEDULER_CONFIGS = {
    crime: {
        script: 'run-crime-scriptV2.js',
        event: 'crime-log',
        cooldownMinutes: 16,
        envKeys: ['CRIME_TYPE']
    },
    nickcar: {
        script: 'run-nickcar-scheduler.js',
        event: 'nickcar-log',
        cooldownMinutes: 31,
        envKeys: []
    },
    killskill: {
        script: 'run-killskill-scheduler.js',
        event: 'killskill-log',
        cooldownMinutes: 46,
        envKeys: ['KILL_SKILL_TRAIN_TYPE']
    },
    travel: {
        script: 'run-travel-script.js',
        event: 'travel-log',
        cooldownMinutes: 65,
        envKeys: ['START_CITY', 'END_CITY', 'TRAVEL_TYPE', 'ITEM_IDS']
    }
};

// Path to local scripts directory
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

class ScriptSchedulerService {
    /**
     * @param {Object} deps - Dependencies
     * @param {Object} deps.io - Socket.io instance
     * @param {Object} deps.logger - GameLogger instance
     * @param {Object} deps.metricsCollector - Metrics collector instance (optional)
     * @param {Object} deps.registry - ScriptRegistry instance (optional)
     */
    constructor({ io, logger, metricsCollector = null, registry = null }) {
        this.io = io;
        this.logger = logger;
        this.metrics = metricsCollector;
        this.registry = registry;

        // Initialize state for each scheduler type
        // Structure: processes[type][chain][walletId] = childProcess
        this.processes = {};
        this.logs = {};
        this.crimeTypeMap = {}; // Track crime type per wallet: {walletId: crimeType}

        for (const type of Object.keys(SCHEDULER_CONFIGS)) {
            this.processes[type] = { pls: {}, bnb: {} };
            this.logs[type] = { pls: {}, bnb: {} };
        }

        // Analytics service will be injected by routes
        this.crimeAnalytics = null;

        // Ensure cleanup on server exit
        this._setupProcessCleanup();
    }

    /**
     * Handle graceful shutdown by killing all child processes
     */
    _setupProcessCleanup() {
        // Kill all children on exit
        const cleanup = () => {
            this.logger.info('Shutting down scheduler service, killing child processes...');
            this.stopAll();
        };

        // Attach to process events
        process.once('exit', cleanup);
        process.once('SIGINT', () => process.exit(0));
        process.once('SIGTERM', () => process.exit(0));
    }

    /**
     * Stop ALL running schedulers
     */
    stopAll() {
        for (const type of Object.keys(this.processes)) {
            for (const chain of ['pls', 'bnb']) {
                const wallets = Object.keys(this.processes[type][chain]);
                for (const wId of wallets) {
                    try {
                        const child = this.processes[type][chain][wId];
                        if (child && !child.killed) {
                            child.kill();
                        }
                    } catch (e) {
                        // ignore errors during cleanup
                    }
                }
            }
        }
    }

    /**
     * Start a scheduler
     * @param {string} type - Scheduler type (crime, nickcar, killskill, travel)
     * @param {string} chain - Chain (pls or bnb)
     * @param {Object} config - Scheduler configuration
     * @param {string} config.walletId - Wallet identifier (required for multi-wallet)
     * @param {string} config.keystore - Keystore name
     * @param {string} config.password - Keystore password
     * @returns {{ success: boolean, error?: string, cooldownMinutes?: number, walletId?: string }}
     */
    start(type, chain, config = {}) {
        const { walletId, keystore, password, ...options } = config;

        // Generate walletId from keystore if not provided (backwards compatibility)
        const effectiveWalletId = walletId || keystore || 'default';

        // Validate type
        if (!SCHEDULER_CONFIGS[type]) {
            return { success: false, error: `Invalid scheduler type: ${type}` };
        }

        // Validate chain
        if (!chain || (chain !== 'pls' && chain !== 'bnb')) {
            return { success: false, error: 'Invalid chain - must be pls or bnb' };
        }

        // Check if already running for this wallet
        if (this.processes[type][chain][effectiveWalletId]) {
            return { success: false, error: `${chain.toUpperCase()} ${type} scheduler already running for wallet ${effectiveWalletId}` };
        }

        const schedulerConfig = SCHEDULER_CONFIGS[type];
        const chainChoice = chain === 'pls' ? '0' : '1';

        // Build environment
        const scriptEnv = {
            ...process.env,
            PATH: `${process.env.FOUNDRY_BIN}:${process.env.PATH}`,
            CHAIN_CHOICE: chainChoice,
            [`${chain.toUpperCase()}_KEYSTORE_NAME`]: keystore || '',
            [`${chain.toUpperCase()}_KEYSTORE_PASSWORD`]: password || ''
        };

        // Add type-specific env vars
        if (type === 'crime') {
            // Always set crime type (default to 0) - script requires this unless RANDOMIZE_CRIMES is true
            const crimeType = options.crimeType !== undefined ? String(options.crimeType) : '0';
            scriptEnv[`${chain.toUpperCase()}_CRIME_TYPE`] = crimeType;
            // Track crime type for this wallet for analytics
            this.crimeTypeMap[effectiveWalletId] = parseInt(crimeType);
        }
        if (type === 'killskill' && options.trainType !== undefined) {
            scriptEnv.KILL_SKILL_TRAIN_TYPE = String(options.trainType);
        }
        if (type === 'travel') {
            // Travel script requires ALL parameters to have matching counts
            // Set defaults for any missing values
            const startCity = options.startCity !== undefined ? String(options.startCity) : '0';
            const endCity = options.endCity !== undefined ? String(options.endCity) : '1';
            const travelType = options.travelType !== undefined ? String(options.travelType) : '2';
            const itemId = options.itemId !== undefined ? String(options.itemId) : '0';

            scriptEnv[`${chain.toUpperCase()}_START_CITY`] = startCity;
            scriptEnv[`${chain.toUpperCase()}_END_CITY`] = endCity;
            scriptEnv[`${chain.toUpperCase()}_TRAVEL_TYPE`] = travelType;
            scriptEnv[`${chain.toUpperCase()}_ITEM_IDS`] = itemId;
        }

        try {
            const scriptPath = path.join(SCRIPTS_DIR, schedulerConfig.script);
            const child = spawn('node', [scriptPath], {
                cwd: SCRIPTS_DIR,
                env: scriptEnv
            });

            // Initialize logs for this wallet
            this.logs[type][chain][effectiveWalletId] = [];

            // Bind event handlers
            this._bindProcessEvents(type, chain, effectiveWalletId, child, schedulerConfig.event);

            this.processes[type][chain][effectiveWalletId] = child;

            this.logger.info(`${type} scheduler started`, { chain, walletId: effectiveWalletId, keystore });

            return {
                success: true,
                chain,
                walletId: effectiveWalletId,
                cooldownMinutes: schedulerConfig.cooldownMinutes
            };
        } catch (err) {
            this.logger.error(`${type} spawn error`, { chain, walletId: effectiveWalletId, error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Stop a scheduler
     * @param {string} type - Scheduler type
     * @param {string} chain - Chain (optional - stops all chains if not specified)
     * @param {string} walletId - Wallet ID (optional - stops all wallets if not specified)
     */
    stop(type, chain = null, walletId = null) {
        if (!SCHEDULER_CONFIGS[type]) {
            return { success: false, error: `Invalid scheduler type: ${type}` };
        }

        const event = SCHEDULER_CONFIGS[type].event;
        const stopped = [];

        const stopWallet = (c, wId) => {
            if (this.processes[type][c][wId]) {
                this.processes[type][c][wId].kill();
                delete this.processes[type][c][wId];
                this.io.emit(event, {
                    time: Date.now(),
                    text: 'Scheduler stopped by user',
                    type: 'info',
                    chain: c,
                    walletId: wId
                });
                stopped.push({ chain: c, walletId: wId });
            }
        };

        const stopChain = (c) => {
            if (walletId) {
                stopWallet(c, walletId);
            } else {
                // Stop all wallets for this chain
                for (const wId of Object.keys(this.processes[type][c])) {
                    stopWallet(c, wId);
                }
            }
        };

        if (chain) {
            stopChain(chain);
        } else {
            stopChain('pls');
            stopChain('bnb');
        }

        if (stopped.length > 0) {
            this.logger.info(`${type} scheduler stopped`, { stopped });
            return { success: true, stopped };
        }

        return { success: false, error: 'No scheduler running for that chain/wallet' };
    }

    /**
     * Get scheduler status
     * @param {string} type - Scheduler type
     * @param {string} chain - Chain (optional)
     * @param {string} walletId - Wallet ID (optional)
     */
    getStatus(type, chain = null, walletId = null) {
        if (!SCHEDULER_CONFIGS[type]) {
            return { error: `Invalid scheduler type: ${type}` };
        }

        // Specific wallet status
        if (chain && walletId) {
            return {
                running: !!this.processes[type][chain][walletId],
                chain,
                walletId
            };
        }

        // Chain status (all wallets)
        if (chain) {
            const wallets = Object.keys(this.processes[type][chain]);
            const running = wallets.filter(w => !!this.processes[type][chain][w]);
            return {
                chain,
                running: running.length > 0,
                activeWallets: running,
                count: running.length
            };
        }

        // Full status
        const plsWallets = Object.keys(this.processes[type].pls).filter(w => !!this.processes[type].pls[w]);
        const bnbWallets = Object.keys(this.processes[type].bnb).filter(w => !!this.processes[type].bnb[w]);

        return {
            pls: plsWallets.length > 0,
            bnb: bnbWallets.length > 0,
            running: plsWallets.length > 0 || bnbWallets.length > 0,
            wallets: {
                pls: plsWallets,
                bnb: bnbWallets
            }
        };
    }

    /**
     * Get scheduler logs
     * @param {string} type - Scheduler type
     * @param {string} chain - Chain (optional - returns combined if not specified)
     * @param {string} walletId - Wallet ID (optional)
     */
    getLogs(type, chain = null, walletId = null) {
        if (!SCHEDULER_CONFIGS[type]) {
            return { logs: [], error: `Invalid scheduler type: ${type}` };
        }

        // Specific wallet logs
        if (chain && walletId && this.logs[type][chain][walletId]) {
            return { logs: this.logs[type][chain][walletId], walletId };
        }

        // Chain logs (all wallets combined)
        if (chain) {
            const allLogs = [];
            for (const wId of Object.keys(this.logs[type][chain])) {
                allLogs.push(...this.logs[type][chain][wId]);
            }
            return { logs: allLogs.sort((a, b) => a.time - b.time) };
        }

        // All logs combined
        const allLogs = [];
        for (const c of ['pls', 'bnb']) {
            for (const wId of Object.keys(this.logs[type][c])) {
                allLogs.push(...this.logs[type][c][wId]);
            }
        }
        return { logs: allLogs.sort((a, b) => a.time - b.time) };
    }

    /**
     * Get all running processes summary
     */
    getAllStatus() {
        const summary = {};
        for (const type of Object.keys(SCHEDULER_CONFIGS)) {
            summary[type] = this.getStatus(type);
        }
        return summary;
    }

    /**
     * Bind process event handlers
     * @private
     */
    _bindProcessEvents(type, chain, walletId, child, eventName) {
        const channel = type;

        child.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (!line) return; // Skip empty lines
            
            const logEntry = {
                time: Date.now(),
                text: line,
                type: 'stdout',
                chain,
                walletId,
                channel
            };

            if (!this.logs[type][chain][walletId]) {
                this.logs[type][chain][walletId] = [];
            }
            this.logs[type][chain][walletId].push(logEntry);
            if (this.logs[type][chain][walletId].length > 100) {
                this.logs[type][chain][walletId].shift();
            }

            this.io.emit(eventName, logEntry);
            
            // Forward to centralized logging
            const source = `Script:${type}:${chain}:${walletId}`;
            if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
                globalLogService.error(source, line);
            } else if (line.toLowerCase().includes('warn')) {
                globalLogService.warn(source, line);
            } else if (line.toLowerCase().includes('success') || line.includes('✓')) {
                globalLogService.success(source, line);
            } else {
                globalLogService.info(source, line);
            }

            // Track crime analytics
            if (type === 'crime' && this.crimeAnalytics) {
                const crimeType = this.crimeTypeMap[walletId] || 0;
                this.crimeAnalytics.recordCrimeAttempt(logEntry, crimeType);
            }

            // Capture metrics if available
            if (this.metrics) {
                this.metrics.processLog(logEntry);
            }
        });

        child.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (!line) return; // Skip empty lines
            
            const logEntry = {
                time: Date.now(),
                text: line,
                type: 'stderr',
                chain,
                walletId,
                channel
            };

            if (!this.logs[type][chain][walletId]) {
                this.logs[type][chain][walletId] = [];
            }
            this.logs[type][chain][walletId].push(logEntry);
            if (this.logs[type][chain][walletId].length > 100) {
                this.logs[type][chain][walletId].shift();
            }

            this.io.emit(eventName, logEntry);
            
            // Forward to centralized logging as error/warn
            const source = `Script:${type}:${chain}:${walletId}`;
            if (line.toLowerCase().includes('warn')) {
                globalLogService.warn(source, line);
            } else {
                globalLogService.error(source, line);
            }

            if (this.metrics) {
                this.metrics.processLog(logEntry);
            }
        });

        child.on('close', (code) => {
            this.io.emit(eventName, {
                time: Date.now(),
                text: `Scheduler exited with code ${code}`,
                type: 'info',
                chain,
                walletId
            });
            delete this.processes[type][chain][walletId];
            this.logger.debug(`${type} scheduler exited`, { chain, walletId, code });
        });

        child.on('error', (err) => {
            this.logger.error(`${type} spawn error`, { chain, walletId, error: err.message });
            this.io.emit(eventName, {
                time: Date.now(),
                text: `Error: ${err.message}`,
                type: 'stderr',
                chain,
                walletId
            });
            delete this.processes[type][chain][walletId];
        });
    }

    /**
     * Get all supported scheduler types
     */
    static getTypes() {
        return Object.keys(SCHEDULER_CONFIGS);
    }
}

module.exports = ScriptSchedulerService;
