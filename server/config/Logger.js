/**
 * Simple Logger for Nexus Lite
 */

class Logger {
    constructor(name = 'NexusLite') {
        this.name = name;
    }

    _format(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `[${timestamp}] [${level}] [${this.name}] ${message}${metaStr}`;
    }

    info(message, meta = {}) {
        console.log(this._format('INFO', message, meta));
    }

    warn(message, meta = {}) {
        console.warn(this._format('WARN', message, meta));
    }

    error(message, meta = {}) {
        console.error(this._format('ERROR', message, meta));
    }

    debug(message, meta = {}) {
        if (process.env.DEBUG) {
            console.log(this._format('DEBUG', message, meta));
        }
    }
}

module.exports = Logger;
