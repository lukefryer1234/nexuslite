/**
 * Nick Car Scheduler - Steals cars every 30 minutes
 * Runs PARALLEL to crime scheduler on independent cooldown
 */
const { exec } = require("child_process");
const util = require("util");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const execPromise = util.promisify(exec);

// City names - nick car only works in cities 0-5
const CITY_NAMES = {
    0: 'New York', 1: 'Chicago', 2: 'Las Vegas',
    3: 'Detroit', 4: 'Los Angeles', 5: 'Miami',
    6: 'Atlantic City', 7: 'Philadelphia', 8: 'Boston',
    9: 'San Francisco', 10: 'Houston'
};

// MAP contract addresses for city detection
const MAP_CONTRACTS = {
    PLS: '0xE571Aa670EDeEBd88887eb5687576199652A714F',
    BNB: '0x1c88060e4509c59b4064A7a9818f64AeC41ef19E'
};

// Get wallet address from keystore
async function getWalletAddress(keystoreName, password) {
    try {
        const foundryBin = process.env.FOUNDRY_BIN || path.join(require('os').homedir(), '.foundry', 'bin');
        const { stdout } = await execPromise(
            `${foundryBin}/cast wallet address --account ${keystoreName} --password "${password}"`,
            { timeout: 10000 }
        );
        return stdout.trim();
    } catch (err) {
        console.error(`[Config] Failed to get address for ${keystoreName}:`, err.message?.substring(0, 80));
        return null;
    }
}

// Get player's current city
async function getPlayerCity(address, chainName, rpcUrl) {
    try {
        const foundryBin = process.env.FOUNDRY_BIN || path.join(require('os').homedir(), '.foundry', 'bin');
        const addressPadded = address.toLowerCase().replace('0x', '').padStart(64, '0');
        const calldata = `0x7c5dc38a${addressPadded}`;
        const { stdout } = await execPromise(
            `${foundryBin}/cast call ${MAP_CONTRACTS[chainName]} "${calldata}" --rpc-url ${rpcUrl}`,
            { timeout: 10000 }
        );
        const cityId = parseInt(stdout.trim(), 16);
        return { success: true, cityId, cityName: CITY_NAMES[cityId] || `City ${cityId}` };
    } catch (err) {
        return { success: false, error: err.message?.substring(0, 80) };
    }
}

// Default target city for auto-travel (New York = 0)
const DEFAULT_TARGET_CITY = 0;
// Default travel type (0=train, 1=car, 2=airplane) - train is safest/cheapest
const DEFAULT_TRAVEL_TYPE = 0;
// Default item ID for travel (0 = no special item needed for train)
const DEFAULT_ITEM_ID = 0;

// Travel delays based on travel type (in ms)
const TRAVEL_DELAYS = {
    0: (4 * 60 + 5) * 60 * 1000, // TRAIN: 4 hours + 5 mins buffer
    1: (2 * 60 + 5) * 60 * 1000, // CAR: 2 hours + 5 mins buffer  
    2: (1 * 60 + 5) * 60 * 1000, // AIRPLANE: 1 hour + 5 mins buffer
};

// Travel forge scripts per chain
const TRAVEL_SCRIPTS = {
    PLS: 'script/PLSTravel.s.sol:PLSTravel',
    BNB: 'script/BNBTravel.s.sol:BNBTravel'
};

