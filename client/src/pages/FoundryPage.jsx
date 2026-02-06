import React from 'react';
import { useWallets } from '../hooks/useWallets';
import KeystoreManager from '../components/KeystoreManager';
import QuickTransfer from '../components/QuickTransfer';
import './FoundryPage.css';

/**
 * Foundry Page - Wallet management
 * Wraps KeystoreManager component in a full page layout
 */
export default function FoundryPage({ socket }) {
    const { wallets } = useWallets();
    
    return (
        <div className="foundry-page">
            <QuickTransfer wallets={wallets.filter(w => w.hasAddress)} />
            <KeystoreManager socket={socket} />
        </div>
    );
}
