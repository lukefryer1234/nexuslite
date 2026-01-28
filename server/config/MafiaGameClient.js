/**
 * PulseMafia Game Client v2.0
 * 
 * PHASE 4 IMPROVEMENTS:
 * - Error handling with retries
 * - Connection health checks
 * - Contract instance caching
 * - Batch operations for efficiency
 * 
 * PHASE 5 IMPROVEMENTS:
 * - Event subscriptions
 * - Transaction management with gas estimation
 * - Multi-wallet support
 * - State caching with TTL
 */

const { ethers } = require('ethers');
const gameConfig = require('./gameContracts');

class MafiaGameClient {
    constructor(chain, privateKey = null, options = {}) {
        this.chain = chain;
        this.config = gameConfig;
        this.options = {
            maxRetries: 3,
            retryDelay: 1000,
            cacheTTL: 30000, // 30 seconds
            ...options
        };

        // Initialize provider with fallbacks
        this._initProvider();

        // Set up wallet if provided
        if (privateKey) {
            this.wallet = new ethers.Wallet(privateKey, this.provider);
            this.address = this.wallet.address;
        }

        this.contracts = this.config.contracts[chain];

        // Contract instance cache
        this._contractCache = new Map();

        // State cache with TTL
        this._stateCache = new Map();

        // Event listeners
        this._listeners = new Map();

        // Transaction mutex
        this._txLock = Promise.resolve();
    }

    /**
     * Execute a function with a mutex lock to prevent nonce collisions
     */
    async _withLock(fn) {
        const result = this._txLock.then(() => fn());
        // Catch errors to ensure the chain continues, but rethrow for caller
        this._txLock = result.catch(() => { });
        return result;
    }

    // === INITIALIZATION ===

    _initProvider() {
        const rpcs = this.config.getAllRpcs(this.chain);
        this.provider = new ethers.JsonRpcProvider(rpcs[0]);
        this._rpcIndex = 0;
        this._rpcs = rpcs;
    }

    async _switchRpc() {
        this._rpcIndex = (this._rpcIndex + 1) % this._rpcs.length;
        this.provider = new ethers.JsonRpcProvider(this._rpcs[this._rpcIndex]);
        console.log(`Switched to RPC: ${this._rpcs[this._rpcIndex]}`);
    }

    // === ERROR HANDLING ===

    async _retry(fn, retries = this.options.maxRetries) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;

