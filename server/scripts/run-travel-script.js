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

// Read variables based on CHAIN_CHOICE
const plsKeystoreNames = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_KEYSTORE_NAME ? process.env.PLS_KEYSTORE_NAME.split(",").map((name) => name.trim()) : []) : [];
const bnbKeystoreNames = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_KEYSTORE_NAME ? process.env.BNB_KEYSTORE_NAME.split(",").map((name) => name.trim()) : []) : [];
const plsKeystorePasswords = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_KEYSTORE_PASSWORD ? process.env.PLS_KEYSTORE_PASSWORD.split(",").map((pw) => pw.trim()) : []) : [];
const bnbKeystorePasswords = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_KEYSTORE_PASSWORD ? process.env.BNB_KEYSTORE_PASSWORD.split(",").map((pw) => pw.trim()) : []) : [];

const plsItemIds = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_ITEM_IDS ? process.env.PLS_ITEM_IDS.split(",").map((id) => parseInt(id.trim()) || 0) : []) : [];
const bnbItemIds = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_ITEM_IDS ? process.env.BNB_ITEM_IDS.split(",").map((id) => parseInt(id.trim()) || 0) : []) : [];
const plsStartCities = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_START_CITY ? process.env.PLS_START_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
const bnbStartCities = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_START_CITY ? process.env.BNB_START_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
const plsEndCities = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_END_CITY ? process.env.PLS_END_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
const bnbEndCities = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_END_CITY ? process.env.BNB_END_CITY.split(",").map((city) => parseInt(city.trim()) || 0) : []) : [];
const plsTravelTypes = CHAIN_CHOICE === 0 || CHAIN_CHOICE === 2 ? (process.env.PLS_TRAVEL_TYPE ? process.env.PLS_TRAVEL_TYPE.split(",").map((type) => parseInt(type.trim()) || 0) : []) : [];
const bnbTravelTypes = CHAIN_CHOICE === 1 || CHAIN_CHOICE === 2 ? (process.env.BNB_TRAVEL_TYPE ? process.env.BNB_TRAVEL_TYPE.split(",").map((type) => parseInt(type.trim()) || 0) : []) : [];

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
    maxGasPriceGwei: parseInt(process.env.PLS_MAX_GAS_PRICE_GWEI || "100"),
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

