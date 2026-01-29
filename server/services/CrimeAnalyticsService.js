/**
 * CrimeAnalyticsService - Tracks crime outcomes and calculates optimal crime type
 * 
 * Parses crime script output to track:
 * - Success/fail counts per crime type
 * - Jail events
 * - Calculates expected value per hour
 * - Recommends optimal crime type
 */

const fs = require('fs');
const path = require('path');

// Crime type reference data (from gameContracts.js)
const CRIME_TYPES = {
    0: { name: 'Petty Theft', minReward: 10, maxReward: 50, baseJailRisk: 0.10 },
    1: { name: 'Pickpocket', minReward: 20, maxReward: 100, baseJailRisk: 0.15 },
    2: { name: 'Car Theft', minReward: 50, maxReward: 200, baseJailRisk: 0.20 },
    3: { name: 'Armed Robbery', minReward: 100, maxReward: 500, baseJailRisk: 0.30 },
    4: { name: 'Bank Heist', minReward: 500, maxReward: 2000, baseJailRisk: 0.50 }
};

// Estimated cooldown in minutes
const CRIME_COOLDOWN_MINUTES = 17;
const JAIL_DURATION_MINUTES = 15; // Estimated, will be refined with data
const ACTIVITIES_PER_HOUR = 60 / CRIME_COOLDOWN_MINUTES; // ~3.5

class CrimeAnalyticsService {
    constructor(dataDir = null) {
        this.dataDir = dataDir || path.join(__dirname, '..', 'data');
        this.dataFile = path.join(this.dataDir, 'crime_analytics.json');
        
        // Initialize stats
        this.stats = this._loadStats();
    }

    /**
     * Load stats from disk or initialize empty
     */
    _loadStats() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (err) {
            console.error('Failed to load crime analytics:', err.message);
        }
        
