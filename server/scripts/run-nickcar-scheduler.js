/**
 * Nick Car Scheduler - Steals cars every 30 minutes
 * Runs PARALLEL to crime scheduler on independent cooldown
 */
const { exec } = require("child_process");
const util = require("util");
require("dotenv").config();

const execPromise = util.promisify(exec);

// Chain choice: 0 -> PLS, 1 -> BNB, 2 -> BOTH
const CHAIN_CHOICE = parseInt(process.env.CHAIN_CHOICE || "0");

// Cooldown: 30 minutes (+ 1 minute buffer)
const COOLDOWN_MS = 31 * 60 * 1000;

// Read keystore config
const plsKeystoreNames = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2
    ? (process.env.PLS_KEYSTORE_NAME ? process.env.PLS_KEYSTORE_NAME.split(",").map(n => n.trim()) : [])
    : [];

const bnbKeystoreNames = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2
    ? (process.env.BNB_KEYSTORE_NAME ? process.env.BNB_KEYSTORE_NAME.split(",").map(n => n.trim()) : [])
    : [];

const plsKeystorePasswords = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2
    ? (process.env.PLS_KEYSTORE_PASSWORD ? process.env.PLS_KEYSTORE_PASSWORD.split(",").map(p => p.trim()) : [])
    : [];

const bnbKeystorePasswords = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2
    ? (process.env.BNB_KEYSTORE_PASSWORD ? process.env.BNB_KEYSTORE_PASSWORD.split(",").map(p => p.trim()) : [])
    : [];

// Chain configurations
const chains = {
    PLS: {
        rpcUrl: process.env.PLS_RPC_URL || "https://rpc-pulsechain.g4mm4.io",
        script: "script/PLSNickCar.s.sol:PLSNickCar",
        keystoreNames: plsKeystoreNames,
        keystorePasswords: plsKeystorePasswords,
    },
    BNB: {
        rpcUrl: process.env.BNB_RPC_URL || "https://bsc-dataseed.bnbchain.org",
        script: "script/BNBNickCar.s.sol:BNBNickCar",
        keystoreNames: bnbKeystoreNames,
        keystorePasswords: bnbKeystorePasswords,
    },
};

// Run nick car for a wallet
async function runNickCar(chainName, keystoreName, keystorePassword) {
    try {
        const chain = chains[chainName];
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
        // Check error for jail/cooldown
        const errMsg = error.message || "";
        if (errMsg.includes("jail")) {
            console.log(`[${chainName}] ⛓️ ${keystoreName} is in jail - waiting for release`);
            return { success: false, jailed: true };
        }
        console.error(`[${chainName}] ❌ Nick car FAILED for ${keystoreName}:`, error.message);
        return { success: false, error: error.message };
    }
}

// Schedule nick car for a wallet
function scheduleWallet(chainName, keystoreName, keystorePassword) {
    async function runAndReschedule() {
        const result = await runNickCar(chainName, keystoreName, keystorePassword);

        // If jailed, check again in 5 minutes
        const delay = result.jailed ? 5 * 60 * 1000 : COOLDOWN_MS;

        const nextRun = new Date(Date.now() + delay);
        console.log(`[${chainName}] 🚗 Next nick car for ${keystoreName}: ${nextRun.toISOString()} (${Math.round(delay / 60000)}m)`);
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
