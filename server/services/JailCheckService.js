/**
 * Jail Check Service
 * 
 * Checks player jail status from game API
 * Can check if player should skip crime attempt
 */

const Logger = require('../config/Logger');
const logger = new Logger('JailCheck');

// Game API base URLs
const GAME_API_URLS = {
    pulsechain: 'https://api.mafiawars.dev',
    pls: 'https://api.mafiawars.dev',
    bnb: 'https://bnbapi.mafiawars.dev'
};

// Cache to avoid hammering the API
const jailCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

class JailCheckService {
    /**
     * Check if a wallet address is in jail
     * @param {string} address - Wallet address
     * @param {string} chain - 'pls' or 'bnb'
     * @returns {Promise<{inJail: boolean, secondsRemaining: number, releaseTime: string|null}>}
     */
    async checkJailStatus(address, chain = 'pls') {
        const cacheKey = `${address}:${chain}`;
        
        // Check cache
        const cached = jailCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
        
        const apiBase = GAME_API_URLS[chain] || GAME_API_URLS.pls;
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${apiBase}/player/${address}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                return { inJail: false, secondsRemaining: 0, releaseTime: null };
            }
            
            const playerData = await response.json();
            const now = Math.floor(Date.now() / 1000);
            
            // Check common jail field names
            const jailUntil = playerData.jailUntil || playerData.jailReleaseTime || playerData.jail || 0;
            const inJail = jailUntil > now;
            const secondsRemaining = inJail ? jailUntil - now : 0;
            
            const result = {
                inJail,
                secondsRemaining,
                releaseTime: inJail ? new Date(jailUntil * 1000).toISOString() : null,
                playerName: playerData.name || null
            };
            
            jailCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
            
        } catch (err) {
            // On error, assume not in jail (fail open)
            logger.debug(`Jail check failed for ${address.slice(0, 10)}...`);
            return { inJail: false, secondsRemaining: 0, releaseTime: null };
        }
    }
    
    /**
     * Get wallet address from keystore name
     * This is a helper that reads from Foundry keystore
     */
    async getAddressFromKeystore(keystoreName) {
        const fs = require('fs');
        const path = require('path');
        
        const keystorePath = path.join(
            process.env.KEYSTORE_PATH || `${process.env.HOME}/.foundry/keystores`,
            keystoreName
        );
        
        if (!fs.existsSync(keystorePath)) {
            return null;
        }
        
        try {
            const keystoreJson = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
            return keystoreJson.address ? `0x${keystoreJson.address}` : null;
        } catch (err) {
            return null;
        }
    }
    
    /**
     * Check if wallet should skip crime (in jail)
     * @param {string} keystoreName - Keystore name
     * @param {string} chain - 'pls' or 'bnb'
     */
    async shouldSkipCrime(keystoreName, chain = 'pls') {
        const address = await this.getAddressFromKeystore(keystoreName);
        if (!address) return false;
        
        const status = await this.checkJailStatus(address, chain);
        
        if (status.inJail) {
            logger.info(`${keystoreName} is in jail until ${status.releaseTime} (${Math.ceil(status.secondsRemaining / 60)} min)`);
            return true;
        }
        
        return false;
    }
}

// Singleton
const jailCheckService = new JailCheckService();
module.exports = jailCheckService;
