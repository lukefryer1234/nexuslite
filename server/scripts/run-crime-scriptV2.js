const { exec } = require("child_process");
const util = require("util");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const execPromise = util.promisify(exec);

// Chain choice: 0 -> PLS, 1 -> BNB, 2 -> BOTH
const CHAIN_CHOICE = parseInt(process.env.CHAIN_CHOICE || "0");

// Randomization settings
const RANDOMIZE_CRIMES = process.env.RANDOMIZE_CRIMES === 'true'; // true/false
const BASE_INTERVAL_MINUTES = parseInt(process.env.CRIME_INTERVAL_MINUTES) || 16;
const TIME_VARIANCE_MINUTES = parseInt(process.env.TIME_VARIANCE_MINUTES) || 5; // ±5 min default

if (![0, 1, 2].includes(CHAIN_CHOICE)) {
    console.error("Error: CHAIN_CHOICE must be 0 (PLS), 1 (BNB), or 2 (BOTH).");
    process.exit(1);
}

// Helper function to get random integer in range [min, max]
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to get random crime type (0-3)
function getRandomCrimeType() {
    return randomInt(0, 3); // 0=Vendor, 1=Train, 2=Bank, 3=Police
}

// Helper function to calculate next delay with variance
function getDelayWithVariance(baseMinutes, varianceMinutes) {
    const variance = randomInt(-varianceMinutes, varianceMinutes);
    const totalMinutes = baseMinutes + variance;
    return totalMinutes * 60 * 1000; // Convert to milliseconds
}

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

// Get password with GLOBAL_PASSWORD fallback
function getPassword(keystoreName) {
    const specificPassword = process.env[`${keystoreName.toUpperCase()}_PASSWORD`];
    if (specificPassword) return specificPassword;
    
    // Check chain-specific password (set by ScriptSchedulerService)
    if (CHAIN_CHOICE === 1) {
        // BNB only - check BNB password first
        if (process.env.BNB_KEYSTORE_PASSWORD) return process.env.BNB_KEYSTORE_PASSWORD;
    } else if (CHAIN_CHOICE === 0) {
        // PLS only - check PLS password first
        if (process.env.PLS_KEYSTORE_PASSWORD) return process.env.PLS_KEYSTORE_PASSWORD;
    }
    
    // Global fallback
    return process.env.GLOBAL_PASSWORD || 
           process.env.PLS_KEYSTORE_PASSWORD?.split(',')[0]?.trim() ||
           process.env.BNB_KEYSTORE_PASSWORD || '';
}

// Get crime type - use global or per-wallet settings
function getCrimeType(keystoreName) {
    const specificType = process.env[`${keystoreName.toUpperCase()}_CRIME_TYPE`];
    if (specificType !== undefined) return parseInt(specificType);
    return parseInt(process.env.PLS_CRIME_TYPE?.split(',')[0]?.trim() || '0');
}

// If scheduler passed a specific wallet, use only that wallet (single-wallet mode)
// Otherwise fall back to auto-discovery (standalone mode)
let plsKeystoreNames, bnbKeystoreNames, plsKeystorePasswords, bnbKeystorePasswords;
let plsCrimeTypes, bnbCrimeTypes;

