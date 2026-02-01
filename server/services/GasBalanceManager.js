/**
 * Gas Balance Manager
 * 
 * Monitors wallet gas (native token) balances and auto-transfers
 * from wallets with excess to wallets that need gas.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class GasBalanceManager {
    constructor() {
        this.enabled = false;
        this.checkIntervalMs = 30 * 60 * 1000; // 30 minutes
        this.intervalId = null;
        this.configPath = path.join(__dirname, '../data/gas_balance_config.json');
        this.globalPassword = null;
        
        // Chain-specific configuration (PLS has much higher values than BNB)
        this.chainConfig = {
            pulsechain: {
                minBalance: 1000,      // Minimum PLS to maintain
                targetBalance: 5000,   // Target balance when topping up
                maxToTransfer: 50000   // Max to transfer at once
            },
            bnb: {
                minBalance: 0.005,     // ~$3 minimum
                targetBalance: 0.01,   // ~$6 target
                maxToTransfer: 0.05    // ~$30 max
            }
        };
        
        // Wallet addresses (will be loaded)
        this.walletAddresses = {};
        
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                this.enabled = data.enabled || false;
                this.minBalance = data.minBalance || 1000;
                this.targetBalance = data.targetBalance || 5000;
                this.maxToTransfer = data.maxToTransfer || 50000;
                this.walletAddresses = data.walletAddresses || {};
                console.log('[GasBalance] Loaded config');
            }
        } catch (err) {
            console.error('[GasBalance] Failed to load config:', err.message);
        }
    }

    saveConfig() {
        try {
            const data = {
                enabled: this.enabled,
                minBalance: this.minBalance,
                targetBalance: this.targetBalance,
                maxToTransfer: this.maxToTransfer,
                walletAddresses: this.walletAddresses,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('[GasBalance] Failed to save config:', err.message);
        }
    }

    setGlobalPassword(password) {
        this.globalPassword = password;
    }

    async getWalletAddress(keystoreName) {
        // Check cache first
        if (this.walletAddresses[keystoreName]) {
            return this.walletAddresses[keystoreName];
        }

        return new Promise((resolve, reject) => {
            const keystorePath = path.join(process.env.KEYSTORE_PATH || `${process.env.HOME}/.foundry/keystores`, keystoreName);
            const foundryBin = process.env.FOUNDRY_BIN || `${process.env.HOME}/.foundry/bin`;
            
            // Write password to temp file
            const tempPw = `/tmp/pw-${Date.now()}`;
            fs.writeFileSync(tempPw, this.globalPassword || '', { mode: 0o600 });
            
            const proc = spawn(`${foundryBin}/cast`, [
                'wallet', 'address',
                '--keystore', keystorePath,
                '--password-file', tempPw
            ]);

            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => stdout += data.toString());
            proc.stderr.on('data', (data) => stderr += data.toString());
            
            proc.on('close', (code) => {
                // Clean up temp file
                try { fs.unlinkSync(tempPw); } catch (e) {}
                
                if (code === 0 && stdout.trim()) {
                    const address = stdout.trim();
                    this.walletAddresses[keystoreName] = address;
                    this.saveConfig();
                    resolve(address);
                } else {
                    reject(new Error(stderr || 'Failed to get address'));
                }
            });
        });
    }

    async getBalance(address, chain = 'pulsechain') {
        const rpcUrl = chain === 'bnb' 
            ? (process.env.BNB_RPC_URL || 'https://bsc-dataseed.bnbchain.org')
            : (process.env.PLS_RPC_URL || 'https://rpc-pulsechain.g4mm4.io');

        return new Promise((resolve, reject) => {
            const foundryBin = process.env.FOUNDRY_BIN || `${process.env.HOME}/.foundry/bin`;
            
            const proc = spawn(`${foundryBin}/cast`, [
                'balance', address,
                '--rpc-url', rpcUrl,
                '--ether'
            ]);

            let stdout = '';
            proc.stdout.on('data', (data) => stdout += data.toString());
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(parseFloat(stdout.trim()));
                } else {
                    reject(new Error('Failed to get balance'));
                }
            });
        });
    }

    async transfer(fromKeystore, toAddress, amount, chain = 'pulsechain') {
        if (!this.globalPassword) {
            console.error('[GasBalance] Cannot transfer - no password set');
            return { success: false, error: 'No password' };
        }

        const rpcUrl = chain === 'bnb' 
            ? (process.env.BNB_RPC_URL || 'https://bsc-dataseed.bnbchain.org')
            : (process.env.PLS_RPC_URL || 'https://rpc-pulsechain.g4mm4.io');

        const keystorePath = path.join(process.env.KEYSTORE_PATH || `${process.env.HOME}/.foundry/keystores`, fromKeystore);
        const foundryBin = process.env.FOUNDRY_BIN || `${process.env.HOME}/.foundry/bin`;

        return new Promise((resolve, reject) => {
            const tempPw = `/tmp/pw-${Date.now()}`;
            fs.writeFileSync(tempPw, this.globalPassword, { mode: 0o600 });

            console.log(`[GasBalance] Transferring ${amount} from ${fromKeystore} to ${toAddress}...`);

            const proc = spawn(`${foundryBin}/cast`, [
                'send', toAddress,
                '--value', `${amount}ether`,
                '--rpc-url', rpcUrl,
                '--keystore', keystorePath,
                '--password-file', tempPw
            ]);

            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => stdout += data.toString());
            proc.stderr.on('data', (data) => stderr += data.toString());
            
            proc.on('close', (code) => {
                // Clean up
                try { fs.unlinkSync(tempPw); } catch (e) {}
                
                if (code === 0) {
                    console.log(`[GasBalance] Transfer successful: ${stdout.trim()}`);
                    resolve({ success: true, txHash: stdout.trim() });
                } else {
                    console.error(`[GasBalance] Transfer failed: ${stderr}`);
                    resolve({ success: false, error: stderr });
                }
            });
        });
    }

    async checkAndBalance(wallets, chain = 'pulsechain') {
        console.log(`[GasBalance] Checking balances on ${chain}...`);
        
        // Get chain-specific thresholds
        const config = this.chainConfig[chain] || this.chainConfig.pulsechain;
        const { minBalance, targetBalance, maxToTransfer } = config;
        
        const balances = [];
        
        // Get all balances
        for (const wallet of wallets) {
            try {
                const address = await this.getWalletAddress(wallet);
                const balance = await this.getBalance(address, chain);
                balances.push({ wallet, address, balance });
                console.log(`[GasBalance] ${wallet}: ${balance.toFixed(4)} ${chain === 'bnb' ? 'BNB' : 'PLS'}`);
            } catch (err) {
                console.error(`[GasBalance] Error checking ${wallet}:`, err.message);
            }
        }

        // Find wallets needing gas and wallets with excess
        const needsGas = balances.filter(b => b.balance < minBalance);
        const hasExcess = balances.filter(b => b.balance > targetBalance * 2);

        if (needsGas.length === 0) {
            console.log('[GasBalance] All wallets have sufficient gas');
            return { success: true, transfers: [] };
        }

        if (hasExcess.length === 0) {
            console.log('[GasBalance] No wallets with excess to transfer from');
            return { success: false, error: 'No excess funds available' };
        }

        // Perform transfers
        const transfers = [];
        for (const recipient of needsGas) {
            const donor = hasExcess[0]; // Use first wallet with excess
            const amountNeeded = targetBalance - recipient.balance;
            const amountToTransfer = Math.min(amountNeeded, maxToTransfer);

            if (donor.balance - amountToTransfer > targetBalance) {
                const result = await this.transfer(donor.wallet, recipient.address, amountToTransfer, chain);
                if (result.success) {
                    transfers.push({
                        from: donor.wallet,
                        to: recipient.wallet,
                        amount: amountToTransfer,
                        txHash: result.txHash
                    });
                    donor.balance -= amountToTransfer;
                }
            }
        }

        return { success: true, transfers };
    }

    enable() {
        this.enabled = true;
        this.saveConfig();
        console.log('[GasBalance] Enabled');
        return { success: true };
    }

    disable() {
        this.enabled = false;
        this.saveConfig();
        console.log('[GasBalance] Disabled');
        return { success: true };
    }

    getStatus() {
        return {
            enabled: this.enabled,
            chainConfig: this.chainConfig,
            walletAddresses: this.walletAddresses
        };
    }

    updateConfig(config) {
        // Update chain-specific config
        if (config.chain && config.minBalance !== undefined) {
            const chain = config.chain;
            if (this.chainConfig[chain]) {
                if (config.minBalance !== undefined) this.chainConfig[chain].minBalance = config.minBalance;
                if (config.targetBalance !== undefined) this.chainConfig[chain].targetBalance = config.targetBalance;
                if (config.maxToTransfer !== undefined) this.chainConfig[chain].maxToTransfer = config.maxToTransfer;
            }
        }
        this.saveConfig();
        return { success: true };
    }
}

// Singleton
const gasBalanceManager = new GasBalanceManager();

module.exports = gasBalanceManager;
