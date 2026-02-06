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

// Auto-discover keystores from Foundry directory
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

const discoveredKeystores = discoverKeystores();
const plsKeystoreNames = (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
const bnbKeystoreNames = (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
const plsKeystorePasswords = plsKeystoreNames.map(name => getPassword(name));
const bnbKeystorePasswords = bnbKeystoreNames.map(name => getPassword(name));

// Chain configurations with gas settings
const chains = {
    PLS: {
        rpcUrl: process.env.PLS_RPC_URL || "https://rpc-pulsechain.g4mm4.io",
        script: "script/PLSKillSkill.s.sol:PLSKillSkill",
        keystoreNames: plsKeystoreNames,
        keystorePasswords: plsKeystorePasswords,
        maxGasPriceGwei: parseInt(process.env.PLS_MAX_GAS_PRICE_GWEI || "50"),
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
        
        // Check current gas price against max
        if (chain.maxGasPriceGwei > 0) {
            const currentGas = await getCurrentGasPrice(chain.rpcUrl);
            const maxGasWei = BigInt(chain.maxGasPriceGwei) * BigInt(1e9);
            
            if (currentGas && currentGas > maxGasWei) {
                const currentGwei = Number(currentGas / BigInt(1e9));
                console.log(`[${chainName}:${keystoreName}] ⏸️ Gas too high: ${currentGwei.toFixed(0)} gwei > ${chain.maxGasPriceGwei} gwei max. Skipping.`);
                return { success: false, error: `Gas price too high: ${currentGwei.toFixed(0)} gwei` };
            }
        }
        
        // Build command with gas price limit
        const gasPriceWei = chain.gasPriceGwei * 1e9;
        const gasFlag = chain.gasPriceGwei > 0 ? ` --with-gas-price ${gasPriceWei}` : '';
        const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword}${gasFlag} --sig "run(uint8)" ${trainType}`;

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
        console.error(`[${chainName}] ❌ Kill skill training FAILED for ${keystoreName}:`, error.message);
        return { success: false, error: error.message };
    }
}

// Schedule kill skill for a wallet
function scheduleWallet(chainName, keystoreName, keystorePassword) {
    async function runAndReschedule() {
        const result = await runKillSkill(chainName, keystoreName, keystorePassword, TRAIN_TYPE);

        const nextRun = new Date(Date.now() + COOLDOWN_MS);
        console.log(`[${chainName}] 🎯 Next kill skill for ${keystoreName}: ${nextRun.toISOString()} (${Math.round(COOLDOWN_MS / 60000)}m)`);
        setTimeout(runAndReschedule, COOLDOWN_MS);
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