// Get wallet address from keystore
async function getWalletAddress(keystoreName, password) {
  try {
    const foundryBin = process.env.FOUNDRY_BIN || require('path').join(require('os').homedir(), '.foundry', 'bin');
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

// Function to run travel for a single wallet
async function runTravel(chainName, keystoreName, keystorePassword, destinationCity, travelType, itemId) {
  try {
    const chain = chains[chainName];
    
    // Check current gas price against max
    if (chain.maxGasPriceGwei > 0) {
      const currentGas = await getCurrentGasPrice(chain.rpcUrl);
      const maxGasWei = BigInt(chain.maxGasPriceGwei) * BigInt(1e9);
      
      if (currentGas && currentGas > maxGasWei) {
        const currentGwei = Number(currentGas / BigInt(1e9));
        console.log(`[${chainName}:${keystoreName}] ⏸️ Gas too high: ${currentGwei.toFixed(0)} gwei > ${chain.maxGasPriceGwei} gwei max. Skipping travel.`);
        return { success: false, error: `Gas price too high: ${currentGwei.toFixed(0)} gwei` };
      }
    }
    
    // Build command with gas price limit
    const gasPriceWei = chain.gasPriceGwei * 1e9;
    const gasFlag = chain.gasPriceGwei > 0 ? ` --with-gas-price ${gasPriceWei}` : '';
    const command = `forge script ${chain.script} --rpc-url ${chain.rpcUrl} --broadcast --account ${keystoreName} --password ${keystorePassword}${gasFlag} --sig "run(uint8,uint8,uint256)" ${destinationCity} ${travelType} ${itemId}`;

    const { stdout, stderr } = await execPromise(command, { cwd: "./foundry-travel-scripts" });
    console.log(`[SUCCESS] ${chainName} travel to city ${destinationCity} (type: ${travelType}) executed for ${keystoreName}`);

    return { success: true };
  } catch (error) {
    const errMsg = error.message || '';
    if (errMsg.toLowerCase().includes('jail')) {
      console.log(`[WARN] ${chainName} ${keystoreName} is in jail - skipping travel`);
    } else {
      console.log(`[ERROR] ${chainName} travel failed for ${keystoreName}: ${errMsg.substring(0, 100)}`);
    }
    return { success: false, error: errMsg };
  }
}

// Function to schedule travel for a single wallet with to-and-fro logic
function scheduleWallet(chainName, keystoreName, keystorePassword, itemId, startCity, endCity, travelType) {
  let isStartCity = true; // Start by traveling to startCity
  let initializedPosition = false; // Track if we've verified/moved to start position

  async function runAndReschedule() {
    const chain = chains[chainName];
    
    // On first run, check if player is at startCity - if not, travel there first
    if (!initializedPosition) {
      const walletAddress = await getWalletAddress(keystoreName, keystorePassword);
      if (walletAddress) {
        const cityInfo = await getPlayerCity(walletAddress, chainName, chain.rpcUrl);
        if (cityInfo.success) {
          const cityName = CITY_NAMES[cityInfo.cityId] || `City ${cityInfo.cityId}`;
          console.log(`[${chainName}:${keystoreName}] 📍 Current city: ${cityName} (${cityInfo.cityId})`);
          
          if (cityInfo.cityId !== startCity && cityInfo.cityId !== endCity) {
            // Not at either travel point - need to travel to startCity first
            console.log(`[${chainName}:${keystoreName}] 🎯 Not at start/end city - traveling to ${CITY_NAMES[startCity]}...`);
            const initResult = await runTravel(chainName, keystoreName, keystorePassword, startCity, travelType, itemId);
            
            if (initResult.success) {
              console.log(`[${chainName}:${keystoreName}] ✅ Initial travel to ${CITY_NAMES[startCity]} initiated`);
              initializedPosition = true;
              isStartCity = false; // Next destination will be endCity
              const delay = travelDelays[travelType];
              console.log(`[${chainName}] ✈️ Next travel for ${keystoreName} to ${CITY_NAMES[endCity]} in ${Math.round(delay / 60000)}m (after arrival)`);
              setTimeout(runAndReschedule, delay);
              return;
            } else {
              console.log(`[${chainName}:${keystoreName}] ⚠️ Initial travel failed, retrying in 15m...`);
              setTimeout(runAndReschedule, travelDelays[3]);
              return;
            }
          } else if (cityInfo.cityId === startCity) {
            // Already at startCity - start normal loop going to endCity
            console.log(`[${chainName}:${keystoreName}] ✅ Already at ${CITY_NAMES[startCity]} - starting travel loop`);
            initializedPosition = true;
            isStartCity = false; // Will travel to endCity
          } else if (cityInfo.cityId === endCity) {
            // Already at endCity - start normal loop going to startCity
            console.log(`[${chainName}:${keystoreName}] ✅ Already at ${CITY_NAMES[endCity]} - starting travel loop`);
            initializedPosition = true;
            isStartCity = true; // Will travel to startCity
          }
        } else {
          console.log(`[${chainName}:${keystoreName}] ⚠️ Could not detect city, starting normal loop...`);
          initializedPosition = true;
        }
      } else {
        console.log(`[${chainName}:${keystoreName}] ⚠️ Could not get wallet address, starting normal loop...`);
        initializedPosition = true;
      }
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
      // If failed, retry same destination after 15 minutes (don't toggle cities)
      delay = travelDelays[3]; // 15 minutes retry delay
      nextDestination = destinationCity; // Same destination

      console.log(
        `${chainName} RETRY for ${keystoreName} to ${CITY_NAMES[nextDestination] || `city ${nextDestination}`} scheduled for ${new Date(Date.now() + delay).toISOString()} (in ${delay / 1000 / 60} minutes) due to transaction failure`
      );
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
