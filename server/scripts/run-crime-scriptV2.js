const { exec } = require("child_process");
const util = require("util");
require("dotenv").config();

const execPromise = util.promisify(exec);

// Chain choice: 0 -> PLS, 1 -> BNB, 2 -> BOTH
const CHAIN_CHOICE = parseInt(process.env.CHAIN_CHOICE);

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

// Read keystore names and passwords based on CHAIN_CHOICE
const plsKeystoreNames = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2
    ? (process.env.PLS_KEYSTORE_NAME ? process.env.PLS_KEYSTORE_NAME.split(",").map((name) => name.trim()) : [])
    : [];

const bnbKeystoreNames = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2
    ? (process.env.BNB_KEYSTORE_NAME ? process.env.BNB_KEYSTORE_NAME.split(",").map((name) => name.trim()) : [])
    : [];

const plsKeystorePasswords = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2
    ? (process.env.PLS_KEYSTORE_PASSWORD ? process.env.PLS_KEYSTORE_PASSWORD.split(",").map((pw) => pw.trim()) : [])
    : [];

const bnbKeystorePasswords = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2
    ? (process.env.BNB_KEYSTORE_PASSWORD ? process.env.BNB_KEYSTORE_PASSWORD.split(",").map((pw) => pw.trim()) : [])
    : [];

const plsCrimeTypes = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2
    ? (process.env.PLS_CRIME_TYPE ? process.env.PLS_CRIME_TYPE.split(",").map((val) => parseInt(val.trim())) : [])
    : [];

const bnbCrimeTypes = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2
    ? (process.env.BNB_CRIME_TYPE ? process.env.BNB_CRIME_TYPE.split(",").map((val) => parseInt(val.trim())) : [])
    : [];

// Validation
if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
    if (plsKeystoreNames.length === 0) {
        console.error("Error: At least one PLS keystore name must be provided.");
        process.exit(1);
    }
    if (plsKeystoreNames.length !== plsKeystorePasswords.length) {
        console.error("Error: PLS keystore names and passwords count must match.");
        process.exit(1);
    }
    // Crime types optional if RANDOMIZE_CRIMES is true
    if (!RANDOMIZE_CRIMES && plsKeystoreNames.length !== plsCrimeTypes.length) {
        console.error("Error: PLS keystore names and crime types count must match (or enable RANDOMIZE_CRIMES).");
        process.exit(1);
    }
}

if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
    if (bnbKeystoreNames.length === 0) {
        console.error("Error: At least one BNB keystore name must be provided.");
        process.exit(1);
    }
    if (bnbKeystoreNames.length !== bnbKeystorePasswords.length) {
        console.error("Error: BNB keystore names and passwords count must match.");
        process.exit(1);
    }
    if (!RANDOMIZE_CRIMES && bnbKeystoreNames.length !== bnbCrimeTypes.length) {
        console.error("Error: BNB keystore names and crime types count must match (or enable RANDOMIZE_CRIMES).");
        process.exit(1);
    }
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

// Function to run makeCrime for a single wallet
async function runMakeCrime(chainName, keystoreName, keystorePassword, crimeType) {
    try {
        const chain = chains[chainName];
        const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword} --sig "run(uint8)" ${crimeType}`;

        const { stdout, stderr } = await execPromise(command, {
            cwd: "./foundry-crime-scripts",
        });
        console.log(`${chainName} makeCrime (crimeType: ${crimeType}) executed successfully for ${keystoreName}`);
        return { success: true, output: stdout };
    } catch (error) {
        console.error(`${chainName} makeCrime failed for ${keystoreName}:`, error.message);
        return { success: false, error: error.message };
    }
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
