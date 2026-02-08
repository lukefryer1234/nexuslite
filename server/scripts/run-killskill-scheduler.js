/**
 * Kill Skill Scheduler - Trains combat skills every 45 minutes
 * Runs PARALLEL to crime scheduler on independent cooldown
 * Default: FREE training (type 0) - no cash cost
 */
const { exec } = require("child_process");
const util = require("util");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const execPromise = util.promisify(exec);

// Chain choice: 0 -> PLS, 1 -> BNB, 2 -> BOTH
const CHAIN_CHOICE = parseInt(process.env.CHAIN_CHOICE || "0");

// Training type: 0 = Free (bottles), 1 = $5000 (range), 2 = $30000 (trainer)
const TRAIN_TYPE = parseInt(process.env.KILL_SKILL_TRAIN_TYPE || "0");

// Cooldown: 45 minutes (+ 1 minute buffer)
const COOLDOWN_MS = 46 * 60 * 1000;

// Check if ScriptSchedulerService passed a single wallet via env vars
// When spawned by the scheduler, each process handles ONE wallet only
const envPlsKeystore = process.env.PLS_KEYSTORE_NAME;
const envBnbKeystore = process.env.BNB_KEYSTORE_NAME;
const envPlsPassword = process.env.PLS_KEYSTORE_PASSWORD;
const envBnbPassword = process.env.BNB_KEYSTORE_PASSWORD;

// Auto-discover keystores from Foundry directory (standalone mode only)
const KEYSTORE_DIR = process.env.KEYSTORE_PATH || path.join(require('os').homedir(), '.foundry', 'keystores');

function discoverKeystores() {
    try {
        if (!fs.existsSync(KEYSTORE_DIR)) {
            console.error(`Error: Keystore directory not found: ${KEYSTORE_DIR}`);
            return [];
        }
        const files = fs.readdirSync(KEYSTORE_DIR);
        const keystores = files.filter(f => {
            const fullPath = path.join(KEYSTORE_DIR, f);
            return !f.startsWith('.') && fs.statSync(fullPath).isFile();
        });
        console.log(`[Config] Auto-discovered ${keystores.length} keystore(s): ${keystores.join(', ')}`);
        return keystores;
    } catch (error) {
        console.error(`Error reading keystore directory: ${error.message}`);
        return [];
    }
}

function getPassword(keystoreName) {
    const specificPassword = process.env[`${keystoreName.toUpperCase()}_PASSWORD`];
    if (specificPassword) return specificPassword;
    
    // Check chain-specific password (set by ScriptSchedulerService)
    if (CHAIN_CHOICE === 1) {
        if (process.env.BNB_KEYSTORE_PASSWORD) return process.env.BNB_KEYSTORE_PASSWORD;
    } else if (CHAIN_CHOICE === 0) {
        if (process.env.PLS_KEYSTORE_PASSWORD) return process.env.PLS_KEYSTORE_PASSWORD;
    }
    
    return process.env.GLOBAL_PASSWORD || 
           process.env.PLS_KEYSTORE_PASSWORD?.split(',')[0]?.trim() ||
           process.env.BNB_KEYSTORE_PASSWORD || '';
}

// If scheduler passed a specific wallet, use only that wallet (single-wallet mode)
// Otherwise fall back to auto-discovery (standalone mode)
let plsKeystoreNames, bnbKeystoreNames, plsKeystorePasswords, bnbKeystorePasswords;