// Travel player to a specific city
async function travelToCity(chainName, keystoreName, keystorePassword, targetCity = DEFAULT_TARGET_CITY) {
    try {
        const chain = chains[chainName];
        const travelType = DEFAULT_TRAVEL_TYPE;
        const itemId = DEFAULT_ITEM_ID;
        
        // Gas price safety check - skip if current gas is above our max limit
        if (chain.maxGasPriceGwei > 0) {
            const currentGas = await getCurrentGasPrice(chain.rpcUrl);
            if (currentGas !== null) {
                const currentGwei = Number(currentGas / BigInt(1e9));
                if (currentGwei > chain.maxGasPriceGwei) {
                    console.log(`[${chainName}:${keystoreName}] ⛽ Gas too high for travel: ${currentGwei} gwei > ${chain.maxGasPriceGwei} gwei limit - skipping`);
                    return { success: false, gasTooHigh: true };
                }
            }
        }
        
        // Submit without --with-gas-price so forge auto-detects correct gas price
        const command = `forge script ${TRAVEL_SCRIPTS[chainName]} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword} --sig "run(uint8,uint8,uint256)" ${targetCity} ${travelType} ${itemId}`;

        console.log(`[${chainName}:${keystoreName}] ✈️ Auto-traveling to ${CITY_NAMES[targetCity]}...`);
        const { stdout, stderr } = await execPromise(command, { 
            cwd: "./foundry-travel-scripts",
            timeout: 120000 // 2 minute timeout for travel tx
        });
        
        console.log(`[${chainName}:${keystoreName}] ✅ Travel initiated to ${CITY_NAMES[targetCity]}`);
        return { 
            success: true, 
            travelType,
            delay: TRAVEL_DELAYS[travelType],
            targetCity,
            targetCityName: CITY_NAMES[targetCity]
        };
    } catch (error) {
        const errMsg = error.message || '';
        const errLower = errMsg.toLowerCase();
        if (errLower.includes('jail')) {
            console.log(`[${chainName}:${keystoreName}] ⛓️ In jail - skipping auto-travel`);
        } else if (errLower.includes('travel not available') || errLower.includes('same city') || errLower.includes('not active')) {
            console.log(`[${chainName}:${keystoreName}] ⚠️ Auto-travel skipped (game state): ${errLower.includes('same city') ? 'already in target city' : errLower.includes('not active') ? 'not active user' : 'travel not available'}`);
        } else {
            console.error(`[${chainName}:${keystoreName}] ❌ Auto-travel failed: ${errMsg.substring(0, 200)}`);
        }
        return { success: false, error: errMsg };
    }
}

// Chain choice: 0 -> PLS, 1 -> BNB, 2 -> BOTH
const CHAIN_CHOICE = parseInt(process.env.CHAIN_CHOICE || "0");