                // Check if it's an RPC error
                if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
                    await this._switchRpc();
                }

                await new Promise(r => setTimeout(r, this.options.retryDelay * (i + 1)));
            }
        }
    }

    // === CONTRACT CACHING ===

    _getContract(address, abi) {
        const key = `${address}-${this.wallet ? 'wallet' : 'provider'}`;

        if (!this._contractCache.has(key)) {
            const signer = this.wallet || this.provider;
            this._contractCache.set(key, new ethers.Contract(address, abi, signer));
        }

        return this._contractCache.get(key);
    }

    // === STATE CACHING ===

    _getCached(key) {
        const cached = this._stateCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.options.cacheTTL) {
            return cached.value;
        }
        return null;
    }

    _setCache(key, value) {
        this._stateCache.set(key, { value, timestamp: Date.now() });
    }

    clearCache() {
        this._stateCache.clear();
    }

    // === HEALTH CHECK ===

    async checkConnection() {
        try {
            const blockNumber = await this._retry(() => this.provider.getBlockNumber());
            return { connected: true, blockNumber, rpc: this._rpcs[this._rpcIndex] };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    // === TOKEN OPERATIONS ===

    async getMafiaBalance(address) {
        const cacheKey = `mafia-${address}`;
        const cached = this._getCached(cacheKey);
        if (cached !== null) return cached;

        const contract = this._getContract(
            this.contracts.tokens.MAFIA.address,
            this.config.abis.ERC20
        );

        const balance = await this._retry(() => contract.balanceOf(address));
        const formatted = ethers.formatEther(balance);
        this._setCache(cacheKey, formatted);
        return formatted;
    }

    async getBulletBalance(address) {
        const cacheKey = `bullet-${address}`;
        const cached = this._getCached(cacheKey);
        if (cached !== null) return cached;

        const contract = this._getContract(
            this.contracts.tokens.BULLET.address,
            this.config.abis.ERC20
        );

        const balance = await this._retry(() => contract.balanceOf(address));
        const formatted = ethers.formatEther(balance);
        this._setCache(cacheKey, formatted);
        return formatted;
    }

    async getTokenBalance(tokenKey, address) {
        const tokenInfo = this.contracts.tokens[tokenKey];
        if (!tokenInfo) throw new Error(`Unknown token: ${tokenKey}`);

        const contract = this._getContract(tokenInfo.address, this.config.abis.ERC20);
        const balance = await this._retry(() => contract.balanceOf(address));
        return ethers.formatEther(balance);
    }

    // === PLAYER STATUS ===

    async isInJail(address) {
        const cacheKey = `jail-${address}`;
        const cached = this._getCached(cacheKey);
        if (cached !== null) return cached;

        const contract = this._getContract(
            this.contracts.actions.JAIL.address,
            this.config.abis.JAIL
        );

        const inJail = await this._retry(() => contract.isInJail(address));
        this._setCache(cacheKey, inJail);
        return inJail;
    }

    async getJailTime(address) {
        const contract = this._getContract(
            this.contracts.actions.JAIL.address,
            this.config.abis.JAIL
        );
        const time = await this._retry(() => contract.getJailTime(address));
        return Number(time);
    }

    async getHealth(address) {
        const contract = this._getContract(
            this.contracts.player.HEALTH.address,
            this.config.abis.HEALTH
        );
        const health = await this._retry(() => contract.getHealth(address));
        return Number(health);
    }

    async getMaxHealth(address) {
        const contract = this._getContract(
            this.contracts.player.HEALTH.address,
            this.config.abis.HEALTH
        );
        const maxHealth = await this._retry(() => contract.getMaxHealth(address));
        return Number(maxHealth);
    }

    async getCity(address) {
        const contract = this._getContract(
            this.contracts.player.MAP.address,
            this.config.abis.MAP
        );
        const city = await this._retry(() => contract.getCity(address));
        return Number(city);
    }

    async getCityName(address) {
        const cityId = await this.getCity(address);
        return this.config.cities[cityId] || `City ${cityId}`;
    }

    async getCrimeCooldown(address) {
        const contract = this._getContract(
            this.contracts.actions.CRIMES.address,
            this.config.abis.CRIMES
        );
        const cooldown = await this._retry(() => contract.getCrimeCooldown(address));
        return Number(cooldown);
    }

    async canCommitCrime(address) {
        const cooldown = await this.getCrimeCooldown(address);
        return cooldown === 0 || cooldown < Math.floor(Date.now() / 1000);
    }

    // === NICK CAR STATUS ===

    async getNickCarCooldown(address) {
        const contract = this._getContract(
            this.contracts.actions.NICK_CAR.address,
            this.config.abis.NICK_CAR
        );
        const cooldown = await this._retry(() => contract.getCooldown(address));
        return Number(cooldown);
    }

    async canNickCar(address) {
        const cooldown = await this.getNickCarCooldown(address);
        return cooldown === 0 || cooldown < Math.floor(Date.now() / 1000);
    }

    // === KILL SKILL STATUS ===

    async getKillSkillCooldown(address) {
        const contract = this._getContract(
            this.contracts.actions.KILL_SKILL.address,
            this.config.abis.KILL_SKILL
        );
        const cooldown = await this._retry(() => contract.getCooldown(address));
        return Number(cooldown);
    }

    async canTrainKillSkill(address) {
        const cooldown = await this.getKillSkillCooldown(address);
        return cooldown === 0 || cooldown < Math.floor(Date.now() / 1000);
    }

    async getKillSkill(address) {
        const contract = this._getContract(
            this.contracts.actions.KILL_SKILL.address,
            this.config.abis.KILL_SKILL
        );
        const skill = await this._retry(() => contract.getSkill(address));
        return Number(skill);
    }

    // === COMPREHENSIVE STATUS ===

    async getFullStatus(address, options = {}) {
        const { forceRefresh = false } = options;

        if (forceRefresh) {
            this.clearCache();
        }

        const results = await Promise.allSettled([
            this.getMafiaBalance(address),
            this.getBulletBalance(address),
            this.isInJail(address),
            this.getJailTime(address),
            this.getHealth(address),
            this.getMaxHealth(address),
            this.getCity(address),
            this.getCrimeCooldown(address)
        ]);

        const getValue = (result, defaultValue) =>
            result.status === 'fulfilled' ? result.value : defaultValue;

        const cityId = getValue(results[6], 0);

        return {
            address,
            chain: this.chain,
            network: this.config.networks[this.chain].name,
            tokens: {
                mafia: getValue(results[0], '0'),
                bullets: getValue(results[1], '0')
            },
            status: {
                inJail: getValue(results[2], false),
                jailTime: getValue(results[3], 0),
                health: getValue(results[4], 0),
                maxHealth: getValue(results[5], 100),
                cityId,
                cityName: this.config.cities[cityId] || `City ${cityId}`,
                crimeCooldown: getValue(results[7], 0),
                canCommitCrime: getValue(results[7], 0) === 0
            },
            queriedAt: new Date().toISOString()
        };
    }

    // === BATCH OPERATIONS ===

    async getMultipleStatuses(addresses) {
        return Promise.all(addresses.map(addr => this.getFullStatus(addr)));
    }

    async getMultipleBalances(addresses, tokenKey = 'MAFIA') {
        const tokenInfo = this.contracts.tokens[tokenKey];
        const contract = this._getContract(tokenInfo.address, this.config.abis.ERC20);

        const balances = await Promise.all(
            addresses.map(addr => this._retry(() => contract.balanceOf(addr)))
        );

        return addresses.map((addr, i) => ({
            address: addr,
            balance: ethers.formatEther(balances[i])
        }));
    }

    // === ACTIONS (require wallet) ===

    _requireWallet() {
        if (!this.wallet) {
            throw new Error('Wallet required for transactions. Initialize with privateKey.');
        }
    }

    async estimateGas(method, ...args) {
        this._requireWallet();
        return this._withLock(async () => {
            const gasEstimate = await this._retry(() => method.estimateGas(...args));
            return gasEstimate;
        });
    }

    async commitCrime(crimeType = 0, options = {}) {
        this._requireWallet();

        const contract = this._getContract(
            this.contracts.actions.CRIMES.address,
            this.config.abis.CRIMES
        );

        // Check if can commit crime
        const canCommit = await this.canCommitCrime(this.wallet.address);
        if (!canCommit && !options.force) {
            const cooldown = await this.getCrimeCooldown(this.wallet.address);
            throw new Error(`Crime on cooldown. Wait ${cooldown - Math.floor(Date.now() / 1000)} seconds.`);
        }

        // Estimate gas if not provided
        const gasLimit = options.gasLimit || await this._retry(
            () => contract.commitCrime.estimateGas(crimeType)
        );

        const tx = await this._withLock(() => this._retry(() =>
            contract.commitCrime(crimeType, { gasLimit: gasLimit * 120n / 100n }) // 20% buffer
        ));

        this.clearCache(); // Invalidate cache after action

        if (options.wait !== false) {
            return await tx.wait();
        }
        return tx;
    }

    async heal(options = {}) {
        this._requireWallet();

        const healCost = await this.getHealCost(this.wallet.address);

        const contract = this._getContract(
            this.contracts.actions.HOSPITAL.address,
            this.config.abis.HOSPITAL
        );

        const tx = await this._withLock(() => this._retry(() =>
            contract.heal({ value: healCost })
        ));

        this.clearCache();

        if (options.wait !== false) {
            return await tx.wait();
        }
        return tx;
    }

    async getHealCost(address) {
        const contract = this._getContract(
            this.contracts.actions.HOSPITAL.address,
            this.config.abis.HOSPITAL
        );
        return await this._retry(() => contract.getHealCost(address));
    }

    async bustOut(options = {}) {
        this._requireWallet();

        const contract = this._getContract(
            this.contracts.actions.BUST_OUT.address,
            this.config.abis.BUST_OUT
        );

        const tx = await this._retry(() => contract.bustOut());

        this.clearCache();

        if (options.wait !== false) {
            return await tx.wait();
        }
        return tx;
    }

    async nickCar(options = {}) {
        this._requireWallet();

        const contract = this._getContract(
            this.contracts.actions.NICK_CAR.address,
            this.config.abis.NICK_CAR
        );

        // Check if can nick car
        const canNick = await this.canNickCar(this.wallet.address);
        if (!canNick && !options.force) {
            const cooldown = await this.getNickCarCooldown(this.wallet.address);
            throw new Error(`Nick Car on cooldown. Wait ${cooldown - Math.floor(Date.now() / 1000)} seconds.`);
        }

        // Estimate gas if not provided
        const gasLimit = options.gasLimit || await this._retry(
            () => contract.nickCar.estimateGas()
        );

        const tx = await this._retry(() =>
            contract.nickCar({ gasLimit: gasLimit * 120n / 100n }) // 20% buffer
        );

        this.clearCache();

        if (options.wait !== false) {
            return await tx.wait();
        }
        return tx;
    }

    async trainKillSkill(trainingType = 0, options = {}) {
        this._requireWallet();

        const contract = this._getContract(
            this.contracts.actions.KILL_SKILL.address,
            this.config.abis.KILL_SKILL
        );

        // Check if can train
        const canTrain = await this.canTrainKillSkill(this.wallet.address);
        if (!canTrain && !options.force) {
            const cooldown = await this.getKillSkillCooldown(this.wallet.address);
            throw new Error(`Kill Skill training on cooldown. Wait ${cooldown - Math.floor(Date.now() / 1000)} seconds.`);
        }

        // Estimate gas if not provided
        const gasLimit = options.gasLimit || await this._retry(
            () => contract.train.estimateGas(trainingType)
        );

        const tx = await this._retry(() =>
            contract.train(trainingType, { gasLimit: gasLimit * 120n / 100n }) // 20% buffer
        );

        this.clearCache();

        if (options.wait !== false) {
            return await tx.wait();
        }
        return tx;
    }

    async travel(cityId, options = {}) {
        this._requireWallet();

        const contract = this._getContract(
            this.contracts.player.MAP.address,
            this.config.abis.MAP
        );

        const tx = await this._retry(() => contract.travel(cityId));

        this.clearCache();

        if (options.wait !== false) {
            return await tx.wait();
        }
        return tx;
    }

    /**
     * Claim yield from a property
     * Function discovered from transaction: selector 0x8b151ece
     * @param {number} cityId - City ID where the property is located
     * @param {number} tileId - Tile ID of the property
     * @param {number} claimType - Type of claim (default 6 based on observed tx)
     */
    async claimFromProperty(cityId, tileId, claimType = 6, options = {}) {
        this._requireWallet();
        const log = options.onProgress || (() => { });

        const contract = this._getContract(
            this.contracts.player.MAP.address,
            this.config.abis.MAP
        );

        log(`Estimating gas for property ${tileId}...`);

        let gasLimit;
        let finalClaimType = claimType;

        try {
            // Estimate gas if not provided
            gasLimit = options.gasLimit || await this._retry(
                () => contract.claimFromProperty.estimateGas(cityId, tileId, claimType)
            );
        } catch (error) {
            // Fallback: If default claim type fails (reverts), try claimType 0 (Cash)
            if (claimType !== 0 && (error.message.includes('revert') || error.message.includes('execution reverted'))) {
                log(`Standard claim (Type ${claimType}) failed, trying Cash claim (Type 0)...`);
                try {
                    gasLimit = await this._retry(
                        () => contract.claimFromProperty.estimateGas(cityId, tileId, 0)
                    );
                    finalClaimType = 0;
                } catch (fallbackError) {
                    // If fallback also fails, throw original error
                    throw error;
                }
            } else {
                throw error;
            }
        }

        log(`Sending transaction for property ${tileId} (Type ${finalClaimType})...`);
        const tx = await this._retry(() =>
            contract.claimFromProperty(cityId, tileId, finalClaimType, {
                gasLimit: gasLimit * 120n / 100n // 20% buffer
            })
        );

        log(`Transaction sent: ${tx.hash.slice(0, 10)}... Waiting for confirmation...`);
        this.clearCache();

        if (options.wait !== false) {
            const receipt = await tx.wait();
            log(`Transaction confirmed!`);
            return receipt;
        }
        return tx;
    }

    /**
     * Claim yields from multiple properties
     */
    async claimFromMultipleProperties(properties, claimType = 6, options = {}) {
        this._requireWallet();
        const log = options.onProgress || (() => { });

        log(`Starting claim for ${properties.length} properties...`);

        const results = [];
        let i = 0;
        for (const prop of properties) {
            i++;
            log(`Processing property ${i}/${properties.length} (Tile ${prop.tileId})...`);
            try {
                const receipt = await this.claimFromProperty(
                    prop.cityId,
                    prop.tileId,
                    claimType,
                    options
                );
                results.push({
                    tileId: prop.tileId,
                    cityId: prop.cityId,
                    success: true,
                    txHash: receipt.hash || receipt.transactionHash
                });
            } catch (error) {
                const shortError = error.message.length > 200 ? error.message.substring(0, 200) + '...' : error.message;
                log(`Failed to claim property ${prop.tileId}: ${shortError}`);
                results.push({
                    tileId: prop.tileId,
                    cityId: prop.cityId,
                    success: false,
                    error: error.message // Keep full error for logic checks
                });
            }
        }
        log(`Finished processing ${properties.length} properties.`);
        return results;
    }

    // === EVENT SUBSCRIPTIONS ===

    onCrimeCommitted(callback) {
        const contract = this._getContract(
            this.contracts.actions.CRIMES.address,
            this.config.abis.CRIMES
        );

        contract.on('CrimeCommitted', (player, crimeType, success, reward, event) => {
            callback({
                player,
                crimeType: Number(crimeType),
                success,
                reward: ethers.formatEther(reward),
                txHash: event.log.transactionHash
            });
        });

        return () => contract.removeAllListeners('CrimeCommitted');
    }

    onPlayerJailed(callback) {
        const contract = this._getContract(
            this.contracts.actions.JAIL.address,
            this.config.abis.JAIL
        );

        contract.on('PlayerJailed', (player, duration, event) => {
            callback({
                player,
                duration: Number(duration),
                txHash: event.log.transactionHash
            });
        });

        return () => contract.removeAllListeners('PlayerJailed');
    }

    // === UTILITY ===

    getContractAddress(category, name) {
        const contract = this.contracts[category]?.[name];
        return contract?.address || contract;
    }

    getContractInfo(category, name) {
        return this.contracts[category]?.[name];
    }

    getAllAddresses() {
        return this.config.getAllAddresses(this.chain);
    }

    getExplorerLink(address) {
        return this.config.getExplorerLink(this.chain, address);
    }

    getTxLink(txHash) {
        return this.config.getTxLink(this.chain, txHash);
    }

    // === STATIC HELPERS ===

    static getCityName(cityId) {
        return gameConfig.cities[cityId] || `City ${cityId}`;
    }

    static getCrimeInfo(crimeType) {
        return gameConfig.crimeTypes[crimeType];
    }

    static get CHAINS() {
        return gameConfig.CHAINS;
    }
}

module.exports = MafiaGameClient;
