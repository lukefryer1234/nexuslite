import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import './SettingsPage.css';

/**
 * SettingsPage - User configuration for RPC endpoints and other settings
 */
export default function SettingsPage() {
    const [settings, setSettings] = useState({
        rpcUrls: {
            pls: '',
            bnb: ''
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/settings`);
            const data = await res.json();
            setSettings(data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load settings:', err);
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`${API_BASE}/api/settings/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings.rpcUrls)
            });
            const data = await res.json();
            if (data.success) {
                setMessage('✅ Settings saved successfully!');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('❌ Failed to save settings');
            }
        } catch (err) {
            setMessage('❌ Error: ' + err.message);
        }
        setSaving(false);
    };

    const updateRpc = (chain, value) => {
        setSettings(prev => ({
            ...prev,
            rpcUrls: {
                ...prev.rpcUrls,
                [chain]: value
            }
        }));
    };

    const resetToDefaults = () => {
        setSettings(prev => ({
            ...prev,
            rpcUrls: {
                pls: 'https://rpc.pulsechain.com',
                bnb: 'https://bsc-dataseed.binance.org'
            }
        }));
    };

    if (loading) {
        return (
            <div className="settings-page">
                <div className="loading">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h2>⚙️ Settings</h2>
            </div>

            <div className="settings-section">
                <h3>🌐 RPC Endpoints</h3>
                <p className="section-desc">
                    Configure custom RPC URLs for blockchain queries. Used for balance checks, city detection, and other read operations.
                </p>

                <div className="setting-row">
                    <label>
                        <span className="chain-icon">💜</span>
                        PulseChain RPC
                    </label>
                    <input
                        type="text"
                        value={settings.rpcUrls?.pls || ''}
                        onChange={(e) => updateRpc('pls', e.target.value)}
                        placeholder="https://rpc.pulsechain.com"
                    />
                </div>

                <div className="setting-row">
                    <label>
                        <span className="chain-icon">💛</span>
                        BNB Chain RPC
                    </label>
                    <input
                        type="text"
                        value={settings.rpcUrls?.bnb || ''}
                        onChange={(e) => updateRpc('bnb', e.target.value)}
                        placeholder="https://bsc-dataseed.binance.org"
                    />
                </div>

                <div className="setting-actions">
                    <button className="btn-save" onClick={saveSettings} disabled={saving}>
                        {saving ? '⏳ Saving...' : '💾 Save Settings'}
                    </button>
                    <button className="btn-reset" onClick={resetToDefaults}>
                        🔄 Reset to Defaults
                    </button>
                </div>

                {message && (
                    <div className={`message ${message.startsWith('✅') ? 'success' : 'error'}`}>
                        {message}
                    </div>
                )}
            </div>

            <div className="settings-section">
                <h3>📋 Default RPC Endpoints</h3>
                <div className="info-box">
                    <p><strong>PulseChain:</strong> https://rpc.pulsechain.com</p>
                    <p><strong>BNB Chain:</strong> https://bsc-dataseed.binance.org</p>
                </div>
            </div>
        </div>
    );
}
