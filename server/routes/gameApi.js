/**
 * Game API Routes
 * 
 * Provides game-related data like cooldowns by fetching from the game API
 */

const express = require('express');
const router = express.Router();
const Logger = require('../config/Logger');

const logger = new Logger('GameAPI');

// Game API base URLs
const GAME_API_URLS = {
    pulsechain: 'https://api.mafiawars.dev',
    bnb: 'https://bnbapi.mafiawars.dev'
};

// Cooldown durations in seconds
const COOLDOWN_DURATIONS = {
    crime: 15 * 60,      // 15 minutes
    nickCar: 30 * 60,    // 30 minutes
    killSkill: 45 * 60,  // 45 minutes
    travel: 60 * 60      // 60 minutes
};

// Cache to reduce API calls and error spam
const cooldownCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds
const errorCounters = new Map();

/**
 * Fetch with timeout and retry
 */
async function fetchWithRetry(url, options = {}, retries = 2, timeoutMs = 5000) {
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            return response;
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 500 * (i + 1))); // Backoff
        }
    }
}

/**
 * GET /api/game/cooldowns/:address
 * Fetch cooldowns for a wallet address from the game API
 */
router.get('/cooldowns/:address', async (req, res) => {
    const { address } = req.params;
    const chain = req.query.chain || 'pulsechain';
    const cacheKey = `${address}:${chain}`;
    
    // Check cache first
    const cached = cooldownCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.json(cached.data);
    }
    
    const apiBase = GAME_API_URLS[chain] || GAME_API_URLS.pulsechain;
    
    // Default response for errors
    const defaultResponse = {
        address,
        chain,
        cooldowns: {
            crime: { secondsRemaining: 0, ready: true },
            nickCar: { secondsRemaining: 0, ready: true },
            killSkill: { secondsRemaining: 0, ready: true },
            travel: { secondsRemaining: 0, ready: true }
        }
    };
    
    try {
        const response = await fetchWithRetry(`${apiBase}/player/${address}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                cooldownCache.set(cacheKey, { data: defaultResponse, timestamp: Date.now() });
                return res.json(defaultResponse);
            }
            throw new Error(`Game API responded with status ${response.status}`);
        }
        
        const playerData = await response.json();
        const now = Math.floor(Date.now() / 1000);
        
        // Calculate cooldowns from last action timestamps
        const cooldowns = {};
        
        const lastCrime = playerData.lastCrimeTime || 0;
        const crimeRemaining = Math.max(0, (lastCrime + COOLDOWN_DURATIONS.crime) - now);
        cooldowns.crime = { secondsRemaining: crimeRemaining, ready: crimeRemaining === 0 };
        
        const lastNickCar = playerData.lastNickCarTime || playerData.lastGtaTime || 0;
        const nickCarRemaining = Math.max(0, (lastNickCar + COOLDOWN_DURATIONS.nickCar) - now);
        cooldowns.nickCar = { secondsRemaining: nickCarRemaining, ready: nickCarRemaining === 0 };
        
        const lastKillSkill = playerData.lastKillSkillTime || playerData.lastAssassinationTime || 0;
        const killSkillRemaining = Math.max(0, (lastKillSkill + COOLDOWN_DURATIONS.killSkill) - now);
        cooldowns.killSkill = { secondsRemaining: killSkillRemaining, ready: killSkillRemaining === 0 };
        
        const lastTravel = playerData.lastTravelTime || 0;
        const travelRemaining = Math.max(0, (lastTravel + COOLDOWN_DURATIONS.travel) - now);
        cooldowns.travel = { secondsRemaining: travelRemaining, ready: travelRemaining === 0 };
        
        const result = {
            address,
            chain,
            cooldowns,
            playerName: playerData.name || null
        };
        
        // Cache successful result
        cooldownCache.set(cacheKey, { data: result, timestamp: Date.now() });
        errorCounters.delete(cacheKey); // Reset error counter on success
        
        res.json(result);
        
    } catch (err) {
        // Rate limit error logging (only log every 10th error per address)
        const errorKey = cacheKey;
        const count = (errorCounters.get(errorKey) || 0) + 1;
        errorCounters.set(errorKey, count);
        
        if (count === 1 || count % 10 === 0) {
            logger.warn(`Cooldowns unavailable for ${address.slice(0, 8)}... (${count} failures)`, { chain });
        }
        
        // Cache the default response to reduce repeated failed calls
        cooldownCache.set(cacheKey, { data: { ...defaultResponse, error: 'API unavailable' }, timestamp: Date.now() });
        
        res.json({ ...defaultResponse, error: 'API unavailable' });
    }
});

/**
 * GET /api/game/jail/:address
 * Check if player is in jail and get remaining time
 */
router.get('/jail/:address', async (req, res) => {
    const { address } = req.params;
    const chain = req.query.chain || 'pulsechain';
    const cacheKey = `jail:${address}:${chain}`;
    
    // Check cache first (shorter TTL for jail status)
    const cached = cooldownCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 15000) { // 15 second cache
        return res.json(cached.data);
    }
    
    const apiBase = GAME_API_URLS[chain] || GAME_API_URLS.pulsechain;
    
    try {
        const response = await fetchWithRetry(`${apiBase}/player/${address}`);
        
        if (!response.ok) {
            return res.json({ address, chain, inJail: false, error: 'Player not found' });
        }
        
        const playerData = await response.json();
        const now = Math.floor(Date.now() / 1000);
        
        // Check jail status - common field names
        const jailUntil = playerData.jailUntil || playerData.jailReleaseTime || playerData.jail || 0;
        const inJail = jailUntil > now;
        const secondsRemaining = inJail ? jailUntil - now : 0;
        
        const result = {
            address,
            chain,
            inJail,
            secondsRemaining,
            releaseTime: inJail ? new Date(jailUntil * 1000).toISOString() : null,
            playerName: playerData.name || null
        };
        
        cooldownCache.set(cacheKey, { data: result, timestamp: Date.now() });
        res.json(result);
        
    } catch (err) {
        logger.warn(`Jail check failed for ${address.slice(0, 8)}...`, { chain, error: err.message });
        res.json({ address, chain, inJail: false, error: 'API unavailable' });
    }
});

module.exports = router;
