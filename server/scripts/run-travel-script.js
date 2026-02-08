const { exec } = require("child_process");
const util = require("util");
require("dotenv").config();

// Promisify exec for async/await
const execPromise = util.promisify(exec);

// Chain choice: 0 -> PLS, 1 -> BNB, 2 -> BOTH
const CHAIN_CHOICE = parseInt(process.env.CHAIN_CHOICE);

// Validate CHAIN_CHOICE
if (![0, 1, 2].includes(CHAIN_CHOICE)) {
  console.error("Error: CHAIN_CHOICE must be 0 (PLS), 1 (BNB), or 2 (BOTH).");
  process.exit(1);
}

// Check if ScriptSchedulerService passed a single wallet via env vars
// When spawned by the scheduler, each process handles ONE wallet only
const envPlsKeystore = process.env.PLS_KEYSTORE_NAME;
const envBnbKeystore = process.env.BNB_KEYSTORE_NAME;
const envPlsPassword = process.env.PLS_KEYSTORE_PASSWORD;
const envBnbPassword = process.env.BNB_KEYSTORE_PASSWORD;

let plsKeystoreNames, bnbKeystoreNames, plsKeystorePasswords, bnbKeystorePasswords;
let plsItemIds, bnbItemIds, plsStartCities, bnbStartCities, plsEndCities, bnbEndCities, plsTravelTypes, bnbTravelTypes;

if (envPlsKeystore && CHAIN_CHOICE === 0) {
  // Single wallet mode - PLS (spawned by ScriptSchedulerService)
  plsKeystoreNames = [envPlsKeystore];
  plsKeystorePasswords = [envPlsPassword || ''];
  plsItemIds = [parseInt(process.env.PLS_ITEM_IDS || '0') || 0];
  plsStartCities = [parseInt(process.env.PLS_START_CITY || '0') || 0];
  plsEndCities = [parseInt(process.env.PLS_END_CITY || '1') || 0];
  plsTravelTypes = [parseInt(process.env.PLS_TRAVEL_TYPE || '0')];
  bnbKeystoreNames = [];
  bnbKeystorePasswords = [];
  bnbItemIds = [];
  bnbStartCities = [];
  bnbEndCities = [];
  bnbTravelTypes = [];
  console.log(`[Config] Single-wallet mode (PLS): ${envPlsKeystore}`);
} else if (envBnbKeystore && CHAIN_CHOICE === 1) {
  // Single wallet mode - BNB (spawned by ScriptSchedulerService)
  plsKeystoreNames = [];
  plsKeystorePasswords = [];
  plsItemIds = [];
  plsStartCities = [];
  plsEndCities = [];
  plsTravelTypes = [];
  bnbKeystoreNames = [envBnbKeystore];
  bnbKeystorePasswords = [envBnbPassword || ''];
  bnbItemIds = [parseInt(process.env.BNB_ITEM_IDS || '0') || 0];
  bnbStartCities = [parseInt(process.env.BNB_START_CITY || '0') || 0];
  bnbEndCities = [parseInt(process.env.BNB_END_CITY || '1') || 0];
  bnbTravelTypes = [parseInt(process.env.BNB_TRAVEL_TYPE || '0')];
  console.log(`[Config] Single-wallet mode (BNB): ${envBnbKeystore}`);
} else {
  // Standalone mode - read comma-separated lists from env vars
  plsKeystoreNames = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_KEYSTORE_NAME ? process.env.PLS_KEYSTORE_NAME.split(",").map((name) => name.trim()) : []) : [];
  bnbKeystoreNames = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_KEYSTORE_NAME ? process.env.BNB_KEYSTORE_NAME.split(",").map((name) => name.trim()) : []) : [];
  plsKeystorePasswords = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_KEYSTORE_PASSWORD ? process.env.PLS_KEYSTORE_PASSWORD.split(",").map((pw) => pw.trim()) : []) : [];
  bnbKeystorePasswords = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_KEYSTORE_PASSWORD ? process.env.BNB_KEYSTORE_PASSWORD.split(",").map((pw) => pw.trim()) : []) : [];

  plsItemIds = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_ITEM_IDS ? process.env.PLS_ITEM_IDS.split(",").map((id) => parseInt(id.trim()) || 0) : []) : [];
  bnbItemIds = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_ITEM_IDS ? process.env.BNB_ITEM_IDS.split(",").map((id) => parseInt(id.trim()) || 0) : []) : [];
  plsStartCities = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_START_CITY ? process.env.PLS_START_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
  bnbStartCities = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_START_CITY ? process.env.BNB_START_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
  plsEndCities = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_END_CITY ? process.env.PLS_END_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
  bnbEndCities = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_END_CITY ? process.env.BNB_END_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
  plsTravelTypes = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_TRAVEL_TYPE ? process.env.PLS_TRAVEL_TYPE.split(",").map((type) => parseInt(type.trim()) || 0) : []) : [];
  bnbTravelTypes = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_TRAVEL_TYPE ? process.env.BNB_TRAVEL_TYPE.split(",").map((type) => parseInt(type.trim()) || 0) : []) : [];
}

