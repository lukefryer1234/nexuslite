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

// Get password with GLOBAL_PASSWORD fallback
function getPassword(keystoreName) {
    const specificPassword = process.env[`${keystoreName.toUpperCase()}_PASSWORD`];
    if (specificPassword) return specificPassword;
    return process.env.GLOBAL_PASSWORD || 
           process.env.PLS_KEYSTORE_PASSWORD?.split(',')[0]?.trim() || '';
}

// Get crime type - use global or per-wallet settings
function getCrimeType(keystoreName) {
    const specificType = process.env[`${keystoreName.toUpperCase()}_CRIME_TYPE`];
    if (specificType !== undefined) return parseInt(specificType);
    return parseInt(process.env.PLS_CRIME_TYPE?.split(',')[0]?.trim() || '0');
}

// Auto-discover all keystores
const discoveredKeystores = discoverKeystores();

if (discoveredKeystores.length === 0) {
    console.error("Error: No keystores found in " + KEYSTORE_DIR);
    process.exit(1);
}

// Build keystore arrays for each chain
const plsKeystoreNames = (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
const bnbKeystoreNames = (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) ? discoveredKeystores : [];
const plsKeystorePasswords = plsKeystoreNames.map(name => getPassword(name));
const bnbKeystorePasswords = bnbKeystoreNames.map(name => getPassword(name));
const plsCrimeTypes = plsKeystoreNames.map(name => getCrimeType(name));
const bnbCrimeTypes = bnbKeystoreNames.map(name => getCrimeType(name));

// Validate passwords
if ((CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) && plsKeystorePasswords.some(p => !p)) {
    console.error("Error: Password not found for some wallets. Set GLOBAL_PASSWORD or individual passwords.");
    process.exit(1);
}


// Chain configurations
const chains = {
    BNB: {
        rpcUrl: process.env.BNB_RPC_URL || "https://bsc-dataseed.bnbchain.org",
        script: "script/BNBCrime.s.sol:BNBCrime",
        keystoreNames: bnbKeystoreNames,
        keystorePasswords: bnbKeystorePasswords,
        crimeTypes: bnbCrimeTypes,
    },
    PLS: {
        rpcUrl: process.env.PLS_RPC_URL || "https://rpc-pulsechain.g4mm4.io",
        script: "script/PLSCrime.s.sol:PLSCrime",
        keystoreNames: plsKeystoreNames,
        keystorePasswords: plsKeystorePasswords,
        crimeTypes: plsCrimeTypes,
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

// Function to run makeCrime for a single wallet
async function runMakeCrime(chainName, keystoreName, keystorePassword, crimeType) {
    let result;
    try {
        const chain = chains[chainName];
        const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword} --sig "run(uint8)" ${crimeType}`;

        const { stdout, stderr } = await execPromise(command, {
            cwd: "./foundry-crime-scripts",
        });
        console.log(`${chainName} makeCrime (crimeType: ${crimeType}) executed successfully for ${keystoreName}`);
        result = { success: true, output: stdout };
    } catch (error) {
        console.error(`${chainName} makeCrime failed for ${keystoreName}:`, error.message);
        result = { success: false, error: error.message };
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

        // Calculate next delay with variance
        const delay = getDelayWithVariance(BASE_INTERVAL_MINUTES, TIME_VARIANCE_MINUTES);
        const nextRunTime = new Date(Date.now() + delay);

        console.log(`${chainName} next run for ${keystoreName} scheduled for ${nextRunTime.toISOString()} (in ${(delay / 1000 / 60).toFixed(1)} minutes)`);
        setTimeout(runAndReschedule, delay);
    }

    runAndReschedule();
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
}

startScheduler();