        return this._initializeStats();
    }

    /**
     * Initialize empty stats structure
     */
    _initializeStats() {
        const stats = {
            perType: {},
            global: {
                totalAttempts: 0,
                totalSuccesses: 0,
                totalJails: 0,
                lastUpdated: Date.now()
            }
        };
        
        // Initialize per-type stats
        for (const typeId of Object.keys(CRIME_TYPES)) {
            stats.perType[typeId] = {
                attempts: 0,
                successes: 0,
                fails: 0,
                jails: 0,
                estimatedReward: 0,
                lastAttempt: null
            };
        }
        
        return stats;
    }

    /**
     * Save stats to disk
     */
    _saveStats() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }
            fs.writeFileSync(this.dataFile, JSON.stringify(this.stats, null, 2));
        } catch (err) {
            console.error('Failed to save crime analytics:', err.message);
        }
    }

    /**
     * Record a crime attempt from script output
     * @param {Object} logEntry - Log entry from the crime script
     * @param {number} crimeType - The crime type that was attempted
     */
    recordCrimeAttempt(logEntry, crimeType = 0) {
        const text = logEntry.text || '';
        const typeKey = String(crimeType);
        
        // Ensure type exists
        if (!this.stats.perType[typeKey]) {
            this.stats.perType[typeKey] = {
                attempts: 0,
                successes: 0,
                fails: 0,
                jails: 0,
                estimatedReward: 0,
                lastAttempt: null
            };
        }
        
        const typeStats = this.stats.perType[typeKey];
        const crimeInfo = CRIME_TYPES[crimeType] || CRIME_TYPES[0];
        
        // Parse the log text for outcome
        if (text.includes('executed successfully')) {
            typeStats.attempts++;
            typeStats.successes++;
            typeStats.lastAttempt = Date.now();
            
            // Estimate reward (average of min/max)
            const avgReward = (crimeInfo.minReward + crimeInfo.maxReward) / 2;
            typeStats.estimatedReward += avgReward;
            
            this.stats.global.totalAttempts++;
            this.stats.global.totalSuccesses++;
        } else if (text.includes('failed') || text.includes('Transaction Failure')) {
            typeStats.attempts++;
            typeStats.fails++;
            typeStats.lastAttempt = Date.now();
            
            this.stats.global.totalAttempts++;
            
            // Check if it's a jail
            if (text.toLowerCase().includes('jail')) {
                typeStats.jails++;
                this.stats.global.totalJails++;
            }
        } else if (text.includes('cooldown')) {
            // Cooldown attempts don't count as real attempts
            // but we track them separately
        }
        
        this.stats.global.lastUpdated = Date.now();
        this._saveStats();
    }

    /**
     * Calculate expected value per hour for a crime type
     * @param {number} crimeType 
     * @returns {Object} EV calculation details
     */
    calculateEV(crimeType) {
        const typeKey = String(crimeType);
        const typeStats = this.stats.perType[typeKey];
        const crimeInfo = CRIME_TYPES[crimeType] || CRIME_TYPES[0];
        
        if (!typeStats || typeStats.attempts === 0) {
            // Use theoretical values
            const avgReward = (crimeInfo.minReward + crimeInfo.maxReward) / 2;
            const successRate = 1 - crimeInfo.baseJailRisk;
            const evPerCrime = avgReward * successRate;
            const evPerHour = evPerCrime * ACTIVITIES_PER_HOUR;
            
            return {
                crimeType,
                name: crimeInfo.name,
                source: 'theoretical',
                attempts: 0,
                successRate: successRate * 100,
                jailRate: crimeInfo.baseJailRisk * 100,
                avgReward,
                evPerCrime,
                evPerHour,
                uptimePercent: (1 - crimeInfo.baseJailRisk * (JAIL_DURATION_MINUTES / 60)) * 100
            };
        }
        
        // Use actual data
        const successRate = typeStats.successes / typeStats.attempts;
        const jailRate = typeStats.jails / typeStats.attempts;
        const avgReward = typeStats.successes > 0 
            ? typeStats.estimatedReward / typeStats.successes 
            : (crimeInfo.minReward + crimeInfo.maxReward) / 2;
        
        // EV per crime = avgReward * successRate
        const evPerCrime = avgReward * successRate;
        
        // Adjust for jail downtime
        // When jailed, you lose ~15 mins of all activities
        const jailPenaltyPerHour = jailRate * JAIL_DURATION_MINUTES * (ACTIVITIES_PER_HOUR / 60);
        const effectiveActivitiesPerHour = ACTIVITIES_PER_HOUR * (1 - jailRate * (JAIL_DURATION_MINUTES / CRIME_COOLDOWN_MINUTES));
        
        const evPerHour = evPerCrime * effectiveActivitiesPerHour;
        const uptimePercent = (1 - jailRate * (JAIL_DURATION_MINUTES / 60)) * 100;
        
        return {
            crimeType,
            name: crimeInfo.name,
            source: 'actual',
            attempts: typeStats.attempts,
            successes: typeStats.successes,
            jails: typeStats.jails,
            successRate: successRate * 100,
            jailRate: jailRate * 100,
            avgReward,
            evPerCrime,
            evPerHour,
            uptimePercent
        };
    }

    /**
     * Get optimal crime type recommendation
     * @returns {Object} Recommendation with reason
     */
    getRecommendation() {
        const evCalculations = [];
        
        for (const typeId of Object.keys(CRIME_TYPES)) {
            evCalculations.push(this.calculateEV(parseInt(typeId)));
        }
        
        // Sort by EV per hour (descending)
        evCalculations.sort((a, b) => b.evPerHour - a.evPerHour);
        
        const best = evCalculations[0];
        const hasData = best.source === 'actual' && best.attempts >= 10;
        
        return {
            recommended: best.crimeType,
            name: best.name,
            evPerHour: best.evPerHour.toFixed(1),
            confidence: hasData ? 'high' : 'low',
            reason: hasData 
                ? `Based on ${best.attempts} attempts with ${best.successRate.toFixed(0)}% success rate`
                : 'Based on theoretical values - run more crimes to improve accuracy',
            allTypes: evCalculations
        };
    }

    /**
     * Get full analytics report
     * @returns {Object} Complete analytics data
     */
    getAnalytics() {
        return {
            stats: this.stats,
            recommendation: this.getRecommendation(),
            crimeTypes: CRIME_TYPES,
            config: {
                cooldownMinutes: CRIME_COOLDOWN_MINUTES,
                jailDurationMinutes: JAIL_DURATION_MINUTES,
                activitiesPerHour: ACTIVITIES_PER_HOUR
            }
        };
    }

    /**
     * Reset all stats
     */
    reset() {
        this.stats = this._initializeStats();
        this._saveStats();
    }
}

module.exports = CrimeAnalyticsService;
