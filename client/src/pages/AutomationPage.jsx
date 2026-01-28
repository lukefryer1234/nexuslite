import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallets } from '../hooks/useWallets';
import WalletSelector from '../components/WalletSelector';
import LogViewer from '../components/LogViewer';
import CooldownTracker from '../components/CooldownTracker';
import WalletResultsPanel from '../components/WalletResultsPanel';
import API_BASE from '../config/api';
import './AutomationPage.css';

/**
 * Automation Hub - Central control for all automation scripts
 * Dynamically loads scripts from /api/scripts/available
 * Multi-wallet support: run scripts for multiple wallets in parallel
 */
export default function AutomationPage() {
    // Use shared wallet hook with multi-select
    const {
        wallets,
        loading: walletsLoading,
        selectedWallets: selectedWalletSet,
        toggleWallet,
        selectAll,
        deselectAll,
        getSelectedWalletObjects
    } = useWallets({ multiSelect: true, storageKey: 'automation_selected_wallets' });

    // Get keystores from selected wallets
    const selectedKeystores = useMemo(() => {
        return getSelectedWalletObjects().map(w => w.name);
    }, [getSelectedWalletObjects]);

    const keystores = wallets.filter(w => w.hasAddress).map(w => w.name);

    // Dynamic scripts from API
    const [availableScripts, setAvailableScripts] = useState([]);
    const [scriptStatuses, setScriptStatuses] = useState({});
    const [scriptConfigs, setScriptConfigs] = useState({ pls: {}, bnb: {} });

    // UI state
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWalletFilter, setSelectedWalletFilter] = useState(null);

    // Filter logs by selected wallet
    const filteredLogs = useMemo(() => {
        if (!selectedWalletFilter) return logs;
        return logs.filter(log => log.walletId === selectedWalletFilter);
    }, [logs, selectedWalletFilter]);

    // Get unique wallet names from logs
    const activeWalletNames = useMemo(() => {
        const names = new Set();
        for (const log of logs) {
            if (log.walletId) names.add(log.walletId);
        }
        return Array.from(names);
    }, [logs]);

    // Fetch available scripts from registry
    const fetchAvailableScripts = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/scripts/available`);
            const data = await res.json();
            setAvailableScripts(data.scripts || []);

            // Initialize configs with defaults from script parameters
            const defaultConfigs = { pls: {}, bnb: {} };
            for (const script of data.scripts || []) {
                for (const chain of ['pls', 'bnb']) {
                    defaultConfigs[chain][script.name] = {};
                    for (const param of script.parameters || []) {
                        defaultConfigs[chain][script.name][param.name] = param.default ?? 0;
                    }
                }
            }
            setScriptConfigs(defaultConfigs);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch available scripts:', err);
            setLoading(false);
        }
    }, []);

    // Fetch status for all scripts
    const fetchAllStatus = useCallback(async () => {
        if (availableScripts.length === 0) return;

        try {
            const statusPromises = availableScripts.map(async (script) => {
                // Map script name to API endpoint
                const endpoint = script.name; // Use name directly - server uses /api/scripts/crime
                const res = await fetch(`${API_BASE}/api/${endpoint}/status`);
                return { name: script.name, status: await res.json() };
            });

            const results = await Promise.all(statusPromises);
            const statuses = {};
            for (const r of results) {
                statuses[r.name] = r.status;
            }
            setScriptStatuses(statuses);

            // Fetch logs from all script types and combine
            const allLogs = [];
            for (const script of availableScripts) {
                try {
                    const logsRes = await fetch(`${API_BASE}/api/${script.name}/logs`);
                    const logsData = await logsRes.json();
                    // Handle nested logs structure: {logs: {logs: [...]}} or {logs: [...]}
                    const logArray = logsData.logs?.logs || logsData.logs || [];
                    allLogs.push(...logArray);
                } catch (e) { /* ignore individual fetch errors */ }
            }
            // Sort by time and take last 50
            allLogs.sort((a, b) => a.time - b.time);
            setLogs(allLogs.slice(-50));
        } catch (err) {
            console.error('Status fetch error:', err);
        }
    }, [availableScripts]);

    useEffect(() => {
        fetchAvailableScripts();
    }, [fetchAvailableScripts]);

    useEffect(() => {
        if (availableScripts.length > 0) {
            fetchAllStatus();
            const interval = setInterval(fetchAllStatus, 5000);
            return () => clearInterval(interval);
        }
    }, [availableScripts, fetchAllStatus]);



    const handleScript = async (scriptName, chain, action, walletId = null) => {
        const endpoint = scriptName; // Use script name directly - server uses /api/crime
        const currentPassword = localStorage.getItem('app_global_password') || '';

        // Note: If currentPassword is empty but server is unlocked, server uses masterPassword

        // Use selectedKeystores first (like startAllParallel), fallback to keystores[0]
        const effectiveWalletId = walletId || (selectedKeystores.length > 0 ? selectedKeystores[0] : keystores[0]);
        const scriptConfig = scriptConfigs[chain][scriptName] || {};

        try {
            if (action === 'start') {
                await fetch(`${API_BASE}/api/${endpoint}/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chain,
                        keystore: effectiveWalletId,
                        password: currentPassword,
                        walletId: effectiveWalletId,
                        ...scriptConfig
                    })
                });
            } else {
                await fetch(`${API_BASE}/api/${endpoint}/stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chain, walletId: effectiveWalletId })
                });
            }
            fetchAllStatus();
        } catch (err) {
            console.error('Script action error:', err);
        }
    };

    const startAllParallel = async (chain) => {
        // Use selected wallets from header WalletSelector, fallback to first keystore
        const walletsToUse = selectedKeystores.length > 0 ? selectedKeystores : [keystores[0]];

        for (const walletId of walletsToUse) {
            for (const script of availableScripts) {
                await handleScript(script.name, chain, 'start', walletId);
            }
        }
    };

    const stopAll = async (chain) => {
        const walletsToStop = new Set();
        for (const script of availableScripts) {
            const status = scriptStatuses[script.name];
            const activeWallets = status?.wallets?.[chain] || [];
            activeWallets.forEach(w => walletsToStop.add(w));
        }

        for (const walletId of walletsToStop) {
            for (const script of availableScripts) {
                await handleScript(script.name, chain, 'stop', walletId);
            }
        }
    };

    // Stop a single script for all running wallets on a chain
    const stopScript = async (scriptName, chain) => {
        const status = scriptStatuses[scriptName];
        const activeWallets = status?.wallets?.[chain] || [];
        for (const walletId of activeWallets) {
            await handleScript(scriptName, chain, 'stop', walletId);
        }
        fetchAllStatus();
    };

    // Start a single script for all selected wallets on a chain
    const startScript = async (scriptName, chain) => {
        const walletsToUse = selectedKeystores.length > 0 ? selectedKeystores : [keystores[0]];
        for (const walletId of walletsToUse) {
            await handleScript(scriptName, chain, 'start', walletId);
        }
        fetchAllStatus();
    };

    // Global controls - work across both chains
    const startAllGlobal = async () => {
        await startAllParallel('pls');
        await startAllParallel('bnb');
    };

    const stopAllGlobal = async () => {
        await stopAll('pls');
        await stopAll('bnb');
    };

    const restartAllGlobal = async () => {
        await stopAllGlobal();
        // Small delay to ensure scripts have stopped
        await new Promise(resolve => setTimeout(resolve, 1000));
        await startAllGlobal();
    };

    const updateScriptConfig = (chain, scriptName, paramName, value) => {
        setScriptConfigs(prev => ({
            ...prev,
            [chain]: {
                ...prev[chain],
                [scriptName]: {
                    ...prev[chain][scriptName],
                    [paramName]: value
                }
            }
        }));
    };

    const isScriptRunning = (scriptName, chain) => {
        const status = scriptStatuses[scriptName];
        return status?.running || status?.[chain] || (status?.wallets?.[chain]?.length > 0);
    };

    const renderParameterInput = (script, param, chain) => {
        const value = scriptConfigs[chain]?.[script.name]?.[param.name] ?? param.default;

        if (param.type === 'select') {
            return (
                <label className="param-label">
                    <span className="param-name">{param.label}:</span>
                    <select
                        value={value}
                        onChange={(e) => updateScriptConfig(chain, script.name, param.name, parseInt(e.target.value))}
                    >
                        {param.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </label>
            );
        }

        if (param.type === 'number') {
            return (
                <label className="param-label">
                    <span className="param-name">{param.label}:</span>
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => updateScriptConfig(chain, script.name, param.name, parseInt(e.target.value) || 0)}
                        style={{ width: '60px' }}
                    />
                </label>
            );
        }

        return null;
    };

    const renderChainPanel = (chain, label) => {
        const anyRunning = availableScripts.some(s => isScriptRunning(s.name, chain));

        return (
            <div className={`chain-panel ${chain}`}>
                <div className="chain-header">
                    <h2>{label}</h2>
                    <div className={`chain-status ${anyRunning ? 'running' : 'idle'}`}>
                        {anyRunning ? '🟢 RUNNING' : '⚪ IDLE'}
                    </div>
                </div>



                {/* Dynamic script grid */}
                <div className="loop-grid">
                    {availableScripts.map(script => {
                        const running = isScriptRunning(script.name, chain);
                        return (
                            <div key={script.name} className="loop-row">
                                <span className="loop-label">
                                    {script.icon} {script.displayName}
                                    <span className="cd">{script.cooldownMinutes}m</span>
                                </span>

                                {/* Parameter controls */}
                                {script.parameters?.length > 0 && (
                                    <div className="param-controls">
                                        {script.parameters.slice(0, 2).map(param => (
                                            <div key={param.name} className="param-mini">
                                                {renderParameterInput(script, param, chain)}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {running ? (
                                    <button className="btn stop" onClick={() => stopScript(script.name, chain)}>■</button>
                                ) : (
                                    <button className="btn start" onClick={() => startScript(script.name, chain)}>▶</button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="bulk-actions">
                    <button
                        className="bulk-btn start"
                        onClick={() => startAllParallel(chain)}
                        disabled={anyRunning}
                    >
                        ▶▶ Start All {availableScripts.length} Loops
                    </button>
                    <button
                        className="bulk-btn stop"
                        onClick={() => stopAll(chain)}
                    >
                        ■ Stop All
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="automation-page">
                <div className="page-header">
                    <h1>Automation Hub</h1>
                </div>
                <div className="loading">Loading scripts...</div>
            </div>
        );
    }

    return (
        <div className="automation-page">
            <div className="page-header">
                <h1>Automation Hub</h1>
                <div className="header-controls">
                    <WalletSelector
                        wallets={wallets}
                        mode="multi"
                        selectedWallets={selectedWalletSet}
                        onToggle={toggleWallet}
                        onSelectAll={selectAll}
                        onDeselectAll={deselectAll}
                        loading={walletsLoading}
                    />
                    <div className="parallel-info">
                        <span className="info-badge">{availableScripts.length} PARALLEL LOOPS</span>
                        <span className="info-text">
                            {availableScripts.map(s => s.displayName).join(' + ')} run simultaneously
                        </span>
                    </div>
                </div>
            </div>

            {/* Cooldown Tracker - centralized view of all wallet cooldowns */}
            <CooldownTracker wallets={getSelectedWalletObjects()} />

            {/* Global Control Bar */}
            <div className="global-controls">
                <span className="global-label">⚡ All Scripts (Both Chains):</span>
                <button className="global-btn start" onClick={startAllGlobal}>
                    ▶ Start All
                </button>
                <button className="global-btn stop" onClick={stopAllGlobal}>
                    ■ Stop All
                </button>
                <button className="global-btn restart" onClick={restartAllGlobal}>
                    ⟳ Restart All
                </button>
            </div>

            <div className="chains-grid">
                {renderChainPanel('pls', 'PULSECHAIN')}
                {renderChainPanel('bnb', 'BNB CHAIN')}
            </div>

            {/* Per-Wallet Results Panel */}
            <WalletResultsPanel
                logs={logs}
                wallets={activeWalletNames.length > 0 ? activeWalletNames : selectedKeystores}
                selectedWallet={selectedWalletFilter}
                onWalletSelect={setSelectedWalletFilter}
            />

            {/* Wallet Tabs for Log Filtering */}
            <div className="wallet-log-tabs">
                <button
                    className={`wallet-tab ${!selectedWalletFilter ? 'active' : ''}`}
                    onClick={() => setSelectedWalletFilter(null)}
                >
                    All Wallets
                </button>
                {(activeWalletNames.length > 0 ? activeWalletNames : selectedKeystores).map(wallet => (
                    <button
                        key={wallet}
                        className={`wallet-tab ${selectedWalletFilter === wallet ? 'active' : ''}`}
                        onClick={() => setSelectedWalletFilter(wallet)}
                    >
                        {wallet}
                    </button>
                ))}
            </div>

            <LogViewer
                logs={filteredLogs}
                maxLines={50}
                autoScroll={false}
                showFilters={true}
                showControls={true}
                onClear={() => setLogs([])}
                title={selectedWalletFilter ? `📜 ${selectedWalletFilter} LOGS` : "📜 ACTIVITY LOG"}
                height="300px"
                placeholder="No activity yet. Start a script to see logs."
            />
        </div>
    );
}
