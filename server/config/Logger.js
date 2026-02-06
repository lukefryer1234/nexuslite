/**
 * Simple Logger utility for nexus-lite
 * 
 * Creates named loggers that route to GlobalLogService
 */

const globalLogService = require('../services/GlobalLogService');

class Logger {
    constructor(source) {
        this.source = source;
    }

    info(message, metadata = {}) {
        return globalLogService.info(this.source, message, metadata);
    }

    warn(message, metadata = {}) {
        return globalLogService.warn(this.source, message, metadata);
    }

    error(message, metadata = {}) {
        return globalLogService.error(this.source, message, metadata);
    }

    debug(message, metadata = {}) {
        return globalLogService.debug(this.source, message, metadata);
    }

    success(message, metadata = {}) {
        return globalLogService.success(this.source, message, metadata);
    }

    /**
     * Create a child logger with additional prefix
     */
    child(suffix) {
        return new Logger(`${this.source}:${suffix}`);
    }
}

module.exports = Logger;
