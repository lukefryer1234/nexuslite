import React, { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import API_BASE from '../config/api';
import './CrimeAnalyticsPanel.css';

/**
 * CrimeAnalyticsPanel - Shows crime statistics and optimal type recommendation
 */
export default function CrimeAnalyticsPanel({ onCrimeTypeChange }) {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = usePersistentState('nexus_crime_panel_expanded', false);
    const [selectedType, setSelectedType] = useState(0);

    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/scripts/crime/analytics`);
            const data = await res.json();
            setAnalytics(data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch crime analytics:', err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchAnalytics]);

    const handleTypeChange = (e) => {
        const type = parseInt(e.target.value);
        setSelectedType(type);
        if (onCrimeTypeChange) {
            onCrimeTypeChange(type);
        }
        // Store in localStorage for persistence
        localStorage.setItem('selectedCrimeType', String(type));
    };

    // Load saved crime type on mount
    useEffect(() => {
        const saved = localStorage.getItem('selectedCrimeType');
        if (saved !== null) {
            const type = parseInt(saved);
            setSelectedType(type);
            if (onCrimeTypeChange) {
                onCrimeTypeChange(type);
            }
        }
    }, [onCrimeTypeChange]);

    const handleReset = async () => {
        if (!confirm('Reset all crime analytics data?')) return;
        try {
            await fetch(`${API_BASE}/api/scripts/crime/analytics/reset`, { method: 'POST' });
            fetchAnalytics();
        } catch (err) {
            console.error('Failed to reset analytics:', err);
        }
    };

    if (loading || !analytics) {
        return (
            <div className="crime-analytics-panel">
                <div className="panel-header">
                    <h3>📊 Crime Analytics</h3>
                </div>
                <div className="loading">Loading...</div>
            </div>
        );
    }

    const recommendation = analytics.recommendation;
    const allTypes = recommendation?.allTypes || [];

    return (
        <div className="crime-analytics-panel">
            <div 
                className="panel-header"
                onClick={() => setExpanded(!expanded)}
            >
                <h3>📊 Crime Analytics</h3>
                <div className="header-right">
                    <span className="recommendation-badge">
                        ⭐ Optimal: Type {recommendation?.recommended} ({recommendation?.name})
                    </span>
                    <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
                </div>
            </div>

            {expanded && (
                <div className="panel-content">
                    {/* Crime Type Selector */}
                    <div className="type-selector">
                        <label>Active Crime Type:</label>
                        <select value={selectedType} onChange={handleTypeChange}>
                            {allTypes.map(t => (
                                <option key={t.crimeType} value={t.crimeType}>
                                    Type {t.crimeType}: {t.name} 
                                    {t.crimeType === recommendation?.recommended ? ' ⭐' : ''}
                                </option>
                            ))}
                        </select>
                        <span className="type-hint">
                            EV: {allTypes.find(t => t.crimeType === selectedType)?.evPerHour?.toFixed(1) || '?'}/hr
                        </span>
                    </div>

                    {/* Stats Table */}
                    <div className="stats-table">
                        <div className="stats-header">
                            <span>Type</span>
                            <span>Attempts</span>
                            <span>Success</span>
                            <span>Jail %</span>
                            <span>EV/Hour</span>
                        </div>
                        {allTypes.map(t => (
                            <div 
                                key={t.crimeType} 
                                className={`stats-row ${t.crimeType === recommendation?.recommended ? 'recommended' : ''}`}
                            >
                                <span className="type-name">
                                    {t.crimeType === recommendation?.recommended && '⭐ '}
                                    {t.name}
                                </span>
                                <span>{t.attempts || 0}</span>
                                <span className="success-rate">
                                    {t.successRate?.toFixed(0) || '?'}%
                                </span>
                                <span className="jail-rate">
                                    {t.jailRate?.toFixed(0) || '?'}%
                                </span>
                                <span className="ev-value">
                                    {t.evPerHour?.toFixed(1)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="recommendation-info">
                        <span className={`confidence ${recommendation?.confidence}`}>
                            {recommendation?.confidence === 'high' ? '🎯' : '📈'} 
                            {recommendation?.confidence === 'high' ? 'High confidence' : 'Low data'}
                        </span>
                        <span className="reason">{recommendation?.reason}</span>
                    </div>

                    <div className="panel-actions">
                        <button className="refresh-btn" onClick={fetchAnalytics}>
                            🔄 Refresh
                        </button>
                        <button className="reset-btn" onClick={handleReset}>
                            🗑️ Reset Data
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
