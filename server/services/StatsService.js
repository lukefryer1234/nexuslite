/**
 * Stats Service for Nexus Lite
 * 
 * Tracks script execution statistics:
 * - Success/error counts per script type and wallet
 * - Gas usage (extracted from logs when available)
 * - Rate calculation over time
 */

class StatsService {
    constructor() {
        this.stats = {
            byScript: {},    // { crime: { success: X, error: Y }, ... }
            byWallet: {},    // { Mum: { success: X, error: Y }, ... }
            recent: [],      // Last 100 events for rate calculation
            totals: { success: 0, error: 0, warn: 0 },
            startTime: Date.now()
        };
    }

    /**
     * Record an event from a log entry
     */
    recordEvent(logEntry) {
        const { level, source, message } = logEntry;
        
        // Parse source: Script:crime:bnb:Mum -> { script: 'crime', chain: 'bnb', wallet: 'Mum' }
        const parsed = this._parseSource(source);
        if (!parsed) return;
        
        const { script, chain, wallet } = parsed;
        const isSuccess = level === 'SUCCESS' || message.includes('[SUCCESS]') || message.includes('✅');
        const isError = level === 'ERROR' || message.includes('[ERROR]') || message.includes('❌');
        const isWarn = level === 'WARN' || message.includes('[WARN]');
        
        // Update totals
        if (isSuccess) this.stats.totals.success++;
        else if (isError) this.stats.totals.error++;
        else if (isWarn) this.stats.totals.warn++;
        else return; // Only track success/error/warn events
        
        // Update by script
        if (!this.stats.byScript[script]) {
            this.stats.byScript[script] = { success: 0, error: 0, warn: 0 };
        }
        if (isSuccess) this.stats.byScript[script].success++;
        else if (isError) this.stats.byScript[script].error++;
        else if (isWarn) this.stats.byScript[script].warn++;
        
        // Update by wallet
        if (wallet) {
            if (!this.stats.byWallet[wallet]) {
                this.stats.byWallet[wallet] = { success: 0, error: 0, warn: 0 };
            }
            if (isSuccess) this.stats.byWallet[wallet].success++;
            else if (isError) this.stats.byWallet[wallet].error++;
            else if (isWarn) this.stats.byWallet[wallet].warn++;
        }
        
        // Add to recent (ring buffer)
        this.stats.recent.push({
            timestamp: Date.now(),
            script,
            wallet,
            type: isSuccess ? 'success' : isError ? 'error' : 'warn'
        });
        if (this.stats.recent.length > 100) {
            this.stats.recent.shift();
        }
    }

    /**
     * Parse source string into components
     */
    _parseSource(source) {
        if (!source || !source.startsWith('Script:')) return null;
        
        const parts = source.split(':');
        if (parts.length < 3) return null;
        
        return {
            script: parts[1],
            chain: parts[2],
            wallet: parts[3] || null
        };
    }

    /**
     * Get current stats
     */
    getStats() {
        const uptime = Math.round((Date.now() - this.stats.startTime) / 1000 / 60); // minutes
        const total = this.stats.totals.success + this.stats.totals.error;
        const successRate = total > 0 ? Math.round((this.stats.totals.success / total) * 100) : 0;
        
        return {
            totals: this.stats.totals,
            successRate: `${successRate}%`,
            uptimeMinutes: uptime,
            byScript: this.stats.byScript,
            byWallet: this.stats.byWallet,
            recentCount: this.stats.recent.length
        };
    }

    /**
     * Reset stats
     */
    reset() {
        this.stats = {
            byScript: {},
            byWallet: {},
            recent: [],
            totals: { success: 0, error: 0, warn: 0 },
            startTime: Date.now()
        };
    }
}

// Singleton
const statsService = new StatsService();

module.exports = statsService;
