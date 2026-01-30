import React, { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import API_BASE from '../config/api';
import './QuickTransfer.css';

/**
 * QuickTransfer - Fast native coin transfers between wallets
 * Shows balances for all wallets so you can see which need funding
 */
export default function QuickTransfer() {
    const [wallets, setWallets] = useState([]);
    const [balances, setBalances] = useState({});
    const [fromWallet, setFromWallet] = useState('');
    const [toWallet, setToWallet] = useState('');
    const [chain, setChain] = usePersistentState('nexus_transfer_chain', 'pls');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Load wallets and their addresses from localStorage
    const loadWallets = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/keystore/list`);
            const data = await res.json();
            
            if (data.wallets) {
                const walletsWithAddrs = data.wallets.map(w => {
                    const addr = localStorage.getItem(`wallet_addr_${w.name}`);
                    return { name: w.name, address: addr };
                }).filter(w => w.address); // Only show wallets with known addresses
                
                setWallets(walletsWithAddrs);
                
                if (walletsWithAddrs.length > 0 && !fromWallet) {
                    setFromWallet(walletsWithAddrs[0].name);
                }
                if (walletsWithAddrs.length > 1 && !toWallet) {
                    setToWallet(walletsWithAddrs[1].name);
                }
                
                // Fetch balances for all wallets
                fetchAllBalances(walletsWithAddrs);
            }
        } catch (err) {
            console.error('Failed to load wallets:', err);
        }
        setLoading(false);
    }, [fromWallet, toWallet]);

    const fetchAllBalances = async (walletList) => {
        setRefreshing(true);
        const newBalances = {};
        
        for (const wallet of walletList) {
            if (wallet.address) {
                try {
                    const res = await fetch(`${API_BASE}/api/wallet/balance/${wallet.address}`);
                    const data = await res.json();
                    newBalances[wallet.name] = {
                        pls: data.pulsechain?.balance || '0 PLS',
                        bnb: data.bnb?.balance || '0 BNB',
                        plsRaw: data.pulsechain?.raw || '0',
                        bnbRaw: data.bnb?.raw || '0'
                    };
                } catch (e) {
                    newBalances[wallet.name] = { pls: '? PLS', bnb: '? BNB', plsRaw: '0', bnbRaw: '0' };
                }
            }
        }
        
        setBalances(newBalances);
        setRefreshing(false);
    };

    useEffect(() => {
        loadWallets();
    }, [loadWallets]);

    const handleMaxAmount = () => {
        if (!fromWallet || !balances[fromWallet]) return;
        
        const rawBalance = chain === 'pls' 
            ? balances[fromWallet].plsRaw 
            : balances[fromWallet].bnbRaw;
        
        // Convert wei to ether, leave some for gas (0.01)
        const wei = BigInt(rawBalance || '0');
        const gasBuffer = BigInt(10 ** 16); // 0.01 ether for gas
        const maxWei = wei > gasBuffer ? wei - gasBuffer : BigInt(0);
        const maxEther = Number(maxWei) / 1e18;
        
        setAmount(maxEther.toFixed(6));
    };

    const handleTransfer = async () => {
        if (!fromWallet || !toWallet || !amount) {
            setResult({ success: false, error: 'Please fill in all fields' });
            return;
        }

        if (fromWallet === toWallet) {
            setResult({ success: false, error: 'Cannot send to the same wallet' });
            return;
        }

        const toAddress = wallets.find(w => w.name === toWallet)?.address;
        if (!toAddress) {
            setResult({ success: false, error: 'Destination wallet address not found' });
            return;
        }

        setSending(true);
        setResult(null);

        try {
            const res = await fetch(`${API_BASE}/api/wallet/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromWallet,
                    toAddress,
                    chain,
                    amount
                })
            });

            const data = await res.json();
            setResult(data);

            if (data.success) {
                setAmount('');
                // Refresh balances after transfer
                setTimeout(() => fetchAllBalances(wallets), 2000);
            }
        } catch (err) {
            setResult({ success: false, error: err.message });
        }

        setSending(false);
    };

    const getWalletBalance = (walletName, chainType) => {
        if (!balances[walletName]) return '...';
        return chainType === 'pls' ? balances[walletName].pls : balances[walletName].bnb;
    };

    const isLowBalance = (walletName, chainType) => {
        if (!balances[walletName]) return false;
        const raw = chainType === 'pls' ? balances[walletName].plsRaw : balances[walletName].bnbRaw;
        // Consider low if less than 0.1 of native coin
        return BigInt(raw || '0') < BigInt(10 ** 17);
    };

    if (loading) {
        return <div className="quick-transfer loading">Loading wallets...</div>;
    }

    if (wallets.length < 2) {
        return (
            <div className="quick-transfer">
                <div className="qt-header">
                    <h3>⚡ Quick Transfer</h3>
                    <button 
                        className="qt-refresh" 
                        onClick={() => { setLoading(true); loadWallets(); }}
                    >
                        🔄 Reload
                    </button>
                </div>
                <div className="qt-empty">
                    Need at least 2 wallets with addresses to transfer. 
                    Test wallets first, then click Reload.
                </div>
            </div>
        );
    }

    return (
        <div className="quick-transfer">
            <div className="qt-header">
                <h3>⚡ Quick Transfer</h3>
                <button 
                    className="qt-refresh" 
                    onClick={loadWallets}
                    disabled={refreshing}
                >
                    {refreshing ? '⟳' : '🔄'} Refresh
                </button>
            </div>

            {/* Wallet Balances Overview */}
            <div className="qt-balances-grid">
                {wallets.map(wallet => (
                    <div key={wallet.name} className="qt-wallet-card">
                        <span className="wallet-name">{wallet.name}</span>
                        <div className="wallet-balances">
                            <span className={`balance pls ${isLowBalance(wallet.name, 'pls') ? 'low' : ''}`}>
                                {getWalletBalance(wallet.name, 'pls')}
                            </span>
                            <span className={`balance bnb ${isLowBalance(wallet.name, 'bnb') ? 'low' : ''}`}>
                                {getWalletBalance(wallet.name, 'bnb')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transfer Form */}
            <div className="qt-form">
                <div className="qt-row">
                    <label>From:</label>
                    <select value={fromWallet} onChange={e => setFromWallet(e.target.value)}>
                        {wallets.map(w => (
                            <option key={w.name} value={w.name}>
                                {w.name} ({getWalletBalance(w.name, chain)})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qt-row">
                    <label>To:</label>
                    <select value={toWallet} onChange={e => setToWallet(e.target.value)}>
                        {wallets.filter(w => w.name !== fromWallet).map(w => (
                            <option key={w.name} value={w.name}>
                                {w.name} ({getWalletBalance(w.name, chain)})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qt-row">
                    <label>Chain:</label>
                    <div className="chain-toggle">
                        <button 
                            className={chain === 'pls' ? 'active' : ''} 
                            onClick={() => setChain('pls')}
                        >
                            PLS
                        </button>
                        <button 
                            className={chain === 'bnb' ? 'active' : ''} 
                            onClick={() => setChain('bnb')}
                        >
                            BNB
                        </button>
                    </div>
                </div>

                <div className="qt-row">
                    <label>Amount:</label>
                    <div className="amount-input">
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.0"
                            step="0.001"
                            min="0"
                        />
                        <button className="max-btn" onClick={handleMaxAmount}>MAX</button>
                    </div>
                </div>

                <button 
                    className="qt-send-btn" 
                    onClick={handleTransfer}
                    disabled={sending || !amount || !fromWallet || !toWallet}
                >
                    {sending ? '⟳ Sending...' : `Send ${amount || '0'} ${chain.toUpperCase()}`}
                </button>

                {result && (
                    <div className={`qt-result ${result.success ? 'success' : 'error'}`}>
                        {result.success ? (
                            <>✓ {result.message}{result.txHash && <span className="tx-hash"> TX: {result.txHash.slice(0, 10)}...</span>}</>
                        ) : (
                            <>✗ {result.error}</>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