if (envPlsKeystore && CHAIN_CHOICE === 0) {
    // Single wallet mode - PLS
    plsKeystoreNames = [envPlsKeystore];
    plsKeystorePasswords = [envPlsPassword || getPassword(envPlsKeystore)];
    plsCrimeTypes = [getCrimeType(envPlsKeystore)];
    bnbKeystoreNames = [];
    bnbKeystorePasswords = [];
    bnbCrimeTypes = [];
    console.log(`[Config] Single-wallet mode (PLS): ${envPlsKeystore}`);
} else if (envBnbKeystore && CHAIN_CHOICE === 1) {
    // Single wallet mode - BNB
    plsKeystoreNames = [];
    plsKeystorePasswords = [];
    plsCrimeTypes = [];
    bnbKeystoreNames = [envBnbKeystore];
    bnbKeystorePasswords = [envBnbPassword || getPassword(envBnbKeystore)];
    bnbCrimeTypes = [getCrimeType(envBnbKeystore)];
    console.log(`[Config] Single-wallet mode (BNB): ${envBnbKeystore}`);
} else {
    // Standalone mode - discover all keystores
    const discoveredKeystores = discoverKeystores();
    
    if (discoveredKeystores.length === 0) {
        console.error("Error: No keystores found in " + KEYSTORE_DIR);
        process.exit(1);
    }
    
    plsKeystoreNames = (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
    bnbKeystoreNames = (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
    plsKeystorePasswords = plsKeystoreNames.map(name => getPassword(name));
    bnbKeystorePasswords = bnbKeystoreNames.map(name => getPassword(name));
    plsCrimeTypes = plsKeystoreNames.map(name => getCrimeType(name));
    bnbCrimeTypes = bnbKeystoreNames.map(name => getCrimeType(name));
}

// Validate passwords
if ((CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) && plsKeystorePasswords.some(p => !p)) {
    console.error("Error: Password not found for some wallets. Set GLOBAL_PASSWORD or individual passwords.");
    process.exit(1);
}


// Chain configurations with gas settings
const chains = {
    BNB: {
        rpcUrl: process.env.BNB_RPC_URL || "https://bsc-dataseed.bnbchain.org",
        script: "script/BNBCrime.s.sol:BNBCrime",
        keystoreNames: bnbKeystoreNames,
        keystorePasswords: bnbKeystorePasswords,
        crimeTypes: bnbCrimeTypes,
        maxGasPriceGwei: parseInt(process.env.BNB_MAX_GAS_PRICE_GWEI || "5"),
        gasPriceGwei: parseInt(process.env.BNB_GAS_PRICE_GWEI || "3"),
    },
    PLS: {
        rpcUrl: process.env.PLS_RPC_URL || "https://rpc-pulsechain.g4mm4.io",
        script: "script/PLSCrime.s.sol:PLSCrime",
        keystoreNames: plsKeystoreNames,
        keystorePasswords: plsKeystorePasswords,
        crimeTypes: plsCrimeTypes,
        maxGasPriceGwei: parseInt(process.env.PLS_MAX_GAS_PRICE_GWEI || "2000000"),
        gasPriceGwei: parseInt(process.env.PLS_GAS_PRICE_GWEI || "30"),
    },
};

// Analytics API URL (Nexus Lite server)
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:4001/api/scripts/crime/record';

// Report crime result to analytics service
async function reportToAnalytics(wallet, chain, crimeType, result) {
    try {
        const http = require('http');
        const data = JSON.stringify({
            wallet,
            chain,
            crimeType,
            success: result.success,
            jailed: result.error?.toLowerCase().includes('jail'),
            cooldown: result.error?.toLowerCase().includes('cooldown'),
            error: result.error
        });
        
        const url = new URL(ANALYTICS_API_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 4001,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        return new Promise((resolve) => {
            const req = http.request(options, (res) => {
                resolve(true);
            });
            req.on('error', () => resolve(false));
            req.write(data);
            req.end();
        });
    } catch (err) {
        console.error('Failed to report to analytics:', err.message);
        return false;
    }
}

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

// Function to run makeCrime for a single wallet
async function runMakeCrime(chainName, keystoreName, keystorePassword, crimeType) {
    let result;
    try {
        const chain = chains[chainName];
        
        // Gas price safety check - skip if current gas is above our max limit
        if (chain.maxGasPriceGwei > 0) {
            const currentGas = await getCurrentGasPrice(chain.rpcUrl);
            if (currentGas !== null) {
                const currentGwei = Number(currentGas / BigInt(1e9));
                if (currentGwei > chain.maxGasPriceGwei) {
                    console.log(`[${chainName}] ⛽ Gas too high for ${keystoreName}: ${currentGwei} gwei > ${chain.maxGasPriceGwei} gwei limit - skipping`);
                    return { success: false, gasTooHigh: true, currentGwei, maxGwei: chain.maxGasPriceGwei };
                }
            }
        }
        
        // Submit without --with-gas-price so forge auto-detects correct gas price
        // (using --with-gas-price can cause stuck txs if set too low for the network)
        const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword} --sig "run(uint8)" ${crimeType}`;

        const { stdout, stderr } = await execPromise(command, {
            cwd: "./foundry-crime-scripts",
        });
        
        // Log SUCCESS explicitly for GlobalLogService to capture
        console.log(`[SUCCESS] ${chainName} makeCrime (crimeType: ${crimeType}) executed successfully for ${keystoreName}`);
        result = { success: true, output: stdout };
    } catch (error) {
        const errorMsg = error.message || '';
        
        // Classify error for smarter retry scheduling
        const errLower = errorMsg.toLowerCase();
        let classification = 'error';
        if (errLower.includes('jail')) {
            console.log(`[WARN] ${chainName} ${keystoreName} is in jail - skipping crime`);
            classification = 'jail';
        } else if (errLower.includes('cooldown') || errLower.includes('crime cooldown')) {
            console.log(`[WARN] ${chainName} ${keystoreName} crime on cooldown - will retry later`);
            classification = 'cooldown';
        } else if (errLower.includes('not active')) {
            console.log(`[WARN] ${chainName} ${keystoreName} not active on this chain`);
            classification = 'notActive';
        } else if (errLower.includes('empty revert') || errLower.includes('revert')) {
            console.log(`[WARN] ${chainName} ${keystoreName} crime reverted (contract error)`);
            classification = 'reverted';
        } else if (errLower.includes('-32000') || errLower.includes('internal_error') || errLower.includes('failed to send transaction')) {
            console.log(`[WARN] ${chainName} ${keystoreName} RPC error (transient) - will retry later`);
            classification = 'rpc';
        } else {
            console.log(`[ERROR] ${chainName} makeCrime failed for ${keystoreName}: ${errorMsg.substring(0, 300)}`);
        }
        result = { success: false, error: errorMsg, classification };
    }
    
    // Report to analytics (fire and forget)
    reportToAnalytics(keystoreName, chainName, crimeType, result);
    
    return result;
}

// Function to schedule makeCrime for a single wallet
function scheduleWallet(chainName, keystoreName, keystorePassword, configuredCrimeType, walletIndex) {
    async function runAndReschedule() {
        // Determine crime type: random or configured
        const crimeType = RANDOMIZE_CRIMES ? getRandomCrimeType() : configuredCrimeType;

        console.log(`[${chainName}:${keystoreName}] Executing crime type ${crimeType} ${RANDOMIZE_CRIMES ? '(random)' : '(fixed)'}`);

        const result = await runMakeCrime(chainName, keystoreName, keystorePassword, crimeType);

        // Smart delay based on error classification
        let delay;
        const cls = result.classification || '';
        if (result.success || cls === 'cooldown' || cls === '') {
            // Normal cooldown - use standard interval with variance
            delay = getDelayWithVariance(BASE_INTERVAL_MINUTES, TIME_VARIANCE_MINUTES);
        } else if (cls === 'jail') {
            delay = 5 * 60 * 1000; // 5 min - jail is usually short
        } else if (cls === 'notActive') {
            delay = 6 * 60 * 60 * 1000; // 6h - needs manual fix
        } else if (cls === 'reverted') {
            delay = 15 * 60 * 1000; // 15 min - retry transient
        } else {
            delay = getDelayWithVariance(BASE_INTERVAL_MINUTES, TIME_VARIANCE_MINUTES);
        }

        const nextRunTime = new Date(Date.now() + delay);
        console.log(`${chainName} next run for ${keystoreName} scheduled for ${nextRunTime.toISOString()} (in ${(delay / 1000 / 60).toFixed(1)} minutes)${cls && cls !== 'cooldown' ? ` - ${cls}` : ''}`);
        setTimeout(runAndReschedule, delay);
    }

    // Add random initial delay to prevent all scripts from executing at once (nonce conflicts)
    const initialDelay = randomInt(5000, 60000); // 5-60 seconds random delay
    console.log(`[${chainName}:${keystoreName}] Starting in ${(initialDelay / 1000).toFixed(0)}s (staggered start to prevent nonce conflicts)`);
    setTimeout(runAndReschedule, initialDelay);
}

// Start scheduling for all wallets in a chain
function startChainScheduling(chainName) {
    const chain = chains[chainName];

    for (let i = 0; i < chain.keystoreNames.length; i++) {
        scheduleWallet(
            chainName,
            chain.keystoreNames[i],
            chain.keystorePasswords[i],
            chain.crimeTypes[i] || 0, // Default to 0 if randomizing
            i
        );
    }
}

// Start the scheduler
function startScheduler() {
    console.log(`Starting Crime Scheduler at ${new Date().toISOString()}`);
    console.log(`Settings: Base Interval=${BASE_INTERVAL_MINUTES}min, Variance=±${TIME_VARIANCE_MINUTES}min, Randomize=${RANDOMIZE_CRIMES}`);

    if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
        startChainScheduling("PLS");
    }
    if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
        startChainScheduling("BNB");
    }

    console.log("Crime Scheduler started successfully.");
    
    // Hourly gas price logging for monitoring
    async function logGasPrices() {
        const timestamp = new Date().toISOString();
        console.log(`\n⛽ [${timestamp}] HOURLY GAS REPORT:`);
        
        if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
            const plsGas = await getCurrentGasPrice(chains.PLS.rpcUrl);
            if (plsGas) {
                const plsGwei = Number(plsGas / BigInt(1e9));
                console.log(`   PLS: ${plsGwei.toFixed(0)} gwei (limit: ${chains.PLS.gasPriceGwei} gwei)`);
            }
        }
        if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
            const bnbGas = await getCurrentGasPrice(chains.BNB.rpcUrl);
            if (bnbGas) {
                const bnbGwei = Number(bnbGas / BigInt(1e9));
                console.log(`   BNB: ${bnbGwei.toFixed(2)} gwei (limit: ${chains.BNB.gasPriceGwei} gwei)`);
            }
        }
    }
    
    // Log gas prices every hour
    logGasPrices(); // Initial log
    setInterval(logGasPrices, 60 * 60 * 1000); // Hourly
}

startScheduler();
