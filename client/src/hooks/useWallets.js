import { useState, useEffect, useCallback } from 'react';
import API_BASE from '../config/api';

/**
 * useWallets Hook - Adapted for Nexus Lite
 * Uses API_BASE for standalone server
 */
export function useWallets(options = {}) {
    const { multiSelect = false, storageKey = 'selected_wallets' } = options;

    const [wallets, setWallets] = useState([]);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [selectedWalletNames, setSelectedWalletNames] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // Load wallets from API
    const loadWallets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/keystore/list`);
            const data = await res.json();

            if (data.wallets) {
                // Get addresses from localStorage
                const storedAddresses = JSON.parse(localStorage.getItem('keystoreAddresses') || '{}');
                
                const walletsWithData = data.wallets.map(w => ({
                    name: w.name,
                    address: storedAddresses[w.name] || null,
                    hasAddress: !!storedAddresses[w.name],
                    hasStoredPassword: w.hasStoredPassword,
                    passwordAvailable: w.passwordAvailable
                }));

                setWallets(walletsWithData);

                // Load saved selection from storage
                if (multiSelect) {
                    const saved = localStorage.getItem(storageKey);
                    if (saved) {
                        const savedNames = new Set(JSON.parse(saved));
                        const validNames = new Set(
                            [...savedNames].filter(name =>
                                walletsWithData.some(w => w.name === name)
                            )
                        );
                        if (validNames.size > 0) {
                            setSelectedWalletNames(validNames);
                        } else {
                            setSelectedWalletNames(new Set(walletsWithData.map(w => w.name)));
                        }
                    } else {
                        setSelectedWalletNames(new Set(walletsWithData.map(w => w.name)));
                    }
                } else {
                    const firstWallet = walletsWithData[0];
                    if (firstWallet && !selectedWallet) {
                        setSelectedWallet(firstWallet);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load wallets:', err);
        }
        setLoading(false);
    }, [multiSelect, storageKey, selectedWallet]);

    useEffect(() => {
        loadWallets();
    }, [loadWallets]);

    const selectWallet = (walletName) => {
        if (!walletName) {
            setSelectedWallet(null);
            return;
        }
        const wallet = wallets.find(w => w.name === walletName);
        if (wallet) {
            setSelectedWallet(wallet);
        }
    };

    const toggleWallet = useCallback((name) => {
        setSelectedWalletNames(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            localStorage.setItem(storageKey, JSON.stringify([...next]));
            return next;
        });
    }, [storageKey]);

    const selectAll = useCallback(() => {
        const allNames = wallets.map(w => w.name);
        const newSet = new Set(allNames);
        setSelectedWalletNames(newSet);
        localStorage.setItem(storageKey, JSON.stringify(allNames));
    }, [wallets, storageKey]);

    const deselectAll = useCallback(() => {
        setSelectedWalletNames(new Set());
        localStorage.setItem(storageKey, JSON.stringify([]));
    }, [storageKey]);

    const getSelectedWalletObjects = useCallback(() => {
        return wallets.filter(w => selectedWalletNames.has(w.name));
    }, [wallets, selectedWalletNames]);

    return {
        wallets,
        loading,
        refresh: loadWallets,
        selectedWallet,
        selectedAddress: selectedWallet?.address || null,
        selectWallet,
        selectedWallets: selectedWalletNames,
        toggleWallet,
        selectAll,
        deselectAll,
        getSelectedWalletObjects,
        isSelected: (name) => selectedWalletNames.has(name)
    };
}

export default useWallets;