if (envPlsKeystore && CHAIN_CHOICE === 0) {
    // Single wallet mode - PLS
    plsKeystoreNames = [envPlsKeystore];
    plsKeystorePasswords = [envPlsPassword || getPassword(envPlsKeystore)];
    bnbKeystoreNames = [];
    bnbKeystorePasswords = [];
    console.log(`[Config] Single-wallet mode (PLS): ${envPlsKeystore}`);
} else if (envBnbKeystore && CHAIN_CHOICE === 1) {
    // Single wallet mode - BNB
    plsKeystoreNames = [];
    plsKeystorePasswords = [];
    bnbKeystoreNames = [envBnbKeystore];
    bnbKeystorePasswords = [envBnbPassword || getPassword(envBnbKeystore)];
    console.log(`[Config] Single-wallet mode (BNB): ${envBnbKeystore}`);
} else {
    // Standalone mode - discover all keystores
    const discoveredKeystores = discoverKeystores();
    plsKeystoreNames = (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
    bnbKeystoreNames = (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
    plsKeystorePasswords = plsKeystoreNames.map(name => getPassword(name));
    bnbKeystorePasswords = bnbKeystoreNames.map(name => getPassword(name));
}

// Chain configurations with gas settings
const chains = {
    PLS: {
        rpcUrl: process.env.PLS_RPC_URL || "https://rpc-pulsechain.g4mm4.io",
        script: "script/PLSKillSkill.s.sol:PLSKillSkill",
        keystoreNames: plsKeystoreNames,
        keystorePasswords: plsKeystorePasswords,
        maxGasPriceGwei: parseInt(process.env.PLS_MAX_GAS_PRICE_GWEI || "2000000"),
        gasPriceGwei: parseInt(process.env.PLS_GAS_PRICE_GWEI || "30"),
    },
    BNB: {
        rpcUrl: process.env.BNB_RPC_URL || "https://bsc-dataseed.bnbchain.org",
        script: "script/BNBKillSkill.s.sol:BNBKillSkill",
        keystoreNames: bnbKeystoreNames,
        keystorePasswords: bnbKeystorePasswords,
        maxGasPriceGwei: parseInt(process.env.BNB_MAX_GAS_PRICE_GWEI || "5"),
        gasPriceGwei: parseInt(process.env.BNB_GAS_PRICE_GWEI || "3"),
    },
};

// Function to check current gas price
async function getCurrentGasPrice(rpcUrl) {
    try {
        const { stdout } = await execPromise(`cast gas-price --rpc-url ${rpcUrl}`);
        return BigInt(stdout.trim());
    } catch (error) {
        console.error('Failed to get gas price:', error.message);
        return null;
    }
}

// Run kill skill training for a wallet
async function runKillSkill(chainName, keystoreName, keystorePassword, trainType) {
    try {
        const chain = chains[chainName];
        
        // Gas price safety check - skip if current gas is above our max limit
        if (chain.maxGasPriceGwei > 0) {
            const currentGas = await getCurrentGasPrice(chain.rpcUrl);
            if (currentGas !== null) {
                const currentGwei = Number(currentGas / BigInt(1e9));
                if (currentGwei > chain.maxGasPriceGwei) {
                    console.log(`[${chainName}] ⛽ Gas too high for ${keystoreName}: ${currentGwei} gwei > ${chain.maxGasPriceGwei} gwei limit - skipping`);
                    return { success: false, gasTooHigh: true };
                }
            }
        }
        
        // Submit without --with-gas-price so forge auto-detects correct gas price
        const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword} --sig "run(uint8)" ${trainType}`;

        const trainNames = ['Free (bottles)', '$5000 (range)', '$30000 (trainer)'];
        console.log(`[${chainName}] 🎯 Training kill skill (${trainNames[trainType]}) for ${keystoreName}...`);

        const { stdout, stderr } = await execPromise(command, {
            cwd: "./foundry-crime-scripts",
        });

        // Check for cooldown
        if (stdout.includes("cooldown") || stderr.includes("cooldown")) {
            console.log(`[${chainName}] ⏰ ${keystoreName} kill skill on cooldown`);
            return { success: false, cooldown: true };
        }

        console.log(`[${chainName}] ✅ Kill skill training SUCCESS for ${keystoreName}`);
        return { success: true, output: stdout };
    } catch (error) {
        const errMsg = error.message || '';
        const errLower = errMsg.toLowerCase();
        let classification = 'error';
        if (errLower.includes('jail')) {
            console.log(`[${chainName}] ⛓️ ${keystoreName} is in jail - skipping kill skill`);
            classification = 'jail';
        } else if (errLower.includes('cooldown') || errLower.includes('cannot train yet')) {
            console.log(`[${chainName}] ⏰ ${keystoreName} kill skill on cooldown - will retry`);
            classification = 'cooldown';
        } else if (errLower.includes('not active')) {
            console.log(`[${chainName}] ⚠️ ${keystoreName} not active on this chain`);
            classification = 'notActive';
        } else if (errLower.includes('empty revert') || errLower.includes('revert')) {
            console.log(`[${chainName}] ⚠️ ${keystoreName} kill skill reverted (contract error)`);
            classification = 'reverted';
        } else if (errLower.includes('-32000') || errLower.includes('internal_error') || errLower.includes('failed to send transaction')) {
            console.log(`[${chainName}] 🌐 ${keystoreName} RPC error (transient) - will retry`);
            classification = 'rpc';
        } else {
            console.error(`[${chainName}] ❌ Kill skill training FAILED for ${keystoreName}: ${errMsg.substring(0, 300)}`);
        }
        return { success: false, error: errMsg, classification };
    }
}

// Schedule kill skill for a wallet
function scheduleWallet(chainName, keystoreName, keystorePassword) {
    async function runAndReschedule() {
        const result = await runKillSkill(chainName, keystoreName, keystorePassword, TRAIN_TYPE);

        // Smart delay based on error classification
        let delay = COOLDOWN_MS;
        const cls = result.classification || '';
        
        if (result.success || cls === 'cooldown' || cls === '') {
            delay = COOLDOWN_MS; // Standard 46min cooldown
        } else if (cls === 'jail') {
            delay = 5 * 60 * 1000; // 5 min
        } else if (cls === 'notActive') {
            delay = 6 * 60 * 60 * 1000; // 6h
        } else if (cls === 'reverted') {
            delay = 15 * 60 * 1000; // 15 min
        }

        const nextRun = new Date(Date.now() + delay);
        console.log(`[${chainName}] 🎯 Next kill skill for ${keystoreName}: ${nextRun.toISOString()} (${Math.round(delay / 60000)}m)${cls && cls !== 'cooldown' ? ` - ${cls}` : ''}`);
        setTimeout(runAndReschedule, delay);
    }

    // Add random offset (0-90s) to avoid all wallets hitting at same time
    const initialDelay = Math.floor(Math.random() * 90000);
    console.log(`[${chainName}] 🎯 Starting kill skill scheduler for ${keystoreName} in ${Math.round(initialDelay / 1000)}s`);
    setTimeout(runAndReschedule, initialDelay);
}

// Start scheduling for all wallets in a chain
function startChainScheduling(chainName) {
    const chain = chains[chainName];
    if (!chain.keystoreNames.length) {
        console.log(`[${chainName}] No keystores configured for kill skill`);
        return;
    }

    for (let i = 0; i < chain.keystoreNames.length; i++) {
        scheduleWallet(chainName, chain.keystoreNames[i], chain.keystorePasswords[i]);
    }
}

// Start the scheduler
function startScheduler() {
    const trainNames = ['Free (bottles)', '$5000 (range)', '$30000 (trainer)'];
    console.log(`\n🎯 KILL SKILL SCHEDULER starting at ${new Date().toISOString()}`);
    console.log(`   Cooldown: ${COOLDOWN_MS / 60000} minutes`);
    console.log(`   Training type: ${trainNames[TRAIN_TYPE]}`);
    console.log(`   Chain: ${CHAIN_CHOICE === 0 ? 'PLS' : CHAIN_CHOICE === 1 ? 'BNB' : 'BOTH'}`);
    console.log("");

    if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
        startChainScheduling("PLS");
    }
    if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
        startChainScheduling("BNB");
    }
}

startScheduler();