// Valid cities for travel - only base cities 0-5 where nick car works
// Extended cities (6-29) don't support nick car, so we restrict travel to base cities only
const VALID_CITIES = [0, 1, 2, 3, 4, 5]; // New York, Chicago, Las Vegas, Detroit, Los Angeles, Miami

// Validate destination cities
const validateCities = (endCities, chainName) => {
  for (let i = 0; i < endCities.length; i++) {
    if (!VALID_CITIES.includes(endCities[i])) {
      console.error(`Error: [${chainName}] Invalid destination city ${endCities[i]}. Only base cities 0-5 are allowed.`);
      console.error(`Valid cities: 0=New York, 1=Chicago, 2=Las Vegas, 3=Detroit, 4=Los Angeles, 5=Miami`);
      process.exit(1);
    }
  }
};

if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
  validateCities(plsEndCities, 'PLS');
}
if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
  validateCities(bnbEndCities, 'BNB');
}


// Validate inputs
if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
  if (plsKeystoreNames.length === 0) {
    console.error("Error: At least one PLS keystore name must be provided when CHAIN_CHOICE is 0 or 2.");
    process.exit(1);
  }
  if (
    plsKeystoreNames.length !== plsKeystorePasswords.length ||
    plsKeystoreNames.length !== plsItemIds.length ||
    plsKeystoreNames.length !== plsStartCities.length ||
    plsKeystoreNames.length !== plsEndCities.length ||
    plsKeystoreNames.length !== plsTravelTypes.length
  ) {
    console.error("Error: Number of PLS keystore names must match number of passwords, item IDs, cities, and travel types.");
    process.exit(1);
  }
}

if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
  if (bnbKeystoreNames.length === 0) {
    console.error("Error: At least one BNB keystore name must be provided when CHAIN_CHOICE is 1 or 2.");
    process.exit(1);
  }
  if (
    bnbKeystoreNames.length !== bnbKeystorePasswords.length ||
    bnbKeystoreNames.length !== bnbItemIds.length ||
    bnbKeystoreNames.length !== bnbStartCities.length ||
    bnbKeystoreNames.length !== bnbEndCities.length ||
    bnbKeystoreNames.length !== bnbTravelTypes.length
  ) {
    console.error("Error: Number of BNB keystore names must match number of passwords, item IDs, cities, and travel types.");
    process.exit(1);
  }
}

