import React, { useState, useEffect, useRef } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import './LogViewer.css';

/**
 * LogViewer - Terminal-styled log viewer with filtering and controls
 * 
 * @param {array} logs - Array of log entries {time, text, type?, chain?}
 * @param {number} maxLines - Maximum lines to display (default: 100)
 * @param {boolean} autoScroll - Enable auto-scrolling (default: true)
 * @param {boolean} showFilters - Show type/chain filter dropdowns
 * @param {boolean} showControls - Show copy/clear/export buttons
 * @param {function} onClear - Callback when clear is clicked
 * @param {string} title - Optional header title
 * @param {string} height - CSS height (default: '300px')
 */
export default function LogViewer({
    logs = [],
    maxLines = 100,
    autoScroll = true,
    showFilters = true,
    showControls = true,
    onClear,
    title = '📜 LOGS',
    height = '300px',
    placeholder = 'Waiting for logs...'
}) {
    const [typeFilter, setTypeFilter] = usePersistentState('nexus_log_type_filter', 'all');
    const [chainFilter, setChainFilter] = usePersistentState('nexus_log_chain_filter', 'all');
    const [autoScrollEnabled, setAutoScrollEnabled] = usePersistentState('nexus_log_autoscroll', autoScroll);
    const [copied, setCopied] = useState(false);
    const logsEndRef = useRef(null);
    const containerRef = useRef(null);

    // Auto-scroll when logs update
    useEffect(() => {
        if (autoScrollEnabled && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScrollEnabled]);

    // Filter logs
    const filteredLogs = logs
        .filter(log => {
            if (typeFilter !== 'all' && log.type !== typeFilter) return false;
            if (chainFilter !== 'all' && log.chain !== chainFilter) return false;
            return true;
        })
        .slice(-maxLines);

    // Get unique types and chains for filters
    const types = [...new Set(logs.map(l => l.type).filter(Boolean))];
    const chains = [...new Set(logs.map(l => l.chain).filter(Boolean))];

    // Copy logs to clipboard
    const handleCopy = () => {
        const text = filteredLogs.map(log => {
            const time = log.time ? new Date(log.time).toLocaleTimeString() : '';
            const chain = log.chain ? `[${log.chain.toUpperCase()}]` : '';
            return `${time} ${chain} ${log.text || log.message || ''}`;
        }).join('\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Export as CSV
    const handleExport = () => {
        const header = 'timestamp,chain,type,message\n';
        const content = filteredLogs.map(log => {
            const time = log.time ? new Date(log.time).toISOString() : '';
            const text = (log.text || log.message || '').replace(/,/g, ';').replace(/\n/g, ' ');
            return `${time},${log.chain || ''},${log.type || ''},${text}`;
        }).join('\n');

        const blob = new Blob([header + content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Get icon for log entry
    const getLogIcon = (log) => {
        const text = (log.text || log.message || '').toLowerCase();
        if (text.includes('success') || text.includes('completed')) return '✅';
        if (text.includes('fail') || text.includes('error') || text.includes('jail')) return '❌';
        if (text.includes('heal')) return '💊';
        if (text.includes('bust')) return '🔓';
        if (text.includes('crime')) return '🔫';
        if (text.includes('claim') || text.includes('yield')) return '💰';
        if (log.type === 'stderr') return '⚠️';
        return '📝';
    };

    // Get chain badge class
    const getChainClass = (chain) => {
        if (chain === 'pls' || chain === 'pulsechain') return 'chain-pls';
        if (chain === 'bnb') return 'chain-bnb';
        return '';
    };

    return (
        <div className="log-viewer">
            {/* Header */}
            <div className="log-header">
                <span className="log-title">{title}</span>

                {showFilters && (types.length > 0 || chains.length > 0) && (
                    <div className="log-filters">
                        {types.length > 0 && (
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="log-filter"
                            >
                                <option value="all">All Types</option>
                                {types.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        )}
                        {chains.length > 0 && (
                            <select
                                value={chainFilter}
                                onChange={(e) => setChainFilter(e.target.value)}
                                className="log-filter"
                            >
                                <option value="all">All Chains</option>
                                {chains.map(c => (
                                    <option key={c} value={c}>{c.toUpperCase()}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {showControls && (
                    <div className="log-controls">
                        <label className="log-autoscroll">
                            <input
                                type="checkbox"
                                checked={autoScrollEnabled}
                                onChange={(e) => setAutoScrollEnabled(e.target.checked)}
                            />
                            Auto
                        </label>
                        <button
                            className="log-btn"
                            onClick={handleCopy}
                            title="Copy to clipboard"
                        >
                            {copied ? '✓' : '📋'}
                        </button>
                        <button
                            className="log-btn"
                            onClick={handleExport}
                            title="Export as CSV"
                        >
                            📥
                        </button>
                        {onClear && (
                            <button
                                className="log-btn danger"
                                onClick={onClear}
                                title="Clear logs"
                            >
                                🗑
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Log Window */}
            <div
                className="log-window"
                ref={containerRef}
                style={{ height }}
            >
                {filteredLogs.length === 0 ? (
                    <div className="log-placeholder">{placeholder}</div>
                ) : (
                    filteredLogs.map((log, i) => (
                        <div
                            key={i}
                            className={`log-entry ${log.type || ''} ${getChainClass(log.chain)}`}
                        >
                            <span className="log-icon">{getLogIcon(log)}</span>
                            {log.time && (
                                <span className="log-time">
                                    {new Date(log.time).toLocaleTimeString()}
                                </span>
                            )}
                            {log.chain && (
                                <span className={`log-chain ${getChainClass(log.chain)}`}>
                                    {log.chain.toUpperCase()}
                                </span>
                            )}
                            <span className="log-text">{log.text || log.message}</span>
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>

            {/* Footer */}
            <div className="log-footer">
                <span className="log-count">
                    {filteredLogs.length} / {logs.length} logs
                </span>
                <span className="log-live">
                    <span className="pulse" />
                    Live
                </span>
            </div>
        </div>
    );
}
