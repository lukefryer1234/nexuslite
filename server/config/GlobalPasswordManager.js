/**
 * Global Password Manager
 * Manages a single master password to unlock all Foundry keystores
 * Uses AES-256-GCM encryption with PBKDF2 key derivation
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = process.env.NEXUS_LITE_DATA || path.join(process.env.HOME || '/home/luke', '.nexus-lite');
const PASSWORDS_FILE = path.join(DATA_DIR, 'wallet-passwords.enc');
const SALT_FILE = path.join(DATA_DIR, '.salt');

class GlobalPasswordManager {
    constructor() {
        this.masterKey = null;
        this.masterPassword = null; // Store the actual password for use as default wallet password
        this.cachedPasswords = new Map(); // keystoreName -> password
        this.isUnlocked = false;
        
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
        }
    }

    /**
     * Derive encryption key from password using PBKDF2
     */
    _deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    }

    /**
     * Get or create salt for key derivation
     */
    _getSalt() {
        if (fs.existsSync(SALT_FILE)) {
            return fs.readFileSync(SALT_FILE);
        }
        const salt = crypto.randomBytes(32);
        fs.writeFileSync(SALT_FILE, salt, { mode: 0o600 });
        return salt;
    }

    /**
     * Encrypt data with AES-256-GCM
     */
    _encrypt(data, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]).toString('base64');
    }

    /**
     * Decrypt data with AES-256-GCM
     */
    _decrypt(encryptedData, key) {
        const buffer = Buffer.from(encryptedData, 'base64');
        const iv = buffer.subarray(0, 16);
        const authTag = buffer.subarray(16, 32);
        const encrypted = buffer.subarray(32);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    }

    /**
     * Check if global password has been set up
     */
    isSetup() {
        return fs.existsSync(PASSWORDS_FILE);
    }

    /**
     * Initialize or change global password
     * @param {string} newPassword - New master password
     * @param {string} oldPassword - Old password (required if changing)
     */
    async setGlobalPassword(newPassword, oldPassword = null) {
        let existingPasswords = {};
        
        // If changing password, decrypt existing data first
        if (this.isSetup()) {
            if (!oldPassword) {
                throw new Error('Old password required to change global password');
            }
            const salt = this._getSalt();
            const oldKey = this._deriveKey(oldPassword, salt);
            try {
                const encryptedData = fs.readFileSync(PASSWORDS_FILE, 'utf8');
                existingPasswords = this._decrypt(encryptedData, oldKey);
            } catch (err) {
                throw new Error('Invalid old password');
            }
        }

        // Encrypt with new password
        const salt = this._getSalt();
        const newKey = this._deriveKey(newPassword, salt);
        const encrypted = this._encrypt(existingPasswords, newKey);
        fs.writeFileSync(PASSWORDS_FILE, encrypted, { mode: 0o600 });

        // Update cached state
        this.masterKey = newKey;
        this.masterPassword = newPassword; // Store for fallback use
        this.cachedPasswords = new Map(Object.entries(existingPasswords));
        this.isUnlocked = true;

        return { success: true };
    }

    /**
     * Unlock all keystores with global password
     * @param {string} password - Global password
     */
    async unlockAll(password) {
        if (!this.isSetup()) {
            // First time - set up with this password
            await this.setGlobalPassword(password);
            return { success: true, unlockedCount: 0, isNewSetup: true };
        }

        const salt = this._getSalt();
        const key = this._deriveKey(password, salt);

        try {
            const encryptedData = fs.readFileSync(PASSWORDS_FILE, 'utf8');
            const passwords = this._decrypt(encryptedData, key);
            
            this.masterKey = key;
            this.masterPassword = password; // Store for fallback use
            this.cachedPasswords = new Map(Object.entries(passwords));
            this.isUnlocked = true;

            return { 
                success: true, 
                unlockedCount: this.cachedPasswords.size,
                wallets: Array.from(this.cachedPasswords.keys())
            };
        } catch (err) {
            throw new Error('Invalid global password');
        }
    }

    /**
     * Lock all - clear cached passwords from memory
     */
    lockAll() {
        this.masterKey = null;
        this.masterPassword = null;
        this.cachedPasswords.clear();
        this.isUnlocked = false;
        return { success: true };
    }

    /**
     * Add a new wallet with its password
     * @param {string} name - Keystore name
     * @param {string} privateKey - Wallet private key
     * @param {string} walletPassword - Password for this specific wallet
     */
    async addWallet(name, privateKey, walletPassword = null) {
        if (!this.isUnlocked) {
            throw new Error('Global password not unlocked');
        }

        // Use provided password or generate a secure random one
        const password = walletPassword || crypto.randomBytes(32).toString('hex');

        // Create the keystore using Foundry's cast
        const foundryBin = process.env.FOUNDRY_BIN || '/home/luke/.foundry/bin';
        const keystorePath = process.env.KEYSTORE_PATH || '/home/luke/.foundry/keystores';
        
        try {
            // Create keystore with cast wallet import
            execSync(
                `echo "${password}" | ${foundryBin}/cast wallet import "${name}" --private-key "${privateKey}" --password-stdin`,
                { 
                    cwd: keystorePath,
                    stdio: ['pipe', 'pipe', 'pipe']
                }
            );

            // Store password encrypted
            this.cachedPasswords.set(name, password);
            await this._savePasswords();

            // Get the address
            const addressOutput = execSync(
                `echo "${password}" | ${foundryBin}/cast wallet address --account "${name}" --password-stdin`,
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );
            const address = addressOutput.toString().trim();

            return { success: true, name, address };
        } catch (err) {
            throw new Error(`Failed to create wallet: ${err.message}`);
        }
    }

    /**
     * Import existing keystore and store its password
     * @param {string} name - Keystore name (must already exist)
     * @param {string} password - Password for this keystore
     */
    async importKeystorePassword(name, password) {
        if (!this.isUnlocked) {
            throw new Error('Global password not unlocked');
        }

        // Verify password works
        const foundryBin = process.env.FOUNDRY_BIN || '/home/luke/.foundry/bin';
        try {
            execSync(
                `echo "${password}" | ${foundryBin}/cast wallet address --account "${name}" --password-stdin`,
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );
        } catch (err) {
            throw new Error('Invalid password for keystore');
        }

        // Store password
        this.cachedPasswords.set(name, password);
        await this._savePasswords();

        return { success: true, name };
    }

    /**
     * Get password for a wallet
     * @param {string} name - Keystore name
     */
    getWalletPassword(name) {
        if (!this.isUnlocked) {
            return null;
        }
        // Return stored password for this wallet, or fall back to master password
        return this.cachedPasswords.get(name) || this.masterPassword;
    }

    /**
     * Get all stored wallet names
     */
    getStoredWallets() {
        return Array.from(this.cachedPasswords.keys());
    }

    /**
     * Check unlock status
     */
    getStatus() {
        return {
            isSetup: this.isSetup(),
            isUnlocked: this.isUnlocked,
            walletCount: this.cachedPasswords.size
        };
    }

    /**
     * Save passwords to encrypted file
     */
    async _savePasswords() {
        if (!this.masterKey) {
            throw new Error('Not unlocked');
        }
        const passwordsObj = Object.fromEntries(this.cachedPasswords);
        const encrypted = this._encrypt(passwordsObj, this.masterKey);
        fs.writeFileSync(PASSWORDS_FILE, encrypted, { mode: 0o600 });
    }

    /**
     * Remove a wallet's stored password
     * @param {string} name - Keystore name
     */
    async removeWallet(name) {
        if (!this.isUnlocked) {
            throw new Error('Global password not unlocked');
        }
        this.cachedPasswords.delete(name);
        await this._savePasswords();
        return { success: true };
    }
}

// Singleton instance
const globalPasswordManager = new GlobalPasswordManager();

module.exports = globalPasswordManager;
