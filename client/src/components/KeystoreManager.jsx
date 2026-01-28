import React, { useState, useEffect, useRef } from 'react';
import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import { keccak_256 } from '@noble/hashes/sha3.js';
import '../pages/FoundryPage.css';

const API_BASE = 'http://localhost:4001';

// Terminal-style Keystore Manager
export default function KeystoreManager({ socket }) {
    // Wallet list
    const [keystores, setKeystores] = useState([]);
    const [walletBalances, setWalletBalances] = useState({});

    // Create wallet form
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createMethod, setCreateMethod] = useState('key'); // 'key' or 'seed'
    const [walletName, setWalletName] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [password, setPassword] = useState('');

    // Seed phrase import
    const [seedWordCount, setSeedWordCount] = useState(12);
    const [seedWords, setSeedWords] = useState(Array(12).fill(''));
    const [seedPassphrase, setSeedPassphrase] = useState('');
    const [usePassphrase, setUsePassphrase] = useState(false);
    const [seedAccounts, setSeedAccounts] = useState([]);
    const [showSeedAccounts, setShowSeedAccounts] = useState(false);
    const [derivingKeys, setDerivingKeys] = useState(false);
    const [fetchingBalances, setFetchingBalances] = useState(false);
    const [derivationPath, setDerivationPath] = useState('metamask'); // default to Metamask

    // Derivation path patterns for different wallets
    const derivationPaths = {
        metamask: { label: 'Metamask/MEW (m/44\'/60\'/0\'/0/x)', pattern: (i) => `m/44'/60'/0'/0/${i}` },
        ledgerLive: { label: 'Ledger Live (m/44\'/60\'/x\'/0/0)', pattern: (i) => `m/44'/60'/${i}'/0/0` },
        ledgerLegacy: { label: 'Ledger Legacy (m/44\'/60\'/0\'/x)', pattern: (i) => `m/44'/60'/0'/${i}` },
        trezorOld: { label: 'Trezor Old (m/44\'/60\'/0\'/x)', pattern: (i) => `m/44'/60'/0'/${i}` },
        trezorEth: { label: 'Trezor ETH (m/44\'/60\'/x\'/0)', pattern: (i) => `m/44'/60'/${i}'/0` },
        exodus: { label: 'Exodus (m/44\'/60\'/0\'/0/x)', pattern: (i) => `m/44'/60'/0'/0/${i}` },
        trustWallet: { label: 'Trust Wallet (m/44\'/60\'/0\'/0/x)', pattern: (i) => `m/44'/60'/0'/0/${i}` },
        keepkey: { label: 'KeepKey (m/44\'/60\'/x\'/0/0)', pattern: (i) => `m/44'/60'/${i}'/0/0` },
        ethereumOld: { label: 'ETH Old (m/44\'/60\'/0\')', pattern: (i) => `m/44'/60'/${i}'` },
        coinbase: { label: 'Coinbase (m/44\'/60\'/0\'/0/x)', pattern: (i) => `m/44'/60'/0'/0/${i}` }
    };

    // Reveal key modal
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [revealPassword, setRevealPassword] = useState('');
    const [revealedKey, setRevealedKey] = useState('');
    const [showRevealModal, setShowRevealModal] = useState(false);
    const [revealing, setRevealing] = useState(false);

    // Test wallet modal
    const [showTestModal, setShowTestModal] = useState(false);
    const [testPassword, setTestPassword] = useState('');
    const [testResults, setTestResults] = useState(null);
    const [testing, setTesting] = useState(false);

    // Rename wallet modal
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameNewName, setRenameNewName] = useState('');
    const [renaming, setRenaming] = useState(false);

    // Character status (tracks if wallet has game characters on each chain)
    const [characterStatus, setCharacterStatus] = useState({});

    // Terminal output
    const [terminalOutput, setTerminalOutput] = useState([]);
    const terminalRef = useRef(null);

    useEffect(() => {
        loadKeystores();
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalOutput]);

    const addOutput = (text, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalOutput(prev => [...prev.slice(-50), { timestamp, text, type }]);
    };

    const handleCopyLogs = () => {
        const logText = terminalOutput.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
        navigator.clipboard.writeText(logText);
        addOutput('✓ Logs copied to clipboard', 'success');
    };

    const handleClearLogs = () => {
        setTerminalOutput([]);
    };

    const loadKeystores = () => {
        fetch(`${API_BASE}/api/keystore/list`)
            .then(res => res.json())
            .then(data => {
                if (data.wallets) {
                    // Map wallet objects to just their names for compatibility
                    const walletNames = data.wallets.map(w => w.name);
                    setKeystores(walletNames);
                    // Auto-fetch balances and character status on load
                    fetchWalletBalances(walletNames);
                    fetchCharacterStatus(walletNames);
                    addOutput(`✓ Loaded ${walletNames.length} wallets`, 'success');
                }
            })
            .catch(err => addOutput(`Failed to load keystores: ${err.message}`, 'error'));
    };

    const fetchWalletBalances = async (walletNames) => {
        const balances = {};
        for (const name of walletNames) {
            const storedAddr = localStorage.getItem(`wallet_addr_${name}`);
            if (storedAddr) {
                try {
                    const res = await fetch(`${API_BASE}/api/wallet/balance/${storedAddr}`);
                    if (res.ok) {
                        const data = await res.json();
                        balances[name] = {
                            address: storedAddr,
                            pls: data.pulsechain?.balance || '0',
                            bnb: data.bnb?.balance || '0'
                        };
                    }
                } catch (e) { /* ignore */ }
            }
        }
        setWalletBalances(balances);
    };

    // Fetch character status for all wallets (includes player names for profile links)
    const fetchCharacterStatus = async (walletNames) => {
        const statuses = {};
        let checkedCount = 0;
        let foundCount = 0;

        for (const name of walletNames) {
            const storedAddr = localStorage.getItem(`wallet_addr_${name}`);
            if (storedAddr) {
                checkedCount++;
                try {
                    const res = await fetch(`${API_BASE}/api/characters/status/${storedAddr}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success) {
                            statuses[name] = {
                                pls: data.pls,
                                bnb: data.bnb,
                                plsName: data.plsName || null,
                                bnbName: data.bnbName || null
                            };
                            if (data.pls || data.bnb) {
                                foundCount++;
                            }
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        }

        console.log(`[CharacterStatus] Checked ${checkedCount}/${walletNames.length} wallets, found ${foundCount} with characters`);
        setCharacterStatus(prev => ({ ...prev, ...statuses }));
    };

    // Test all wallets at once - uses cached addresses when available
    const handleTestAllWallets = async () => {
        if (keystores.length === 0) {
            addOutput('No wallets to test', 'error');
            return;
        }

        addOutput(`Testing ${keystores.length} wallets...`);
        setTesting(true);

        // Check which wallets have cached addresses and which need password
        const cachedWallets = [];
        const uncachedWallets = [];

        for (const name of keystores) {
            const storedAddr = localStorage.getItem(`wallet_addr_${name}`);
            if (storedAddr) {
                cachedWallets.push({ name, address: storedAddr });
            } else {
                uncachedWallets.push(name);
            }
        }

        // For cached wallets, just fetch balances directly (no password needed)
        for (const { name, address } of cachedWallets) {
            try {
                const res = await fetch(`${API_BASE}/api/wallet/balance/${address}`);
                if (res.ok) {
                    const data = await res.json();
                    setWalletBalances(prev => ({
                        ...prev,
                        [name]: {
                            address: address,
                            pls: data.pulsechain?.balance || '0',
                            bnb: data.bnb?.balance || '0'
                        }
                    }));
                    const plsStatus = data.pulsechain?.success !== false ? '✓' : '✗';
                    const bnbStatus = data.bnb?.success !== false ? '✓' : '✗';
                    addOutput(`✓ ${name}: PLS ${plsStatus} ${data.pulsechain?.balance || '0'} | BNB ${bnbStatus} ${data.bnb?.balance || '0'}`, 'success');
                } else {
                    addOutput(`✗ ${name}: Failed to fetch balance`, 'error');
                }
            } catch (err) {
                addOutput(`✗ ${name}: ${err.message}`, 'error');
            }
        }

        // For uncached wallets, prompt for password once
        if (uncachedWallets.length > 0) {
            const testPassword = window.prompt(`Enter password to unlock ${uncachedWallets.length} new wallet(s):`);
            if (testPassword) {
                for (const name of uncachedWallets) {
                    try {
                        const res = await fetch(`${API_BASE}/api/keystore/test/${encodeURIComponent(name)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            
                            body: JSON.stringify({ password: testPassword })
                        });
                        const data = await res.json();
                        if (data.success) {
                            localStorage.setItem(`wallet_addr_${name}`, data.results.address);
                            setWalletBalances(prev => ({
                                ...prev,
                                [name]: {
                                    address: data.results.address,
                                    pls: data.results.pulsechain?.balance || '0',
                                    bnb: data.results.bnb?.balance || '0'
                                }
                            }));
                            const plsStatus = data.results.pulsechain.success ? '✓' : '✗';
                            const bnbStatus = data.results.bnb.success ? '✓' : '✗';
                            addOutput(`✓ ${name}: PLS ${plsStatus} ${data.results.pulsechain.balance || data.results.pulsechain.error} | BNB ${bnbStatus} ${data.results.bnb.balance || data.results.bnb.error}`, 'success');
                        } else {
                            addOutput(`✗ ${name}: ${data.error}`, 'error');
                        }
                    } catch (err) {
                        addOutput(`✗ ${name}: ${err.message}`, 'error');
                    }
                }
            }
        }

        setTesting(false);
        addOutput('✓ All wallet tests complete', 'success');
        fetchCharacterStatus(keystores);
    };

    const pubKeyToAddress = (publicKey) => {
        const pubKeyBytes = publicKey.slice(1);
        const hash = keccak_256(pubKeyBytes);
        return '0x' + Buffer.from(hash.slice(-20)).toString('hex');
    };

    const handleCreateFromKey = () => {
        if (!walletName.trim()) {
            addOutput('Please enter a wallet name', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(walletName.trim())) {
            addOutput('Wallet name can only contain letters, numbers, underscores, and hyphens', 'error');
            return;
        }
        if (!privateKey.trim()) {
            addOutput('Please enter a private key', 'error');
            return;
        }
        if (!password.trim()) {
            addOutput('Please enter a password', 'error');
            return;
        }

        let cleanKey = privateKey.trim();
        if (cleanKey.startsWith('0x')) cleanKey = cleanKey.slice(2);

        if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
            addOutput('Invalid private key format (should be 64 hex characters)', 'error');
            return;
        }

        const savedName = walletName.trim();
        addOutput(`Creating wallet "${savedName}"...`);

        // Derive address from private key for balance lookup
        let derivedAddress = null;
        try {
            const keyBytes = Buffer.from(cleanKey, 'hex');
            const hdKey = HDKey.fromMasterSeed(Buffer.alloc(64)); // dummy
            const pubKey = hdKey.derive("m").publicKey; // This won't work directly
            // Actually need secp256k1 - let's just fetch after create instead
        } catch (e) { /* ignore */ }

        fetch(`${API_BASE}/api/keystore/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            
            body: JSON.stringify({ name: savedName, privateKey: cleanKey, password })
        })
            .then(res => res.json())
            .then(async data => {
                if (data.success) {
                    addOutput(`✓ Wallet "${savedName}" created successfully`, 'success');

                    // Fetch address and balance via test endpoint
                    try {
                        const testRes = await fetch(`${API_BASE}/api/keystore/test/${encodeURIComponent(savedName)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            
                            body: JSON.stringify({ password })
                        });
                        const testData = await testRes.json();
                        if (testData.success) {
                            localStorage.setItem(`wallet_addr_${savedName}`, testData.results.address);
                            setWalletBalances(prev => ({
                                ...prev,
                                [savedName]: {
                                    address: testData.results.address,
                                    pls: testData.results.pulsechain?.balance || '0',
                                    bnb: testData.results.bnb?.balance || '0'
                                }
                            }));
                        }
                    } catch (e) { /* ignore */ }

                    loadKeystores();
                    setShowCreateForm(false);
                    setWalletName('');
                    setPrivateKey('');
                    setPassword('');
                } else {
                    addOutput(`Failed: ${data.error}`, 'error');
                }
            })
            .catch(err => addOutput(`Error: ${err.message}`, 'error'));
    };

    const handleWordCountChange = (count) => {
        setSeedWordCount(count);
        setSeedWords(Array(count).fill(''));
    };

    const handleWordChange = (index, value) => {
        const newWords = [...seedWords];
        newWords[index] = value.toLowerCase().replace(/\s/g, '');
        setSeedWords(newWords);
    };

    const handlePaste = (e, startIndex) => {
        const pastedText = e.clipboardData.getData('text').trim().toLowerCase();
        const words = pastedText.split(/\s+/).filter(w => w.length > 0);

        if (words.length > 1) {
            e.preventDefault();
            if (startIndex === 0 && (words.length === 12 || words.length === 24)) {
                setSeedWordCount(words.length);
                setSeedWords(words.slice(0, words.length));
            } else {
                const newWords = [...seedWords];
                words.forEach((word, i) => {
                    if (startIndex + i < seedWords.length) {
                        newWords[startIndex + i] = word;
                    }
                });
                setSeedWords(newWords);
            }
            addOutput(`✓ Pasted ${words.length} words`, 'success');
        }
    };

    const handleDeriveSeedAccounts = () => {
        const phrase = seedWords.join(' ').trim();
        if (!phrase || seedWords.some(w => w === '')) {
            addOutput('Please fill in all seed words', 'error');
            return;
        }
        if (!bip39.validateMnemonic(phrase)) {
            addOutput('Invalid seed phrase - check spelling of each word', 'error');
            return;
        }

        setDerivingKeys(true);
        const pathConfig = derivationPaths[derivationPath];
        addOutput(`Deriving accounts using ${pathConfig.label}...`);

        try {
            const passphrase = usePassphrase ? seedPassphrase : '';
            const seed = bip39.mnemonicToSeedSync(phrase, passphrase);
            const hdKey = HDKey.fromMasterSeed(seed);
            const accounts = [];

            for (let i = 0; i < 20; i++) {
                const path = pathConfig.pattern(i);
                const child = hdKey.derive(path);
                const address = pubKeyToAddress(child.publicKey);
                accounts.push({
                    index: i,
                    path,
                    address,
                    privateKey: Buffer.from(child.privateKey).toString('hex')
                });
            }

            setSeedAccounts(accounts);
            setShowSeedAccounts(true);
            addOutput(`✓ Derived ${accounts.length} accounts`, 'success');
            fetchAccountBalances(accounts);
        } catch (err) {
            addOutput(`Error deriving accounts: ${err.message}`, 'error');
        } finally {
            setDerivingKeys(false);
        }
    };

    // Load more accounts from current seed
    const handleLoadMoreAccounts = () => {
        const phrase = seedWords.join(' ').trim();
        if (!phrase || !bip39.validateMnemonic(phrase)) {
            addOutput('Cannot load more - invalid seed phrase', 'error');
            return;
        }

        const startIndex = seedAccounts.length;
        const endIndex = startIndex + 20;
        const pathConfig = derivationPaths[derivationPath];
        addOutput(`Deriving accounts ${startIndex} to ${endIndex - 1} using ${pathConfig.label}...`);
        setDerivingKeys(true);

        try {
            const passphrase = usePassphrase ? seedPassphrase : '';
            const seed = bip39.mnemonicToSeedSync(phrase, passphrase);
            const hdKey = HDKey.fromMasterSeed(seed);
            const newAccounts = [];

            for (let i = startIndex; i < endIndex; i++) {
                const path = pathConfig.pattern(i);
                const child = hdKey.derive(path);
                const address = pubKeyToAddress(child.publicKey);
                newAccounts.push({
                    index: i,
                    path,
                    address,
                    privateKey: Buffer.from(child.privateKey).toString('hex')
                });
            }

            const allAccounts = [...seedAccounts, ...newAccounts];
            setSeedAccounts(allAccounts);
            addOutput(`✓ Now showing ${allAccounts.length} accounts`, 'success');
            fetchAccountBalances(newAccounts);
        } catch (err) {
            addOutput(`Error deriving more accounts: ${err.message}`, 'error');
        } finally {
            setDerivingKeys(false);
        }
    };

    // Search for a specific address across all derivation paths - FAST version
    const [searchAddress, setSearchAddress] = useState('');
    const handleSearchAddress = async () => {
        const phrase = seedWords.join(' ').trim();
        if (!phrase || !bip39.validateMnemonic(phrase)) {
            addOutput('Invalid seed phrase', 'error');
            return;
        }

        const targetAddr = searchAddress.trim().toLowerCase();
        if (!targetAddr || !targetAddr.startsWith('0x') || targetAddr.length !== 42) {
            addOutput('Please enter a valid Ethereum address (0x...)', 'error');
            return;
        }

        const maxIndex = 1000; // Search 1000 addresses per path
        const numPaths = Object.keys(derivationPaths).length;
        addOutput(`⚡ Fast searching for ${targetAddr.slice(0, 10)}...`);
        addOutput(`Scanning ${numPaths} paths × ${maxIndex} indices = ${numPaths * maxIndex} addresses...`);
        setDerivingKeys(true);

        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(async () => {
            try {
                const passphrase = usePassphrase ? seedPassphrase : '';
                const seed = bip39.mnemonicToSeedSync(phrase, passphrase);
                const hdKey = HDKey.fromMasterSeed(seed);
                const startTime = Date.now();

                // Search all derivation paths - 1000 accounts each (pure CPU, no network)
                for (const [pathKey, pathConfig] of Object.entries(derivationPaths)) {
                    for (let i = 0; i < maxIndex; i++) {
                        const path = pathConfig.pattern(i);
                        try {
                            const child = hdKey.derive(path);
                            const address = pubKeyToAddress(child.publicKey).toLowerCase();

                            if (address === targetAddr) {
                                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                                addOutput(`✅ FOUND in ${elapsed}s!`, 'success');
                                addOutput(`   Wallet: ${pathConfig.label}`, 'success');
                                addOutput(`   Index: ${i}`, 'success');
                                addOutput(`   Path: ${path}`, 'success');

                                // Now fetch balance (only 1 API call after finding)
                                const res = await fetch(`${API_BASE}/api/wallet/balance/${address}`);
                                let plsBalance = '?', bnbBalance = '?';
                                if (res.ok) {
                                    const data = await res.json();
                                    plsBalance = data.pulsechain?.balance || '0';
                                    bnbBalance = data.bnb?.balance || '0';
                                }

                                const foundAccount = {
                                    index: i,
                                    path,
                                    address: pubKeyToAddress(child.publicKey),
                                    privateKey: Buffer.from(child.privateKey).toString('hex'),
                                    plsBalance,
                                    bnbBalance
                                };

                                setDerivationPath(pathKey);
                                setSeedAccounts([foundAccount]);
                                setShowSeedAccounts(true);
                                setDerivingKeys(false);
                                return;
                            }
                        } catch (e) {
                            // Skip invalid paths silently
                        }
                    }
                }

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                addOutput(`❌ Not found after ${elapsed}s (${numPaths * maxIndex} addresses checked)`, 'error');
                addOutput(`Possible issues:`, 'error');
                addOutput(`  • Passphrase (25th word) was used - check the box above`, 'error');
                addOutput(`  • Index > ${maxIndex} (rare but possible)`, 'error');
                addOutput(`  • One seed word may be incorrect`, 'error');
            } catch (err) {
                addOutput(`Error: ${err.message}`, 'error');
            } finally {
                setDerivingKeys(false);
            }
        }, 50); // Small delay to let UI render "searching..." message
    };

    // Auto-scan to find accounts with balance
    const handleAutoScanAccounts = async () => {
        const phrase = seedWords.join(' ').trim();
        if (!phrase || !bip39.validateMnemonic(phrase)) {
            addOutput('Invalid seed phrase', 'error');
            return;
        }

        addOutput(`🔍 Auto-scanning for accounts with balance using ${derivationPaths[derivationPath].label}...`);
        setDerivingKeys(true);
        const pathConfig = derivationPaths[derivationPath];

        try {
            const passphrase = usePassphrase ? seedPassphrase : '';
            const seed = bip39.mnemonicToSeedSync(phrase, passphrase);
            const hdKey = HDKey.fromMasterSeed(seed);
            const fundedAccounts = [];
            const emptyAccounts = [];

            for (let i = 0; i < 100; i++) {
                const path = pathConfig.pattern(i);
                const child = hdKey.derive(path);
                const address = pubKeyToAddress(child.publicKey);

                // Check balance
                try {
                    const res = await fetch(`${API_BASE}/api/wallet/balance/${address}`);
                    if (res.ok) {
                        const data = await res.json();
                        const plsBalance = data.pulsechain?.balance || '0';
                        const bnbBalance = data.bnb?.balance || '0';

                        const account = {
                            index: i,
                            path,
                            address,
                            privateKey: Buffer.from(child.privateKey).toString('hex'),
                            plsBalance,
                            bnbBalance
                        };

                        // Check if has any balance
                        const hasBalance = (plsBalance !== '0' && plsBalance !== '0 PLS') ||
                            (bnbBalance !== '0' && bnbBalance !== '0 BNB');

                        if (hasBalance) {
                            fundedAccounts.push(account);
                            addOutput(`✓ Found funded account #${i}: ${address.slice(0, 10)}...`, 'success');
                        } else {
                            emptyAccounts.push(account);
                        }
                    }
                } catch (e) {
                    // Skip failed balance checks
                    emptyAccounts.push({
                        index: i,
                        path,
                        address,
                        privateKey: Buffer.from(child.privateKey).toString('hex'),
                        plsBalance: '?',
                        bnbBalance: '?'
                    });
                }

                // Update progress every 10 accounts
                if (i > 0 && i % 10 === 0) {
                    addOutput(`Scanned ${i}/100 accounts, found ${fundedAccounts.length} with balance...`);
                }
            }

            // Sort: funded accounts first, then empty ones
            const allAccounts = [...fundedAccounts, ...emptyAccounts];
            setSeedAccounts(allAccounts);
            setShowSeedAccounts(true);
            addOutput(`✓ Scan complete! Found ${fundedAccounts.length} funded accounts out of 100 scanned.`, 'success');
        } catch (err) {
            addOutput(`Error scanning: ${err.message}`, 'error');
        } finally {
            setDerivingKeys(false);
        }
    };

    const fetchAccountBalances = async (accounts) => {
        setFetchingBalances(true);
        addOutput(`Fetching balances for ${accounts.length} accounts...`);

        const updatedAccounts = [...accounts];

        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            try {
                const res = await fetch(`${API_BASE}/api/wallet/balance/${acc.address}`);
                if (res.ok) {
                    const data = await res.json();
                    updatedAccounts[i] = {
                        ...acc,
                        plsBalance: data.pulsechain?.balance || '0',
                        bnbBalance: data.bnb?.balance || '0'
                    };
                }
            } catch (err) { /* ignore */ }
        }

        // Merge with existing accounts (update in place)
        setSeedAccounts(prev => {
            const merged = [...prev];
            for (const updated of updatedAccounts) {
                const idx = merged.findIndex(a => a.index === updated.index);
                if (idx >= 0) {
                    merged[idx] = updated;
                }
            }
            // Sort: accounts with non-zero balance first
            return merged.sort((a, b) => {
                const aHas = (a.plsBalance && a.plsBalance !== '0' && a.plsBalance !== '0 PLS') ||
                    (a.bnbBalance && a.bnbBalance !== '0' && a.bnbBalance !== '0 BNB');
                const bHas = (b.plsBalance && b.plsBalance !== '0' && b.plsBalance !== '0 PLS') ||
                    (b.bnbBalance && b.bnbBalance !== '0' && b.bnbBalance !== '0 BNB');
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return a.index - b.index;
            });
        });
        setFetchingBalances(false);
        addOutput(`✓ Balances loaded (funded accounts sorted to top)`, 'success');
    };

    const handleSaveSeedAccount = (account) => {
        if (!walletName.trim()) {
            addOutput('Please enter a wallet name', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(walletName.trim())) {
            addOutput('Wallet name can only contain letters, numbers, underscores, and hyphens', 'error');
            return;
        }
        if (!password.trim()) {
            addOutput('Please enter a password', 'error');
            return;
        }

        const savedName = walletName.trim();
        addOutput(`Saving account ${account.index} as "${savedName}"...`);

        fetch(`${API_BASE}/api/keystore/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            
            body: JSON.stringify({
                name: savedName,
                privateKey: account.privateKey,
                password
            })
        })
            .then(res => res.json())
            .then(async data => {
                if (data.success) {
                    addOutput(`✓ Account saved as "${savedName}"`, 'success');
                    localStorage.setItem(`wallet_addr_${savedName}`, account.address);

                    // Auto-fetch balance for the new wallet
                    try {
                        const balRes = await fetch(`${API_BASE}/api/wallet/balance/${account.address}`);
                        if (balRes.ok) {
                            const balData = await balRes.json();
                            setWalletBalances(prev => ({
                                ...prev,
                                [savedName]: {
                                    address: account.address,
                                    pls: balData.pulsechain?.balance || '0',
                                    bnb: balData.bnb?.balance || '0'
                                }
                            }));
                        }
                    } catch (e) { /* ignore balance fetch error */ }

                    loadKeystores();
                    setSeedAccounts([]);
                    setShowSeedAccounts(false);
                    setShowCreateForm(false);
                    setWalletName('');
                    setPassword('');
                } else {
                    addOutput(`Failed: ${data.error}`, 'error');
                }
            })
            .catch(err => addOutput(`Error: ${err.message}`, 'error'));
    };

    const handleDeleteWallet = (name) => {
        if (!window.confirm(`Delete wallet "${name}"? This cannot be undone!`)) return;

        fetch(`${API_BASE}/api/keystore/delete/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    addOutput(`✓ Wallet "${name}" deleted`, 'success');
                    loadKeystores();
                } else {
                    addOutput(`Failed: ${data.error}`, 'error');
                }
            })
            .catch(err => addOutput(`Error: ${err.message}`, 'error'));
    };

    const handleOpenRename = (walletName) => {
        setSelectedWallet(walletName);
        setRenameNewName(walletName); // Pre-fill with current name
        setShowRenameModal(true);
    };

    const handleRenameWallet = () => {
        if (!renameNewName.trim()) {
            addOutput('Please enter a new name', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(renameNewName.trim())) {
            addOutput('Name can only contain letters, numbers, underscores, and hyphens', 'error');
            return;
        }
        if (renameNewName.trim() === selectedWallet) {
            setShowRenameModal(false);
            return;
        }

        setRenaming(true);
        addOutput(`Renaming "${selectedWallet}" to "${renameNewName}"...`);

        fetch(`${API_BASE}/api/keystore/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            
            body: JSON.stringify({ oldName: selectedWallet, newName: renameNewName.trim() })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Update localStorage with new wallet name
                    const oldAddr = localStorage.getItem(`wallet_addr_${selectedWallet}`);
                    if (oldAddr) {
                        localStorage.removeItem(`wallet_addr_${selectedWallet}`);
                        localStorage.setItem(`wallet_addr_${renameNewName.trim()}`, oldAddr);
                    }
                    // Update walletBalances state
                    setWalletBalances(prev => {
                        const updated = { ...prev };
                        if (updated[selectedWallet]) {
                            updated[renameNewName.trim()] = updated[selectedWallet];
                            delete updated[selectedWallet];
                        }
                        return updated;
                    });
                    addOutput(`✓ Wallet renamed to "${renameNewName.trim()}"`, 'success');
                    setShowRenameModal(false);
                    loadKeystores();
                } else {
                    addOutput(`Failed: ${data.error}`, 'error');
                }
            })
            .catch(err => addOutput(`Error: ${err.message}`, 'error'))
            .finally(() => setRenaming(false));
    };

    const handleOpenReveal = (walletName) => {
        setSelectedWallet(walletName);
        setRevealPassword('');
        setRevealedKey('');
        setShowRevealModal(true);
    };

    const handleRevealKey = () => {
        if (!revealPassword.trim()) {
            addOutput('Please enter the wallet password', 'error');
            return;
        }

        setRevealing(true);
        addOutput(`Decrypting wallet "${selectedWallet}"...`);

        fetch(`${API_BASE}/api/keystore/reveal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            
            body: JSON.stringify({ name: selectedWallet, password: revealPassword })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setRevealedKey(data.privateKey);
                    addOutput('✓ Key revealed (visible for 30 seconds)', 'success');
                    setTimeout(() => setRevealedKey(''), 30000);
                } else {
                    addOutput(`Failed: ${data.error}`, 'error');
                }
            })
            .catch(err => addOutput(`Error: ${err.message}`, 'error'))
            .finally(() => setRevealing(false));
    };

    const handleCopyKey = () => {
        navigator.clipboard.writeText(revealedKey);
        addOutput('✓ Private key copied to clipboard', 'success');
    };

    const handleOpenTest = async (walletName) => {
        // Check if address is already cached
        const storedAddr = localStorage.getItem(`wallet_addr_${walletName}`);

        if (storedAddr) {
            // Address is cached - fetch balance directly without password
            addOutput(`Testing wallet "${walletName}"...`);
            setTesting(true);

            try {
                const res = await fetch(`${API_BASE}/api/wallet/balance/${storedAddr}`);
                if (res.ok) {
                    const data = await res.json();
                    setWalletBalances(prev => ({
                        ...prev,
                        [walletName]: {
                            address: storedAddr,
                            pls: data.pulsechain?.balance || '0',
                            bnb: data.bnb?.balance || '0'
                        }
                    }));
                    const plsStatus = data.pulsechain?.success !== false ? '✓' : '✗';
                    const bnbStatus = data.bnb?.success !== false ? '✓' : '✗';
                    addOutput(`✓ ${walletName}: ${storedAddr.slice(0, 10)}...`, 'success');
                    addOutput(`  PLS: ${plsStatus} ${data.pulsechain?.balance || '0'}`, 'success');
                    addOutput(`  BNB: ${bnbStatus} ${data.bnb?.balance || '0'}`, 'success');

                    // Also update character status
                    fetchCharacterStatus([walletName]);
                } else {
                    addOutput(`✗ ${walletName}: Failed to fetch balance`, 'error');
                }
            } catch (err) {
                addOutput(`✗ ${walletName}: ${err.message}`, 'error');
            }
            setTesting(false);
        } else {
            // Address not cached - need password to decrypt and get address
            setSelectedWallet(walletName);
            setTestPassword('');
            setTestResults(null);
            setShowTestModal(true);
        }
    };

    const handleTestWallet = () => {
        if (!testPassword.trim()) {
            addOutput('Please enter the wallet password', 'error');
            return;
        }

        setTesting(true);
        addOutput(`Testing wallet "${selectedWallet}" on both chains...`);

        fetch(`${API_BASE}/api/keystore/test/${encodeURIComponent(selectedWallet)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            
            body: JSON.stringify({ password: testPassword })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTestResults(data.results);
                    localStorage.setItem(`wallet_addr_${selectedWallet}`, data.results.address);

                    // Update wallet balances in state immediately
                    setWalletBalances(prev => ({
                        ...prev,
                        [selectedWallet]: {
                            address: data.results.address,
                            pls: data.results.pulsechain?.balance || '0',
                            bnb: data.results.bnb?.balance || '0'
                        }
                    }));

                    const plsStatus = data.results.pulsechain.success ? '✓' : '✗';
                    const bnbStatus = data.results.bnb.success ? '✓' : '✗';
                    addOutput(`✓ Address: ${data.results.address.slice(0, 10)}...`, 'success');
                    addOutput(`  PLS: ${plsStatus} ${data.results.pulsechain.balance || data.results.pulsechain.error}`, data.results.pulsechain.success ? 'success' : 'error');
                    addOutput(`  BNB: ${bnbStatus} ${data.results.bnb.balance || data.results.bnb.error}`, data.results.bnb.success ? 'success' : 'error');
                } else {
                    addOutput(`Failed: ${data.error}`, 'error');
                }
            })
            .catch(err => addOutput(`Error: ${err.message}`, 'error'))
            .finally(() => setTesting(false));
    };

    return (
        <div className="foundry-page">
            {/* Header Toolbar */}
            <div className="foundry-toolbar">
                <h1>🔑 Foundry</h1>
                <div className="toolbar-actions">
                    <button className="toolbar-btn" onClick={handleTestAllWallets} disabled={testing || keystores.length === 0} title="Test all wallets at once">
                        {testing ? '⏳ Testing...' : '🧪 Test All'}
                    </button>
                    <button className="toolbar-btn" onClick={() => { loadKeystores(); addOutput('✓ Wallet list refreshed', 'success'); }}>
                        ↻ Refresh
                    </button>
                    <button className="toolbar-btn primary" onClick={() => { setShowCreateForm(!showCreateForm); setShowSeedAccounts(false); }}>
                        {showCreateForm ? '✕ Cancel' : '+ Add Wallet'}
                    </button>
                </div>
            </div>

            {/* Wallet List */}
            <div className="foundry-panel">
                <div className="panel-header">
                    <span className="panel-label">Wallets</span>
                    <span className="panel-count">{keystores.length} saved</span>
                </div>
                <div className="wallet-list">
                    {keystores.length === 0 ? (
                        <div className="empty-state">No wallets yet. Click "+ Add Wallet" to create one.</div>
                    ) : (
                        keystores.map(name => (
                            <div key={name} className="wallet-row">
                                <div className="wallet-name">
                                    <span className="wallet-icon">🔐</span>
                                    <span>{name}</span>
                                </div>
                                <div className="wallet-balances">
                                    {walletBalances[name] ? (
                                        <>
                                            <span className="balance-pls">{walletBalances[name].pls}</span>
                                            <span className="balance-bnb">{walletBalances[name].bnb}</span>
                                            {/* Character status indicators - clickable links to profile */}
                                            {characterStatus[name] && (
                                                <span className="char-indicators" title="Game characters">
                                                    {characterStatus[name].pls && (
                                                        characterStatus[name].plsName ? (
                                                            <a
                                                                href={`https://pls.playmafia.io/profile/${encodeURIComponent(characterStatus[name].plsName)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="char-badge pls"
                                                                title={`PulseChain: ${characterStatus[name].plsName}`}
                                                            >P</a>
                                                        ) : (
                                                            <a
                                                                href="https://pls.playmafia.io/"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="char-badge pls"
                                                                title="PulseChain character"
                                                            >P</a>
                                                        )
                                                    )}
                                                    {characterStatus[name].bnb && (
                                                        characterStatus[name].bnbName ? (
                                                            <a
                                                                href={`https://bnb.playmafia.io/profile/${encodeURIComponent(characterStatus[name].bnbName)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="char-badge bnb"
                                                                title={`BNB Chain: ${characterStatus[name].bnbName}`}
                                                            >B</a>
                                                        ) : (
                                                            <a
                                                                href="https://bnb.playmafia.io/"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="char-badge bnb"
                                                                title="BNB Chain character"
                                                            >B</a>
                                                        )
                                                    )}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="balance-loading">Click ✓ to load</span>
                                    )}
                                </div>
                                <div className="wallet-actions">
                                    <button className="action-btn test" onClick={() => handleOpenTest(name)} title="Test Wallet">✓</button>
                                    <button className="action-btn" onClick={() => handleOpenReveal(name)} title="Reveal Key">🔓</button>
                                    <button className="action-btn" onClick={() => handleOpenRename(name)} title="Rename">✎</button>
                                    <button className="action-btn delete" onClick={() => handleDeleteWallet(name)} title="Delete">✕</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Create Wallet Form */}
            {showCreateForm && !showSeedAccounts && (
                <div className="foundry-panel">
                    <div className="panel-header">
                        <span className="panel-label">Import Wallet</span>
                    </div>
                    <div className="form-panel">
                        <div className="method-tabs">
                            <button className={`method-tab ${createMethod === 'key' ? 'active' : ''}`} onClick={() => setCreateMethod('key')}>
                                🔐 Private Key
                            </button>
                            <button className={`method-tab ${createMethod === 'seed' ? 'active' : ''}`} onClick={() => setCreateMethod('seed')}>
                                🌱 Seed Phrase
                            </button>
                        </div>

                        {createMethod === 'key' ? (
                            <>
                                <input className="form-input" placeholder="Wallet Name" value={walletName} onChange={e => setWalletName(e.target.value)} />
                                <input className="form-input" type="password" placeholder="Private Key (64 hex chars)" value={privateKey} onChange={e => setPrivateKey(e.target.value)} />
                                <input className="form-input" type="password" placeholder="Encryption Password" value={password} onChange={e => setPassword(e.target.value)} />
                                <button className="form-btn" onClick={handleCreateFromKey}>Create Wallet</button>
                            </>
                        ) : (
                            <>
                                <div className="method-tabs">
                                    <button className={`method-tab ${seedWordCount === 12 ? 'active' : ''}`} onClick={() => handleWordCountChange(12)}>12 Words</button>
                                    <button className={`method-tab ${seedWordCount === 24 ? 'active' : ''}`} onClick={() => handleWordCountChange(24)}>24 Words</button>
                                </div>

                                <div className={seedWordCount === 24 ? 'seed-grid-24' : 'seed-grid-12'}>
                                    {seedWords.map((word, index) => (
                                        <div key={index} className="seed-word-box">
                                            <span className="seed-word-num">{index + 1}</span>
                                            <input
                                                className="seed-word-input"
                                                type="text"
                                                value={word}
                                                onChange={(e) => handleWordChange(index, e.target.value)}
                                                onPaste={(e) => handlePaste(e, index)}
                                                placeholder="..."
                                                autoComplete="off"
                                                spellCheck="false"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="passphrase-row">
                                    <label>
                                        <input type="checkbox" checked={usePassphrase} onChange={(e) => setUsePassphrase(e.target.checked)} />
                                        <span>Use passphrase (25th word)</span>
                                    </label>
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#888' }}>Derivation Path (wallet type):</label>
                                    <select
                                        className="form-input"
                                        value={derivationPath}
                                        onChange={(e) => setDerivationPath(e.target.value)}
                                        style={{ marginBottom: '0' }}
                                    >
                                        {Object.entries(derivationPaths).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {usePassphrase && (
                                    <input className="form-input" type="password" placeholder="Passphrase (optional extra security)" value={seedPassphrase} onChange={(e) => setSeedPassphrase(e.target.value)} />
                                )}

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="form-btn" onClick={handleDeriveSeedAccounts} disabled={derivingKeys}>
                                        {derivingKeys ? 'Deriving...' : 'Derive 20'}
                                    </button>
                                    <button className="form-btn primary" onClick={handleAutoScanAccounts} disabled={derivingKeys}>
                                        {derivingKeys ? 'Scanning...' : '🔍 Auto-Scan (100)'}
                                    </button>
                                </div>

                                <div style={{ marginTop: '12px', padding: '10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '4px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#888' }}>🔍 Search for Known Address:</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            className="form-input"
                                            placeholder="0x..."
                                            value={searchAddress}
                                            onChange={(e) => setSearchAddress(e.target.value)}
                                            style={{ flex: 1, marginBottom: 0 }}
                                        />
                                        <button className="form-btn" onClick={handleSearchAddress} disabled={derivingKeys || !searchAddress.trim()}>
                                            {derivingKeys ? 'Searching...' : 'Find'}
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                                        Fast search: 10 wallet types × 1000 accounts = 10,000 addresses
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Seed Account Selector */}
            {showSeedAccounts && (
                <div className="foundry-panel">
                    <div className="panel-header">
                        <span className="panel-label">Select Account to Import</span>
                    </div>
                    <div className="form-panel">
                        <input className="form-input" placeholder="Wallet Name" value={walletName} onChange={e => setWalletName(e.target.value)} />
                        <input className="form-input" type="password" placeholder="Encryption Password" value={password} onChange={e => setPassword(e.target.value)} />

                        {fetchingBalances && <div className="loading-text">⏳ Loading balances...</div>}

                        <div className="account-list">
                            {seedAccounts.map(acc => (
                                <div key={acc.index} className="account-row">
                                    <span className="account-index">#{acc.index}</span>
                                    <span className="account-address">{acc.address.slice(0, 10)}...{acc.address.slice(-8)}</span>
                                    <div className="account-balances">
                                        <span className="balance-pls">{acc.plsBalance || '...'}</span>
                                        <span className="balance-bnb">{acc.bnbBalance || '...'}</span>
                                    </div>
                                    <button className="import-btn" onClick={() => handleSaveSeedAccount(acc)}>Import</button>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="form-btn" onClick={handleLoadMoreAccounts} disabled={derivingKeys}>
                                {derivingKeys ? 'Loading...' : '+ Load 20 More'}
                            </button>
                            <button className="form-btn secondary" onClick={() => { setShowSeedAccounts(false); setSeedAccounts([]); }}>
                                ← Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Terminal Output */}
            <div className="terminal-panel">
                <div className="terminal-header">
                    <span className="terminal-label">Terminal Output</span>
                    <div className="log-actions">
                        <button onClick={handleCopyLogs} disabled={terminalOutput.length === 0}>📋 Copy</button>
                        <button onClick={handleClearLogs} disabled={terminalOutput.length === 0}>🗑 Clear</button>
                    </div>
                </div>
                <div className="terminal-output" ref={terminalRef}>
                    {terminalOutput.map((line, i) => (
                        <div key={i} className={`terminal-line ${line.type}`}>
                            <span className="terminal-time">[{line.timestamp}]</span> {line.text}
                        </div>
                    ))}
                </div>
            </div>

            {/* Reveal Key Modal */}
            {showRevealModal && (
                <div className="modal-overlay" onClick={() => setShowRevealModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">🔑 Reveal Private Key</span>
                            <button className="modal-close" onClick={() => setShowRevealModal(false)}>✕</button>
                        </div>
                        <div className="modal-warn">⚠️ Never share your private key with anyone!</div>
                        <div className="modal-label">Wallet: {selectedWallet}</div>

                        {!revealedKey ? (
                            <>
                                <input className="form-input" type="password" placeholder="Enter wallet password" value={revealPassword} onChange={e => setRevealPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleRevealKey()} />
                                <button className="form-btn" onClick={handleRevealKey} disabled={revealing}>
                                    {revealing ? 'Decrypting...' : 'Reveal Key'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="key-display">{revealedKey}</div>
                                <button className="copy-btn" onClick={handleCopyKey}>📋 Copy to Clipboard</button>
                                <div className="key-warn">Key will hide in 30 seconds</div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Test Wallet Modal */}
            {showTestModal && (
                <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">🧪 Test Wallet</span>
                            <button className="modal-close" onClick={() => setShowTestModal(false)}>✕</button>
                        </div>
                        <div className="modal-label">Wallet: {selectedWallet}</div>

                        {!testResults ? (
                            <>
                                <input className="form-input" type="password" placeholder="Enter wallet password" value={testPassword} onChange={e => setTestPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleTestWallet()} />
                                <button className="form-btn" onClick={handleTestWallet} disabled={testing}>
                                    {testing ? 'Testing...' : 'Test on Both Chains'}
                                </button>
                            </>
                        ) : (
                            <div className="test-results">
                                <div className="test-result-row">
                                    <span className="test-result-label">Address:</span>
                                    <span className="test-result-value">{testResults.address?.slice(0, 10)}...{testResults.address?.slice(-8)}</span>
                                </div>
                                <div className="test-result-row">
                                    <span className="test-result-label">PulseChain:</span>
                                    <span className={`test-result-value ${testResults.pulsechain.success ? 'success' : 'error'}`}>
                                        {testResults.pulsechain.success ? `✓ ${testResults.pulsechain.balance}` : `✗ ${testResults.pulsechain.error}`}
                                    </span>
                                </div>
                                <div className="test-result-row">
                                    <span className="test-result-label">BNB Chain:</span>
                                    <span className={`test-result-value ${testResults.bnb.success ? 'success' : 'error'}`}>
                                        {testResults.bnb.success ? `✓ ${testResults.bnb.balance}` : `✗ ${testResults.bnb.error}`}
                                    </span>
                                </div>
                                <button className="form-btn secondary" onClick={() => { setTestResults(null); setTestPassword(''); }}>
                                    Test Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {showRenameModal && (
                <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">✎ Rename Wallet</span>
                            <button className="modal-close" onClick={() => setShowRenameModal(false)}>✕</button>
                        </div>
                        <div className="modal-label">Current name: {selectedWallet}</div>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Enter new name"
                            value={renameNewName}
                            onChange={e => setRenameNewName(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleRenameWallet()}
                            autoFocus
                        />
                        <button className="form-btn" onClick={handleRenameWallet} disabled={renaming}>
                            {renaming ? 'Renaming...' : 'Rename'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
