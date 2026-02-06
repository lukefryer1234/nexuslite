/**
 * Global Log Service for Nexus-Lite
 * 
 * Centralized logging that:
 * 1. Stores logs in memory (ring buffer)
 * 2. Broadcasts to connected Socket.io clients in real-time
 * 3. Provides API for fetching recent logs
 */

class GlobalLogService {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Keep last 1000 logs in memory
        this.io = null;
        this.listeners = new Set();
    }

    /**
     * Initialize with Socket.io instance for real-time broadcasting
     */
    init(io) {
        this.io = io;
        
        // Set up socket connection handlers
        if (io) {
            io.on('connection', (socket) => {
                // Send recent logs on connect
                socket.emit('logs:history', this.logs.slice(-100));
                
                // Handle log subscription
                socket.on('logs:subscribe', () => {
                    socket.join('logs');
                });
                
                socket.on('logs:unsubscribe', () => {
                    socket.leave('logs');
                });
            });
        }
    }

    /**
     * Add a log entry
     * @param {string} level - INFO, WARN, ERROR, DEBUG, SUCCESS
     * @param {string} source - Component/service name
     * @param {string} message - Log message
     * @param {object} metadata - Optional additional data
     */
    log(level, source, message, metadata = {}) {
        const entry = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            source,
            message,
            metadata
        };

        // Add to ring buffer
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Broadcast via Socket.io
        if (this.io) {
            this.io.to('logs').emit('logs:new', entry);
        }

        // Notify listeners
        for (const listener of this.listeners) {
            try {
                listener(entry);
            } catch (e) {
                // Ignore listener errors
            }
        }

        // Also log to console with colors
        this._consoleLog(entry);

        return entry;
    }

    /**
     * Colored console output
     */
    _consoleLog(entry) {
        const colors = {
            DEBUG: '\x1b[36m',   // Cyan
            INFO: '\x1b[32m',    // Green
            WARN: '\x1b[33m',    // Yellow
            ERROR: '\x1b[31m',   // Red
            SUCCESS: '\x1b[35m' // Magenta
        };
        const reset = '\x1b[0m';
        const color = colors[entry.level] || '';
        
        const time = entry.timestamp.split('T')[1].split('.')[0];
        console.log(`${color}${time} [${entry.level}] [${entry.source}] ${entry.message}${reset}`);
    }

    // Convenience methods
    info(source, message, metadata) {
        return this.log('INFO', source, message, metadata);
    }

    warn(source, message, metadata) {
        return this.log('WARN', source, message, metadata);
    }

    error(source, message, metadata) {
        return this.log('ERROR', source, message, metadata);
    }

    debug(source, message, metadata) {
        return this.log('DEBUG', source, message, metadata);
    }

    success(source, message, metadata) {
        return this.log('SUCCESS', source, message, metadata);
    }

    /**
     * Get recent logs
     * @param {object} options - Filter options
     */
    getLogs({ limit = 100, level = null, source = null } = {}) {
        let filtered = this.logs;
        
        if (level) {
            filtered = filtered.filter(l => l.level === level.toUpperCase());
        }
        
        if (source) {
            filtered = filtered.filter(l => l.source.includes(source));
        }
        
        return filtered.slice(-limit);
    }

    /**
     * Add a listener for new log entries
     */
    addListener(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
        if (this.io) {
            this.io.to('logs').emit('logs:cleared');
        }
    }

    /**
     * Get stats from StatsService
     */
    getStats() {
        const statsService = require('./StatsService');
        return statsService.getStats();
    }
}

// Singleton instance
const globalLogService = new GlobalLogService();

// Wire up StatsService to track all log entries
const statsService = require('./StatsService');
globalLogService.addListener((entry) => {
    statsService.recordEvent(entry);
});

module.exports = globalLogService;
