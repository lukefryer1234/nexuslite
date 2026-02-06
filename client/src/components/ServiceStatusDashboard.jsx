/**
 * ServiceStatusDashboard - At-a-glance view of all running services
 * 
 * Shows which scripts/services are active on each chain (PLS/BNB)
 * Keeps user informed of system state at all times
 */

import React, { useState, useEffect, useCallback } from 'react';
import './ServiceStatusDashboard.css';

// Service definitions - what can run on each chain
const SERVICES = [
    { key: 'crime', label: 'Crime', icon: '🔫' },
    { key: 'nickcar', label: 'Nick Car', icon: '🚗' },
    { key: 'killskill', label: 'Kill Skill', icon: '🎯' },
    { key: 'travel', label: 'Travel', icon: '✈️' },
    { key: 'yield', label: 'Yield', icon: '💰' },
    { key: 'gas', label: 'Gas Balance', icon: '⛽' }
];

export default function ServiceStatusDashboard({ 
    scriptStatuses = {}, 
    yieldEnabled = false,
    gasBalancerEnabled = false,
    onRefresh
}) {
    const [lastUpdate, setLastUpdate] = useState(new Date());
    
    // Refresh timestamp when statuses change
    useEffect(() => {
        setLastUpdate(new Date());
    }, [scriptStatuses, yieldEnabled, gasBalancerEnabled]);
    
    // Count running instances per script/chain
    const getRunningCount = (scriptName, chain) => {
        const status = scriptStatuses[scriptName];
        if (!status) return 0;
        
        // status has structure like { pls: { walletId: {...} }, bnb: { walletId: {...} } }
        const chainData = status[chain] || status.instances?.[chain] || {};
        return Object.keys(chainData).length;
    };
    
    // Check if anything is running for a script on a chain
    const isRunning = (scriptName, chain) => {
        if (scriptName === 'yield') return yieldEnabled;
        if (scriptName === 'gas') return gasBalancerEnabled;
        return getRunningCount(scriptName, chain) > 0;
    };
    
    // Get total running counts
    const totalPls = SERVICES.filter(s => isRunning(s.key, 'pls')).length;
    const totalBnb = SERVICES.filter(s => isRunning(s.key, 'bnb')).length;
    const totalActive = totalPls + totalBnb;
    
    return (
        <div className="service-status-dashboard">
            <div className="dashboard-header">
                <div className="dashboard-title">
                    <span className="title-icon">📊</span>
                    <span className="title-text">Service Status</span>
                    <span className={`status-indicator ${totalActive > 0 ? 'active' : 'idle'}`}>
                        {totalActive > 0 ? `🟢 ${totalActive} Active` : '⚪ All Idle'}
                    </span>
                </div>
                <div className="dashboard-meta">
                    <span className="last-update">
                        Updated: {lastUpdate.toLocaleTimeString()}
                    </span>
                    {onRefresh && (
                        <button className="refresh-btn" onClick={onRefresh} title="Refresh status">
                            🔄
                        </button>
                    )}
                </div>
            </div>
            
            <div className="chains-grid">
                {/* PulseChain Column */}
                <div className="chain-column pls">
                    <div className="chain-header">
                        <span className="chain-badge">💜 PulseChain</span>
                        <span className="chain-count">{totalPls} running</span>
                    </div>
                    <div className="services-list">
                        {SERVICES.map(service => {
                            const running = isRunning(service.key, 'pls');
                            const count = getRunningCount(service.key, 'pls');
                            return (
                                <div 
                                    key={service.key} 
                                    className={`service-item ${running ? 'running' : 'stopped'}`}
                                >
                                    <span className="service-icon">{service.icon}</span>
                                    <span className="service-name">{service.label}</span>
                                    <span className="service-status">
                                        {running ? (
                                            <>
                                                <span className="status-dot running"></span>
                                                {count > 0 && <span className="wallet-count">×{count}</span>}
                                            </>
                                        ) : (
                                            <span className="status-dot stopped"></span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* BNB Chain Column */}
                <div className="chain-column bnb">
                    <div className="chain-header">
                        <span className="chain-badge">💛 BNB Chain</span>
                        <span className="chain-count">{totalBnb} running</span>
                    </div>
                    <div className="services-list">
                        {SERVICES.map(service => {
                            const running = isRunning(service.key, 'bnb');
                            const count = getRunningCount(service.key, 'bnb');
                            return (
                                <div 
                                    key={service.key} 
                                    className={`service-item ${running ? 'running' : 'stopped'}`}
                                >
                                    <span className="service-icon">{service.icon}</span>
                                    <span className="service-name">{service.label}</span>
                                    <span className="service-status">
                                        {running ? (
                                            <>
                                                <span className="status-dot running"></span>
                                                {count > 0 && <span className="wallet-count">×{count}</span>}
                                            </>
                                        ) : (
                                            <span className="status-dot stopped"></span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