// Chain configurations with gas settings
const chains = {
  BNB: {
    rpcUrl: process.env.BNB_RPC_URL || "https://bsc-dataseed.bnbchain.org",
    script: "script/BNBTravel.s.sol:BNBTravel",
    keystoreNames: bnbKeystoreNames,
    keystorePasswords: bnbKeystorePasswords,
    itemIds: bnbItemIds,
    startCities: bnbStartCities,
    endCities: bnbEndCities,
    travelTypes: bnbTravelTypes,
    maxGasPriceGwei: parseInt(process.env.BNB_MAX_GAS_PRICE_GWEI || "5"),
    gasPriceGwei: parseInt(process.env.BNB_GAS_PRICE_GWEI || "3"),
  },
  PLS: {
    rpcUrl: process.env.PLS_RPC_URL || "https://rpc-pulsechain.g4mm4.io",
    script: "script/PLSTravel.s.sol:PLSTravel",
    keystoreNames: plsKeystoreNames,
    keystorePasswords: plsKeystorePasswords,
    itemIds: plsItemIds,
    startCities: plsStartCities,
    endCities: plsEndCities,
    travelTypes: plsTravelTypes,
    maxGasPriceGwei: parseInt(process.env.PLS_MAX_GAS_PRICE_GWEI || "2000000"),
    gasPriceGwei: parseInt(process.env.PLS_GAS_PRICE_GWEI || "30"),
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

// City names for logging
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

// Get wallet address from keystore (uses temp password file to avoid shell expansion of special chars like !!)
async function getWalletAddress(keystoreName, password) {
  const tempPwPath = `/tmp/pw_addr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    const foundryBin = process.env.FOUNDRY_BIN || require('path').join(require('os').homedir(), '.foundry', 'bin');
    require('fs').writeFileSync(tempPwPath, password, { mode: 0o600 });
    const { stdout } = await execPromise(
      `${foundryBin}/cast wallet address --account ${keystoreName} --password-file ${tempPwPath}`,
      { timeout: 10000 }
    );
    return stdout.trim();
  } catch (err) {
    console.error(`[Config] Failed to get address for ${keystoreName}:`, err.message?.substring(0, 80));
    return null;
  } finally {
    try { require('fs').unlinkSync(tempPwPath); } catch(e) {}
  }
}

// Get player's current city
async function getPlayerCity(address, chainName, rpcUrl) {
  try {
    const foundryBin = process.env.FOUNDRY_BIN || require('path').join(require('os').homedir(), '.foundry', 'bin');
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

// Travel type to delay mapping (in hours, converted to milliseconds)
const travelDelays = {
  0: (4 * 60 + 5) * 60 * 1000, // TRAIN: 4 hours + 5 mins buffer
  1: (2 * 60 + 5) * 60 * 1000, // CAR/MOTORCYCLE: 2 hours + 5 mins buffer
  2: (1 * 60 + 5) * 60 * 1000, // AIRPLANE: 1 hour + 5 mins buffer
  3: 15 * 60 * 1000, // RETRY: 15 minutes for failed transactions
};

// MAFIA token addresses per chain
const MAFIA_TOKEN = {
  PLS: '0xa27aDe5806Ded801b93499C6fA23cc8dC9AC55EA',
  BNB: '0x3cb3F4f43D4Be61AA92BB4EEFfe7142A13bf4111'
};

// Travel contract addresses (spenders that need allowance)
const TRAVEL_CONTRACTS = {
  PLS: '0x7FB6A056877c1da14a63bFECdE95ebbFa854f07F',
  BNB: '0xa08D627E071cB4b53C6D0611d77dbCB659902AA4'
};

// Check and auto-approve MAFIA tokens for travel if needed
async function ensureTravelAllowance(chainName, keystoreName, keystorePassword, rpcUrl) {
  try {
    const foundryBin = process.env.FOUNDRY_BIN || require('path').join(require('os').homedir(), '.foundry', 'bin');
    const walletAddress = await getWalletAddress(keystoreName, keystorePassword);
    if (!walletAddress) return { success: false, error: 'Could not get wallet address' };

    const mafiaToken = MAFIA_TOKEN[chainName];
    const travelContract = TRAVEL_CONTRACTS[chainName];
    if (!mafiaToken || !travelContract) return { success: false, error: 'Unknown chain' };

    // Check current allowance
    const { stdout: allowanceRaw } = await execPromise(
      `${foundryBin}/cast call ${mafiaToken} "allowance(address,address)(uint256)" ${walletAddress} ${travelContract} --rpc-url ${rpcUrl}`,
      { timeout: 10000 }
    );
    
    // cast call outputs "NUMBER [SCIENTIFIC]" e.g. "12345 [1.234e4]" — extract just the number
    const allowanceStr = allowanceRaw.trim().split(/[\s\[]/)[0];
    const allowance = BigInt(allowanceStr || '0');
    // If allowance is already large enough (> 1M tokens with 18 decimals), skip
    const threshold = BigInt('1000000000000000000000000'); // 1M tokens
    if (allowance >= threshold) {
      return { success: true, alreadyApproved: true };
    }

    console.log(`[${chainName}] 💰 ${keystoreName} needs MAFIA token approval for travel, sending approve tx...`);

    // Send approve for max uint256
    const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    
    // Write password to temp file for cast send
    const tempPwPath = `/tmp/pw_travel_approve_${Date.now()}`;
    require('fs').writeFileSync(tempPwPath, keystorePassword, { mode: 0o600 });
    
    try {
      const { stdout, stderr } = await execPromise(
        `${foundryBin}/cast send ${mafiaToken} "approve(address,uint256)" ${travelContract} ${maxApproval} --rpc-url ${rpcUrl} --account ${keystoreName} --password-file ${tempPwPath}`,
        { timeout: 60000 }
      );
      console.log(`[${chainName}] ✅ ${keystoreName} MAFIA token approved for travel: ${stdout.trim().substring(0, 66)}`);
      return { success: true, approved: true };
    } finally {
      try { require('fs').unlinkSync(tempPwPath); } catch(e) {}
    }
  } catch (error) {
    console.log(`[${chainName}] ⚠️ ${keystoreName} auto-approve failed: ${(error.message || '').substring(0, 100)}`);
    return { success: false, error: error.message };
  }
}

// Function to run travel for a single wallet
async function runTravel(chainName, keystoreName, keystorePassword, destinationCity, travelType, itemId) {
  try {
    const chain = chains[chainName];
    
    // Auto-approve MAFIA tokens if needed (one-time operation)
    await ensureTravelAllowance(chainName, keystoreName, keystorePassword, chain.rpcUrl);
    
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
    // Use --password-file to avoid shell expansion issues with special chars (e.g. !!)
    const tempPwPath = `/tmp/pw_travel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    require('fs').writeFileSync(tempPwPath, keystorePassword, { mode: 0o600 });
    try {
    const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password-file ${tempPwPath} --sig "run(uint8,uint8,uint256)" ${destinationCity} ${travelType} ${itemId}`;

    const { stdout, stderr } = await execPromise(command, { cwd: "./foundry-travel-scripts" });
    console.log(`[SUCCESS] ${chainName} travel to city ${destinationCity} (type: ${travelType}) executed for ${keystoreName}`);

    return { success: true };
    } finally {
      try { require('fs').unlinkSync(tempPwPath); } catch(e) {}
    }
  } catch (error) {
    const errMsg = error.message || '';
    const errLower = errMsg.toLowerCase();
    
    // Classify the error for smarter retry scheduling
    let classification = 'error';
    if (errLower.includes('jail')) {
      console.log(`[WARN] ${chainName} ${keystoreName} is in jail - skipping travel`);
      classification = 'jail';
    } else if (errLower.includes('cooldown') || errLower.includes('travel not available')) {
      console.log(`[WARN] ${chainName} ${keystoreName} travel not available (cooldown/already traveling) - will retry`);
      classification = 'cooldown';
    } else if (errLower.includes('same city')) {
      console.log(`[WARN] ${chainName} ${keystoreName} already in target city - switching destination`);
      classification = 'sameCity';
    } else if (errLower.includes('not active')) {
      console.log(`[WARN] ${chainName} ${keystoreName} not active user on this chain`);
      classification = 'notActive';
    } else if (errLower.includes('not enough allowance')) {
      console.log(`[WARN] ${chainName} ${keystoreName} insufficient token allowance for travel`);
      classification = 'allowance';
    } else if (errLower.includes('-32000') || errLower.includes('internal_error')) {
      console.log(`[WARN] ${chainName} ${keystoreName} RPC error (transient) - will retry`);
      classification = 'rpc';
    } else {
      console.log(`[ERROR] ${chainName} travel failed for ${keystoreName}: ${errMsg.substring(0, 300)}`);
    }
    return { success: false, error: errMsg, classification };
  }
}

// Function to schedule travel for a single wallet with to-and-fro logic
function scheduleWallet(chainName, keystoreName, keystorePassword, itemId, startCity, endCity, travelType) {
  let isStartCity = true; // Start by traveling to startCity
  let initializedPosition = false; // Track if we've verified/moved to start position

  async function runAndReschedule() {
    const chain = chains[chainName];
    
    // Skip broken city detection - just start travel loop directly
    // The contract will tell us if we're already at the destination
    if (!initializedPosition) {
      console.log(`[${chainName}:${keystoreName}] 🛫 Starting travel loop: ${CITY_NAMES[startCity] || startCity} ↔ ${CITY_NAMES[endCity] || endCity} (type ${travelType})`);
      initializedPosition = true;
    }

    // Normal travel loop
    const destinationCity = isStartCity ? startCity : endCity;
    const result = await runTravel(chainName, keystoreName, keystorePassword, destinationCity, travelType, itemId);

    let delay;
    let nextDestination;

    if (result.success) {
      // If successful, toggle cities and use normal travel delay
      isStartCity = !isStartCity;
      delay = travelDelays[travelType];
      nextDestination = isStartCity ? startCity : endCity;

      console.log(`${chainName} next travel for ${keystoreName} to ${CITY_NAMES[nextDestination] || `city ${nextDestination}`} scheduled for ${new Date(Date.now() + delay).toISOString()} (in ${delay / 1000 / 60} minutes)`);
    } else {
      // Check error classification for smarter delays
      const errMsg = (result.error || '').toLowerCase();
      const cls = result.classification || '';
      
      if (cls === 'sameCity' || errMsg.includes('same city') || errMsg.includes('already in target')) {
        // We're already at this city - flip to the other one and try quickly
        isStartCity = !isStartCity;
        delay = 30 * 1000; // 30 seconds
        nextDestination = isStartCity ? startCity : endCity;
        console.log(`${chainName} ${keystoreName} already at ${CITY_NAMES[destinationCity] || destinationCity}, flipping to ${CITY_NAMES[nextDestination] || nextDestination} in 30s`);
      } else if (cls === 'notActive') {
        // Not active on this chain - long delay, no point retrying often
        delay = 6 * 60 * 60 * 1000; // 6 hours
        nextDestination = destinationCity;
        console.log(`${chainName} ${keystoreName} not active - next retry in 6h`);
      } else if (cls === 'allowance') {
        // Needs token allowance - manual fix needed
        delay = 2 * 60 * 60 * 1000; // 2 hours
        nextDestination = destinationCity;
        console.log(`${chainName} ${keystoreName} needs token allowance - next retry in 2h`);
      } else if (cls === 'jail') {
        // In jail - short retry
        delay = 5 * 60 * 1000; // 5 minutes
        nextDestination = destinationCity;
        console.log(`${chainName} ${keystoreName} in jail - next retry in 5m`);
      } else if (cls === 'cooldown') {
        // Cooldown depends on vehicle type - wait the full travel duration
        delay = travelDelays[travelType] || travelDelays[0];
        nextDestination = destinationCity;
        console.log(`${chainName} ${keystoreName} on cooldown - next retry in ${Math.round(delay / 60000)}m (${['train','car','airplane'][travelType] || 'train'} cooldown)`);
      } else {
        // Other failure (RPC, unknown) - retry after 15 minutes
        delay = travelDelays[3]; // 15 minutes retry delay
        nextDestination = destinationCity;
        console.log(
          `${chainName} RETRY for ${keystoreName} to ${CITY_NAMES[nextDestination] || `city ${nextDestination}`} scheduled for ${new Date(Date.now() + delay).toISOString()} (in ${delay / 1000 / 60} minutes) due to ${cls || 'transaction failure'}`
        );
      }
    }

    setTimeout(runAndReschedule, delay);
  }

  // Add random initial delay to prevent nonce conflicts when multiple scripts start at once
  const initialDelay = Math.floor(Math.random() * 90000); // 0-90 seconds
  console.log(`[${chainName}] 🛫 Starting travel scheduler for ${keystoreName} in ${Math.round(initialDelay / 1000)}s`);
  setTimeout(runAndReschedule, initialDelay);
}

// Function to start scheduling for all wallets on a chain
function startChainScheduling(chainName) {
  const chain = chains[chainName];

  for (let i = 0; i < chain.keystoreNames.length; i++) {
    scheduleWallet(chainName, chain.keystoreNames[i], chain.keystorePasswords[i], chain.itemIds[i], chain.startCities[i], chain.endCities[i], chain.travelTypes[i]);
  }
}

// Main function to start scheduling based on CHAIN_CHOICE
function startScheduler() {
  console.log(`Starting scheduler at ${new Date().toISOString()}`);

  if (CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2) {
    startChainScheduling("PLS");
  }
  if (CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2) {
    startChainScheduling("BNB");
  }
}

// Start the scheduler
startScheduler();
