import React from 'react';
import KeystoreManager from '../components/KeystoreManager';
import QuickTransfer from '../components/QuickTransfer';
import './FoundryPage.css';

/**
 * Foundry Page - Wallet management
 * Wraps KeystoreManager component in a full page layout
 */
export default function FoundryPage({ socket }) {
    return (
        <div className="foundry-page">
            <QuickTransfer />
            <KeystoreManager socket={socket} />
        </div>
    );
}