// Cooldown: 30 minutes (+ 1 minute buffer)
const COOLDOWN_MS = 31 * 60 * 1000;

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
        script: "script/PLSNickCar.s.sol:PLSNickCar",
        keystoreNames: plsKeystoreNames,
        keystorePasswords: plsKeystorePasswords,
        maxGasPriceGwei: parseInt(process.env.PLS_MAX_GAS_PRICE_GWEI || "2000000"),
        gasPriceGwei: parseInt(process.env.PLS_GAS_PRICE_GWEI || "30"),
    },
    BNB: {
        rpcUrl: process.env.BNB_RPC_URL || "https://bsc-dataseed.bnbchain.org",
        script: "script/BNBNickCar.s.sol:BNBNickCar",
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

// Run nick car for a wallet
async function runNickCar(chainName, keystoreName, keystorePassword) {
    try {
        const chain = chains[chainName];
        
        // Skip city detection - the MAP contract getPlayerCity selector is broken
        // and returns garbage city IDs (e.g. 29). Just attempt nick car directly.
        // The contract revert message will tell us if we're in the wrong city.
        
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
        const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword}`;

        console.log(`[${chainName}] 🚗 Attempting to nick car for ${keystoreName}...`);
        const { stdout, stderr } = await execPromise(command, {
            cwd: "./foundry-crime-scripts",
        });

        // Check for jail
        if (stdout.includes("jail") || stderr.includes("jail")) {
            console.log(`[${chainName}] ⛓️ ${keystoreName} is in jail - waiting for release`);
            return { success: false, jailed: true };
        }

        // Check for cooldown
        if (stdout.includes("cooldown") || stderr.includes("cooldown")) {
            console.log(`[${chainName}] ⏰ ${keystoreName} nick car on cooldown`);
            return { success: false, cooldown: true };
        }

        console.log(`[${chainName}] ✅ Nick car SUCCESS for ${keystoreName}`);
        return { success: true, output: stdout };
    } catch (error) {
        // Check error for jail/cooldown/game state
        const errMsg = error.message || "";
        const errLower = errMsg.toLowerCase();
        if (errLower.includes('jail')) {
            console.log(`[${chainName}] ⛓️ ${keystoreName} is in jail - waiting for release`);
            return { success: false, jailed: true };
        } else if (errLower.includes('cooldown')) {
            console.log(`[${chainName}] ⏰ ${keystoreName} nick car on cooldown`);
            return { success: false, cooldown: true };
        } else if (errLower.includes('not active')) {
            console.log(`[${chainName}] ⚠️ ${keystoreName} not active on this chain - skipping`);
            return { success: false, notActive: true };
        } else if (errLower.includes('not enough allowance') || errLower.includes('insufficient')) {
            console.log(`[${chainName}] 💰 ${keystoreName} insufficient token allowance for nick car`);
            return { success: false, allowance: true };
        } else if (errLower.includes('empty revert') || errLower.includes('-32000')) {
            // Empty revert = contract call failed (NOT cooldown)
            console.log(`[${chainName}] ⚠️ ${keystoreName} nick car tx reverted (contract error, not cooldown)`);
            return { success: false, reverted: true };
        } else {
            console.error(`[${chainName}] ❌ Nick car FAILED for ${keystoreName}: ${errMsg.substring(0, 300)}`);
        }
        return { success: false, error: errMsg };
    }
}

// Schedule nick car for a wallet
function scheduleWallet(chainName, keystoreName, keystorePassword) {
    async function runAndReschedule() {
        const result = await runNickCar(chainName, keystoreName, keystorePassword);

        // Delay calculation:
        // - Jailed: 5 minutes (short retry)
        // - Not active: 6 hours (no point retrying often)
        // - Allowance: 2 hours (needs manual fix)
        // - Reverted: 15 minutes (transient - retry soon)
        // - Normal: 31 minutes (standard cooldown)
        let delay = COOLDOWN_MS;
        let reason = '';
        
        if (result.jailed) {
            delay = 5 * 60 * 1000; // 5 min
            reason = 'jailed';
        } else if (result.notActive) {
            delay = 6 * 60 * 60 * 1000; // 6 hours
            reason = 'not active';
        } else if (result.allowance) {
            delay = 2 * 60 * 60 * 1000; // 2 hours
            reason = 'needs token allowance';
        } else if (result.reverted) {
            delay = 15 * 60 * 1000; // 15 min
            reason = 'tx reverted';
        } else if (result.success) {
            reason = 'cooldown';
        }

        const nextRun = new Date(Date.now() + delay);
        console.log(`[${chainName}] 🚗 Next nick car for ${keystoreName}: ${nextRun.toISOString()} (${Math.round(delay / 60000)}m)${reason ? ` - ${reason}` : ''}`);
        setTimeout(runAndReschedule, delay);
    }

    // Add random offset (0-60s) to avoid all wallets hitting at same time
    const initialDelay = Math.floor(Math.random() * 60000);
    console.log(`[${chainName}] 🚗 Starting nick car scheduler for ${keystoreName} in ${Math.round(initialDelay / 1000)}s`);
    setTimeout(runAndReschedule, initialDelay);
}

// Start scheduling for all wallets in a chain
function startChainScheduling(chainName) {
    const chain = chains[chainName];
    if (!chain.keystoreNames.length) {
        console.log(`[${chainName}] No keystores configured for nick car`);
        return;
    }

    for (let i = 0; i < chain.keystoreNames.length; i++) {
        scheduleWallet(chainName, chain.keystoreNames[i], chain.keystorePasswords[i]);
    }
}

// Start the scheduler
function startScheduler() {
    console.log(`\n🚗 NICK CAR SCHEDULER starting at ${new Date().toISOString()}`);
    console.log(`   Cooldown: ${COOLDOWN_MS / 60000} minutes`);
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
