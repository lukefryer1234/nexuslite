/**
 * TransactionQueue - Prevents nonce conflicts by serializing transactions per wallet/chain
 * 
 * When multiple scripts run for the same wallet, they can conflict on nonce.
 * This queue ensures only one transaction attempt happens at a time per wallet/chain.
 */

class TransactionQueue {
    constructor() {
        // Map of wallet:chain -> { queue: Promise, pending: number }
        this.queues = new Map();
        this.locks = new Map();
    }

    /**
     * Get unique key for wallet/chain pair
     */
    _getKey(wallet, chain) {
        return `${wallet.toLowerCase()}:${chain.toLowerCase()}`;
    }

    /**
     * Execute a function with exclusive access for a wallet/chain pair
     * Subsequent calls will wait until previous ones complete
     * 
     * @param {string} wallet - Wallet identifier (name or address)
     * @param {string} chain - Chain identifier (pls, bnb)
     * @param {Function} fn - Async function to execute
     * @param {number} lockTimeoutMs - Max time to hold the lock (default 60s)
     * @returns {Promise<any>} - Result of fn()
     */
    async execute(wallet, chain, fn, lockTimeoutMs = 60000) {
        const key = this._getKey(wallet, chain);
        
        // Get or create the queue for this wallet/chain
        if (!this.queues.has(key)) {
            this.queues.set(key, Promise.resolve());
        }
        
        // Track pending count
        const pending = (this.locks.get(key) || 0) + 1;
        this.locks.set(key, pending);
        
        // Chain onto the queue
        const currentQueue = this.queues.get(key);
        
        const execution = currentQueue.then(async () => {
            try {
                // Add timeout protection
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Transaction lock timeout')), lockTimeoutMs);
                });
                
                return await Promise.race([fn(), timeoutPromise]);
            } finally {
                // Decrement pending count
                const remaining = (this.locks.get(key) || 1) - 1;
                if (remaining <= 0) {
                    this.locks.delete(key);
                } else {
                    this.locks.set(key, remaining);
                }
            }
        }).catch(err => {
            // Don't let errors break the queue
            throw err;
        });
        
        // Update the queue (don't wait for this execution, just chain)
        this.queues.set(key, execution.catch(() => {}));
        
        return execution;
    }

    /**
     * Check if there are pending transactions for a wallet/chain
     */
    isPending(wallet, chain) {
        const key = this._getKey(wallet, chain);
        return (this.locks.get(key) || 0) > 0;
    }

    /**
     * Get pending count for a wallet/chain
     */
    getPendingCount(wallet, chain) {
        const key = this._getKey(wallet, chain);
        return this.locks.get(key) || 0;
    }

    /**
     * Get all active wallet/chains with pending transactions
     */
    getActiveQueues() {
        const active = [];
        for (const [key, count] of this.locks.entries()) {
            if (count > 0) {
                const [wallet, chain] = key.split(':');
                active.push({ wallet, chain, pending: count });
            }
        }
        return active;
    }
}

// Singleton instance
const transactionQueue = new TransactionQueue();

module.exports = transactionQueue;
