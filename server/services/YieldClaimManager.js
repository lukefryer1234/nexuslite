/**
 * Yield Claim Manager - Simplified
 * 
 * Time-based yield claiming with manual override
 * - Fetches properties from PulseMafia Game API
 * - Tracks last claim time per property in JSON file
 * - Claims properties that exceed the claim interval
 * - Estimates yield based on property tier and elapsed time
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ethers } = require('ethers');

// Game API endpoints
const API_BASE = {
    pulsechain: 'https://backendpls.playmafia.io',
    bnb: 'https://backendbnb.playmafia.io'
};

// City names
const CITIES = {
    0: 'Las Vegas',
    1: 'New York',
    2: 'Chicago',
    3: 'Los Angeles',
    4: 'Detroit',
    5: 'Miami',
    6: 'Atlantic City'
};

// Property tier yields (estimated daily cash yield in $)
const TIER_YIELDS = {
    PLAIN: 0,
    SHED: 0,
    HOUSE: 0,
    VILLA: 0,
    OFFICE: 2500,     // Starts yielding
    APARTMENT: 5000,
    MANSION: 10000,
    HOTEL: 20000
};

// Stage map from API
const STAGE_MAP = {
    0: 'PLAIN', 1: 'SHED', 2: 'HOUSE', 3: 'VILLA',
    4: 'OFFICE', 5: 'APARTMENT', 6: 'MANSION', 7: 'HOTEL'
};

// RPC URLs
const RPC_URLS = {
    pulsechain: process.env.PLS_RPC_URL || 'https://rpc-pulsechain.g4mm4.io',
    bnb: process.env.BNB_RPC_URL || 'https://bsc-dataseed.bnbchain.org'
};

// MAP contract addresses (for claiming)
const MAP_CONTRACTS = {
    pulsechain: '0xE571Aa670EDeEBd88887eb5687576199652A714F',
    bnb: '0x1c88060e4509c59b4064A7a9818f64AeC41ef19E'
};

class YieldClaimManager {
    constructor() {
        this.dataPath = path.join(__dirname, '../data/yield_claims.json');
        this.data = { properties: {}, lastSync: null, claimHistory: [] };
        this.globalPassword = null;
        
        // Configuration
        this.config = {
            claimIntervalHours: 24,  // Claim every 24 hours by default
            enabled: false
        };
        
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                this.data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
            }
        } catch (err) {
            console.error('[YieldClaim] Failed to load data:', err.message);
        }
    }

    saveData() {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('[YieldClaim] Failed to save data:', err.message);
        }
    }

    setGlobalPassword(password) {
        this.globalPassword = password;
    }

    updateConfig(config) {
        if (config.claimIntervalHours !== undefined) {
            this.config.claimIntervalHours = config.claimIntervalHours;
        }
        if (config.enabled !== undefined) {
            this.config.enabled = config.enabled;
        }
        this.saveData();
        return this.config;
    }

    getConfig() {
        return this.config;
    }

    /**
     * Fetch properties for an address from the game API
     */
    async fetchPropertiesForAddress(address, chain = 'pulsechain') {
        const properties = [];
        const baseUrl = API_BASE[chain];
        
        console.log(`[YieldClaim] Fetching properties for ${address} on ${chain}...`);
        
        for (const [cityIdStr, cityName] of Object.entries(CITIES)) {
            const cityId = parseInt(cityIdStr);
            
            try {
                const url = `${baseUrl}/map/owned/${cityId}`;
                const response = await fetch(url);
                
                if (!response.ok) continue;
                
                const data = await response.json();
                if (!data || !data.mapData) continue;
                
                // Filter for our wallet's properties
                for (const tile of data.mapData) {
                    const ownerAddress = (tile.ownerAddress || '').toLowerCase();
                    if (ownerAddress !== address.toLowerCase()) continue;
                    
                    const stage = STAGE_MAP[tile.slotSubType] || 'UNKNOWN';
                    const dailyYield = TIER_YIELDS[stage] || 0;
                    
                    properties.push({
                        tileId: tile.id || tile.inventoryItemId,
                        cityId,
                        cityName,
                        chain,
                        stage,
                        stageLevel: tile.slotSubType || 0,
                        stakedMafia: parseFloat(tile.stMafia || 0),
                        isOperating: tile.isOperating === true,
                        dailyYield,
                        connectors: tile.connectors || 0
                    });
                }
            } catch (err) {
                console.warn(`[YieldClaim] Error fetching city ${cityName}:`, err.message);
            }
        }
        
        console.log(`[YieldClaim] Found ${properties.length} properties on ${chain}`);
        return properties;
    }

    /**
     * Get all properties for a wallet with claim status
     */
    async getPropertiesWithStatus(address, chain = 'pulsechain') {
        const properties = await this.fetchPropertiesForAddress(address, chain);
        const now = Date.now();
        
        return properties.map(prop => {
            const key = `${chain}:${prop.tileId}`;
            const lastClaim = this.data.properties[key]?.lastClaim || null;
            const hoursSinceClaim = lastClaim ? (now - lastClaim) / (1000 * 60 * 60) : null;
            
            // Estimate yield based on time since last claim
            let estimatedYield = 0;
            if (prop.dailyYield > 0 && prop.stakedMafia > 0 && prop.isOperating) {
                const days = hoursSinceClaim ? hoursSinceClaim / 24 : 7; // Assume 7 days if never claimed
                estimatedYield = Math.round(prop.dailyYield * days);
            }
            
            // Ready to claim if exceeds interval
            const readyToClaim = !lastClaim || hoursSinceClaim >= this.config.claimIntervalHours;
            
            return {
                ...prop,
                lastClaim,
                hoursSinceClaim: hoursSinceClaim ? Math.round(hoursSinceClaim * 10) / 10 : null,
                estimatedYield,
                readyToClaim,
                canYield: prop.dailyYield > 0 && prop.stakedMafia > 0 && prop.isOperating
            };
        });
    }

    /**
     * Get claim-ready properties
     */
    async getClaimableProperties(address, chain = 'pulsechain') {
        const all = await this.getPropertiesWithStatus(address, chain);
        return all.filter(p => p.readyToClaim && p.canYield);
    }

    /**
     * Decrypt wallet from Foundry keystore
     */
    async decryptWallet(keystoreName, password, chain = 'pulsechain') {
        const keystorePath = path.join(
            process.env.KEYSTORE_PATH || `${process.env.HOME}/.foundry/keystores`,
            keystoreName
        );
        
        if (!fs.existsSync(keystorePath)) {
            throw new Error(`Keystore not found: ${keystoreName}`);
        }
        
        const keystoreJson = fs.readFileSync(keystorePath, 'utf8');
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
        
        const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
        return wallet.connect(provider);
    }

    /**
     * Claim yield from a single property using cast
     */
    async claimProperty(keystoreName, password, cityId, tileId, chain = 'pulsechain', onProgress) {
        const log = onProgress || console.log;
        
        return new Promise(async (resolve) => {
            try {
                const keystorePath = path.join(
                    process.env.KEYSTORE_PATH || `${process.env.HOME}/.foundry/keystores`,
                    keystoreName
                );
                const foundryBin = process.env.FOUNDRY_BIN || `${process.env.HOME}/.foundry/bin`;
                const rpcUrl = RPC_URLS[chain];
                
                // Write password to temp file
                const tempPw = `/tmp/pw-${Date.now()}`;
                fs.writeFileSync(tempPw, password, { mode: 0o600 });
                
                // MAP contract address
                const mapContract = MAP_CONTRACTS[chain];
                
                log(`Claiming tile ${tileId} in city ${cityId}...`);
                
                // Function: claimFromProperty(uint256 cityId, uint256 tileId, uint8 claimType)
                // Selector: 0x8b151ece
                const claimType = 6; // MAFIA tokens
                
                const proc = spawn(`${foundryBin}/cast`, [
                    'send', mapContract,
                    'claimFromProperty(uint256,uint256,uint8)',
                    cityId.toString(),
                    tileId.toString(),
                    claimType.toString(),
                    '--rpc-url', rpcUrl,
                    '--keystore', keystorePath,
                    '--password-file', tempPw
                ]);
                
                let stdout = '';
                let stderr = '';
                
                proc.stdout.on('data', (data) => stdout += data.toString());
                proc.stderr.on('data', (data) => stderr += data.toString());
                
                proc.on('close', (code) => {
                    // Cleanup
                    try { fs.unlinkSync(tempPw); } catch (e) {}
                    
                    if (code === 0) {
                        // Record successful claim
                        const key = `${chain}:${tileId}`;
                        this.data.properties[key] = {
                            ...this.data.properties[key],
                            lastClaim: Date.now(),
                            cityId,
                            chain
                        };
                        this.data.claimHistory.push({
                            tileId,
                            cityId,
                            chain,
                            timestamp: Date.now(),
                            txHash: stdout.trim()
                        });
                        this.saveData();
                        
                        log(`✓ Claimed tile ${tileId}`);
                        resolve({ success: true, tileId, txHash: stdout.trim() });
                    } else {
                        log(`✗ Failed to claim tile ${tileId}: ${stderr.slice(0, 100)}`);
                        resolve({ success: false, tileId, error: stderr });
                    }
                });
            } catch (err) {
                log(`✗ Error claiming tile ${tileId}: ${err.message}`);
                resolve({ success: false, tileId, error: err.message });
            }
        });
    }

    /**
     * Claim from multiple properties
     */
    async claimMultiple(keystoreName, password, properties, chain = 'pulsechain', onProgress) {
        const log = onProgress || console.log;
        const results = [];
        
        log(`Starting claims for ${properties.length} properties...`);
        
        for (let i = 0; i < properties.length; i++) {
            const prop = properties[i];
            log(`[${i + 1}/${properties.length}] Processing tile ${prop.tileId}...`);
            
            const result = await this.claimProperty(
                keystoreName, password, 
                prop.cityId, prop.tileId, 
                chain, log
            );
            
            results.push(result);
            
            // Small delay between claims
            if (i < properties.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        const successful = results.filter(r => r.success).length;
        log(`Completed: ${successful}/${results.length} claims successful`);
        
        return results;
    }

    /**
     * Claim all ready properties for a wallet
     */
    async claimAllReady(keystoreName, password, address, chain = 'pulsechain', onProgress) {
        const claimable = await this.getClaimableProperties(address, chain);
        
        if (claimable.length === 0) {
            return { success: true, message: 'No properties ready to claim', results: [] };
        }
        
        const results = await this.claimMultiple(keystoreName, password, claimable, chain, onProgress);
        return {
            success: true,
            claimed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }

    /**
     * Force claim all properties (manual override)
     */
    async claimAllForce(keystoreName, password, address, chain = 'pulsechain', onProgress) {
        const all = await this.getPropertiesWithStatus(address, chain);
        const yieldable = all.filter(p => p.canYield);
        
        if (yieldable.length === 0) {
            return { success: true, message: 'No yield-producing properties found', results: [] };
        }
        
        const results = await this.claimMultiple(keystoreName, password, yieldable, chain, onProgress);
        return {
            success: true,
            claimed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }

    /**
     * Get summary status
     */
    async getStatus(address, chain = 'pulsechain') {
        const properties = await this.getPropertiesWithStatus(address, chain);
        
        const yieldable = properties.filter(p => p.canYield);
        const readyToClaim = properties.filter(p => p.readyToClaim && p.canYield);
        const totalEstimated = readyToClaim.reduce((sum, p) => sum + p.estimatedYield, 0);
        
        return {
            totalProperties: properties.length,
            yieldingProperties: yieldable.length,
            readyToClaim: readyToClaim.length,
            totalEstimatedYield: totalEstimated,
            claimIntervalHours: this.config.claimIntervalHours,
            properties: properties.sort((a, b) => (b.estimatedYield || 0) - (a.estimatedYield || 0)),
            lastSync: this.data.lastSync
        };
    }

    /**
     * Get claim history
     */
    getClaimHistory(limit = 50) {
        return this.data.claimHistory.slice(-limit).reverse();
    }
}

// Singleton
const yieldClaimManager = new YieldClaimManager();

module.exports = yieldClaimManager;
